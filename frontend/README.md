# Frontend workstream — teammate

Build React + TypeScript + Vite; deploy to Firebase Hosting.

## Screens
1. Alert queue: `GET /api/v1/alerts`
2. Alert detail: `GET /api/v1/alerts/{alert_id}`
3. Investigate button: `POST /api/v1/investigations/{alert_id}`
4. Investigation report: evidence, hypotheses, contradictory/missing evidence, counterfactual, policy basis, recommended action
5. Human decision buttons: `POST /api/v1/investigations/{investigation_id}/decision` with JSON `{"action":"ESCALATE","rationale":"Multiple independent signals","analyst":"demo-analyst"}`

## Start
```bash
cd frontend
npm create vite@latest . -- --template react-ts
npm install
npm run dev
```

Use `http://localhost:8080` as API base URL while developing. `MOCK_GEMINI=true` works without GCP. Don't commit `.env` or credentials.

## Important
Frontend and backend should agree on API contract; use Swagger at `http://localhost:8080/docs`. `POST /api/v1/investigations/{alert_id}` returns the full report, including `investigation_id` and `ai_mode`. Do not represent mock output as a live Gemini investigation in the demo.
