# NetConfigAI

NetConfigAI is an enterprise-style AI network configuration review platform. It compares old and new network/cloud configuration files, detects risky changes, calculates a risk score, generates AI-assisted analysis, and routes changes through a manager approval workflow.

## Highlights

- AI-assisted network configuration diff review
- Ollama-first local AI analysis
- Optional Gemini API support
- Google OAuth authorization-code login
- Email/password authentication with JWT
- Role-based access control for Network Engineers, Managers, and Admins
- Review approval/rejection workflow
- Compliance and audit views
- Report generation
- Docker Compose deployment

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite, Material UI |
| Backend | FastAPI, Python |
| Database | PostgreSQL |
| Queue/Broker | Redis, Celery |
| AI | Ollama default, Gemini optional |
| Auth | JWT, Google OAuth |
| Deployment | Docker Compose, Nginx |

## Local Setup

1. Copy environment example:

```bash
copy .env.example .env
```

2. Add optional secrets to `.env`:

```env
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GEMINI_API_KEY=""
```

3. Start the application:

```bash
docker compose up -d --build
```

4. Open:

```text
Frontend: http://localhost:3000
Backend API docs: http://localhost:8000/api/docs
Health check: http://localhost:8000/health/ready
```

## Google OAuth Configuration

Use these values in Google Cloud Console:

```text
Authorized JavaScript origins:
http://localhost:3000

Authorized redirect URIs:
http://localhost:8000/auth/google/callback
```

## Roles

| Role | Purpose |
|---|---|
| Network Engineer | Upload configs, run analysis, submit for approval |
| Manager | Review, approve, reject, and manage submitted changes |
| Admin | Full administrative access |

## Verification

Frontend build:

```bash
cd frontend
npm install
npm run build
```

Backend syntax check:

```bash
cd backend
python -m compileall app
```

Backend tests, when Docker is running:

```bash
docker compose exec backend pytest tests -q
```

## Security Notes

- Do not commit `.env`.
- Keep Google OAuth secrets and Gemini API keys outside source control.
- Ollama is the default provider for privacy-friendly local analysis.
- Gemini is optional and should be enabled only when cloud AI processing is acceptable.

