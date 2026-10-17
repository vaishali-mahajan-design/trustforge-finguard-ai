# FinGuard AI frontend

React, TypeScript, and Vite analyst workspace for the FinGuard FastAPI demo. The interface loads the alert queue, fetches selected alert details, starts investigations, presents evidence and policy matches, and records the analyst's final decision.

## Run locally

Start the API first by following the repository [README](../README.md). Its default mock mode works without Google Cloud credentials.

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open the Vite URL (usually `http://localhost:5173`). The default API URL is `http://localhost:8080`; change `VITE_API_BASE_URL` in `.env.local` if the API runs elsewhere. The backend's default CORS origins include Vite's local URL.

## Build

```bash
npm run build
npm run preview
```

All API connection settings and endpoint paths live in [`src/api/config.ts`](src/api/config.ts). Edit its local default or endpoint map to change the connection in one place. For local, staging, or production builds, set `VITE_API_BASE_URL` in the corresponding `.env` file; Vite injects that value into the same config, so application code does not need environment-specific edits. If no production URL is supplied, the app uses its own origin (for a same-origin proxy setup).

Configure the backend's `CORS_ORIGINS` to include the deployed frontend origin. A private Cloud Run API also needs a secure authenticated proxy or equivalent; a static browser app cannot call a private service without one.

## Demo behavior

The report labels the backend's `ai_mode` and `model_used`; mock output is explicitly identified as demo analysis. AI recommendations only preselect the analyst decision control. The analyst must choose or confirm an action, identify themselves, and enter a rationale before submitting. Backend investigation and decision history is in memory and can disappear after a restart.

## Optional 2.0 report fields

The report UI is ready to display these optional API additions while continuing to render responses from the current API:

- `analysis.flips_to_legitimate` and `analysis.flips_to_fraud`: conditions with a `condition`, `checkable_facts`, and optional `check_id` / `evidence_ids`.
- `analysis.alternatives_considered`: action, rationale, and why the alternative was rejected.
- `ranked_checks`: backend-supplied rank, status, information gain, investigation cost, customer friction, result, and evidence references. The frontend displays the rank and scores; it does not calculate them or claim a check ran.
- `assessment_history`: timestamped earlier and current hypotheses, uncertainties, and next-best actions.
- `audit_trail`: timestamped events with descriptions and optional actor, check, and evidence references.

These are frontend-ready optional types, not a claim that the current backend returns or persists these fields. Agree on exact names, units, and status values with the backend owner before they implement the response schema.
