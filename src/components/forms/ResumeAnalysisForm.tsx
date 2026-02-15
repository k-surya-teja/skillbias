"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { Button } from "flowbite-react";
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
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return candidate.ok === false && typeof candidate.message === "string";
}

function sourceToLabel(source: ResumeAnalysisApiData["source"]): string {
  if (source === "file-and-prompt") {
    return "Resume + Prompt";
  }

  if (source === "file") {
    return "Uploaded file";
  }

  return "Prompt only";
}

function clampScore(score: number): number {
  if (Number.isNaN(score)) {
    return 0;
  }

  return Math.max(0, Math.min(100, score));
}

function scoreAccent(score: number): string {
  if (score >= 80) {
    return "text-emerald-700 dark:text-emerald-300";
  }

  if (score >= 60) {
    return "text-amber-700 dark:text-amber-300";
  }

  return "text-rose-700 dark:text-rose-300";
}

function scoreBarAccent(score: number): string {
  if (score >= 80) {
    return "bg-emerald-500";
  }

  if (score >= 60) {
    return "bg-amber-500";
  }

  return "bg-rose-500";
}

function priorityAccent(priority: string): string {
  const normalized = priority.toLowerCase();

  if (normalized.includes("high")) {
    return "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300";
  }

  if (normalized.includes("medium")) {
    return "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300";
  }

  return "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300";
}

export function ResumeAnalysisForm() {
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [userPrompt, setUserPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [analysisResult, setAnalysisResult] = useState<ResumeAnalysisApiData | null>(
    null,
  );
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [previewFileUrl, setPreviewFileUrl] = useState("");
  const analysisRef = useRef<HTMLDivElement | null>(null);

  const isPdfFile = useMemo(() => {
    if (!resumeFile) {
      return false;
    }

    return (
      resumeFile.type.toLowerCase().includes("pdf") ||
      resumeFile.name.toLowerCase().endsWith(".pdf")
    );
  }, [resumeFile]);

  useEffect(() => {
    if (!resumeFile) {
      setPreviewFileUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(resumeFile);
    setPreviewFileUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [resumeFile]);

  useEffect(() => {
    if (!resumeFile || !isPdfFile) {
      setPreviewImageUrl("");
      return;
    }

    let isCancelled = false;

    const renderFirstPagePreview = async () => {
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
        const viewport = firstPage.getViewport({ scale: 1.2 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (!context) {
          await pdfDocument.destroy();
          return;
        }

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        await firstPage.render({
          canvas,
          canvasContext: context,
          viewport,
        }).promise;

        const dataUrl = canvas.toDataURL("image/png");
        await pdfDocument.destroy();

        if (!isCancelled) {
          setPreviewImageUrl(dataUrl);
        }
      } catch {
        if (!isCancelled) {
          setPreviewImageUrl("");
        }
      }
    };

    void renderFirstPagePreview();

    return () => {
      isCancelled = true;
    };
  }, [isPdfFile, resumeFile]);

  useEffect(() => {
    if (!analysisResult || !analysisRef.current) {
      return;
    }

    analysisRef.current.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [analysisResult]);

  const validation = useMemo(
    () =>
      validateResumeAnalysisInput({
        fileName: resumeFile?.name,
        userPrompt,
      }),
    [resumeFile, userPrompt],
  );

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setResumeFile(nextFile);
    setErrorMessage("");
    setSuccessMessage("");
    setAnalysisResult(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setAnalysisResult(null);

    if (!validation.isValid) {
      setErrorMessage(validation.errors[0]);
      return;
    }

    const formData = new FormData();

    if (resumeFile) {
      formData.append("resumeFile", resumeFile);
    }

    if (userPrompt.trim()) {
      formData.append("userPrompt", userPrompt.trim());
    }

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
      setSuccessMessage(parsedResponse.value.message);
    } catch {
      setErrorMessage("Request failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative">
      <form
        onSubmit={handleSubmit}
        className="w-full rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-indigo-50 p-4 shadow-xl shadow-indigo-100/50 dark:border-slate-800 dark:from-slate-950 dark:via-slate-950 dark:to-indigo-950/30 dark:shadow-none md:rounded-3xl md:p-8"
      >
        <div className="space-y-2">
          <div className="flex items-start">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white md:text-2xl">
              Resume Analysis Studio
            </h2>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Upload your resume and add a context prompt (target role, JD highlights,
            company preference, or focus areas) for better recommendations.
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-4 xl:mt-6 xl:gap-5 xl:flex-row">
          <div className="space-y-4 xl:w-4/5 xl:space-y-5">
            <div className="rounded-xl border border-slate-200 bg-white/90 p-3 dark:border-slate-800 dark:bg-slate-900/70 md:rounded-2xl md:p-4">
              <label
                htmlFor="resumeFile"
                className="mb-2 block text-sm font-medium text-slate-900 dark:text-slate-100"
              >
                Resume file (PDF, DOC, DOCX)
              </label>
              <input
                id="resumeFile"
                name="resumeFile"
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleFileChange}
                className="block w-full cursor-pointer rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {resumeFile ? `Selected: ${resumeFile.name}` : "No file selected yet."}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white/90 p-3 dark:border-slate-800 dark:bg-slate-900/70 md:rounded-2xl md:p-4">
              <label
                htmlFor="userPrompt"
                className="mb-2 block text-sm font-medium text-slate-900 dark:text-slate-100"
              >
                Context prompt
              </label>
              <textarea
                id="userPrompt"
                name="userPrompt"
                value={userPrompt}
                onChange={(event) => {
                  setUserPrompt(event.target.value);
                  setErrorMessage("");
                  setSuccessMessage("");
                }}
                placeholder="Example: I am a student studying Computer Science and I am looking for a role in software development. Now analyse my resume."
                rows={6}
                className="block w-full resize-none rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                This prompt is sent to the backend and used as extra context during
                analysis.
              </p>
            </div>
          </div>

          <div className="hidden xl:block xl:w-1/5">
            <div className="flex min-h-[350px] items-center justify-center">
              {resumeFile ? (
                isPdfFile && previewImageUrl ? (
                  <img
                    src={previewImageUrl}
                    alt="Resume first page preview"
                    className="h-[350px] w-auto max-w-full object-contain"
                  />
                ) : isPdfFile && previewFileUrl ? (
                  <iframe
                    title="Resume first page preview"
                    src={`${previewFileUrl}#page=1&toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                    className="h-[350px] w-auto min-w-[170px] border-0 bg-transparent"
                  />
                ) : (
                  <div className="text-sm text-slate-600 dark:text-slate-300">
                    Preview is available for PDF files.
                  </div>
                )
              ) : (
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  Upload a resume to view preview.
                </div>
              )}
            </div>
          </div>
        </div>

        {errorMessage ? (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300">
            {errorMessage}
          </p>
        ) : null}

        {!errorMessage && successMessage ? (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300">
            {successMessage}
          </p>
        ) : null}

      {!errorMessage && analysisResult ? (
        <div
          ref={analysisRef}
          className="mt-3 rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-3 text-sm text-gray-800 shadow-sm dark:border-indigo-900/60 dark:from-indigo-950/30 dark:via-slate-950 dark:to-violet-950/20 dark:text-gray-100 md:mt-4 md:rounded-2xl md:p-5"
        >
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3">
            <div className="col-span-2 rounded-lg border border-indigo-200 bg-white p-3 dark:border-indigo-900/50 dark:bg-slate-900 md:col-span-1 md:rounded-xl md:p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                ATS Score
              </p>
              <p
                className={`mt-1 text-2xl font-bold md:text-3xl ${scoreAccent(
                  analysisResult.analysis.overallScore,
                )}`}
              >
                {analysisResult.analysis.overallScore}
                <span className="ml-1 text-base text-slate-500 dark:text-slate-400">
                  /100
                </span>
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700 md:mt-3">
                <div
                  className={`h-full rounded-full transition-all ${scoreBarAccent(
                    analysisResult.analysis.overallScore,
                  )}`}
                  style={{ width: `${clampScore(analysisResult.analysis.overallScore)}%` }}
                />
              </div>
            </div>

            <div className="rounded-lg border border-indigo-200 bg-white p-3 dark:border-indigo-900/50 dark:bg-slate-900 md:rounded-xl md:p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Source
              </p>
              <p className="mt-2 inline-flex rounded-full border border-indigo-300 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 md:px-3 md:py-1 md:text-xs">
                {sourceToLabel(analysisResult.source)}
              </p>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Analysis combines recruiter-style text checks and ATS signals.
              </p>
            </div>

            <div className="col-span-2 rounded-lg border border-indigo-200 bg-white p-3 dark:border-indigo-900/50 dark:bg-slate-900 md:col-span-1 md:rounded-xl md:p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Confidence Snapshot
              </p>
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                {analysisResult.analysis.overallSummary}
              </p>
            </div>
          </div>

          {analysisResult.userPrompt ? (
            <div className="mt-3 rounded-lg border border-indigo-200 bg-white p-3 text-xs text-slate-700 dark:border-indigo-900/50 dark:bg-slate-900 dark:text-slate-200">
              <span className="font-semibold">Prompt context:</span>{" "}
              {analysisResult.userPrompt}
            </div>
          ) : null}

          {analysisResult.notes?.length ? (
            <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300">
              {analysisResult.notes.join(" ")}
            </div>
          ) : null}

          <div className="mt-3 grid gap-3 md:mt-4 md:gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950 md:rounded-xl md:p-4">
              <h3 className="font-semibold">Skills Match</h3>
              <p className="mt-3 text-xs uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                Matched
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {analysisResult.analysis.skillMatch.matchedSkills.length > 0 ? (
                  analysisResult.analysis.skillMatch.matchedSkills.map((skill) => (
                    <span
                      key={`matched-skill-${skill}`}
                      className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 md:px-2.5 md:py-1 md:text-xs"
                    >
                      {skill}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-slate-600 dark:text-slate-300">None</p>
                )}
              </div>
              <p className="mt-3 text-xs uppercase tracking-wide text-rose-600 dark:text-rose-400">
                Missing
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {analysisResult.analysis.skillMatch.missingSkills.length > 0 ? (
                  analysisResult.analysis.skillMatch.missingSkills.map((skill) => (
                    <span
                      key={`missing-skill-${skill}`}
                      className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 md:px-2.5 md:py-1 md:text-xs"
                    >
                      {skill}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-slate-600 dark:text-slate-300">None</p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950 md:rounded-xl md:p-4">
              <h3 className="font-semibold">Keyword Coverage</h3>
              <p className="mt-3 text-xs uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                Matched
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {analysisResult.analysis.keywordCoverage.matchedKeywords.length > 0 ? (
                  analysisResult.analysis.keywordCoverage.matchedKeywords.map((keyword) => (
                    <span
                      key={`matched-keyword-${keyword}`}
                      className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 md:px-2.5 md:py-1 md:text-xs"
                    >
                      {keyword}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-slate-600 dark:text-slate-300">None</p>
                )}
              </div>
              <p className="mt-3 text-xs uppercase tracking-wide text-rose-600 dark:text-rose-400">
                Missing
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {analysisResult.analysis.keywordCoverage.missingKeywords.length > 0 ? (
                  analysisResult.analysis.keywordCoverage.missingKeywords.map((keyword) => (
                    <span
                      key={`missing-keyword-${keyword}`}
                      className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 md:px-2.5 md:py-1 md:text-xs"
                    >
                      {keyword}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-slate-600 dark:text-slate-300">None</p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950 md:mt-4 md:rounded-xl md:p-4">
            <h3 className="font-semibold">Section Feedback</h3>
            <div className="mt-2 grid gap-2 md:mt-3 md:gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-3 dark:border-indigo-900/50 dark:bg-indigo-950/20">
                <p className="text-xs uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
                  Summary
                </p>
                <p className="mt-1 text-sm">{analysisResult.analysis.sectionFeedback.summary}</p>
              </div>
              <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-3 dark:border-indigo-900/50 dark:bg-indigo-950/20">
                <p className="text-xs uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
                  Experience
                </p>
                <p className="mt-1 text-sm">
                  {analysisResult.analysis.sectionFeedback.experience}
                </p>
              </div>
              <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-3 dark:border-indigo-900/50 dark:bg-indigo-950/20">
                <p className="text-xs uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
                  Skills
                </p>
                <p className="mt-1 text-sm">{analysisResult.analysis.sectionFeedback.skills}</p>
              </div>
              <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-3 dark:border-indigo-900/50 dark:bg-indigo-950/20">
                <p className="text-xs uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
                  Education
                </p>
                <p className="mt-1 text-sm">{analysisResult.analysis.sectionFeedback.education}</p>
              </div>
            </div>
          </div>

          {analysisResult.visualReview ? (
            <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950 md:mt-4 md:rounded-xl md:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">Structural Review</h3>
                <span
                  className={`text-xs font-semibold ${scoreAccent(
                    analysisResult.visualReview.analysis.visualScore,
                  )}`}
                >
                  Visual score: {analysisResult.visualReview.analysis.visualScore}/100
                </span>
              </div>

              <div className="mt-2 grid gap-2 md:mt-3 md:gap-3 md:grid-cols-3">
                {[
                  {
                    label: "Structure",
                    score: analysisResult.visualReview.analysis.structureScore,
                  },
                  {
                    label: "Readability",
                    score: analysisResult.visualReview.analysis.readabilityScore,
                  },
                  { label: "Overall", score: analysisResult.visualReview.analysis.overallScore },
                ].map((item) => (
                  <div
                    key={`visual-score-${item.label}`}
                    className="rounded-lg border border-slate-200 p-2.5 dark:border-slate-700 md:p-3"
                  >
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {item.label}
                    </p>
                    <p className={`mt-1 text-lg font-semibold ${scoreAccent(item.score)}`}>
                      {item.score}/100
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className={`h-full rounded-full ${scoreBarAccent(item.score)}`}
                        style={{ width: `${clampScore(item.score)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 space-y-1 text-sm">
                <p>
                  <span className="font-medium">Alignment:</span>{" "}
                  {analysisResult.visualReview.analysis.layoutFeedback.alignment}
                </p>
                <p>
                  <span className="font-medium">Hierarchy:</span>{" "}
                  {analysisResult.visualReview.analysis.layoutFeedback.hierarchy}
                </p>
                <p>
                  <span className="font-medium">Whitespace:</span>{" "}
                  {analysisResult.visualReview.analysis.layoutFeedback.whitespace}
                </p>
                <p>
                  <span className="font-medium">Scanability:</span>{" "}
                  {analysisResult.visualReview.analysis.layoutFeedback.scanability}
                </p>
              </div>

              {analysisResult.visualReview.analysis.topFixes.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {analysisResult.visualReview.analysis.topFixes
                    .slice(0, 3)
                    .map((fix, index) => (
                      <li
                        key={`${fix.priority}-${fix.fix}-${index}`}
                        className={`rounded-md border p-2 dark:border-gray-700 ${priorityAccent(
                          fix.priority,
                        )}`}
                      >
                        <p className="text-xs uppercase tracking-wide">
                          {fix.priority} priority
                        </p>
                        <p className="font-medium">{fix.fix}</p>
                        <p className="text-sm">{fix.reason}</p>
                      </li>
                    ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950 md:mt-4 md:rounded-xl md:p-4">
            <h3 className="font-semibold">Prioritized Action Items</h3>
            {analysisResult.analysis.actionItems.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {analysisResult.analysis.actionItems.map((item, index) => (
                  <li
                    key={`${item.priority}-${item.title}-${index}`}
                    className={`rounded-md border p-2 dark:border-gray-700 md:p-2.5 ${priorityAccent(
                      item.priority,
                    )}`}
                  >
                    <p className="text-xs uppercase tracking-wide">
                      {item.priority} priority
                    </p>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm">{item.details}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-gray-600 dark:text-gray-300">
                No action items were returned.
              </p>
            )}
          </div>
        </div>
      ) : null}

        <div className="mt-5 flex flex-col items-start gap-2 md:mt-6 md:flex-row md:items-center md:justify-between md:gap-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Upload a file, provide a prompt, or use both for best results.
          </p>
          <Button type="submit" disabled={isSubmitting} color="dark">
            {isSubmitting ? "Analyzing..." : "Analyze Resume"}
          </Button>
        </div>
      </form>

      {isSubmitting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
          <div className="rounded-2xl border border-slate-700 bg-slate-900/90 px-6 py-5 text-center shadow-2xl">
            <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-indigo-300/40 border-t-indigo-400" />
            <p className="text-sm font-medium text-slate-100">
              Running ATS analysis...
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Please wait. Inputs are temporarily locked.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
