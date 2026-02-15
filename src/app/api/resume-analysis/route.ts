import Groq from "groq-sdk";
import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import {
  detectResumeAnalysisSource,
  normalizeExtractedResumeText,
  parseAtsAnalysis,
  validateResumeAnalysisInput,
} from "@/lib/resume-analysis";
import {
  analyzeResumeVisual,
  ResumeVisualAnalysisError,
} from "@/lib/resume-visual/analyzeResume";
import {
  isClearlyNonResumeDocument,
  isLikelyResumeDocument,
} from "@/lib/resume-relevance";

const MAX_DRIVE_CONTEXT_LENGTH = 12000;
const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const PDFJS_STANDARD_FONT_DATA_URL = (() => {
  try {
    const packageDir = path.dirname(require.resolve("pdfjs-dist/package.json"));
    return `${pathToFileURL(path.join(packageDir, "standard_fonts")).href}/`;
  } catch {
    return "";
  }
})();

type PdfExtractionMethod = "pdftotext" | "pdf-parse" | "pdfjs-no-worker" | "none";

type PdfExtractionResult = {
  text: string;
  bestEffortText: string;
  method: PdfExtractionMethod;
  pdftotextLength: number;
  pdfParseLength: number;
  pdfjsLength: number;
};

async function extractDocxTextFromBuffer(docxBuffer: Buffer): Promise<string> {
  try {
    const mammothModule = (await import("mammoth")) as {
      extractRawText?: (input: { buffer: Buffer }) => Promise<{ value?: unknown }>;
      default?: {
        extractRawText?: (input: { buffer: Buffer }) => Promise<{ value?: unknown }>;
      };
    };
    const extractRawText =
      mammothModule.extractRawText ?? mammothModule.default?.extractRawText;

    if (typeof extractRawText !== "function") {
      return "";
    }

    const result = await extractRawText({ buffer: docxBuffer });
    return typeof result.value === "string" ? result.value : "";
  } catch (error) {
    console.warn("[resume-analysis] DOCX extraction failed", {
      message: getUnknownErrorMessage(error),
    });
    return "";
  }
}

function isLikelyReadableText(value: string): boolean {
  if (!value.trim()) {
    return false;
  }

  let printableCount = 0;

  for (const char of value) {
    const code = char.charCodeAt(0);
    const isPrintableAscii = code >= 32 && code <= 126;
    const isCommonWhitespace = code === 9 || code === 10 || code === 13;
    const isExtendedPrintable = code >= 160;

    if (isPrintableAscii || isCommonWhitespace || isExtendedPrintable) {
      printableCount += 1;
    }
  }

  return printableCount / value.length >= 0.75;
}

function hasMinimumResumeTextSignal(value: string): boolean {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return false;
  }

  const tokenCount = normalized.split(" ").filter(Boolean).length;
  const alphaCount = (normalized.match(/[a-z]/gi) ?? []).length;
  return normalized.length >= 80 || tokenCount >= 16 || alphaCount >= 60;
}

function hasPartialResumeTextSignal(value: string): boolean {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return false;
  }

  const tokenCount = normalized.split(" ").filter(Boolean).length;
  const alphaCount = (normalized.match(/[a-z]/gi) ?? []).length;
  return normalized.length >= 60 || tokenCount >= 12 || alphaCount >= 45;
}

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function isDriveWrapperText(value: string): boolean {
  const normalized = value.toLowerCase();
  const wrapperSignals = [
    "google drive",
    "you need access",
    "request access",
    "sign in to continue",
    "virus scan warning",
    "can't scan this file for viruses",
    "download anyway",
    "google accounts",
  ];

  const signalMatches = wrapperSignals.filter((signal) =>
    normalized.includes(signal),
  ).length;

  // Drive wrapper pages are usually short and mostly boilerplate.
  return signalMatches >= 2 || (signalMatches >= 1 && normalized.length < 700);
}

function extractDriveFileId(value: string): string | null {
  try {
    const url = new URL(value);
    const fromQuery = url.searchParams.get("id");
    if (fromQuery) {
      return fromQuery;
    }

    const fileMatch = url.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch?.[1]) {
      return fileMatch[1];
    }

    const docMatch = url.pathname.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
    if (docMatch?.[1]) {
      return docMatch[1];
    }
  } catch {
    return null;
  }

  return null;
}

function isGoogleDocLink(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.hostname.toLowerCase() === "docs.google.com" &&
      url.pathname.includes("/document/")
    );
  } catch {
    return false;
  }
}

function getUnknownErrorMessage(error: unknown): string {
  if (error instanceof Error && typeof error.message === "string") {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown error";
}

function logPdfExtractionFailure(
  stage:
    | "pdftotext-check"
    | "pdftotext"
    | "pdftotext-cleanup"
    | "pdf-parse"
    | "pdfjs",
  error: unknown,
): void {
  console.warn("[resume-analysis] PDF extraction stage failed", {
    stage,
    message: getUnknownErrorMessage(error),
  });
}

async function extractPdfTextFromBuffer(
  pdfBuffer: Buffer,
): Promise<PdfExtractionResult> {
  let stdout = "";
  let pdftotextLength = 0;
  let pdfParseLength = 0;
  let pdfjsLength = 0;
  let bestEffortText = "";

  const captureBestEffortText = (candidate: string) => {
    const normalizedCandidate = candidate
      .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\uFFFF]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (normalizedCandidate && normalizedCandidate.length > bestEffortText.length) {
      bestEffortText = normalizedCandidate;
    }
  };

  let isPdftotextAvailable = false;
  try {
    await execFileAsync("which", ["pdftotext"]);
    isPdftotextAvailable = true;
  } catch (error) {
    logPdfExtractionFailure("pdftotext-check", error);
  }

  if (isPdftotextAvailable) {
    let tempDir: string | null = null;
    try {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "resume-pdftotext-"));
      const inputPath = path.join(tempDir, "input.pdf");
      await fs.writeFile(inputPath, pdfBuffer);
      const commandResult = await execFileAsync("pdftotext", ["-layout", inputPath, "-"]);
      stdout = commandResult.stdout;
      pdftotextLength = stdout.length;
      captureBestEffortText(stdout);
    } catch (error) {
      stdout = "";
      pdftotextLength = 0;
      logPdfExtractionFailure("pdftotext", error);
    } finally {
      if (tempDir) {
        try {
          await fs.rm(tempDir, { recursive: true, force: true });
        } catch (error) {
          logPdfExtractionFailure("pdftotext-cleanup", error);
        }
      }
    }
  }

  if (stdout && isLikelyReadableText(stdout) && hasMinimumResumeTextSignal(stdout)) {
    return {
      text: stdout,
      bestEffortText,
      method: "pdftotext",
      pdftotextLength,
      pdfParseLength,
      pdfjsLength,
    };
  }

  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
    const parsed = await parser.getText();
    await parser.destroy();
    const fallbackText = typeof parsed.text === "string" ? parsed.text : "";
    pdfParseLength = fallbackText.length;
    captureBestEffortText(fallbackText);

    if (
      fallbackText &&
      isLikelyReadableText(fallbackText) &&
      hasMinimumResumeTextSignal(fallbackText)
    ) {
      return {
        text: fallbackText,
        bestEffortText,
        method: "pdf-parse",
        pdftotextLength,
        pdfParseLength,
        pdfjsLength,
      };
    }
  } catch (error) {
    logPdfExtractionFailure("pdf-parse", error);
  }

  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(pdfBuffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      disableWorker: true,
      standardFontDataUrl: PDFJS_STANDARD_FONT_DATA_URL || undefined,
    } as unknown as Parameters<typeof pdfjs.getDocument>[0]);
    const pdfDocument = await loadingTask.promise;
    const pageTexts: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => {
          if (typeof item !== "object" || item === null || !("str" in item)) {
            return "";
          }
          const maybeText = (item as { str?: unknown }).str;
          return typeof maybeText === "string" ? maybeText : "";
        })
        .join("\n")
        .trim();
      if (pageText) {
        pageTexts.push(pageText);
      }
    }

    const pdfjsText = pageTexts.join("\n\n");
    pdfjsLength = pdfjsText.length;
    captureBestEffortText(pdfjsText);

    if (pdfjsText && isLikelyReadableText(pdfjsText) && hasMinimumResumeTextSignal(pdfjsText)) {
      return {
        text: pdfjsText,
        bestEffortText,
        method: "pdfjs-no-worker",
        pdftotextLength,
        pdfParseLength,
        pdfjsLength,
      };
    }
  } catch (error) {
    logPdfExtractionFailure("pdfjs", error);
  }

  return {
    text: "",
    bestEffortText,
    method: "none",
    pdftotextLength,
    pdfParseLength,
    pdfjsLength,
  };
}

// Retained for potential migration/back-compat experiments.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function fetchDriveResumeContext(driveLink: string): Promise<string> {
  const fileId = extractDriveFileId(driveLink);
  const urlsToTry: string[] = [];

  if (isGoogleDocLink(driveLink) && fileId) {
    urlsToTry.push(`https://docs.google.com/document/d/${fileId}/export?format=txt`);
  }

  if (fileId) {
    urlsToTry.push(`https://drive.google.com/uc?export=download&confirm=t&id=${fileId}`);
    urlsToTry.push(`https://drive.google.com/uc?export=download&id=${fileId}`);
    urlsToTry.push(`https://drive.google.com/uc?id=${fileId}&export=download`);
    urlsToTry.push(
      `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`,
    );
  }

  urlsToTry.push(driveLink);

  async function fetchWithTimeout(targetUrl: string) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      return await fetch(targetUrl, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          // Some Drive endpoints behave better with a browser-like UA.
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        },
      });
    } finally {
      clearTimeout(timer);
    }
  }

  function extractDriveDownloadUrlFromHtml(html: string): string | null {
    const directMatch = html.match(/"downloadUrl":"([^"]+)"/);
    if (!directMatch?.[1]) {
      return null;
    }

    const escapedUrl = directMatch[1]
      .replace(/\\u003d/g, "=")
      .replace(/\\u0026/g, "&")
      .replace(/\\\//g, "/");

    try {
      return decodeURIComponent(escapedUrl);
    } catch {
      return escapedUrl;
    }
  }

  for (const targetUrl of urlsToTry) {
    try {
      const response = await fetchWithTimeout(targetUrl);

      if (!response.ok) {
        continue;
      }

      const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
      const fileBuffer = Buffer.from(await response.arrayBuffer());
      const isPdfBySignature =
        fileBuffer.length >= 5 &&
        fileBuffer.subarray(0, 5).toString("utf-8") === "%PDF-";

      if (contentType.includes("application/pdf") || isPdfBySignature) {
        const { text: pdfText } = await extractPdfTextFromBuffer(fileBuffer);
        if (pdfText && isLikelyReadableText(pdfText)) {
          return normalizeExtractedResumeText(pdfText).slice(
            0,
            MAX_DRIVE_CONTEXT_LENGTH,
          );
        }
        continue;
      }

      const decodedText = fileBuffer.toString("utf-8");

      if (contentType.includes("text/html")) {
        const extractedDownloadUrl = extractDriveDownloadUrlFromHtml(decodedText);
        if (extractedDownloadUrl) {
          const downloadResponse = await fetchWithTimeout(extractedDownloadUrl);
          if (downloadResponse.ok) {
            const downloadBuffer = Buffer.from(await downloadResponse.arrayBuffer());
            const downloadIsPdf =
              downloadBuffer.length >= 5 &&
              downloadBuffer.subarray(0, 5).toString("utf-8") === "%PDF-";

            if (downloadIsPdf) {
              const { text: pdfText } = await extractPdfTextFromBuffer(downloadBuffer);
              if (pdfText && isLikelyReadableText(pdfText)) {
                return normalizeExtractedResumeText(pdfText).slice(
                  0,
                  MAX_DRIVE_CONTEXT_LENGTH,
                );
              }
            }
          }
        }
      }

      const normalizedText = contentType.includes("text/html")
        ? stripHtml(decodedText)
        : decodedText;

      if (
        normalizedText &&
        isLikelyReadableText(normalizedText) &&
        !isDriveWrapperText(normalizedText)
      ) {
        return normalizeExtractedResumeText(normalizedText).slice(
          0,
          MAX_DRIVE_CONTEXT_LENGTH,
        );
      }
    } catch {
      continue;
    }
  }

  return "";
}

function formatSourceLabel(source: "file" | "prompt" | "file-and-prompt") {
  if (source === "file-and-prompt") {
    return "uploaded resume file and user prompt context";
  }

  if (source === "file") {
    return "uploaded resume file";
  }

  return "user prompt context";
}

function buildResumeSnippet(value: string, maxLength = 12000): string {
  const sanitized = value
    .replace(/\u0000/g, " ")
    .replace(/"""/g, '"')
    .replace(/\s+/g, " ")
    .trim();

  if (sanitized.length <= maxLength) {
    return sanitized;
  }

  return `${sanitized.slice(0, maxLength)}\n\n[truncated for model input limits]`;
}

function getGroqTextResponse(value: unknown): string {
  if (!value || typeof value !== "object") {
    return "";
  }

  const candidate = value as {
    choices?: Array<{
      message?: {
        content?: string | null;
      };
    }>;
  };

  const content = candidate.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : "";
}

function getProviderErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const candidate = error as {
    status?: unknown;
    response?: { status?: unknown };
  };

  if (typeof candidate.status === "number") {
    return candidate.status;
  }

  if (
    typeof candidate.status === "string" &&
    Number.isFinite(Number(candidate.status))
  ) {
    return Number(candidate.status);
  }

  if (typeof candidate.response?.status === "number") {
    return candidate.response.status;
  }

  return null;
}

function getProviderErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "";
  }

  const candidate = error as {
    message?: unknown;
    error?: {
      message?: unknown;
    };
    response?: {
      data?: {
        error?: {
          message?: unknown;
        };
      };
    };
  };

  if (typeof candidate.error?.message === "string") {
    return candidate.error.message;
  }

  if (typeof candidate.response?.data?.error?.message === "string") {
    return candidate.response.data.error.message;
  }

  if (typeof candidate.message === "string") {
    return candidate.message;
  }

  return "";
}

function isJsonModeGenerationFailure(error: unknown): boolean {
  const message = getProviderErrorMessage(error).toLowerCase();
  return (
    message.includes("json_validate_failed") ||
    message.includes("failed to generate json") ||
    message.includes("failed_generation")
  );
}

function parseModelJson(text: string): unknown | null {
  const trimmed = text.trim();
  const candidates: string[] = [];

  if (trimmed) {
    candidates.push(trimmed);
  }

  const withoutCodeFences = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  if (withoutCodeFences && withoutCodeFences !== trimmed) {
    candidates.push(withoutCodeFences);
  }

  const firstBrace = withoutCodeFences.indexOf("{");
  const lastBrace = withoutCodeFences.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const objectSlice = withoutCodeFences.slice(firstBrace, lastBrace + 1).trim();
    if (objectSlice) {
      candidates.push(objectSlice);
    }
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try next candidate variant.
    }
  }

  return null;
}

function buildFallbackAtsAnalysisFromText(resumeText: string): unknown {
  const normalizedText = resumeText.toLowerCase();
  const hasExperience = normalizedText.includes("experience");
  const hasEducation = normalizedText.includes("education");
  const hasSkills = normalizedText.includes("skills");

  let score = 55;
  if (hasExperience) {
    score += 10;
  }
  if (hasEducation) {
    score += 8;
  }
  if (hasSkills) {
    score += 10;
  }

  const boundedScore = Math.max(35, Math.min(82, score));

  return {
    overallScore: boundedScore,
    overallSummary:
      "Analysis generated using fallback mode because the model response format was unstable. Resume appears partially complete and can be improved for ATS clarity.",
    skillMatch: {
      matchedSkills: hasSkills ? ["skills section present"] : [],
      missingSkills: [
        "role-specific technical keywords",
        "quantified achievements",
        "industry-relevant tools",
      ],
    },
    keywordCoverage: {
      matchedKeywords: [
        ...(hasExperience ? ["experience"] : []),
        ...(hasEducation ? ["education"] : []),
      ],
      missingKeywords: [
        "impact metrics",
        "action verbs",
        "role alignment keywords",
      ],
    },
    sectionFeedback: {
      summary:
        "Add a concise professional summary tailored to the target job description.",
      experience:
        "Use measurable outcomes in bullets and include stronger role-specific keywords.",
      skills:
        "Group tools and technologies by category to improve recruiter scanability.",
      education:
        "Keep education concise and emphasize relevant credentials or certifications.",
    },
    actionItems: [
      {
        priority: "high",
        title: "Add measurable achievements",
        details:
          "Rewrite top experience bullets with concrete metrics and business impact.",
      },
      {
        priority: "medium",
        title: "Improve keyword targeting",
        details:
          "Align resume keywords to the target role and required skills from job descriptions.",
      },
      {
        priority: "low",
        title: "Tighten formatting consistency",
        details:
          "Keep section naming and bullet style consistent for easier ATS and recruiter review.",
      },
    ],
  };
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Server is not configured for resume analysis. Set GROQ_API_KEY.",
        },
        { status: 500 },
      );
    }

    const formData = await request.formData();
    const resumeFileValue = formData.get("resumeFile");
    const userPromptValue = formData.get("userPrompt");

    const resumeFile =
      resumeFileValue instanceof File && resumeFileValue.size > 0
        ? resumeFileValue
        : null;
    const userPrompt =
      typeof userPromptValue === "string" ? userPromptValue.trim() : "";

    const validation = validateResumeAnalysisInput({
      fileName: resumeFile?.name,
      userPrompt,
    });

    if (!validation.isValid) {
      return NextResponse.json(
        {
          ok: false,
          message: validation.errors[0],
          errors: validation.errors,
        },
        { status: 400 },
      );
    }

    const inputSource = detectResumeAnalysisSource(
      Boolean(resumeFile),
      Boolean(userPrompt),
    );
    const analysisNotes: string[] = [];
    let visualReview:
      | {
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
              priority: "high" | "medium" | "low";
              fix: string;
              reason: string;
            }>;
          };
        }
      | undefined;
    let extractedResumeText = "";
    let usedUnreadableFileFallback = false;

    if (resumeFile) {
      const fileBuffer = Buffer.from(await resumeFile.arrayBuffer());
      const fileName = resumeFile.name.toLowerCase();
      const mimeType = (resumeFile.type ?? "").toLowerCase();
      const isPdfUpload =
        mimeType.includes("pdf") ||
        fileName.endsWith(".pdf") ||
        (fileBuffer.length >= 5 &&
          fileBuffer.subarray(0, 5).toString("utf-8") === "%PDF-");
      const isDocxUpload =
        mimeType.includes("wordprocessingml.document") || fileName.endsWith(".docx");
      const extractedDocxText = isDocxUpload
        ? await extractDocxTextFromBuffer(fileBuffer)
        : "";

      const pdfExtraction = isPdfUpload
        ? await extractPdfTextFromBuffer(fileBuffer)
        : null;
      const fileText = isPdfUpload
        ? pdfExtraction?.text ?? pdfExtraction?.bestEffortText ?? ""
        : isDocxUpload
          ? extractedDocxText
          : fileBuffer.toString("utf-8");
      const readableText = isLikelyReadableText(fileText);
      const hasTextSignal = hasMinimumResumeTextSignal(fileText);
      const hasPartialSignal = hasPartialResumeTextSignal(fileText);

      if (readableText && hasTextSignal) {
        extractedResumeText = normalizeExtractedResumeText(fileText);
        if (pdfExtraction?.method === "pdf-parse") {
          analysisNotes.push(
            "Primary PDF extraction was weak. A parser fallback was used to recover resume text.",
          );
        }
      } else if (isPdfUpload && hasPartialSignal) {
        extractedResumeText = normalizeExtractedResumeText(fileText);
        analysisNotes.push(
          "Resume text extraction was partial. Analysis quality may improve with a text-based PDF export.",
        );
      } else if (userPrompt) {
        analysisNotes.push(
          "Uploaded file could not be parsed into readable text. Analysis relied on the prompt context.",
        );
      } else {
        // Do not hard-fail for scanned/image-heavy resumes.
        // Continue with a safe fallback context so analysis can proceed.
        extractedResumeText = normalizeExtractedResumeText(
          `Resume file uploaded: ${resumeFile.name}. Full text extraction was limited in this version.`,
        );
        usedUnreadableFileFallback = true;
        const extractionDetail = pdfExtraction
          ? `Extraction details - method: ${pdfExtraction.method}, pdftotextLength: ${pdfExtraction.pdftotextLength}, pdfParseLength: ${pdfExtraction.pdfParseLength}, pdfjsLength: ${pdfExtraction.pdfjsLength}.`
          : "Extraction details are unavailable for this file type.";
        analysisNotes.push(
          `Uploaded file had limited extractable text. Analysis was generated using fallback file context. ${extractionDetail}`,
        );
      }

      try {
        const visualResult = await analyzeResumeVisual({
          fileName: resumeFile.name || "resume.pdf",
          mimeType: resumeFile.type || "",
          buffer: fileBuffer,
        });
        visualReview = {
          provider: visualResult.provider,
          sourceType: visualResult.metadata.sourceType,
          pageCount: visualResult.metadata.pageCount,
          usedMock: visualResult.metadata.usedMock,
          analysis: visualResult.analysis,
        };
      } catch (error) {
        if (error instanceof ResumeVisualAnalysisError) {
          analysisNotes.push(
            `Structural review could not be completed: ${error.message}`,
          );
        } else {
          analysisNotes.push(
            "Structural review could not be completed for this upload.",
          );
        }
      }
    }

    if (userPrompt) {
      extractedResumeText = [extractedResumeText, `User prompt context: ${userPrompt}`]
        .filter(Boolean)
        .join("\n\n");
    }

    if (
      extractedResumeText &&
      inputSource !== "prompt" &&
      !usedUnreadableFileFallback &&
      !isLikelyResumeDocument({
        fileName: resumeFile?.name || userPrompt || "",
        text: extractedResumeText,
      })
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: "Please upload a resume.",
        },
        { status: 400 },
      );
    }

    if (extractedResumeText && inputSource === "prompt" && isClearlyNonResumeDocument({
      fileName: userPrompt,
      text: extractedResumeText,
    })) {
      return NextResponse.json(
        {
          ok: false,
          message: "Please upload a resume.",
        },
        { status: 400 },
      );
    }

    const sourceSummary = formatSourceLabel(inputSource);
    const resumeContext = extractedResumeText
      ? buildResumeSnippet(extractedResumeText)
      : "";
    const prompt = [
      "You are an ATS resume reviewer. Base your analysis only on provided context.",
      `Input source: ${sourceSummary}.`,
      resumeContext
        ? `Extracted resume text:\n"""${resumeContext}"""`
        : "No direct resume text was available from the uploaded file.",
      userPrompt ? `User context prompt:\n"""${userPrompt}"""` : "No user prompt provided.",
      [
        "Return strictly valid JSON with exactly this shape:",
        "{",
        '  "overallScore": number (0..100),',
        '  "overallSummary": string,',
        '  "skillMatch": { "matchedSkills": string[], "missingSkills": string[] },',
        '  "keywordCoverage": { "matchedKeywords": string[], "missingKeywords": string[] },',
        '  "sectionFeedback": {',
        '    "summary": string,',
        '    "experience": string,',
        '    "skills": string,',
        '    "education": string',
        "  },",
        '  "actionItems": [',
        '    { "priority": "high" | "medium" | "low", "title": string, "details": string }',
        "  ]",
        "}",
        "No markdown, comments, trailing commas, or additional keys.",
        "Keep output concise to avoid token overflow:",
        "- matchedSkills/missingSkills: max 12 items each",
        "- matchedKeywords/missingKeywords: max 15 items each",
        "- actionItems: max 6 items",
        "- overallSummary and each sectionFeedback field: max 2 short sentences",
        "- each action item details: max 1 short sentence",
      ].join("\n"),
    ].join("\n\n");

    const groq = new Groq({ apiKey });
    let modelOutput = "";

    try {
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        temperature: 0.2,
        max_completion_tokens: 1600,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are an ATS resume reviewer. Return only strict JSON that follows the provided schema.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      modelOutput = getGroqTextResponse(completion);
    } catch (providerError) {
      if (!isJsonModeGenerationFailure(providerError)) {
        throw providerError;
      }

      const fallbackCompletion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        temperature: 0.1,
        max_completion_tokens: 2200,
        messages: [
          {
            role: "system",
            content:
              "Return exactly one valid JSON object and nothing else. Do not use markdown or code fences.",
          },
          {
            role: "user",
            content: `${prompt}\n\nIMPORTANT: Return one complete JSON object only.`,
          },
        ],
      });

      modelOutput = getGroqTextResponse(fallbackCompletion);
    }

    if (!modelOutput) {
      return NextResponse.json(
        {
          ok: false,
          message: "Model returned an empty response.",
        },
        { status: 502 },
      );
    }

    let parsedJson: unknown | null = parseModelJson(modelOutput);

    if (parsedJson === null) {
      const repairCompletion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        temperature: 0,
        max_completion_tokens: 1200,
        messages: [
          {
            role: "system",
            content:
              "You convert malformed model output into one valid JSON object. Return JSON only.",
          },
          {
            role: "user",
            content: [
              "Fix this into a single valid JSON object that follows the expected ATS analysis schema.",
              "Do not add markdown or explanations.",
              `Input:\n${modelOutput.slice(0, 8000)}`,
            ].join("\n\n"),
          },
        ],
      });

      const repairedOutput = getGroqTextResponse(repairCompletion);
      parsedJson = parseModelJson(repairedOutput);
    }

    if (parsedJson === null) {
      parsedJson = buildFallbackAtsAnalysisFromText(extractedResumeText);
      analysisNotes.push(
        "Model returned invalid JSON. Fallback analysis was generated from extracted resume text.",
      );
    }

    const parsedAnalysis = parseAtsAnalysis(parsedJson);

    if (!parsedAnalysis.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: `Model response failed schema validation: ${parsedAnalysis.error}`,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Resume analysis generated successfully.",
      data: {
        source: inputSource,
        submittedAt: new Date().toISOString(),
        fileName: resumeFile?.name ?? null,
        userPrompt: userPrompt || null,
        notes: analysisNotes.length > 0 ? analysisNotes : undefined,
        visualReview,
        analysis: parsedAnalysis.value,
      },
    });
  } catch (error) {
    const providerMessage = getProviderErrorMessage(error);
    const message =
      providerMessage ||
      (error instanceof Error
        ? error.message
        : "Unable to process resume analysis request.");
    const normalizedMessage = message.toLowerCase();
    const maybeStatus = getProviderErrorStatus(error);

    if (
      maybeStatus === 429 ||
      normalizedMessage.includes("429") ||
      normalizedMessage.includes("quota") ||
      normalizedMessage.includes("rate limit")
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Groq quota or rate limit was reached. Check billing/usage, then retry.",
        },
        { status: 429 },
      );
    }

    if (
      maybeStatus === 400 ||
      normalizedMessage.includes("invalid_request_error") ||
      normalizedMessage.includes("bad request")
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: message.startsWith("Groq")
            ? message
            : `Groq rejected the request: ${message}`,
        },
        { status: 400 },
      );
    }

    if (
      maybeStatus === 401 ||
      normalizedMessage.includes("401") ||
      normalizedMessage.includes("invalid api key") ||
      normalizedMessage.includes("api key not valid")
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Groq authentication failed. Verify GROQ_API_KEY and restart the server.",
        },
        { status: 401 },
      );
    }

    console.error("Resume analysis provider error", {
      status: maybeStatus,
      message,
    });

    return NextResponse.json(
      {
        ok: false,
        message: message.includes("timeout")
          ? "Resume analysis timed out. Please try again."
          : "Unable to process resume analysis request.",
      },
      { status: 500 },
    );
  }
}
