# SkillBias

SkillBias is an AI-powered applicant tracking system (ATS) that helps organizations screen candidates objectively. It combines AI content analysis (via Groq) with automated resume layout scoring to produce fair, bias-reduced candidate rankings.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, Flowbite React |
| Backend | Express.js, MongoDB, Mongoose, Socket.IO |
| Resume Analyzer | Python FastAPI, pdfjs-dist |
| AI Scoring | Groq SDK (LLM-based candidate evaluation) |
| Auth | JWT (email/password + Google OAuth) |
| Containerization | Docker, Docker Compose |

## Project Structure

```
skillbias/
├── src/                    # Next.js frontend
│   ├── app/                # App Router pages
│   │   ├── org/            # Organization dashboard, jobs, login
│   │   ├── apply/          # Public job application page
│   │   ├── jobs/           # Public job listings
│   │   └── api/            # API routes (resume analysis)
│   ├── components/         # Reusable UI components
│   ├── contexts/           # React contexts (Auth, Sidebar)
│   └── lib/                # Utilities, ATS client, resume analysis
├── backend/                # Express.js API server
│   └── src/
│       ├── controllers/    # Route handlers
│       ├── models/         # Mongoose schemas
│       ├── routes/         # API route definitions
│       └── services/       # Scoring, resume analysis services
├── python-service/         # FastAPI resume layout analyzer
├── docker-compose.yml      # Orchestrates all services
├── Dockerfile              # Frontend Docker image
├── backend/Dockerfile      # Backend Docker image
└── python-service/Dockerfile  # Python service Docker image
```

## Quick Start (Docker)

The easiest way to run the full stack with a single command:

```bash
# Set your Groq API key (required for AI scoring)
export GROQ_API_KEY=your_groq_api_key

# Start all services
npm run docker:up
```

This spins up four containers:

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | Next.js app |
| Backend | http://localhost:4000 | Express API |
| Python Analyzer | http://localhost:8001 | Resume layout analyzer |
| MongoDB | localhost:27017 | Database |

To stop everything:

```bash
npm run docker:down
```

## Manual Local Setup

### Prerequisites

- Node.js 20+
- Python 3.11+
- MongoDB (running locally or via Docker)

### 1. Frontend

```bash
npm install
npm run dev
```

Runs at http://localhost:3000

### 2. Backend

```bash
cd backend
npm install
npm run dev
```

Runs at http://localhost:4000

### 3. Python Resume Analyzer

```bash
cd python-service
python3 -m venv .venv
source .venv/bin/activate
pip3 install -r requirements.txt
python3 -m uvicorn app:app --reload --port 8001
```

Runs at http://localhost:8001

### 4. MongoDB

```bash
docker run -d -p 27017:27017 mongo:7
```

## Environment Variables

### Frontend (`.env`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_ATS_API_BASE_URL` | Backend API URL (default: `http://localhost:4000`) |
| `GROQ_API_KEY` | Groq API key for resume analysis route |

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: `4000`) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `JWT_EXPIRES_IN` | Token expiry (e.g., `7d`) |
| `GROQ_API_KEY` | Groq API key for AI candidate scoring |
| `PYTHON_ANALYZER_URL` | Python analyzer endpoint (default: `http://localhost:8001/analyze`) |
| `FRONTEND_ORIGIN` | Frontend URL for CORS (default: `http://localhost:3000`) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `UPLOADS_DIR` | Resume upload directory (default: `uploads/resumes`) |

## API Routes

### Authentication

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/auth/signup` | Organization signup |
| POST | `/auth/login` | Organization login |
| POST | `/auth/google` | Google OAuth login |
| GET | `/auth/me` | Get current organization |

### Job Management (authenticated)

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/jobs/create` | Create a new job |
| GET | `/jobs` | List organization's jobs |
| GET | `/jobs/:id` | Get job details |
| PUT | `/jobs/:id` | Update job |
| DELETE | `/jobs/:id` | Delete job |
| GET | `/jobs/:id/applications` | List applications for a job |
| GET | `/jobs/:id/export` | Export applications as CSV |

### Public

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/public/apply/:jobId` | Get job details for application |
| POST | `/public/apply/:jobId` | Submit application with resume |
| GET | `/public/jobs` | List public job listings |

## How Scoring Works

Each candidate receives a score from 0 to 100 based on two components:

1. **AI Content Score** (via Groq) -- evaluates resume content against job requirements
2. **Resume Layout Score** (via Python analyzer) -- evaluates formatting consistency, alignment, and spacing

These are combined using a weighted formula in `backend/src/services/scoringService.ts`. If the Python analyzer is unavailable, the system falls back to default layout metrics so scoring still works.

## Notes

- One email can apply only once per job (unique index on `jobId` + `email`).
- First job post is free; additional posts require `plan=pro`.
- Jobs auto-close when `endDate` passes (checked during dashboard/jobs reads).
- Resume uploads are stored in `uploads/resumes/`.
- Real-time dashboard updates use Socket.IO.
