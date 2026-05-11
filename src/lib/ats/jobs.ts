import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ApplicationRow, JobRow } from "@/lib/supabase/types";
import { dbAppToApplication, dbJobToJob } from "./jobMapper";
import type { Application, Job } from "./types";

// Active-job limits per plan. Free plan is special — gated by the sticky
// `free_job_used` boolean on the org row (one job ever, not refunded on close).
const PLAN_ACTIVE_JOB_LIMITS: Record<"starter" | "pro", number | null> = {
  starter: 10,
  pro: null,
};

type SupabaseClient = ReturnType<typeof createSupabaseBrowserClient>;

async function autoCloseExpiredJobs(supabase: SupabaseClient): Promise<void> {
  // RLS narrows this to the current org's jobs automatically.
  await supabase
    .from("jobs")
    .update({ status: "closed" })
    .eq("status", "active")
    .lt("end_date", new Date().toISOString());
}

export async function createJob(payload: Record<string, unknown>): Promise<{ job: Job }> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You're signed out. Please log in again.");

  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select("plan, free_job_used, default_scoring_weights, default_job_is_public")
    .eq("user_id", user.id)
    .single();
  if (orgErr || !org) throw new Error("Profile lookup failed.");

  // Plan-limit check (mirrors backend subscriptionService.canCreateJob)
  if (org.plan === "free" && org.free_job_used) {
    throw new Error("Upgrade to pro plan to create more jobs");
  }
  if (org.plan === "starter") {
    const { count } = await supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");
    const limit = PLAN_ACTIVE_JOB_LIMITS.starter;
    if (limit !== null && (count ?? 0) >= limit) {
      throw new Error("Upgrade to pro plan to create more jobs");
    }
  }

  const p = payload as {
    title: string;
    description: string;
    requirements?: string;
    requiredSkills?: string[];
    endDate: string;
    formFields?: unknown[];
    scoringWeights?: { skills: number; experience: number; format: number; answers: number };
    isPublic?: boolean;
  };

  const applyLink = `/apply/${crypto.randomUUID()}`;
  const { data, error } = await supabase
    .from("jobs")
    .insert({
      org_id: user.id,
      title: p.title,
      description: p.description,
      requirements: p.requirements ?? "",
      required_skills: p.requiredSkills ?? [],
      end_date: p.endDate,
      form_fields: (p.formFields ?? []) as never,
      scoring_weights: p.scoringWeights ?? org.default_scoring_weights,
      is_public: p.isPublic ?? org.default_job_is_public,
      apply_link: applyLink,
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create job.");

  // Sticky free-plan flag — set only while still on free.
  if (org.plan === "free") {
    await supabase
      .from("organizations")
      .update({ free_job_used: true })
      .eq("user_id", user.id)
      .eq("plan", "free");
  }

  return { job: dbJobToJob(data as JobRow) };
}

export async function listJobs(): Promise<{ jobs: Job[] }> {
  const supabase = createSupabaseBrowserClient();
  await autoCloseExpiredJobs(supabase);

  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return { jobs: (data ?? []).map((row) => dbJobToJob(row as JobRow)) };
}

export async function getJob(id: string): Promise<{ job: Job }> {
  const supabase = createSupabaseBrowserClient();
  await autoCloseExpiredJobs(supabase);

  const { data, error } = await supabase.from("jobs").select("*").eq("id", id).single();
  if (error || !data) throw new Error("Job not found");
  return { job: dbJobToJob(data as JobRow) };
}

export async function updateJob(
  id: string,
  payload: Record<string, unknown>,
): Promise<{ job: Job }> {
  const supabase = createSupabaseBrowserClient();
  const p = payload as Partial<{
    title: string;
    description: string;
    requirements: string;
    requiredSkills: string[];
    endDate: string;
    formFields: unknown[];
    scoringWeights: { skills: number; experience: number; format: number; answers: number };
    isPublic: boolean;
    status: "active" | "closed";
  }>;

  const updateData: Record<string, unknown> = {};
  if (p.title !== undefined) updateData.title = p.title;
  if (p.description !== undefined) updateData.description = p.description;
  if (p.requirements !== undefined) updateData.requirements = p.requirements;
  if (p.requiredSkills !== undefined) updateData.required_skills = p.requiredSkills;
  if (p.endDate !== undefined) updateData.end_date = p.endDate;
  if (p.formFields !== undefined) updateData.form_fields = p.formFields;
  if (p.scoringWeights !== undefined) updateData.scoring_weights = p.scoringWeights;
  if (p.isPublic !== undefined) updateData.is_public = p.isPublic;
  if (p.status !== undefined) updateData.status = p.status;

  const { data, error } = await supabase
    .from("jobs")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Job not found");
  return { job: dbJobToJob(data as JobRow) };
}

export async function deleteJob(id: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  // FK cascade handles applications cleanup.
  const { error } = await supabase.from("jobs").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getJobApplications(
  jobId: string,
  options?: { sortBy?: "score" | "createdAt"; order?: "asc" | "desc"; status?: string },
): Promise<{ applications: Application[] }> {
  const supabase = createSupabaseBrowserClient();
  const sortColumn = options?.sortBy === "score" ? "score" : "created_at";
  const ascending = options?.order === "asc";

  let query = supabase.from("applications").select("*").eq("job_id", jobId);
  if (options?.status) query = query.eq("status", options.status);
  query = query.order(sortColumn, { ascending });

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return {
    applications: (data ?? []).map((row) => dbAppToApplication(row as ApplicationRow)),
  };
}

export function getJobExportUrl(jobId: string): string {
  return `/api/jobs/${jobId}/export`;
}
