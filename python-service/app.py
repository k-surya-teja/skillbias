from __future__ import annotations

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from tempfile import NamedTemporaryFile
import os

from analyzer import analyze_resume

app = FastAPI(title="SkillBias Resume Analyzer", version="1.0.0")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/analyze")
async def analyze(resume: UploadFile = File(...)) -> JSONResponse:
    if resume.content_type not in {"application/pdf", "application/octet-stream"}:
        raise HTTPException(status_code=400, detail="Only PDF resumes are supported")

    with NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        content = await resume.read()
        tmp.write(content)
        temp_path = tmp.name

    try:
        metrics = analyze_resume(temp_path)
        return JSONResponse(content=metrics)
    except Exception as error:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Analysis failed: {error}") from error
    finally:
        if os.path.exists(temp_path):
            os.unlink(temp_path)
