import { JobScoringWeights } from "../types/index.js";
import { ResumeMetrics } from "./resumeAnalyzerService.js";

function normalizeWeights(weights: JobScoringWeights): JobScoringWeights {
  const total = weights.skills + weights.experience + weights.format + weights.answers;
  if (total <= 0) {
    return { skills: 40, experience: 25, format: 15, answers: 20 };
  }
  return {
    skills: (weights.skills / total) * 100,
    experience: (weights.experience / total) * 100,
    format: (weights.format / total) * 100,
    answers: (weights.answers / total) * 100,
  };
}

export function computeWeightedScore(input: {
  aiScore: number;
  resumeMetrics: ResumeMetrics;
  weights: JobScoringWeights;
  answerQualityScore?: number;
}): number {
  const weights = normalizeWeights(input.weights);
  const skillsComponent = input.aiScore * (weights.skills / 100);
  const experienceComponent = Math.min(input.resumeMetrics.experienceYears * 10, 100) * (weights.experience / 100);
  const formatRaw =
    (input.resumeMetrics.fontConsistency +
      input.resumeMetrics.alignmentScore +
      input.resumeMetrics.spacingScore) /
    3;
  const formatComponent = formatRaw * (weights.format / 100);
  const answersComponent = (input.answerQualityScore ?? 60) * (weights.answers / 100);
  const total = skillsComponent + experienceComponent + formatComponent + answersComponent;
  return Math.round(Math.max(0, Math.min(100, total)));
}
