export type AiProvider = "skillbias" | "anthropic" | "openai" | "groq" | "custom";

export type ResumeMetrics = {
  fontConsistency: number;
  alignmentScore: number;
  spacingScore: number;
  detectedSkills: string[];
  experienceYears: number;
};

export type AiScoringConfig = {
  provider: AiProvider;
  model?: string;
  apiKey?: string;
  customUrl?: string;
  customAuthHeader?: string;
};

export type ScoringInput = {
  requirements: string;
  requiredSkills: string[];
  resumeMetrics: ResumeMetrics;
};

export type ScoringResult = {
  score: number;
  feedback: string;
};

export type ScoringWeights = {
  skills: number;
  experience: number;
  format: number;
  answers: number;
};

export const FALLBACK_RESUME_METRICS: ResumeMetrics = {
  fontConsistency: 75,
  alignmentScore: 70,
  spacingScore: 70,
  detectedSkills: [],
  experienceYears: 0,
};

export class AiProviderError extends Error {
  provider: AiProvider;
  status?: number;
  originalMessage: string;

  constructor(provider: AiProvider, originalMessage: string, status?: number) {
    super(`${labelFor(provider)} returned an error: ${originalMessage}`);
    this.name = "AiProviderError";
    this.provider = provider;
    this.originalMessage = originalMessage;
    this.status = status;
  }
}

export const DEFAULT_MODELS: Record<AiProvider, string> = {
  skillbias: "llama-3.3-70b-versatile",
  groq: "llama-3.3-70b-versatile",
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o-mini",
  custom: "",
};

export function labelFor(provider: AiProvider): string {
  switch (provider) {
    case "skillbias":
      return "SkillBias default";
    case "anthropic":
      return "Anthropic";
    case "openai":
      return "OpenAI";
    case "groq":
      return "Groq";
    case "custom":
      return "Custom AI endpoint";
  }
}

export const SAMPLE_TEST_INPUT: ScoringInput = {
  requirements:
    "5+ years building React/TypeScript applications. Familiarity with Node.js and PostgreSQL.",
  requiredSkills: ["React", "TypeScript", "Node.js", "PostgreSQL"],
  resumeMetrics: {
    fontConsistency: 80,
    alignmentScore: 75,
    spacingScore: 78,
    detectedSkills: ["React", "TypeScript", "Node.js"],
    experienceYears: 6,
  },
};
