"""
Caller identity for the learner chatbot (/chat-agent).

The learner app now sends its access token on every /chat-agent call (REST and
the fetch-based SSE stream). Older app builds — including installed native
apps — send none, so enforcement is a rollout:

* A request whose token is missing, expired, or names a different learner or
  institute is a *violation*.
* While `chatbot.text.require_auth` (env CHAT_REQUIRE_AUTH) is off, violations
  are served and counted ("shadow"), so we can see who would be cut off.
* Once it is on, the same violations are refused with 401/403.

Tokens are verified locally (HS256, same secret as the Java services), not via
auth-service: the stream reconnects and the app re-syncs context often, and a
network hop per call would add latency for nothing. The JWT's per-institute
`authorities` map is the membership check — there is deliberately NO
is_root_user bypass, because ordinary learners carry that flag (185k of 189k
users on prod).
"""
from __future__ import annotations

import logging
import threading
import time
from collections import Counter
from dataclasses import dataclass, field
from typing import Optional

from fastapi import Header, HTTPException, status

from ..config import get_settings
from .security import _extract_bearer, decode_access_token

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ChatCaller:
    """Who is calling. `user_id` is None for a request without a valid token."""

    user_id: Optional[str] = None
    institute_ids: frozenset = field(default_factory=frozenset)
    locale: Optional[str] = None
    # Why the caller is anonymous ("missing" / "invalid"), for the shadow log.
    anonymous_reason: Optional[str] = None

    @property
    def authenticated(self) -> bool:
        return bool(self.user_id)


def require_auth_enabled() -> bool:
    from ..services.platform_settings_service import get_platform_setting

    try:
        return bool(
            get_settings().chat_require_auth
            or get_platform_setting("chatbot.text.require_auth", default=False)
        )
    except Exception:  # noqa: BLE001 — settings outage must not take chat down
        return bool(get_settings().chat_require_auth)


# ── shadow counters ──────────────────────────────────────────────────────────
# Per pod, reset on restart. Logged at most once a minute so a busy stream
# reconnect loop cannot flood the logs; also readable from the staff-only
# /chat-agent/debug endpoint.

_lock = threading.Lock()
_counts: Counter = Counter()
_last_log = 0.0
_LOG_EVERY_S = 60.0


def _count(kind: str) -> None:
    global _last_log
    with _lock:
        _counts[kind] += 1
        now = time.monotonic()
        if now - _last_log < _LOG_EVERY_S:
            return
        _last_log = now
        snapshot = dict(_counts)
    logger.warning(
        "[chat-auth] chat-agent request without a valid token or with a mismatched "
        "identity (served: require_auth is off) — totals since boot: %s",
        snapshot,
    )


def shadow_counts() -> dict:
    with _lock:
        return dict(_counts)


def _violation(kind: str, detail: str, code: int) -> None:
    """Refuse when enforcing; otherwise count it and let the request through."""
    if require_auth_enabled():
        raise HTTPException(status_code=code, detail=detail)
    _count(kind)


# ── FastAPI dependency ───────────────────────────────────────────────────────


def get_chat_caller(authorization: Optional[str] = Header(None)) -> ChatCaller:
    token = _extract_bearer(authorization)
    if not token:
        _violation("no_token", "Login required", status.HTTP_401_UNAUTHORIZED)
        return ChatCaller(anonymous_reason="missing")

    claims = decode_access_token(token)
    user_id = str((claims or {}).get("user") or "")
    if not user_id:
        # Expired or forged. The app refreshes before opening the stream, so a
        # steady stream of these means a client bug, not a learner problem.
        _violation("invalid_token", "Session expired — please log in again", status.HTTP_401_UNAUTHORIZED)
        return ChatCaller(anonymous_reason="invalid")

    authorities = claims.get("authorities")
    institute_ids = frozenset(str(k) for k in authorities) if isinstance(authorities, dict) else frozenset()
    locale = claims.get("locale") or claims.get("language")
    return ChatCaller(user_id=user_id, institute_ids=institute_ids, locale=str(locale) if locale else None)


# ── checks ───────────────────────────────────────────────────────────────────


def check_can_open(caller: ChatCaller, user_id: str, institute_id: str) -> None:
    """A learner may only open a session as themselves, in an institute they belong to."""
    if not caller.authenticated:
        return  # already counted / refused by get_chat_caller
    if str(user_id) != caller.user_id:
        _violation("user_mismatch", "You can only chat as yourself", status.HTTP_403_FORBIDDEN)
    if str(institute_id) not in caller.institute_ids:
        _violation("institute_mismatch", "You are not a member of this institute", status.HTTP_403_FORBIDDEN)


def check_owns_session(caller: ChatCaller, session_user_id: Optional[str]) -> None:
    """Only the learner who opened a session may read or write it."""
    if not caller.authenticated:
        return
    if str(session_user_id or "") != caller.user_id:
        _violation("session_mismatch", "This chat belongs to someone else", status.HTTP_403_FORBIDDEN)


# ── rate limit ───────────────────────────────────────────────────────────────
# A learner once sent the same sentence 39 times in 37 s, each a billed LLM
# turn. In-process sliding window: ai-service runs one replica, so per-pod is
# per-platform today; with more replicas it becomes N x the limit, still a cap.

_RATE_WINDOW_S = 60.0
_RATE_MAX = 12
_rate_lock = threading.Lock()
_rate_hits: dict = {}


def check_rate_limit(key: str) -> None:
    if not key:
        return
    now = time.monotonic()
    with _rate_lock:
        hits = [t for t in _rate_hits.get(key, ()) if now - t < _RATE_WINDOW_S]
        if len(hits) >= _RATE_MAX:
            _rate_hits[key] = hits
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="You're sending messages very quickly — please wait a few seconds and try again.",
            )
        hits.append(now)
        _rate_hits[key] = hits
        # Opportunistic sweep so idle learners don't accumulate forever.
        if len(_rate_hits) > 5000:
            for k in [k for k, v in _rate_hits.items() if not v or now - v[-1] >= _RATE_WINDOW_S]:
                _rate_hits.pop(k, None)


__all__ = [
    "ChatCaller",
    "get_chat_caller",
    "check_can_open",
    "check_owns_session",
    "check_rate_limit",
    "require_auth_enabled",
    "shadow_counts",
]
