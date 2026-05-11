import {
  AiProviderError,
  DEFAULT_MODELS,
  type AiProvider,
  type AiScoringConfig,
  type ScoringInput,
  type ScoringResult,
} from "./types";

const REQUEST_TIMEOUT_MS = 30_000;

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

// ---- SkillBias default (uses the system Groq key from env) ----
export async function scoreWithSkillbiasDefault(input: ScoringInput): Promise<ScoringResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { score: 0, feedback: "AI scoring unavailable (no system key configured)" };
  }
  const res = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODELS.skillbias,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: buildPrompt(input) }],
    }),
  });
  if (!res.ok) await readErrorBody(res, "skillbias");
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return parseScoringJson(data.choices?.[0]?.message?.content ?? "");
}

async function callAnthropic(config: AiScoringConfig, input: ScoringInput): Promise<ScoringResult> {
  if (!config.apiKey) throw new AiProviderError("anthropic", "API key is missing in your settings.");
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

async function callOpenAI(config: AiScoringConfig, input: ScoringInput): Promise<ScoringResult> {
  if (!config.apiKey) throw new AiProviderError("openai", "API key is missing in your settings.");
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
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return parseScoringJson(data.choices?.[0]?.message?.content ?? "");
}

async function callGroq(config: AiScoringConfig, input: ScoringInput): Promise<ScoringResult> {
  if (!config.apiKey) throw new AiProviderError("groq", "API key is missing in your settings.");
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
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return parseScoringJson(data.choices?.[0]?.message?.content ?? "");
}

async function callCustom(config: AiScoringConfig, input: ScoringInput): Promise<ScoringResult> {
  if (!config.customUrl) throw new AiProviderError("custom", "Custom URL is not set.");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.customAuthHeader) headers["Authorization"] = config.customAuthHeader;

  const res = await fetchWithTimeout(config.customUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      job: { requirements: input.requirements, requiredSkills: input.requiredSkills },
      candidate: { resumeMetrics: input.resumeMetrics },
    }),
  });
  if (!res.ok) await readErrorBody(res, "custom");
  const data = (await res.json()) as { score?: unknown; feedback?: unknown };
  if (typeof data.score !== "number") {
    throw new AiProviderError(
      "custom",
      "Response was missing a numeric `score` field. Expected: { score: number, feedback: string }.",
    );
  }
  const feedback =
    typeof data.feedback === "string" ? data.feedback : "Custom provider returned no feedback.";
  return { score: Math.max(0, Math.min(100, data.score)), feedback };
}

export async function scoreWithProvider(
  config: AiScoringConfig,
  input: ScoringInput,
): Promise<ScoringResult> {
  switch (config.provider) {
    case "skillbias":
      return scoreWithSkillbiasDefault(input);
    case "anthropic":
      return callAnthropic(config, input);
    case "openai":
      return callOpenAI(config, input);
    case "groq":
      return callGroq(config, input);
    case "custom":
      return callCustom(config, input);
  }
}
