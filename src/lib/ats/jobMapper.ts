import type { ApplicationRow, JobRow } from "@/lib/supabase/types";
import type { Application, Job } from "./types";

export function dbJobToJob(row: JobRow): Job {
  return {
    _id: row.id,
    title: row.title,
    description: row.description,
    requirements: row.requirements,
    requiredSkills: row.required_skills,
    endDate: row.end_date,
    formFields: row.form_fields,
    scoringWeights: row.scoring_weights,
    status: row.status,
    isPublic: row.is_public,
    applyLink: row.apply_link,
  };
}

export function dbAppToApplication(row: ApplicationRow): Application {
  return {
    _id: row.id,
    email: row.email,
    answers: row.answers,
    // Wrap the storage path so the UI can use it as a clickable link — the
    // /api/resumes/download route checks ownership and redirects to a signed URL.
    resumeUrl: row.resume_url
      ? `/api/resumes/download?path=${encodeURIComponent(row.resume_url)}`
      : "",
    resumeAnalysis: row.resume_analysis,
    score: Number(row.score),
    aiFeedback: row.ai_feedback,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
  };
}
