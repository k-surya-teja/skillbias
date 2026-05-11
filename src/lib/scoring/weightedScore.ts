import type { ResumeMetrics, ScoringWeights } from "./types";

const DEFAULT_WEIGHTS: ScoringWeights = { skills: 40, experience: 25, format: 15, answers: 20 };

function normalizeWeights(weights: Partial<ScoringWeights> | null | undefined): ScoringWeights {
  const s = Number(weights?.skills) || 0;
  const e = Number(weights?.experience) || 0;
  const f = Number(weights?.format) || 0;
  const a = Number(weights?.answers) || 0;
  const total = s + e + f + a;
  if (total <= 0 || !Number.isFinite(total)) return DEFAULT_WEIGHTS;
  return {
    skills: (s / total) * 100,
    experience: (e / total) * 100,
    format: (f / total) * 100,
    answers: (a / total) * 100,
  };
}

export function computeWeightedScore(input: {
  aiScore: number;
  resumeMetrics: ResumeMetrics;
  weights: Partial<ScoringWeights> | null | undefined;
  answerQualityScore?: number;
}): number {
  const weights = normalizeWeights(input.weights);
  const skillsComponent = input.aiScore * (weights.skills / 100);
  const experienceComponent =
    Math.min(input.resumeMetrics.experienceYears * 10, 100) * (weights.experience / 100);
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
