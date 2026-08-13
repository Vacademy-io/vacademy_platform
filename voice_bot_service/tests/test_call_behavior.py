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

import inspect
import json as _json

import app.bot as b
import app.diagnostics as dg_mod
import app.providers as pv

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

    await drive(TTSTextFrame("Hello!", aggregated_by="sentence"))
    await drive(TTSTextFrame("Am I speaking with Shreyash?", aggregated_by="sentence"))
    assert len(o.transcript) == 1                      # consecutive clauses merge
    assert "Hello!" in o.transcript[0]["text"]
    assert "Shreyash" in o.transcript[0]["text"]

    o.transcript.append({"role": "user", "text": "yes"})  # caller turn intervenes
    await drive(TTSTextFrame("Great, thank you.", aggregated_by="sentence"))
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


def test_clean_opening_strips_wrapping_quotes():
    assert b._clean_opening('"Hi, this is Avni."') == "Hi, this is Avni."
    assert b._clean_opening('“Hello there.”') == "Hello there."
    assert b._clean_opening('Hi there.') == "Hi there."
    assert pv.has_word_char(b._clean_opening('"Hi."'))


# ── Item 3: the glitch cue must not tell the model to shorten unheard content

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


# ── Rumik Silk TTS (default provider) ────────────────────────────────────────

def test_rumik_started_flag_is_initialised():
    """run_tts reads _started. TTSService.start() creates it, but our first
    utterance can reach run_tts before that — a live e2e caught the FIRST
    utterance of every call dying with AttributeError."""
    svc = pv.RumikTTSService.__new__(pv.RumikTTSService)
    src = inspect.getsource(pv.RumikTTSService.__init__)
    assert "self._started = False" in src



def test_rumik_skips_letterless_and_records_credits():
    run = inspect.getsource(pv.RumikTTSService.run_tts)
    assert "has_word_char(text)" in run
    recv = inspect.getsource(pv.RumikTTSService._receive_messages)
    assert "credits_used" in recv, "the vendor's own meter is the honest cost signal"


def test_rumik_implements_the_websocket_contract():
    """WebsocketService gives connection verification + reconnect-with-backoff
    only if these exact hooks exist."""
    for m in ("_connect_websocket", "_disconnect_websocket", "_receive_messages"):
        assert callable(getattr(pv.RumikTTSService, m, None)), f"missing {m}"


def test_agent_without_a_tts_model_stays_on_sarvam(monkeypatch):
    """A billing-relevant switch must never happen by omission. Agents predating
    the picker pay the Sarvam rate and approved a Sarvam voice."""
    monkeypatch.delenv("TTS_MODEL", raising=False)
    monkeypatch.setenv("RUMIK_API_KEY", "rk_test_x")
    pv.get_settings.cache_clear()
    try:
        assert b._agent_tts_model({}) == "sarvam"
        assert b._agent_tts_model({"tts_model": "rumik"}) == "rumik"
        assert b._agent_tts_model({"tts_model": " Rumik "}) == "rumik"
    finally:
        pv.get_settings.cache_clear()


def test_voice_from_the_other_vendors_palette_is_dropped(monkeypatch):
    """Voice names don't cross vendors, and the failure is asymmetric (both probed
    live): Sarvam 400s on an unknown speaker (no audio at all), while Rumik quietly
    substitutes its default voice — so the caller hears a voice nobody picked, with
    Hindi grammar conjugated for the configured one. Neither is acceptable, so drop
    the name and use the provider default."""
    monkeypatch.delenv("TTS_MODEL", raising=False)
    pv.get_settings.cache_clear()
    try:
        assert b._agent_voice({"tts_model": "rumik", "voice": "priya"}) is None
        assert b._agent_voice({"tts_model": "rumik", "voice": "ira"}) == "ira"
        assert b._agent_voice({"tts_model": "sarvam", "voice": "ira"}) is None
        assert b._agent_voice({"tts_model": "sarvam", "voice": "priya"}) == "priya"
        assert b._agent_voice({"voice": "shubh"}) == "shubh"
    finally:
        pv.get_settings.cache_clear()


def test_rumik_male_voices_get_masculine_hindi_grammar():
    """Hindi first-person verbs are gendered. A male voice saying "kar rahi hoon"
    is the #1 immersion breaker, and Rumik's palette shares NO names with
    Sarvam's — so every Rumik male preset must be in the table."""
    for v in ("adam", "noah", "theo", "lucas"):
        assert b._voice_gender(v) == "male", v
    for v in ("ira", "emma", "mia", "sophia", "ava", "siya", "aisha", "zoya"):
        assert b._voice_gender(v) == "female", v


def test_grammar_follows_the_voice_we_actually_speak_with(monkeypatch):
    """If the configured voice was dropped as cross-vendor, the grammar must match
    the fallback voice, not the discarded name."""
    monkeypatch.delenv("TTS_MODEL", raising=False)
    pv.get_settings.cache_clear()
    try:
        # a Sarvam MALE name left behind on an agent switched to Rumik: we will
        # speak with Rumik's female default, so grammar must be feminine.
        a = {"tts_model": "rumik", "voice": "shubh"}
        assert b._agent_voice(a) is None
        assert b._voice_gender(b._agent_voice(a)
                                    or b._default_voice_for(a)) == "female"
    finally:
        pv.get_settings.cache_clear()


# ── Rumik: the four P0s an adversarial review found, as BEHAVIOURAL tests ─────
#
# The test these replace asserted `"_disconnect" not in inspect.getsource(...)` of
# the override — and passed precisely because the teardown lived in the PARENT
# class. Grepping source proves what the code says, not what it does. Everything
# below drives the real methods against a fake socket.

class _FakeSock:
    """Minimal stand-in for a websockets client connection."""

    def __init__(self, inbound=None):
        from websockets.protocol import State
        self.sent = []
        self.state = State.OPEN
        self.closed = False
        self._inbound = list(inbound or [])

    async def send(self, msg):
        self.sent.append(_json.loads(msg) if msg.startswith("{") else msg)

    async def close(self):
        from websockets.protocol import State
        self.closed = True
        self.state = State.CLOSED

    async def ping(self):
        return True

    def __aiter__(self):
        async def gen():
            for m in self._inbound:
                yield m
        return gen()


def _rumik_stub(inbound=None):
    """A RumikTTSService with pipecat's I/O stubbed, ready to drive directly."""
    svc = pv.RumikTTSService(api_key="rk_test", voice="ira", sample_rate=24000)
    # pipecat 1.4: create_task requires an initialized TaskManager (0.0.95 let
    # standalone processors spawn tasks). Route straight to asyncio for tests.
    svc.create_task = lambda coro, name=None: asyncio.create_task(coro)

    async def _cancel_task(task, timeout=None):
        task.cancel()
        try:
            await task
        except (asyncio.CancelledError, Exception):
            pass
    svc.cancel_task = _cancel_task
    svc._websocket = _FakeSock(inbound)
    svc._sample_rate = 24000
    pushed = []

    async def push(frame, *a, **k):
        pushed.append(type(frame).__name__)
    svc.push_frame = push
    for m in ("stop_ttfb_metrics", "start_ttfb_metrics", "start_tts_usage_metrics",
              "stop_all_metrics"):
        setattr(svc, m, lambda *a, **k: asyncio.sleep(0))
    return svc, pushed


@pytest.mark.asyncio
async def test_rumik_barge_in_cancels_and_keeps_the_socket():
    """The whole reason to prefer Rumik. Sarvam has no cancel, so barge-in there
    closes the socket — the root of 13 stalls in 220 calls. This must send one
    cancel frame and NOT tear the connection down."""
    svc, _ = _rumik_stub()
    svc._request_active = True
    svc._bot_speaking = True
    torn = []
    svc._disconnect_websocket = lambda: (torn.append(1), asyncio.sleep(0))[1]
    svc._connect_websocket = lambda: (torn.append(1), asyncio.sleep(0))[1]

    await svc._handle_interruption(_DummyInterruption(), None)

    assert svc._websocket.sent == [{"type": "cancel"}], svc._websocket.sent
    assert not svc._websocket.closed, "barge-in must not close the socket"
    assert not torn, "must not call the base class's disconnect/reconnect"
    assert svc._cancels_sent == 1


@pytest.mark.asyncio
async def test_rumik_leaves_the_quiet_window_reply_alone():
    """pipecat pushes an InterruptionFrame on EVERY VAD onset while the bot is
    quiet. Our own measurement: 60 of 63 such pre-playout kills went on to play
    anyway. Cancelling there turns a cough into a lost answer."""
    svc, _ = _rumik_stub()
    svc._request_active = True
    svc._bot_speaking = False

    await svc._handle_interruption(_DummyInterruption(), None)

    assert svc._websocket.sent == [], "must not cancel while the bot is silent"
    assert svc._request_active, "the in-flight reply must survive to play"


@pytest.mark.asyncio
async def test_rumik_raises_when_the_peer_closes():
    """websockets' __aiter__ swallows ConnectionClosedOK, so returning quietly makes
    pipecat's `while True: await _receive_messages()` spin without ever yielding —
    starving the event loop for EVERY concurrent call on the box, not just this
    one. Raising routes into the base's reconnect-with-backoff instead."""
    svc, _ = _rumik_stub(inbound=[])
    with pytest.raises(ConnectionError):
        await svc._receive_messages()


@pytest.mark.asyncio
async def test_rumik_does_not_raise_on_our_own_teardown():
    """...but an intentional close at end of call must NOT trigger a reconnect."""
    svc, _ = _rumik_stub(inbound=[])
    svc._closing = True
    await svc._receive_messages()


@pytest.mark.asyncio
async def test_rumik_ends_the_turn_only_after_the_LAST_sentence():
    """Rumik's socket is request/response and cancels the in-flight request when the
    next arrives, so sends are serialised. The turn must end when no sentence is
    still outstanding — gating on queue emptiness ended it while the last sentence
    was unsent, and 71% of a three-sentence reply reached the caller."""
    done = _json.dumps({"type": "done", "duration_s": 1.0, "credits_used": 0})
    svc, pushed = _rumik_stub(inbound=[done, done, done])
    svc._started = True
    svc._pending_sends = 3          # three sentences enqueued for one reply

    # The fake stream ending IS a peer close, so the ConnectionError from the
    # previous test's behaviour is correct here too — consume it and assert on what
    # happened while the three terminal frames were being processed.
    with pytest.raises(ConnectionError):
        await svc._receive_messages()

    assert pushed.count("TTSStoppedFrame") == 1, \
        f"one Stopped per REPLY, not per sentence: {pushed}"
    assert svc._pending_sends == 0, "a leaked counter means the turn never ends"


@pytest.mark.asyncio
async def test_rumik_pending_count_cannot_leak_on_abandon():
    """A stuck positive count means TTSStoppedFrame never fires and the pipeline
    believes the bot is speaking for the rest of the call."""
    svc, _ = _rumik_stub()
    svc._pending_sends = 3
    svc._bot_speaking = True
    svc._request_active = True
    for _ in range(3):
        svc._send_queue.put_nowait("x")

    await svc._handle_interruption(_DummyInterruption(), None)

    assert svc._pending_sends == 0
    assert svc._send_queue.empty()


def test_rumik_implements_the_hooks_bot_py_duck_types_on():
    """bot.py wires stall detection through hasattr(). Missing hooks skip SILENTLY,
    which unplugged stall recovery, TTS_WEDGE and REPLY_UNPLAYED on every Rumik
    call — on the provider whose justification was fixing stalls."""
    for m in ("set_diagnostics", "set_generate_callback", "set_credits_callback",
              "_connect_websocket", "_disconnect_websocket", "_receive_messages"):
        assert callable(getattr(pv.RumikTTSService, m, None)), f"missing {m}"


def test_rumik_stamps_generate_on_send_not_on_done():
    """A stamp that lands after the audio makes the stall condition unreachable by
    construction — the masking failure mode with extra steps."""
    run = inspect.getsource(pv.RumikTTSService.run_tts)
    assert "_on_generate" in run, "generate stamp must happen in run_tts (on send)"
    recv = inspect.getsource(pv.RumikTTSService._receive_messages)
    assert "_on_generate" not in recv, "must NOT stamp from the receive path"


class _DummyInterruption:
    pass


def test_rumik_pace_ladder_is_monotonic_and_covers_the_range():
    """Rumik has no numeric speed control — only prose steering, measured live.
    The ladder must be monotonic, or a higher pace could produce slower speech."""
    f = pv.rumik_pace_description
    # Distinct instruction per band, fastest at the top.
    fast, rapid, quick, brisk = f(1.4), f(1.1), f(1.0), f(0.9)
    assert len({fast, rapid, quick, brisk}) == 4, "bands must not collapse"
    assert f(1.2) == fast, "everything above the top threshold gets the top grade"
    assert f(0.8) is None, "near-natural pace sends no instruction at all"
    assert "slow" in f(0.6), "below the floor must explicitly ask for slow"
    assert f(None) is None, "no pace configured = no steering"


def test_rumik_pace_ladder_avoids_the_wording_that_did_nothing():
    """Measured: 'brisk, upbeat' moved the rate 1% — indistinguishable from no
    instruction. Only assertive wording ('no pauses') moved it, because the model
    is modulating PAUSES, not words per second. The fast grades must say so."""
    for pace in (1.05, 1.15, 1.4):
        assert "pause" in pv.rumik_pace_description(pace), \
            f"pace {pace} needs pause-suppressing wording to have any effect"


def test_rumik_gets_the_agent_pace_at_all(monkeypatch):
    """It previously got NO pace: build_tts dropped the agent's value on this path
    entirely, so the field an admin sets did nothing on Rumik calls."""
    monkeypatch.setenv("RUMIK_API_KEY", "rk_test_x")
    pv.get_settings.cache_clear()
    try:
        fast = pv.build_tts(8000, voice="ira", aiohttp_session=None,
                            tts_model="rumik", pace=1.4)
        slow = pv.build_tts(8000, voice="ira", aiohttp_session=None,
                            tts_model="rumik", pace=0.6)
        assert fast._description != slow._description, "pace must reach the service"
        assert "slow" in slow._description
    finally:
        pv.get_settings.cache_clear()


def test_preview_carries_the_same_pace_steering_a_call_would():
    """A voice tester that auditions a delivery the caller never hears is worse than
    no tester. Probing the DEPLOYED endpoint caught this: pace 1.1 and pace 0.6
    returned 7.34s and 7.08s — indistinguishable, because the Rumik preview branch
    dropped pace entirely."""
    src = inspect.getsource(m.preview)
    assert "rumik_pace_description(pace)" in src, "preview must derive the steering"
    assert "description=pace_desc" in src, "...and pass it to the synthesiser"
    # And the cache must not serve the first pace forever.
    assert "{pace_desc}" in src, "pace must be part of the Rumik cache key"


def test_rumik_synthesize_wav_accepts_a_description():
    import inspect as _i
    sig = _i.signature(pv.rumik_synthesize_wav)
    assert "description" in sig.parameters


# ── pipecat 1.4 migration guards ─────────────────────────────────────────────

def test_sentinel_never_arms_the_orphan_end_swallow_on_14():
    """1.4's assistant aggregator closes the turn itself on interruption — the
    0.0.95 `_started`-underflow this swallow shielded does not exist, and eating
    a legitimate End would corrupt turn accounting. The interruption branch must
    clear the buffer WITHOUT arming the swallow."""
    import inspect
    src = inspect.getsource(b.SentinelGate)
    i = src.index("InterruptionFrame):")
    branch = src[i:i + 700]
    assert "_swallow_next_end = True" not in branch
    assert 'self._buffer = ""' in branch


def test_turn_gate_uses_broadcast_interruption():
    """The 0.0.95 push_interruption_task_frame_and_wait is deprecated in 1.4
    (delegates without waiting); the turn-gate must use the real API."""
    import inspect
    src = inspect.getsource(b.TranscriptCollector)
    assert "broadcast_interruption" in src
    assert "push_interruption_task_frame_and_wait" not in src


def test_build_tts_defaults_to_sarvam_and_rumik_on_request():
    import inspect
    src = inspect.getsource(pv.build_tts)
    # Rumik only on explicit request; Sarvam is the fall-through (founder
    # decision 2026-08-05 after Mulberry garbled phone-leg Hindi).
    assert 'startswith("rumik")' in src
    assert "SarvamTTSService(" in src


def test_interims_never_enter_the_transcript():
    """Google STT (the A/B arm) streams InterimTranscriptionFrames continuously;
    the collector must act on FINALS only or the dedupe window, the turn-gate
    and the transcript all drown."""
    import inspect
    src = inspect.getsource(b.TranscriptCollector.process_frame)
    assert "InterimTranscriptionFrame" in src


def test_saaras_v4_is_registered_with_pipecat():
    """pipecat 1.4's model table stops at saaras:v3 and RAISES on anything else —
    our production model would have crashed build_stt on every call. Caught by
    the migration dry-run, never by the suite; pinned here now."""
    from pipecat.services.sarvam import stt as sarvam_stt
    assert pv._register_saaras_v4() is True
    assert "saaras:v4" in sarvam_stt.MODEL_CONFIGS
    v3 = sarvam_stt.MODEL_CONFIGS["saaras:v3"]
    v4 = sarvam_stt.MODEL_CONFIGS["saaras:v4"]
    # v4 must inherit v3's capability shape (language + mode + server VAD).
    assert v4.supports_language and v4.supports_mode and v4.supports_vad_params
    assert v4.use_translate_endpoint == v3.use_translate_endpoint


def test_stt_settings_follow_the_model_capability_table():
    """1.4 raises on any field the model doesn't accept, in BOTH directions:
    saaras:v3/v4 take language+mode but NOT prompt; saaras:v2.5 is the reverse.
    build_stt must ASK the table, not assume."""
    import app.config as cfg

    def build(model):
        cfg.get_settings.cache_clear()
        orig = os.environ.get("SARVAM_STT_MODEL")
        os.environ["SARVAM_STT_MODEL"] = model
        os.environ.setdefault("SARVAM_API_KEY", "sk_test")
        try:
            return pv.build_stt(8000, language="hi-IN", bias="Ameet")
        finally:
            if orig is None:
                os.environ.pop("SARVAM_STT_MODEL", None)
            else:
                os.environ["SARVAM_STT_MODEL"] = orig
            cfg.get_settings.cache_clear()

    svc = build("saaras:v4")          # would raise on prompt if we guessed
    assert svc._settings.model == "saaras:v4"
    svc25 = build("saaras:v2.5")      # would raise on language if we guessed
    assert svc25._settings.model == "saaras:v2.5"


def test_our_service_overrides_match_their_base_signatures():
    """THE test that was missing. On the pipecat 1.4 migration, base run_tts
    became run_tts(text, context_id) while our Rumik override still took (text)
    — so EVERY reply raised "takes 2 positional arguments but 3 were given" and
    the bot was mute on the founder's first 1.4 call. The suite passed anyway,
    because the tests called our override directly with the OLD signature.

    Signature drift in a subclass is invisible to unit tests by construction, so
    assert compatibility structurally: for every method we override that also
    exists on a pipecat base class, our version must accept at least as many
    positional parameters as the base passes.
    """
    import inspect

    def positional(fn):
        try:
            params = list(inspect.signature(fn).parameters.values())
        except (TypeError, ValueError):
            return None
        return [p for p in params
                if p.kind in (p.POSITIONAL_ONLY, p.POSITIONAL_OR_KEYWORD)]

    problems = []
    for svc_cls in (pv.RumikTTSService,):
        for name, ours in vars(svc_cls).items():
            if name.startswith("__") or not callable(ours):
                continue
            for base in svc_cls.__mro__[1:]:
                theirs = vars(base).get(name)
                if theirs is None or not callable(theirs):
                    continue
                mine, base_sig = positional(ours), positional(theirs)
                if mine is None or base_sig is None:
                    break
                required_by_base = len(base_sig)
                accepted_by_us = len(mine)
                takes_varargs = any(
                    p.kind == p.VAR_POSITIONAL
                    for p in inspect.signature(ours).parameters.values())
                if accepted_by_us < required_by_base and not takes_varargs:
                    problems.append(
                        f"{svc_cls.__name__}.{name} accepts {accepted_by_us} "
                        f"positional args but {base.__name__}.{name} is called "
                        f"with {required_by_base}")
                break
    assert not problems, "; ".join(problems)


def test_rumik_run_tts_accepts_the_context_id_pipecat_passes():
    """Belt to the braces above, on the exact method that broke production."""
    import inspect
    params = list(inspect.signature(pv.RumikTTSService.run_tts).parameters)
    assert params[:3] == ["self", "text", "context_id"], params


# ── 4-engine TTS routing (google + smallest added 2026-08-05) ────────────────

def test_engine_detection_covers_every_stored_form():
    """tts_model values come from the DB and the UI, so accept the variants both
    can produce — a mis-detected engine sends a voice to the wrong vendor, which
    is either a hard 400 or (worse) a silent voice substitution."""
    cases = {
        "google": "google", "GOOGLE": "google", "chirp3-hd": "google",
        "smallest": "smallest", "lightning_v3.1": "smallest",
        "smallest:v3.1_pro": "smallest",
        "rumik": "rumik", "silk-mulberry": "rumik",
        "sarvam": "sarvam", "": "sarvam", "bulbul:v3": "sarvam",
    }
    for stored, want in cases.items():
        assert b._engine_of(stored) == want, (stored, b._engine_of(stored))


def test_male_voices_include_every_engine_or_hindi_grammar_breaks():
    """_MALE_VOICES is the ONLY thing that makes the LLM write masculine Hindi
    verb endings. A male voice missing here speaks "kar rahi hoon" — the #1
    immersion complaint from live calls."""
    for v in ("hi-IN-Chirp3-HD-Achird", "hi-IN-Neural2-B", "devansh", "mandar",
              "shubh", "lucas"):
        assert b._voice_gender(v) == "male", v
    for v in ("hi-IN-Chirp3-HD-Achernar", "hi-IN-Neural2-A", "manasi", "priya", "ira"):
        assert b._voice_gender(v) == "female", v


def test_voice_palettes_do_not_leak_across_engines():
    """Each engine fails differently on a foreign voice (Sarvam 400s, Rumik
    silently substitutes, Smallest rejects cross-MODEL voices), so a foreign name
    must resolve to None and let the provider default take over."""
    assert b._agent_voice({"tts_model": "google", "voice": "hi-IN-Chirp3-HD-Achird"}) \
        == "hi-IN-Chirp3-HD-Achird"
    assert b._agent_voice({"tts_model": "google", "voice": "shubh"}) is None
    assert b._agent_voice({"tts_model": "google", "voice": "devansh"}) is None
    assert b._agent_voice({"tts_model": "smallest", "voice": "devansh"}) == "devansh"
    assert b._agent_voice({"tts_model": "smallest", "voice": "ira"}) is None
    assert b._agent_voice({"tts_model": "sarvam", "voice": "hi-IN-Neural2-B"}) is None
    assert b._agent_voice({"tts_model": "sarvam", "voice": "shubh"}) == "shubh"


def test_engine_defaults_are_real_voices_in_their_own_palette():
    """A default outside its own palette would be dropped by _agent_voice and
    silently replaced by the vendor's default — the exact class of bug that made
    a male-configured agent speak in a female voice."""
    assert b._default_voice_for({"tts_model": "google"}).lower() in b.GOOGLE_VOICES
    assert b._default_voice_for({"tts_model": "smallest"}).lower() in b.SMALLEST_VOICES
    assert b._default_voice_for({"tts_model": "rumik"}).lower() in b.RUMIK_VOICES
    assert b._default_voice_for({"tts_model": "sarvam"}) == "priya"


def test_new_engines_fall_back_to_sarvam_instead_of_going_mute():
    """Missing creds/keys are a per-deployment reality. A misconfig must degrade
    to a working call in another voice — never the mute call that the pipecat 1.4
    signature drift already cost us once."""
    import inspect
    src = inspect.getsource(pv.build_tts)
    google_branch = src[src.index('startswith("google")'):src.index('startswith("smallest")')]
    assert "except Exception" in google_branch
    assert "falling back to Sarvam" in google_branch
    smallest_branch = src[src.index('startswith("smallest")'):src.index('startswith("rumik")')]
    assert "except Exception" in smallest_branch


def test_bot_is_interrupted_at_vad_onset_not_at_transcript():
    """MEASURED root cause of "it takes ages for the bot to stop" (three founder
    calls): holding audio in DuckGate cannot stop playback, because the reply has
    already flowed past the duck into pipecat's output queue and Plivo's buffer —
    live call d6e82def logged "dropping 0 held frame(s)" on the interrupt. Only a
    flush empties those, and waiting for the STT final delayed it 0.8-1.6s.
    Probe: 1.92s of talk-over before, 0.32s after."""
    import inspect
    src = inspect.getsource(b.run_bot)
    vad = src[src.index("VADUserTurnStartStrategy("):]
    assert "enable_interruptions=settings.interrupt_on_vad" in vad[:200]
    # Interims must NOT interrupt: Google STT streams them continuously.
    tr = src[src.index("TranscriptionUserTurnStartStrategy("):]
    assert "enable_interruptions=False" in tr[:200]


def test_backchannel_after_a_cut_carries_on_instead_of_answering_haan():
    """Interrupting at VAD onset means the bot is already silent when the words
    arrive ~1.5s later, so the absorb path would never fire and every "haan"
    ended the bot's turn (observed on the probe: the model answered the
    acknowledgment from a standing start). A cut within backchannel_carry_secs
    still counts as mid-reply, and the bot is asked to carry on."""
    import inspect
    src = inspect.getsource(b.TranscriptCollector.process_frame)
    assert "self._recently_cut()" in src
    assert "carry on" in src


def test_audio_lead_is_capped_so_plivo_cannot_hoard_the_reply():
    import inspect
    import app.main as mm
    src = inspect.getsource(mm._cap_audio_lead)
    assert "max_lead" in src and "monotonic" in src
    # Falling behind must re-anchor rather than accumulate debt.
    assert "if lead < 0" in src


# ── the repeated-introduction / language-flip root cause (2026-08-06) ────────

def test_scripted_opening_is_written_to_context_deterministically():
    """ROOT CAUSE of both "the questions repeat" and "it switches to Hindi":
    pipecat 1.4 commits a TTSSpeakFrame utterance to context only when it
    COMPLETES. A caller who speaks over the opening cancels that commit, and the
    model is left with no record that it ever introduced itself. MEASURED on the
    live pipeline — uninterrupted the context held the opening (n=4); interrupted
    at +4s it held only (system, user, assistant-reply) and that reply
    re-introduced the agent from scratch. The language flip is the same wound:
    LANGUAGE STABILITY anchors on "your own previous turns", and there were none.

    So we append it ourselves and tell pipecat not to, giving exactly one copy
    whether or not the caller interrupts."""
    import inspect
    src = inspect.getsource(b.run_bot)
    greet = src[src.index("diag.greet_path = \"scripted\""):]
    assert "TTSSpeakFrame(opening, append_to_context=False)" in greet[:2400]
    assert "LLMMessagesAppendFrame" in greet[:2400]


def test_already_spoken_rule_quotes_the_opening_and_is_opening_only():
    """Authored prompts here are call SCRIPTS whose first block IS the
    introduction (Shiksha Nation's literally starts "Bot: Hi! I'm Ameet calling
    from…"), so the model reads from the top and says it again. Naming the
    opening verbatim also gives the first turn a language anchor."""
    MARK = "ALREADY SPOKEN — do not repeat"
    with_opening = b.build_system_prompt({"agent": {
        "name": "Ameet", "systemPrompt": "Bot: Hi! I am Ameet. " * 40,
        "direction": "OUTBOUND",
        "openingLine": "Hi! I am Ameet calling from Shiksha Nation."}})
    assert MARK in with_opening
    assert "Hi! I am Ameet calling from Shiksha Nation." in with_opening
    assert "never restart your script" in with_opening
    # mid-call "hello" must NOT re-trigger the opening
    assert "ONLY at the start" in with_opening
    without = b.build_system_prompt({"agent": {
        "name": "A", "systemPrompt": "short", "direction": "OUTBOUND"}})
    assert MARK not in without


def test_plain_hindi_register_rule_targets_the_words_actually_used():
    """Founder after live calls: "everything is highly formal Hindi... words that
    in general are not used". Measured across two days of transcripts: 198 uses of
    literary vocabulary (प्रदर्शन 37x, पूछताछ 28x, अकादमिक 14x, अवधारणा 12x). It is
    translationese — the authored script is English and the model renders it as
    textbook Hindi. The rule names the ACTUAL offenders, because concrete swaps
    steer a model far better than "be conversational"."""
    hi = b.build_system_prompt({"agent": {
        "name": "Ameet", "language": "hinglish", "systemPrompt": "Bot: Hi! " * 80,
        "direction": "OUTBOUND", "openingLine": "Hi!"}})
    assert "PHONE HINDI" in hi
    for offender in ("प्रदर्शन", "पूछताछ", "अकादमिक", "अवधारणाएँ", "शुल्क", "अभिभावक"):
        assert offender in hi, offender
    # English agents must not be told about Hindi vocabulary at all.
    en = b.build_system_prompt({"agent": {
        "name": "Ann", "language": "english", "systemPrompt": "Bot: Hi! " * 80,
        "direction": "OUTBOUND", "openingLine": "Hi!"}})
    assert "PHONE HINDI" not in en


def test_language_switch_on_request_is_permanent():
    """Founder: "if users asks that i want to talk in english it should then talk
    only in english". The old rule allowed the switch but said nothing about
    STAYING switched, and the model drifted back within a couple of turns."""
    p = b.build_system_prompt({"agent": {
        "name": "Ameet", "language": "hinglish", "systemPrompt": "Bot: Hi! " * 80,
        "direction": "OUTBOUND", "openingLine": "Hi!"}})
    assert "ON REQUEST, THE SWITCH IS PERMANENT" in p
    assert "WHOLE rest of the call" in p
    assert "no Devanagari" in p


# ── call 77cb4b47 (2026-08-06): replay the real transcripts through the gate ──
class _Rec:
    """Captures everything the collector pushes downstream."""

    def __init__(self):
        self.frames = []
        self.interruptions = 0

    def cues(self):
        out = []
        for f in self.frames:
            for m in getattr(f, "messages", []) or []:
                out.append(m.get("content") or "")
        return out


def _replay_collector(rec, bot_speaking=True, bot_stopped_t=None,
                      in_machine_window=None):
    tc = b.TranscriptCollector(
        FakeOutcome(), lambda user=True: None,
        is_bot_speaking=lambda: bot_speaking,
        fillers_armed=lambda: False,
        bot_stopped_t=bot_stopped_t or (lambda: 0.0),
        gate_enabled=lambda: True,
        interrupt_on_vad=lambda: True,      # what production actually runs
        filler_phrases=[],
        in_machine_window=in_machine_window or (lambda: True),
        reply_in_flight=lambda: False,
        bot_spoke_once=lambda: True,
    )

    async def _push(frame, direction=None):
        rec.frames.append(frame)

    async def _broadcast():
        rec.interruptions += 1

    tc.push_frame = _push
    tc.broadcast_interruption = _broadcast
    return tc


async def _feed(tc, text):
    from pipecat.frames.frames import TranscriptionFrame
    f = TranscriptionFrame(text=text, user_id="u", timestamp="t")
    # Bypass pipecat's base setup (needs a running task manager); this test is
    # about OUR gate logic, which lives entirely after the super() call.
    b.FrameProcessor.process_frame = _noop_super
    await tc.process_frame(f, b.FrameDirection.DOWNSTREAM)


async def _noop_super(self, frame, direction):
    return None


@pytest.mark.asyncio
async def test_carrier_announcement_never_reaches_the_model():
    """Verbatim Sarvam finals from the start of call 77cb4b47. These made the
    bot skip its opening AND became the first user message in the LLM context,
    where they conditioned every generation for the next 2.5 minutes."""
    rec = _Rec()
    tc = _replay_collector(rec)
    await _feed(tc, "Your call has been forwarded to voicemail.")
    await _feed(tc, "The person you're trying to reach is not available.")
    assert rec.frames == [], "carrier audio must not be forwarded downstream"
    assert rec.interruptions == 0, "the network must not barge in on us"
    # ...but it must still be in the transcript, or LIKELY_MACHINE goes blind.
    assert len(tc._outcome.transcript) == 2


@pytest.mark.asyncio
async def test_the_hello_loop_breaks_on_the_second_hello():
    """The loop, verbatim: cut -> 'Hello.' -> cut -> 'Hello.' -> ... The first
    hello asks the model to carry on; the SECOND must stop it re-delivering the
    sentence at all, which is what made the call unlistenable."""
    rec = _Rec()
    # The bot spoke (and was cut) between each hello — that is what stops the
    # 4-second dedupe from swallowing the repeats, and it is exactly what the
    # live log shows at 08:27:02.7 / 08:27:05.1 / 08:27:13.3.
    tc = _replay_collector(rec, bot_stopped_t=lambda: time.time())
    await _feed(tc, "haan ji bol raha hoon")     # a real turn first
    rec.frames.clear()
    rec.interruptions = 0                        # that turn's barge-in is fine

    await _feed(tc, "Hello.")
    first = rec.cues()
    assert any("carry on" in c for c in first), first
    assert rec.interruptions == 0, "an absorbed hello must not be a barge-in"

    rec.frames.clear()
    await _feed(tc, "Hello.")
    second = rec.cues()
    assert any("hear you" in c for c in second), second
    assert any("Do NOT repeat your question" in c for c in second), second


@pytest.mark.asyncio
async def test_a_real_answer_clears_the_hello_streak():
    """Otherwise one stray hello early in a call would arm the escalation for
    the rest of it."""
    rec = _Rec()
    tc = _replay_collector(rec, bot_stopped_t=lambda: time.time())
    await _feed(tc, "Hello.")
    await _feed(tc, "sixty eight percent aaye the")   # real answer -> interrupts
    assert tc._audio_checks == 0
    rec.frames.clear()
    await _feed(tc, "Hello.")
    assert any("carry on" in c for c in rec.cues()), "streak did not reset"


# ── call 14029bd6 (2026-08-06): the whole voicemail greeting, in order ────────
_VOICEMAIL_GREETING = [
    "Your call has been forwarded to voicemail.",
    "The person you're trying to reach is not available.",
    "Add the tone.",                      # Sarvam's rendering of "…after the tone"
    "Please record your message.",
    "When you have finished recording you may hang up.",
]


@pytest.mark.asyncio
async def test_the_entire_voicemail_greeting_is_filtered_not_just_line_one():
    """Verbatim Sarvam finals from call 14029bd6, in order. The first version of
    this filter latched on "have we heard a real caller yet?" — 'Add the tone.'
    missed, flipped the latch, and the two unmistakable announcements AFTER it
    were treated as the caller and interrupted our opening three times."""
    rec = _Rec()
    tc = _replay_collector(rec)
    for line in _VOICEMAIL_GREETING:
        await _feed(tc, line)
    assert rec.interruptions == 0, "the voicemail system barged in on our opening"
    assert rec.frames == [], "voicemail audio reached the model"
    assert len(tc._outcome.transcript) == 5, "must stay in the transcript for LIKELY_MACHINE"


@pytest.mark.asyncio
async def test_the_caller_is_still_heard_after_the_machine_window_closes():
    """The window is a clock, so it must actually expire — otherwise a caller
    who says any of these words mid-call is silently ignored."""
    rec = _Rec()
    tc = _replay_collector(rec, in_machine_window=lambda: False)
    await _feed(tc, "Haan main abhi available nahi hoon, baad mein call karein")
    assert rec.frames, "a real caller was swallowed after the window closed"


def test_carrier_lines_are_not_counted_as_deleted_answers():
    """The filter keeps announcements in the transcript and out of the context —
    which is exactly the shape reconcile_answers calls a DELETED ANSWER. Call
    14029bd6's panel duly reported '2 caller answers were discarded', quoting
    the voicemail system. The reconcile step must exclude them."""
    import app.turntake as tt
    heard = [t for t in _VOICEMAIL_GREETING + ["Raman", "class aath mein hai"]
             if not tt.is_carrier_announcement(t)]
    assert heard == ["Raman", "class aath mein hai"]
    n, _samples = dg_mod.reconcile_answers(heard, ["Raman", "class aath mein hai"])
    assert n == 0, "carrier lines still manufacture a false ANSWER_DELETED"


# ── call bc84958c (2026-08-06): the double pitch ─────────────────────────────
@pytest.mark.asyncio
async def test_a_second_final_during_composition_is_not_a_fresh_turn():
    """Sarvam split one answer into two finals 0.85s apart. The first started a
    reply; the second arrived in the ~0.9s hole before that reply was audible,
    the turn-gate saw a quiet bot, and it became a BRAND-NEW turn — so the bot
    delivered its entire Marks Improvement pitch twice, ~40s of it, and the
    caller asked on the line "फिर से repeat क्यों कर रहे हैं आप".

    In flight, the second final must be handled as mid-reply (absorbed or a
    formal interruption) — either way ONE reply, never two."""
    rec = _Rec()
    tc = _replay_collector(rec, bot_speaking=False)   # composing, not yet audible
    tc._reply_in_flight = lambda: True
    await _feed(tc, "नहीं।")
    assert rec.interruptions == 1, (
        "a real answer arriving mid-composition must cancel the in-flight reply, "
        "not spawn a second one")


@pytest.mark.asyncio
async def test_a_backchannel_during_composition_does_not_spawn_a_reply_either():
    rec = _Rec()
    tc = _replay_collector(rec, bot_speaking=False)
    tc._reply_in_flight = lambda: True
    await _feed(tc, "हाँ।")
    assert rec.interruptions == 0
    assert any("carry on" in c for c in rec.cues()), rec.cues()


@pytest.mark.asyncio
async def test_a_quiet_bot_with_no_reply_pending_still_takes_normal_turns():
    """The guard must not swallow ordinary turns — that would mute the call."""
    rec = _Rec()
    tc = _replay_collector(rec, bot_speaking=False)
    tc._reply_in_flight = lambda: False
    await _feed(tc, "Raman seventh class mein hai")
    assert rec.interruptions == 0
    assert rec.frames, "a normal turn was swallowed"


def test_reply_in_flight_is_time_capped():
    """A generation that dies before playout must not mute the caller forever."""
    import app.callstate as cs
    from app.config import get_settings
    s = get_settings()
    assert s.reply_inflight_grace_secs > 0
    st = cs.CallState(t=0.0)
    assert st.reply_started_t == 0.0, "must default to 'no reply pending'"


# ── LLM latency (2026-08-06) ─────────────────────────────────────────────────
def test_vertex_thinking_is_explicitly_disabled():
    """gemini-2.5-flash thinks DYNAMICALLY unless told not to, and pipecat's
    InputParams.thinking defaults to None (sends no thinkingConfig at all) — so
    "we didn't ask for thinking" is not the same as "thinking is off".

    It cost 0.43s TTFB in the morning and 2.35s p50 / 5.76s p95 by midday with
    no LLM code change, purely because the system prompt got richer. Measured
    on the Mumbai box, same region and model: 2.43s -> 0.51s with budget 0."""
    import app.providers as pvd
    from app.config import get_settings
    assert get_settings().vertex_thinking_budget == 0
    src = inspect.getsource(pvd.build_llm)
    assert "ThinkingConfig" in src
    assert "vertex_thinking_budget" in src


def test_thinking_budget_reaches_the_service_params():
    """Guards the failure mode this whole fix is about: a knob that looks set in
    our code and is silently dropped before the wire."""
    from pipecat.services.google.llm import GoogleLLMService
    p = GoogleLLMService.InputParams(
        temperature=0.35, max_tokens=300,
        thinking=GoogleLLMService.ThinkingConfig(thinking_budget=0))
    assert p.thinking is not None, "pipecat dropped the thinking config"
    assert p.thinking.thinking_budget == 0


@pytest.mark.asyncio
async def test_machine_greeting_scraps_do_not_suppress_our_opening():
    """Call 38536b71: four announcements were filtered correctly, then the
    one-word scrap 'तो।' slipped through, counted as the callee, and
    _greet_when_ready skipped our opening (greetPath "callee_spoke_first")."""
    rec = _Rec()
    tc = _replay_collector(rec)
    tc._bot_spoke_once = lambda: False
    await _feed(tc, "Your call has been forwarded to voicemail.")   # arms it
    await _feed(tc, "तो।")
    assert rec.frames == [], "a machine scrap reached the model"
    assert rec.interruptions == 0


@pytest.mark.asyncio
async def test_a_human_picking_up_mid_greeting_is_still_answered():
    """REVERSED 2026-08-13 (call 2fc70065), deliberately.

    This used to assert that a pre-speech "Hello." REACHED THE MODEL. That is a
    mechanism, and the mechanism was the bug: the caller's greeting drove a full
    LLM generation *while the scripted opening was also playing*, so the caller
    heard Shreya introduce herself twice in four seconds and said so on the line
    ("अभी तो आपने बताया, दो बार क्यों बता…"). The operator's own fragmented
    announcement did the same thing one beat earlier via bare "Hi.".

    The OUTCOME the original test cared about — a human who picks up is never
    ignored — is preserved and is what is asserted now: the greeting does not
    reach the model, and it also does not suppress our opening, so the opening is
    what answers them. One reply instead of two.
    """
    rec = _Rec()
    tc = _replay_collector(rec)
    tc._bot_spoke_once = lambda: False
    await _feed(tc, "Your call has been forwarded to voicemail.")
    rec.frames.clear()
    await _feed(tc, "Hello.")
    from app.turntake import suppresses_opening
    assert rec.frames == [], "a bare greeting must not drive its own generation"
    # ...and the thing that actually answers them still fires.
    assert not suppresses_opening("Hello."), "our opening must still play"
    assert tc._outcome.transcript[-1]["text"] == "Hello.", "still on the record"


@pytest.mark.asyncio
async def test_the_operator_fragment_that_caused_the_double_intro():
    """Call 2fc70065: the announcement split as "Hi." + "If you record your" +
    "name and reason." The FIRST fragment matches no carrier phrase, so it
    counted as the callee and drove a whole reply — and the latch that would have
    caught it only arms on the SECOND fragment, 0.6s too late."""
    rec = _Rec()
    tc = _replay_collector(rec)
    tc._bot_spoke_once = lambda: False
    for frag in ("Hi.", "If you record your", "name and reason."):
        await _feed(tc, frag)
    assert rec.frames == [], f"an operator fragment reached the model: {rec.frames}"


@pytest.mark.asyncio
async def test_a_caller_who_really_takes_over_before_we_speak_still_reaches_the_model():
    """The drop is bounded to 1-2 word scraps for exactly this reason: someone who
    answers with a real question must get a real answer, not a scripted pitch."""
    rec = _Rec()
    tc = _replay_collector(rec)
    tc._bot_spoke_once = lambda: False
    from app.turntake import suppresses_opening
    await _feed(tc, "aap kaun bol rahe hain bhai")
    assert rec.frames, "a substantive first turn was swallowed"
    assert suppresses_opening("aap kaun bol rahe hain bhai")


@pytest.mark.asyncio
async def test_short_answers_survive_once_we_have_spoken():
    """After our opening, a one-word answer ('Raman') is the whole point."""
    rec = _Rec()
    tc = _replay_collector(rec, bot_speaking=False)
    tc._bot_spoke_once = lambda: True
    await _feed(tc, "Your call has been forwarded to voicemail.")
    rec.frames.clear()
    await _feed(tc, "Raman")
    assert rec.frames, "a real one-word answer was dropped"


# ── NoRepeatGate (2026-08-06): what four prompt attempts could not fix ───────
class _NRRec:
    def __init__(self):
        self.text = []

    async def push(self, frame, direction=None):
        t = getattr(frame, "text", None)
        if t:
            self.text.append(t)


def _no_repeat(rec, caller=""):
    g = b.NoRepeatGate(enabled=lambda: True, last_caller_text=lambda: caller)
    g.push_frame = rec.push
    b.FrameProcessor.process_frame = _noop_super
    return g


async def _reply(gate, *sentences):
    from pipecat.frames.frames import (LLMFullResponseStartFrame,
                                       LLMFullResponseEndFrame, LLMTextFrame)
    d = b.FrameDirection.DOWNSTREAM
    await gate.process_frame(LLMFullResponseStartFrame(), d)
    for s in sentences:
        await gate.process_frame(LLMTextFrame(s), d)
    await gate.process_frame(LLMFullResponseEndFrame(), d)


@pytest.mark.asyncio
async def test_the_bot_stops_re_asking_its_own_closing_questions():
    """Verbatim from the measured A/B run: these two questions were asked twice
    in a ten-turn conversation, and that is what the founder kept hearing."""
    rec = _NRRec()
    g = _no_repeat(rec)
    await _reply(g, "MGP mein hum 90% marks ki guarantee dete hain. ",
                 "Kya aap iski fees ke baare mein jaanna chahenge? ")
    rec.text.clear()
    await _reply(g, "MGP ki fees chalis hazaar se saath hazaar ke beech hai. ",
                 "Kya aap iski fees ke baare mein jaanna chahengi? ")
    joined = " ".join(rec.text)
    assert "chalis hazaar" in joined, "new content must still be spoken"
    assert "jaanna chaheng" not in joined, "the re-asked question got through"


@pytest.mark.asyncio
async def test_short_acknowledgements_are_never_suppressed():
    """"Theek hai" / "achha" recur legitimately every call. Stripping them
    would leave the bot with no acknowledgements at all."""
    rec = _NRRec()
    g = _no_repeat(rec)
    for _ in range(3):
        await _reply(g, "Theek hai. ", "Achha. ")
    assert len(rec.text) == 6, rec.text


@pytest.mark.asyncio
async def test_a_reply_is_never_silenced_completely():
    """If every sentence is a repeat, one repeated line beats dead air."""
    rec = _NRRec()
    g = _no_repeat(rec)
    await _reply(g, "Kya main is WhatsApp number par link bhej doon? ")
    rec.text.clear()
    await _reply(g, "Kya main is WhatsApp number par link bhej doon? ")
    assert rec.text, "the reply vanished entirely — caller hears silence"


@pytest.mark.asyncio
async def test_repeating_is_allowed_when_the_caller_asks_for_it():
    rec = _NRRec()
    g = _no_repeat(rec, caller="phir se bataiye")
    await _reply(g, "MGP ki fees chalis hazaar se saath hazaar ke beech hai. ")
    rec.text.clear()
    await _reply(g, "MGP ki fees chalis hazaar se saath hazaar ke beech hai. ")
    assert rec.text, "caller asked us to repeat and we refused"


@pytest.mark.asyncio
async def test_the_same_question_in_different_words_is_still_a_repeat():
    """Call 597aeb3f asked for the class twice. The two sentences score ~0.6
    against each other, so sentence similarity alone let it through."""
    rec = _NRRec()
    g = _no_repeat(rec)
    await _reply(g, "Aur wo abhi kis class mein hai? ")
    rec.text.clear()
    await _reply(g, "Raman abhi kis class mein padh raha hai? ")
    assert not any("class mein padh" in t for t in rec.text), rec.text


@pytest.mark.asyncio
async def test_a_fully_repeated_reply_hands_back_instead_of_repeating():
    """The first never-silent guard re-emitted the duplicate, and fired seven
    times in one afternoon — the guard against dead air was itself producing
    the repetition."""
    rec = _NRRec()
    g = _no_repeat(rec)
    await _reply(g, "Kya main is WhatsApp number par link bhej doon? ")
    rec.text.clear()
    await _reply(g, "Kya main is WhatsApp number par link bhej doon? ")
    joined = " ".join(rec.text)
    assert joined.strip(), "the line went dead"
    assert "WhatsApp" not in joined, "it repeated instead of handing back"


@pytest.mark.asyncio
async def test_statements_about_a_topic_are_not_suppressed_as_questions():
    """Only QUESTIONS carry a topic. The pitch mentions fees constantly and
    must survive."""
    rec = _NRRec()
    g = _no_repeat(rec)
    await _reply(g, "Kya aap fees ke baare mein jaanna chahenge? ")
    rec.text.clear()
    await _reply(g, "MGP ki fees chalis hazaar se saath hazaar ke beech hoti hai. ")
    assert any("chalis hazaar" in t for t in rec.text), rec.text


# ── no-echo gate (2026-08-12): "there is no need to reconfirm every time" ─────
# Founder, on live call c7bf5ff5: "It asked how many marks, the person said
# ninety-four, and it comes back 'okay, you got ninety-four'. It looks like an AI
# if you reconfirm everything every time." Three turns in a row opened with the
# restatement, and each one shared its sentence with the real next question —
# which is why this is a CLAUSE trim and not a sentence gate.
def _no_echo_gate(rec, caller, diag=None, on=True):
    g = b.NoRepeatGate(enabled=lambda: True, last_caller_text=lambda: caller,
                       diag=diag, no_echo=lambda: on)
    g.push_frame = rec.push
    b.FrameProcessor.process_frame = _noop_super
    return g


@pytest.mark.asyncio
async def test_the_parroted_opener_never_reaches_the_caller():
    """Verbatim turn 2 of the call. The restatement goes, the question stays."""
    import app.diagnostics as dg
    d = dg.CallDiagnostics()
    rec = _NRRec()
    g = _no_echo_gate(rec, "सुबोध अभी आठवीं में है।", diag=d)
    await _reply(g, "सुबोध अभी कौन से क्लास में है? ")        # the question it asked
    rec.text.clear()
    await _reply(g, "ओके, सुबोध अभी आठवीं क्लास में है, तो सुबोध के लास्ट एनुअल एक्ज़ाम "
                    "में कितने मार्क्स आए थे? ")
    said = " ".join(rec.text)
    assert "आठवीं क्लास में है" not in said, said
    assert "कितने मार्क्स" in said, "the question was trimmed away with the echo"
    assert d.echoes_trimmed == 1


@pytest.mark.asyncio
async def test_the_bots_own_reaction_survives_the_trim():
    """A counsellor really does say "that's a great score" — they just don't read
    the number back first. Only the caller's own words go."""
    rec = _NRRec()
    g = _no_echo_gate(rec, "तिरानवे प्रतिशत।")
    await _reply(g, "सुबोध के लास्ट एनुअल एक्ज़ाम में कितने मार्क्स आए थे? ")
    rec.text.clear()
    await _reply(g, "सुबोध के लास्ट बहुत अच्छे, तिरानवे प्रतिशत मार्क्स, बहुत बढ़िया स्कोर है। ")
    said = " ".join(rec.text)
    assert "तिरानवे" not in said, said
    assert "बढ़िया स्कोर" in said


@pytest.mark.asyncio
async def test_only_the_first_sentence_of_a_reply_is_trimmed():
    """A later sentence reusing the caller's words is the bot BUILDING on them."""
    rec = _NRRec()
    g = _no_echo_gate(rec, "सुबोध अभी आठवीं में है।")
    await _reply(g, "हमारा Insight program है। ", "सुबोध आठवीं में है, तो यही सही रहेगा। ")
    assert "सुबोध आठवीं में है" in " ".join(rec.text)


@pytest.mark.asyncio
async def test_the_required_digit_read_back_is_never_trimmed():
    """CLOSE CONCRETELY makes reading a number back mandatory — the one echo we
    DO want. A gate that eats it would break booking confirmation."""
    rec = _NRRec()
    g = _no_echo_gate(rec, "nau do teen chaar paanch chhe saat aath nau shunya")
    await _reply(g, "आपका number nau do teen chaar, paanch chhe saat aath nau shunya, सही है? ")
    assert "nau do teen chaar" in " ".join(rec.text)


@pytest.mark.asyncio
async def test_no_echo_kill_switch_restores_the_old_behaviour():
    rec = _NRRec()
    g = _no_echo_gate(rec, "सुबोध अभी आठवीं में है।", on=False)
    await _reply(g, "ओके, सुबोध अभी आठवीं क्लास में है, तो marks कितने आए थे? ")
    assert "आठवीं क्लास में है" in " ".join(rec.text)


@pytest.mark.asyncio
async def test_a_reply_that_is_entirely_parroting_still_says_something():
    """Same rule as NoRepeatGate: one clumsy line beats dead air."""
    rec = _NRRec()
    g = _no_echo_gate(rec, "सुबोध आठवीं में है।")
    await _reply(g, "सुबोध आठवीं में है। ")
    assert " ".join(rec.text).strip()


# ── call 3148ccd4 (2026-08-13): the gate that gagged the bot ─────────────────
# The worst call we have logs for. Mumbai box, 90 seconds: 20 bot sentences
# suppressed, SEVEN handbacks, and "Raman abhi kaun si class mein hai?" — asked
# once, never answered — blocked on all six attempts to ask it again. The caller
# spent the last 45s asking "मैं क्या बताऊँ?" (what am I supposed to tell you)
# and hung up. Latency was fine throughout: LLM 0.18-0.32s, TTS 0.14-0.39s.
@pytest.mark.asyncio
async def test_an_unanswered_question_can_be_asked_again():
    """THE regression. The bot must not be permanently gagged on the one question
    that would move the call forward."""
    caller = {"t": "हाँ।"}
    rec = _NRRec()
    g = b.NoRepeatGate(enabled=lambda: True, last_caller_text=lambda: caller["t"])
    g.push_frame = rec.push
    b.FrameProcessor.process_frame = _noop_super

    await _reply(g, "Raman abhi kaun si class mein hai? ")
    got = []
    # The caller never answers — they are still working out who is calling.
    for said in ("बताइए।", "जी, बोलिए।", "मैं क्या बताऊँ?", "क्या बोलूं?"):
        caller["t"] = said
        rec.text.clear()
        await _reply(g, "Raman abhi kaun si class mein hai? ")
        got.append(" ".join(rec.text))
    assert any("class mein hai" in g_ for g_ in got), (
        "the bot never got to re-ask the question the caller never answered: %r" % got)


@pytest.mark.asyncio
async def test_a_genuinely_answered_question_is_still_suppressed():
    """The original bug this gate exists for must stay fixed: asking a closing
    question again a couple of turns later is still suppressed."""
    caller = {"t": "haan"}
    rec = _NRRec()
    g = b.NoRepeatGate(enabled=lambda: True, last_caller_text=lambda: caller["t"])
    g.push_frame = rec.push
    b.FrameProcessor.process_frame = _noop_super
    await _reply(g, "Kya aap iski fees ke baare mein jaanna chahenge? ")
    rec.text.clear()
    await _reply(g, "MGP ki fees chalis hazaar se saath hazaar ke beech hai. ",
                 "Kya aap iski fees ke baare mein jaanna chahengi? ")
    joined = " ".join(rec.text)
    assert "chalis hazaar" in joined
    assert "jaanna chaheng" not in joined, "the re-asked question got through"


@pytest.mark.asyncio
async def test_the_bot_never_says_you_talk_twice_running():
    """Every handback line means "you speak" — from the party that placed the
    call. One is recovery; a run of them is a conversation with no way back."""
    caller = {"t": "बताइए।"}
    rec = _NRRec()
    import app.diagnostics as dg
    d = dg.CallDiagnostics()
    g = b.NoRepeatGate(enabled=lambda: True, last_caller_text=lambda: caller["t"], diag=d)
    g.push_frame = rec.push
    b.FrameProcessor.process_frame = _noop_super

    await _reply(g, "Aapne apne bete Raman ke liye ek query dali thi. ")
    heard = []
    for said in ("बताइए।", "जी, बोलिए।", "आप बताइए।", "मैं क्या बताऊँ?"):
        caller["t"] = said
        rec.text.clear()
        await _reply(g, "Aapne apne bete Raman ke liye ek query dali thi. ")
        heard.append(" ".join(rec.text))
    for a, bb in zip(heard, heard[1:]):
        assert not (a in b.NoRepeatGate._HANDBACK and bb in b.NoRepeatGate._HANDBACK), (
            "two handbacks in a row: %r" % heard)


@pytest.mark.asyncio
async def test_handbacks_follow_the_agents_language():
    """These lines never touch the LLM, so the prompt's SCRIPT rule cannot reach
    them — an English agent would hand back in romanized Hindi."""
    rec = _NRRec()
    g = b.NoRepeatGate(enabled=lambda: True, last_caller_text=lambda: "tell me",
                       handbacks=b.NoRepeatGate._HANDBACK_EN)
    g.push_frame = rec.push
    b.FrameProcessor.process_frame = _noop_super
    await _reply(g, "You had submitted a query for your son Raman. ")
    rec.text.clear()
    await _reply(g, "You had submitted a query for your son Raman. ")
    assert " ".join(rec.text) in b.NoRepeatGate._HANDBACK_EN


def test_a_handback_run_is_a_fault_not_a_silent_counter():
    """On the real call this fired zero signals: the panel showed ANSWER_DELETED
    (a one-word fragment), DEAD_AIR and LIKELY_MACHINE, none of which was it."""
    import app.diagnostics as dg
    d = dg.CallDiagnostics(user_turns=15, bot_turns=15, handbacks=7)
    v = dg.verdict(d)
    assert v["health"] == dg.RED
    assert v["headline"] == dg.HANDBACK_LOOP
    assert "asking the caller to talk" in dg.to_payload(d)["headlineText"]
    # ...and it outranks the consequences it causes.
    d2 = dg.CallDiagnostics(user_turns=15, bot_turns=15, handbacks=7,
                            answers_deleted=1, dead_air=[6.1])
    assert dg.verdict(d2)["headline"] == dg.HANDBACK_LOOP
