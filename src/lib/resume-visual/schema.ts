export const VISUAL_FIX_PRIORITIES = ["high", "medium", "low"] as const;

export type VisualFixPriority = (typeof VISUAL_FIX_PRIORITIES)[number];

export type VisualTopFix = {
  priority: VisualFixPriority;
  fix: string;
  reason: string;
};

export type LayoutFeedback = {
  whitespace: string;
  alignment: string;
  hierarchy: string;
  scanability: string;
};

export type ResumeVisualAnalysis = {
  visualScore: number;
  structureScore: number;
  readabilityScore: number;
  overallScore: number;
  visualIssues: string[];
  strengths: string[];
  weaknesses: string[];
  layoutFeedback: LayoutFeedback;
  topFixes: VisualTopFix[];
};

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeString(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeScore(value: unknown, fallback = 50): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  if (typeof value === "string") {
    const normalized = normalizeString(value);
    const match = normalized.match(/(\d+(?:\.\d+)?)/);
    if (match) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed)) {
        return Math.max(0, Math.min(100, Math.round(parsed)));
      }
    }
  }

  return fallback;
}

function normalizeStringArray(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const normalized = value
    .filter((item): item is string => typeof item === "string")
    .map(normalizeString)
    .filter(Boolean);

  return normalized.length > 0 ? normalized : fallback;
}

function normalizePriority(value: unknown): VisualFixPriority {
  if (typeof value === "string") {
    const normalized = normalizeString(value).toLowerCase();
    if (VISUAL_FIX_PRIORITIES.includes(normalized as VisualFixPriority)) {
      return normalized as VisualFixPriority;
    }
  }

  return "medium";
}

function normalizeRequiredText(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = normalizeString(value);
  return normalized || fallback;
}

export function parseResumeVisualAnalysis(
  value: unknown,
): ParseResult<ResumeVisualAnalysis> {
  if (!isRecord(value)) {
    return { ok: false, error: "Visual analysis payload must be an object." };
  }

  const visualScore = normalizeScore(value.visualScore);
  const structureScore = normalizeScore(value.structureScore);
  const readabilityScore = normalizeScore(value.readabilityScore);
  const overallScore =
    value.overallScore !== undefined
      ? normalizeScore(value.overallScore)
      : Math.round((visualScore + structureScore + readabilityScore) / 3);

  const visualIssues = normalizeStringArray(value.visualIssues, [
    "Spacing consistency needs improvement across sections.",
  ]);
  const strengths = normalizeStringArray(value.strengths, [
    "Resume contains relevant core content.",
  ]);
  const weaknesses = normalizeStringArray(value.weaknesses, [
    "Visual hierarchy is not consistently clear.",
  ]);

  const layoutFeedbackRaw = isRecord(value.layoutFeedback)
    ? value.layoutFeedback
    : {};
  const layoutFeedback: LayoutFeedback = {
    whitespace: normalizeRequiredText(
      layoutFeedbackRaw.whitespace,
      "Use slightly more whitespace between major sections for easier scanning.",
    ),
    alignment: normalizeRequiredText(
      layoutFeedbackRaw.alignment,
      "Keep text blocks consistently left-aligned for professional readability.",
    ),
    hierarchy: normalizeRequiredText(
      layoutFeedbackRaw.hierarchy,
      "Increase heading contrast and consistency to strengthen section hierarchy.",
    ),
    scanability: normalizeRequiredText(
      layoutFeedbackRaw.scanability,
      "Use shorter bullets and stronger lead verbs to improve six-second scanability.",
    ),
  };

  const topFixesRaw = Array.isArray(value.topFixes) ? value.topFixes : [];
  const topFixes: VisualTopFix[] = topFixesRaw
    .filter(isRecord)
    .map((item) => ({
      priority: normalizePriority(item.priority),
      fix: normalizeRequiredText(item.fix, "Improve section spacing and headers."),
      reason: normalizeRequiredText(
        item.reason,
        "Clear structure increases recruiter scan speed and confidence.",
      ),
    }))
    .slice(0, 8);

  if (topFixes.length === 0) {
    topFixes.push({
      priority: "high",
      fix: "Create stronger section hierarchy with consistent heading style.",
      reason: "Recruiters scan resumes quickly and rely on clear visual structure.",
    });
  }

  return {
    ok: true,
    value: {
      visualScore,
      structureScore,
      readabilityScore,
      overallScore,
      visualIssues,
      strengths,
      weaknesses,
      layoutFeedback,
      topFixes,
    },
  };
}
