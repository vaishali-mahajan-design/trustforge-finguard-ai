from collections import deque
from threading import Lock
from time import monotonic

from fastapi import HTTPException

from .config import get_settings

MAX_TOTAL_INVESTIGATIONS = 30
MAX_INVESTIGATIONS_PER_MINUTE = 6

_lock = Lock()
_recent_calls = deque()
_total_calls = 0


def limit_live_investigations():
    global _total_calls

    # Local mock-mode tests remain unrestricted.
    if get_settings().mock_gemini:
        return

    now = monotonic()

    with _lock:
        while _recent_calls and now - _recent_calls[0] >= 60:
            _recent_calls.popleft()

        if _total_calls >= MAX_TOTAL_INVESTIGATIONS:
            raise HTTPException(
                status_code=429,
                detail="Demo investigation limit reached.",
            )

        if len(_recent_calls) >= MAX_INVESTIGATIONS_PER_MINUTE:
            raise HTTPException(
                status_code=429,
                detail="Too many investigations. Please retry shortly.",
            )

        _recent_calls.append(now)
        _total_calls += 1