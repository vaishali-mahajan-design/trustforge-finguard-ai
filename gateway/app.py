"""FinGuard AI demo gateway: fixed-case proxy + persistent Gemini request quota.

Public Cloud Run entry point. The downstream API stays private and is invoked
using this gateway service account's Cloud Run identity token.
"""

import asyncio
import logging
import os
import re
import time
from functools import lru_cache
from typing import Literal

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.cloud import firestore
from google.oauth2 import id_token
from pydantic import BaseModel, Field

logger = logging.getLogger("finguard.gateway")

PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "").strip()
BACKEND_URL = os.environ.get("BACKEND_URL", "").rstrip("/")
MAX_TOTAL = int(os.environ.get("DEMO_MAX_TOTAL_INVESTIGATIONS", "24"))
MAX_PER_MINUTE = int(os.environ.get("DEMO_MAX_PER_MINUTE", "4"))

ALLOWED_ALERT_IDS = frozenset({"FG-1042", "FG-1007"})
INVESTIGATION_ID_PATTERN = re.compile(r"^INV-[0-9A-F]{8}$")

app = FastAPI(
    title="FinGuard AI Public Demo Gateway",
    description="Quota-limited proxy for two synthetic fraud cases.",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


class DecisionRequest(BaseModel):
    action: Literal["CLEAR", "REQUEST_VERIFICATION", "ESCALATE"]
    rationale: str = Field(min_length=3, max_length=1000)
    analyst: str = Field(default="demo-analyst", min_length=1, max_length=64)


def _check_config() -> None:
    if not PROJECT_ID or not BACKEND_URL.startswith("https://"):
        raise HTTPException(status_code=503, detail="Demo gateway is not configured")
    if MAX_TOTAL < 1 or MAX_PER_MINUTE < 1:
        raise HTTPException(status_code=503, detail="Invalid gateway quota configuration")


@lru_cache(maxsize=1)
def _firestore_client() -> firestore.Client:
    return firestore.Client(project=PROJECT_ID)


@firestore.transactional
def _reserve_in_transaction(transaction, ref, now: float) -> None:
    """Atomically reserve one invocation before making the billable API call."""
    snapshot = ref.get(transaction=transaction)
    data = snapshot.to_dict() if snapshot.exists else {}
    total = int(data.get("total", 0))
    window_start = float(data.get("window_start", 0))
    window_count = int(data.get("window_count", 0))

    if total >= MAX_TOTAL:
        raise HTTPException(
            status_code=429,
            detail="This public demo has reached its investigation quota. Please contact the team for a guided demo.",
        )

    if now < window_start or now - window_start >= 60:
        window_start = now
        window_count = 0

    if window_count >= MAX_PER_MINUTE:
        raise HTTPException(
            status_code=429,
            detail="The demo is receiving too many investigations. Please try again in one minute.",
        )

    transaction.set(
        ref,
        {
            "total": total + 1,
            "window_start": window_start,
            "window_count": window_count + 1,
            "updated_at": firestore.SERVER_TIMESTAMP,
        },
    )


def _reserve_invocation_sync() -> None:
    db = _firestore_client()
    ref = db.collection("finguard_demo_control").document("investigations")
    _reserve_in_transaction(db.transaction(), ref, time.time())


async def _reserve_invocation() -> None:
    try:
        await asyncio.to_thread(_reserve_invocation_sync)
    except HTTPException:
        raise
    except Exception as exc:
        # Fail closed: do not call Gemini when the durable quota cannot be checked.
        logger.exception("Firestore quota check failed")
        raise HTTPException(status_code=503, detail="Demo quota service temporarily unavailable") from exc


def _get_backend_token_sync() -> str:
    # Cloud Run accepts ID tokens with its service URL as the audience.
    return id_token.fetch_id_token(GoogleAuthRequest(), BACKEND_URL)


async def _forward(method: str, path: str, payload: dict | None = None) -> JSONResponse:
    _check_config()
    try:
        token = await asyncio.to_thread(_get_backend_token_sync)
        async with httpx.AsyncClient(timeout=httpx.Timeout(52.0, connect=10.0)) as client:
            response = await client.request(
                method,
                f"{BACKEND_URL}{path}",
                headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
                json=payload,
            )
        try:
            body = response.json()
        except ValueError:
            logger.error("Backend returned non-JSON status=%s", response.status_code)
            raise HTTPException(status_code=502, detail="Invalid response from investigation service")
        return JSONResponse(
            status_code=response.status_code,
            content=body,
            headers={"Cache-Control": "no-store"},
        )
    except HTTPException:
        raise
    except (httpx.HTTPError, ValueError) as exc:
        logger.exception("Unable to reach private investigation service")
        raise HTTPException(status_code=502, detail="Investigation service temporarily unavailable") from exc
    except Exception as exc:
        logger.exception("Gateway authentication or forwarding failed")
        raise HTTPException(status_code=502, detail="Investigation service temporarily unavailable") from exc


def _require_alert_id(alert_id: str) -> None:
    if alert_id not in ALLOWED_ALERT_IDS:
        raise HTTPException(status_code=404, detail="Demo alert not found")


def _require_investigation_id(investigation_id: str) -> None:
    if not INVESTIGATION_ID_PATTERN.fullmatch(investigation_id):
        raise HTTPException(status_code=404, detail="Investigation not found")


@app.get("/health")
async def health():
    return await _forward("GET", "/health")


@app.get("/api/v1/alerts")
async def list_alerts():
    return await _forward("GET", "/api/v1/alerts")


@app.get("/api/v1/alerts/{alert_id}")
async def alert_detail(alert_id: str):
    _require_alert_id(alert_id)
    return await _forward("GET", f"/api/v1/alerts/{alert_id}")


@app.post("/api/v1/investigations/{alert_id}")
async def investigate(alert_id: str):
    _require_alert_id(alert_id)
    _check_config()
    await _reserve_invocation()
    return await _forward("POST", f"/api/v1/investigations/{alert_id}")


@app.get("/api/v1/investigations/{investigation_id}")
async def investigation_detail(investigation_id: str):
    _require_investigation_id(investigation_id)
    return await _forward("GET", f"/api/v1/investigations/{investigation_id}")


@app.post("/api/v1/investigations/{investigation_id}/decision")
async def record_decision(investigation_id: str, decision: DecisionRequest):
    _require_investigation_id(investigation_id)
    return await _forward(
        "POST",
        f"/api/v1/investigations/{investigation_id}/decision",
        decision.model_dump(),
    )
