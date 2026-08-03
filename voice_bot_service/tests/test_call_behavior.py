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


# ═══ Wave 3 ═══════════════════════════════════════════════════════════════════

import inspect
import json as _json
import os

import app.main as m
import app.report as rpt
import app.admin_core as ac


class _W3Settings:
    """Minimal settings stub for token/spool/cache tests."""

    internal_client_secret = "sekrit"

    def __init__(self, tmp=""):
        self.tts_cache_dir = str(tmp)
        self.tts_cache_max_files = 4000
        self.tts_cache_max_bytes = 500 * 1024 * 1024

    @property
    def report_spool_dir(self):
        return os.path.join(self.tts_cache_dir, "_report_spool")


# ── B4: /ws admission token ──────────────────────────────────────────────────

def test_ws_token_roundtrip_and_rejections(monkeypatch):
    monkeypatch.setattr(m, "get_settings", lambda: _W3Settings())
    tok = m._mint_ws_token("corr-1")
    assert m._verify_ws_token("corr-1", tok)
    # Bound to the corr — a token for one call cannot admit another.
    assert not m._verify_ws_token("corr-2", tok)
    assert not m._verify_ws_token("corr-1", "garbage")
    assert not m._verify_ws_token("corr-1", "")
    assert not m._verify_ws_token("corr-1", "123.deadbeef")
    # Expired token (minted in the past beyond TTL).
    old = m._mint_ws_token("corr-1", now=time.time() - m._WS_TOKEN_TTL_SECS - 60)
    assert not m._verify_ws_token("corr-1", old)


def test_ws_token_open_when_secret_unset(monkeypatch):
    s = _W3Settings()
    s.internal_client_secret = ""
    monkeypatch.setattr(m, "get_settings", lambda: s)
    # Unconfigured dev box: don't brick, the context fetch gates anything real.
    assert m._verify_ws_token("corr-1", "")
    assert m._consume_ws_token("corr-1", "")  # single-use is a no-op without a secret


def test_ws_token_is_single_use(monkeypatch):
    # The DoS-relevant property (deep-review W3): a captured token admits exactly
    # ONE socket. First consume passes; every replay of the same corr+token fails.
    monkeypatch.setattr(m, "get_settings", lambda: _W3Settings())
    m._spent_ws_tokens.clear()
    tok = m._mint_ws_token("corr-1")
    assert m._consume_ws_token("corr-1", tok)          # first use admitted
    assert not m._consume_ws_token("corr-1", tok)      # replay rejected
    assert not m._consume_ws_token("corr-1", tok)      # …and stays rejected
    # A genuinely different token (minted in a later second → different exp) for the
    # same corr is still fine. NB tokens are deterministic in (corr, exp-second), so
    # a real call — which mints once — is never self-blocked.
    tok2 = m._mint_ws_token("corr-1", now=time.time() + 5)
    assert tok2 != tok
    assert m._consume_ws_token("corr-1", tok2)
    # A forged/expired token never consumes.
    assert not m._consume_ws_token("corr-1", "garbage")
    m._spent_ws_tokens.clear()


def test_ws_route_gates_token_and_decouples_slot_from_handshake():
    src = inspect.getsource(m.ws_endpoint)
    # Single-use consume (not bare verify) gates the socket.
    assert "_consume_ws_token(corr" in src
    # Pending-handshake bucket is entered BEFORE the handshake; the real call slot
    # (_active_calls) is claimed only AFTER it — a stalled handshake never holds a
    # running-call slot (deep-review W3 DoS fix).
    assert "_inflight_handshakes += 1" in src
    assert src.index("_inflight_handshakes += 1") < src.index("asyncio.wait_for")
    assert src.index("asyncio.wait_for") < src.index("_active_calls += 1")
    # Both buckets are released in the finally via held-flags.
    assert "_inflight_held" in src and "_active_slot" in src
    assert "outcome.crashed = True" in src
    answer_src = inspect.getsource(m.answer)
    assert "_mint_ws_token(corr)" in answer_src      # /answer actually mints it


# ── B4: public TTS cache is bounded ──────────────────────────────────────────

def test_tts_cache_eviction_previews_then_oldest(tmp_path):
    d = str(tmp_path)
    now = time.time()
    # f0 oldest … f4 newest; f4 is a PREVIEW (pv-*) — despite being newest it
    # must evict before any IVR prompt file (previews re-synthesize freely,
    # a deleted prompt 404s on live IVR calls until re-saved).
    for i in range(5):
        name = "pv-f4.mp3" if i == 4 else f"f{i}.mp3"
        p = os.path.join(d, name)
        with open(p, "wb") as f:
            f.write(b"x" * 10)
        os.utime(p, (now - 1000 + i, now - 1000 + i))
    assert m._evict_tts_cache(d, max_files=3, max_bytes=10**9) == 2
    left = sorted(n for n in os.listdir(d) if n.endswith(".mp3"))
    assert left == ["f1.mp3", "f2.mp3", "f3.mp3"]  # pv- went first, then oldest
    # Byte cap: 30 bytes on disk, cap 25 → one more (now the oldest prompt) goes.
    assert m._evict_tts_cache(d, max_files=100, max_bytes=25) == 1
    assert sorted(os.listdir(d))[0] == "f2.mp3"
    # Under caps → no-op; missing dir → no-op.
    assert m._evict_tts_cache(d, max_files=100, max_bytes=10**9) == 0
    assert m._evict_tts_cache(os.path.join(d, "nope"), 1, 1) == 0


def test_tts_cache_eviction_is_true_lru_via_serve_touch(tmp_path):
    # The play route bumps mtime on serve so a live IVR prompt survives eviction
    # while write-once junk ages out — the fix for "eviction deletes live prompts"
    # (deep-review W3). Model it: prompt written oldest, then SERVED (touched).
    d = str(tmp_path)
    old = time.time() - 1000
    prompt = os.path.join(d, "prompt.mp3")
    junk = os.path.join(d, "junk.mp3")
    for p in (prompt, junk):
        with open(p, "wb") as f:
            f.write(b"x" * 10)
    os.utime(prompt, (old, old))          # prompt is the OLDER file by creation
    os.utime(junk, (old + 1, old + 1))
    # Serving the prompt bumps its mtime (touch=True) → now it's the NEWER file.
    m._serve_mp3(prompt, touch=True)
    # Cap of 1 file → the un-served junk evicts, the served prompt stays.
    assert m._evict_tts_cache(d, max_files=1, max_bytes=10**9) == 1
    assert os.path.exists(prompt) and not os.path.exists(junk)


def test_serve_mp3_missing_file_is_404_not_500(tmp_path):
    # TOCTOU: eviction can unlink between the caller's exists-check and the open.
    # _serve_mp3 must return 404 (Plivo falls back to <Speak>), never raise → 500.
    resp = m._serve_mp3(os.path.join(str(tmp_path), "gone.mp3"), touch=True)
    assert resp.status_code == 404


def test_serve_mp3_touch_failure_still_serves(tmp_path, monkeypatch):
    # A readable file on a degraded volume (utime raises EROFS/EPERM/EIO) must
    # STILL play — the LRU touch is best-effort, never a new 500 path (round-2 P2).
    p = os.path.join(str(tmp_path), "prompt.mp3")
    with open(p, "wb") as f:
        f.write(b"audio")

    def boom(*a, **k):
        raise PermissionError("read-only volume")

    monkeypatch.setattr(m.os, "utime", boom)
    resp = m._serve_mp3(p, touch=True)
    assert resp.status_code == 200 and resp.body == b"audio"


# ── B5: report status honesty ────────────────────────────────────────────────

class _W3Outcome:
    def __init__(self, transcript, crashed=False):
        self.transcript = transcript
        self.crashed = crashed


def test_status_synthetic_turns_do_not_count_as_spoken():
    # Dead-air pickup where only the backchannel cue landed → no-answer, so the
    # classifier retries instead of resuming the workflow on a phantom connect.
    o = _W3Outcome([{"role": "user", "text": "[unclear sound from the caller]"}])
    assert rpt._status(o) == "no-answer"
    o2 = _W3Outcome([{"role": "user", "text": "  [unclear sound from the caller]"}])
    assert rpt._status(o2) == "no-answer"


def test_status_crash_is_failed_not_no_answer():
    assert rpt._status(_W3Outcome([], crashed=True)) == "failed"
    # But a crash AFTER a real conversation keeps the honest "completed".
    o = _W3Outcome([{"role": "user", "text": "haan boliye"}], crashed=True)
    assert rpt._status(o) == "completed"
    assert rpt._status(_W3Outcome([{"role": "assistant", "text": "hello"}])) == "no-answer"


# ── B5: failed-report spool + sweeper ────────────────────────────────────────

@pytest.mark.asyncio
async def test_spool_write_then_sweep_delivers_and_cleans(tmp_path, monkeypatch):
    s = _W3Settings(tmp_path)
    monkeypatch.setattr(rpt, "get_settings", lambda: s)
    path = rpt.spool_report("inst-1", "tok", {"correlationId": "c/1 weird"})
    assert path and os.path.exists(path)
    assert os.path.dirname(path) == s.report_spool_dir

    calls = []

    async def post_fail(*a):
        calls.append(a)
        return False

    async def post_ok(*a):
        calls.append(a)
        return True

    monkeypatch.setattr(rpt.admin_core, "post_report", post_fail)
    assert await rpt.sweep_report_spool() == (0, 1)
    assert os.path.exists(path)              # retained for the next sweep
    monkeypatch.setattr(rpt.admin_core, "post_report", post_ok)
    assert await rpt.sweep_report_spool() == (1, 0)
    assert not os.path.exists(path)          # delivered → removed
    assert calls[-1][0] == "inst-1" and calls[-1][1] == "tok"


@pytest.mark.asyncio
async def test_spool_parks_dead_after_max_age(tmp_path, monkeypatch):
    s = _W3Settings(tmp_path)
    monkeypatch.setattr(rpt, "get_settings", lambda: s)
    path = rpt.spool_report("inst-1", None, {"correlationId": "old-1"})
    rec = _json.load(open(path))
    rec["spooledAt"] = time.time() - rpt._SPOOL_MAX_AGE_SECS - 60
    with open(path, "w") as f:
        _json.dump(rec, f)

    async def post_fail(*a):
        return False

    monkeypatch.setattr(rpt.admin_core, "post_report", post_fail)
    assert await rpt.sweep_report_spool() == (0, 0)
    assert not os.path.exists(path) and os.path.exists(path + ".dead")
    # Unreadable spool entry parks as .dead too instead of wedging the sweep.
    bad = os.path.join(s.report_spool_dir, "bad.json")
    with open(bad, "w") as f:
        f.write("{not json")
    assert await rpt.sweep_report_spool() == (0, 0)
    assert os.path.exists(bad + ".dead")


def test_report_failure_spools(monkeypatch):
    src = inspect.getsource(rpt.build_and_post_report)
    assert "spool_report(" in src and "if not ok" in src
    # Inline post has a beat between its two attempts (deploy-window blips).
    ac_src = inspect.getsource(ac.post_report)
    assert "asyncio.sleep" in ac_src


@pytest.mark.asyncio
async def test_spool_sweeps_oldest_call_first(tmp_path, monkeypatch):
    # Out-of-order clobber guard (deep-review W3): several queued reports must be
    # delivered oldest-call-first (by spooledAt), NOT by filename (= random corr),
    # so a stale outcome can't land after a newer one and regress the lead.
    s = _W3Settings(tmp_path)
    monkeypatch.setattr(rpt, "get_settings", lambda: s)
    now = time.time()
    # zzz sorts LAST by filename but is the OLDER call; aaa sorts first but newer.
    p_old = rpt.spool_report("i", "t", {"correlationId": "zzz-old"})
    p_new = rpt.spool_report("i", "t", {"correlationId": "aaa-new"})
    for p, ts in ((p_old, now - 300), (p_new, now - 10)):
        rec = _json.load(open(p))
        rec["spooledAt"] = ts
        with open(p, "w") as f:
            _json.dump(rec, f)

    order = []

    async def post_ok(inst, tok, payload):
        order.append(payload.get("correlationId"))
        return True

    monkeypatch.setattr(rpt.admin_core, "post_report", post_ok)
    assert await rpt.sweep_report_spool() == (2, 0)
    assert order == ["zzz-old", "aaa-new"]  # oldest call delivered first


@pytest.mark.asyncio
async def test_report_carries_generated_at_for_late_delivery(monkeypatch):
    # Every report stamps reportGeneratedAt so a spool-delivered-late report tells
    # admin_core when the call actually ended (forward-compat recency guard).
    posted = {}

    async def capture(inst, tok, payload):
        posted.update(payload)
        return True

    monkeypatch.setattr(rpt.admin_core, "post_report", capture)

    async def fake_analyze(o):
        return {"disposition": "Interested"}

    monkeypatch.setattr(rpt, "_analyze", fake_analyze)

    class _Ctx(dict):
        pass

    class _Outcome:
        corr = "c1"
        context = {"agent": {"dispositions": ["Interested"]}, "instituteId": "i"}
        connected_at = time.time() - 30
        ended_at = time.time()
        transcript = [{"role": "user", "text": "haan"}]
        transfer_requested = False
        transfer_registered = False
        crashed = False

        def duration_seconds(self):
            return 30

    assert await rpt.build_and_post_report(_Outcome(), "cu1") is True
    assert posted["systemError"] is False
    assert "reportGeneratedAt" in posted["metadata"]
    assert posted["metadata"]["reportGeneratedAt"].endswith("Z")


# ── B6/B7: setup off-loop + teardown hygiene ─────────────────────────────────

def test_run_bot_setup_and_teardown_structure():
    src = inspect.getsource(b.run_bot)
    # Vertex SA OAuth must not block the event loop (other live calls glitch).
    assert "await asyncio.to_thread(build_llm)" in src
    # Greet task is tracked; watchdog + greet cancels are AWAITED.
    assert "_bg_tasks.append(asyncio.create_task(_greet_when_ready()))" in src
    tail = src[src.index("watchdog_task = asyncio.create_task"):]
    assert "_t.cancel()" in tail and "await _t" in tail
    # Sarvam SDK httpx client close is attempted defensively.
    assert "_client_wrapper" in tail and "aclose" in tail


def test_lifespan_starts_sweeper_and_prewarm():
    src = inspect.getsource(m.lifespan)
    assert "report_spool_sweeper()" in src and "asyncio.create_task" in src
    assert "_warm_llm" in src
    warm = inspect.getsource(m._warm_llm)
    assert "build_llm" in warm


def test_stt_sdk_close_chain_resolves_on_pinned_wheel():
    # The teardown in run_bot closes _sarvam_client._client_wrapper.httpx_client
    # .httpx_client — assert that chain actually resolves on the installed wheel
    # so an SDK upgrade that moves it fails HERE, not silently in production.
    try:
        stt = pv.build_stt(8000)
    except Exception as ex:  # pragma: no cover - env without Sarvam config
        pytest.skip(f"STT not constructible here: {ex}")
    sdk = getattr(stt, "_sarvam_client", None)
    assert sdk is not None, "SarvamSTTService no longer stores _sarvam_client"
    h = getattr(getattr(sdk, "_client_wrapper", None), "httpx_client", None)
    inner = getattr(h, "httpx_client", h)
    assert callable(getattr(inner, "aclose", None))


# ═══ 2026-08-03 "Now" wave ════════════════════════════════════════════════════

import unittest.mock as um

# ── Item 1: the TTS socket wedge (root cause of the founder's 8-10.4s dead air)

def test_has_word_char_predicate():
    assert not pv.has_word_char('"')
    assert not pv.has_word_char('  " ')
    assert not pv.has_word_char("—…!?,.")
    assert not pv.has_word_char("")
    assert not pv.has_word_char(None)
    assert pv.has_word_char('"Okay.')
    assert pv.has_word_char("SSC")
    assert pv.has_word_char("क")          # Devanagari counts
    assert pv.has_word_char("2")


@pytest.mark.asyncio
async def test_aggregator_never_emits_letterless_unit_and_preserves_text():
    """A lone closing quote must never become its own TTS chunk — that exact
    input is what Sarvam rejects, wedging the socket open-but-dead."""
    agg = pv.ClauseFlushAggregator()
    fed, out = "", []
    for piece in ['"Okay, SSC." ', '" ', "And what's the name of the school?"]:
        fed += piece
        r = await agg.aggregate(piece)
        while r:
            assert pv.has_word_char(r), f"letterless unit emitted: {r!r}"
            out.append(r)
            r = None
    # Nothing is lost: everything emitted plus the buffered remainder equals input.
    joined = "".join(out) + agg._text
    assert joined.replace(" ", "") == fed.replace(" ", ""), (joined, fed)


@pytest.mark.asyncio
async def test_run_tts_skips_letterless_and_never_arms_stall_stamp():
    """Skipping must happen BEFORE _on_generate, else the watchdog would try to
    'recover' a stall for a chunk we deliberately never sent."""
    svc = pv.ResilientSarvamTTSService.__new__(pv.ResilientSarvamTTSService)
    stamped = []
    svc._on_generate = lambda: stamped.append(1)
    svc._wedged = False
    frames = [f async for f in pv.ResilientSarvamTTSService.run_tts(svc, '"')]
    assert frames == [] and stamped == []


@pytest.mark.asyncio
async def test_tts_error_marks_socket_wedged_then_reconnects_once():
    """pipecat only logs Sarvam's error and pushes an ErrorFrame — it never
    closes the socket, so run_tts's CLOSED guard can't see it. We must."""
    from pipecat.frames.frames import ErrorFrame

    svc = pv.ResilientSarvamTTSService.__new__(pv.ResilientSarvamTTSService)
    svc._wedged = False
    svc._on_generate = None
    pushed = []

    async def fake_super_push(frame, *a, **k):
        pushed.append(frame)

    with um.patch.object(pv.SarvamTTSService, "push_frame", new=fake_super_push):
        await pv.ResilientSarvamTTSService.push_frame(
            svc, ErrorFrame(error="TTS Error: Text must contain at least one character"))
    assert svc._wedged is True
    assert len(pushed) == 1          # the frame is still forwarded, not swallowed

    calls = []

    async def fake_disconnect():
        calls.append("disconnect")

    async def fake_connect():
        calls.append("connect")

    async def fake_super_run(text):
        calls.append(f"synth:{text}")
        if False:
            yield None

    svc._disconnect = fake_disconnect
    svc._connect = fake_connect
    with um.patch.object(pv.SarvamTTSService, "run_tts", new=lambda self, t: fake_super_run(t)):
        _ = [f async for f in pv.ResilientSarvamTTSService.run_tts(svc, "Hello there.")]
    assert calls == ["disconnect", "connect", "synth:Hello there."]
    assert svc._wedged is False      # cleared, so the next turn doesn't reconnect again


def test_clean_opening_strips_wrapping_quotes():
    assert b._clean_opening('"Hi, this is Avni."') == "Hi, this is Avni."
    assert b._clean_opening('“Hello there.”') == "Hello there."
    assert b._clean_opening('Hi there.') == "Hi there."
    assert pv.has_word_char(b._clean_opening('"Hi."'))


# ── Item 3: the glitch cue must not tell the model to shorten unheard content

def test_stall_recovery_cue_demands_full_replay_not_brief():
    src = inspect.getsource(b.run_bot)
    tail = src[src.index("if d.kind == STALL_RECOVER"):]
    # …to the NEXT branch, not the first `continue` (the re-check guard has one).
    block = tail[:tail.index("if d.kind == ORPHAN_ASK")]
    # Comment lines are stripped: the comment here NAMES the removed word, and
    # asserting over it would fail on its own documentation (same trap as the A5
    # 'except Exception' test).
    cue = "\n".join(l for l in block.splitlines() if not l.strip().startswith("#"))
    assert "briefly" not in cue, "the 'briefly' cue deleted announcements the caller never heard"
    assert "IN FULL" in cue
    # And the handler re-checks the world before tearing down the socket.
    # The guard must NOT read tts_gen_t (apply_decision has already zeroed it —
    # that spelling silently disables every recovery). It must use the pure
    # helper, which the timeline harness covers.
    assert "stall_recovery_still_needed(flags, time.time())" in cue
    # …and a real yield point before it, else the re-check is dead code.
    assert "await asyncio.sleep(" in cue
    assert 'flags["tts_gen_t"] == 0.0' not in cue


def test_sentinel_measures_but_never_mutates_stall_stamp_on_interruption():
    src = inspect.getsource(b.SentinelGate.process_frame)
    intr = src[src.index("InterruptionFrame"):]
    assert "self._on_interrupted()" in intr[:intr.index("return")]
    # Wiring must come AFTER sentinel exists (the 2026-07-27 forward-ref class of bug).
    rb = inspect.getsource(b.run_bot)
    assert rb.index("sentinel = SentinelGate") < rb.index("sentinel.set_on_interrupted")
    # The hook must MEASURE ONLY. pipecat pushes an InterruptionFrame on every
    # Silero onset while the bot is quiet — the wedge window — so mutating the
    # stamp here (clear OR re-stamp) disarms the founder's own recovery.
    body = rb[rb.index("def _note_killed_before_playout"):]
    body = body[:body.index("sentinel.set_on_interrupted")]
    # Records a SUSPICION only — the counter is incremented later, and only if
    # the silence outlasts the confirm window (95% of these replies do play).
    assert 'flags["unplayed_pending_t"] = time.time()' in body
    assert 'flags["tts_gen_t"] =' not in body, "interruption hook must not mutate the stall stamp"


# ── Item 6: prompt placeholders must never render as holes

def test_placeholders_resolve_from_lead_fields():
    ctx = {"leadName": "Devaki", "leadFields": {"children name": "Kyoto"}}
    out = b._fill_placeholders("with {{parent_name}}, whose child {{child_name}} studies", ctx)
    assert out == "with Devaki, whose child Kyoto studies"
    assert "{{" not in out
    # The exact live failure: 141/141 prompts read "with , whose child  studies".
    assert "  " not in out and ", whose child  " not in out


def test_placeholder_unknown_key_falls_back_and_warns(caplog):
    ctx = {"leadName": "Devaki", "leadFields": {}}
    with caplog.at_level("WARNING"):
        out = b._fill_placeholders("Hi {{totally_unknown}}!", ctx)
    assert out == "Hi !"
    assert any("unresolved" in r.getMessage() for r in caplog.records)
    # NO generic *_name -> lead_name fallback: endswith("name") also matches
    # {{school_name}}/{{child_name}}, so it would confidently speak the PARENT's
    # name as the school's or the child's. A hole beats a wrong name.
    assert b._fill_placeholders("Hi {{school_name}}!", ctx) == "Hi !"
    assert b._fill_placeholders("child {{child_name}}", ctx) == "child "
    # …but the person we are CALLING is the parent, so this one does resolve.
    assert b._fill_placeholders("Hi {{parent_name}}!", ctx) == "Hi Devaki!"


def test_known_placeholders_unchanged():
    ctx = {"leadName": "Devaki", "leadFields": {"institute": "DPS"}}
    assert b._fill_placeholders("{{lead_name}}", ctx) == "Devaki"
    assert b._fill_placeholders("{{institute_name}}", ctx) == "DPS"


# ── Item 5: a non-conversation can never produce a substantive disposition

class _ConvOutcome:
    def __init__(self, transcript):
        self.corr = "c"
        self.transcript = transcript
        self.crashed = False
        self.context = {"agent": {}, "instituteId": "i"}
        self.connected_at = time.time() - 10
        self.ended_at = time.time()
        self.transfer_requested = False
        self.transfer_registered = False

    def duration_seconds(self):
        return 10


def test_is_conversation_requires_a_real_caller_turn_only():
    voicemail = _ConvOutcome([
        {"role": "assistant", "text": "Good morning, this is Avni…"},
        {"role": "user", "text": "Your call has been forwarded to voicemail."},
    ])
    # Voicemail text IS caller text — this gate does NOT catch machines (that is
    # a separate fix). Asserted so nobody mistakes it for one.
    assert rpt._is_conversation(voicemail) is True
    # No caller turn at all -> never a disposition.
    assert rpt._is_conversation(_ConvOutcome([{"role": "assistant", "text": "Hi"}])) is False
    assert rpt._is_conversation(_ConvOutcome([
        {"role": "assistant", "text": "Hi"},
        {"role": "user", "text": "[unclear sound from the caller]"}])) is False
    assert rpt._is_conversation(_ConvOutcome([])) is False
    # CRITICAL: a caller who spoke while OUR audio never played is still a real
    # conversation — otherwise a terminal refusal becomes a retry and we re-dial
    # someone who said no.
    assert rpt._is_conversation(_ConvOutcome([
        {"role": "user", "text": "not interested, please stop calling"}])) is True


@pytest.mark.asyncio
async def test_no_caller_turn_forces_incomplete_and_skips_analysis(monkeypatch):
    analysed = []

    async def spy_analyze(o):
        analysed.append(1)
        return {"disposition": "Demo_Booked"}

    posted = {}

    async def capture(inst, tok, payload):
        posted.update(payload)
        return True

    monkeypatch.setattr(rpt, "_analyze", spy_analyze)
    monkeypatch.setattr(rpt.admin_core, "post_report", capture)
    o = _ConvOutcome([{"role": "assistant", "text": "Good morning, this is Avni…"}])
    assert await rpt.build_and_post_report(o, "cu") is True
    assert analysed == [], "the classifier judged the bot's own monologue"
    assert posted["disposition"] == "Incomplete"
    assert posted["status"] == "no-answer"


@pytest.mark.asyncio
async def test_real_conversation_still_analysed(monkeypatch):
    async def spy_analyze(o):
        return {"disposition": "Interested"}

    posted = {}

    async def capture(inst, tok, payload):
        posted.update(payload)
        return True

    monkeypatch.setattr(rpt, "_analyze", spy_analyze)
    monkeypatch.setattr(rpt.admin_core, "post_report", capture)
    o = _ConvOutcome([{"role": "assistant", "text": "Which board?"},
                      {"role": "user", "text": "CBSE"}])
    assert await rpt.build_and_post_report(o, "cu") is True
    assert posted["disposition"] == "Interested"


def test_watchdog_config_call_names_every_field():
    """Item 2's real guarantee: run_bot must pass EVERY WatchdogConfig field, so
    no live turn-taking threshold can silently fall back to a dataclass default
    with no env knob. (The timeline test only proves the fields are settable.)"""
    import dataclasses
    import app.callstate as cs
    src = inspect.getsource(b.run_bot)
    call = src[src.index("cfg = WatchdogConfig("):]
    call = call[:call.index("\n        )")]
    missing = [f.name for f in dataclasses.fields(cs.WatchdogConfig)
               if f.name + "=" not in call]
    assert not missing, f"WatchdogConfig fields not plumbed from Settings: {missing}"


def test_machine_markers_cover_devanagari_transliteration():
    """Sarvam is pinned to hi-IN and TRANSLITERATES English audio, so an English
    voicemail greeting arrives in Devanagari and matched none of the ASCII
    markers — that is how a voicemail wrote disposition=Callback onto a real
    lead (corr e461549e, 2026-08-03)."""
    class _O:
        transcript = [{"role": "user",
                       "text": "इफ यू रिकॉर्ड योर नेम एंड रीज़न फॉर कॉलिंग, "
                               "आई विल सी इफ दिस पर्सन इज़ अवेलेबल।"}]
    hits = rpt._machine_markers(_O())
    assert hits, "Devanagari voicemail greeting must be recognised as a machine"

    class _H:
        transcript = [{"role": "user", "text": "हाँ जी बोलिए, मैं सुन रहा हूँ"}]
    assert rpt._machine_markers(_H()) == [], "a real Hindi speaker is not a machine"


def test_kill_hook_stamps_a_suspicion_not_a_count():
    """The hook must NOT bump the counter directly — 95% of these replies play."""
    src = inspect.getsource(b.run_bot)
    hook = src[src.index("def _note_killed_before_playout"):]
    hook = hook[:hook.index("sentinel.set_on_interrupted")]
    assert 'flags["unplayed_pending_t"] = time.time()' in hook
    assert 'diag.bump("replies_never_played")' not in hook, (
        "counting at the interruption is what made REPLY_UNPLAYED ~95% false"
    )
    # Audio arriving must clear the suspicion.
    speak = src[src.index("def set_bot_speaking"):]
    speak = speak[:speak.index("def set_user_speaking")]
    assert 'flags["unplayed_pending_t"] = 0.0' in speak
    # …and only the confirmed case increments the counter.
    wd = src[src.index("unplayed_confirmed(flags, now, cfg)"):]
    assert 'diag.bump("replies_never_played")' in wd[:400]


def test_date_time_placeholders_resolve():
    """A live agent's prompt used {{day}}/{{date}}/{{time}} and all three rendered
    EMPTY (diagnostics: promptUnfilled ["day","date","time"]) — handing the model
    blanks exactly where the booking flow needs "now" to resolve "tomorrow"."""
    ctx = {"leadName": "Devaki", "leadFields": {}, "agent": {"timezone": "Asia/Kolkata"}}
    out = b._fill_placeholders("It is {{day}}, {{date}} at {{time}}.", ctx)
    assert "{{" not in out
    for token in ("day", "date", "time"):
        assert f"{{{{{token}}}}}" not in out
    assert out != "It is , at ."
    assert len(out) > len("It is , at .") + 8
    # tomorrow is a distinct, non-empty day
    tmr = b._fill_placeholders("{{tomorrow}}", ctx)
    assert tmr and tmr != b._fill_placeholders("{{today}}", ctx)


def test_stall_cap_closes_the_call_instead_of_sitting_silent():
    src = inspect.getsource(b.run_bot)
    blk = src[src.index("diag.tts_stall_cap_hit = True"):]
    blk = blk[:blk.index("if d.kind == ORPHAN_ASK")]
    assert "_begin_stop()" in blk and "end_requested = True" in blk


def test_hearing_failed_closes_the_call_honestly():
    src = inspect.getsource(b.run_bot)
    blk = src[src.index("if d.kind == HEARING_FAILED"):]
    blk = blk[:blk.index("if d.kind == NUDGE")]
    assert "_begin_stop()" in blk and "end_requested = True" in blk
    assert "cant_hear_closing" in blk
    # The line must own the problem, not blame the caller or apologise a 5th time.
    line = src[src.index("cant_hear_closing = ("):]
    line = line[:line.index("end_closing =")]
    assert "call you back" in line and "call back" in line
    # A real transcript must clear the streak.
    on_tr = src[src.index("def on_transcript"):]
    assert 'flags["deaf_streak"] = 0' in on_tr[:on_tr.index("transcript = TranscriptCollector")]


# ── STT model routing: saaras:v4 with per-agent language + mode ──────────────

def test_agent_language_drives_stt_language_and_mode():
    assert b._agent_language({"language": "hinglish"})[0] == "hi-IN"
    assert b._agent_language({"language": "english"})[0] == "en-IN"
    assert b._agent_stt_mode({"language": "hinglish"}) == "codemix"
    assert b._agent_stt_mode({"language": "english"}) == "transcribe"
    assert b._agent_stt_mode({"language": "tamil"}) == "transcribe"
    # run_bot must actually pass both through.
    src = inspect.getsource(b.run_bot)
    assert "mode=_agent_stt_mode(agent)" in src


def test_every_language_tag_is_one_sarvam_accepts():
    """Sarvam spells Odia od-IN, not the ISO or-IN; the ISO form is REJECTED and
    every Odia agent failed. Pin the whole table against Sarvam's own list."""
    sarvam = {"bn-IN", "en-IN", "gu-IN", "hi-IN", "kn-IN", "ml-IN",
              "mr-IN", "od-IN", "pa-IN", "ta-IN", "te-IN"}
    ours = {tag for tag, _ in b._STT_LANGS.values()}
    assert ours <= sarvam, f"Sarvam would reject: {sorted(ours - sarvam)}"


def test_saaras_is_routed_to_the_transcribe_socket(monkeypatch):
    """pipecat sends any saaras* model to the translate socket, which has no
    language_code and always returns English. The shim redirects it."""
    monkeypatch.setenv("SARVAM_STT_MODEL", "saaras:v4")
    pv.get_settings.cache_clear()
    try:
        svc = pv.build_stt(8000, language="hi-IN", bias="Aarushi", mode="codemix")
        assert svc.model_name == "saaras:v4"
        assert svc._stt_mode == "codemix"
        assert svc._language_string == "hi-IN", "the language pin must survive"
        shim = svc._sarvam_client.speech_to_text_translate_streaming
        assert isinstance(shim, pv._SaarasStreamingShim)
        # _prompt MUST stay None on this path. pipecat's _connect calls
        # socket.set_prompt() whenever "saaras" is in the model name, but
        # set_prompt exists ONLY on the translate socket — and the shim hands it a
        # TRANSCRIBE socket. Setting it raised inside _connect, so the socket was
        # never usable and deaf-detection hammered reconnect: a live call logged
        # 1827 reconnects and zero transcripts.
        assert svc._prompt is None, "set_prompt does not exist on the transcribe socket"
    finally:
        pv.get_settings.cache_clear()


def test_saarika_still_uses_its_native_path(monkeypatch):
    monkeypatch.setenv("SARVAM_STT_MODEL", "saarika:v2.5")
    pv.get_settings.cache_clear()
    try:
        svc = pv.build_stt(8000, language="hi-IN")
        assert svc.model_name == "saarika:v2.5"
        assert getattr(svc, "_stt_mode", None) is None
        assert not isinstance(svc._sarvam_client.speech_to_text_translate_streaming,
                              pv._SaarasStreamingShim)
    finally:
        pv.get_settings.cache_clear()


def test_reconnect_counter_is_gated_by_the_cooldown():
    """run_stt calls _reconnect_once per audio frame (~50/s). Counting before the
    cooldown gate turned "reconnect attempts" into "frames seen while down" — a
    live call reported 1827 when the truth was ~7."""
    src = inspect.getsource(pv.ResilientSarvamSTTService._reconnect_once)
    body = "\n".join(l for l in src.splitlines() if not l.strip().startswith("#"))
    assert body.index("_RECONNECT_COOLDOWN_SECS") < body.index('bump("stt_reconnects")'), (
        "the counter must be incremented AFTER the cooldown gate"
    )


# ── item 10: the end intent must be per-response and revocable ───────────────

def test_end_marker_latches_per_response_not_per_call():
    src = inspect.getsource(b.SentinelGate.process_frame)
    marker = src[src.index("if END_MARKER in self._buffer"):]
    marker = marker[:marker.index("emit, self._buffer")]
    assert "self._end_this_response = True" in marker
    assert "self._outcome.end_requested = True" not in marker, (
        "a mid-stream marker must not close the call call-wide"
    )


def test_new_response_revokes_an_unarmed_end_intent():
    src = inspect.getsource(b.SentinelGate.process_frame)
    start = src[src.index("if isinstance(frame, LLMFullResponseStartFrame)"):]
    start = start[:start.index("if isinstance(frame, LLMTextFrame)")]
    assert "self._outcome.end_requested = False" in start
    assert "not self._stop_armed" in start, "an already-closing line must not be revived"


def test_farewell_defers_the_close_and_transfer_does_not():
    src = inspect.getsource(b.SentinelGate.process_frame)
    stop = src[src.index("if self._outcome.transfer_requested and self._task"):]
    stop = stop[:stop.index("await self.push_frame(frame, direction)")] if \
        "await self.push_frame(frame, direction)" in stop else stop
    assert "self._defer_stop()" in stop, "the END path must go through the grace"
    # Transfer still closes immediately — the caller is waiting to be put through.
    assert stop.index("transfer_requested") < stop.index("_defer_stop()")


def test_caller_words_cancel_a_pending_close():
    src = inspect.getsource(b.run_bot)
    on_tr = src[src.index("def on_transcript"):]
    on_tr = on_tr[:on_tr.index("transcript = TranscriptCollector")]
    assert 'flags["end_pending_since"] = 0.0' in on_tr
    assert "outcome.end_requested = False" in on_tr
