import { describe, expect, it } from "vitest";
import { computeWeightedScore } from "./scoringService.js";

describe("computeWeightedScore", () => {
  it("returns a bounded 0-100 score", () => {
    const result = computeWeightedScore({
      aiScore: 92,
      resumeMetrics: {
        fontConsistency: 80,
        alignmentScore: 75,
        spacingScore: 78,
        detectedSkills: ["typescript", "node"],
        experienceYears: 4,
      },
      weights: {
        skills: 40,
        experience: 25,
        format: 15,
        answers: 20,
      },
      answerQualityScore: 70,
    });

    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(100);
  });
});
