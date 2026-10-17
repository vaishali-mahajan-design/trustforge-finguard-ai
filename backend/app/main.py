from datetime import datetime, timezone
import logging
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from .config import get_settings
from .data_store import get_alert, load_alerts
from .models import AlertSummary, AnalystDecision, AnalystDecisionRequest, InvestigationResponse
from .orchestrator import investigate
from .demo_guard import limit_live_investigations

logger = logging.getLogger(__name__)
settings = get_settings()
app = FastAPI(title="FinGuard AI API", version="0.1.0", description="Synthetic evidence-grounded fraud investigation demo.")
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origin_list, allow_credentials=False, allow_methods=["GET","POST"], allow_headers=["Content-Type"])
# Demo-only in-memory state; not durable across Cloud Run instances/restarts.
INVESTIGATIONS: dict[str, InvestigationResponse] = {}
DECISIONS: list[AnalystDecision] = []

@app.get("/health")
def health():
    return {"status":"ok","service":"finguard-ai","ai_mode":"mock" if settings.mock_gemini else "vertex-ai"}

@app.get("/api/v1/alerts", response_model=list[AlertSummary])
def list_alerts():
    return [AlertSummary.model_validate(a.model_dump()) for a in load_alerts().values()]

@app.get("/api/v1/alerts/{alert_id}")
def alert_detail(alert_id: str):
    alert = get_alert(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert

@app.post(
    "/api/v1/investigations/{alert_id}",
    response_model=InvestigationResponse,
    dependencies=[Depends(limit_live_investigations)],
)
async def run_investigation(alert_id: str):
    try:
        result = await investigate(alert_id, settings)
        INVESTIGATIONS[result.investigation_id] = result
        return result
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Alert or customer not found") from exc
    except Exception:
        logger.exception("Investigation failed")
        raise HTTPException(status_code=502, detail="Investigation could not be completed")

@app.get("/api/v1/investigations/{investigation_id}", response_model=InvestigationResponse)
def get_investigation(investigation_id: str):
    result = INVESTIGATIONS.get(investigation_id)
    if not result:
        raise HTTPException(status_code=404, detail="Investigation not found in this demo instance")
    return result

@app.post("/api/v1/investigations/{investigation_id}/decision", response_model=AnalystDecision)
def record_decision(investigation_id: str, request: AnalystDecisionRequest):
    result = INVESTIGATIONS.get(investigation_id)
    if not result:
        raise HTTPException(status_code=404, detail="Investigation not found")
    decision = AnalystDecision(investigation_id=investigation_id, alert_id=result.alert.alert_id, action=request.action, rationale=request.rationale, analyst=request.analyst, decided_at=datetime.now(timezone.utc))
    DECISIONS.append(decision)
    return decision
