"""Navana (Bodhi) TTS wiring. No network: construction, routing, language and
voice-gender only — the vendor socket is exercised by a real call."""
import pytest

from app import providers as p
from app import bot as b
from app.config import get_settings


def test_agent_languages_map_to_navana_codes():
    assert p.navana_language("hinglish") == "hi"
    assert p.navana_language("english") == "en"
    assert p.navana_language("en-IN") == "en"
    assert p.navana_language("marathi") == "mr"
    assert p.navana_language("od-IN") == "or"          # Sarvam's Odia spelling
    assert p.navana_language("") == "hi"
    assert p.navana_language("klingon") == "hi"


def test_engine_and_voice_gender():
    assert b._engine_of("navana") == "navana"
    assert b._voice_gender("bhavana") == "female"
    assert b._voice_gender("anirban") == "male"
    assert "bhavana" in b.NAVANA_VOICES and len(b.NAVANA_VOICES) == 55


def _with_key(value):
    s = get_settings()
    old = s.navana_api_key
    object.__setattr__(s, "navana_api_key", value)
    return s, old


def test_missing_key_falls_back_to_sarvam():
    s, old = _with_key("")
    try:
        tts = p.build_tts(24000, "bhavana", tts_model="navana", language="hinglish")
        assert p.engine_of(tts)[0] == "sarvam"
    finally:
        object.__setattr__(s, "navana_api_key", old)


def test_builds_the_navana_service_metered():
    pytest.importorskip("bodhi.integrations.pipecat_tts")
    from bodhi.integrations.pipecat_tts import BodhiTTSService
    s, old = _with_key("test-key-not-real")
    try:
        tts = p.build_tts(24000, "anirban", tts_model="navana", language="marathi")
        assert isinstance(tts, BodhiTTSService)
        assert p.engine_of(tts) == ("navana", "anirban")
        # The metering wrapper (vendor characters -> diagnostics.tts.chars).
        assert type(tts).run_tts is not BodhiTTSService.run_tts
    finally:
        object.__setattr__(s, "navana_api_key", old)


# ── speech cache support (2026-09-30) ─────────────────────────────────────
def test_cache_key_separates_languages_for_navana_only():
    from app.ttscache import cache_key
    kw = dict(engine="navana", model="", voice="ipsita", pace=1.0, temperature=None,
              sample_rate=8000, term_map_version="", text="नमस्ते जी।")
    assert cache_key(**kw, language="hinglish") == cache_key(**kw, language="hi-IN")
    assert cache_key(**kw, language="hinglish") != cache_key(**kw, language="marathi")
    g = dict(kw, engine="google")
    assert cache_key(**g, language="hinglish") == cache_key(**g, language="marathi")


def test_navana_is_an_async_arrival_engine():
    from app.ttscache import is_async_arrival
    assert is_async_arrival("navana")


@pytest.mark.asyncio
async def test_renderer_uses_the_live_settings(monkeypatch):
    """No speed (the live stream cannot send one) and the agent's language code."""
    import io
    import wave
    from app import main as m
    from app.ttswarm import synthesize
    seen = {}

    async def fake(text, voice, lang, pace):
        seen.update(text=text, voice=voice, lang=lang, pace=pace)
        buf = io.BytesIO()
        with wave.open(buf, "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000)
            w.writeframes(b"\x00\x01" * 24000)
        return buf.getvalue()
    monkeypatch.setattr(m, "_navana_tts_wav", fake)
    pcm = await synthesize(engine="navana", model="", voice="ipsita", pace=1.02,
                           temperature=None, text="नमस्ते।", language="mr")
    assert seen == {"text": "नमस्ते।", "voice": "ipsita", "lang": "mr", "pace": None}
    assert pcm and abs(len(pcm) - 16000) < 400      # 1 s at 8 kHz, 16-bit


class _Sock:
    def __init__(self, messages):
        self._m = messages
        self.sent = []

    def __aiter__(self):
        return self._gen()

    async def _gen(self):
        for x in self._m:
            yield x

    async def send(self, data):
        self.sent.append(data)


@pytest.mark.asyncio
async def test_chunks_follow_their_own_sentence_not_the_playing_one():
    """Sentence 1 ("A") is PLAYING; sentence 2's audio must still be filed under
    "B". The SDK's stock loop filed it under the playing context."""
    import json
    pytest.importorskip("bodhi.integrations.pipecat_tts")
    from bodhi.integrations.pipecat_tts import BodhiTTSService
    cls = p._navana_seq_routing(BodhiTTSService)
    tts = cls(api_key="k", voice="ipsita", language="hi")
    tts._reuse_context_id_within_turn = False
    tts._output_sample_rate = 8000
    tts._nv_reset()
    tts._nv_ctx = {1: "A", 2: "B"}
    appended, removed, open_ctx = [], [], {"A", "B"}

    async def append(ctx, frame):
        appended.append((ctx, type(frame).__name__))

    async def remove(ctx):
        removed.append(ctx)
        open_ctx.discard(ctx)

    async def noop(*a, **k):
        return None
    tts.append_to_audio_context = append
    tts.remove_audio_context = remove
    tts.audio_context_available = lambda c: c in open_ctx
    tts.get_active_audio_context_id = lambda: "A"
    tts.stop_ttfb_metrics = noop
    sock = _Sock([
        json.dumps({"type": "audio", "seq": 1, "is_last_chunk": False}), b"\x00" * 320,
        json.dumps({"type": "audio", "seq": 2, "is_last_chunk": False}), b"\x00" * 320,
        json.dumps({"type": "audio", "seq": 1, "is_last_chunk": True}), b"\x00" * 320,
        json.dumps({"type": "audio", "seq": 2, "is_last_chunk": True}), b"\x00" * 320,
    ])
    tts._get_websocket = lambda: sock
    await tts._receive_messages()
    audio_for = [c for c, kind in appended if kind == "TTSAudioRawFrame"]
    assert audio_for == ["A", "B", "A", "B"], appended
    assert removed == ["A", "B"]
    assert ("A", "TTSStoppedFrame") in appended and ("B", "TTSStoppedFrame") in appended


@pytest.mark.asyncio
async def test_run_tts_records_the_seq_it_sent():
    pytest.importorskip("bodhi.integrations.pipecat_tts")
    from bodhi.integrations.pipecat_tts import BodhiTTSService
    from websockets.protocol import State
    cls = p._navana_seq_routing(BodhiTTSService)
    tts = cls(api_key="k", voice="ipsita", language="hi")
    tts._reuse_context_id_within_turn = False
    sock = _Sock([])
    sock.state = State.OPEN
    tts._websocket = sock
    tts._get_websocket = lambda: sock

    async def noop(*a, **k):
        return None
    tts.start_ttfb_metrics = noop
    tts.start_tts_usage_metrics = noop
    async for _ in tts.run_tts("पहला।", "ctx-1"):
        pass
    async for _ in tts.run_tts("दूसरा।", "ctx-2"):
        pass
    assert tts._nv_ctx == {1: "ctx-1", 2: "ctx-2"}


# ── Said must mean heard (calls 18b63b17 / 45749163, 2026-09-30) ─────────────
def _heard_rig(monkeypatch, *, per_sentence=True, open_ctx=None):
    """The routed service with pipecat's audio-context queue replaced by a log:
    `log` is every frame that reached a context, in order."""
    pytest.importorskip("bodhi.integrations.pipecat_tts")
    from bodhi.integrations.pipecat_tts import BodhiTTSService
    from pipecat.services.tts_service import TTSService
    log = []
    ctxs = set(open_ctx or {"A", "B", "C"})

    async def base_append(self, ctx, frame):
        log.append((ctx, type(frame).__name__, getattr(frame, "text", None)))

    async def base_interrupted(self, ctx):
        return None
    monkeypatch.setattr(TTSService, "append_to_audio_context", base_append)
    monkeypatch.setattr(TTSService, "on_audio_context_interrupted", base_interrupted)
    cls = p._navana_seq_routing(BodhiTTSService)
    tts = cls(api_key="k", voice="ipsita", language="hi")
    tts._reuse_context_id_within_turn = not per_sentence
    tts._output_sample_rate = 8000
    tts._nv_reset()

    async def remove(ctx):
        ctxs.discard(ctx)

    async def noop(*a, **k):
        return None
    tts.remove_audio_context = remove
    tts.audio_context_available = lambda c: c in ctxs
    tts.get_active_audio_context_id = lambda: next(iter(sorted(ctxs)), None)
    tts.stop_ttfb_metrics = noop
    return tts, log, ctxs


def _sent(tts, seq, ctx):
    """What run_tts records the moment it has sent sentence `seq`."""
    tts._nv_ctx[seq] = ctx
    tts._nv_ctx_seq[ctx] = seq


def _text(t):
    from pipecat.frames.frames import TTSTextFrame
    return TTSTextFrame(t, aggregated_by="sentence")


def _chunks(seq, n, last=True, progress=False):
    """Navana's per-chunk header + binary frame. `progress` adds the documented
    chunk_index (0-based) / chunk_total fields."""
    import json
    out = []
    for i in range(n):
        h = {"type": "audio", "seq": seq, "is_last_chunk": last and i == n - 1}
        if progress:
            h.update(chunk_index=i, chunk_total=n)
        out += [json.dumps(h), b"\x00" * 320]
    return out


@pytest.mark.asyncio
async def test_a_sentences_text_follows_half_of_its_audio(monkeypatch):
    """pipecat appends a push_text_frames service's text right after run_tts —
    for Navana BEFORE any audio. It now goes after half the sentence's audio:
    a sentence cut in its first half is re-sayable, one heard mostly is not
    repeated in full (the review of 2cfb1cff29: all-or-nothing re-said a nearly
    finished opening and lost the answer to it)."""
    tts, log, _ = _heard_rig(monkeypatch)
    _sent(tts, 1, "A")
    await tts.append_to_audio_context("A", _text("फीस तीस हज़ार है।"))
    assert log == [], "the text went out before any audio"
    tts._get_websocket = lambda: _Sock(_chunks(1, 4, progress=True))
    await tts._receive_messages()
    kinds = [k for _c, k, _t in log]
    assert kinds == ["TTSAudioRawFrame"] * 2 + ["TTSTextFrame"] + ["TTSAudioRawFrame"] * 2 \
        + ["TTSStoppedFrame"], log


@pytest.mark.asyncio
async def test_without_progress_headers_text_waits_for_the_last_chunk(monkeypatch):
    """No chunk_index/chunk_total: never release early — at the last chunk."""
    tts, log, _ = _heard_rig(monkeypatch)
    _sent(tts, 1, "A")
    await tts.append_to_audio_context("A", _text("फीस तीस हज़ार है।"))
    assert log == [], "the text went out before any audio"
    tts._get_websocket = lambda: _Sock(_chunks(1, 3))
    await tts._receive_messages()
    kinds = [k for _c, k, _t in log]
    assert kinds == ["TTSAudioRawFrame"] * 3 + ["TTSTextFrame", "TTSStoppedFrame"], log


@pytest.mark.asyncio
async def test_a_dropped_sentence_never_counts_as_said(monkeypatch):
    """FloorGate held the reply (the parent was still talking) and the parent's
    words dropped it: the interruption reaches the TTS, and NOTHING of that
    sentence — neither its late chunks nor its text — may reach any context."""
    tts, log, ctxs = _heard_rig(monkeypatch)
    _sent(tts, 1, "A")
    await tts.append_to_audio_context("A", _text("मार्क्स कितने आए थे?"))
    await tts.on_audio_context_interrupted("A")
    ctxs.discard("A")
    tts._get_websocket = lambda: _Sock(_chunks(1, 2))
    await tts._receive_messages()
    assert all(t != "मार्क्स कितने आए थे?" for _c, _k, t in log), log
    assert not [x for x in log if x[1] == "TTSAudioRawFrame"], log


@pytest.mark.asyncio
async def test_a_dropped_replys_late_audio_never_plays_inside_the_next_reply(monkeypatch):
    """No socket reconnect happens for a reply that never started playing, so
    Navana keeps streaming it. Its chunks used to fall back to the PLAYING
    context — the next reply's."""
    tts, log, ctxs = _heard_rig(monkeypatch, open_ctx={"B"})
    _sent(tts, 1, "A")
    await tts.on_audio_context_interrupted("A")
    _sent(tts, 2, "B")                                # the next reply
    await tts.append_to_audio_context("B", _text("जी, बताइए।"))
    tts._get_websocket = lambda: _Sock(_chunks(1, 3) + _chunks(2, 2))
    await tts._receive_messages()
    assert [c for c, k, _t in log if k == "TTSAudioRawFrame"] == ["B", "B"], log
    assert ("B", "TTSTextFrame", "जी, बताइए।") in log


@pytest.mark.asyncio
async def test_with_the_cache_off_text_still_follows_audio_and_the_turn_context_stays_open(monkeypatch):
    """One context per turn (cache off, e.g. the Mediquity agent): each sentence's
    text after its own audio; the turn's context is not closed per sentence."""
    tts, log, ctxs = _heard_rig(monkeypatch, per_sentence=False, open_ctx={"T"})
    _sent(tts, 1, "T")
    await tts.append_to_audio_context("T", _text("पहला।"))
    _sent(tts, 2, "T")
    await tts.append_to_audio_context("T", _text("दूसरा?"))
    tts._get_websocket = lambda: _Sock(_chunks(1, 2) + _chunks(2, 2))
    await tts._receive_messages()
    seq = [(k, t) for _c, k, t in log if k != "TTSAudioRawFrame"]
    assert seq == [("TTSTextFrame", "पहला।"), ("TTSStoppedFrame", None),
                   ("TTSTextFrame", "दूसरा?"), ("TTSStoppedFrame", None)], log
    assert "T" in ctxs, "the turn's context was closed after one sentence"


@pytest.mark.asyncio
async def test_a_cached_sentences_text_is_not_held(monkeypatch):
    """A cache hit never went to Navana: its text (appended after its audio by
    the base class) passes straight through."""
    tts, log, _ = _heard_rig(monkeypatch)
    await tts.append_to_audio_context("C", _text("नमस्ते जी।"))
    assert log == [("C", "TTSTextFrame", "नमस्ते जी।")]


@pytest.mark.asyncio
async def test_an_interruption_with_sentences_in_flight_reconnects(monkeypatch):
    """pipecat reconnects on an interruption only while the bot is audibly
    speaking. A reply FloorGate still held is not "speaking": without a
    reconnect Navana keeps generating it and the next reply queues behind."""
    pytest.importorskip("bodhi.integrations.pipecat_tts")
    from pipecat.services.tts_service import TTSService
    tts, _log, _ = _heard_rig(monkeypatch)

    async def base_interruption(self, frame, direction):
        await self.on_audio_context_interrupted("A")
    monkeypatch.setattr(TTSService, "_handle_interruption", base_interruption)
    calls = []

    async def disc():
        calls.append("disconnect")

    async def conn():
        calls.append("connect")
    tts._disconnect, tts._connect = disc, conn
    tts._bot_speaking = False
    _sent(tts, 1, "A")
    await tts._handle_interruption(None, None)
    assert calls == ["disconnect", "connect"], calls
    # Nothing in flight (e.g. only cached sentences): no reconnect.
    calls.clear()
    tts._nv_reset()
    await tts._handle_interruption(None, None)
    assert calls == [], calls
