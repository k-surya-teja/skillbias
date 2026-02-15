export type Organization = {
  _id?: string;
  id?: string;
  companyName: string;
  email: string;
  logo?: string;
  plan: "free" | "pro";
  freeJobUsed: boolean;
};

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
  applyLink: string;
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
    totalApplicants: number;
    avgScore: number;
    topCandidate: { email: string; score: number; jobId: string } | null;
  };
  charts: {
    applicantsPerJob: Array<{ jobTitle: string; count: number }>;
    scoreDistribution: Array<{ range: string; count: number }>;
    applicationsOverTime: Array<{ date: string; count: number }>;
  };
};
