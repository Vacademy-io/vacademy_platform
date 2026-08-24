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

from . import admin_core, diagnostics
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


# Every degraded or skipped analysis path returns these three keys explicitly rather
# than omitting them. admin_core reads promisedSends to decide what to actually send,
# and a MISSING key must not be distinguishable from an EMPTY one downstream — else a
# failed analysis reads as "the model considered it and found nothing promised".
_NO_SENDS: Dict[str, Any] = {"promisedSends": [], "declinedSends": [], "conditionsMet": [], "whatsappNumber": None, "email": None}


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
                "meetingDatetimeIso": None, "meetingDatetimeText": None,
                "meetingType": None, **_NO_SENDS}

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

    # Send rules turn a promise made ON the call into a real WhatsApp/email/meeting
    # (docs/crm/AI_CALL_ACTIONS.md). The artefact vocabulary is CLOSED and comes from
    # the agent's own rules, exactly like `dispositions` — the model may not invent a
    # key admin_core has no rule for, and admin_core drops one that slips through.
    #
    # An agent with no rules gets NO extra prompt text and NO extra keys. This prompt is
    # already large and every agent alive today sends nothing, so the additive path must
    # cost them zero tokens and zero behaviour change.
    artefacts = [str(a).strip() for a in (agent.get("sendArtefacts") or []) if str(a).strip()]
    artefact_spec = (
        f"promisedSends (array, a subset of {artefacts}: ONLY artefacts the assistant "
        "explicitly OFFERED and the caller ACCEPTED on this call — a mention in passing "
        "is NOT a promise, and an artefact the caller declined is NOT a promise. Empty "
        "array if none), "
        "whatsappNumber (the number the caller confirmed for the send, digits with "
        "country code, or null if they accepted but named no number), "
        "email (only if the caller actually spoke an email address; null otherwise), "
        f"declinedSends (array, a subset of {artefacts}: ONLY artefacts the assistant "
        "explicitly OFFERED and the caller REFUSED — 'nahi', 'not now', 'don't send'. An "
        "artefact never offered is NOT declined, and one they simply did not respond to is "
        "NOT declined. Empty array if none).\n"
    ) if artefacts else ""

    # The admin's own trigger conditions, in their words. Closed vocabulary again: the
    # model may only echo back conditions we asked about, so a rule can never fire on a
    # sentence the model invented. Costs nothing when no rule uses one.
    conditions = [str(c).strip() for c in (agent.get("sendConditions") or []) if str(c).strip()]
    condition_spec = (
        f"conditionsMet (array, a subset of {conditions}: return ONLY those statements that "
        "the transcript CLEARLY supports. If a statement is not clearly true, leave it out. "
        "Never invent a statement that is not in that list).\n"
    ) if conditions else ""

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
        "meetingType (short label: 'demo' | 'visit' | 'call' | 'meeting', or null).\n"
        + artefact_spec + condition_spec +
        f"\nTranscript:\n{transcript}\n\nJSON:"
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
                "callbackTimeText": None, **_NO_SENDS}


# Disposition labels that assert a MEETING WAS SECURED. Substring match on a
# normalized label, because the vocabulary is per-agent and we cannot enumerate
# it: "Demo_Booked", "Counselling_Scheduled", "Session_Booked", "Meeting_Fixed".
_BOOKING_LABEL_HINTS = ("book", "schedul", "demo", "meeting", "appointment", "slot")


def _drop_unevidenced_booking(analysis: Dict[str, Any], corr: str) -> None:
    """Refuse a "we booked it" disposition the analyser's OWN evidence contradicts.

    The analysis prompt specifies meetingRequested tightly — "true ONLY if the
    caller AGREED to a scheduled meeting, demo, visit or callback at a specific
    day/time — not vague 'maybe later'" — and asks for a concrete
    meetingDatetimeIso alongside it. The disposition field gets no such
    treatment: the model is handed a bare list of labels with no definitions and
    no requirement to show evidence, and the only validation afterwards is a
    membership check (is the label spelled right), never an evidence check.

    So the same model, in the same JSON response, can return a disposition of
    "Demo_Booked" while reporting meetingRequested=false and no datetime.
    Observed on prod call 775ac5ac (2026-08-14): 23 seconds, the caller asked
    "Where from?", got a pitch instead of an answer, hung up — and the lead was
    stamped Demo_Booked. That row's own ai_summary described no demo at all.

    This is the expensive direction of error. A wrongly-retried lead is
    recoverable; a lead falsely marked as booked is not — nobody follows up,
    and if the agent carries a booking_page_id admin_core's auto-book will
    create a real calendar entry off it.

    Only fires on a DIRECT self-contradiction: a booking-shaped label with
    meetingRequested false AND no resolved datetime. An agent whose vocabulary
    has a softer label ("Demo_Requested") is untouched as long as the model
    supplied evidence for it. Degrades to Incomplete, which routes the lead to
    retry rather than closing it — the same fallback _analyze already uses when
    it cannot judge a call at all.
    """
    try:
        label = str(analysis.get("disposition") or "")
        norm = "".join(ch for ch in label.casefold() if ch.isalnum())
        if not norm or not any(h in norm for h in _BOOKING_LABEL_HINTS):
            return
        if analysis.get("meetingRequested"):
            return
        if str(analysis.get("meetingDatetimeIso") or "").strip():
            return
        logger.warning(
            "report: disposition %r claims a booking but the analyser reported "
            "meetingRequested=%s and no meeting time — degrading to Incomplete "
            "corr=%s", label, analysis.get("meetingRequested"), corr)
        analysis["disposition"] = "Incomplete"
        analysis["dispositionDowngradedFrom"] = label
    except Exception:
        # Never cost the report: an unexpected shape here must leave the
        # analysis exactly as the model returned it.
        logger.exception("report: booking-evidence check failed corr=%s", corr)


# Spoken acceptance, in both scripts saaras actually emits. Deliberately NOT a
# per-artefact word map: artefact keys are per-institute ("scholarship_quiz") and the
# calls are Hinglish, so a key-to-spoken-words map would be right for the one institute
# it was written for and wrong for every other. What IS checkable without guessing is
# whether the caller ever agreed to anything at all.
# Spoken acceptance, in both scripts saaras actually emits. Deliberately NOT a
# per-artefact word map: artefact keys are per-institute ("scholarship_quiz") and the
# calls are Hinglish, so a key-to-spoken-words map would be right for the one institute
# it was written for and wrong for every other. What IS checkable without guessing is
# whether the caller ever agreed to anything at all.
#
# WHOLE WORDS, not substrings. The first cut of this matched substrings and the token
# "ha" fired on "kaun bol raha hai" — a caller asking who we were read as consent to a
# WhatsApp send. "ji" inside "jinke" and "ok" inside "book" are the same trap. Hindi
# verb stems that legitimately need a prefix match get their own tuple below.
_AFFIRMATIVE_WORDS = frozenset({
    "haan", "han", "ha", "hn", "ji", "jee", "achha", "accha", "acha", "theek", "thik",
    "sahi", "bilkul", "ok", "okay", "yes", "yeah", "yep", "sure", "please", "pakka",
    "हाँ", "हां", "हा", "जी", "अच्छा", "ठीक", "सही", "बिल्कुल", "पक्का",
})

# Prefix-matched: these are verb stems whose inflections all mean the same consent
# ("bhej do", "bhejiye", "bhejna", "भेजिए", "भेजना").
_AFFIRMATIVE_PREFIXES = ("bhej", "send", "share", "भेज")

# Punctuation stripped before matching, including the Devanagari danda Sarvam appends
# to almost every final ("हाँ।").
_WORD_STRIP = "।॥.,!?…\"'`~()[]{}:;-–—"


def _sanitize_sends(analysis: Dict[str, Any], outcome: CallOutcome,
                    agent: Dict[str, Any], corr: str) -> None:
    """Keep only the promises we can stand behind. Sibling of _drop_unevidenced_booking.

    The error directions are NOT symmetric, which is why this is stricter than the
    booking guard. A dropped send costs a follow-up message. A send the caller never
    agreed to is an unsolicited WhatsApp on a channel where that is a Meta violation,
    not merely rude — and the number came from a transcript, so it may not even be
    the person we called.

    Four passes: closed vocabulary (the model may not invent an artefact admin_core
    has no rule for), de-duplication, acceptance evidence, and contact sanity.
    """
    try:
        allowed = {str(a).strip() for a in (agent.get("sendArtefacts") or []) if str(a).strip()}
        raw = analysis.get("promisedSends")
        promised = [str(x).strip() for x in raw if str(x).strip()] if isinstance(raw, list) else []

        unknown = [k for k in promised if k not in allowed]
        if unknown:
            logger.warning("report: dropping promised artefact(s) %s with no rule on this "
                           "agent corr=%s", unknown, corr)
        promised = [k for k in promised if k in allowed]

        seen: set = set()
        promised = [k for k in promised if not (k in seen or seen.add(k))]

        # Declines: same closed vocabulary and de-duplication. The evidence bar is
        # deliberately LOWER than for a promise, because the error directions invert -
        # a missed decline means we send something unwanted, so a decline we are unsure
        # about should still count. A refusal also needs no contact details.
        raw_declined = analysis.get("declinedSends")
        declined = ([str(x).strip() for x in raw_declined if str(x).strip()]
                    if isinstance(raw_declined, list) else [])
        declined = [k for k in declined if k in allowed]
        seen_d: set = set()
        declined = [k for k in declined if not (k in seen_d or seen_d.add(k))]
        # An artefact cannot be both accepted and refused on one call. Trust the refusal:
        # sending something the caller may have declined is the expensive mistake.
        both = [k for k in declined if k in promised]
        if both:
            logger.warning("report: %s reported as BOTH promised and declined - treating as "
                           "declined corr=%s", both, corr)
            promised = [k for k in promised if k not in declined]
        analysis["declinedSends"] = declined

        # Custom conditions: closed vocabulary only. The model may echo back a statement
        # the admin wrote, never one it composed, so a rule cannot fire on invented text.
        wanted = {str(c).strip() for c in (agent.get("sendConditions") or []) if str(c).strip()}
        raw_cond = analysis.get("conditionsMet")
        met = ([str(x).strip() for x in raw_cond if str(x).strip()]
               if isinstance(raw_cond, list) else [])
        invented = [c for c in met if c not in wanted]
        if invented:
            logger.warning("report: dropping %d invented condition(s) corr=%s", len(invented), corr)
        analysis["conditionsMet"] = [c for c in met if c in wanted]

        # Evidence. REPORT_REQUIRE_CONVERSATION already guarantees a caller turn exists
        # by the time we get here; this asks the narrower question of whether any of
        # those turns was an agreement.
        if promised:
            words = [w.strip(_WORD_STRIP) for w in
                     " ".join(_caller_turns(outcome)).casefold().split()]
            agreed = any(w in _AFFIRMATIVE_WORDS for w in words) or any(
                w.startswith(_AFFIRMATIVE_PREFIXES) for w in words)
            if not agreed:
                logger.warning("report: analyser claims %s promised but no caller turn "
                               "contains an acceptance — dropping all corr=%s",
                               promised, corr)
                promised = []
        analysis["promisedSends"] = promised

        digits = "".join(ch for ch in str(analysis.get("whatsappNumber") or "") if ch.isdigit())
        analysis["whatsappNumber"] = digits if 10 <= len(digits) <= 15 else None
        email = str(analysis.get("email") or "").strip()
        analysis["email"] = email if (email.count("@") == 1 and " " not in email
                                      and "." in email.split("@")[-1]) else None
    except Exception:
        # Fail CLOSED, unlike the booking guard which leaves the model's answer alone.
        # There, leaving it costs a wrong label; here it would cost a message we cannot
        # prove anyone asked for.
        logger.exception("report: send-evidence check failed — sending nothing corr=%s", corr)
        analysis["promisedSends"] = []
        analysis["whatsappNumber"] = None
        analysis["email"] = None


def _diagnostics_blob(outcome: CallOutcome) -> Optional[Dict[str, Any]]:
    """Never raises: diagnostics are a debugging aid, the report is the product."""
    try:
        d = getattr(outcome, "diagnostics", None)
        if d is None:
            return None
        # Fill in what only the report knows, then freeze the verdict.
        d.user_turns = len(_caller_turns(outcome))
        d.transfer_requested = bool(outcome.transfer_requested)
        d.transfer_registered = bool(outcome.transfer_registered)
        if outcome.crashed:
            d.crash = getattr(outcome, "crash_detail", None) or "pipeline_error"
        d.machine_markers = _machine_markers(outcome)
        return diagnostics.to_payload(d)
    except Exception:
        logger.exception("diagnostics blob failed corr=%s", outcome.corr)
        return None


# Verbatim IVR/voicemail openers seen in the live corpus. EVIDENCE ONLY in v1 —
# scored into the LIKELY_MACHINE fault, never used to change a disposition.
_MACHINE_MARKERS = (
    # English
    "forwarded to voicemail", "leave a message", "after the tone", "not available",
    "switched off", "will be recorded for monitoring", "please hold while",
    "press one", "is currently unavailable", "out of coverage",
    "record your name", "reason for calling", "if this person is available",
    "at the tone", "voice mail", "voicemail",
    # Devanagari. Sarvam's saarika is pinned to hi-IN and TRANSLITERATES English
    # audio into Devanagari, so an English voicemail greeting arrives looking like
    # "इफ यू रिकॉर्ड योर नेम एंड रीज़न फॉर कॉलिंग…" and matched NONE of the ASCII
    # markers above. That is exactly how a voicemail wrote disposition=Callback
    # onto a real lead on 2026-08-03 (corr e461549e).
    "रिकॉर्ड योर नेम", "रीज़न फॉर कॉलिंग", "लीव अ मैसेज", "वॉइस मेल", "वॉइसमेल",
    "अवेलेबल", "आफ्टर द टोन", "स्विच ऑफ", "उपलब्ध नहीं",
)


def _machine_markers(outcome: CallOutcome) -> List[str]:
    hits: List[str] = []
    for t in _caller_turns(outcome)[:3]:
        low = t.lower()
        for m in _MACHINE_MARKERS:
            if m in low and m not in hits:
                hits.append(m)
    return hits


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


async def _ladder_tts_cache(outcome: CallOutcome, diag_blob) -> None:
    """Hand this call's cache candidates to the ledger, off the event loop.

    Total by construction. A cache that learns nothing saves no money, which is a
    very different order of problem from a report that never lands — so nothing
    here may raise, and nothing here may delay the post.
    """
    try:
        cands = getattr(outcome, "tts_candidates", None)
        if cands is None:
            return
        # The PLAYED transcript: assistant entries recorded by
        # PlayedTranscriptRecorder, which sits after transport.output() and so
        # holds only text the transport released at playout position.
        played = " ".join(t.get("text") or "" for t in outcome.transcript
                          if t.get("role") == "assistant")
        blob = diag_blob or {}

        # ONE line per call with the whole story. This is what you grep during a
        # rollout: the diagnostics blob has the same numbers, but reaching it means
        # opening a call in the UI, and the first question is always "is it hitting
        # at all". Only emitted when the cache actually ran — a line of zeroes for
        # every OFF agent would bury the calls that matter.
        tts = blob.get("tts") or {}
        if tts.get("cacheHits") is not None:
            hits, misses = tts.get("cacheHits") or 0, tts.get("cacheMisses") or 0
            total = hits + misses
            logger.info(
                "tts-cache: call summary corr=%s agent=%s hits=%d misses=%d rate=%s "
                "chars_saved=%s secs_saved=%s",
                outcome.corr,
                (outcome.context.get("agent") or {}).get("name") or "?",
                hits, misses,
                f"{(hits / total * 100):.0f}%" if total else "n/a",
                tts.get("cacheCharsSaved"), tts.get("cacheSecsSaved"))

        n = await asyncio.to_thread(
            cands.flush, played_text=played,
            verdict_faults=blob.get("faults") or [],
            health=blob.get("health") or "")
        if n:
            logger.info("tts-cache: laddered %d sentence(s) corr=%s", n, outcome.corr)
            # Render now rather than on the next tick: the sentence this call just
            # qualified should be available to the NEXT call, not five minutes of
            # calls later. The sweeper still defers if the box is carrying load.
            from . import ttswarm
            ttswarm.request_sweep()
    except Exception:
        logger.exception("tts-cache: laddering failed corr=%s", outcome.corr)


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
            **_NO_SENDS,
        }
    else:
        analysis = await _analyze(outcome)
        _drop_unevidenced_booking(analysis, outcome.corr)
    agent = ctx.get("agent") or {}
    _sanitize_sends(analysis, outcome, agent, outcome.corr)

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
        # Artefacts the caller ACCEPTED on the call. admin_core resolves each against
        # the agent's send rules and creates the real WhatsApp/email/meeting action.
        "promisedSends": analysis.get("promisedSends") or [],
        "declinedSends": analysis.get("declinedSends") or [],
        "conditionsMet": analysis.get("conditionsMet") or [],
        "whatsappNumber": analysis.get("whatsappNumber"),
        "email": analysis.get("email"),
        "transferAttempted": outcome.transfer_requested,
        "transferStatus": "registered" if outcome.transfer_registered
                          else ("failed" if outcome.transfer_requested else None),
        # True when the pipeline crashed mid-call — observability for "completed"
        # calls whose conversation was cut short by US rather than the caller.
        "systemError": bool(outcome.crashed),
        # Per-call technical diagnostics: a health verdict + named fault codes +
        # the counters behind them. admin_core's report parser is lenient and
        # stores the verbatim body in ai_call_result.raw_payload, so this is
        # queryable the day it ships, before any backend change. Total by
        # construction — a diagnostics bug must never cost us the report.
        "diagnostics": _diagnostics_blob(outcome),
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
    # The speech cache learns ONLY from calls that worked. _diagnostics_blob above
    # froze the verdict, so this is the first point where G4 (healthy call) can be
    # applied; G3 (the sentence actually reached the caller) reads the very same
    # played transcript this report ships.
    await _ladder_tts_cache(outcome, payload.get("diagnostics"))

    ok = await admin_core.post_report(ctx.get("instituteId"), ctx.get("webhookToken"), payload)
    if not ok:
        spool_report(ctx.get("instituteId"), ctx.get("webhookToken"), payload)
    logger.info("report posted corr=%s ok=%s disposition=%s status=%s",
                outcome.corr, ok, payload["disposition"], payload["status"])
    return ok
