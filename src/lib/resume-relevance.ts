type ResumeRelevanceInput = {
  fileName?: string;
  text?: string;
};

const POSITIVE_FILENAME_SIGNALS = [
  "resume",
  "cv",
  "curriculum-vitae",
  "curriculum vitae",
  "profile",
];

const POSITIVE_TEXT_SIGNALS = [
  "experience",
  "work experience",
  "professional experience",
  "employment history",
  "employment",
  "education",
  "skills",
  "projects",
  "summary",
  "professional summary",
  "objective",
  "work history",
  "certification",
  "certifications",
  "achievements",
  "internship",
  "responsibilities",
  "references",
  "bachelor",
  "master",
  "university",
  "college",
  "linkedin.com",
  "linkedin",
  "portfolio",
];

const NEGATIVE_SIGNALS = [
  "invoice",
  "receipt",
  "purchase order",
  "brochure",
  "catalog",
  "menu",
  "minutes of meeting",
  "meeting notes",
  "bank statement",
  "profit and loss",
  "balance sheet",
  "research paper",
  "whitepaper",
];

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function countMatches(haystack: string, needles: string[]): number {
  return needles.reduce(
    (total, needle) => (haystack.includes(needle) ? total + 1 : total),
    0,
  );
}

function getResumeRelevanceSignals({
  fileName,
  text,
}: ResumeRelevanceInput) {
  const normalizedFileName = normalize(fileName ?? "");
  const normalizedText = normalize(text ?? "");
  const context = `${normalizedFileName} ${normalizedText}`.trim();

  const positiveFileMatches = countMatches(
    normalizedFileName,
    POSITIVE_FILENAME_SIGNALS,
  );
  const positiveTextMatches = countMatches(normalizedText, POSITIVE_TEXT_SIGNALS);
  const negativeMatches = countMatches(context, NEGATIVE_SIGNALS);
  const hasEmailSignal = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(context);
  const hasPhoneSignal = /(\+\d{1,3}[\s-]?)?(\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4})/.test(
    context,
  );
  const hasExperiencePattern =
    /\b\d{4}\s*[-–]\s*(present|\d{4})\b/i.test(context) ||
    /\b(experience|employment)\b/i.test(context);
  const hasEducationPattern = /\b(education|bachelor|master|university|college)\b/i.test(
    context,
  );

  let score = 0;
  score += positiveFileMatches * 3;
  score += positiveTextMatches * 2;
  if (hasEmailSignal) {
    score += 1;
  }
  if (hasPhoneSignal) {
    score += 1;
  }
  if (hasExperiencePattern) {
    score += 1;
  }
  if (hasEducationPattern) {
    score += 1;
  }
  score -= negativeMatches * 3;

  return { context, score, negativeMatches };
}

export function isLikelyResumeDocument({
  fileName,
  text,
}: ResumeRelevanceInput): boolean {
  const { context, score } = getResumeRelevanceSignals({ fileName, text });

  if (!context) {
    return false;
  }

  return score >= 3;
}

export function isClearlyNonResumeDocument({
  fileName,
  text,
}: ResumeRelevanceInput): boolean {
  const { context, score, negativeMatches } = getResumeRelevanceSignals({
    fileName,
    text,
  });

  if (!context) {
    return true;
  }

  return negativeMatches >= 2 || score <= -2;
}
