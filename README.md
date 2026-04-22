# AI Medical Assist

AI Medical Assist is a full-stack healthcare assistant with role-based dashboards, AI chat and voice support, report analysis, and PDF summary generation.

## Core Features

- Patient, doctor, and admin authentication with JWT.
- AI chat for symptom/intake conversations.
- Voice conversation flow (speech-to-text + text-to-speech).
- Upload and analyze lab/report files (including OCR fallback for scanned PDFs).
- Auto-generated medical summaries and downloadable PDFs.
- Appointment discovery, slot booking, and doctor portal views.
- Vitals tracking and historical report access.

## Tech Stack

- Backend: FastAPI, SQLAlchemy, Pydantic, PostgreSQL/SQLite.
- Frontend: React (Vite), React Router, Axios, Tailwind CSS.
- AI providers:
  - Groq for LLM completions and report synthesis.
  - Deepgram for transcription and speech synthesis.
- Infra: Docker Compose (frontend + backend + postgres).

## Repository Structure

- `backend/` - FastAPI service, routers, agents, services, database models.
- `frontend/` - React app with role-specific dashboards.
- `docker-compose.yml` - Multi-container local/dev deployment.
- `start.sh` - Build (no cache) and start containers.
- `stop.sh` - Stop containers and prune Docker resources.
- `.env.example` - Environment variable template.

## Prerequisites

- Docker + Docker Compose (recommended path).
- Or for local non-docker runs:
  - Python 3.10+
  - Node.js 20+

## Environment Setup

1. Copy `.env.example` to `.env`.
2. Fill required secrets:
   - `JWT_SECRET`
   - `GROQ_API_KEY`
   - `DEEPGRAM_API_KEY` (if using voice features)
3. Optionally set startup admin credentials:
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`

## Run With Docker (Recommended)

```bash
./start.sh
```

This starts:

- Frontend at `http://localhost:8080`
- Backend API at `http://localhost:8000`
- Postgres at `localhost:5432`

Health check:

```bash
curl http://localhost:8000/api/health
```

Stop and clean:

```bash
./stop.sh
```

## Local Development (Without Docker)

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Set frontend API URL (if needed) using `VITE_API_URL`.

## Main API Areas

- `/api/auth` - Register, login, current user.
- `/api/chat` - Chat sessions, messages, and report-analysis chat.
- `/api/voice` - Voice turn and TTS endpoints.
- `/api/reports` - Generated reports and upload analysis.
- `/api/labs` - Lab analysis history and PDFs.
- `/api/appointments` - Doctor discovery, slots, booking.
- `/api/vitals` - Patient vital metrics.
- `/api/admin` - Admin functionality.
- `/api/doctor-portal` - Doctor-facing data and workflows.

## Notes

- On startup, the backend seeds demo doctors and appointment slots.
- Uploaded files and generated PDFs are stored under `data/`.
- Docker backend uses PostgreSQL; local default can use SQLite unless overridden by `DATABASE_URL`.

