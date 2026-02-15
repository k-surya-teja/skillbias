import { atsFetch } from "./api";

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
