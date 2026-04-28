"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import {
  CheckCircle2,
  FileText,
  ListChecks,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import {
  parseResumeAnalysisApiSuccessResponse,
  type ResumeAnalysisApiData,
  validateResumeAnalysisInput,
} from "@/lib/resume-analysis";

type ApiErrorResponse = {
  ok: false;
  message: string;
  errors?: string[];
};

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.ok === false && typeof candidate.message === "string";
}

const SAMPLE_PROMPTS = [
  {
    label: "Frontend engineer · React/TypeScript",
    text: "I'm targeting senior frontend roles using React and TypeScript at product companies. Focus on impact, performance, and design-system experience.",
  },
  {
    label: "Backend engineer · Node + Postgres",
    text: "I'm applying to backend engineer roles building Node.js APIs with PostgreSQL. Highlight reliability, scaling, and ownership.",
  },
  {
    label: "Product manager · B2B SaaS",
    text: "I'm a PM applying to B2B SaaS startups. Emphasize discovery, cross-functional leadership, and shipped outcomes with metrics.",
  },
  {
    label: "Data analyst · entry level",
    text: "I'm a recent CS grad targeting entry-level data analyst roles. Highlight SQL, Python, dashboards, and storytelling with data.",
  },
];

const VALUE_PROPS = [
  { icon: Sparkles, label: "ATS score" },
  { icon: Search, label: "Keyword fit" },
  { icon: FileText, label: "Layout review" },
  { icon: ListChecks, label: "Prioritized fixes" },
];

function clampScore(score: number): number {
  if (Number.isNaN(score)) return 0;
  return Math.max(0, Math.min(100, score));
}

function scoreTone(score: number): { text: string; bar: string; ring: string } {
  if (score >= 80)
    return {
      text: "text-emerald-600 dark:text-emerald-400",
      bar: "bg-emerald-500",
      ring: "stroke-emerald-500",
    };
  if (score >= 60)
    return {
      text: "text-amber-600 dark:text-amber-400",
      bar: "bg-amber-500",
      ring: "stroke-amber-500",
    };
  return {
    text: "text-rose-600 dark:text-rose-400",
    bar: "bg-rose-500",
    ring: "stroke-rose-500",
  };
}

function priorityChip(priority: string): string {
  const p = priority.toLowerCase();
  if (p.includes("high"))
    return "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300";
  if (p.includes("medium"))
    return "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300";
  return "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function sourceToLabel(source: ResumeAnalysisApiData["source"]): string {
  if (source === "file-and-prompt") return "Resume + Prompt";
  if (source === "file") return "Uploaded file";
  return "Prompt only";
}

const ALLOWED_TYPES = [".pdf", ".doc", ".docx"];
const ANALYSIS_STAGES = [
  "Reading file",
  "Parsing layout",
  "Matching keywords",
  "Scoring & summarizing",
];

export function ResumeAnalysisForm() {
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [userPrompt, setUserPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [analysisResult, setAnalysisResult] = useState<ResumeAnalysisApiData | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [stageIdx, setStageIdx] = useState(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const analysisRef = useRef<HTMLDivElement | null>(null);

  const isPdfFile = useMemo(() => {
    if (!resumeFile) return false;
    return (
      resumeFile.type.toLowerCase().includes("pdf") ||
      resumeFile.name.toLowerCase().endsWith(".pdf")
    );
  }, [resumeFile]);

  // Render PDF first-page thumbnail
  useEffect(() => {
    if (!resumeFile || !isPdfFile) {
      setPreviewImageUrl("");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const arrayBuffer = await resumeFile.arrayBuffer();
        const loadingTask = pdfjs.getDocument({
          data: new Uint8Array(arrayBuffer),
          disableWorker: true,
          isEvalSupported: false,
          useWorkerFetch: false,
        } as unknown as Parameters<typeof pdfjs.getDocument>[0]);
        const pdfDocument = await loadingTask.promise;
        const firstPage = await pdfDocument.getPage(1);
        const viewport = firstPage.getViewport({ scale: 1.4 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) {
          await pdfDocument.destroy();
          return;
        }
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        await firstPage.render({ canvas, canvasContext: context, viewport }).promise;
        const dataUrl = canvas.toDataURL("image/png");
        await pdfDocument.destroy();
        if (!cancelled) setPreviewImageUrl(dataUrl);
      } catch {
        if (!cancelled) setPreviewImageUrl("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isPdfFile, resumeFile]);

  // Smooth-scroll to results
  useEffect(() => {
    if (analysisResult && analysisRef.current) {
      analysisRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [analysisResult]);

  // Animate analysis stages while submitting (visual feedback only)
  useEffect(() => {
    if (!isSubmitting) {
      setStageIdx(0);
      return;
    }
    const timer = setInterval(() => {
      setStageIdx((idx) => Math.min(idx + 1, ANALYSIS_STAGES.length - 1));
    }, 1200);
    return () => clearInterval(timer);
  }, [isSubmitting]);

  const validation = useMemo(
    () =>
      validateResumeAnalysisInput({
        fileName: resumeFile?.name,
        userPrompt,
      }),
    [resumeFile, userPrompt],
  );

  function setFile(nextFile: File | null) {
    setResumeFile(nextFile);
    setErrorMessage("");
    setAnalysisResult(null);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    const ext = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
    if (!ALLOWED_TYPES.includes(ext)) {
      setErrorMessage(`Unsupported file type. Use ${ALLOWED_TYPES.join(", ")}.`);
      return;
    }
    setFile(file);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(true);
  }
  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
  }

  function clearFile() {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function pickSamplePrompt(text: string) {
    setUserPrompt(text);
    setErrorMessage("");
  }

  function resetAnalysis() {
    setAnalysisResult(null);
    setErrorMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setAnalysisResult(null);

    if (!validation.isValid) {
      setErrorMessage(validation.errors[0]);
      return;
    }

    const formData = new FormData();
    if (resumeFile) formData.append("resumeFile", resumeFile);
    if (userPrompt.trim()) formData.append("userPrompt", userPrompt.trim());

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/resume-analysis", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as unknown;

      if (!response.ok) {
        if (isApiErrorResponse(payload)) {
          setErrorMessage(payload.message || "Unable to analyze resume right now.");
          return;
        }
        setErrorMessage("Unable to analyze resume right now.");
        return;
      }

      const parsedResponse = parseResumeAnalysisApiSuccessResponse(payload);
      if (!parsedResponse.ok) {
        setErrorMessage("Received an invalid analysis response. Please retry.");
        return;
      }
      setAnalysisResult(parsedResponse.value.data);
    } catch {
      setErrorMessage("Request failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // === RESULTS VIEW ===
  if (analysisResult && !isSubmitting) {
    return (
      <ResultsView
        data={analysisResult}
        onReset={resetAnalysis}
        analysisRef={analysisRef}
      />
    );
  }

  // === FORM VIEW ===
  return (
    <div className="space-y-6">
      {/* Hero */}
      <header className="space-y-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white md:text-3xl">
            Make your resume recruiter-ready
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Upload your resume and tell us the role. We score it against ATS expectations
            and give you specific, prioritized fixes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {VALUE_PROPS.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200"
            >
              <Icon className="h-3.5 w-3.5 text-indigo-500" />
              {label}
            </span>
          ))}
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          {/* DROPZONE */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
            <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white">
              <Upload className="h-4 w-4 text-indigo-500" />
              Resume
            </div>
            {!resumeFile ? (
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
                }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`flex min-h-[260px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                  isDragging
                    ? "border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/30"
                    : "border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/40 dark:border-gray-700 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/20"
                }`}
              >
                <span
                  className={`mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full ${
                    isDragging
                      ? "bg-indigo-600 text-white"
                      : "bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300"
                  }`}
                >
                  <Upload className="h-5 w-5" />
                </span>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {isDragging ? "Drop to upload" : "Drag your resume here"}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  or click to browse · PDF, DOC, DOCX
                </p>
                <input
                  ref={fileInputRef}
                  id="resumeFile"
                  name="resumeFile"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-start gap-3">
                  <div className="flex h-24 w-20 shrink-0 overflow-hidden rounded-md border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-950">
                    {previewImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewImageUrl}
                        alt="Resume preview"
                        className="h-full w-full object-cover object-top"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-400">
                        <FileText className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-medium text-gray-900 dark:text-white"
                      title={resumeFile.name}
                    >
                      {resumeFile.name}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {formatBytes(resumeFile.size)} ·{" "}
                      {isPdfFile ? "PDF" : resumeFile.name.split(".").pop()?.toUpperCase() ?? "FILE"}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-900"
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        onClick={clearFile}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 dark:border-gray-700 dark:text-gray-300 dark:hover:border-rose-800 dark:hover:bg-rose-950/30 dark:hover:text-rose-300"
                      >
                        <X className="h-3 w-3" /> Remove
                      </button>
                    </div>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  id="resumeFile"
                  name="resumeFile"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            )}
          </div>

          {/* PROMPT */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
            <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white">
              <Wand2 className="h-4 w-4 text-indigo-500" />
              Context for the analysis
            </div>
            <textarea
              id="userPrompt"
              name="userPrompt"
              value={userPrompt}
              onChange={(event) => {
                setUserPrompt(event.target.value);
                setErrorMessage("");
              }}
              placeholder="Tell us the role you're targeting, key requirements, or what to optimize for…"
              rows={6}
              className="block w-full resize-none rounded-xl border border-gray-300 bg-white p-3 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
            />
            <div className="mt-3">
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Quick start
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SAMPLE_PROMPTS.map((sample) => (
                  <button
                    key={sample.label}
                    type="button"
                    onClick={() => pickSamplePrompt(sample.text)}
                    className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs text-gray-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-indigo-700 dark:hover:bg-indigo-950 dark:hover:text-indigo-200"
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300">
            {errorMessage}
          </div>
        )}

        {/* Submit bar */}
        <div className="flex flex-col-reverse items-stretch justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950 sm:flex-row sm:items-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {validation.isValid ? (
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> Ready to analyze
              </span>
            ) : (
              "Add a resume or a prompt — both is best."
            )}
          </p>
          <button
            type="submit"
            disabled={isSubmitting || !validation.isValid}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Analyzing…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Analyze resume
              </>
            )}
          </button>
        </div>

        {isSubmitting && (
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/20">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
              Working on it…
            </p>
            <ol className="space-y-2">
              {ANALYSIS_STAGES.map((stage, idx) => {
                const done = idx < stageIdx;
                const active = idx === stageIdx;
                return (
                  <li key={stage} className="flex items-center gap-2 text-sm">
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                        done
                          ? "bg-indigo-600 text-white"
                          : active
                            ? "bg-white ring-2 ring-indigo-500 dark:bg-gray-900"
                            : "bg-gray-200 dark:bg-gray-800"
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : active ? (
                        <Loader2 className="h-3 w-3 animate-spin text-indigo-600" />
                      ) : null}
                    </span>
                    <span
                      className={
                        done || active
                          ? "text-gray-900 dark:text-white"
                          : "text-gray-500 dark:text-gray-400"
                      }
                    >
                      {stage}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </form>
    </div>
  );
}

// ===========================
// RESULTS VIEW (separate)
// ===========================
function ResultsView({
  data,
  onReset,
  analysisRef,
}: {
  data: ResumeAnalysisApiData;
  onReset: () => void;
  analysisRef: React.RefObject<HTMLDivElement | null>;
}) {
  const score = clampScore(data.analysis.overallScore);
  const tone = scoreTone(score);
  const skillsTotal =
    data.analysis.skillMatch.matchedSkills.length +
    data.analysis.skillMatch.missingSkills.length;
  const skillsScore =
    skillsTotal === 0
      ? 0
      : Math.round((data.analysis.skillMatch.matchedSkills.length / skillsTotal) * 100);
  const keywordsTotal =
    data.analysis.keywordCoverage.matchedKeywords.length +
    data.analysis.keywordCoverage.missingKeywords.length;
  const keywordsScore =
    keywordsTotal === 0
      ? 0
      : Math.round(
          (data.analysis.keywordCoverage.matchedKeywords.length / keywordsTotal) * 100,
        );
  const layoutScore = data.visualReview?.analysis.visualScore ?? 0;

  return (
    <div ref={analysisRef} className="space-y-4">
      {/* HERO */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <div className="grid gap-6 p-5 md:grid-cols-[auto_1fr_auto] md:items-center md:gap-8 md:p-6">
          <ScoreGauge score={score} />
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Overall ATS score
            </p>
            <h2 className={`text-2xl font-bold ${tone.text} md:text-3xl`}>
              {scoreVerdict(score)}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-gray-700 dark:text-gray-300">
              {data.analysis.overallSummary}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
                {sourceToLabel(data.source)}
              </span>
              {data.fileName && (
                <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
                  <FileText className="h-3 w-3" /> {data.fileName}
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
                {new Date(data.submittedAt).toLocaleString()}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center justify-center gap-1.5 self-start rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-900"
          >
            <RefreshCw className="h-4 w-4" /> Analyze another
          </button>
        </div>

        {/* Sub-scores strip */}
        <div className="grid gap-px border-t border-gray-200 bg-gray-200 dark:border-gray-800 dark:bg-gray-800 sm:grid-cols-3">
          <SubScore label="Skills match" score={skillsScore} />
          <SubScore label="Keyword coverage" score={keywordsScore} />
          <SubScore
            label="Layout & structure"
            score={layoutScore}
            placeholder={!data.visualReview}
          />
        </div>
      </div>

      {data.notes && data.notes.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300">
          {data.notes.join(" ")}
        </div>
      )}

      {/* Skills + Keywords */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChipsCard
          title="Skills"
          matchedTitle="Matched skills"
          missingTitle="Missing skills"
          matched={data.analysis.skillMatch.matchedSkills}
          missing={data.analysis.skillMatch.missingSkills}
        />
        <ChipsCard
          title="Keywords"
          matchedTitle="Matched keywords"
          missingTitle="Missing keywords"
          matched={data.analysis.keywordCoverage.matchedKeywords}
          missing={data.analysis.keywordCoverage.missingKeywords}
        />
      </div>

      {/* Section feedback */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
        <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
          Section feedback
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { label: "Summary", text: data.analysis.sectionFeedback.summary },
            { label: "Experience", text: data.analysis.sectionFeedback.experience },
            { label: "Skills", text: data.analysis.sectionFeedback.skills },
            { label: "Education", text: data.analysis.sectionFeedback.education },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-800 dark:bg-gray-900"
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                {s.label}
              </p>
              <p className="mt-1 text-gray-700 dark:text-gray-200">{s.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Visual review */}
      {data.visualReview && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Layout & structure review
            </h3>
            <span
              className={`text-xs font-semibold ${scoreTone(data.visualReview.analysis.visualScore).text}`}
            >
              Visual score: {data.visualReview.analysis.visualScore}/100
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              { label: "Structure", score: data.visualReview.analysis.structureScore },
              { label: "Readability", score: data.visualReview.analysis.readabilityScore },
              { label: "Overall", score: data.visualReview.analysis.overallScore },
            ].map((item) => {
              const t = scoreTone(item.score);
              return (
                <div
                  key={item.label}
                  className="rounded-lg border border-gray-200 p-3 dark:border-gray-800"
                >
                  <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {item.label}
                  </p>
                  <p className={`mt-1 text-lg font-semibold ${t.text}`}>{item.score}/100</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                    <div
                      className={`h-full rounded-full ${t.bar}`}
                      style={{ width: `${clampScore(item.score)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              { label: "Alignment", text: data.visualReview.analysis.layoutFeedback.alignment },
              { label: "Hierarchy", text: data.visualReview.analysis.layoutFeedback.hierarchy },
              { label: "Whitespace", text: data.visualReview.analysis.layoutFeedback.whitespace },
              { label: "Scanability", text: data.visualReview.analysis.layoutFeedback.scanability },
            ].map((entry) => (
              <div
                key={entry.label}
                className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-800 dark:bg-gray-900"
              >
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {entry.label}
                </p>
                <p className="mt-1 text-gray-700 dark:text-gray-200">{entry.text}</p>
              </div>
            ))}
          </div>
          {data.visualReview.analysis.topFixes.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-200">Top layout fixes</p>
              {data.visualReview.analysis.topFixes.slice(0, 3).map((fix, i) => (
                <div
                  key={`${fix.priority}-${i}`}
                  className={`rounded-md border p-2 text-sm ${priorityChip(fix.priority)}`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide">
                    {fix.priority} priority
                  </p>
                  <p className="font-medium">{fix.fix}</p>
                  <p className="text-xs opacity-80">{fix.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action items */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
        <div className="mb-3 flex items-center gap-1.5">
          <ListChecks className="h-4 w-4 text-indigo-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Prioritized action items
          </h3>
        </div>
        {data.analysis.actionItems.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-300">
            No action items were returned.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.analysis.actionItems.map((item, i) => (
              <li
                key={`${item.priority}-${i}`}
                className={`rounded-md border p-3 text-sm ${priorityChip(item.priority)}`}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide">
                  {item.priority} priority
                </p>
                <p className="font-medium">{item.title}</p>
                <p className="text-xs opacity-80">{item.details}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {data.userPrompt && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
          <span className="font-semibold">Prompt context:</span> {data.userPrompt}
        </div>
      )}

      <div className="flex justify-center">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-900"
        >
          <RefreshCw className="h-4 w-4" /> Analyze another resume
        </button>
      </div>
    </div>
  );
}

function scoreVerdict(score: number): string {
  if (score >= 85) return "Excellent fit";
  if (score >= 70) return "Strong, with tweaks to make";
  if (score >= 55) return "Average — clear room to improve";
  if (score >= 35) return "Below the bar";
  return "Needs major rework";
}

function ScoreGauge({ score }: { score: number }) {
  const tone = scoreTone(score);
  const circumference = 2 * Math.PI * 56;
  const offset = circumference - (clampScore(score) / 100) * circumference;
  return (
    <div className="relative h-36 w-36 shrink-0">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle
          cx="64"
          cy="64"
          r="56"
          fill="none"
          strokeWidth="10"
          className="stroke-gray-200 dark:stroke-gray-800"
        />
        <circle
          cx="64"
          cy="64"
          r="56"
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          className={tone.ring}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold tabular-nums ${tone.text}`}>{score}</span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          out of 100
        </span>
      </div>
    </div>
  );
}

function SubScore({
  label,
  score,
  placeholder,
}: {
  label: string;
  score: number;
  placeholder?: boolean;
}) {
  const tone = scoreTone(score);
  return (
    <div className="bg-white p-4 dark:bg-gray-950">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </p>
      {placeholder ? (
        <p className="mt-1 text-sm text-gray-400">Not available</p>
      ) : (
        <>
          <p className={`mt-1 text-xl font-semibold ${tone.text}`}>
            {score}
            <span className="ml-1 text-xs font-normal text-gray-500 dark:text-gray-400">
              /100
            </span>
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
            <div
              className={`h-full rounded-full ${tone.bar}`}
              style={{ width: `${clampScore(score)}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
}

function ChipsCard({
  title,
  matchedTitle,
  missingTitle,
  matched,
  missing,
}: {
  title: string;
  matchedTitle: string;
  missingTitle: string;
  matched: string[];
  missing: string[];
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
        <span className="text-[11px] text-gray-500 dark:text-gray-400">
          {matched.length} matched · {missing.length} missing
        </span>
      </div>
      <div className="space-y-3">
        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            {matchedTitle}
          </p>
          <ChipList items={matched} tone="emerald" />
        </div>
        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-rose-600 dark:text-rose-400">
            {missingTitle}
          </p>
          <ChipList items={missing} tone="rose" />
        </div>
      </div>
    </div>
  );
}

function ChipList({ items, tone }: { items: string[]; tone: "emerald" | "rose" }) {
  if (items.length === 0) {
    return <p className="text-xs text-gray-500 dark:text-gray-400">None</p>;
  }
  const cls =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
      : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300";
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}
        >
          {item}
        </span>
      ))}
    </div>
  );
}
