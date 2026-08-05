"""Table tests for the PURE mid-reply turn decisions (app/turntake.py) and the
duck timing branches in app/callstate.py.

The word-list decisions are the product behavior the founder signed off
("absorb but never lose", 2026-08-05): every row below is reviewable as data.
The asymmetry under test: when unsure, INTERRUPT — wrongly stopping the bot
costs a moment; wrongly steamrolling the caller costs the call.
"""
from app.turntake import mid_reply_action, ABSORB, INTERRUPT
from app.callstate import (
    CallState, WatchdogConfig, watchdog_decide, apply_decision,
    NONE, DUCK_RESUME, CAP_FAREWELL, ARM_STOP, ORPHAN_ASK, NUDGE,
)

T0 = 1000.0


def cfg(**over):
    base = dict(connected_at=T0, cap_secs=600.0, idle_timeout_secs=8.0,
                stall_recovery_enabled=True, graceful_stop_deadline_secs=25.0)
    base.update(over)
    return WatchdogConfig(**base)


# ── classifier: ABSORB rows (the live ANSWER_DELETED samples must all pass) ──

def test_absorbs_live_deleted_backchannels():
    # Straight from prod diagnostics answersDeletedSamples (2026-08-04/05 calls,
    # incl. the founder's own 8e1e00ad test call).
    for t in ("हाँ।", "अच्छा।", "बोलिए।", "जी हाँ", "ठीक है।", "हांजी",
              "अच्छा बढ़िया है।", "बहुत बढ़िया।"):
        assert mid_reply_action(t) == ABSORB, t


def test_absorbs_roman_and_english_acks():
    for t in ("haan", "haan ji", "hmm", "okay", "theek hai", "yes sir",
              "accha", "ok ok", "right", "बिल्कुल"):
        assert mid_reply_action(t) == ABSORB, t


def test_absorbs_empty_text():
    assert mid_reply_action("") == ABSORB
    assert mid_reply_action("   ") == ABSORB


def test_extra_backchannels_param():
    assert mid_reply_action("zabardast") == INTERRUPT
    assert mid_reply_action("zabardast", extra_backchannels=frozenset({"zabardast"})) == ABSORB


# ── classifier: INTERRUPT rows ──

def test_interrupts_negations_even_with_acks():
    for t in ("नहीं", "नहीं।", "haan nahi", "no no", "ठीक है लेकिन",
              "हाँ पर", "nahi chahiye"):
        assert mid_reply_action(t) == INTERRUPT, t


def test_interrupts_questions():
    for t in ("आप AI हो क्या?", "haan?", "kya?", "कौन？"):
        assert mid_reply_action(t) == INTERRUPT, t


def test_interrupts_content_words():
    # One-word REAL answers — the exact class pipecat's min-words path deleted
    # (live losses: IGCSE, Symbiosis, Monday). These must become real turns.
    for t in ("IGCSE", "Symbiosis", "Monday", "अगर आप रिकॉर्ड योर।",
              "मुझे दो minute दीजिए", "hello", "हैलो", "रुको", "suniye"):
        assert mid_reply_action(t) == INTERRUPT, t


def test_interrupts_past_word_cap():
    assert mid_reply_action("haan haan haan") == ABSORB
    assert mid_reply_action("haan haan haan haan") == INTERRUPT


# ── duck timing (pure watchdog branches) ──

def test_duck_resumes_after_wordless_sound():
    """VAD heard a cough over the reply; no transcript ever arrives. The hold
    releases duck_no_words_resume_secs after the sound ended — not at the idle
    nudge, not at the orphan ask."""
    s = CallState(t=T0, ducked_since=T0 + 1.0, user_speaking=False,
                  user_stopped_t=T0 + 1.5, bot_spoke_once=True)
    c = cfg()
    assert watchdog_decide(s, T0 + 2.0, c).kind == NONE      # 0.5s since stop
    d = watchdog_decide(s, T0 + 3.6, c)                       # 2.1s since stop
    assert d.kind == DUCK_RESUME
    apply_decision(s, d, T0 + 3.6)
    assert s.ducked_since == 0.0


def test_duck_holds_while_caller_still_speaking():
    """No resume while the caller is mid-utterance — they are the turn now."""
    s = CallState(t=T0, ducked_since=T0 + 1.0, user_speaking=True,
                  user_started_t=T0 + 1.0)
    c = cfg()
    assert watchdog_decide(s, T0 + 5.0, c).kind == NONE
    # ...until the absolute ceiling: a lost transcript can never mute the bot.
    assert watchdog_decide(s, T0 + 13.5, c).kind == DUCK_RESUME


def test_duck_pauses_idle_machinery():
    """While ducked the silence is OURS — no nudge, no orphan re-ask."""
    s = CallState(t=T0, ducked_since=T0 + 1.0, user_speaking=False,
                  user_started_t=T0 + 0.5, user_stopped_t=T0 + 1.4,
                  bot_spoke_once=True)
    c = cfg(duck_no_words_resume_secs=60.0, duck_max_hold_secs=120.0)
    for t in range(2, 12):
        assert watchdog_decide(s, T0 + t, c).kind == NONE, t


def test_cap_still_fires_while_ducked():
    """The duration cap is a spend bound — a hold must not defer it."""
    s = CallState(t=T0, ducked_since=T0 + 599.0, user_speaking=True)
    c = cfg(cap_secs=600.0)
    assert watchdog_decide(s, T0 + 600.5, c).kind == CAP_FAREWELL


def test_no_arm_stop_while_farewell_tail_is_ducked():
    """Goodbye said, caller backchannels over it, tail held: the line must not
    close while the held tail could still play."""
    s = CallState(t=T0, ducked_since=T0 + 10.0, end_pending_since=T0 + 9.0,
                  user_speaking=True)
    c = cfg()
    assert watchdog_decide(s, T0 + 12.0, c).kind == NONE


def test_unducked_flow_unchanged():
    """ducked_since == 0 must be byte-identical to the old decision flow."""
    s = CallState(t=T0, bot_spoke_once=True)
    c = cfg()
    decisions = []
    for t in range(1, 12):
        d = watchdog_decide(s, T0 + t, c)
        apply_decision(s, d, T0 + t)
        decisions.append(d.kind)
    assert NUDGE in decisions            # idle nudge at 8s, exactly as before
    assert DUCK_RESUME not in decisions
