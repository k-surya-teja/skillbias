const GOOGLE_DRIVE_HOSTS = new Set(["drive.google.com", "docs.google.com"]);
const ALLOWED_RESUME_EXTENSIONS = [".pdf", ".doc", ".docx"] as const;
const ACTION_PRIORITIES = ["high", "medium", "low"] as const;

export function isGoogleDriveUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return GOOGLE_DRIVE_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function hasAllowedResumeExtension(fileName: string): boolean {
  const normalizedFileName = fileName.toLowerCase();
  return ALLOWED_RESUME_EXTENSIONS.some((ext) =>
    normalizedFileName.endsWith(ext),
  );
}

type ResumeAnalysisValidationInput = {
  fileName?: string;
  userPrompt?: string;
};

type ResumeAnalysisValidationResult = {
  isValid: boolean;
  errors: string[];
};

export type ResumeAnalysisSource = "file" | "prompt" | "file-and-prompt";

export type AtsActionPriority = (typeof ACTION_PRIORITIES)[number];

export type AtsActionItem = {
  priority: AtsActionPriority;
  title: string;
  details: string;
};

export type AtsSectionFeedback = {
  summary: string;
  experience: string;
  skills: string;
  education: string;
};

export type AtsAnalysis = {
  overallScore: number;
  overallSummary: string;
  skillMatch: {
    matchedSkills: string[];
    missingSkills: string[];
  };
  keywordCoverage: {
    matchedKeywords: string[];
    missingKeywords: string[];
  };
  sectionFeedback: AtsSectionFeedback;
  actionItems: AtsActionItem[];
};

export type ResumeAnalysisApiData = {
  source: ResumeAnalysisSource;
  submittedAt: string;
  fileName: string | null;
  userPrompt: string | null;
  visualReview?: {
    provider: string;
    sourceType: "pdf" | "docx";
    pageCount: number;
    usedMock: boolean;
    analysis: {
      visualScore: number;
      structureScore: number;
      readabilityScore: number;
      overallScore: number;
      visualIssues: string[];
      strengths: string[];
      weaknesses: string[];
      layoutFeedback: {
        whitespace: string;
        alignment: string;
        hierarchy: string;
        scanability: string;
      };
      topFixes: Array<{
        priority: AtsActionPriority;
        fix: string;
        reason: string;
      }>;
    };
  };
  analysis: AtsAnalysis;
  notes?: string[];
};

export type ResumeAnalysisApiSuccessResponse = {
  ok: true;
  message: string;
  data: ResumeAnalysisApiData;
};

type ParseResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function normalizeString(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeOverallScore(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= 0 && value <= 100) {
      return Math.round(value);
    }

    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }

  const directNumericPortion = normalized
    .replace("%", "")
    .split("/")[0]
    .trim();
  const directParsed = Number(directNumericPortion);

  if (Number.isFinite(directParsed) && directParsed >= 0 && directParsed <= 100) {
    return Math.round(directParsed);
  }

  const match = normalized.match(/(\d+(?:\.\d+)?)/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return null;
  }

  return Math.round(parsed);
}

function normalizeRequiredText(
  value: unknown,
  fallback: string,
): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = normalizeString(value);
  return normalized || fallback;
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map(normalizeString)
    .filter(Boolean);
}

function normalizePriority(value: unknown): AtsActionPriority {
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (ACTION_PRIORITIES.includes(normalized as AtsActionPriority)) {
      return normalized as AtsActionPriority;
    }
  }

  return "medium";
}

export function normalizeExtractedResumeText(value: string): string {
  return normalizeString(value).slice(0, 12000);
}

export function detectResumeAnalysisSource(
  hasFile: boolean,
  hasUserPrompt: boolean,
): ResumeAnalysisSource {
  if (hasFile && hasUserPrompt) {
    return "file-and-prompt";
  }

  if (hasFile) {
    return "file";
  }

  return "prompt";
}

export function parseAtsAnalysis(value: unknown): ParseResult<AtsAnalysis> {
  if (!isRecord(value)) {
    return { ok: false, error: "Analysis payload must be an object." };
  }

  const overallSummary = normalizeRequiredText(
    value.overallSummary,
    "Resume analysis generated. Review the recommendations below to improve ATS performance.",
  );
  const overallScore =
    normalizeOverallScore(value.overallScore) ??
    normalizeOverallScore(overallSummary) ??
    50;
  const skillMatch = isRecord(value.skillMatch) ? value.skillMatch : {};
  const keywordCoverage = isRecord(value.keywordCoverage)
    ? value.keywordCoverage
    : {};
  const sectionFeedback = isRecord(value.sectionFeedback)
    ? value.sectionFeedback
    : {};
  const actionItems = Array.isArray(value.actionItems) ? value.actionItems : [];

  const parsedActionItems: AtsActionItem[] = actionItems
    .filter(isRecord)
    .map((actionItem) => ({
      priority: normalizePriority(actionItem.priority),
      title: normalizeRequiredText(
        actionItem.title,
        "Improve resume impact",
      ),
      details: normalizeRequiredText(
        actionItem.details,
        "Add measurable outcomes and role-specific keywords.",
      ),
    }))
    .slice(0, 8);

  return {
    ok: true,
    value: {
      overallScore: Math.round(overallScore),
      overallSummary,
      skillMatch: {
        matchedSkills: normalizeStringList(skillMatch.matchedSkills),
        missingSkills: normalizeStringList(skillMatch.missingSkills),
      },
      keywordCoverage: {
        matchedKeywords: normalizeStringList(keywordCoverage.matchedKeywords),
        missingKeywords: normalizeStringList(keywordCoverage.missingKeywords),
      },
      sectionFeedback: {
        summary: normalizeRequiredText(
          sectionFeedback.summary,
          "Strengthen your professional summary with target role keywords and measurable value.",
        ),
        experience: normalizeRequiredText(
          sectionFeedback.experience,
          "Quantify outcomes in each experience bullet using metrics and impact language.",
        ),
        skills: normalizeRequiredText(
          sectionFeedback.skills,
          "Align your skills section with job-specific technical and domain keywords.",
        ),
        education: normalizeRequiredText(
          sectionFeedback.education,
          "Keep education concise and highlight relevant coursework or certifications.",
        ),
      },
      actionItems:
        parsedActionItems.length > 0
          ? parsedActionItems
          : [
              {
                priority: "high",
                title: "Add measurable impact",
                details:
                  "Rewrite top experience bullets with quantified outcomes and role keywords.",
              },
            ],
    },
  };
}

export function parseResumeAnalysisApiSuccessResponse(
  value: unknown,
): ParseResult<ResumeAnalysisApiSuccessResponse> {
  if (!isRecord(value)) {
    return { ok: false, error: "Response must be an object." };
  }

  if (value.ok !== true) {
    return { ok: false, error: "Response ok flag must be true." };
  }

  if (typeof value.message !== "string") {
    return { ok: false, error: "Response message must be a string." };
  }

  if (!isRecord(value.data)) {
    return { ok: false, error: "Response data must be an object." };
  }

  const { source, submittedAt, fileName, userPrompt, analysis, notes } =
    value.data;
  const visualReviewValue = (value.data as Record<string, unknown>).visualReview;

  if (
    source !== "file" &&
    source !== "prompt" &&
    source !== "file-and-prompt"
  ) {
    return { ok: false, error: "Response source is invalid." };
  }

  if (typeof submittedAt !== "string") {
    return { ok: false, error: "submittedAt must be a string." };
  }

  if (fileName !== null && typeof fileName !== "string") {
    return { ok: false, error: "fileName must be a string or null." };
  }

  if (userPrompt !== null && typeof userPrompt !== "string") {
    return { ok: false, error: "userPrompt must be a string or null." };
  }

  if (notes !== undefined && !isStringArray(notes)) {
    return { ok: false, error: "notes must be a string array when present." };
  }

  let visualReview: ResumeAnalysisApiData["visualReview"] | undefined;
  if (visualReviewValue !== undefined) {
    if (!isRecord(visualReviewValue)) {
      return { ok: false, error: "visualReview must be an object when present." };
    }

    const analysisValue = isRecord(visualReviewValue.analysis)
      ? visualReviewValue.analysis
      : {};
    const layoutFeedbackValue = isRecord(analysisValue.layoutFeedback)
      ? analysisValue.layoutFeedback
      : {};
    const topFixesValue = Array.isArray(analysisValue.topFixes)
      ? analysisValue.topFixes
      : [];

    visualReview = {
      provider:
        typeof visualReviewValue.provider === "string"
          ? visualReviewValue.provider
          : "unknown",
      sourceType: visualReviewValue.sourceType === "docx" ? "docx" : "pdf",
      pageCount:
        typeof visualReviewValue.pageCount === "number" &&
        Number.isFinite(visualReviewValue.pageCount)
          ? Math.max(1, Math.round(visualReviewValue.pageCount))
          : 1,
      usedMock: visualReviewValue.usedMock === true,
      analysis: {
        visualScore: normalizeOverallScore(analysisValue.visualScore) ?? 50,
        structureScore: normalizeOverallScore(analysisValue.structureScore) ?? 50,
        readabilityScore: normalizeOverallScore(analysisValue.readabilityScore) ?? 50,
        overallScore: normalizeOverallScore(analysisValue.overallScore) ?? 50,
        visualIssues: normalizeStringList(analysisValue.visualIssues),
        strengths: normalizeStringList(analysisValue.strengths),
        weaknesses: normalizeStringList(analysisValue.weaknesses),
        layoutFeedback: {
          whitespace: normalizeRequiredText(
            layoutFeedbackValue.whitespace,
            "Improve whitespace balance across sections.",
          ),
          alignment: normalizeRequiredText(
            layoutFeedbackValue.alignment,
            "Use consistent left alignment for headings, bullets, and dates.",
          ),
          hierarchy: normalizeRequiredText(
            layoutFeedbackValue.hierarchy,
            "Strengthen heading hierarchy for easier scanability.",
          ),
          scanability: normalizeRequiredText(
            layoutFeedbackValue.scanability,
            "Keep bullet points concise and metric-first.",
          ),
        },
        topFixes: topFixesValue
          .filter(isRecord)
          .map((item) => ({
            priority: normalizePriority(item.priority),
            fix: normalizeRequiredText(item.fix, "Improve resume structure."),
            reason: normalizeRequiredText(
              item.reason,
              "A clear visual structure improves recruiter scan speed.",
            ),
          })),
      },
    };
  }

  const parsedAnalysis = parseAtsAnalysis(analysis);

  if (!parsedAnalysis.ok) {
    return {
      ok: false,
      error: `Invalid analysis payload: ${parsedAnalysis.error}`,
    };
  }

  return {
    ok: true,
    value: {
      ok: true,
      message: value.message,
      data: {
        source,
        submittedAt,
        fileName,
        userPrompt,
        notes,
        visualReview,
        analysis: parsedAnalysis.value,
      },
    },
  };
}

export function validateResumeAnalysisInput({
  fileName,
  userPrompt,
}: ResumeAnalysisValidationInput): ResumeAnalysisValidationResult {
  const errors: string[] = [];
  const normalizedUserPrompt = userPrompt?.trim() ?? "";
  const normalizedFileName = fileName?.trim() ?? "";

  if (!normalizedFileName && !normalizedUserPrompt) {
    errors.push("Upload a resume file or provide a prompt.");
  }

  if (normalizedUserPrompt && normalizedUserPrompt.length < 12) {
    errors.push("Prompt should be at least 12 characters for useful analysis context.");
  }

  if (
    normalizedFileName &&
    !hasAllowedResumeExtension(normalizedFileName)
  ) {
    errors.push("Resume file must be a PDF, DOC, or DOCX.");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
