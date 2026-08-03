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

import asyncio
import contextlib
import datetime as dt
import json
from zoneinfo import ZoneInfo
import logging
import os
import re
import time
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


def _caller_turns(outcome: CallOutcome) -> List[str]:
    """The caller's REAL words (synthetic bracketed cues excluded)."""
    return [t["text"] for t in outcome.transcript
            if t.get("role") == "user" and t.get("text")
            and not t["text"].lstrip().startswith("[")]


def _is_conversation(outcome: CallOutcome) -> bool:
    """Did a two-sided conversation actually happen?

    Guards the disposition path: 23 live calls where the caller contributed no
    real words still received Not_Interested / Wrong_Person / Wrong_Number.

    Deliberately ONLY a caller-turn test. Requiring a played ASSISTANT turn too
    would misfire in exactly the case we are fixing elsewhere: when our own
    audio never played (a wedged TTS socket) the caller may still have spoken —
    including a terminal "not interested". Forcing that to Incomplete flips a
    STOP into admin_core's retry path and re-dials someone who refused.

    NOTE this does NOT catch answering machines: voicemail greetings ARE caller
    text ("Your call has been forwarded to voicemail"), so those still reach the
    classifier. Machine detection is a separate, explicit fix — see the plan's
    later item; do not mistake this gate for it.
    """
    return len(_caller_turns(outcome)) >= 1


def _status(outcome: CallOutcome) -> str:
    # The lead answered (the WS only opens on answer); "completed" iff they
    # actually spoke — a dead-air pickup classifies as no-answer downstream.
    # Bracketed turns are SYNTHETIC (the "[unclear sound from the caller]"
    # backchannel cue) — counting them marked dead-air pickups "completed",
    # which admin_core's classifier treats as a real connect (workflow resumes,
    # no retry). Only real transcribed words count.
    said_something = any(
        t["role"] == "user" and t.get("text") and not t["text"].lstrip().startswith("[")
        for t in outcome.transcript
    )
    if said_something:
        return "completed"
    # A pipeline crash before anyone spoke is OUR failure, not the lead not
    # answering: "failed" keeps the call log honest (mapStatus: failed→FAILED,
    # while an unknown status would stamp COMPLETED) and still lands in the
    # classifier's not-connected → retry path, which is right for a crash.
    if outcome.crashed:
        return "failed"
    return "no-answer"


# ── failed-report spool ──────────────────────────────────────────────────────
# The report is the linchpin binding a call to its lead (disposition, workflow
# resume, retry accounting, billing). Two inline POST attempts already exist;
# when both fail (admin_core deploy window, network blip) the report used to be
# LOST — the paused CALL_AI workflow then sat until its safety timeout. Failed
# reports now spool to disk (on the tts-cache volume, so they survive restarts)
# and a background sweeper re-posts them every minute for up to 24h.

# Deliberately SHORT (default 20 min, env-overridable). A report re-posted late
# is processed FRESH by admin_core (it dedupes per call_uuid, not per lead), and
# applyDecision writes lead status with NO recency guard — so a stale no-answer/
# failed report delivered AFTER a newer call already advanced the lead would
# regress it (e.g. QUALIFIED → Retry-Pending). The CALL_AI redial cadence is
# ~120 min by default; capping the spool well under that keeps a spooled report
# landing before the next dial completes, so it can't clobber a newer outcome.
# Covers ordinary transient failures (deploy windows ~6-10 min, LB blips); a
# longer admin_core outage parks reports as .dead (logged CRITICAL) — a rare,
# loud, manually-recoverable case, still strictly better than the pre-spool loss.
_SPOOL_MAX_AGE_SECS = float(os.environ.get("REPORT_SPOOL_MAX_AGE_SECS", "").strip() or 20 * 60)
_SPOOL_SWEEP_INTERVAL_SECS = 60.0


def _spool_path(corr: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9_-]", "_", corr or "unknown")[:80]
    return os.path.join(get_settings().report_spool_dir, f"{safe}.json")


def spool_report(institute_id: Optional[str], token: Optional[str],
                 payload: Dict[str, Any]) -> Optional[str]:
    """Persist a failed report for the sweeper. Returns the path or None."""
    try:
        d = get_settings().report_spool_dir
        os.makedirs(d, exist_ok=True)
        path = _spool_path(str(payload.get("correlationId") or ""))
        rec = {"instituteId": institute_id, "token": token,
               "payload": payload, "spooledAt": time.time()}
        tmp = f"{path}.{os.getpid()}.tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(rec, f)
        os.replace(tmp, path)
        logger.error("report spooled for retry corr=%s -> %s",
                     payload.get("correlationId"), path)
        return path
    except Exception:
        logger.exception("report spool write failed corr=%s", payload.get("correlationId"))
        return None


async def sweep_report_spool() -> tuple:
    """One pass over the spool: re-POST each report, delete on success, park as
    .dead past 24h. Returns (posted, remaining) for logging/tests."""
    d = get_settings().report_spool_dir
    try:
        names = [n for n in os.listdir(d) if n.endswith(".json")]
    except FileNotFoundError:
        return (0, 0)
    # Load then order by spooledAt (= call-end time), NOT filename (= corr, which
    # is random): if several reports are queued, the OLDEST call's outcome must
    # deliver first so a newer call's status can't be overwritten by a stale one.
    loaded = []
    posted = remaining = 0
    for name in names:
        path = os.path.join(d, name)
        try:
            with open(path, "r", encoding="utf-8") as f:
                loaded.append((path, json.load(f)))
        except Exception:
            logger.exception("spool: unreadable %s — parking as .dead", name)
            with contextlib.suppress(Exception):
                os.replace(path, path + ".dead")
    def _spooled_at(rec: Dict[str, Any]) -> float:
        # Defensive: a corrupt non-numeric spooledAt must not raise inside sort()
        # and stall the ENTIRE sweep every minute (spool_report only ever writes a
        # float, so this is belt-and-suspenders). Unknown → 0.0 = deliver first.
        try:
            return float(rec.get("spooledAt") or 0)
        except (TypeError, ValueError):
            return 0.0

    for path, rec in sorted(loaded, key=lambda pr: _spooled_at(pr[1])):
        ok = await admin_core.post_report(
            rec.get("instituteId"), rec.get("token"), rec.get("payload") or {})
        if ok:
            posted += 1
            with contextlib.suppress(Exception):
                os.remove(path)
            logger.info("spool: report delivered corr=%s",
                        (rec.get("payload") or {}).get("correlationId"))
        elif time.time() - float(rec.get("spooledAt") or 0) > _SPOOL_MAX_AGE_SECS:
            logger.critical("spool: report UNDELIVERABLE past max age (%.0fs) corr=%s — parking "
                            "as .dead (lead outcome lost; investigate admin_core webhook)",
                            _SPOOL_MAX_AGE_SECS, (rec.get("payload") or {}).get("correlationId"))
            with contextlib.suppress(Exception):
                os.replace(path, path + ".dead")
        else:
            remaining += 1
    return (posted, remaining)


async def report_spool_sweeper() -> None:
    """Lifespan background task: retry spooled reports forever."""
    while True:
        await asyncio.sleep(_SPOOL_SWEEP_INTERVAL_SECS)
        try:
            posted, remaining = await sweep_report_spool()
            if posted or remaining:
                logger.info("spool sweep: posted=%d remaining=%d", posted, remaining)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("spool sweep failed")


async def build_and_post_report(outcome: CallOutcome, call_uuid: Optional[str]) -> bool:
    ctx = outcome.context
    # Never let the classifier judge a call the caller never took part in — see
    # _is_conversation. Skipping _analyze also saves the LLM round trip on the
    # 17% of dials that are answering machines.
    if get_settings().report_require_conversation and not _is_conversation(outcome):
        logger.info("report: no two-sided conversation corr=%s (%d caller turns) — "
                    "forcing Incomplete, skipping analysis",
                    outcome.corr, len(_caller_turns(outcome)))
        analysis = {
            "disposition": "Incomplete",
            "summary": "No two-sided conversation took place (no caller turn captured).",
            "leadRating": None, "extractedQa": {}, "callbackRequested": False,
            "callbackTimeText": None, "meetingRequested": False,
            "meetingDatetimeIso": None, "meetingDatetimeText": None, "meetingType": None,
        }
    else:
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
        # True when the pipeline crashed mid-call — observability for "completed"
        # calls whose conversation was cut short by US rather than the caller.
        "systemError": bool(outcome.crashed),
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
            # When the call actually ended (UTC ISO). Rides along even if the
            # report is delivered late by the spool sweeper, so admin_core CAN
            # (future) discount a stale report before it overwrites a newer
            # outcome's lead status — the out-of-order-clobber guard (deep-review W3).
            "reportGeneratedAt": dt.datetime.fromtimestamp(
                outcome.ended_at or time.time(), tz=dt.timezone.utc
            ).isoformat().replace("+00:00", "Z"),
        },
    }
    ok = await admin_core.post_report(ctx.get("instituteId"), ctx.get("webhookToken"), payload)
    if not ok:
        spool_report(ctx.get("instituteId"), ctx.get("webhookToken"), payload)
    logger.info("report posted corr=%s ok=%s disposition=%s status=%s",
                outcome.corr, ok, payload["disposition"], payload["status"])
    return ok
