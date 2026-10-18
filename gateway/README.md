# FinGuard AI demo gateway

This **public** FastAPI Cloud Run service proxies only the synthetic FinGuard API routes to the **private** `finguard-api` Cloud Run service. It uses its own service account to obtain a Google-signed ID token with the private Cloud Run URL as audience.

For `POST /api/v1/investigations/FG-1042` and `FG-1007`, the gateway first reserves a slot in an atomic Firestore transaction, with a total cap and a rolling 60-second cap. If Firestore is unavailable it fails closed. All other backend endpoints are allowlisted, and no arbitrary model prompts or arbitrary backend paths can be forwarded.

Required Cloud Run environment variables:

- `BACKEND_URL=https://finguard-api-292205423761.asia-south1.run.app`
- `GOOGLE_CLOUD_PROJECT=trustforge-finguard-ai-2026`
- `DEMO_MAX_TOTAL_INVESTIGATIONS=24`
- `DEMO_MAX_PER_MINUTE=4`

The gateway service account needs `roles/run.invoker` on `finguard-api` and `roles/datastore.user` on the project to use Firestore.

## Important limitations

- The public gateway's **global quota** is persistent but is **not an account billing cap**. Requests to the private backend from other authorized identities, and other project resources, are outside this quota.
- No authentication is required to reach the public demo gateway. Someone who knows the URL could exhaust the shared 24-investigation quota. Share the demo URL only with intended reviewers, and consider disabling the public gateway after judging.
- `finguard-api` stores investigations and decisions in memory, so those records are lost if the backend process restarts. A later version should persist them in Firestore.
- Firebase Hosting has a 60-second request timeout; the gateway uses a 52-second backend timeout.
- The quota reserves calls **before** Gemini is invoked. Failed investigations also consume quota, which is intentionally conservative for cost control.
- Cloud Run max instances is a scaling safeguard, not a hard spending cap. Configure billing budget alerts separately.
