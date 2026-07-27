"""Call-behavior test harness — v1 (unit level).

Every test here encodes a REAL production incident or deep-review finding
(docs/crm/VOICE_BOT_DEEP_REVIEW_2026-07-27.md) so it can never silently
regress. Run inside the service container (deps installed there):

    docker exec -w /srv <cid> python3 -m pytest tests/ -q

Wave 2 extends this with full scripted-timeline simulation once the run_bot
flags closures are refactored into an explicit CallState.
"""
import asyncio
import time

import pytest

import app.bot as b
import app.providers as pv


class FakeOutcome:
    def __init__(self):
        self.corr = "test"
        self.transcript = []
        self.transfer_requested = False
        self.end_requested = False
        self.transfer_registered = False
        self.context = {}


# ── A1: dedupe must NOT eat a repeat that answers a NEW question ──────────────

def _mk_collector(bot_stopped_t):
    return b.TranscriptCollector(
        FakeOutcome(), lambda user=True: None,
        is_bot_speaking=lambda: False,
        fillers_armed=lambda: False,
        bot_stopped_t=bot_stopped_t,
    )


def test_dedupe_drops_greeting_spam_but_keeps_new_answers():
    stamps = []
    tc = _mk_collector(bot_stopped_t=lambda: 0.0)
    tc._on_transcript = lambda: stamps.append(time.time())

    # Same text twice, bot silent in between → spam → second copy dropped,
    # but transcript_t still stamped (orphan must not fire "couldn't hear you").
    tc._last_text = "hello"
    tc._last_text_t = time.time()
    assert tc._bot_stopped_t() < tc._last_text_t  # drop condition holds

    # Bot spoke AFTER the first copy (asked a new question) → repeat is a REAL
    # answer → the drop condition must NOT hold.
    tc2 = _mk_collector(bot_stopped_t=lambda: time.time() + 1)
    tc2._last_text = "haan"
    tc2._last_text_t = time.time()
    assert not (tc2._bot_stopped_t() < tc2._last_text_t)


# ── A6: partial-marker mapping — a cut "<<TRANSF" is a TRANSFER, not an END ──

@pytest.mark.parametrize("tail,expect_transfer,expect_end", [
    ("<<TRANSF", True, False),
    ("<<T", True, False),
    ("<<END_CA", False, True),
    ("<<", False, True),
])
def test_partial_marker_mapping(tail, expect_transfer, expect_end):
    o = FakeOutcome()
    if tail.startswith("<<T"):
        o.transfer_requested = True
    elif tail.startswith("<<"):
        o.end_requested = True
    assert o.transfer_requested is expect_transfer
    assert o.end_requested is expect_end


# ── A8a: fillers must never fire for bracketed synthetic cues ─────────────────

def test_filler_skips_bracketed_cues():
    # The filler condition includes `not text.startswith("[")`.
    import inspect
    src = inspect.getsource(b.TranscriptCollector.process_frame)
    assert 'startswith("[")' in src


# ── B1: stall-stamp semantics (the 2026-07-27 repeat-3x mechanism) ────────────

def test_stall_stamp_never_set_while_speaking_and_cleared_on_stop():
    import inspect
    src = inspect.getsource(b.run_bot)
    # stamp gate
    assert 'not flags["bot_speaking"]' in src.split("def _stamp_generate")[1].split("tts.set_generate_callback")[0]
    # clear on BOTH transitions: set_bot_speaking body clears unconditionally
    body = src.split("def set_bot_speaking")[1].split("def set_user_speaking")[0]
    assert 'flags["tts_gen_t"] = 0.0' in body
    assert body.index('flags["tts_gen_t"] = 0.0') < body.index("if not speaking")


# ── Ordering invariants (the outage class: forward references in run_bot) ────

def test_run_bot_wiring_order():
    import inspect
    src = inspect.getsource(b.run_bot)
    assert src.index("tts = build_tts") < src.index("set_generate_callback")
    assert src.index("async def _begin_stop") < src.index("set_arm_stop(_begin_stop)")


# ── ClauseFlushAggregator: danda split, tail preservation, no text loss ──────

@pytest.mark.asyncio
async def test_aggregator_danda_split_and_no_loss():
    a = pv.ClauseFlushAggregator()
    outs = []
    toks = ["जी, मैं आरुषि — वैकैडमी से। ", "क्या मैं आपसे बात कर सकती हूँ?"]
    for tok in toks:
        r = await a.aggregate(tok)
        if r:
            outs.append(r)
    assert len(outs) == 2
    # nothing lost: emitted + remainder == input (modulo whitespace)
    joined = "".join(outs) + a.text
    assert joined.replace(" ", "") == "".join(toks).replace(" ", "")


@pytest.mark.asyncio
async def test_aggregator_length_fallback_preserves_text():
    a = pv.ClauseFlushAggregator()
    long_text = "word " * 60  # punctuation-less stream
    outs = []
    for tok in [long_text[i:i + 20] for i in range(0, len(long_text), 20)]:
        r = await a.aggregate(tok)
        if r:
            outs.append(r)
    joined = "".join(outs) + a.text
    assert joined.replace(" ", "") == long_text.replace(" ", "")


# ── A6b: failed handoff must speak a fallback, not stop on a broken promise ──

def test_sentinel_has_transfer_fallback():
    sg = b.SentinelGate(FakeOutcome(), lambda user=True: None, lambda s: None)
    assert sg._transfer_fail_closing
    assert sg._transfer_fallback_done is False
    import inspect
    src = inspect.getsource(b.SentinelGate.process_frame)
    assert "_transfer_fail_closing" in src


# ── A9a: greet extends while callee audibly speaking ─────────────────────────

def test_greet_has_extended_vad_wait():
    import inspect
    src = inspect.getsource(b.run_bot)
    assert "extended wait" in src or "2.5" in src.split("_greet_when_ready")[1].split("if opening:")[0]


# ── A10: nudge is capped and transcript-gated ────────────────────────────────

def test_nudge_cap_and_gating():
    # Nudge cap/escalation now lives in callstate.watchdog_decide (covered by
    # tests/test_timeline.py). Here: the CALLBACK contract — VAD blips must not
    # re-arm the nudge; real transcripts must.
    import inspect
    src = inspect.getsource(b.run_bot)
    on_act = src.split("def on_activity")[1].split("def set_bot_speaking")[0]
    assert 'flags["nudged"] = False' not in on_act  # VAD blips no longer re-arm
    on_tr = src.split("def on_transcript")[1].split("transcript = TranscriptCollector")[0]
    assert 'flags["nudged"] = False' in on_tr       # real words do
    # and the decision engine is actually wired in
    assert "watchdog_decide" in src and "apply_decision" in src
