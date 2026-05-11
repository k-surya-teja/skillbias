import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { DashboardStatsResponse } from "./types";

export async function getDashboardStats(): Promise<DashboardStatsResponse> {
  const supabase = createSupabaseBrowserClient();

  // Auto-close expired jobs first (RLS scopes to this org).
  await supabase
    .from("jobs")
    .update({ status: "closed" })
    .eq("status", "active")
    .lt("end_date", new Date().toISOString());

  // Pull jobs + applications for the org in parallel. RLS scopes both.
  const [jobsRes, appsRes] = await Promise.all([
    supabase.from("jobs").select("id, title, status"),
    supabase
      .from("applications")
      .select("id, job_id, email, score, status, created_at")
      .order("score", { ascending: false }),
  ]);

  if (jobsRes.error) throw new Error(jobsRes.error.message);
  if (appsRes.error) throw new Error(appsRes.error.message);

  const jobs = jobsRes.data ?? [];
  const applications = (appsRes.data ?? []).map((a) => ({ ...a, score: Number(a.score) }));

  const jobTitleById = new Map(jobs.map((j) => [j.id, j.title]));

  const avgScore =
    applications.length === 0
      ? 0
      : Math.round(applications.reduce((sum, a) => sum + a.score, 0) / applications.length);

  const applicantsPerJob = jobs.map((j) => ({
    jobTitle: j.title,
    count: applications.filter((a) => a.job_id === j.id).length,
  }));

  const scoreDistribution = [
    { range: "0-20", count: applications.filter((a) => a.score <= 20).length },
    { range: "21-40", count: applications.filter((a) => a.score > 20 && a.score <= 40).length },
    { range: "41-60", count: applications.filter((a) => a.score > 40 && a.score <= 60).length },
    { range: "61-80", count: applications.filter((a) => a.score > 60 && a.score <= 80).length },
    { range: "81-100", count: applications.filter((a) => a.score > 80).length },
  ];

  const applicationsOverTimeMap = new Map<string, number>();
  for (const a of applications) {
    const dateKey = new Date(a.created_at).toISOString().slice(0, 10);
    applicationsOverTimeMap.set(dateKey, (applicationsOverTimeMap.get(dateKey) ?? 0) + 1);
  }
  const applicationsOverTime = Array.from(applicationsOverTimeMap.entries())
    .sort((a, b) => (a[0] > b[0] ? 1 : -1))
    .map(([date, count]) => ({ date, count }));

  const topCandidates = applications.slice(0, 5).map((a) => ({
    id: a.id,
    email: a.email,
    score: a.score,
    jobId: a.job_id,
    jobTitle: jobTitleById.get(a.job_id) ?? "",
    status: a.status as "pending" | "applied" | "shortlisted" | "rejected",
  }));

  const pipelineByStatus = {
    pending: applications.filter((a) => a.status === "pending").length,
    applied: applications.filter((a) => a.status === "applied").length,
    shortlisted: applications.filter((a) => a.status === "shortlisted").length,
    rejected: applications.filter((a) => a.status === "rejected").length,
  };

  return {
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
            jobId: applications[0].job_id,
          }
        : null,
    },
    charts: { applicantsPerJob, scoreDistribution, applicationsOverTime },
    topCandidates,
    pipelineByStatus,
  };
}
