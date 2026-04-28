import path from "node:path";
import { Request, Response } from "express";
import { z } from "zod";
import { ApplicationModel } from "../models/Application.js";
import { JobModel } from "../models/Job.js";
import { OrganizationModel } from "../models/Organization.js";
import { AuthenticatedRequest } from "../types/index.js";
import { scoreCandidateWithGroq } from "../services/groqScoringService.js";
import {
  AiProviderError,
  scoreWithProvider,
  type AiScoringConfig,
} from "../services/aiScoringService.js";
import { analyzeResumeFile, ResumeMetrics } from "../services/resumeAnalyzerService.js";
import { computeWeightedScore } from "../services/scoringService.js";
import { emitCandidateScored } from "../sockets/index.js";
import { isDuplicateKeyError } from "../utils/mongoErrors.js";

const updateApplicationSchema = z.object({
  status: z.enum(["applied", "shortlisted", "rejected", "pending"]).optional(),
  notes: z.string().optional(),
});

const submitApplicationSchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email is required"),
});

export async function submitApplication(req: Request, res: Response): Promise<void> {
  const { jobId } = req.params;

  const parsed = submitApplicationSchema.safeParse({ email: req.body?.email });
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const { email } = parsed.data;

  let answers: Record<string, unknown> = {};
  if (req.body?.answers) {
    try {
      const parsedAnswers = JSON.parse(String(req.body.answers));
      if (parsedAnswers && typeof parsedAnswers === "object" && !Array.isArray(parsedAnswers)) {
        answers = parsedAnswers as Record<string, unknown>;
      } else {
        res.status(400).json({ message: "answers must be a JSON object" });
        return;
      }
    } catch {
      res.status(400).json({ message: "answers must be valid JSON" });
      return;
    }
  }

  const job = await JobModel.findOne({ applyLink: `/apply/${jobId}` });
  if (!job) {
    res.status(404).json({ message: "Job not found" });
    return;
  }

  if (job.status !== "active") {
    res.status(410).json({ message: "This application form has expired. Better luck next time." });
    return;
  }

  const file = req.file;
  if (!file) {
    res.status(400).json({ message: "Resume file is required" });
    return;
  }

  try {
    const application = await ApplicationModel.create({
      jobId: job._id,
      email,
      answers,
      resumeUrl: `/uploads/resumes/${path.basename(file.path)}`,
      status: "pending",
    });

    res.status(201).json({
      applicationId: application._id,
      message: "Application received. Scoring in progress.",
    });

    processSubmission({
      applicationId: String(application._id),
      jobId: String(job._id),
      orgId: String(job.orgId),
      filePath: file.path,
    }).catch((err) => {
      console.error(
        "[submitApplication] processSubmission unhandled error:",
        { applicationId: String(application._id), jobId: String(job._id) },
        err,
      );
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      res.status(409).json({ message: "This email has already applied for this job" });
      return;
    }
    throw error;
  }
}

const DEFAULT_SCORING_WEIGHTS = { skills: 40, experience: 25, format: 15, answers: 20 };

const FALLBACK_RESUME_METRICS: ResumeMetrics = {
  fontConsistency: 75,
  alignmentScore: 70,
  spacingScore: 70,
  detectedSkills: [],
  experienceYears: 0,
};

async function resolveAutoStatus(
  orgId: string,
  score: number,
): Promise<"applied" | "shortlisted" | "rejected"> {
  try {
    const org = await OrganizationModel.findById(orgId).select(
      "autoShortlistEnabled autoShortlistThreshold autoRejectEnabled autoRejectThreshold",
    );
    if (!org) return "applied";
    if (org.autoShortlistEnabled && score >= (org.autoShortlistThreshold ?? 100)) {
      return "shortlisted";
    }
    if (org.autoRejectEnabled && score <= (org.autoRejectThreshold ?? 0)) {
      return "rejected";
    }
    return "applied";
  } catch {
    return "applied";
  }
}

async function processSubmission(input: {
  applicationId: string;
  jobId: string;
  orgId: string;
  filePath: string;
}): Promise<void> {
  const job = await JobModel.findById(input.jobId);
  if (!job) {
    return;
  }

  try {
    let resumeMetrics: ResumeMetrics;
    let usedFallbackMetrics = false;

    try {
      resumeMetrics = await analyzeResumeFile(input.filePath);
    } catch (analyzerErr) {
      console.warn(
        "[processSubmission] Python analyzer unavailable, using fallback metrics:",
        analyzerErr instanceof Error ? analyzerErr.message : "unknown error",
      );
      resumeMetrics = FALLBACK_RESUME_METRICS;
      usedFallbackMetrics = true;
    }

    const scoringInput = {
      requirements: job.requirements ?? "",
      requiredSkills: job.requiredSkills ?? [],
      resumeMetrics,
    };

    // Resolve org-configured provider; fall back to SkillBias default on failure.
    const orgForAi = await OrganizationModel.findById(input.orgId).select(
      "aiProvider aiModel aiApiKey aiCustomUrl aiCustomAuthHeader",
    );
    const aiConfig: AiScoringConfig = {
      provider: (orgForAi?.aiProvider as AiScoringConfig["provider"]) ?? "skillbias",
      model: orgForAi?.aiModel ?? "",
      apiKey: orgForAi?.aiApiKey ?? "",
      customUrl: orgForAi?.aiCustomUrl ?? "",
      customAuthHeader: orgForAi?.aiCustomAuthHeader ?? "",
    };

    let aiResult;
    let providerFallbackNote = "";
    try {
      aiResult = await scoreWithProvider(aiConfig, scoringInput);
    } catch (providerErr) {
      if (providerErr instanceof AiProviderError && aiConfig.provider !== "skillbias") {
        console.warn(
          "[processSubmission] AI provider failed, falling back to SkillBias default:",
          providerErr.message,
        );
        providerFallbackNote = `Your configured AI provider (${aiConfig.provider}) failed: ${providerErr.originalMessage}. Used SkillBias default scoring instead.`;
        aiResult = await scoreCandidateWithGroq(scoringInput);
      } else {
        throw providerErr;
      }
    }

    const weights =
      job.scoringWeights &&
      typeof job.scoringWeights === "object" &&
      [job.scoringWeights.skills, job.scoringWeights.experience, job.scoringWeights.format, job.scoringWeights.answers].every(
        (w) => typeof w === "number",
      )
        ? job.scoringWeights
        : DEFAULT_SCORING_WEIGHTS;

    const finalScore = computeWeightedScore({
      aiScore: aiResult.score,
      resumeMetrics,
      weights,
    });

    let feedback = aiResult.feedback;
    if (usedFallbackMetrics) {
      feedback += "\n\n(Note: Resume layout analysis was unavailable. Score is based on AI content review only.)";
    }
    if (providerFallbackNote) {
      feedback += `\n\n(Note: ${providerFallbackNote})`;
    }

    const autoStatus = await resolveAutoStatus(input.orgId, finalScore);

    await ApplicationModel.findByIdAndUpdate(input.applicationId, {
      resumeAnalysis: resumeMetrics,
      score: finalScore,
      aiFeedback: feedback,
      status: autoStatus,
    });

    emitCandidateScored(input.orgId, { jobId: input.jobId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scoring failed";
    console.error("[processSubmission] Scoring failed:", message);
    await ApplicationModel.findByIdAndUpdate(input.applicationId, {
      score: 0,
      aiFeedback: `Scoring could not be completed. (${message}) You can still review this application manually.`,
      status: "applied",
    });
    emitCandidateScored(input.orgId, { jobId: input.jobId });
  }
}

const APPLICATION_STATUSES = ["applied", "shortlisted", "rejected", "pending"] as const;
const CANDIDATE_SORT_FIELDS = ["score", "createdAt"] as const;
const CANDIDATES_DEFAULT_PAGE_SIZE = 25;
const CANDIDATES_MAX_PAGE_SIZE = 100;

const listCandidatesQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: z.enum(APPLICATION_STATUSES).optional(),
  jobId: z.string().optional(),
  scoreMin: z.coerce.number().int().min(0).max(100).optional(),
  scoreMax: z.coerce.number().int().min(0).max(100).optional(),
  sort: z.enum(CANDIDATE_SORT_FIELDS).default("score"),
  order: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(CANDIDATES_MAX_PAGE_SIZE)
    .default(CANDIDATES_DEFAULT_PAGE_SIZE),
});

export async function listAllCandidates(req: AuthenticatedRequest, res: Response): Promise<void> {
  const orgId = req.organization?.orgId;
  if (!orgId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const query = listCandidatesQuerySchema.parse(req.query);

  const orgJobs = await JobModel.find({ orgId }).select("title status");
  const orgJobIdSet = new Set(orgJobs.map((j) => String(j._id)));
  const jobTitleById = new Map(orgJobs.map((j) => [String(j._id), j.title]));

  let scopedJobIds = orgJobs.map((j) => j._id);
  if (query.jobId) {
    if (!orgJobIdSet.has(query.jobId)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    scopedJobIds = scopedJobIds.filter((id) => String(id) === query.jobId);
  }

  const filter: Record<string, unknown> = { jobId: { $in: scopedJobIds } };
  if (query.status) filter.status = query.status;
  if (query.q) {
    const safe = query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.email = new RegExp(safe, "i");
  }
  if (query.scoreMin !== undefined || query.scoreMax !== undefined) {
    const range: Record<string, number> = {};
    if (query.scoreMin !== undefined) range.$gte = query.scoreMin;
    if (query.scoreMax !== undefined) range.$lte = query.scoreMax;
    filter.score = range;
  }

  const sortDir = query.order === "asc" ? 1 : -1;
  const sortSpec: Record<string, 1 | -1> = { [query.sort]: sortDir };

  const [total, applications] = await Promise.all([
    ApplicationModel.countDocuments(filter),
    ApplicationModel.find(filter)
      .select("email score status notes jobId createdAt")
      .sort(sortSpec)
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize),
  ]);

  const candidates = applications.map((app) => ({
    id: String(app._id),
    email: app.email,
    score: app.score,
    status: app.status,
    notes: app.notes ?? "",
    jobId: String(app.jobId),
    jobTitle: jobTitleById.get(String(app.jobId)) ?? "",
    createdAt: (app as unknown as { createdAt?: Date }).createdAt ?? null,
  }));

  res.json({
    candidates,
    page: query.page,
    pageSize: query.pageSize,
    total,
    hasMore: query.page * query.pageSize < total,
    jobs: orgJobs.map((j) => ({ id: String(j._id), title: j.title, status: j.status })),
  });
}

export async function updateApplication(req: AuthenticatedRequest, res: Response): Promise<void> {
  const orgId = req.organization?.orgId;
  const { id } = req.params;
  const payload = updateApplicationSchema.parse(req.body);

  const application = await ApplicationModel.findById(id);
  if (!application) {
    res.status(404).json({ message: "Application not found" });
    return;
  }

  const job = await JobModel.findOne({ _id: application.jobId, orgId });
  if (!job) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  const updated = await ApplicationModel.findByIdAndUpdate(id, payload, { new: true });
  res.json({ application: updated });
}
