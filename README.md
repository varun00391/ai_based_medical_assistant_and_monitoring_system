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

## Deploy To Azure (ACR + Container Apps)

Deployment is split into two scripts:

- `scripts/azure_infra.sh`: creates/updates Azure infra only
- `scripts/deploy_app.sh`: builds/pushes images and deploys Container Apps only

### 1) Provision infra

```bash
chmod +x scripts/azure_infra.sh
./scripts/azure_infra.sh
```

Subscription ID is resolved in this order: `AZURE_SUBSCRIPTION_ID` in the environment, optional `AZURE_SUBSCRIPTION_ID` in `.env`, then the current Azure CLI default (`az account show --query id -o tsv`). Run `az login` and, if needed, `az account set --subscription <id-or-name>`.

### 2) Deploy app

```bash
chmod +x scripts/deploy_app.sh
./scripts/deploy_app.sh
```

`deploy_app.sh` reads values from `.env`, stores sensitive keys as Container Apps secrets, and injects non-sensitive keys as normal environment variables. You normally do not need `AZURE_SUBSCRIPTION_ID` in `.env` if your Azure CLI default subscription is correct.

### GitHub Actions orchestration

- `azure-infra.yml`: manual infra provisioning (`workflow_dispatch`)
- `azure-deploy.yml`: auto deploy on push to `main/master` when backend/frontend/deploy files change

Required GitHub Secrets (for OIDC + app secrets):

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `JWT_SECRET`
- `DATABASE_URL`
- `ADMIN_PASSWORD`
- `GROQ_API_KEY`
- `DEEPGRAM_API_KEY` (if voice features enabled)

Required GitHub Variables (infra/app config):

- `AZURE_RESOURCE_GROUP`
- `ACR_NAME`
- `AZURE_CONTAINERAPPS_ENV`
- `BACKEND_IMAGE_NAME`
- `FRONTEND_IMAGE_NAME`
- `BACKEND_CONTAINER_APP`
- `FRONTEND_CONTAINER_APP`
- plus non-secret app config keys from `.env.example`

