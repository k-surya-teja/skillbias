import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { analyzeResumeOrFallback } from "@/lib/scoring/resumeAnalyzer";
import { scoreWithProvider, scoreWithSkillbiasDefault } from "@/lib/scoring/aiProviders";
import { computeWeightedScore } from "@/lib/scoring/weightedScore";
import {
  AiProviderError,
  type AiProvider,
  type AiScoringConfig,
  type ScoringInput,
} from "@/lib/scoring/types";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_RESUME_BYTES = 5 * 1024 * 1024; // 5 MB

// ----------------------------------------------------------------------------
// GET — fetch the job for the public apply form
// ----------------------------------------------------------------------------
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  if (!jobId || !UUID_REGEX.test(jobId)) {
    return NextResponse.json({ message: "Job not found" }, { status: 404 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: job, error } = await supabase
    .from("jobs")
    .select("id, title, description, requirements, required_skills, form_fields, end_date, status")
    .eq("apply_link", `/apply/${jobId}`)
    .single();

  if (error || !job) {
    return NextResponse.json({ message: "Job not found" }, { status: 404 });
  }
  if (job.status !== "active") {
    return NextResponse.json(
      { message: "This application form has expired. Better luck next time." },
      { status: 410 },
    );
  }

  return NextResponse.json({
    job: {
      _id: job.id,
      title: job.title,
      description: job.description,
      requirements: job.requirements,
      requiredSkills: job.required_skills,
      formFields: job.form_fields,
      endDate: job.end_date,
      status: job.status,
    },
  });
}

// ----------------------------------------------------------------------------
// POST — submit application (with inline scoring)
// ----------------------------------------------------------------------------
export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  if (!jobId || !UUID_REGEX.test(jobId)) {
    return NextResponse.json({ message: "Job not found" }, { status: 404 });
  }

  const supabase = createSupabaseAdminClient();

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ message: "Invalid form submission" }, { status: 400 });
  }

  const emailRaw = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    return NextResponse.json({ message: "A valid email is required" }, { status: 400 });
  }

  let answers: Record<string, unknown> = {};
  const answersRaw = formData.get("answers");
  if (typeof answersRaw === "string" && answersRaw.length > 0) {
    try {
      const parsed = JSON.parse(answersRaw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        answers = parsed as Record<string, unknown>;
      } else {
        return NextResponse.json({ message: "answers must be a JSON object" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ message: "answers must be valid JSON" }, { status: 400 });
    }
  }

  const resume = formData.get("resume");
  if (!(resume instanceof File) || resume.size === 0) {
    return NextResponse.json({ message: "Resume file is required" }, { status: 400 });
  }
  if (resume.size > MAX_RESUME_BYTES) {
    return NextResponse.json({ message: "Resume must be under 5 MB" }, { status: 413 });
  }

  const { data: job, error: jobErr } = await supabase
    .from("jobs")
    .select(
      "id, org_id, requirements, required_skills, scoring_weights, status",
    )
    .eq("apply_link", `/apply/${jobId}`)
    .single();

  if (jobErr || !job) {
    return NextResponse.json({ message: "Job not found" }, { status: 404 });
  }
  if (job.status !== "active") {
    return NextResponse.json(
      { message: "This application form has expired. Better luck next time." },
      { status: 410 },
    );
  }

  // Upload to Storage (path: <jobUuid>/<random>-<sanitizedName>)
  const safeName = resume.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const storagePath = `${job.id}/${crypto.randomUUID()}-${safeName}`;
  const buffer = await resume.arrayBuffer();

  const { error: uploadErr } = await supabase.storage
    .from("resumes")
    .upload(storagePath, buffer, {
      contentType: resume.type || "application/pdf",
      upsert: false,
    });
  if (uploadErr) {
    return NextResponse.json({ message: `Upload failed: ${uploadErr.message}` }, { status: 500 });
  }

  // Insert pending application. Unique (job_id, lower(email)) catches duplicates.
  const { data: inserted, error: insertErr } = await supabase
    .from("applications")
    .insert({
      job_id: job.id,
      email: emailRaw,
      answers,
      resume_url: storagePath,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    if (insertErr?.code === "23505") {
      return NextResponse.json(
        { message: "This email has already applied for this job" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { message: insertErr?.message ?? "Application failed" },
      { status: 500 },
    );
  }
  const applicationId = inserted.id;

  // ----- Scoring (inline; multi-agent will move this to a background flow in Phase 5) -----
  try {
    const resumeBlob = new Blob([buffer], { type: resume.type || "application/pdf" });
    const { metrics: resumeMetrics, usedFallback } = await analyzeResumeOrFallback(resumeBlob);

    const { data: orgRow } = await supabase
      .from("organizations")
      .select(
        "ai_provider, ai_model, ai_api_key, ai_custom_url, ai_custom_auth_header, auto_shortlist_enabled, auto_shortlist_threshold, auto_reject_enabled, auto_reject_threshold",
      )
      .eq("user_id", job.org_id)
      .single();

    const aiConfig: AiScoringConfig = {
      provider: (orgRow?.ai_provider as AiProvider) ?? "skillbias",
      model: orgRow?.ai_model ?? "",
      apiKey: orgRow?.ai_api_key ?? "",
      customUrl: orgRow?.ai_custom_url ?? "",
      customAuthHeader: orgRow?.ai_custom_auth_header ?? "",
    };

    const scoringInput: ScoringInput = {
      requirements: job.requirements ?? "",
      requiredSkills: job.required_skills ?? [],
      resumeMetrics,
    };

    let aiResult;
    let providerFallbackNote = "";
    try {
      aiResult = await scoreWithProvider(aiConfig, scoringInput);
    } catch (providerErr) {
      if (providerErr instanceof AiProviderError && aiConfig.provider !== "skillbias") {
        providerFallbackNote = `Your configured AI provider (${aiConfig.provider}) failed: ${providerErr.originalMessage}. Used SkillBias default scoring instead.`;
        aiResult = await scoreWithSkillbiasDefault(scoringInput);
      } else {
        throw providerErr;
      }
    }

    const finalScore = computeWeightedScore({
      aiScore: aiResult.score,
      resumeMetrics,
      weights: job.scoring_weights as
        | { skills: number; experience: number; format: number; answers: number }
        | null,
    });

    let feedback = aiResult.feedback;
    if (usedFallback) {
      feedback +=
        "\n\n(Note: Resume layout analysis was unavailable. Score is based on AI content review only.)";
    }
    if (providerFallbackNote) feedback += `\n\n(Note: ${providerFallbackNote})`;

    let autoStatus: "applied" | "shortlisted" | "rejected" = "applied";
    if (orgRow?.auto_shortlist_enabled && finalScore >= (orgRow.auto_shortlist_threshold ?? 100)) {
      autoStatus = "shortlisted";
    } else if (orgRow?.auto_reject_enabled && finalScore <= (orgRow.auto_reject_threshold ?? 0)) {
      autoStatus = "rejected";
    }

    await supabase
      .from("applications")
      .update({
        resume_analysis: resumeMetrics,
        score: finalScore,
        ai_feedback: feedback,
        status: autoStatus,
      })
      .eq("id", applicationId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scoring failed";
    console.error("[publicApply] scoring failed:", message);
    await supabase
      .from("applications")
      .update({
        score: 0,
        ai_feedback: `Scoring could not be completed. (${message}) You can still review this application manually.`,
        status: "applied",
      })
      .eq("id", applicationId);
  }

  return NextResponse.json(
    { applicationId, message: "Application received." },
    { status: 201 },
  );
}
