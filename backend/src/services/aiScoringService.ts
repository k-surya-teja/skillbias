import { ResumeMetrics } from "./resumeAnalyzerService.js";
import { scoreCandidateWithGroq } from "./groqScoringService.js";

export type AiProvider = "skillbias" | "anthropic" | "openai" | "groq" | "custom";

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

/**
 * Custom error so the caller can distinguish "the provider rejected us" from
 * normal issues, and so we can surface the *original* provider message in the UI
 * (with a small tweak — see message format below).
 */
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

const DEFAULT_MODELS: Record<AiProvider, string> = {
  skillbias: "llama-3.3-70b-versatile",
  groq: "llama-3.3-70b-versatile",
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o-mini",
  custom: "",
};

const REQUEST_TIMEOUT_MS = 30_000;

function labelFor(provider: AiProvider): string {
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

/** Single shared prompt so all providers compare apples-to-apples. */
function buildPrompt(input: ScoringInput): string {
  return [
    "You are a recruiter. Score this candidate out of 100 and explain.",
    `Job requirements: ${input.requirements}`,
    `Required skills: ${input.requiredSkills.join(", ")}`,
    `Resume metrics: ${JSON.stringify(input.resumeMetrics)}`,
    'Return ONLY valid JSON with the exact shape: {"score": <0-100 number>, "feedback": "<one-paragraph string>"}',
  ].join("\n");
}

function parseScoringJson(raw: string): ScoringResult {
  const cleaned = raw.trim().replace(/^```json\s*|^```\s*|```$/g, "");
  try {
    const parsed = JSON.parse(cleaned) as { score?: unknown; feedback?: unknown };
    const score = typeof parsed.score === "number" ? parsed.score : 0;
    const feedback =
      typeof parsed.feedback === "string" ? parsed.feedback : "AI scoring unavailable";
    return { score: Math.max(0, Math.min(100, score)), feedback };
  } catch {
    return { score: 0, feedback: cleaned.slice(0, 500) };
  }
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

async function readErrorBody(res: Response, provider: AiProvider): Promise<never> {
  let detail = `HTTP ${res.status}`;
  try {
    const body = await res.text();
    if (body) {
      try {
        const parsed = JSON.parse(body) as {
          error?: { message?: string } | string;
          message?: string;
        };
        if (typeof parsed.error === "object" && parsed.error?.message) {
          detail = parsed.error.message;
        } else if (typeof parsed.error === "string") {
          detail = parsed.error;
        } else if (parsed.message) {
          detail = parsed.message;
        } else {
          detail = body.slice(0, 300);
        }
      } catch {
        detail = body.slice(0, 300);
      }
    }
  } catch {
    // ignore
  }
  throw new AiProviderError(provider, detail, res.status);
}

// ---- Provider adapters ----

async function callAnthropic(
  config: AiScoringConfig,
  input: ScoringInput,
): Promise<ScoringResult> {
  if (!config.apiKey) {
    throw new AiProviderError("anthropic", "API key is missing in your settings.");
  }
  const model = config.model || DEFAULT_MODELS.anthropic;
  const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      temperature: 0.2,
      messages: [{ role: "user", content: buildPrompt(input) }],
    }),
  });
  if (!res.ok) await readErrorBody(res, "anthropic");
  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = data.content?.find((c) => c.type === "text")?.text ?? "";
  return parseScoringJson(text);
}

async function callOpenAI(
  config: AiScoringConfig,
  input: ScoringInput,
): Promise<ScoringResult> {
  if (!config.apiKey) {
    throw new AiProviderError("openai", "API key is missing in your settings.");
  }
  const model = config.model || DEFAULT_MODELS.openai;
  const res = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: buildPrompt(input) }],
    }),
  });
  if (!res.ok) await readErrorBody(res, "openai");
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content ?? "";
  return parseScoringJson(text);
}

async function callGroqAdapter(
  config: AiScoringConfig,
  input: ScoringInput,
): Promise<ScoringResult> {
  // Reuse the existing helper but with the org's key/model when provided.
  if (!config.apiKey) {
    throw new AiProviderError("groq", "API key is missing in your settings.");
  }
  const model = config.model || DEFAULT_MODELS.groq;
  const res = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: buildPrompt(input) }],
    }),
  });
  if (!res.ok) await readErrorBody(res, "groq");
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content ?? "";
  return parseScoringJson(text);
}

async function callCustom(
  config: AiScoringConfig,
  input: ScoringInput,
): Promise<ScoringResult> {
  if (!config.customUrl) {
    throw new AiProviderError("custom", "Custom URL is not set.");
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.customAuthHeader) headers["Authorization"] = config.customAuthHeader;

  const res = await fetchWithTimeout(config.customUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      job: {
        requirements: input.requirements,
        requiredSkills: input.requiredSkills,
      },
      candidate: {
        resumeMetrics: input.resumeMetrics,
      },
    }),
  });
  if (!res.ok) await readErrorBody(res, "custom");
  const data = (await res.json()) as { score?: unknown; feedback?: unknown };
  const score = typeof data.score === "number" ? data.score : 0;
  const feedback =
    typeof data.feedback === "string" ? data.feedback : "Custom provider returned no feedback.";
  if (typeof data.score !== "number") {
    throw new AiProviderError(
      "custom",
      "Response was missing a numeric `score` field. Expected: { score: number, feedback: string }.",
    );
  }
  return { score: Math.max(0, Math.min(100, score)), feedback };
}

/**
 * Single entry point. Routes to the right provider based on org config.
 * Throws AiProviderError on provider-side failures (caller decides whether to fall back).
 */
export async function scoreWithProvider(
  config: AiScoringConfig,
  input: ScoringInput,
): Promise<ScoringResult> {
  switch (config.provider) {
    case "skillbias":
      return scoreCandidateWithGroq(input);
    case "anthropic":
      return callAnthropic(config, input);
    case "openai":
      return callOpenAI(config, input);
    case "groq":
      return callGroqAdapter(config, input);
    case "custom":
      return callCustom(config, input);
  }
}

/** A small canned input for the "Test connection" button in settings. */
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

export function defaultModelFor(provider: AiProvider): string {
  return DEFAULT_MODELS[provider];
}

export function providerLabel(provider: AiProvider): string {
  return labelFor(provider);
}
