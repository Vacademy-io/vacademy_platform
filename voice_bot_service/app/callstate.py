"""Explicit call state + PURE watchdog decision logic.

Extracted from run_bot's closure-flags (deep-review Wave 2): every production
regression this month was a state-transition bug hiding inside async callbacks,
untestable before a live call. This module makes the state machine a value and
the watchdog a pure function — the timeline test harness drives both with
scripted event sequences and asserts the exact action stream.

Design:
- ``CallState`` is dict-compatible (``state["bot_speaking"]``) so the existing
  frame-processor callbacks keep working unchanged.
- ``watchdog_decide(state, now, cfg)`` is SIDE-EFFECT-FREE and returns a
  ``Decision``; ``apply_decision(state, decision, now)`` performs the state
  bookkeeping; run_bot's watchdog loop performs the I/O per decision kind.
  Branch ORDER mirrors the original loop exactly — order is behavior.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class CallState:
    """All per-call watchdog/turn state. Field comments = transition contract."""

    # Idle clock: any activity (user VAD, bot audio, transcripts) refreshes it.
    t: float = 0.0
    # Idle-nudge bookkeeping: `nudged` re-armed ONLY by real transcripts
    # (VAD blips re-arming it made the hangup escalation unreachable — A10).
    nudged: bool = False
    nudge_count: int = 0
    # True while bot audio is playing / caller is audibly speaking (VAD).
    bot_speaking: bool = False
    user_speaking: bool = False
    # Graceful-stop: set once by _begin_stop; watchdog enforces the deadline and
    # re-issues the (barge-in drainable) EndFrame every ~3s (A7).
    stopping_since: Optional[float] = None
    last_stop_reissue: float = 0.0
    # Last REAL transcribed words (greet gating + orphan discriminator).
    transcript_t: float = 0.0
    # Caller VAD utterance boundaries (orphan discriminator).
    user_started_t: float = 0.0
    user_stopped_t: float = 0.0
    # When bot audio last STOPPED (dedupe scope + orphan turn-stealing guard).
    bot_stopped_t: float = 0.0
    # One-shot guards.
    orphan_used: bool = False
    bot_spoke_once: bool = False
    # Audio-stall watchdog: stamped when a TTS generation begins while the bot
    # is QUIET; cleared on ANY bot-speaking transition (B1 corrected semantics).
    tts_gen_t: float = 0.0
    stall_recoveries: int = 0

    # ── dict-compat so existing callbacks keep working ──
    def __getitem__(self, key: str):
        return getattr(self, key)

    def __setitem__(self, key: str, value) -> None:
        setattr(self, key, value)


@dataclass(frozen=True)
class WatchdogConfig:
    connected_at: float
    cap_secs: float
    idle_timeout_secs: float
    stall_recovery_enabled: bool
    graceful_stop_deadline_secs: float
    stall_after_secs: float = 3.5
    stall_max_recoveries: int = 3
    stop_reissue_every_secs: float = 3.0
    orphan_min_utterance_secs: float = 0.4
    orphan_window_secs: tuple = (2.5, 10.0)
    orphan_bot_quiet_secs: float = 2.0
    orphan_connect_grace_secs: float = 6.0
    max_nudges: int = 2
    # Dead-air escalation: VAD blips (breathing/hold-music) refresh the idle
    # clock, so a noisy dead line never reached the nudge and ran to the
    # duration cap (harness caught this). Independent clock: no REAL words and
    # no bot audio for this long → escalate regardless of VAD activity.
    no_words_timeout_secs: float = 30.0


# Decision kinds — one per watchdog side-effect branch.
NONE = "none"
CANCEL_STARVED = "cancel_starved"
REISSUE_STOP = "reissue_stop"
CAP_FAREWELL = "cap_farewell"
STALL_RECOVER = "stall_recover"
ORPHAN_ASK = "orphan_ask"
NUDGE = "nudge"
IDLE_HANGUP = "idle_hangup"


@dataclass(frozen=True)
class Decision:
    kind: str
    # Diagnostic payload (logged by the caller).
    detail: float = 0.0


def watchdog_decide(s: CallState, now: float, cfg: WatchdogConfig) -> Decision:
    """Pure decision — mirrors the original watchdog branch order EXACTLY."""
    # 1) Graceful-stop enforcement.
    if s.stopping_since is not None:
        if now - s.stopping_since > cfg.graceful_stop_deadline_secs:
            return Decision(CANCEL_STARVED, now - s.stopping_since)
        if now - s.last_stop_reissue > cfg.stop_reissue_every_secs:
            return Decision(REISSUE_STOP)
        return Decision(NONE)

    # 2) Hard call-duration cap. (Deliberately BEFORE the speaking check — the
    #    cap is a spend bound and must fire even mid-conversation.)
    if now - cfg.connected_at >= cfg.cap_secs:
        return Decision(CAP_FAREWELL, now - cfg.connected_at)

    # 3) Idle machinery pauses while either side is audibly speaking.
    if s.bot_speaking or s.user_speaking:
        return Decision(NONE)

    # 4) Audio-stall recovery (flag-gated; corrected stamp semantics assumed).
    if (cfg.stall_recovery_enabled and s.tts_gen_t > 0
            and now - s.tts_gen_t > cfg.stall_after_secs
            and s.stall_recoveries < cfg.stall_max_recoveries):
        return Decision(STALL_RECOVER, now - s.tts_gen_t)

    # 5) VAD-orphan: caller audibly spoke, no transcript since the utterance
    #    BEGAN (finals land mid-speech, so comparing against utterance START is
    #    the only correct discriminator — the stopped_t variant steamrolled).
    lo, hi = cfg.orphan_window_secs
    if (s.user_stopped_t > 0 and not s.orphan_used
            and s.user_started_t > s.transcript_t
            and s.user_started_t > 0
            and s.user_stopped_t - s.user_started_t >= cfg.orphan_min_utterance_secs
            and lo <= now - s.user_stopped_t <= hi
            and now - s.bot_stopped_t >= cfg.orphan_bot_quiet_secs
            and now - cfg.connected_at > cfg.orphan_connect_grace_secs):
        return Decision(ORPHAN_ASK, now - s.user_stopped_t)

    # 6) Idle nudge → capped escalation to hangup. Two clocks:
    #    - `t` (any activity — pauses while either side audibly speaks);
    #    - dead-air (real words / bot audio only — VAD blips can't refresh it,
    #      or a noisy dead line idles forever; harness: noisy_line test).
    idle_reached = now - s.t >= cfg.idle_timeout_secs
    last_signal = max(s.transcript_t, s.bot_stopped_t, cfg.connected_at)
    dead_air_reached = now - last_signal >= cfg.no_words_timeout_secs
    if not idle_reached and not dead_air_reached:
        return Decision(NONE)
    if not s.nudged and s.nudge_count < cfg.max_nudges:
        return Decision(NUDGE)
    return Decision(IDLE_HANGUP)


def apply_decision(s: CallState, d: Decision, now: float) -> None:
    """State bookkeeping for a decision (I/O stays with the caller)."""
    if d.kind == REISSUE_STOP:
        s.last_stop_reissue = now
    elif d.kind == STALL_RECOVER:
        s.tts_gen_t = 0.0
        s.stall_recoveries += 1
    elif d.kind == ORPHAN_ASK:
        s.orphan_used = True
        s.t = now
    elif d.kind == NUDGE:
        s.nudged = True
        s.nudge_count += 1
        s.t = now
