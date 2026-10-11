# FinGuard AI

**From fraud alerts to evidence-backed investigations in seconds.**

FinGuard AI is a human-in-the-loop fraud investigation copilot by **TrustForge**, built for the Google Cloud AI Builder Cup. It begins with synthetic alerts, calculates deterministic evidence, retrieves synthetic policy guidance, and uses Gemini on Vertex AI to produce evidence-backed hypotheses and recommended next actions. A human analyst makes the final decision.

## Project structure

- `backend/` — FastAPI API, synthetic case data, evidence tools, policy retrieval, Gemini integration, tests and Cloud Run Dockerfile.
- `frontend/` — React/TypeScript workstream (teammate builds here).

## Run the backend locally

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8080
```

Visit http://localhost:8080/docs and try `GET /api/v1/alerts` and `POST /api/v1/investigations/FG-1042`.

The default `MOCK_GEMINI=true` provides deterministic demo output without cloud credentials. **This is not a real Gemini call.** To enable Vertex AI, set `MOCK_GEMINI=false`, configure your Google Cloud project and Application Default Credentials, and verify `ai_mode: vertex-ai` in the investigation response.

## API endpoints

- `GET /health`
- `GET /api/v1/alerts`
- `GET /api/v1/alerts/{alert_id}`
- `POST /api/v1/investigations/{alert_id}`
- `GET /api/v1/investigations/{investigation_id}`
- `POST /api/v1/investigations/{investigation_id}/decision`

## Tests

```bash
cd backend
python -m pytest -q
```

## Google Cloud deployment

Authenticate with `gcloud auth application-default login` locally, enable Vertex AI, Cloud Run, Cloud Build and Artifact Registry, and grant the Cloud Run runtime identity Vertex AI access. From `backend/`:

```bash
gcloud run deploy finguard-api \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars MOCK_GEMINI=false,GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID,GOOGLE_CLOUD_LOCATION=global,GEMINI_MODEL=gemini-2.5-flash,CORS_ORIGINS=https://YOUR_FIREBASE_DOMAIN
```

**Prototype limitations:** synthetic data and policies; simple keyword policy retrieval (not vector RAG); in-memory investigation history (not persistent or safe across Cloud Run instances); demo-only public API configuration. Do not use real customer data or production credentials. See `frontend/README.md` for teammate tasks.

## Team workflow

Work on separate feature branches (`feature/backend`, `feature/frontend`) and open PRs into `main`. Complete one end-to-end real Gemini demonstration before adding stretch infrastructure.
