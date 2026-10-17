# FinGuard AI — Analyst Workspace

React + TypeScript + Vite dashboard connected to the real FinGuard FastAPI endpoints. It supports the synthetic alert queue, evidence-backed Gemini investigations, competing hypotheses, counterfactual reasoning, policy and transaction tabs, JSON export, and a **human-confirmed** analyst decision.

## Run on your Mac

Start the existing FastAPI backend in a separate terminal (from `backend/`):

```bash
source .venv/bin/activate
python -m uvicorn app.main:app --reload --port 8080
```

Then:

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open **http://localhost:5173**. Select `FG-1042` or `FG-1007`, click **Investigate**, explore the report, and record an analyst decision. `npm run build` typechecks and builds the production bundle.

The frontend's `.env.local` sets `VITE_API_BASE_URL=http://127.0.0.1:8080`. The backend's `CORS_ORIGINS` must include `http://localhost:5173`. No Firebase credentials are required to run locally.

## Cloud Run authentication / deployment

The deployed Cloud Run service is currently **private**. A browser cannot call it by supplying `gcloud auth print-identity-token` or by using Firebase Auth tokens as Cloud Run IAM tokens. **Do not put Google Cloud service account keys or identity tokens in Vite environment variables**; all `VITE_` values are public in the browser bundle.

For the hackathon, demonstrate the frontend locally against the local FastAPI backend with real Vertex AI credentials. To host publicly, introduce a secure backend-for-frontend/authenticated proxy or Firebase-authenticated API that validates ID tokens server-side, with an allowlist and rate limiting. Do not simply enable unauthenticated Cloud Run access to the billable investigation endpoint.

A production same-origin API proxy can use `VITE_API_BASE_URL` unset. API routes are centralized in `src/api/config.ts`.

## Prototype limitations

- Uses synthetic transactions and synthetic policy documents, not live banking data.
- Evidence and policy retrieval are deterministic/keyword-based; the LLM creates hypotheses and recommendations.
- An AI recommendation **never automatically submits a decision**. The analyst enters a name and rationale and confirms.
- Investigation and decision state is held in the backend's memory; it can be lost on restart or across Cloud Run instances. Frontend session counters are not global metrics.
- The transaction tab distinguishes approved transfers from blocked attempts. Beneficiary-added events are not counted as approved payments.
