"""
Text-to-speech engines for the learner voice call.

The call used to be hard-wired to Sarvam. The engine is now a platform setting
(`chatbot.voice.tts_provider`, set from the super-admin portal) and this module
is the one place that knows how to drive each one.

Every engine returns a complete, independently playable audio file plus its
MIME type — the browser decodes each spoken segment on its own, so WAV from
Sarvam and MP3 from Google/Edge are equally fine. A failing engine falls back to
Sarvam for that line: a misconfigured vendor must degrade to a different voice,
never to a silent call.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any, Dict, List, Optional, Tuple

from .sarvam_service import SarvamService

logger = logging.getLogger(__name__)

# Voices proven on the AI-calling side (voice_bot_service config) plus Edge's
# published Indian-locale neural voices. Chirp3-HD voice names are shared across
# Google locales, so the same suffix works for every language we offer.
_GOOGLE_DEFAULT_SUFFIX = "Chirp3-HD-Achird"
_EDGE_DEFAULT_VOICES = {
    "en-IN": "en-IN-NeerjaNeural",
    "hi-IN": "hi-IN-SwaraNeural",
    "bn-IN": "bn-IN-TanishaaNeural",
    "ta-IN": "ta-IN-PallaviNeural",
    "te-IN": "te-IN-ShrutiNeural",
    "kn-IN": "kn-IN-SapnaNeural",
    "ml-IN": "ml-IN-SobhanaNeural",
    "mr-IN": "mr-IN-AarohiNeural",
    "gu-IN": "gu-IN-DhwaniNeural",
}

TTS_PROVIDERS: Dict[str, Dict[str, Any]] = {
    "sarvam": {
        "label": "Sarvam Bulbul v3",
        "note": "Indian-language specialist; uses the institute's configured voice.",
    },
    "google": {
        "label": "Google Cloud Chirp3-HD",
        "note": "Needs GOOGLE_APPLICATION_CREDENTIALS_JSON on ai-service (same as the video pipeline).",
    },
    "edge": {
        "label": "Microsoft Edge neural (free)",
        "note": "No key and no per-character charge; quality a notch below the paid engines.",
    },
}


def default_voice_for(provider: str, language: str) -> str:
    lang = (language or "en-IN").strip()
    if provider == "google":
        return f"{lang}-{_GOOGLE_DEFAULT_SUFFIX}"
    if provider == "edge":
        return _EDGE_DEFAULT_VOICES.get(lang) or _EDGE_DEFAULT_VOICES["en-IN"]
    return "shubh"


def _google_available() -> bool:
    return bool(
        os.environ.get("GOOGLE_APPLICATION_CREDENTIALS_JSON")
        or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    )


def list_tts_providers() -> List[Dict[str, Any]]:
    """Catalogue for the super-admin portal, with whether each engine can run here."""
    out = []
    for pid, meta in TTS_PROVIDERS.items():
        available = True
        if pid == "sarvam":
            available = bool(os.environ.get("SARVAM_API_KEY"))
        elif pid == "google":
            available = _google_available()
        out.append(
            {
                "id": pid,
                "label": meta["label"],
                "note": meta["note"],
                "available": available,
                "default_voice_example": default_voice_for(pid, "hi-IN"),
            }
        )
    return out


# --------------------------------------------------------------------------
# Engines
# --------------------------------------------------------------------------

async def _sarvam(text: str, language: str, voice: str, pace: Optional[float] = None) -> Tuple[bytes, str]:
    audio = await SarvamService().text_to_speech(text=text, language=language, voice=voice or "shubh", pace=pace)
    return audio, "audio/wav"


def _google_sync(text: str, language: str, voice: str) -> bytes:
    from google.cloud import texttospeech  # heavy import, only when used
    from google.oauth2 import service_account

    creds = None
    raw_json = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS_JSON")
    if raw_json:
        info = json.loads(raw_json)
        pk = info.get("private_key", "")
        if "\\n" in pk and "\n" not in pk:
            info["private_key"] = pk.replace("\\n", "\n")
        creds = service_account.Credentials.from_service_account_info(info)
    # Otherwise fall through to ADC (GOOGLE_APPLICATION_CREDENTIALS file path).
    client = texttospeech.TextToSpeechClient(credentials=creds)

    voice_name = voice or default_voice_for("google", language)
    # The locale is encoded in the voice name (hi-IN-Chirp3-HD-Achird).
    parts = voice_name.split("-")
    language_code = "-".join(parts[:2]) if len(parts) >= 2 else (language or "en-IN")
    response = client.synthesize_speech(
        input=texttospeech.SynthesisInput(text=text),
        voice=texttospeech.VoiceSelectionParams(language_code=language_code, name=voice_name),
        # No speaking_rate: Chirp3-HD returns 400 if the field is present at all.
        audio_config=texttospeech.AudioConfig(audio_encoding=texttospeech.AudioEncoding.MP3),
    )
    return bytes(response.audio_content or b"")


async def _google(text: str, language: str, voice: str, pace: Optional[float] = None) -> Tuple[bytes, str]:
    audio = await asyncio.to_thread(_google_sync, text, language, voice)
    return audio, "audio/mpeg"


async def _edge(text: str, language: str, voice: str, pace: Optional[float] = None) -> Tuple[bytes, str]:
    import edge_tts  # lazy: only when the engine is selected

    kwargs = {}
    if pace and abs(pace - 1.0) >= 0.05:
        kwargs["rate"] = f"{'+' if pace > 1 else '-'}{int(round(abs(pace - 1.0) * 100))}%"
    communicate = edge_tts.Communicate(text, voice or default_voice_for("edge", language), **kwargs)
    buf = bytearray()
    async for chunk in communicate.stream():
        if chunk.get("type") == "audio" and chunk.get("data"):
            buf.extend(chunk["data"])
    return bytes(buf), "audio/mpeg"


_ENGINES = {"sarvam": _sarvam, "google": _google, "edge": _edge}


async def synthesize_speech(
    text: str,
    language: str,
    voice: Optional[str],
    provider: str,
    pace: Optional[float] = None,
) -> Tuple[bytes, str, str]:
    """
    Speak `text` with `provider`. Returns (audio_bytes, mime_type, provider_used) —
    provider_used differs from `provider` when the engine failed and Sarvam
    covered the line, so metering records what actually ran. `pace` is a
    speed multiplier (0.5–2.0; 1.0 = normal) honoured by Sarvam and Edge;
    Google Chirp3-HD rejects a rate field, so it is ignored there.
    """
    provider = (provider or "sarvam").strip().lower()
    engine = _ENGINES.get(provider, _sarvam)
    if not text.strip():
        return b"", "audio/wav", provider
    if pace is not None:
        pace = max(0.5, min(2.0, float(pace)))

    try:
        audio, mime = await asyncio.wait_for(engine(text, language, voice or "", pace), timeout=30)
        if audio:
            return audio, mime, provider
        logger.warning("TTS engine %s returned no audio; falling back to Sarvam", provider)
    except Exception:
        logger.exception("TTS engine %s failed; falling back to Sarvam", provider)

    if provider == "sarvam":
        return b"", "audio/wav", provider
    try:
        audio, mime = await _sarvam(text, language, "")
        return audio, mime, "sarvam"
    except Exception:
        logger.exception("Sarvam fallback failed too")
        return b"", "audio/wav", "sarvam"


__all__ = ["TTS_PROVIDERS", "default_voice_for", "list_tts_providers", "synthesize_speech"]
