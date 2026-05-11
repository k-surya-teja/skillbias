// Hand-written types for Phase 1. Replace with generated types in Phase 2 via:
//   npx supabase gen types typescript --project-id <ref> --schema public > src/lib/supabase/types.gen.ts

export type AiProvider = "skillbias" | "anthropic" | "openai" | "groq" | "custom";
export type Plan = "free" | "starter" | "pro";
export type SubscriptionStatus = "active" | "canceled" | "trialing" | "past_due" | "none";
export type JobStatus = "active" | "closed";
export type ApplicationStatus = "applied" | "shortlisted" | "rejected" | "pending";
export type FormFieldType = "text" | "number" | "email" | "file" | "select" | "textarea" | "date";

export interface ScoringWeights {
  skills: number;
  experience: number;
  format: number;
  answers: number;
}

export interface JobFormField {
  label: string;
  type: FormFieldType;
  required: boolean;
  options?: string[];
}

export interface OrganizationRow {
  user_id: string;
  company_name: string;
  logo: string;
  description: string;
  website: string;
  plan: Plan;
  free_job_used: boolean;
  subscription_status: SubscriptionStatus;
  current_period_end: string | null;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  auto_shortlist_enabled: boolean;
  auto_shortlist_threshold: number;
  auto_reject_enabled: boolean;
  auto_reject_threshold: number;
  default_scoring_weights: ScoringWeights;
  default_job_is_public: boolean;
  ai_provider: AiProvider;
  ai_model: string;
  ai_api_key: string;
  ai_custom_url: string;
  ai_custom_auth_header: string;
  created_at: string;
  updated_at: string;
}

export interface JobRow {
  id: string;
  org_id: string;
  title: string;
  description: string;
  requirements: string;
  required_skills: string[];
  posting_date: string;
  end_date: string;
  form_fields: JobFormField[];
  scoring_weights: ScoringWeights;
  status: JobStatus;
  is_public: boolean;
  apply_link: string;
  created_at: string;
  updated_at: string;
}

export interface ApplicationRow {
  id: string;
  job_id: string;
  email: string;
  answers: Record<string, unknown>;
  resume_url: string;
  resume_analysis: Record<string, unknown>;
  score: number;
  ai_feedback: string;
  status: ApplicationStatus;
  notes: string;
  agent_traces: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// Until we deploy and regenerate types via `supabase gen types typescript`,
// keep the Database type permissive so query results aren't collapsed to `never`
// by the postgrest-js type machinery. App code casts to OrganizationRow / JobRow /
// ApplicationRow at the boundary for type safety.
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
