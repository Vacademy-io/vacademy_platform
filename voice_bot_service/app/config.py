"""Environment configuration for the Vacademy AI voice-bot service.

The service is STATELESS: no database. Per-call context comes from admin_core's
internal API; the end-of-call report goes back through the public generic
AI-voice webhook. Everything here is env-driven so the same image runs in any
environment.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


@dataclass(frozen=True)
class Settings:
    # Public base URL of THIS service INCLUDING the ingress path prefix — used to
    # build the wss:// URL inside the /answer XML. The service rides the shared
    # cluster host under /voice-bot-service (same pattern as /ai-service), so:
    #   PUBLIC_BASE=https://backend-stage.vacademy.io/voice-bot-service
    public_base: str = field(default_factory=lambda: _env("PUBLIC_BASE").rstrip("/"))

    # admin_core base, e.g. https://backend-stage.vacademy.io
    admin_core_base: str = field(
        default_factory=lambda: _env("ADMIN_CORE_BASE", "https://backend-stage.vacademy.io")
    )
    # Internal client identity (row in admin_core's client_secret_key table).
    internal_client_name: str = field(
        default_factory=lambda: _env("VOICE_BOT_CLIENT_NAME", "voice_bot_service")
    )
    internal_client_secret: str = field(default_factory=lambda: _env("VOICE_BOT_CLIENT_SECRET"))

    # Sarvam (STT + LLM + TTS) — see providers.py
    sarvam_api_key: str = field(default_factory=lambda: _env("SARVAM_API_KEY"))
    sarvam_stt_model: str = field(default_factory=lambda: _env("SARVAM_STT_MODEL", "saaras:v3"))
    sarvam_llm_model: str = field(default_factory=lambda: _env("SARVAM_LLM_MODEL", "sarvam-105b"))
    sarvam_llm_base_url: str = field(
        default_factory=lambda: _env("SARVAM_LLM_BASE_URL", "https://api.sarvam.ai/v1")
    )
    sarvam_tts_model: str = field(default_factory=lambda: _env("SARVAM_TTS_MODEL", "bulbul:v3"))
    sarvam_tts_voice: str = field(default_factory=lambda: _env("SARVAM_TTS_VOICE", "priya"))

    # LLM provider switch: "sarvam" (default) or "openrouter" fallback. The switch
    # governs BOTH the live conversation (providers.build_llm) and the end-of-call
    # analysis (report._llm_target) — they must never diverge.
    llm_provider: str = field(default_factory=lambda: _env("LLM_PROVIDER", "sarvam"))
    openrouter_api_key: str = field(default_factory=lambda: _env("OPENROUTER_API_KEY"))
    openrouter_base_url: str = field(
        default_factory=lambda: _env("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
    )
    openrouter_model: str = field(
        default_factory=lambda: _env("OPENROUTER_MODEL", "google/gemini-3.1-flash-lite")
    )

    # Telephony audio is 8 kHz mu-law on Plivo <Stream>.
    sample_rate: int = 8000

    # Idle handling: nudge once after this silence, then hang up on continued
    # silence. The clock only runs while the BOT is not speaking (see bot.py).
    idle_timeout_secs: float = 7.0

    # Hard per-call ceiling when the agent config doesn't set maxCallMinutes —
    # bounds telephony + STT/LLM/TTS spend on a runaway conversation.
    max_call_minutes_default: float = 10.0

    def wss_url(self, query: str) -> str:
        base = self.public_base.replace("https://", "wss://").replace("http://", "ws://")
        return f"{base}/ws?{query}"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
