import { atsFetch } from "./api";
import { Application, Job } from "./types";

export async function createJob(payload: Record<string, unknown>): Promise<{ job: Job }> {
  return atsFetch("/jobs/create", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listJobs(): Promise<{ jobs: Job[] }> {
  return atsFetch("/jobs");
}

export async function getJob(id: string): Promise<{ job: Job }> {
  return atsFetch(`/jobs/${id}`);
}

export async function updateJob(id: string, payload: Record<string, unknown>): Promise<{ job: Job }> {
  return atsFetch(`/jobs/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteJob(id: string): Promise<void> {
  await atsFetch(`/jobs/${id}`, { method: "DELETE", raw: true });
}

export async function getJobApplications(
  jobId: string,
  options?: { sortBy?: "score" | "createdAt"; order?: "asc" | "desc"; status?: string },
): Promise<{ applications: Application[] }> {
  const params = new URLSearchParams();
  if (options?.sortBy) params.set("sortBy", options.sortBy);
  if (options?.order) params.set("order", options.order);
  if (options?.status) params.set("status", options.status);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return atsFetch(`/jobs/${jobId}/applications${suffix}`);
}

export function getJobExportUrl(jobId: string): string {
  const base = process.env.NEXT_PUBLIC_ATS_API_BASE_URL ?? "http://localhost:4000";
  return `${base}/jobs/${jobId}/export`;
}
