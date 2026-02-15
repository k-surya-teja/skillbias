import { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ApplicationModel } from "../models/Application.js";
import { JobModel } from "../models/Job.js";
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
  description: z.string().min(20),
  requirements: z.string().optional().default(""),
  requiredSkills: z.array(z.string()).default([]),
  endDate: z.string().datetime(),
  formFields: z.array(formFieldSchema).default([]),
  scoringWeights: scoringWeightSchema.default({
    skills: 40,
    experience: 25,
    format: 15,
    answers: 20,
  }),
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
  const job = await JobModel.create({
    orgId,
    ...payload,
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

export async function getJobApplications(req: AuthenticatedRequest, res: Response): Promise<void> {
  const orgId = req.organization?.orgId;
  const { id } = req.params;
  const sortBy = req.query.sortBy === "score" ? "score" : "createdAt";
  const order = req.query.order === "asc" ? 1 : -1;
  const status = typeof req.query.status === "string" ? req.query.status : "";

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

  const applications = await ApplicationModel.find(query).sort({ [sortBy]: order });
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

export async function getPublicJob(req: Request, res: Response): Promise<void> {
  const { jobId } = req.params;
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
