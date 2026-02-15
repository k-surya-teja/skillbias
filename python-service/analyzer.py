from __future__ import annotations

from dataclasses import dataclass
from typing import Any
import numpy as np
import pdfplumber


@dataclass
class ResumeMetrics:
    fontConsistency: float
    alignmentScore: float
    spacingScore: float
    detectedSkills: list[str]
    experienceYears: float


SKILL_KEYWORDS = {
    "python",
    "javascript",
    "typescript",
    "react",
    "node.js",
    "node",
    "mongodb",
    "sql",
    "fastapi",
    "aws",
    "docker",
    "kubernetes",
}


def _normalize_100(value: float) -> float:
    return max(0.0, min(100.0, float(value)))


def analyze_resume(path: str) -> dict[str, Any]:
    font_sizes: list[float] = []
    left_margins: list[float] = []
    line_spacings: list[float] = []
    all_text = ""

    with pdfplumber.open(path) as pdf:
      for page in pdf.pages:
        words = page.extract_words(use_text_flow=True, keep_blank_chars=False)
        if words:
          left_margins.extend(float(word.get("x0", 0.0)) for word in words)

        chars = page.chars or []
        if chars:
          font_sizes.extend(float(ch.get("size", 0.0)) for ch in chars if ch.get("size"))

        page_text = page.extract_text() or ""
        all_text += f"\n{page_text}"

        lines = (page.extract_text_lines() or [])
        y_positions = [float(line.get("top", 0.0)) for line in lines if "top" in line]
        if len(y_positions) > 1:
          diffs = np.diff(sorted(y_positions))
          line_spacings.extend(float(v) for v in diffs if v > 0)

    font_consistency = 75.0
    if font_sizes:
      std = float(np.std(font_sizes))
      font_consistency = _normalize_100(100 - std * 8)

    alignment_score = 70.0
    if left_margins:
      std = float(np.std(left_margins))
      alignment_score = _normalize_100(100 - std * 2.5)

    spacing_score = 70.0
    if line_spacings:
      std = float(np.std(line_spacings))
      spacing_score = _normalize_100(100 - std * 12)

    lower_text = all_text.lower()
    detected_skills = sorted([skill for skill in SKILL_KEYWORDS if skill in lower_text])

    # Heuristic extraction of years like "5 years" or "3+ years".
    years = []
    import re

    for match in re.findall(r"(\d{1,2})\s*\+?\s*years?", lower_text):
      try:
        years.append(float(match))
      except ValueError:
        continue
    experience_years = max(years) if years else 0.0

    metrics = ResumeMetrics(
      fontConsistency=round(font_consistency, 2),
      alignmentScore=round(alignment_score, 2),
      spacingScore=round(spacing_score, 2),
      detectedSkills=detected_skills,
      experienceYears=round(experience_years, 2),
    )
    return metrics.__dict__
