import json
from functools import lru_cache
from pathlib import Path
from .models import AlertDetail, CustomerProfile

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

def _load_json(name: str):
    with (DATA_DIR / name).open("r", encoding="utf-8") as f:
        return json.load(f)

@lru_cache
def load_alerts() -> dict[str, AlertDetail]:
    alerts = [AlertDetail.model_validate(item) for item in _load_json("alerts.json")]
    return {a.alert_id: a for a in alerts}

@lru_cache
def load_customers() -> dict[str, CustomerProfile]:
    customers = [CustomerProfile.model_validate(item) for item in _load_json("customers.json")]
    return {c.customer_id: c for c in customers}

def get_alert(alert_id: str) -> AlertDetail | None:
    return load_alerts().get(alert_id)

def get_customer(customer_id: str) -> CustomerProfile | None:
    return load_customers().get(customer_id)
