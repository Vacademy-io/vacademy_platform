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
