from __future__ import annotations

from typing import TypedDict


class ScoreWeights(TypedDict):
    skills: float
    experience: float
    format: float
    answers: float


def weighted_score(
    ai_score: float,
    experience_years: float,
    format_score: float,
    answers_score: float,
    weights: ScoreWeights,
) -> float:
    total = max(weights["skills"] + weights["experience"] + weights["format"] + weights["answers"], 1)
    normalized = {key: value / total for key, value in weights.items()}

    experience_component = min(experience_years * 10.0, 100.0)

    score = (
        ai_score * normalized["skills"]
        + experience_component * normalized["experience"]
        + format_score * normalized["format"]
        + answers_score * normalized["answers"]
    )
    return round(max(0.0, min(100.0, score)), 2)
