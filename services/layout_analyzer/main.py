from __future__ import annotations

from collections import Counter
from statistics import median, pstdev
from typing import Any
import io
import math
import re

import pdfplumber
from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel


app = FastAPI(title="Resume Layout Analyzer", version="1.0.0")


class ScoreBlock(BaseModel):
    fontConsistency: int
    alignment: int
    spacing: int
    formatting: int


class LayoutMetrics(BaseModel):
    dominantFont: str
    dominantFontSize: float
    fontVarietyCount: int
    leftMarginVariance: float
    lineGapVariance: float


class LayoutAnalysisResponse(BaseModel):
    pageCount: int
    scores: ScoreBlock
    metrics: LayoutMetrics
    signals: dict[str, Any]


def _clamp_score(value: float) -> int:
    return int(max(0, min(100, round(value))))


def _normalize_font_name(font_name: str) -> str:
    cleaned = (font_name or "").strip()
    if not cleaned:
        return "Unknown"
    # Common PDFs embed subset prefixes like "ABCDEE+Calibri"
    cleaned = re.sub(r"^[A-Z]{6}\+", "", cleaned)
    return cleaned


def _line_gaps_from_words(words: list[dict[str, Any]]) -> list[float]:
    if not words:
        return []

    line_tops = sorted(float(word.get("top", 0.0)) for word in words)
    if len(line_tops) < 2:
        return []
    return [line_tops[i + 1] - line_tops[i] for i in range(len(line_tops) - 1)]


def _analyze_font(chars: list[dict[str, Any]]) -> tuple[int, dict[str, Any]]:
    if not chars:
        return 0, {
            "dominantFont": "Unknown",
            "dominantSize": 0.0,
            "fontCounts": {},
            "sizeCounts": {},
        }

    font_counter: Counter[str] = Counter()
    size_counter: Counter[str] = Counter()

    for ch in chars:
        font_name = _normalize_font_name(str(ch.get("fontname", "")))
        font_counter[font_name] += 1
        size = float(ch.get("size", 0.0))
        size_counter[f"{size:.1f}"] += 1

    total_chars = sum(font_counter.values()) or 1
    dominant_font, dominant_font_count = font_counter.most_common(1)[0]
    dominant_size = float(size_counter.most_common(1)[0][0]) if size_counter else 0.0
    dominant_ratio = dominant_font_count / total_chars

    variety_penalty = max(0, len(font_counter) - 2) * 8
    size_penalty = max(0, len(size_counter) - 3) * 6
    font_score = _clamp_score(dominant_ratio * 100 - variety_penalty - size_penalty)

    return font_score, {
        "dominantFont": dominant_font,
        "dominantSize": dominant_size,
        "fontCounts": dict(font_counter.most_common(8)),
        "sizeCounts": dict(size_counter.most_common(8)),
    }


def _analyze_alignment(
    words: list[dict[str, Any]], page_widths: list[float]
) -> tuple[int, dict[str, Any]]:
    if not words:
        return 0, {"leftVariance": 0.0, "leftAlignedRatio": 0.0, "centeredRatio": 0.0}

    left_edges = [float(word.get("x0", 0.0)) for word in words]
    median_left = median(left_edges)
    deviations = [abs(x - median_left) for x in left_edges]
    left_variance = pstdev(left_edges) if len(left_edges) > 1 else 0.0
    left_aligned_ratio = (
        sum(1 for d in deviations if d <= 12.0) / len(deviations) if deviations else 0.0
    )

    centered_hits = 0
    centered_total = 0
    per_page_width: dict[int, float] = {
        idx + 1: width for idx, width in enumerate(page_widths)
    }
    for word in words:
        page_number = int(word.get("page_number", 1))
        width = per_page_width.get(page_number, page_widths[0] if page_widths else 600.0)
        x0 = float(word.get("x0", 0.0))
        x1 = float(word.get("x1", x0))
        x_mid = (x0 + x1) / 2
        centered_total += 1
        if abs(x_mid - (width / 2)) <= 20:
            centered_hits += 1

    centered_ratio = centered_hits / centered_total if centered_total else 0.0
    alignment_score = _clamp_score(
        left_aligned_ratio * 100 - min(35.0, left_variance / 2.2) + centered_ratio * 8
    )

    return alignment_score, {
        "leftVariance": round(left_variance, 2),
        "leftAlignedRatio": round(left_aligned_ratio, 3),
        "centeredRatio": round(centered_ratio, 3),
    }


def _analyze_spacing(words: list[dict[str, Any]]) -> tuple[int, dict[str, Any]]:
    gaps = _line_gaps_from_words(words)
    normalized_gaps = [gap for gap in gaps if 2.0 <= gap <= 48.0]

    if not normalized_gaps:
        return 0, {"medianGap": 0.0, "gapVariance": 0.0, "lineCount": 0}

    median_gap = median(normalized_gaps)
    gap_variance = pstdev(normalized_gaps) if len(normalized_gaps) > 1 else 0.0

    consistency_penalty = min(40.0, gap_variance * 3.2)
    density_penalty = 0.0
    if median_gap < 7.0:
        density_penalty = (7.0 - median_gap) * 5
    elif median_gap > 18.0:
        density_penalty = min(20.0, (median_gap - 18.0) * 2)

    spacing_score = _clamp_score(92.0 - consistency_penalty - density_penalty)
    return spacing_score, {
        "medianGap": round(float(median_gap), 2),
        "gapVariance": round(float(gap_variance), 2),
        "lineCount": len(normalized_gaps) + 1,
    }


@app.post("/analyze", response_model=LayoutAnalysisResponse)
async def analyze_resume_layout(resume: UploadFile = File(...)) -> LayoutAnalysisResponse:
    filename = (resume.filename or "").lower()
    if not filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    payload = await resume.read()
    if not payload:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        with pdfplumber.open(io.BytesIO(payload)) as pdf:
            chars: list[dict[str, Any]] = []
            words: list[dict[str, Any]] = []
            page_widths: list[float] = []

            for page_index, page in enumerate(pdf.pages, start=1):
                page_widths.append(float(page.width))
                page_chars = page.chars or []
                chars.extend(page_chars)

                page_words = page.extract_words(
                    x_tolerance=2,
                    y_tolerance=2,
                    keep_blank_chars=False,
                ) or []
                for word in page_words:
                    word["page_number"] = page_index
                words.extend(page_words)

            if not pdf.pages:
                raise HTTPException(status_code=422, detail="PDF has no pages.")

            font_score, font_signals = _analyze_font(chars)
            alignment_score, alignment_signals = _analyze_alignment(words, page_widths)
            spacing_score, spacing_signals = _analyze_spacing(words)

            formatting_score = _clamp_score(
                font_score * 0.38 + alignment_score * 0.34 + spacing_score * 0.28
            )

            return LayoutAnalysisResponse(
                pageCount=len(pdf.pages),
                scores=ScoreBlock(
                    fontConsistency=font_score,
                    alignment=alignment_score,
                    spacing=spacing_score,
                    formatting=formatting_score,
                ),
                metrics=LayoutMetrics(
                    dominantFont=font_signals["dominantFont"],
                    dominantFontSize=float(font_signals["dominantSize"]),
                    fontVarietyCount=len(font_signals["fontCounts"]),
                    leftMarginVariance=float(alignment_signals["leftVariance"]),
                    lineGapVariance=float(spacing_signals["gapVariance"]),
                ),
                signals={
                    "font": font_signals,
                    "alignment": alignment_signals,
                    "spacing": spacing_signals,
                },
            )
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=422,
            detail=f"Unable to parse PDF layout: {exc}",
        ) from exc

