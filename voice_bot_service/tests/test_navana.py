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
