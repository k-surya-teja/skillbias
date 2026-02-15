import Groq from "groq-sdk";
import { env } from "../config/env.js";
import { ResumeMetrics } from "./resumeAnalyzerService.js";

const DEFAULT_SCORE = {
  score: 0,
  feedback: "AI scoring unavailable",
};

export async function scoreCandidateWithGroq(input: {
  requirements: string;
  requiredSkills: string[];
  resumeMetrics: ResumeMetrics;
}): Promise<{ score: number; feedback: string }> {
  if (!env.GROQ_API_KEY) {
    return DEFAULT_SCORE;
  }

  const groq = new Groq({ apiKey: env.GROQ_API_KEY });
  const prompt = [
    "You are a recruiter. Score this candidate out of 100 and explain.",
    `Job requirements: ${input.requirements}`,
    `Required skills: ${input.requiredSkills.join(", ")}`,
    `Resume metrics: ${JSON.stringify(input.resumeMetrics)}`,
    'Return only JSON with keys: {"score": number, "feedback": string}',
  ].join("\n");

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    return DEFAULT_SCORE;
  }

  try {
    const parsed = JSON.parse(content) as { score?: unknown; feedback?: unknown };
    const score = typeof parsed.score === "number" ? parsed.score : 0;
    const feedback = typeof parsed.feedback === "string" ? parsed.feedback : DEFAULT_SCORE.feedback;
    return { score: Math.max(0, Math.min(100, score)), feedback };
  } catch {
    return { score: 0, feedback: content };
  }
}
