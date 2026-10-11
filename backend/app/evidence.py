from statistics import mean
from .models import AlertDetail, CustomerProfile, EvidenceItem

def build_evidence(alert: AlertDetail, customer: CustomerProfile) -> list[EvidenceItem]:
    evidence: list[EvidenceItem] = []
    txns = sorted(alert.transactions, key=lambda t: t.timestamp)
    historical_avg = mean(customer.historical_transaction_amounts) if customer.historical_transaction_amounts else 0
    max_amount = max((t.amount for t in txns), default=0)
    ratio = round(max_amount / historical_avg, 1) if historical_avg else 0
    unknown_devices = sorted({t.device_id for t in txns if t.device_id not in customer.known_devices})
    new_beneficiaries = sorted({t.beneficiary_id for t in txns if t.beneficiary_id and t.beneficiary_id not in customer.known_beneficiaries})
    foreign_countries = sorted({t.country for t in txns if t.country != customer.home_country})

    if ratio >= 3:
        evidence.append(EvidenceItem(evidence_id="E1", category="amount_anomaly", statement=f"Largest transaction is {ratio}x the customer's historical average.", value=ratio, source="deterministic_transaction_analysis", severity="high"))
    if unknown_devices:
        evidence.append(EvidenceItem(evidence_id="E2", category="device_change", statement=f"Activity originated from previously unseen device(s): {', '.join(unknown_devices)}.", value=True, source="customer_context", severity="high"))
    if new_beneficiaries:
        evidence.append(EvidenceItem(evidence_id="E3", category="new_beneficiary", statement=f"New beneficiary detected: {', '.join(new_beneficiaries)}.", value=True, source="customer_context", severity="high"))
    if foreign_countries:
        evidence.append(EvidenceItem(evidence_id="E4", category="geo_deviation", statement=f"Transactions occurred outside the customer's home country in: {', '.join(foreign_countries)}.", value=True, source="customer_context", severity="medium"))
    if len(txns) >= 2:
        span_minutes = int((txns[-1].timestamp - txns[0].timestamp).total_seconds() / 60)
        if span_minutes <= 30:
            evidence.append(EvidenceItem(evidence_id="E5", category="velocity", statement=f"{len(txns)} related events occurred within {span_minutes} minutes.", value=span_minutes, source="deterministic_transaction_analysis", severity="high"))
    evidence.append(EvidenceItem(evidence_id="E6", category="international_history", statement=f"Customer had {customer.international_transactions_last_90d} international transactions in the prior 90 days.", value=customer.international_transactions_last_90d, source="customer_context", severity="medium" if customer.international_transactions_last_90d == 0 else "low"))
    active_travel = [t for t in customer.travel_notifications if t.get("active")]
    if active_travel:
        destinations = ", ".join(t.get("country", "unknown") for t in active_travel)
        evidence.append(EvidenceItem(evidence_id="E7", category="travel_context", statement=f"Customer has an active travel notification for: {destinations}.", value=True, source="customer_context", severity="low"))
    else:
        evidence.append(EvidenceItem(evidence_id="E7", category="travel_context", statement="No active travel notification is recorded for the customer.", value=False, source="customer_context", severity="medium"))
    return evidence
