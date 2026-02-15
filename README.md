# SkillBias

SkillBias is a Next.js App Router frontend with a modular ATS backend stack:

- Next.js frontend (`src/`)
- Express + MongoDB ATS API (`backend/`)
- Python FastAPI resume analyzer (`python-service/`)

## Local Setup

### 1) Frontend (Next.js)

```bash
npm install
npm run dev
```

Frontend runs at `http://localhost:3000`.

### 2) ATS Backend (Express)

```bash
cd backend
npm install
npm run dev
```

Backend runs at `http://localhost:4000`.

### 3) Python Resume Analyzer

```bash
cd python-service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8001
```

Analyzer runs at `http://127.0.0.1:8001`.

## Environment Variables

Copy the example files and fill values:

- Root frontend: `.env.example`
- Backend: `backend/.env.example`
- Python service: `python-service/.env.example`

Key variables:

- `NEXT_PUBLIC_ATS_API_BASE_URL` (frontend -> backend URL)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (frontend Clerk auth)
- `GROQ_API_KEY` (backend AI scoring)
- `MONGODB_URI` (backend DB connection)
- `JWT_SECRET` (backend auth)
- `CLERK_SECRET_KEY` (backend Clerk token verification)
- `PYTHON_ANALYZER_URL` (backend -> python analyzer URL)

## ATS Routes

Organization auth:

- `POST /auth/signup`
- `POST /auth/login`
- `GET /auth/me`

Job management:

- `POST /jobs/create`
- `GET /jobs`
- `GET /jobs/:id`
- `PUT /jobs/:id`
- `DELETE /jobs/:id`
- `GET /jobs/:id/applications`
- `GET /jobs/:id/export`

Public application:

- `GET /public/apply/:jobId`
- `POST /public/apply/:jobId`

## Notes

- One email can apply only once per job (`Application(jobId, email)` unique index).
- First job post is free; additional posts require `plan=pro`.
- Job auto-close runs during dashboard/jobs read paths when `endDate` has passed.
- Local resume uploads are stored under `uploads/resumes`.
