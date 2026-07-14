"""STT / LLM / TTS provider factory — the ONLY module that knows vendor SDKs.

Mirrors the validated POC's ``services.py`` (github.com/shreyash-jain/sales-poc-ai):
Sarvam end-to-end (Saaras STT, Sarvam-M via the OpenAI-compatible endpoint, Bulbul
TTS) with an OpenRouter LLM fallback. Swapping a vendor = editing this file only;
bot.py and the transports never change.
"""
from __future__ import annotations

from pipecat.services.openai.llm import OpenAILLMService
from pipecat.services.sarvam.stt import SarvamSTTService
from pipecat.services.sarvam.tts import SarvamTTSService

from .config import get_settings


def build_stt(sample_rate: int, language: str | None = None, bias: str | None = None):
    s = get_settings()
    # Pin STT to the agent's configured language (BCP-47, e.g. "hi-IN"), falling back to
    # the SARVAM_STT_LANGUAGE env default. A pin matters: auto-detect drifts a Hindi/
    # Hinglish caller into a neighbouring Indic language (Punjabi/Marathi) and the call
    # follows it. `bias` is a short vocabulary hint (the agent's own name, e.g. "Aarushi")
    # fed to saarika's `prompt` so a caller repeating the name isn't transcribed as
    # "Aayushi"/"Aarush" and fed back into the LLM context as a wrong name. Guarded so a
    # bad value can't crash startup — it just falls back to auto / no bias.
    tag = language or s.sarvam_stt_language
    params = None
    if tag or bias:
        try:
            from pipecat.transcriptions.language import Language
            lang_kw = {"language": Language(tag)} if tag else {}
            try:
                # Preferred: language pin + name bias together.
                params = SarvamSTTService.InputParams(
                    **lang_kw, **({"prompt": bias[:200]} if bias else {}))
            except TypeError:
                # This pipecat build's InputParams has no `prompt` field — keep the
                # language pin (the more important of the two), drop the bias.
                params = SarvamSTTService.InputParams(**lang_kw) if lang_kw else None
        except Exception:
            params = None
    return SarvamSTTService(
        api_key=s.sarvam_api_key,
        model=s.sarvam_stt_model,
        sample_rate=sample_rate,
        params=params,
    )


def build_llm():
    s = get_settings()
    if s.llm_provider == "google":
        # Gemini via its OpenAI-compat endpoint, hit directly (no proxy hop;
        # Google's edge is local to the cluster — see config.llm_provider).
        # reasoning_effort none: Gemini 3.1 "thinks" by default, which pushes
        # TTFT up and widens its variance; 'none' measured 0.75-0.85s flat.
        # Sent via extra_body (not a top-level kwarg) so the OpenAI SDK can't
        # reject it as an unknown parameter.
        return OpenAILLMService(
            api_key=s.gemini_api_key,
            base_url=s.google_llm_base_url,
            model=s.google_llm_model,
            params=OpenAILLMService.InputParams(
                temperature=0.35, max_tokens=150,
                extra={"extra_body": {"reasoning_effort": "none"}},
            ),
        )
    if s.llm_provider == "openrouter":
        # Lazy import — only needed when the fallback is active.
        from pipecat.services.openrouter.llm import OpenRouterLLMService

        return OpenRouterLLMService(
            api_key=s.openrouter_api_key,
            model=s.openrouter_model,
            params=OpenRouterLLMService.InputParams(temperature=0.35, max_tokens=150),
        )
    # Sarvam's OpenAI-compatible chat-completions API, India-hosted.
    # reasoning_effort MUST be the literal JSON null (Python None via extra_body;
    # the SDK drops None kwargs but keeps them inside extra_body) — that is the
    # ONLY value that disables the hybrid "thinking". Measured from the Mumbai
    # anchor: sarvam-105b 0.14s / sarvam-30b 0.16s median TTFT with null, vs
    # 6-14s (or content=None) with thinking on. The string "none" is a 400.
    # Same trick as the founder's POC (sales-poc-ai services.py).
    return OpenAILLMService(
        api_key=s.sarvam_api_key,
        base_url=s.sarvam_llm_base_url,
        model=s.sarvam_llm_model,
        params=OpenAILLMService.InputParams(
            temperature=0.35, max_tokens=150,
            extra={"extra_body": {"reasoning_effort": None}},
        ),
    )


def build_tts(sample_rate: int, voice: str | None = None, *, aiohttp_session):
    """`aiohttp_session` is REQUIRED by SarvamTTSService (keyword-only, no
    default) — the FastAPI lifespan owns one shared session (see main.py)."""
    s = get_settings()
    # enable_preprocessing: bulbul normalizes numbers/dates/mixed-script text
    # before synthesis — noticeably cleaner Hinglish (POC voice recipe). Its
    # expressiveness `temperature` knob only exists on pipecat 1.x; port it
    # when the pin is bumped.
    return SarvamTTSService(
        api_key=s.sarvam_api_key,
        model=s.sarvam_tts_model,
        voice_id=voice or s.sarvam_tts_voice,
        sample_rate=sample_rate,
        aiohttp_session=aiohttp_session,
        params=SarvamTTSService.InputParams(pace=s.tts_pace, enable_preprocessing=True),
    )
