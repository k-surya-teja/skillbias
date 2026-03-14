import path from "node:path";
import { Request, Response } from "express";
import { z } from "zod";
import { ApplicationModel } from "../models/Application.js";
import { JobModel } from "../models/Job.js";
import { AuthenticatedRequest } from "../types/index.js";
import { scoreCandidateWithGroq } from "../services/groqScoringService.js";
import { analyzeResumeFile, ResumeMetrics } from "../services/resumeAnalyzerService.js";
import { computeWeightedScore } from "../services/scoringService.js";
import { emitCandidateScored } from "../sockets/index.js";
import { isDuplicateKeyError } from "../utils/mongoErrors.js";

const updateApplicationSchema = z.object({
  status: z.enum(["applied", "shortlisted", "rejected", "pending"]).optional(),
  notes: z.string().optional(),
});

export async function submitApplication(req: Request, res: Response): Promise<void> {
  const { jobId } = req.params;
  const email = String(req.body.email ?? "").toLowerCase().trim();

  if (!email) {
    res.status(400).json({ message: "Email is required" });
    return;
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
      answers: req.body.answers ? JSON.parse(String(req.body.answers)) : {},
      resumeUrl: `/uploads/resumes/${path.basename(file.path)}`,
      status: "pending",
    });

    res.status(201).json({
      applicationId: application._id,
      message: "Application received. Scoring in progress.",
    });

    void processSubmission({
      applicationId: String(application._id),
      jobId: String(job._id),
      orgId: String(job.orgId),
      filePath: file.path,
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

    const aiResult = await scoreCandidateWithGroq({
      requirements: job.requirements ?? "",
      requiredSkills: job.requiredSkills ?? [],
      resumeMetrics,
    });

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

    const feedback = usedFallbackMetrics
      ? `${aiResult.feedback}\n\n(Note: Resume layout analysis was unavailable. Score is based on AI content review only.)`
      : aiResult.feedback;

    await ApplicationModel.findByIdAndUpdate(input.applicationId, {
      resumeAnalysis: resumeMetrics,
      score: finalScore,
      aiFeedback: feedback,
      status: "applied",
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
