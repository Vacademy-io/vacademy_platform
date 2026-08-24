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

import asyncio
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
            if attempt == 1:
                # Beat: back-to-back retries die on the same transient (LB blip,
                # rolling-deploy gap). Longer outages are the spool sweeper's job
                # (report.py) — this inline path must not hold a capacity slot.
                await asyncio.sleep(2.0)
    return False


async def post_action(corr: str, artefact: str, agent_id: Optional[str]) -> bool:
    """Fire a MID-CALL action: the agent just offered something and the caller took it.

    FIRE AND FORGET BY CONTRACT — the caller must never await this on the voice path.
    A promised brochure is not worth a beat of dead air, and this crosses the ocean
    (the bot is in Mumbai, admin_core in Singapore).

    admin_core resolves ``artefact`` against the agent's MID_CALL rules and creates the
    send. An artefact the agent never published is a no-op there, so a hallucinated
    sentinel sends nothing. Idempotent on (call, rule), so a repeated marker in one call
    cannot double-send.
    """
    s = get_settings()
    url = f"{s.admin_core_base}/admin-core-service/internal/voice-bot/action"
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(
                url,
                json={"corr": corr, "artefact": artefact, "agentId": agent_id},
                headers=_internal_headers(),
            )
            resp.raise_for_status()
            logger.info("mid-call action accepted corr=%s artefact=%s", corr, artefact)
            return True
    except Exception:
        # Logged, never raised: the post-call rules are the safety net — an artefact the
        # caller accepted is usually ALSO in promisedSends, so a lost mid-call fire
        # degrades to a send a minute later rather than to nothing.
        logger.exception("mid-call action failed corr=%s artefact=%s", corr, artefact)
        return False


async def post_tts_cache_report(entries: list) -> bool:
    """Push the speech-cache ledger to admin-core so the analytics screens can be
    plain SQL instead of a live dependency on this box's disk.

    Uses the SAME clientName/Signature headers every other call here uses. That
    is the whole point of pushing rather than being polled: this direction is
    already authenticated and working, while admin-core has no credential for
    reaching us — which is why warm-on-save has never fired in production.

    Returns False rather than raising. A missed report costs a stale analytics
    screen until the next cycle; nothing on a call depends on it.
    """
    s = get_settings()
    url = f"{s.admin_core_base}/admin-core-service/internal/voice-bot/tts-cache/report"
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=5.0)) as client:
            resp = await client.post(url, json={"entries": entries},
                                     headers=_internal_headers())
        if resp.status_code >= 300:
            logger.warning("tts-cache report rejected: %s %s",
                           resp.status_code, resp.text[:200])
            return False
        return True
    except Exception as e:
        logger.warning("tts-cache report failed: %s", e)
        return False


async def fetch_tts_cache_commands() -> list:
    """Claim any queued flush/delete commands.

    A read is a mirror, but a flush is an ACTION on files that live on this
    box's disk, so something has to come back the other way. admin-core writes a
    row, we claim it here — the same DB-as-queue shape call_intelligence already
    uses, and it needs no inbound channel to this process.
    """
    s = get_settings()
    url = f"{s.admin_core_base}/admin-core-service/internal/voice-bot/tts-cache/commands"
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(url, headers=_internal_headers())
        if resp.status_code >= 300:
            return []
        return (resp.json() or {}).get("commands") or []
    except Exception as e:
        logger.debug("tts-cache command fetch failed: %s", e)
        return []


async def post_tts_cache_command_result(command_id: str, ok: bool, result: str,
                                        entries_removed: int, bytes_removed: int) -> bool:
    """Report what a flush actually did. A destructive action with no record is
    not one anybody should be able to trigger from a web page."""
    s = get_settings()
    url = (f"{s.admin_core_base}/admin-core-service/internal/voice-bot"
           f"/tts-cache/commands/{command_id}/result")
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(url, headers=_internal_headers(), json={
                "ok": ok, "result": result[:2000],
                "entriesRemoved": entries_removed, "bytesRemoved": bytes_removed})
        return resp.status_code < 300
    except Exception as e:
        logger.warning("tts-cache command result failed: %s", e)
        return False
