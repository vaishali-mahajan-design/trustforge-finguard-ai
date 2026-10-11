from datetime import datetime
from enum import Enum
from typing import Any
from pydantic import BaseModel, Field

class Action(str, Enum):
    CLEAR = "CLEAR"
    REQUEST_VERIFICATION = "REQUEST_VERIFICATION"
    ESCALATE = "ESCALATE"

class AlertSummary(BaseModel):
    alert_id: str
    customer_id: str
    created_at: datetime
    status: str
    headline: str
    attempted_amount: float
    currency: str

class Transaction(BaseModel):
    transaction_id: str
    timestamp: datetime
    amount: float
    currency: str
    city: str
    country: str
    device_id: str
    beneficiary_id: str | None = None
    status: str

class AlertDetail(AlertSummary):
    transactions: list[Transaction]

class CustomerProfile(BaseModel):
    customer_id: str
    home_city: str
    home_country: str
    known_devices: list[str]
    known_beneficiaries: list[str]
    travel_notifications: list[dict[str, Any]] = Field(default_factory=list)
    international_transactions_last_90d: int = 0
    historical_transaction_amounts: list[float]

class EvidenceItem(BaseModel):
    evidence_id: str
    category: str
    statement: str
    value: str | float | int | bool
    source: str
    severity: str

class PolicyMatch(BaseModel):
    policy_id: str
    title: str
    excerpt: str
    matched_terms: list[str]

class Hypothesis(BaseModel):
    name: str
    explanation: str
    supporting_evidence_ids: list[str] = Field(default_factory=list)
    contradicting_evidence_ids: list[str] = Field(default_factory=list)
    missing_evidence: list[str] = Field(default_factory=list)

class InvestigationLLMOutput(BaseModel):
    summary: str
    primary_hypothesis: Hypothesis
    alternative_hypotheses: list[Hypothesis]
    counterfactual: str
    recommended_action: Action
    recommended_reason: str
    next_best_action: str
    policy_basis: list[str] = Field(default_factory=list)

class InvestigationResponse(BaseModel):
    investigation_id: str
    alert: AlertDetail
    evidence: list[EvidenceItem]
    policy_matches: list[PolicyMatch]
    analysis: InvestigationLLMOutput
    model_used: str
    ai_mode: str

class AnalystDecisionRequest(BaseModel):
    action: Action
    rationale: str = Field(min_length=3, max_length=1000)
    analyst: str = "demo-analyst"

class AnalystDecision(BaseModel):
    investigation_id: str
    alert_id: str
    action: Action
    rationale: str
    analyst: str
    decided_at: datetime
