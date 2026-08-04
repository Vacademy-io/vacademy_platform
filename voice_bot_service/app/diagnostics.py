"""Per-call technical diagnostics — collection, and a PURE health verdict.

Why this exists: diagnosing three founder-flagged calls in 2026-07 took a
forensic sweep of ~140k log lines across 220 calls on the box. Every signal that
investigation needed was already known to this process at call time; it was just
never carried anywhere. This module carries it, so the next "the agent took ages
and I had to repeat myself" is a hover in the admin UI, not an SSH session.

Design mirrors app/callstate.py deliberately:
  * a plain dataclass of counters (no pipecat imports, no I/O),
  * PURE functions (``verdict``) the scripted harness can drive,
  * a TOTAL ``to_payload()`` that can never raise into the report path.

Cost discipline: this runs on a 1-vCPU box carrying live calls. Everything here
is per-TURN or per-EVENT — never per audio frame — and every reservoir is
bounded, so a 10-minute call cannot produce megabytes.

Honesty discipline: a signal we could not measure is ``None``, NEVER 0. Reading
"0 answers deleted" when we actually went blind is how a fleet chart says "fixed"
about something that isn't; that mistake is exactly what this module exists to
prevent. ``src`` marks whether a fault is MEASURED or INFERRED.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

# Bump when a threshold or a fault definition changes. Stored with every call so
# health can be re-derived across history without re-collecting anything.
RULES_VERSION = 2

# ── fault codes: CLOSED, APPEND-ONLY ─────────────────────────────────────────
# Renaming one silently breaks every row already stored. test_diagnostics.py
# pins this set; adding is fine, renaming/removing fails CI.
CRASH = "CRASH"
TTS_WEDGE = "TTS_WEDGE"
REPLY_UNPLAYED = "REPLY_UNPLAYED"
ANSWER_DELETED = "ANSWER_DELETED"
DEAD_AIR = "DEAD_AIR"
FALSE_REASK = "FALSE_REASK"
LIKELY_MACHINE = "LIKELY_MACHINE"
STT_DEAF = "STT_DEAF"
SLOW_TTS = "SLOW_TTS"
SLOW_LLM = "SLOW_LLM"
TRANSFER_FAILED = "TRANSFER_FAILED"
PROMPT_UNFILLED = "PROMPT_UNFILLED"

ALL_FAULTS = (
    CRASH, TTS_WEDGE, REPLY_UNPLAYED, ANSWER_DELETED, DEAD_AIR, FALSE_REASK,
    LIKELY_MACHINE, STT_DEAF, SLOW_TTS, SLOW_LLM, TRANSFER_FAILED, PROMPT_UNFILLED,
)

# Headline = the first FIRED fault in this order, so UI copy is deterministic.
# Ordered by what the CALLER experienced, not by internal severity. Being unable
# to hear them outranks a TTS stall: on live call 393859bc the headline read
# "Voice synthesis stalled" while the actual story was that the caller repeated
# "hybrid model" four times and we never once transcribed it.
HEADLINE_PRIORITY = (
    CRASH, STT_DEAF, TTS_WEDGE, REPLY_UNPLAYED, ANSWER_DELETED, DEAD_AIR,
    FALSE_REASK, LIKELY_MACHINE, SLOW_TTS, SLOW_LLM, TRANSFER_FAILED,
    PROMPT_UNFILLED,
)

GREEN, AMBER, RED = "GREEN", "AMBER", "RED"
_RANK = {GREEN: 0, AMBER: 1, RED: 2}

_MAX_SAMPLES = 200          # bounded reservoirs
_MAX_UNFILLED_KEYS = 12
_MAX_DELETED_ANSWERS = 20


def _p(values: List[float], pct: float) -> Optional[float]:
    """Nearest-rank percentile; None for an empty sample."""
    if not values:
        return None
    xs = sorted(values)
    k = max(0, min(len(xs) - 1, int(round((pct / 100.0) * len(xs) + 0.5)) - 1))
    return round(xs[k], 3)


@dataclass
class CallDiagnostics:
    """Per-call counters. Mutated by cheap hooks; never read by call logic."""

    # ── TTS health (the founder's 8-10.4s dead-air root cause) ──
    tts_letterless_skipped: int = 0     # our fix firing = the wedge TRIGGER blocked
    tts_wedges: int = 0                 # Sarvam rejected input; socket open-but-dead
    tts_wedge_reconnects: int = 0       # forced rebuilds of a wedged socket
    tts_stalls: int = 0                 # STALL_RECOVER decisions
    tts_stall_cap_hit: bool = False     # gave up: permanently silent from here
    tts_silent_generations: int = 0     # generated, no audio ever followed

    # ── playout truth ──
    replies_generated: int = 0
    replies_never_played: int = 0

    # ── turn-taking ──
    orphan_reasks: int = 0
    orphan_false_reasks: int = 0        # a real final landed right after: we heard it
    nudges: int = 0
    idle_hangup: bool = False
    cap_farewell: bool = False
    barge_ins: int = 0
    # None = NOT MEASURED (never 0-by-default — see module docstring).
    answers_deleted: Optional[int] = None
    answers_deleted_samples: List[str] = field(default_factory=list)

    # ── caller/agent shape (feeds the machine heuristic) ──
    user_turns: int = 0
    bot_turns: int = 0
    first_user_secs: Optional[float] = None
    longest_user_secs: float = 0.0
    machine_markers: List[str] = field(default_factory=list)

    # ── latency reservoirs ──
    llm_ttfb: List[float] = field(default_factory=list)
    tts_ttfb: List[float] = field(default_factory=list)
    stt_ttfb: List[float] = field(default_factory=list)
    dead_air: List[float] = field(default_factory=list)

    # ── vendor spend: the vendor's OWN meter, not our arithmetic ──
    # tts_vendor_credits stays None unless a terminal frame actually carried a
    # figure. Rumik currently reports credits_used: 0 on our key, and 0 is
    # indistinguishable from unmetered — so we count the metered requests
    # separately. "12 requests metered, 0 credits" reads as a broken meter;
    # a bare 0 would read as a free call, which is a lie we would then bill on.
    tts_vendor: str = ""
    tts_vendor_credits: Optional[float] = None
    tts_meter_frames: int = 0
    tts_audio_secs: float = 0.0
    tts_chars: int = 0

    # ── infrastructure ──
    stt_reconnects: int = 0
    hearing_failures: int = 0     # times we gave up and closed out honestly
    # Caller utterances DETECTED by VAD that produced no transcript at all. This
    # is the only signal that separates "nobody answered" from "we went deaf".
    unheard_utterances: int = 0
    greet_path: str = ""                # "scripted" | "callee_spoke_first" | "llm"
    greet_delay_secs: Optional[float] = None
    setup_secs: Optional[float] = None
    prompt_unfilled: List[str] = field(default_factory=list)
    crash: Optional[str] = None
    transfer_requested: bool = False
    transfer_registered: bool = False

    # ── cheap, total hooks (never raise into call logic) ──
    def bump(self, name: str, by: int = 1) -> None:
        try:
            setattr(self, name, getattr(self, name) + by)
        except Exception:
            pass

    def sample(self, name: str, value: float) -> None:
        try:
            buf: List[float] = getattr(self, name)
            if len(buf) < _MAX_SAMPLES:
                buf.append(float(value))
        except Exception:
            pass

    def note_tts_spend(self, credits, audio_secs, chars=0) -> None:
        """Terminal-frame hook. TOTAL: a metering bug must not touch the call."""
        try:
            self.tts_meter_frames += 1
            if credits:
                self.tts_vendor_credits = (self.tts_vendor_credits or 0.0) + float(credits)
            self.tts_audio_secs += float(audio_secs or 0.0)
            self.tts_chars += int(chars or 0)
        except Exception:
            pass

    def note_unfilled(self, key: str) -> None:
        try:
            if key not in self.prompt_unfilled and len(self.prompt_unfilled) < _MAX_UNFILLED_KEYS:
                self.prompt_unfilled.append(str(key)[:40])
        except Exception:
            pass

    def note_deleted_answer(self, text: str) -> None:
        try:
            if self.answers_deleted is None:
                self.answers_deleted = 0
            self.answers_deleted += 1
            if len(self.answers_deleted_samples) < _MAX_DELETED_ANSWERS:
                self.answers_deleted_samples.append(str(text)[:60])
        except Exception:
            pass


def _norm_answer(text: str) -> str:
    """Loose key for matching a caller final against what the model received.
    Case/punctuation/whitespace-insensitive so 'SSC.' == 'ssc'."""
    return "".join(ch for ch in (text or "").casefold() if ch.isalnum())


def reconcile_answers(heard: List[str], delivered: List[str]) -> tuple:
    """PURE. Which caller answers never reached the model?

    ``heard``    = finals TranscriptCollector recorded (it sits BEFORE
                   aggregators.user() in the pipeline, so it sees words the
                   aggregator later deletes).
    ``delivered`` = user messages actually present in the LLM context.

    Returns (count, samples). This is the ground truth for the biggest finding
    of the 2026-07 forensics: pipecat's aggregator DELETES caller utterances
    (min_words + the emulated-VAD path) — 179 of them across 40% of calls,
    including the literal answers IGCSE, Symbiosis, Monday. They never reach the
    model, the transcript, or the report, and nothing re-asks for them.

    Multiset difference, so a genuine repeat ("SSC." twice) is not miscounted.
    """
    pool: Dict[str, int] = {}
    for m in delivered:
        k = _norm_answer(m)
        if k:
            pool[k] = pool.get(k, 0) + 1
    missing: List[str] = []
    for h in heard:
        k = _norm_answer(h)
        if not k:
            continue
        if pool.get(k, 0) > 0:
            pool[k] -= 1
        else:
            missing.append(h)
    return len(missing), missing[:_MAX_DELETED_ANSWERS]


def machine_score(d: CallDiagnostics) -> float:
    """Bounded 0..1 heuristic that a machine, not a person, answered. INFERRED —
    v1 is EVIDENCE ONLY and never changes status or disposition."""
    score = 0.0
    if d.machine_markers:
        score += 0.5
    if d.user_turns <= 1 and d.bot_turns >= 2:
        score += 0.2
    if d.longest_user_secs >= 6.0:      # an uninterrupted recorded announcement
        score += 0.2
    if d.barge_ins == 0 and d.user_turns <= 2:
        score += 0.1
    return round(min(1.0, score), 2)


def verdict(d: CallDiagnostics) -> Dict[str, Any]:
    """PURE: counters -> (health, faults, headline). Thresholds live HERE only."""
    faults: Dict[str, str] = {}

    def fire(code: str, level: str) -> None:
        if _RANK[level] > _RANK.get(faults.get(code, GREEN), 0):
            faults[code] = level

    if d.crash:
        fire(CRASH, RED)

    if d.tts_stall_cap_hit or d.tts_stalls >= 2 or (d.tts_stalls >= 1 and d.tts_silent_generations >= 1):
        fire(TTS_WEDGE, RED)
    elif d.tts_stalls == 1 or d.tts_wedges >= 1 or d.tts_letterless_skipped >= 1:
        fire(TTS_WEDGE, AMBER)

    if d.replies_never_played >= 2:
        fire(REPLY_UNPLAYED, RED)
    elif d.replies_never_played == 1:
        fire(REPLY_UNPLAYED, AMBER)

    if d.answers_deleted is not None:          # None = not measured: never fires
        if d.answers_deleted >= 3:
            fire(ANSWER_DELETED, RED)
        elif d.answers_deleted >= 1:
            fire(ANSWER_DELETED, AMBER)

    # DEAD_AIR only means something in a CONVERSATION. If the caller never took a
    # turn, the "silence" is simply nobody answering — the bot greeting a voicemail
    # or an empty line — and the call status already says no-answer. Marking that
    # "Broken" made an unanswered dial look like a system failure and would make
    # the fleet view mostly red for a non-problem (seen live: userTurns=0,
    # idleHangup, verdict RED "Long silence during the call").
    worst_gap = max(d.dead_air) if d.dead_air else 0.0
    if d.user_turns == 0:
        pass                                   # nobody to be silent AT
    elif worst_gap >= 6.0:
        fire(DEAD_AIR, RED)
    elif worst_gap >= 3.5:                     # below STALL_AFTER_SECS nothing was detectable
        fire(DEAD_AIR, AMBER)

    if d.orphan_false_reasks >= 3:
        fire(FALSE_REASK, RED)
    elif d.orphan_false_reasks >= 1:
        fire(FALSE_REASK, AMBER)

    ms = machine_score(d)
    if ms >= 0.7:
        fire(LIKELY_MACHINE, RED)
    elif ms >= 0.5:
        fire(LIKELY_MACHINE, AMBER)

    # "We could not hear the caller" is the most caller-visible failure there is —
    # they answer, we apologise, they answer again. Giving up and closing out is
    # always RED regardless of how the sockets behaved.
    # A call where the caller SPOKE but we transcribed nothing is the worst
    # outcome there is, and it used to score GREEN: user_turns==0 suppressed
    # DEAD_AIR (correct for an unanswered dial), and reconnects/hearing_failures
    # can both be 0 when the socket is healthy but silent. A live call rated
    # GREEN while the caller said "Hello" seven times into nothing.
    heard_nothing = d.unheard_utterances >= 1 and d.user_turns == 0
    if d.hearing_failures >= 1 or d.stt_reconnects >= 3 or heard_nothing:
        fire(STT_DEAF, RED)
    elif d.stt_reconnects >= 1 or d.unheard_utterances >= 1:
        fire(STT_DEAF, AMBER)

    for code, buf in ((SLOW_TTS, d.tts_ttfb), (SLOW_LLM, d.llm_ttfb)):
        if len(buf) >= 5:
            p95 = _p(buf, 95) or 0.0
            if p95 > 3.0:
                fire(code, RED)
            elif p95 > 1.5:
                fire(code, AMBER)

    if d.transfer_requested and not d.transfer_registered:
        fire(TRANSFER_FAILED, AMBER)

    if d.prompt_unfilled:
        fire(PROMPT_UNFILLED, AMBER)           # config bug, never call breakage

    health = GREEN
    for level in faults.values():
        if _RANK[level] > _RANK[health]:
            health = level
    headline = next((c for c in HEADLINE_PRIORITY if c in faults), None)
    return {"health": health, "faults": faults, "headline": headline}


_HEADLINE_TEXT = {
    CRASH: "Pipeline crashed mid-call",
    TTS_WEDGE: "Voice synthesis stalled — caller heard silence",
    REPLY_UNPLAYED: "A reply was never played to the caller",
    ANSWER_DELETED: "Caller answers were discarded before the agent saw them",
    DEAD_AIR: "Long silence during the call",
    FALSE_REASK: "Agent re-asked for answers it had already heard",
    LIKELY_MACHINE: "Probably an answering machine, not a person",
    STT_DEAF: "The agent could not hear the caller",
    SLOW_TTS: "Slow voice synthesis",
    SLOW_LLM: "Slow agent responses",
    TRANSFER_FAILED: "Human transfer was requested but failed",
    PROMPT_UNFILLED: "Agent prompt has unresolved placeholders",
}


def to_payload(d: CallDiagnostics) -> Dict[str, Any]:
    """TOTAL: builds the report blob. Must never raise — a diagnostics bug can
    never be allowed to cost us the report itself."""
    try:
        v = verdict(d)
        return {
            "rulesVersion": RULES_VERSION,
            "health": v["health"],
            "faults": sorted(v["faults"].keys()),
            "faultLevels": v["faults"],
            "headline": v["headline"],
            "headlineText": _HEADLINE_TEXT.get(v["headline"]) if v["headline"] else None,
            "tts": {
                "letterlessSkipped": d.tts_letterless_skipped,
                "wedges": d.tts_wedges,
                "wedgeReconnects": d.tts_wedge_reconnects,
                "stalls": d.tts_stalls,
                "stallCapHit": d.tts_stall_cap_hit,
                "silentGenerations": d.tts_silent_generations,
                "ttfbP50": _p(d.tts_ttfb, 50), "ttfbP95": _p(d.tts_ttfb, 95),
                "ttfbMax": round(max(d.tts_ttfb), 3) if d.tts_ttfb else None,
                "vendor": d.tts_vendor or None,
                # None = the vendor told us nothing. Never rendered as zero cost.
                "vendorCredits": (round(d.tts_vendor_credits, 4)
                                  if d.tts_vendor_credits is not None else None),
                "meteredRequests": d.tts_meter_frames or None,
                "audioSecs": round(d.tts_audio_secs, 2) if d.tts_audio_secs else None,
                "chars": d.tts_chars or None,
            },
            "playout": {
                "repliesGenerated": d.replies_generated,
                "repliesNeverPlayed": d.replies_never_played,
            },
            "turnTaking": {
                "userTurns": d.user_turns, "botTurns": d.bot_turns,
                "bargeIns": d.barge_ins,
                "orphanReasks": d.orphan_reasks,
                "orphanFalseReasks": d.orphan_false_reasks,
                "nudges": d.nudges,
                "idleHangup": d.idle_hangup, "capFarewell": d.cap_farewell,
                # None here means NOT MEASURED — the UI must not render it as 0.
                "answersDeleted": d.answers_deleted,
                "answersDeletedSamples": d.answers_deleted_samples or None,
                "answersDeletedSrc": "measured" if d.answers_deleted is not None else None,
            },
            "latency": {
                "llmTtfbP50": _p(d.llm_ttfb, 50), "llmTtfbP95": _p(d.llm_ttfb, 95),
                "sttTtfbP50": _p(d.stt_ttfb, 50), "sttTtfbP95": _p(d.stt_ttfb, 95),
                "deadAirP95": _p(d.dead_air, 95),
                "deadAirMax": round(max(d.dead_air), 3) if d.dead_air else None,
            },
            "setup": {
                "greetPath": d.greet_path or None,
                "greetDelaySecs": d.greet_delay_secs,
                "setupSecs": d.setup_secs,
            },
            "machine": {
                "score": machine_score(d),
                "markers": d.machine_markers or None,
                "firstUserSecs": d.first_user_secs,
                "longestUserSecs": round(d.longest_user_secs, 2) or None,
                "src": "inferred",
            },
            "infra": {
                "sttReconnects": d.stt_reconnects,
                "hearingFailures": d.hearing_failures,
                "unheardUtterances": d.unheard_utterances,
                "promptUnfilled": d.prompt_unfilled or None,
                "crash": d.crash,
                "transferRequested": d.transfer_requested,
                "transferRegistered": d.transfer_registered,
            },
        }
    except Exception:  # pragma: no cover - belt and braces
        return {"rulesVersion": RULES_VERSION, "health": None, "error": "diagnostics_failed"}
