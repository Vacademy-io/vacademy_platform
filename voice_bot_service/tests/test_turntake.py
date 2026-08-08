"""Table tests for the PURE mid-reply turn decisions (app/turntake.py) and the
duck timing branches in app/callstate.py.

The word-list decisions are the product behavior the founder signed off
("absorb but never lose", 2026-08-05): every row below is reviewable as data.
The asymmetry under test: when unsure, INTERRUPT — wrongly stopping the bot
costs a moment; wrongly steamrolling the caller costs the call.
"""
from app.turntake import mid_reply_action, ABSORB, INTERRUPT, is_carrier_announcement, suppresses_opening
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
    #
    # "hello"/"हैलो" were in this list until 2026-08-06 and were MOVED to the
    # absorb set on purpose: see test_hello_mid_reply_absorbs_so_the_sentence_
    # can_resume. Interrupting on them cost call 77cb4b47 — the reply was
    # cancelled, the model re-asked the same question, the caller said "hello?"
    # at the silence, and round it went. "रुको"/"suniye" (stop / listen) stay
    # here: those really are instructions to stop.
    for t in ("IGCSE", "Symbiosis", "Monday", "अगर आप रिकॉर्ड योर।",
              "मुझे दो minute दीजिए", "रुको", "suniye"):
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


# ── Rumik term normalization (providers.normalize_for_rumik is import-safe:
# pipecat imports in providers.py are module-level and CI installs them) ──

def test_normalize_for_rumik_replaces_transliterated_terms():
    from app.providers import normalize_for_rumik
    m = (("लाइव क्लासेस", "Live Classes"), ("क्लासेस", "classes"))
    out = normalize_for_rumik("हमारी लाइव क्लासेस के बारे में।", term_map=m)
    assert out == "हमारी Live Classes के बारे में।"
    # longest key wins; bare word still handled on its own
    assert normalize_for_rumik("क्लासेस अच्छी हैं", term_map=m) == "classes अच्छी हैं"
    # untouched text passes through byte-identical
    assert normalize_for_rumik("नमस्ते जी", term_map=m) == "नमस्ते जी"


def test_default_term_map_is_longest_first():
    from app.config import Settings
    lens = [len(k) for k, _ in Settings().rumik_term_map]
    assert lens == sorted(lens, reverse=True)
    assert ("लाइव क्लासेस", "Live Classes") in Settings().rumik_term_map


# ── call 77cb4b47 (2026-08-06): the restart loop and its trigger ───────────
def test_hello_mid_reply_absorbs_so_the_sentence_can_resume():
    """The founder heard the same question four times in eleven seconds because
    every "hello?" cancelled the reply and the model re-asked from the top.
    Interrupting never restored their audio; resuming the held sentence does."""
    for word in ("hello", "Hello.", "हेलो", "hello hello", "haan hello"):
        assert mid_reply_action(word) == ABSORB, word


def test_a_real_question_mid_reply_still_interrupts():
    """Absorbing "hello" must not swallow actual questions — "क्या पूछा आपने?"
    on the same call WAS a real turn and had to stop the bot."""
    assert mid_reply_action("क्या पूछा आपने?") == INTERRUPT
    assert mid_reply_action("hello, fees kitni hai?") == INTERRUPT
    assert mid_reply_action("nahi") == INTERRUPT


def test_carrier_announcements_are_not_the_callee():
    """Verbatim from the Sarvam finals on call 77cb4b47 — including the
    truncated form, since partial finals are what actually arrive."""
    for t in ("Your call has been forwarded to voicemail.",
              "Your call has been forwarded to voicemai",
              "The person you're trying to reach is not available.",
              "The subscriber you have dialled is currently busy.",
              "आप जिस नंबर पर संपर्क कर रहे हैं वह इस समय उपलब्ध नहीं है।"):
        assert is_carrier_announcement(t), t


def test_real_callers_are_not_mistaken_for_the_network():
    for t in ("Haan ji main parent bol raha hoon", "Raman", "Class eighth mein hai",
              "Hello", "fees kitni hogi?", "68 percent aaye the"):
        assert not is_carrier_announcement(t), t


# ── voicemail fragments (2026-08-06, calls 0d61b32a / 9668da21) ───────────
def test_every_fragment_that_killed_a_live_opening_is_caught():
    """Sarvam splits the SAME operator sentence differently on different calls.
    One call gave 'Your call has been forwarded to voicemail.' (matched); the
    next gave 'Your call.' + 'Has been forwarded to voicemail.' — the first
    fragment matched nothing, counted as the callee, and killed our opening."""
    for frag in ("Your call.", "Has been forwarded to voicemail.",
                 "If you record your", "forwarded to voicemail",
                 "The person you're", "trying to reach"):
        assert is_carrier_announcement(frag), frag


def test_a_greeting_or_fragment_never_suppresses_our_opening():
    for t in ("Hi.", "Hello.", "Your call.", "If you record your", "हेलो", ""):
        assert not suppresses_opening(t), t


def test_a_caller_who_really_takes_over_still_suppresses_it():
    """The greet-skip exists for a reason: someone who answers with a real
    question should get an answer, not a scripted pitch over the top of it."""
    for t in ("aap kaun bol rahe hain bhai",
              "main abhi busy hoon baad mein call karein",
              "haan ji main parent bol raha hoon"):
        assert suppresses_opening(t), t
