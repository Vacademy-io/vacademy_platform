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

# The "I cannot judge this call" label. Every degraded path already wrote this
# string; it is named here because it now has a THIRD job beyond the sentinel and
# the heuristic fallback: it is offered to the model as an explicit, legal answer
# (see _analyze), so a thin transcript has somewhere to go other than a guess.
#
# It is deliberately the same label admin_core's classifier routes to RETRY. An
# unjudgeable call should be re-dialled, never closed.
_INSUFFICIENT = "Incomplete"


def _transcript_text(transcript: List[Dict[str, str]]) -> str:
    return "\n".join(f"{t['role']}: {t['text']}" for t in transcript if t.get("text"))


def _now_stamp(now: dt.datetime) -> str:
    """"Wednesday, 9 September 2026, 4:00 PM" — the un-padded day and hour the
    analyser is given to resolve "tomorrow 3pm" against.

    Assembled by hand rather than with strftime("%A, %-d %B %Y, %-I:%M %p"): the
    `%-d` / `%-I` no-padding modifiers are a glibc extension and raise
    ValueError("Invalid format string") on Windows, which made _analyze — and so
    every prompt assertion about it — impossible to unit-test off the container.
    Output is byte-identical to the glibc format on Linux.
    """
    return (f"{now.strftime('%A')}, {now.day} {now.strftime('%B')} {now.year}, "
            f"{now.hour % 12 or 12}:{now.strftime('%M')} {now.strftime('%p')}")


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

# ── call sentiment ───────────────────────────────────────────────────────────
# A one-line verdict on HOW THE CALL WENT, shown next to the disposition. It grades
# OUR AGENT, not the lead's interest: leadRating already scores the lead, and
# diag_health already scores the audio pipeline but is blind to whether the
# conversation itself worked — every fabricated disposition in the 2026-09-09 audit
# sat on a GREEN call with no faults.
#
# Closed vocabulary, because it drives a colour chip in the admin UI.
_SENTIMENT_LEVELS = ("GOOD", "NEEDS_WORK", "POOR")
# Kept short on purpose: this is a gist for a table cell, not an analysis. The
# prompt asks for one sentence and this is the hard backstop.
_GIST_MAX_CHARS = 180

# NULL means NOT ASSESSED, never "fine" — the same contract as diag_health in V416.
# Every degraded or skipped path returns these keys explicitly rather than omitting
# them, so a missing key is indistinguishable from an assessed-and-empty one.
_NO_SENTIMENT: Dict[str, Any] = {"callQuality": None, "callGist": None}


async def _analyze(outcome: CallOutcome) -> Dict[str, Any]:
    s = get_settings()
    agent = outcome.context.get("agent") or {}
    dispositions = agent.get("dispositions") or [
        "Interested", "Likely_Interested", "Callback", "Not_Interested", _INSUFFICIENT,
    ]
    # The model MUST have a legal way to say "the transcript does not support any of
    # these". Most agent vocabularies are pure outcome labels (Demo_Booked, Not_
    # Interested, Wrong_Person, …) with no such option, so the model was being asked
    # to pick an outcome for a call that had none — and it obliged, inventing the
    # conversation that would justify its pick. Observed on institute 3716991c
    # (2026-09-09): 13 of 31 near-silent calls got a decisive label, one of them a
    # Demo_Booked with a fabricated name, member count, platform and meeting time
    # from a transcript whose only caller turn was "Hello."
    #
    # Appended, never substituted: the admin's own vocabulary is untouched, and the
    # membership check below already treats this label as valid on every agent.
    if _INSUFFICIENT not in dispositions:
        dispositions = [*dispositions, _INSUFFICIENT]
    questions = agent.get("extractionQuestions") or []
    transcript = _transcript_text(outcome.transcript)
    if not transcript.strip():
        return {"disposition": _INSUFFICIENT, "summary": "No conversation captured.",
                "leadRating": None, "extractedQa": {}, "callbackRequested": False,
                "callbackTimeText": None, "meetingRequested": False,
                "meetingDatetimeIso": None, "meetingDatetimeText": None,
                "meetingType": None, **_NO_SENDS, **_NO_SENTIMENT}

    # Current date/time so the analyser can resolve relative dates spoken on the call
    # ("tomorrow 3pm", "day after") into a concrete ISO instant. Same tz convention as
    # the live prompt (agent tz, default Asia/Kolkata).
    tzname = (agent.get("timezone") or outcome.context.get("timezone") or "Asia/Kolkata").strip()
    try:
        now = dt.datetime.now(ZoneInfo(tzname))
    except Exception:
        tzname, now = "Asia/Kolkata", dt.datetime.now(ZoneInfo("Asia/Kolkata"))
    now_stamp = _now_stamp(now)
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
        # Evidence discipline. Without this the model was handed a bare list of labels
        # with no definitions and no requirement to show its work, so on a transcript
        # of "Hello." it picked a plausible-sounding outcome and then wrote the
        # supporting facts to match — including the meetingRequested/meetingDatetimeIso
        # pair that _drop_unevidenced_booking cross-checks, defeating that guard from
        # inside the same JSON response.
        "EVIDENCE RULES — these override every other instruction below:\n"
        "1. Judge ONLY what the transcript literally contains. Never infer, complete or "
        "imagine a turn that is not there. A transcript often ends mid-sentence because "
        "the caller hung up — that is not a conversation for you to finish on their "
        "behalf.\n"
        f"2. If the transcript does not clearly support any other label, answer "
        f"\"{_INSUFFICIENT}\". A greeting, a silence, or a bare 'yes'/'haan'/'ok' with no "
        "further content is NOT evidence of interest, identity, refusal or a booking. "
        f"\"{_INSUFFICIENT}\" is a CORRECT and expected answer on a short or one-sided "
        "call — always prefer it to a guess.\n"
        "3. Never state a name, phone number, platform, member count, price, place or "
        "time the caller did not actually say. In extractedQa use null for every "
        "question the caller did not answer; do not fill one in from what a business "
        "like theirs would probably say.\n"
        "4. A booking/demo/meeting/callback label requires BOTH that the caller agreed "
        "AND that a specific day or time was spoken on the call. If no time was agreed, "
        "the label is not a booking, meetingRequested is false and meetingDatetimeIso "
        "is null.\n"
        f"RIGHT NOW it is {now_stamp} ({tzname}, UTC offset {now_offset}). Use this to resolve any "
        "relative day the caller mentioned into an exact date.\n"
        f"Return STRICT JSON with keys: disposition (exactly one of {dispositions} — "
        f"\"{_INSUFFICIENT}\" whenever the evidence is thin), "
        "summary (2-3 sentences), leadRating (integer 1-10 interest score or null), "
        "extractedQa (object: question -> answer, only what was actually said"
        + (f"; questions of interest: {questions}" if questions else "")
        + "), callbackRequested (boolean), callbackTimeText (string or null), "
        "meetingRequested (boolean: true ONLY if the caller AGREED to a scheduled meeting, demo, "
        "visit or callback at a specific day/time — not vague 'maybe later'), "
        "meetingDatetimeIso (ISO 8601 with offset for the agreed meeting time resolved from RIGHT "
        f"NOW, e.g. '2026-07-23T15:00:00{now_offset}', or null if none agreed), "
        "meetingDatetimeText (the caller's own words for the time, e.g. 'tomorrow 3 pm', or null), "
        "meetingType (short label: 'demo' | 'visit' | 'call' | 'meeting', or null), "
        # Grades OUR side of the call, deliberately NOT the lead's interest —
        # leadRating already does that. Asked for last so the model has already
        # committed to a disposition before it judges the handling.
        f"callQuality (one of {list(_SENTIMENT_LEVELS)}: how well the ASSISTANT handled "
        "this call — GOOD = it asked, listened and progressed the conversation; "
        "NEEDS_WORK = it got through but talked over the caller, repeated itself, "
        "missed answers or left the goal unaddressed; POOR = the caller could not be "
        "understood or served at all. Judge OUR performance, not whether the lead was "
        "interested — a polite refusal handled well is GOOD), "
        "callGist (ONE short sentence, under 25 words, plain and specific, naming the "
        "single thing that most needs improving if any, e.g. 'Good call — she agreed "
        "to a demo, but the bot cut her off twice while she answered.' No preamble, "
        "no restating the disposition).\n"
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
        _coerce_disposition(parsed, dispositions, outcome.corr)
        return parsed
    except Exception:
        logger.exception("analysis failed corr=%s — degrading to heuristic", outcome.corr)
        return {"disposition": _INSUFFICIENT,
                "summary": "Automatic analysis unavailable; see transcript.",
                "leadRating": None, "extractedQa": {}, "callbackRequested": False,
                "callbackTimeText": None, **_NO_SENDS, **_NO_SENTIMENT}


def _sanitize_sentiment(analysis: Dict[str, Any], corr: str) -> None:
    """Closed vocabulary + a length cap on the gist.

    callQuality drives a colour chip, so an unrecognised value must become NULL
    ("not assessed") rather than reach the UI as a mystery string — and NULL must
    never be rendered as GOOD. The gist is model prose, so it is trimmed to one
    line and hard-capped; the prompt asks for one sentence but a cap is cheaper
    than trusting that.
    """
    try:
        raw = str(analysis.get("callQuality") or "").strip()
        norm = raw.upper().replace(" ", "_").replace("-", "_")
        if norm and norm not in _SENTIMENT_LEVELS:
            logger.info("report: unrecognised callQuality %r — recording as not assessed "
                        "corr=%s", raw, corr)
        analysis["callQuality"] = norm if norm in _SENTIMENT_LEVELS else None

        gist = str(analysis.get("callGist") or "").strip()
        # Collapse any newlines the model adds: this lands in a single table cell.
        gist = " ".join(gist.split())
        if len(gist) > _GIST_MAX_CHARS:
            gist = gist[:_GIST_MAX_CHARS - 1].rstrip() + "…"
        analysis["callGist"] = gist or None
    except Exception:
        # A cosmetic field must never cost the report.
        logger.exception("report: sentiment sanitise failed corr=%s", corr)
        analysis["callQuality"] = None
        analysis["callGist"] = None


def _caller_word_count(outcome: CallOutcome) -> int:
    """How many words the caller actually contributed.

    A MEASURED fact, not a model judgement, which is the point: admin_core routes
    on it (see AiCallOutcomeClassifier's engaged-but-unjudged branch), and routing a
    lead to a human must not depend on the same model whose label we distrusted.
    """
    return sum(len(t.split()) for t in _caller_turns(outcome))


def _norm_label(s: Any) -> str:
    """Alphanumerics only, casefolded — so "Demo_Booked", "demo booked" and
    "DemoBooked" are one label. Separator and case drift is the model restyling a
    label we gave it, not choosing a different one."""
    return "".join(ch for ch in str(s).casefold() if ch.isalnum())


def _coerce_disposition(parsed: Dict[str, Any], dispositions: List[str], corr: str) -> None:
    """Force the model's label into the agent's vocabulary, recovering near-misses.

    The membership check this replaces was exact-match, and a label that missed was
    overwritten with the sentinel and then FORGOTTEN — no log, no field, nothing.
    That silently destroyed real judgements: in the 2026-09-09 audit of institute
    3716991c, five substantive conversations (one 230s call where the prospect spelled
    out that he tracks attendance and payments by hand — a textbook qualified lead)
    all landed on Incomplete and were routed to retry instead of to a human, and the
    label the model had actually chosen was unrecoverable after the fact.

    Two changes. Case/separator drift is now RECOVERED rather than discarded, and a
    label that genuinely is not in the vocabulary is logged and preserved on
    `dispositionRawLabel` so the next occurrence is diagnosable from the report
    instead of requiring a transcript read.

    Still coerces rather than trusting an unknown label: admin_core keys retry,
    assignment and lead status off this string, so a label it has no rule for must
    not reach it. The sentinel routes to retry, which is the recoverable direction.
    """
    label = parsed.get("disposition")
    raw = str(label).strip() if label is not None else ""
    if raw in dispositions:
        return

    target = _norm_label(raw)
    if target:
        for d in dispositions:
            if _norm_label(d) == target:
                if d != raw:
                    logger.info("report: disposition %r normalised to %r corr=%s", raw, d, corr)
                parsed["disposition"] = d
                return

    if raw:
        parsed["dispositionRawLabel"] = raw
        logger.warning(
            "report: disposition %r is not in this agent's vocabulary %s — coercing to "
            "%s (lead goes to retry, not closed) corr=%s",
            raw, dispositions, _INSUFFICIENT, corr)
    parsed["disposition"] = _INSUFFICIENT


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

    A booking-shaped label now requires BOTH halves of the evidence: the caller
    agreed (meetingRequested) AND a concrete time was resolved
    (meetingDatetimeIso). The first cut of this guard early-returned on EITHER
    signal, so half-evidence was enough to keep the label — and prod call
    0519330a (2026-09-09, institute 3716991c) walked straight through it:
    24 seconds, the caller's entire contribution was "Hello / Okay / Yes / Yeah /
    Yes", the model returned meetingRequested=true with meetingDatetimeIso=None,
    and the lead was stamped Demo_Booked. A demo with no time is not a booking,
    whatever the model asserts about the caller's enthusiasm.

    An agent whose vocabulary has a softer label ("Demo_Requested") is untouched:
    the hints below only match labels that CLAIM a secured slot. Degrades to
    Incomplete, which routes the lead to retry rather than closing it — the same
    fallback _analyze already uses when it cannot judge a call at all.
    """
    try:
        label = str(analysis.get("disposition") or "")
        norm = _norm_label(label)
        if not norm or not any(h in norm for h in _BOOKING_LABEL_HINTS):
            return
        agreed = bool(analysis.get("meetingRequested"))
        when = str(analysis.get("meetingDatetimeIso") or "").strip()
        if agreed and when:
            return
        logger.warning(
            "report: disposition %r claims a booking but the analyser reported "
            "meetingRequested=%s and meeting time %r — degrading to %s corr=%s",
            label, analysis.get("meetingRequested"), when or None, _INSUFFICIENT, corr)
        analysis["disposition"] = _INSUFFICIENT
        analysis["dispositionDowngradedFrom"] = label
        # A label we just refused must not leave its own evidence standing —
        # admin_core auto-books off meetingRequested + meetingDatetimeIso
        # independently of the disposition, so leaving them would create the very
        # calendar entry this guard exists to prevent.
        analysis["meetingRequested"] = False
        analysis["meetingDatetimeIso"] = None
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


# Caller words that carry NO classifiable content on their own: greetings, openers,
# backchannel and forms of address. Bare AFFIRMATIONS count as contentless too and
# are reused from _AFFIRMATIVE_WORDS above rather than duplicated — "yes" in answer
# to "do you have two minutes?" says nothing about interest, identity or a booking.
#
# NEGATIONS are deliberately ABSENT from both sets, so a caller whose only word was
# "no" / "nahi" / "नहीं" still reaches the classifier. That is the case
# _is_conversation's docstring protects: forcing a refusal to Incomplete flips a STOP
# into retry and re-dials someone who already said no. Thin evidence of a refusal is
# still evidence, and honouring it errs toward not calling back.
#
# WHOLE WORDS after stripping punctuation, per the "ha" / "kaun bol raha hai" trap
# documented on _AFFIRMATIVE_WORDS.
_GREETING_WORDS = frozenset({
    "hello", "helo", "hallo", "hi", "hey", "namaste", "namaskar", "salaam", "sat",
    "sriakal", "sir", "madam", "maam", "mam", "ji", "hmm", "hm", "mm", "mmm", "uh",
    "um", "uhh", "huh", "eh", "aa", "haa", "speaking", "who", "kaun", "kon", "boliye",
    "bolo", "bol", "kahiye", "hn",
    "हेलो", "हैलो", "नमस्ते", "नमस्कार", "सर", "मैडम", "जी", "कौन", "बोलिए", "बोलो",
    "कहिए", "हम्म", "हूँ", "हूं",
})


def _has_substance(outcome: CallOutcome) -> bool:
    """Did the caller contribute anything a disposition could actually rest on?

    _is_conversation asks whether the caller spoke AT ALL; this asks whether what
    they said carries meaning. The gap between those two questions is where the
    fabrications lived: a bare "Hello." is one caller turn, so it passed that gate,
    reached the classifier, and the classifier — asked to pick an outcome label for a
    call that had no outcome — invented one along with the conversation that would
    justify it.

    Measured on institute 3716991c, 2026-09-09: 31 of 77 calls had the caller
    contributing three words or fewer, and 13 of those were stamped with a decisive
    disposition. Call ee49966e is the limit case — 8 seconds, caller said only
    "Hello.", the bot's own opening line still mid-sentence, and the report claimed a
    named prospect had agreed to a demo at a specific time, ran 50 members on Zoom and
    distributed links by hand. Every one of those facts was generated, and the
    fabricated meetingRequested/meetingDatetimeIso pair also walked it past
    _drop_unevidenced_booking.

    A call failing this test is NOT a judgement that the lead is uninterested — it is
    a refusal to guess. It routes to Incomplete and therefore to retry, which is what
    should happen to someone who picked up and never got a word in.
    """
    words = [w.strip(_WORD_STRIP) for w in
             " ".join(_caller_turns(outcome)).casefold().split()]
    return any(w and w not in _GREETING_WORDS and w not in _AFFIRMATIVE_WORDS
               for w in words)


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
    # _is_conversation — nor one where their only words were a greeting or a bare
    # "yes" — see _has_substance. Skipping _analyze also saves the LLM round trip on
    # the 17% of dials that are answering machines.
    #
    # Two independent kill-switches because the gates carry different risk: the
    # caller-turn test has been live for months, the substance floor is newer and
    # strictly stricter. REPORT_REQUIRE_SUBSTANCE=false reverts only the new gate.
    s = get_settings()
    no_turn = s.report_require_conversation and not _is_conversation(outcome)
    no_substance = s.report_require_substance and not _has_substance(outcome)
    if no_turn or no_substance:
        # Distinct summaries on purpose: these two reasons are told apart by
        # fingerprinting ai_summary when auditing a batch, and collapsing them would
        # hide which gate is carrying the volume.
        if no_turn:
            reason = "no caller turn captured"
            summary = "No two-sided conversation took place (no caller turn captured)."
        else:
            reason = "caller said nothing beyond a greeting or bare acknowledgement"
            summary = ("No substantive conversation took place (caller said nothing "
                       "beyond a greeting or bare acknowledgement).")
        logger.info("report: %s corr=%s (%d caller turns) — forcing %s, skipping analysis",
                    reason, outcome.corr, len(_caller_turns(outcome)), _INSUFFICIENT)
        analysis = {
            "disposition": _INSUFFICIENT,
            "summary": summary,
            "leadRating": None, "extractedQa": {}, "callbackRequested": False,
            "callbackTimeText": None, "meetingRequested": False,
            "meetingDatetimeIso": None, "meetingDatetimeText": None, "meetingType": None,
            **_NO_SENDS,
            # Sentiment is NOT assessed here rather than stamped POOR: a caller who
            # said nothing is not evidence our agent handled the call badly, and the
            # analyser never ran to judge it either way.
            **_NO_SENTIMENT,
            "callGist": "No conversation to assess — " + reason + ".",
        }
    else:
        analysis = await _analyze(outcome)
        _drop_unevidenced_booking(analysis, outcome.corr)
        _sanitize_sentiment(analysis, outcome.corr)
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
        # Diagnosis only. Set when a guard overrode the model (dispositionRawLabel = a
        # label outside the agent's vocabulary, dispositionDowngradedFrom = a booking
        # claim we refused). admin_core's parser reads named keys and ignores the rest,
        # so these ride along in raw_payload and answer "what did the model actually
        # say before we overruled it?" without a schema change or a transcript read.
        "dispositionRawLabel": analysis.get("dispositionRawLabel"),
        "dispositionDowngradedFrom": analysis.get("dispositionDowngradedFrom"),
        # One-line verdict on how the call went, shown beside the disposition.
        # NULL quality = not assessed; never render it as GOOD.
        "callQuality": analysis.get("callQuality"),
        "callGist": analysis.get("callGist"),
        # MEASURED caller engagement. admin_core routes an unjudged-but-engaged call
        # to a human off this number rather than off the model's label — see
        # AiCallOutcomeClassifier. Always present, including on the gated paths where
        # no analysis ran at all.
        "callerWordCount": _caller_word_count(outcome),
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
    ok = await admin_core.post_report(ctx.get("instituteId"), ctx.get("webhookToken"), payload)
    if not ok:
        spool_report(ctx.get("instituteId"), ctx.get("webhookToken"), payload)
    logger.info("report posted corr=%s ok=%s disposition=%s status=%s",
                outcome.corr, ok, payload["disposition"], payload["status"])

    # AFTER the post, deliberately. The speech cache learns only from calls that
    # worked, and _diagnostics_blob above already froze the verdict this needs —
    # but laddering writes to SQLite, which can block on the sweeper's lock for
    # up to the connect timeout. A report that lands late strands a paused
    # CALL_AI workflow; a sentence learned late costs one vendor render. Those
    # are not the same order of problem, so the report goes first.
    await _ladder_tts_cache(outcome, payload.get("diagnostics"))
    return ok
