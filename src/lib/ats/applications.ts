import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  CandidateRow,
  CandidatesQuery,
  CandidatesResponse,
  PublicJobsQuery,
  PublicJobsResponse,
} from "./types";

const CANDIDATES_DEFAULT_PAGE_SIZE = 25;
const CANDIDATES_MAX_PAGE_SIZE = 100;

export async function listAllCandidates(
  query: CandidatesQuery = {},
): Promise<CandidatesResponse> {
  const supabase = createSupabaseBrowserClient();

  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(
    CANDIDATES_MAX_PAGE_SIZE,
    Math.max(1, query.pageSize ?? CANDIDATES_DEFAULT_PAGE_SIZE),
  );
  const sort = query.sort === "createdAt" ? "created_at" : "score";
  const ascending = query.order === "asc";

  // RLS already scopes applications to the current org's jobs. The jobs(...) join
  // pulls in the title so we can flatten to CandidateRow without a second round-trip.
  let q = supabase
    .from("applications")
    .select("id, email, score, status, notes, job_id, created_at, jobs(title)", {
      count: "exact",
    });

  if (query.jobId) q = q.eq("job_id", query.jobId);
  if (query.status) q = q.eq("status", query.status);
  if (query.q) q = q.ilike("email", `%${query.q}%`);
  if (query.scoreMin !== undefined) q = q.gte("score", query.scoreMin);
  if (query.scoreMax !== undefined) q = q.lte("score", query.scoreMax);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  q = q.order(sort, { ascending }).range(from, to);

  const { data, count, error } = await q;
  if (error) throw new Error(error.message);

  const candidates: CandidateRow[] = (data ?? []).map((row) => {
    // PostgREST returns the related row as an object for single FK joins.
    const job = row.jobs as { title?: string } | null;
    return {
      id: row.id,
      email: row.email,
      score: Number(row.score),
      status: row.status as CandidateRow["status"],
      notes: row.notes ?? "",
      jobId: row.job_id,
      jobTitle: job?.title ?? "",
      createdAt: row.created_at,
    };
  });

  // Sidecar: the jobs filter dropdown wants every job owned by the org, regardless
  // of which job the current results came from.
  const { data: jobsList } = await supabase
    .from("jobs")
    .select("id, title, status")
    .order("created_at", { ascending: false });

  const total = count ?? 0;
  return {
    candidates,
    page,
    pageSize,
    total,
    hasMore: page * pageSize < total,
    jobs: (jobsList ?? []).map((j) => ({
      id: j.id,
      title: j.title,
      status: j.status as "active" | "closed",
    })),
  };
}

export async function updateApplication(
  id: string,
  payload: {
    status?: "applied" | "shortlisted" | "rejected" | "pending";
    notes?: string;
  },
): Promise<{ application: Record<string, unknown> }> {
  const supabase = createSupabaseBrowserClient();
  const updateData: Record<string, unknown> = {};
  if (payload.status !== undefined) updateData.status = payload.status;
  if (payload.notes !== undefined) updateData.notes = payload.notes;

  const { data, error } = await supabase
    .from("applications")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Application not found");
  return { application: data as Record<string, unknown> };
}

// ----------------------------------------------------------------------------
// Public listing + apply flow — routed through Next.js API routes so we can use
// the service-role key (anonymous users can't read organizations or write to
// Storage directly).
// ----------------------------------------------------------------------------

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

  const res = await fetch(`/api/public/jobs${suffix}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? "Failed to load jobs");
  }
  return res.json();
}

export async function getPublicJob(jobId: string) {
  const res = await fetch(`/api/public/apply/${jobId}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? "Job not found");
  }
  return res.json() as Promise<{ job: Record<string, unknown> }>;
}

export async function submitJobApplication(
  jobId: string,
  payload: { email: string; answers: Record<string, unknown>; resume: File },
): Promise<{ applicationId: string; message: string }> {
  const formData = new FormData();
  formData.append("email", payload.email);
  formData.append("answers", JSON.stringify(payload.answers));
  formData.append("resume", payload.resume);

  const res = await fetch(`/api/public/apply/${jobId}`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? "Submission failed");
  }
  return res.json();
}
