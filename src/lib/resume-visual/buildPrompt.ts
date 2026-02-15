import type { ResumeLayoutMetadata } from "./extractLayout";
import type { ResumeTextExtractionResult } from "./extractText";
import type { ResumePageImage } from "./pdfToImages";

export type ResumeVisualPrompt = {
  system: string;
  user: string;
  images: ResumePageImage[];
};

type BuildPromptInput = {
  text: ResumeTextExtractionResult;
  layout: ResumeLayoutMetadata;
  images: ResumePageImage[];
};

function truncate(value: string, max = 12000): string {
  if (value.length <= max) {
    return value;
  }

  return `${value.slice(0, max)}\n\n[truncated]`;
}

export function buildResumeVisualPrompt({
  text,
  layout,
  images,
}: BuildPromptInput): ResumeVisualPrompt {
  const sectionHeaders =
    layout.global.sectionHeaders.length > 0
      ? layout.global.sectionHeaders.join(", ")
      : "None confidently detected";

  const pageSummary = layout.pages
    .map(
      (page) =>
        `Page ${page.pageNumber}: avgFont=${page.avgFontSize}, largestFont=${page.largestFontSize}, columns=${page.estimatedColumns}, bullets=${page.bulletLineCount}, avgGap=${page.avgVerticalGap}, alignVariance=${page.leftAlignmentVariance}`,
    )
    .join("\n");

  const user = [
    "You are a senior recruiter reviewing a resume visually.",
    "Evaluate hierarchy, spacing, scanability, alignment, and professionalism.",
    "Think like a recruiter scanning for 6 seconds.",
    "",
    "You must evaluate BOTH textual content and visual layout.",
    "Use page images as primary visual evidence and text/layout metadata as supporting evidence.",
    "",
    "Resume text (normalized extract):",
    `\"\"\"\n${truncate(text.combinedText, 16000)}\n\"\"\"`,
    "",
    "Layout metadata:",
    `- pageCount: ${layout.pageCount}`,
    `- estimatedColumns: ${layout.global.estimatedColumns}`,
    `- dominantFontSize: ${layout.global.dominantFontSize}`,
    `- largestFontSize: ${layout.global.largestFontSize}`,
    `- bulletDensity: ${layout.global.bulletDensity}`,
    `- avgVerticalGap: ${layout.global.avgVerticalGap}`,
    `- leftAlignmentVariance: ${layout.global.leftAlignmentVariance}`,
    `- sectionHeaders: ${sectionHeaders}`,
    "",
    "Per-page metadata:",
    pageSummary || "No page metadata available.",
    "",
    "Return STRICT JSON only with exactly this shape:",
    "{",
    '  "visualScore": number,',
    '  "structureScore": number,',
    '  "readabilityScore": number,',
    '  "overallScore": number,',
    '  "visualIssues": string[],',
    '  "strengths": string[],',
    '  "weaknesses": string[],',
    '  "layoutFeedback": {',
    '    "whitespace": string,',
    '    "alignment": string,',
    '    "hierarchy": string,',
    '    "scanability": string',
    "  },",
    '  "topFixes": [',
    '    { "priority": "high" | "medium" | "low", "fix": string, "reason": string }',
    "  ]",
    "}",
    "",
    "No markdown. JSON only.",
    "Keep the output concise and concrete.",
  ].join("\n");

  return {
    system:
      "You are an expert recruiter and resume design reviewer. Return one valid JSON object only.",
    user,
    images,
  };
}
