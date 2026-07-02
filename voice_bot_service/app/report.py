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
    if s.llm_provider == "openrouter":
        return s.openrouter_base_url, s.openrouter_api_key, s.openrouter_model
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
                "callbackTimeText": None}

    prompt = (
        "You analyse a phone call transcript between an assistant and a caller.\n"
        f"Return STRICT JSON with keys: disposition (one of {dispositions}), "
        "summary (2-3 sentences), leadRating (integer 1-10 interest score or null), "
        "extractedQa (object: question -> answer, only what was actually said"
        + (f"; questions of interest: {questions}" if questions else "")
        + "), callbackRequested (boolean), callbackTimeText (string or null).\n\n"
        f"Transcript:\n{transcript}\n\nJSON:"
    )
    base_url, api_key, model = _llm_target(s)
    try:
        async with httpx.AsyncClient(timeout=_ANALYSIS_TIMEOUT) as client:
            resp = await client.post(
                f"{base_url}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.1,
                    "max_tokens": 500,
                },
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
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
