# Layout Analyzer Service

Local FastAPI microservice for resume formatting detection using `pdfplumber`.

## What it detects

- Font consistency
- Alignment consistency
- Spacing consistency
- Composite formatting score

## Run locally

```bash
cd services/layout_analyzer
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8001
```

The Node backend expects the endpoint at:

- `http://127.0.0.1:8001/analyze`

Override with:

- `LAYOUT_ANALYZER_URL`

## API

`POST /analyze` (multipart form-data)

- field: `resume` (PDF file)

Response shape:

```json
{
  "pageCount": 1,
  "scores": {
    "fontConsistency": 84,
    "alignment": 79,
    "spacing": 81,
    "formatting": 81
  },
  "metrics": {
    "dominantFont": "Calibri",
    "dominantFontSize": 11,
    "fontVarietyCount": 2,
    "leftMarginVariance": 5.2,
    "lineGapVariance": 1.9
  },
  "signals": {
    "font": {},
    "alignment": {},
    "spacing": {}
  }
}
```
