import { atsFetch } from "./api";
import type {
  CandidatesQuery,
  CandidatesResponse,
  PublicJobsQuery,
  PublicJobsResponse,
} from "./types";

export async function listAllCandidates(
  query: CandidatesQuery = {},
): Promise<CandidatesResponse> {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.status) params.set("status", query.status);
  if (query.jobId) params.set("jobId", query.jobId);
  if (query.scoreMin !== undefined) params.set("scoreMin", String(query.scoreMin));
  if (query.scoreMax !== undefined) params.set("scoreMax", String(query.scoreMax));
  if (query.sort) params.set("sort", query.sort);
  if (query.order) params.set("order", query.order);
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return atsFetch(`/applications${suffix}`);
}

export async function listPublicJobs(
  query: PublicJobsQuery = {},
): Promise<PublicJobsResponse> {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.skills && query.skills.length > 0) params.set("skills", query.skills.join(","));
  if (query.sort) params.set("sort", query.sort);
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return atsFetch(`/public/jobs${suffix}`);
}

export async function getPublicJob(jobId: string) {
  return atsFetch<{ job: Record<string, unknown> }>(`/public/apply/${jobId}`);
}

export async function submitJobApplication(
  jobId: string,
  payload: { email: string; answers: Record<string, unknown>; resume: File },
): Promise<{ applicationId: string; message: string }> {
  const formData = new FormData();
  formData.append("email", payload.email);
  formData.append("answers", JSON.stringify(payload.answers));
  formData.append("resume", payload.resume);

  return atsFetch(`/public/apply/${jobId}`, {
    method: "POST",
    body: formData,
  });
}

export async function updateApplication(
  id: string,
  payload: { status?: "applied" | "shortlisted" | "rejected" | "pending"; notes?: string },
) {
  return atsFetch(`/applications/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
