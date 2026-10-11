from fastapi.testclient import TestClient
from app.main import app
client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_list_alerts():
    response = client.get("/api/v1/alerts")
    assert response.status_code == 200
    ids = {item["alert_id"] for item in response.json()}
    assert {"FG-1042","FG-1007"}.issubset(ids)

def test_mock_investigation():
    response = client.post("/api/v1/investigations/FG-1042")
    assert response.status_code == 200
    body = response.json()
    assert body["analysis"]["recommended_action"] == "ESCALATE"
    assert body["ai_mode"] == "mock"

def test_travel_investigation():
    response = client.post("/api/v1/investigations/FG-1007")
    assert response.status_code == 200
    assert response.json()["analysis"]["recommended_action"] == "REQUEST_VERIFICATION"

def test_human_decision():
    investigation = client.post("/api/v1/investigations/FG-1042").json()
    response = client.post(f"/api/v1/investigations/{investigation['investigation_id']}/decision",json={"action":"ESCALATE","rationale":"Multiple independent signals"})
    assert response.status_code == 200
    assert response.json()["action"] == "ESCALATE"
