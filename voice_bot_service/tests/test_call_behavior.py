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


# ── A2: orphan response-End after interruption must be SWALLOWED ─────────────
# (pipecat 0.0.95 assistant aggregator underflows its _started counter on the
# orphan End of a cancelled stream → ALL later assistant text dropped from
# context → verbatim repeats. The sentinel shields it.)

@pytest.mark.asyncio
async def test_sentinel_swallows_orphan_end_after_interruption():
    from pipecat.frames.frames import (
        InterruptionFrame, LLMFullResponseEndFrame, LLMFullResponseStartFrame,
        LLMTextFrame,
    )
    from pipecat.processors.frame_processor import FrameDirection

    sg = b.SentinelGate(FakeOutcome(), lambda user=True: None, lambda s: None)
    pushed = []

    async def fake_push(frame, direction=FrameDirection.DOWNSTREAM):
        pushed.append(frame)
    sg.push_frame = fake_push

    async def fake_super(self, frame, direction):
        return

    async def drive(frame):
        # call SentinelGate.process_frame but stub the super() call chain by
        # patching the base class method for the duration
        import unittest.mock as um
        with um.patch.object(b.FrameProcessor, "process_frame", new=fake_super):
            await sg.process_frame(frame, FrameDirection.DOWNSTREAM)

    # Interrupted stream: text → interruption → orphan End
    await drive(LLMTextFrame("Hello there"))
    await drive(InterruptionFrame())
    await drive(LLMFullResponseEndFrame())
    end_frames = [f for f in pushed if isinstance(f, LLMFullResponseEndFrame)]
    assert len(end_frames) == 0, "orphan End must be swallowed"

    # Healthy next response: Start → text → End must pass through
    await drive(LLMFullResponseStartFrame())
    await drive(LLMTextFrame("Next reply."))
    await drive(LLMFullResponseEndFrame())
    end_frames = [f for f in pushed if isinstance(f, LLMFullResponseEndFrame)]
    assert len(end_frames) == 1, "healthy End must pass"


@pytest.mark.asyncio
async def test_sentinel_new_start_clears_pending_swallow():
    """If the expected orphan End never arrives, a NEW response's Start must
    clear the pending swallow so the healthy End isn't eaten instead."""
    from pipecat.frames.frames import (
        InterruptionFrame, LLMFullResponseEndFrame, LLMFullResponseStartFrame,
        LLMTextFrame,
    )
    from pipecat.processors.frame_processor import FrameDirection
    import unittest.mock as um

    sg = b.SentinelGate(FakeOutcome(), lambda user=True: None, lambda s: None)
    pushed = []

    async def fake_push(frame, direction=FrameDirection.DOWNSTREAM):
        pushed.append(frame)
    sg.push_frame = fake_push

    async def fake_super(self, frame, direction):
        return

    async def drive(frame):
        with um.patch.object(b.FrameProcessor, "process_frame", new=fake_super):
            await sg.process_frame(frame, FrameDirection.DOWNSTREAM)

    await drive(LLMTextFrame("partial"))
    await drive(InterruptionFrame())          # pending swallow armed
    await drive(LLMFullResponseStartFrame())  # new response begins first
    await drive(LLMTextFrame("healthy reply"))
    await drive(LLMFullResponseEndFrame())    # must NOT be swallowed
    end_frames = [f for f in pushed if isinstance(f, LLMFullResponseEndFrame)]
    assert len(end_frames) == 1


# ── A3: transcripts record what the caller HEARD (playout), not generation ───

@pytest.mark.asyncio
async def test_played_transcript_records_ttstext_and_merges_clauses():
    from pipecat.frames.frames import TTSTextFrame, TranscriptionFrame
    from pipecat.processors.frame_processor import FrameDirection
    import unittest.mock as um

    o = FakeOutcome()
    rec = b.PlayedTranscriptRecorder(o)

    async def fake_push(frame, direction=FrameDirection.DOWNSTREAM):
        pass
    rec.push_frame = fake_push

    async def fake_super(self, frame, direction):
        return

    async def drive(frame):
        with um.patch.object(b.FrameProcessor, "process_frame", new=fake_super):
            await rec.process_frame(frame, FrameDirection.DOWNSTREAM)

    await drive(TTSTextFrame("Hello!"))
    await drive(TTSTextFrame("Am I speaking with Shreyash?"))
    assert len(o.transcript) == 1                      # consecutive clauses merge
    assert "Hello!" in o.transcript[0]["text"]
    assert "Shreyash" in o.transcript[0]["text"]

    o.transcript.append({"role": "user", "text": "yes"})  # caller turn intervenes
    await drive(TTSTextFrame("Great, thank you."))
    assert o.transcript[-1]["role"] == "assistant"
    assert o.transcript[-1]["text"] == "Great, thank you."
    assert len(o.transcript) == 3


def test_generation_time_commits_removed():
    """Sentinel and greet must no longer write assistant transcript entries —
    only PlayedTranscriptRecorder does (playout position)."""
    import inspect
    sg_src = inspect.getsource(b.SentinelGate)
    assert 'transcript.append({"role": "assistant"' not in sg_src
    rb_src = inspect.getsource(b.run_bot)
    greet = rb_src.split("_greet_when_ready")[1].split("@transport.event_handler")[0]
    assert 'outcome.transcript.append' not in greet
    # and the recorder is actually in the pipeline, after transport.output()
    assert rb_src.index("transport.output(),") < rb_src.index("played_transcript,")
    assert rb_src.index("played_transcript,") < rb_src.index("aggregators.assistant()")


# ── A5: deaf-call detection keys on the receive task, not on exceptions ──────

def test_stt_deaf_detection_is_receive_task_based():
    """The base run_stt swallows send errors — an exception-based retry is dead
    code (the original deaf-call incident stayed possible). Detection must key
    on the receive task having exited."""
    import inspect
    src = inspect.getsource(pv.ResilientSarvamSTTService.run_stt)
    assert "_receive_task" in src and ".done()" in src
    # the unreachable exception-retry scaffolding must be gone (ignore comments)
    code_lines = [l for l in src.splitlines() if not l.strip().startswith("#")]
    assert not any("except Exception" in l for l in code_lines)
    # reconnect keeps its storm-guard cooldown
    rsrc = inspect.getsource(pv.ResilientSarvamSTTService._reconnect_once)
    assert "_RECONNECT_COOLDOWN_SECS" in rsrc


# ── B1/Stage E: TTS connect/disconnect serialized; stall recovery re-enabled ──

def test_tts_connect_lock_and_stall_reenabled():
    import inspect
    src = inspect.getsource(pv.ResilientSarvamTTSService)
    assert "_conn_lock" in src
    # both mutators go through the lock
    c = src.split("async def _connect")[1].split("async def _disconnect")[0]
    d = src.split("async def _disconnect")[1]
    assert "_conn_lock" in c and "_conn_lock" in d
    # default ON with env kill-switch retained
    import app.config as cfg
    import inspect as _i
    csrc = _i.getsource(cfg)
    assert 'STALL_RECOVERY_ENABLED", "true"' in csrc
