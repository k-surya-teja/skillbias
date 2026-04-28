export type PlanId = "free" | "starter" | "pro";
export type PaidPlanId = Exclude<PlanId, "free">;

export type SubscriptionStatus = "active" | "canceled" | "trialing" | "past_due" | "none";

export type PlanCatalogEntry = {
  id: PlanId;
  name: string;
  priceMonthly: number;
  description: string;
  features: string[];
  limits: { jobPosts: number | null };
  highlight?: boolean;
};

export type BillingResponse = {
  plan: PlanId;
  subscriptionStatus: SubscriptionStatus;
  currentPeriodEnd: string | null;
  freeJobUsed: boolean;
  usage: {
    totalJobs: number;
    jobsThisMonth: number;
    applicantsThisMonth: number;
    jobsActive: number;
  };
  plans: PlanCatalogEntry[];
  paymentProvider: "demo" | "stripe";
};

export type CheckoutResponse = {
  ok: true;
  demo?: boolean;
  plan: PaidPlanId;
  message?: string;
  checkoutUrl?: string;
};

export type OrgScoringWeights = {
  skills: number;
  experience: number;
  format: number;
  answers: number;
};

export type Organization = {
  _id?: string;
  id?: string;
  companyName: string;
  email: string;
  logo?: string;
  description?: string;
  website?: string;
  plan: PlanId;
  freeJobUsed: boolean;
  autoShortlistEnabled?: boolean;
  autoShortlistThreshold?: number;
  autoRejectEnabled?: boolean;
  autoRejectThreshold?: number;
  defaultScoringWeights?: OrgScoringWeights;
  defaultJobIsPublic?: boolean;
  subscriptionStatus?: "active" | "canceled" | "trialing" | "past_due" | "none";
  currentPeriodEnd?: string | null;
  aiProvider?: AiProvider;
  aiModel?: string;
  aiCustomUrl?: string;
  // Backend never returns the secret values — only whether they're set.
  // Use these flags in the UI to render "saved" placeholders.
  aiApiKeySet?: boolean;
  aiCustomAuthHeaderSet?: boolean;
};

export type AiProvider = "skillbias" | "anthropic" | "openai" | "groq" | "custom";

export type AiTestRequest = {
  provider: AiProvider;
  model?: string;
  apiKey?: string;
  customUrl?: string;
  customAuthHeader?: string;
};

export type AiTestSuccess = {
  ok: true;
  latencyMs: number;
  sampleScore: number;
  sampleFeedback: string;
};

export type SettingsUpdate = Partial<{
  companyName: string;
  description: string;
  website: string;
  logo: string;
  autoShortlistEnabled: boolean;
  autoShortlistThreshold: number;
  autoRejectEnabled: boolean;
  autoRejectThreshold: number;
  defaultScoringWeights: OrgScoringWeights;
  defaultJobIsPublic: boolean;
  aiProvider: AiProvider;
  aiModel: string;
  aiApiKey: string;
  aiCustomUrl: string;
  aiCustomAuthHeader: string;
}>;

export type JobFormField = {
  label: string;
  type: "text" | "number" | "email" | "file" | "select" | "textarea" | "date";
  required: boolean;
  options?: string[];
};

export type JobScoringWeights = {
  skills: number;
  experience: number;
  format: number;
  answers: number;
};

export type Job = {
  _id: string;
  title: string;
  description: string;
  requirements: string;
  requiredSkills: string[];
  endDate: string;
  formFields: JobFormField[];
  scoringWeights: JobScoringWeights;
  status: "active" | "closed";
  isPublic?: boolean;
  applyLink: string;
};

export type PublicJob = {
  _id: string;
  title: string;
  description: string;
  requiredSkills: string[];
  endDate: string;
  postingDate: string | null;
  applyLink: string;
  companyName: string;
  companyLogo: string;
  applicantsCount: number;
};

export type PublicJobsResponse = {
  jobs: PublicJob[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

export type PublicJobsQuery = {
  q?: string;
  skills?: string[];
  sort?: "newest" | "ending-soon";
  page?: number;
  pageSize?: number;
};

export type CandidateRow = {
  id: string;
  email: string;
  score: number;
  status: "pending" | "applied" | "shortlisted" | "rejected";
  notes: string;
  jobId: string;
  jobTitle: string;
  createdAt: string | null;
};

export type CandidatesQuery = {
  q?: string;
  status?: "pending" | "applied" | "shortlisted" | "rejected";
  jobId?: string;
  scoreMin?: number;
  scoreMax?: number;
  sort?: "score" | "createdAt";
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export type CandidatesResponse = {
  candidates: CandidateRow[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  jobs: Array<{ id: string; title: string; status: "active" | "closed" }>;
};

export type Application = {
  _id: string;
  email: string;
  answers: Record<string, unknown>;
  resumeUrl: string;
  resumeAnalysis: Record<string, unknown>;
  score: number;
  aiFeedback: string;
  status: "pending" | "applied" | "shortlisted" | "rejected";
  notes: string;
  createdAt: string;
};

export type DashboardStatsResponse = {
  stats: {
    totalJobs: number;
    activeJobs: number;
    closedJobs: number;
    totalApplicants: number;
    avgScore: number;
    topCandidate: { email: string; score: number; jobId: string } | null;
  };
  charts: {
    applicantsPerJob: Array<{ jobTitle: string; count: number }>;
    scoreDistribution: Array<{ range: string; count: number }>;
    applicationsOverTime: Array<{ date: string; count: number }>;
  };
  topCandidates: Array<{
    id: string;
    email: string;
    score: number;
    jobId: string;
    jobTitle: string;
    status: "pending" | "applied" | "shortlisted" | "rejected";
  }>;
  pipelineByStatus: {
    pending: number;
    applied: number;
    shortlisted: number;
    rejected: number;
  };
};
