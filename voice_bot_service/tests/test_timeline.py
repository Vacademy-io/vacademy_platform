"""Scripted call-timeline tests over the PURE watchdog (app/callstate.py).

Each test replays a REAL production incident as a timeline of state
transitions + 1s watchdog ticks and asserts the exact decision stream.
No pipecat needed — this is the harness that gates every Wave-2+ change.
"""
from app.callstate import (
    CallState, WatchdogConfig, watchdog_decide, apply_decision,
    NONE, CANCEL_STARVED, REISSUE_STOP, CAP_FAREWELL, STALL_RECOVER,
    ORPHAN_ASK, NUDGE, IDLE_HANGUP,
)

T0 = 1000.0


def cfg(**over):
    base = dict(connected_at=T0, cap_secs=600.0, idle_timeout_secs=8.0,
                stall_recovery_enabled=True, graceful_stop_deadline_secs=25.0)
    base.update(over)
    return WatchdogConfig(**base)


def run_ticks(state, c, start, end, step=1.0, events=None):
    """Tick the watchdog over [start,end); apply timed events; return decisions."""
    events = sorted(events or [], key=lambda e: e[0])
    out = []
    t = start
    ei = 0
    while t < end:
        while ei < len(events) and events[ei][0] <= t:
            events[ei][1](state)
            ei += 1
        d = watchdog_decide(state, t, c)
        apply_decision(state, d, t)
        out.append((t, d.kind))
        t += step
    return out


def kinds(decisions):
    return [k for _, k in decisions if k != NONE]


# ── INCIDENT: 2026-07-27 repeat-3x (stall false-fire after multi-clause reply) ─

def test_multi_clause_reply_never_false_stalls():
    """Corrected stamp semantics: clause-2 generation during playout must NOT
    stamp, and BotStopped clears any stamp — so a healthy long reply produces
    zero STALL_RECOVER decisions even with recovery ENABLED."""
    s = CallState(t=T0)
    c = cfg()

    def clause1_gen(st):   # bot quiet → stamps
        if not st.bot_speaking and st.tts_gen_t == 0.0:
            st.tts_gen_t = T0 + 1.0
    def audio_start(st):   # BotStarted → clears (both transitions clear now)
        st.bot_speaking = True
        st.tts_gen_t = 0.0
        st.t = T0 + 1.5
    def clause2_gen(st):   # generated DURING playout → corrected gate refuses
        if not st.bot_speaking and st.tts_gen_t == 0.0:
            st.tts_gen_t = T0 + 2.0
    def audio_stop(st):    # BotStopped → clears unconditionally
        st.bot_speaking = False
        st.tts_gen_t = 0.0
        st.bot_stopped_t = T0 + 8.0
        st.t = T0 + 8.0

    ds = run_ticks(s, c, T0 + 1.0, T0 + 16.0, events=[
        (T0 + 1.0, clause1_gen),
        (T0 + 1.5, audio_start),
        (T0 + 2.0, clause2_gen),
        (T0 + 8.0, audio_stop),
    ])
    assert STALL_RECOVER not in kinds(ds), kinds(ds)


def test_true_stall_recovers_once_then_caps():
    """Reply generated while quiet, audio NEVER starts → exactly one
    STALL_RECOVER >3.5s later per stamp; total capped at 3."""
    s = CallState(t=T0)
    c = cfg()
    s.tts_gen_t = T0 + 1.0          # generation, bot quiet
    ds = run_ticks(s, c, T0 + 2.0, T0 + 8.0)
    assert kinds(ds).count(STALL_RECOVER) == 1
    # stamp cleared by apply; re-stamp twice more → cap at 3 total
    for i in range(4):
        s.tts_gen_t = T0 + 10.0 + i * 10
        ds += run_ticks(s, c, T0 + 11.0 + i * 10, T0 + 19.0 + i * 10)
    assert kinds(ds).count(STALL_RECOVER) == 3   # cap enforced


# ── INCIDENT: "Yeah, I'm Shreyash" swallowed → orphan asks to repeat ─────────

def test_true_swallow_fires_orphan_once():
    s = CallState(t=T0)
    c = cfg()
    s.bot_stopped_t = T0 + 5.0
    # caller speaks 7.0→7.6s, NO transcript ever arrives
    s.user_started_t = T0 + 7.0
    s.user_stopped_t = T0 + 7.6
    ds = run_ticks(s, c, T0 + 8.0, T0 + 14.0)
    assert kinds(ds).count(ORPHAN_ASK) == 1


def test_normal_turn_never_orphans():
    """Regression #1 (steamroll): finals land WHILE the caller speaks; the
    started_t discriminator must yield NONE for every normal utterance."""
    s = CallState(t=T0)
    c = cfg()
    s.bot_stopped_t = T0 + 5.0
    s.user_started_t = T0 + 7.0
    s.transcript_t = T0 + 7.4      # final arrived mid-speech
    s.user_stopped_t = T0 + 7.6
    s.t = T0 + 7.6
    ds = run_ticks(s, c, T0 + 8.0, T0 + 14.0)
    assert ORPHAN_ASK not in kinds(ds)


def test_heard_and_deduped_repeat_never_orphans():
    """Wave-1 A1: a dropped duplicate still stamps transcript_t — the orphan
    must not apologise for words that were heard."""
    s = CallState(t=T0)
    c = cfg()
    s.bot_stopped_t = T0 + 5.0
    s.user_started_t = T0 + 7.0
    s.user_stopped_t = T0 + 7.6
    s.transcript_t = T0 + 7.8      # stamped by the dedupe drop path
    ds = run_ticks(s, c, T0 + 8.0, T0 + 14.0)
    assert ORPHAN_ASK not in kinds(ds)


def test_orphan_never_steals_turn_at_bot_stop():
    """Orphan requires the bot quiet ≥2s — it must not fire the instant the
    bot finishes its own question."""
    s = CallState(t=T0)
    c = cfg()
    s.user_started_t = T0 + 7.0
    s.user_stopped_t = T0 + 7.6
    s.bot_stopped_t = T0 + 9.5     # bot just stopped talking
    ds = run_ticks(s, c, T0 + 10.0, T0 + 11.0)
    assert ORPHAN_ASK not in kinds(ds)


# ── INCIDENT: noisy line nudged for 10 minutes (A10) ─────────────────────────

def test_noisy_line_nudges_capped_then_hangs_up():
    """VAD blips refresh the idle clock's *speaking* pause but no longer
    re-arm `nudged`; after 2 nudges the line hangs up."""
    s = CallState(t=T0)
    c = cfg()
    seen = []
    t = T0 + 1.0
    while t < T0 + 120.0:
        d = watchdog_decide(s, t, c)
        apply_decision(s, d, t)
        if d.kind != NONE:
            seen.append((t, d.kind))
        if d.kind == IDLE_HANGUP:
            break
        # noise blip every 3s: refreshes idle clock ONLY (on_activity), never
        # `nudged` (transcript-gated now)
        if int(t - T0) % 3 == 0:
            s.t = t
        t += 1.0
    ks = [k for _, k in seen]
    assert ks.count(NUDGE) <= 2
    assert ks[-1] == IDLE_HANGUP
    assert seen[-1][0] < T0 + 120.0   # exits long before the duration cap


# ── INCIDENT: barge-in eats the farewell's EndFrame (A7) ─────────────────────

def test_stopping_reissues_end_then_hard_cancels():
    s = CallState(t=T0)
    c = cfg()
    s.stopping_since = T0 + 10.0
    ds = run_ticks(s, c, T0 + 11.0, T0 + 40.0)
    ks = kinds(ds)
    assert REISSUE_STOP in ks                     # keeps replacing drained EndFrames
    assert ks[-1] == CANCEL_STARVED               # deadline still enforced
    # reissues are rate-limited (~3s cadence, not every tick)
    assert ks.count(REISSUE_STOP) <= 10


# ── Duration cap fires even mid-speech (spend bound) ─────────────────────────

def test_cap_fires_even_while_speaking():
    s = CallState(t=T0)
    c = cfg(cap_secs=30.0)
    s.bot_speaking = True
    ds = run_ticks(s, c, T0 + 29.0, T0 + 32.0)
    assert CAP_FAREWELL in kinds(ds)


# ── Stall recovery honours the kill switch ───────────────────────────────────

def test_stall_disabled_never_fires():
    s = CallState(t=T0)
    c = cfg(stall_recovery_enabled=False)
    s.tts_gen_t = T0 + 1.0
    ds = run_ticks(s, c, T0 + 2.0, T0 + 30.0)
    assert STALL_RECOVER not in kinds(ds)
