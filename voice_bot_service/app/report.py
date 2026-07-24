"""End-of-call analysis + report. Builds the AiCallReport-shaped JSON that
admin_core's VacademyAiReportParser reads (we author both sides of the contract)
and POSTs it to the generic AI-voice webhook — which drives the whole existing
outcome pipeline (disposition classification → assign/stop/retry → workflow
resume → Call Intelligence).

The disposition is CONSTRAINED to the vocabulary the institute's settings
understand (context.agent.dispositions), so the classifier works unchanged.
Analysis runs as one non-streaming Sarvam chat-completions call over the
transcript; if it fails or returns garbage we degrade to a safe heuristic
("Incomplete") rather than dropping the report — a missing report would strand
the workflow until its safety timeout.
"""
from __future__ import annotations

import datetime as dt
import json
from zoneinfo import ZoneInfo
import logging
import re
from typing import Any, Dict, List, Optional

import httpx

from . import admin_core
from .bot import CallOutcome
from .config import get_settings

logger = logging.getLogger(__name__)

_ANALYSIS_TIMEOUT = httpx.Timeout(20.0, connect=5.0)


def _transcript_text(transcript: List[Dict[str, str]]) -> str:
    return "\n".join(f"{t['role']}: {t['text']}" for t in transcript if t.get("text"))


def _llm_target(s):
    """Mirror providers.build_llm's provider switch — the analysis call must run on
    the same backend as the conversation (a Sarvam-only analysis 401s forever on an
    OpenRouter-fallback deployment, degrading every call to disposition=Incomplete
    → the classifier retries leads who just completed a full conversation)."""
    if s.llm_provider == "google":
        return s.google_llm_base_url, s.gemini_api_key, s.google_llm_model
    if s.llm_provider == "openrouter":
        return s.openrouter_base_url, s.openrouter_api_key, s.openrouter_model
    # "vertex" conversation → analyse on Sarvam. The analysis is a one-shot HTTP
    # OpenAI-style call with a static bearer key; Vertex needs a refreshing OAuth
    # token + a region/project base URL, which doesn't fit here. Sarvam is always
    # configured (it still serves STT+TTS under Vertex) and analysis isn't latency-
    # critical, so classify + summarise on Sarvam. Non-vertex sarvam falls through here too.
    return s.sarvam_llm_base_url, s.sarvam_api_key, s.sarvam_llm_model


async def _analyze(outcome: CallOutcome) -> Dict[str, Any]:
    s = get_settings()
    agent = outcome.context.get("agent") or {}
    dispositions = agent.get("dispositions") or [
        "Interested", "Likely_Interested", "Callback", "Not_Interested", "Incomplete",
    ]
    questions = agent.get("extractionQuestions") or []
    transcript = _transcript_text(outcome.transcript)
    if not transcript.strip():
        return {"disposition": "Incomplete", "summary": "No conversation captured.",
                "leadRating": None, "extractedQa": {}, "callbackRequested": False,
                "callbackTimeText": None, "meetingRequested": False,
                "meetingDatetimeIso": None, "meetingDatetimeText": None, "meetingType": None}

    # Current date/time so the analyser can resolve relative dates spoken on the call
    # ("tomorrow 3pm", "day after") into a concrete ISO instant. Same tz convention as
    # the live prompt (agent tz, default Asia/Kolkata).
    tzname = (agent.get("timezone") or outcome.context.get("timezone") or "Asia/Kolkata").strip()
    try:
        now = dt.datetime.now(ZoneInfo(tzname))
    except Exception:
        tzname, now = "Asia/Kolkata", dt.datetime.now(ZoneInfo("Asia/Kolkata"))
    now_stamp = now.strftime("%A, %-d %B %Y, %-I:%M %p")
    now_offset = now.strftime("%z")
    now_offset = f"{now_offset[:3]}:{now_offset[3:]}" if now_offset else "+05:30"

    prompt = (
        "You analyse a phone call transcript between an assistant and a caller.\n"
        f"RIGHT NOW it is {now_stamp} ({tzname}, UTC offset {now_offset}). Use this to resolve any "
        "relative day the caller mentioned into an exact date.\n"
        f"Return STRICT JSON with keys: disposition (one of {dispositions}), "
        "summary (2-3 sentences), leadRating (integer 1-10 interest score or null), "
        "extractedQa (object: question -> answer, only what was actually said"
        + (f"; questions of interest: {questions}" if questions else "")
        + "), callbackRequested (boolean), callbackTimeText (string or null), "
        "meetingRequested (boolean: true ONLY if the caller AGREED to a scheduled meeting, demo, "
        "visit or callback at a specific day/time — not vague 'maybe later'), "
        "meetingDatetimeIso (ISO 8601 with offset for the agreed meeting time resolved from RIGHT "
        f"NOW, e.g. '2026-07-23T15:00:00{now_offset}', or null if none agreed), "
        "meetingDatetimeText (the caller's own words for the time, e.g. 'tomorrow 3 pm', or null), "
        "meetingType (short label: 'demo' | 'visit' | 'call' | 'meeting', or null).\n\n"
        f"Transcript:\n{transcript}\n\nJSON:"
    )
    base_url, api_key, model = _llm_target(s)
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1,
        "max_tokens": 500,
    }
    if base_url == s.sarvam_llm_base_url:
        # Literal null disables Sarvam's hybrid thinking — without it the whole
        # 500-token budget goes to reasoning and content comes back None. Keyed on the
        # resolved target (Sarvam) not the provider, so a "vertex" conversation — whose
        # analysis runs on Sarvam — still disables thinking.
        payload["reasoning_effort"] = None
    try:
        async with httpx.AsyncClient(timeout=_ANALYSIS_TIMEOUT) as client:
            resp = await client.post(
                f"{base_url}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json=payload,
            )
            resp.raise_for_status()
            # `or ""`: reasoning models (e.g. Sarvam-30b/-105b) return content=None
            # when max_tokens dies mid-think — degrade to the heuristic, don't crash.
            content = resp.json()["choices"][0]["message"].get("content") or ""
        match = re.search(r"\{.*\}", content, re.DOTALL)
        parsed = json.loads(match.group(0)) if match else {}
        if parsed.get("disposition") not in dispositions:
            parsed["disposition"] = "Incomplete"
        return parsed
    except Exception:
        logger.exception("analysis failed corr=%s — degrading to heuristic", outcome.corr)
        return {"disposition": "Incomplete",
                "summary": "Automatic analysis unavailable; see transcript.",
                "leadRating": None, "extractedQa": {}, "callbackRequested": False,
                "callbackTimeText": None}


def _status(outcome: CallOutcome) -> str:
    # The lead answered (the WS only opens on answer); "completed" iff they
    # actually spoke — a dead-air pickup classifies as no-answer downstream.
    said_something = any(t["role"] == "user" and t.get("text") for t in outcome.transcript)
    return "completed" if said_something else "no-answer"


async def build_and_post_report(outcome: CallOutcome, call_uuid: Optional[str]) -> bool:
    ctx = outcome.context
    analysis = await _analyze(outcome)
    agent = ctx.get("agent") or {}

    payload: Dict[str, Any] = {
        "call_uuid": call_uuid or f"vai-{outcome.corr}",
        "correlationId": outcome.corr,
        "direction": ctx.get("direction") or "OUTBOUND",
        "campaignType": "inbound" if (ctx.get("direction") or "").upper() == "INBOUND" else "outbound",
        "campaignId": agent.get("id") or "default",
        "status": _status(outcome),
        "durationSeconds": outcome.duration_seconds(),
        "callStart": dt.datetime.fromtimestamp(
            outcome.connected_at, tz=dt.timezone.utc
        ).isoformat().replace("+00:00", "Z"),
        "disposition": analysis.get("disposition"),
        "leadRating": analysis.get("leadRating"),
        "summary": analysis.get("summary"),
        "extractedQa": analysis.get("extractedQa") or {},
        "callbackRequested": bool(analysis.get("callbackRequested")),
        "callbackTimeText": analysis.get("callbackTimeText"),
        # Meeting intent → admin_core auto-books on the agent's linked booking page.
        "meetingRequested": bool(analysis.get("meetingRequested")),
        "meetingDatetimeIso": analysis.get("meetingDatetimeIso"),
        "meetingDatetimeText": analysis.get("meetingDatetimeText"),
        "meetingType": analysis.get("meetingType"),
        "transferAttempted": outcome.transfer_requested,
        "transferStatus": "registered" if outcome.transfer_registered
                          else ("failed" if outcome.transfer_requested else None),
        "transcript": _transcript_text(outcome.transcript) or None,
        "phoneNumber": ctx.get("leadPhone"),
        "customerName": ctx.get("leadName"),
        # Prior-attempt counter computed by admin_core at context time — feeds the
        # outcome classifier's exhaustion path (priorAttempts).
        "callRetry": ctx.get("callRetry"),
        # correlationId also rides metadata — the Aavtaar-convention round-trip
        # path AiVoiceWebhookService/OutcomeProcessor read.
        "metadata": {
            "correlationId": outcome.corr,
            "subjectType": "LEAD",
            "subjectId": ctx.get("responseId"),
        },
    }
    ok = await admin_core.post_report(ctx.get("instituteId"), ctx.get("webhookToken"), payload)
    logger.info("report posted corr=%s ok=%s disposition=%s status=%s",
                outcome.corr, ok, payload["disposition"], payload["status"])
    return ok
