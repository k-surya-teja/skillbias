import fs from "node:fs/promises";
import { env } from "../config/env.js";

export type ResumeMetrics = {
  fontConsistency: number;
  alignmentScore: number;
  spacingScore: number;
  detectedSkills: string[];
  experienceYears: number;
};

export async function analyzeResumeFile(filePath: string): Promise<ResumeMetrics> {
  const formData = new FormData();
  const fileBuffer = await fs.readFile(filePath);
  const blob = new Blob([fileBuffer], { type: "application/pdf" });
  formData.append("resume", blob, "resume.pdf");

  const response = await fetch(env.PYTHON_ANALYZER_URL, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Resume analyzer failed with ${response.status}`);
  }

  return (await response.json()) as ResumeMetrics;
}
