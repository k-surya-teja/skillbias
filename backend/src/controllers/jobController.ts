import { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ApplicationModel } from "../models/Application.js";
import { JobModel } from "../models/Job.js";
import { OrganizationModel } from "../models/Organization.js";
import { AuthenticatedRequest } from "../types/index.js";
import { autoCloseExpiredJobs } from "../services/jobService.js";
import { canCreateJob, markFreeJobUsed } from "../services/subscriptionService.js";
import { toCsv } from "../utils/csv.js";

const formFieldSchema = z.object({
  label: z.string().min(1),
  type: z.enum(["text", "number", "email", "file", "select", "textarea", "date"]),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
});

const scoringWeightSchema = z.object({
  skills: z.number().min(0).default(40),
  experience: z.number().min(0).default(25),
  format: z.number().min(0).default(15),
  answers: z.number().min(0).default(20),
});

const jobCreateSchema = z.object({
  title: z.string().min(2),
  description: z.string().min(10, { message: "Description must be at least 10 characters" }),
  requirements: z.string().optional().default(""),
  requiredSkills: z.array(z.string()).default([]),
  endDate: z.string().datetime(),
  formFields: z.array(formFieldSchema).default([]),
  scoringWeights: scoringWeightSchema.optional(),
  isPublic: z.boolean().optional(),
});

const jobUpdateSchema = jobCreateSchema.partial().extend({
  status: z.enum(["active", "closed"]).optional(),
});

export async function createJob(req: AuthenticatedRequest, res: Response): Promise<void> {
  const orgId = req.organization?.orgId;
  if (!orgId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const allowed = await canCreateJob(orgId);
  if (!allowed) {
    res.status(402).json({ message: "Upgrade to pro plan to create more jobs" });
    return;
  }

  const payload = jobCreateSchema.parse(req.body);

  const org = await OrganizationModel.findById(orgId).select(
    "defaultScoringWeights defaultJobIsPublic",
  );
  const defaultWeights = org?.defaultScoringWeights ?? {
    skills: 40,
    experience: 25,
    format: 15,
    answers: 20,
  };
  const defaultIsPublic = org?.defaultJobIsPublic ?? false;

  const job = await JobModel.create({
    orgId,
    ...payload,
    scoringWeights: payload.scoringWeights ?? defaultWeights,
    isPublic: payload.isPublic ?? defaultIsPublic,
    endDate: new Date(payload.endDate),
    postingDate: new Date(),
    applyLink: `/apply/${randomUUID()}`,
  });

  await markFreeJobUsed(orgId);
  res.status(201).json({ job });
}

export async function listJobs(req: AuthenticatedRequest, res: Response): Promise<void> {
  const orgId = req.organization?.orgId;
  if (!orgId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  await autoCloseExpiredJobs();
  const jobs = await JobModel.find({ orgId }).sort({ createdAt: -1 });
  res.json({ jobs });
}

export async function getJobById(req: AuthenticatedRequest, res: Response): Promise<void> {
  const orgId = req.organization?.orgId;
  const { id } = req.params;
  await autoCloseExpiredJobs();
  const job = await JobModel.findOne({ _id: id, orgId });

  if (!job) {
    res.status(404).json({ message: "Job not found" });
    return;
  }

  res.json({ job });
}

export async function updateJob(req: AuthenticatedRequest, res: Response): Promise<void> {
  const orgId = req.organization?.orgId;
  const { id } = req.params;
  const payload = jobUpdateSchema.parse(req.body);

  const updateData: Record<string, unknown> = { ...payload };
  if (payload.endDate) {
    updateData.endDate = new Date(payload.endDate);
  }

  const job = await JobModel.findOneAndUpdate({ _id: id, orgId }, updateData, { new: true });
  if (!job) {
    res.status(404).json({ message: "Job not found" });
    return;
  }

  res.json({ job });
}

export async function deleteJob(req: AuthenticatedRequest, res: Response): Promise<void> {
  const orgId = req.organization?.orgId;
  const { id } = req.params;
  const deleted = await JobModel.findOneAndDelete({ _id: id, orgId });

  if (!deleted) {
    res.status(404).json({ message: "Job not found" });
    return;
  }

  await ApplicationModel.deleteMany({ jobId: id });
  res.status(204).send();
}

const APPLICATION_STATUSES = ["applied", "shortlisted", "rejected", "pending"] as const;
const SORT_FIELDS = ["score", "createdAt"] as const;

const listApplicationsQuerySchema = z.object({
  sortBy: z.enum(SORT_FIELDS).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
  status: z.enum(APPLICATION_STATUSES).optional(),
});

export async function getJobApplications(req: AuthenticatedRequest, res: Response): Promise<void> {
  const orgId = req.organization?.orgId;
  const { id } = req.params;
  const { sortBy, order, status } = listApplicationsQuerySchema.parse(req.query);

  await autoCloseExpiredJobs();
  const job = await JobModel.findOne({ _id: id, orgId });
  if (!job) {
    res.status(404).json({ message: "Job not found" });
    return;
  }

  const query: Record<string, unknown> = { jobId: id };
  if (status) {
    query.status = status;
  }

  const applications = await ApplicationModel.find(query).sort({ [sortBy]: order === "asc" ? 1 : -1 });
  res.json({ applications });
}

export async function exportJobApplications(req: AuthenticatedRequest, res: Response): Promise<void> {
  const orgId = req.organization?.orgId;
  const { id } = req.params;
  const job = await JobModel.findOne({ _id: id, orgId });
  if (!job) {
    res.status(404).json({ message: "Job not found" });
    return;
  }

  const applications = await ApplicationModel.find({ jobId: id }).sort({ score: -1 });
  const csv = toCsv(
    applications.map((app) => ({
      email: app.email,
      score: app.score,
      status: app.status,
      notes: app.notes,
      resumeUrl: app.resumeUrl,
      createdAt: app.createdAt?.toISOString() ?? "",
    })),
  );

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="job-${id}-applications.csv"`);
  res.send(csv);
}

const DESCRIPTION_SNIPPET_LENGTH = 220;
const PUBLIC_JOBS_DEFAULT_PAGE_SIZE = 12;
const PUBLIC_JOBS_MAX_PAGE_SIZE = 48;

export async function listPublicJobs(req: Request, res: Response): Promise<void> {
  await autoCloseExpiredJobs();

  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const skillsParam = typeof req.query.skills === "string" ? req.query.skills : "";
  const skillFilters = skillsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const sort = req.query.sort === "ending-soon" ? "ending-soon" : "newest";
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(
    PUBLIC_JOBS_MAX_PAGE_SIZE,
    Math.max(1, Number(req.query.pageSize) || PUBLIC_JOBS_DEFAULT_PAGE_SIZE),
  );

  const baseQuery: Record<string, unknown> = { isPublic: true, status: "active" };
  if (q) {
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(safe, "i");
    baseQuery.$or = [{ title: rx }, { description: rx }, { requiredSkills: rx }];
  }
  if (skillFilters.length > 0) {
    baseQuery.requiredSkills = {
      $all: skillFilters.map((s) => new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")),
    };
  }

  const sortSpec: Record<string, 1 | -1> =
    sort === "ending-soon" ? { endDate: 1 } : { createdAt: -1 };

  const [total, jobs] = await Promise.all([
    JobModel.countDocuments(baseQuery),
    JobModel.find(baseQuery)
      .populate("orgId", "companyName logo")
      .select("title description requiredSkills endDate postingDate createdAt applyLink")
      .sort(sortSpec)
      .skip((page - 1) * pageSize)
      .limit(pageSize),
  ]);

  // Optional company-name search after the initial filter — done in-memory so we don't have
  // to denormalize companyName onto Job. Cheap because we only post-filter the current page.
  let pageJobs = jobs;
  if (q) {
    const lc = q.toLowerCase();
    const matchesCompany = pageJobs.filter((job) => {
      const org = job.orgId as unknown as { companyName?: string } | null;
      return org?.companyName?.toLowerCase().includes(lc);
    });
    const ids = new Set(pageJobs.map((j) => String(j._id)));
    matchesCompany.forEach((j) => ids.add(String(j._id)));
    pageJobs = pageJobs.filter((j) => ids.has(String(j._id)));
  }

  const jobIds = pageJobs.map((j) => j._id);
  const counts = await ApplicationModel.aggregate<{ _id: unknown; count: number }>([
    { $match: { jobId: { $in: jobIds } } },
    { $group: { _id: "$jobId", count: { $sum: 1 } } },
  ]);
  const countByJob = new Map(counts.map((c) => [String(c._id), c.count]));

  function snippet(text: string): string {
    if (!text) return "";
    if (text.length <= DESCRIPTION_SNIPPET_LENGTH) return text;
    return text.slice(0, DESCRIPTION_SNIPPET_LENGTH).trimEnd() + "…";
  }

  const mapped = pageJobs.map((job) => {
    const org = job.orgId as unknown as { companyName: string; logo?: string };
    const created = (job as unknown as { createdAt?: Date }).createdAt ?? job.postingDate;
    return {
      _id: job._id,
      title: job.title,
      description: snippet(job.description ?? ""),
      requiredSkills: job.requiredSkills,
      endDate: job.endDate,
      postingDate: created ?? null,
      applyLink: job.applyLink,
      companyName: org?.companyName ?? "",
      companyLogo: org?.logo ?? "",
      applicantsCount: countByJob.get(String(job._id)) ?? 0,
    };
  });

  res.json({
    jobs: mapped,
    page,
    pageSize,
    total,
    hasMore: page * pageSize < total,
  });
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getPublicJob(req: Request, res: Response): Promise<void> {
  const { jobId } = req.params;
  if (!jobId || !UUID_REGEX.test(jobId)) {
    res.status(404).json({ message: "Job not found" });
    return;
  }
  await autoCloseExpiredJobs();
  const job = await JobModel.findOne({ applyLink: `/apply/${jobId}` }).select(
    "title description requirements requiredSkills formFields endDate status",
  );

  if (!job) {
    res.status(404).json({ message: "Job not found" });
    return;
  }

  if (job.status !== "active") {
    res.status(410).json({ message: "This application form has expired. Better luck next time." });
    return;
  }

  res.json({ job });
}
