import { FALLBACK_RESUME_METRICS, type ResumeMetrics } from "./types";

const PYTHON_ANALYZER_URL =
  process.env.PYTHON_ANALYZER_URL ?? "http://localhost:8001/analyze";

// Forwards a resume blob to the Python layout analyzer service. Returns
// deterministic fallback metrics when the service is unreachable so an
// application's scoring still produces a useful number.
export async function analyzeResumeBlob(blob: Blob): Promise<ResumeMetrics> {
  const formData = new FormData();
  formData.append("resume", blob, "resume.pdf");

  const response = await fetch(PYTHON_ANALYZER_URL, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Resume analyzer failed with ${response.status}`);
  }

  return (await response.json()) as ResumeMetrics;
}

export async function analyzeResumeOrFallback(
  blob: Blob,
): Promise<{ metrics: ResumeMetrics; usedFallback: boolean }> {
  try {
    return { metrics: await analyzeResumeBlob(blob), usedFallback: false };
  } catch (err) {
    console.warn(
      "[resumeAnalyzer] Python analyzer unavailable, using fallback metrics:",
      err instanceof Error ? err.message : "unknown error",
    );
    return { metrics: FALLBACK_RESUME_METRICS, usedFallback: true };
  }
}
