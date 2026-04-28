import { Response } from "express";
import { ApplicationModel } from "../models/Application.js";
import { JobModel } from "../models/Job.js";
import { AuthenticatedRequest } from "../types/index.js";
import { autoCloseExpiredJobs } from "../services/jobService.js";

export async function getDashboardStats(req: AuthenticatedRequest, res: Response): Promise<void> {
  const orgId = req.organization?.orgId;
  if (!orgId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  await autoCloseExpiredJobs();
  const jobs = await JobModel.find({ orgId });
  const jobIds = jobs.map((job) => job._id);
  const jobTitleById = new Map(jobs.map((job) => [String(job._id), job.title]));
  const applications = await ApplicationModel.find({ jobId: { $in: jobIds } }).sort({ score: -1 });

  const avgScore =
    applications.length === 0
      ? 0
      : Math.round(applications.reduce((sum, app) => sum + app.score, 0) / applications.length);

  const applicantsPerJob = jobs.map((job) => ({
    jobTitle: job.title,
    count: applications.filter((app) => String(app.jobId) === String(job._id)).length,
  }));

  const scoreDistribution = [
    { range: "0-20", count: applications.filter((a) => a.score <= 20).length },
    { range: "21-40", count: applications.filter((a) => a.score > 20 && a.score <= 40).length },
    { range: "41-60", count: applications.filter((a) => a.score > 40 && a.score <= 60).length },
    { range: "61-80", count: applications.filter((a) => a.score > 60 && a.score <= 80).length },
    { range: "81-100", count: applications.filter((a) => a.score > 80).length },
  ];

  const applicationsOverTimeMap = new Map<string, number>();
  for (const application of applications) {
    const dateKey = new Date(application.createdAt ?? new Date()).toISOString().slice(0, 10);
    applicationsOverTimeMap.set(dateKey, (applicationsOverTimeMap.get(dateKey) ?? 0) + 1);
  }
  const applicationsOverTime = Array.from(applicationsOverTimeMap.entries())
    .sort((a, b) => (a[0] > b[0] ? 1 : -1))
    .map(([date, count]) => ({ date, count }));

  const topCandidates = applications.slice(0, 5).map((app) => ({
    id: String(app._id),
    email: app.email,
    score: app.score,
    jobId: String(app.jobId),
    jobTitle: jobTitleById.get(String(app.jobId)) ?? "",
    status: app.status,
  }));

  const pipelineByStatus = {
    pending: applications.filter((a) => a.status === "pending").length,
    applied: applications.filter((a) => a.status === "applied").length,
    shortlisted: applications.filter((a) => a.status === "shortlisted").length,
    rejected: applications.filter((a) => a.status === "rejected").length,
  };

  res.json({
    stats: {
      totalJobs: jobs.length,
      activeJobs: jobs.filter((j) => j.status === "active").length,
      closedJobs: jobs.filter((j) => j.status === "closed").length,
      totalApplicants: applications.length,
      avgScore,
      topCandidate: applications[0]
        ? {
            email: applications[0].email,
            score: applications[0].score,
            jobId: applications[0].jobId,
          }
        : null,
    },
    charts: {
      applicantsPerJob,
      scoreDistribution,
      applicationsOverTime,
    },
    topCandidates,
    pipelineByStatus,
  });
}
