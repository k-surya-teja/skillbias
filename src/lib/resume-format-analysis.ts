import Groq from "groq-sdk";

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

type FormattingPriority = "high" | "medium" | "low";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeText(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || fallback;
}

function normalizeScore(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(100, Math.round(value)));
  }
  if (typeof value === "string") {
    const match = value.match(/(\d+(?:\.\d+)?)/);
    if (match) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed)) {
        return Math.max(0, Math.min(100, Math.round(parsed)));
      }
    }
  }
  return fallback;
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function normalizePriority(value: unknown): FormattingPriority {
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (normalized === "high" || normalized === "medium" || normalized === "low") {
      return normalized;
    }
  }
  return "medium";
}

export type LayoutDetection = {
  pageCount: number;
  scores: {
    fontConsistency: number;
    alignment: number;
    spacing: number;
    formatting: number;
  };
  metrics: {
    dominantFont: string;
    dominantFontSize: number;
    fontVarietyCount: number;
    leftMarginVariance: number;
    lineGapVariance: number;
  };
  signals: {
    font: Record<string, unknown>;
    alignment: Record<string, unknown>;
    spacing: Record<string, unknown>;
  };
};

export type RecruiterFormattingFeedback = {
  overallSummary: string;
  recruiterVerdict: string;
  strengths: string[];
  issues: string[];
  recommendations: Array<{
    priority: FormattingPriority;
    title: string;
    details: string;
  }>;
};

function parseLayoutDetection(value: unknown): ParseResult<LayoutDetection> {
  if (!isRecord(value)) {
    return { ok: false, error: "Layout payload must be an object." };
  }
  const scores = isRecord(value.scores) ? value.scores : {};
  const metrics = isRecord(value.metrics) ? value.metrics : {};
  const signals = isRecord(value.signals) ? value.signals : {};

  return {
    ok: true,
    value: {
      pageCount:
        typeof value.pageCount === "number" && Number.isFinite(value.pageCount)
          ? Math.max(1, Math.round(value.pageCount))
          : 1,
      scores: {
        fontConsistency: normalizeScore(scores.fontConsistency, 50),
        alignment: normalizeScore(scores.alignment, 50),
        spacing: normalizeScore(scores.spacing, 50),
        formatting: normalizeScore(scores.formatting, 50),
      },
      metrics: {
        dominantFont: normalizeText(metrics.dominantFont, "Unknown"),
        dominantFontSize:
          typeof metrics.dominantFontSize === "number" && Number.isFinite(metrics.dominantFontSize)
            ? Number(metrics.dominantFontSize)
            : 0,
        fontVarietyCount:
          typeof metrics.fontVarietyCount === "number" && Number.isFinite(metrics.fontVarietyCount)
            ? Math.max(0, Math.round(metrics.fontVarietyCount))
            : 0,
        leftMarginVariance:
          typeof metrics.leftMarginVariance === "number" && Number.isFinite(metrics.leftMarginVariance)
            ? Number(metrics.leftMarginVariance)
            : 0,
        lineGapVariance:
          typeof metrics.lineGapVariance === "number" && Number.isFinite(metrics.lineGapVariance)
            ? Number(metrics.lineGapVariance)
            : 0,
      },
      signals: {
        font: isRecord(signals.font) ? signals.font : {},
        alignment: isRecord(signals.alignment) ? signals.alignment : {},
        spacing: isRecord(signals.spacing) ? signals.spacing : {},
      },
    },
  };
}

function parseRecruiterFeedback(value: unknown): ParseResult<RecruiterFormattingFeedback> {
  if (!isRecord(value)) {
    return { ok: false, error: "Recruiter feedback must be an object." };
  }

  const rawRecommendations = Array.isArray(value.recommendations) ? value.recommendations : [];
  const recommendations = rawRecommendations
    .filter(isRecord)
    .map((item) => ({
      priority: normalizePriority(item.priority),
      title: normalizeText(item.title, "Improve resume formatting"),
      details: normalizeText(item.details, "Adjust spacing and alignment consistency."),
    }))
    .slice(0, 6);

  return {
    ok: true,
    value: {
      overallSummary: normalizeText(
        value.overallSummary,
        "Formatting analysis generated. Review fixes to improve recruiter readability.",
      ),
      recruiterVerdict: normalizeText(
        value.recruiterVerdict,
        "Resume is readable but can be improved for visual consistency.",
      ),
      strengths: normalizeStringList(value.strengths),
      issues: normalizeStringList(value.issues),
      recommendations,
    },
  };
}

export async function analyzeLayoutWithFastApi(input: {
  fileName: string;
  buffer: Buffer;
}): Promise<LayoutDetection> {
  const endpoint = process.env.LAYOUT_ANALYZER_URL ?? "http://127.0.0.1:8001/analyze";
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(input.buffer)], { type: "application/pdf" });
  formData.append("resume", blob, input.fileName || "resume.pdf");

  const response = await fetch(endpoint, {
    method: "POST",
    body: formData,
  });

  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const detail =
      isRecord(payload) && typeof payload.detail === "string"
        ? payload.detail
        : `Layout service failed with status ${response.status}.`;
    throw new Error(detail);
  }

  const parsed = parseLayoutDetection(payload);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  return parsed.value;
}

function parseModelJson(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  const noFences = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  const candidates = [trimmed, noFences];
  const firstBrace = noFences.indexOf("{");
  const lastBrace = noFences.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(noFences.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Continue trying.
    }
  }
  return null;
}

export async function generateRecruiterFormattingFeedback(input: {
  groqApiKey: string;
  layout: LayoutDetection;
  contextPrompt?: string;
}): Promise<RecruiterFormattingFeedback> {
  const groq = new Groq({ apiKey: input.groqApiKey });
  const layoutJson = JSON.stringify(input.layout, null, 2);
  const userPrompt = [
    "You are a recruiter-oriented resume formatting reviewer.",
    "Use only the structured layout analysis JSON below.",
    input.contextPrompt
      ? `Candidate context prompt: ${input.contextPrompt}`
      : "No additional candidate prompt was provided.",
    "Return strict JSON with this exact shape:",
    "{",
    '  "overallSummary": string,',
    '  "recruiterVerdict": string,',
    '  "strengths": string[],',
    '  "issues": string[],',
    '  "recommendations": [',
    '    { "priority": "high" | "medium" | "low", "title": string, "details": string }',
    "  ]",
    "}",
    "Keep feedback recruiter-practical and concise.",
    `Layout JSON:\n${layoutJson}`,
  ].join("\n\n");

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    temperature: 0.1,
    response_format: { type: "json_object" },
    max_completion_tokens: 1200,
    messages: [
      {
        role: "system",
        content:
          "You review resume formatting quality (alignment, spacing, typography) and return JSON only.",
      },
      { role: "user", content: userPrompt },
    ],
  });

  const output = completion.choices?.[0]?.message?.content ?? "";
  const parsedJson = parseModelJson(output);
  if (parsedJson === null) {
    throw new Error("Groq returned malformed formatting feedback JSON.");
  }

  const parsed = parseRecruiterFeedback(parsedJson);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  return parsed.value;
}

