"""admin_core client — the bot's only integration surface.

Three calls, all thin:
  * ``get_call_context(corr, agent)``  — GET  /internal/voice-bot/call-context
  * ``post_handoff(corr)``             — POST /internal/voice-bot/handoff
  * ``post_report(institute_id, token, payload)`` — POST the end-of-call report to
    the PUBLIC generic AI-voice webhook (/v1/telephony/webhook/ai-voice/VACADEMY_AI),
    which drives the whole existing outcome pipeline (classify → assign → workflow
    resume → recording copy → Call Intelligence).

Internal endpoints are gated by admin_core's InternalAuthFilter: any URI containing
"internal" requires ``clientName`` + ``Signature`` headers that validate against the
``client_secret_key`` table. Ops registers a ``voice_bot_service`` row there and sets
VOICE_BOT_CLIENT_NAME / VOICE_BOT_CLIENT_SECRET on this service.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

import httpx

from .config import get_settings

logger = logging.getLogger(__name__)

_TIMEOUT = httpx.Timeout(10.0, connect=5.0)


def _internal_headers() -> Dict[str, str]:
    s = get_settings()
    return {"clientName": s.internal_client_name, "Signature": s.internal_client_secret}


async def get_call_context(corr: str, agent: Optional[str]) -> Dict[str, Any]:
    """Everything the bot needs for one call: lead, institute, persona, handoff,
    webhook token. Raises on failure — a call without context must not proceed
    to a hallucinated conversation."""
    s = get_settings()
    url = f"{s.admin_core_base}/admin-core-service/internal/voice-bot/call-context"
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.get(
            url,
            params={"corr": corr, **({"agent": agent} if agent else {})},
            headers=_internal_headers(),
        )
        resp.raise_for_status()
        return resp.json()


async def post_handoff(corr: str, number: str) -> Optional[str]:
    """Register a mid-call human handoff to ``number`` (picked from the context's
    handoff targets). admin_core persists it (V354 ai_handoff_target); after we
    close the stream, Plivo's <Redirect> to /plivo/ai-next serves the <Dial>.
    Returns the confirmed number, or None on failure (the bot should then
    apologise and wrap up instead)."""
    s = get_settings()
    url = f"{s.admin_core_base}/admin-core-service/internal/voice-bot/handoff"
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(
                url, json={"corr": corr, "number": number}, headers=_internal_headers()
            )
            resp.raise_for_status()
            body = resp.json()
            return body.get("number")
    except Exception:
        logger.exception("handoff registration failed for corr=%s", corr)
        return None


async def post_report(institute_id: str, webhook_token: Optional[str], payload: Dict[str, Any]) -> bool:
    """POST the end-of-call report. Best-effort with one retry — the report is the
    linchpin that binds the call outcome to the lead, so failures are loud."""
    s = get_settings()
    url = f"{s.admin_core_base}/admin-core-service/v1/telephony/webhook/ai-voice/VACADEMY_AI"
    params: Dict[str, str] = {"instituteId": institute_id}
    if webhook_token:
        params["token"] = webhook_token
    for attempt in (1, 2):
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.post(url, params=params, json=payload)
                resp.raise_for_status()
                return True
        except Exception:
            logger.exception("report POST failed (attempt %s) corr=%s",
                             attempt, payload.get("correlationId"))
    return False
