from app.data_store import get_alert, get_customer
from app.evidence import build_evidence

def test_fg_1042_has_key_risk_signals():
    alert = get_alert("FG-1042")
    customer = get_customer(alert.customer_id)
    evidence = build_evidence(alert, customer)
    categories = {e.category for e in evidence}
    assert {"amount_anomaly","device_change","new_beneficiary","geo_deviation","velocity"}.issubset(categories)

def test_fg_1007_has_travel_context():
    alert = get_alert("FG-1007")
    customer = get_customer(alert.customer_id)
    evidence = build_evidence(alert, customer)
    travel = next(e for e in evidence if e.category == "travel_context")
    assert travel.value is True
