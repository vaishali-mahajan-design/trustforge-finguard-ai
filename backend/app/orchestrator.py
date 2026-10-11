from uuid import uuid4
from .config import Settings
from .data_store import get_alert, get_customer
from .evidence import build_evidence
from .gemini_service import analyze_with_gemini
from .models import InvestigationResponse
from .policy import retrieve_policies

async def investigate(alert_id: str, settings: Settings) -> InvestigationResponse:
    alert = get_alert(alert_id)
    if not alert:
        raise KeyError(f"Alert {alert_id} not found")
    customer = get_customer(alert.customer_id)
    if not customer:
        raise KeyError(f"Customer {alert.customer_id} not found")
    evidence = build_evidence(alert, customer)
    policies = retrieve_policies(evidence)
    analysis, ai_mode, model_used = await analyze_with_gemini(settings, alert, evidence, policies)
    return InvestigationResponse(investigation_id=f"INV-{uuid4().hex[:8].upper()}", alert=alert, evidence=evidence, policy_matches=policies, analysis=analysis, model_used=model_used, ai_mode=ai_mode)
