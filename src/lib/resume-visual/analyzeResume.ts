import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { buildResumeVisualPrompt } from "./buildPrompt";
import { extractLayoutFromPdf } from "./extractLayout";
import { extractTextFromPdf } from "./extractText";
import { convertPdfToImages } from "./pdfToImages";
import {
  parseResumeVisualAnalysis,
  type ResumeVisualAnalysis,
} from "./schema";
import { isLikelyResumeDocument } from "@/lib/resume-relevance";

const execFileAsync = promisify(execFile);

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const ALLOWED_EXTENSIONS = [".pdf", ".docx"];

export class ResumeVisualAnalysisError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "ResumeVisualAnalysisError";
    this.status = status;
  }
}

export type AnalyzeResumeFileInput = {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
};

export type AnalyzeResumeResult = {
  analysis: ResumeVisualAnalysis;
  provider: string;
  metadata: {
    originalFileName: string;
    sourceType: "pdf" | "docx";
    pageCount: number;
    usedMock: boolean;
  };
};

type ResumeVisualPrompt = ReturnType<typeof buildResumeVisualPrompt>;

type LlmProvider = {
  name: string;
  isMock: boolean;
  analyze: (prompt: ResumeVisualPrompt) => Promise<unknown>;
  repairJson?: (broken: string, prompt: ResumeVisualPrompt) => Promise<unknown>;
};

function hasAllowedFileExtension(fileName: string): boolean {
  const normalizedName = fileName.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => normalizedName.endsWith(ext));
}

function inferSourceType(fileName: string, mimeType: string): "pdf" | "docx" {
  const normalizedName = fileName.toLowerCase();
  if (normalizedName.endsWith(".pdf") || mimeType === "application/pdf") {
    return "pdf";
  }

  return "docx";
}

function parseModelJson(value: string): unknown | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const candidates: string[] = [trimmed];
  const noFences = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  if (noFences && noFences !== trimmed) {
    candidates.push(noFences);
  }

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

async function assertBinaryInstalled(binaryName: string): Promise<void> {
  try {
    await execFileAsync("which", [binaryName]);
  } catch {
    throw new ResumeVisualAnalysisError(
      `${binaryName} is not installed. Install it locally to process DOCX resumes.`,
      500,
    );
  }
}

async function convertDocxToPdfBuffer(fileName: string, docxBuffer: Buffer): Promise<Buffer> {
  await assertBinaryInstalled("soffice");

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "resume-visual-docx-"));
  const inputDocxPath = path.join(tempDir, fileName);
  const outputPdfPath = path.join(
    tempDir,
    `${path.basename(fileName, path.extname(fileName))}.pdf`,
  );

  try {
    await fs.writeFile(inputDocxPath, docxBuffer);
    await execFileAsync("soffice", [
      "--headless",
      "--convert-to",
      "pdf",
      "--outdir",
      tempDir,
      inputDocxPath,
    ]);

    return await fs.readFile(outputPdfPath);
  } catch {
    throw new ResumeVisualAnalysisError(
      "DOCX conversion failed. Ensure LibreOffice (soffice) is installed and retry.",
      422,
    );
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

function buildMockAnalysis(prompt: ResumeVisualPrompt): ResumeVisualAnalysis {
  const userText = prompt.user.toLowerCase();
  const hasTwoColumnSignal = userText.includes("estimatedcolumns: 2");
  const hasWeakAlignmentSignal =
    userText.includes("leftalignmentvariance: 100") ||
    userText.includes("leftalignmentvariance: 200");
  const hasFewSections = userText.includes("sectionheaders: none");

  const structureScore = hasTwoColumnSignal ? 72 : 80;
  const visualScore = hasWeakAlignmentSignal ? 66 : 78;
  const readabilityScore = hasFewSections ? 68 : 82;
  const overallScore = Math.round((visualScore + structureScore + readabilityScore) / 3);

  return {
    visualScore,
    structureScore,
    readabilityScore,
    overallScore,
    visualIssues: [
      "Heading hierarchy can be more consistent across sections.",
      "Whitespace between major sections can be improved for scanning speed.",
    ],
    strengths: [
      "Core resume content is present and mostly organized.",
      "Bullet usage supports quick information retrieval.",
    ],
    weaknesses: [
      "Some sections compete visually with similar emphasis.",
      "Alignment and spacing rhythm are not fully consistent.",
    ],
    layoutFeedback: {
      whitespace:
        "Increase spacing before each major section heading for clearer segmentation.",
      alignment:
        "Standardize left alignment across bullets and date lines to reduce visual noise.",
      hierarchy:
        "Use one heading style for section titles and one style for role titles.",
      scanability:
        "Shorten dense bullets and front-load impact metrics for six-second scans.",
    },
    topFixes: [
      {
        priority: "high",
        fix: "Enforce one consistent section heading style throughout the resume.",
        reason: "Consistent hierarchy helps recruiters locate relevant sections immediately.",
      },
      {
        priority: "medium",
        fix: "Add 6-10px additional vertical spacing before section headings.",
        reason: "Improved whitespace increases readability and perceived professionalism.",
      },
      {
        priority: "medium",
        fix: "Keep bullet indentation and date alignment consistent in each section.",
        reason: "Alignment consistency reduces cognitive load and improves scanning.",
      },
    ],
  };
}

function getLocalMockProvider(): LlmProvider {
  return {
    name: "local-mock",
    isMock: true,
    analyze: async (prompt) => buildMockAnalysis(prompt),
  };
}

function getOpenAiCompatibleProvider(): LlmProvider {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  if (!apiKey) {
    throw new ResumeVisualAnalysisError(
      "OPENAI_API_KEY is required for openai-compatible provider mode.",
      500,
    );
  }

  const requestJsonCompletion = async (
    prompt: ResumeVisualPrompt,
    includeJsonMode: boolean,
  ): Promise<string> => {
    const content = [
      { type: "text", text: prompt.user },
      ...prompt.images.map((image) => ({
        type: "image_url",
        image_url: {
          url: `data:${image.mimeType};base64,${image.dataBase64}`,
        },
      })),
    ];

    const body: Record<string, unknown> = {
      model,
      temperature: 0.1,
      max_tokens: 1800,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content },
      ],
    };

    if (includeJsonMode) {
      body.response_format = { type: "json_object" };
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const payload = (await response.json().catch(() => null)) as
      | {
          error?: { message?: string };
          choices?: Array<{ message?: { content?: string | null } }>;
        }
      | null;

    if (!response.ok) {
      const message =
        payload?.error?.message ??
        `Provider request failed with status ${response.status}.`;
      throw new ResumeVisualAnalysisError(message, response.status);
    }

    const contentValue = payload?.choices?.[0]?.message?.content;
    if (typeof contentValue !== "string" || !contentValue.trim()) {
      throw new ResumeVisualAnalysisError(
        "Provider returned an empty completion.",
        502,
      );
    }

    return contentValue;
  };

  return {
    name: "openai-compatible",
    isMock: false,
    analyze: async (prompt) => requestJsonCompletion(prompt, true),
    repairJson: async (broken, prompt) =>
      requestJsonCompletion(
        {
          ...prompt,
          user: [
            "Repair this malformed JSON into one valid JSON object that matches the requested schema exactly.",
            "Return JSON only. No markdown or extra keys.",
            `Broken output:\n${broken.slice(0, 10000)}`,
          ].join("\n\n"),
          images: [],
        },
        false,
      ),
  };
}

function resolveProvider(): LlmProvider {
  const mode = (process.env.RESUME_VISUAL_PROVIDER ?? "local-mock")
    .trim()
    .toLowerCase();

  if (mode === "openai-compatible") {
    return getOpenAiCompatibleProvider();
  }

  return getLocalMockProvider();
}

async function normalizeUploadToPdf(input: AnalyzeResumeFileInput): Promise<{
  pdfBuffer: Buffer;
  sourceType: "pdf" | "docx";
}> {
  if (input.buffer.length === 0) {
    throw new ResumeVisualAnalysisError("Uploaded file is empty.", 400);
  }

  if (input.buffer.length > 12 * 1024 * 1024) {
    throw new ResumeVisualAnalysisError(
      "File is too large. Maximum supported size is 12MB.",
      413,
    );
  }

  if (!hasAllowedFileExtension(input.fileName)) {
    throw new ResumeVisualAnalysisError(
      "Resume must be a PDF or DOCX file.",
      400,
    );
  }

  if (input.mimeType && !ALLOWED_MIME_TYPES.has(input.mimeType)) {
    throw new ResumeVisualAnalysisError(
      "Unsupported file MIME type. Upload PDF or DOCX.",
      400,
    );
  }

  const sourceType = inferSourceType(input.fileName, input.mimeType);
  if (sourceType === "pdf") {
    return { pdfBuffer: input.buffer, sourceType };
  }

  const safeDocxName = input.fileName.toLowerCase().endsWith(".docx")
    ? input.fileName
    : `${input.fileName}.docx`;

  const pdfBuffer = await convertDocxToPdfBuffer(safeDocxName, input.buffer);
  return { pdfBuffer, sourceType };
}

export async function analyzeResumeVisual(
  input: AnalyzeResumeFileInput,
): Promise<AnalyzeResumeResult> {
  const { pdfBuffer, sourceType } = await normalizeUploadToPdf(input);
  const text = await extractTextFromPdf(pdfBuffer);

  if (
    !isLikelyResumeDocument({
      fileName: input.fileName,
      text: text.combinedText,
    })
  ) {
    throw new ResumeVisualAnalysisError("Please upload a resume.", 400);
  }

  const [layout, imagesResult] = await Promise.all([
    extractLayoutFromPdf(pdfBuffer),
    convertPdfToImages(pdfBuffer, { maxPages: 3, dpi: 144 }),
  ]);

  const prompt = buildResumeVisualPrompt({
    text,
    layout,
    images: imagesResult.pages,
  });

  const provider = resolveProvider();
  const rawOutput = await provider.analyze(prompt);

  let parsedCandidate: unknown | null = null;
  if (typeof rawOutput === "string") {
    parsedCandidate = parseModelJson(rawOutput);
    if (parsedCandidate === null && provider.repairJson) {
      const repaired = await provider.repairJson(rawOutput, prompt);
      if (typeof repaired === "string") {
        parsedCandidate = parseModelJson(repaired);
      } else {
        parsedCandidate = repaired;
      }
    }
  } else {
    parsedCandidate = rawOutput;
  }

  if (parsedCandidate === null) {
    throw new ResumeVisualAnalysisError(
      "Provider returned invalid JSON for visual analysis.",
      502,
    );
  }

  const parsed = parseResumeVisualAnalysis(parsedCandidate);
  if (!parsed.ok) {
    throw new ResumeVisualAnalysisError(
      `Model response failed schema validation: ${parsed.error}`,
      502,
    );
  }

  return {
    analysis: parsed.value,
    provider: provider.name,
    metadata: {
      originalFileName: input.fileName,
      sourceType,
      pageCount: layout.pageCount,
      usedMock: provider.isMock,
    },
  };
}
