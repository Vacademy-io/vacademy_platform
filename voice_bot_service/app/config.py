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
    # saarika:v2.5 TRANSCRIBES speech in the language actually spoken (Devanagari for
    # Hindi), so the LLM gets the caller's real words. saaras:v3 is a speech-TRANSLATION
    # model (Indian speech → English) — on code-switched Hinglish it garbles into
    # gibberish ("Myapolicil tme we face"), which the LLM then can't understand, so it
    # deflects/loops. Transcription, not translation, is what a native-language voice bot
    # needs. Overridable via SARVAM_STT_MODEL to roll back or try another model.
    sarvam_stt_model: str = field(default_factory=lambda: _env("SARVAM_STT_MODEL", "saarika:v2.5"))
    # Pin STT to one language instead of auto-detect. Default "hi-IN": auto-detect
    # drifts a Hindi/Hinglish caller into a NEIGHBOURING Indic language — Punjabi or
    # Marathi (Marathi shares Devanagari, Punjabi is phonetically close) — and once one
    # turn is transcribed as Punjabi/Marathi the "speak the caller's language and stay
    # in it" rule makes the LLM reply, and the TTS speak, that language for the rest of
    # the call. Pinning hi-IN still transcribes the English words in a Hinglish sentence
    # (saarika is code-mixed aware) but never leaves Hindi. Set "" for auto-detect or
    # another BCP-47 tag (e.g. "en-IN") for an English-first agent. Read in build_stt.
    sarvam_stt_language: str = field(default_factory=lambda: _env("SARVAM_STT_LANGUAGE", "hi-IN"))
    sarvam_llm_model: str = field(default_factory=lambda: _env("SARVAM_LLM_MODEL", "sarvam-105b"))
    sarvam_llm_base_url: str = field(
        default_factory=lambda: _env("SARVAM_LLM_BASE_URL", "https://api.sarvam.ai/v1")
    )
    sarvam_tts_model: str = field(default_factory=lambda: _env("SARVAM_TTS_MODEL", "bulbul:v3"))
    sarvam_tts_voice: str = field(default_factory=lambda: _env("SARVAM_TTS_VOICE", "priya"))

    # LLM provider switch: "sarvam" (default) | "vertex" | "google" | "openrouter". Governs
    # BOTH the live conversation (providers.build_llm) and the end-of-call
    # analysis (report._llm_target) — they must never diverge.
    # sarvam = India-hosted sarvam-105b with reasoning_effort=null (the literal
    # JSON null via extra_body — the ONLY value that disables its hybrid
    # "thinking"): 0.14s median TTFT from the Mumbai anchor, ~5x faster than
    # Gemini's 0.75-0.85s. With thinking ON it is unusable live (6-14s, or
    # content=None when max_tokens dies mid-think) — never drop the null.
    # google = Gemini's OpenAI-compat endpoint hit directly (no proxy hop);
    # openrouter = proxy fallback (routing lottery spiked TTFT to 7.9s once).
    llm_provider: str = field(default_factory=lambda: _env("LLM_PROVIDER", "sarvam"))
    openrouter_api_key: str = field(default_factory=lambda: _env("OPENROUTER_API_KEY"))
    openrouter_base_url: str = field(
        default_factory=lambda: _env("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
    )
    openrouter_model: str = field(
        default_factory=lambda: _env("OPENROUTER_MODEL", "google/gemini-3.1-flash-lite")
    )
    gemini_api_key: str = field(default_factory=lambda: _env("GEMINI_API_KEY"))
    google_llm_base_url: str = field(
        default_factory=lambda: _env(
            "GOOGLE_LLM_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai"
        )
    )
    google_llm_model: str = field(
        default_factory=lambda: _env("GOOGLE_LLM_MODEL", "gemini-3.1-flash-lite")
    )

    # Vertex AI (Gemini) served from an IN-INDIA region — LLM_PROVIDER="vertex".
    # Unlike the "google" path (generativelanguage.googleapis.com, US/global, ~5x
    # the TTFT from Mumbai), Vertex runs the model in vertex_location, so pinning
    # asia-south1 (Mumbai) gives ~0.37s TTFT + near-zero network RTT AND better
    # instruction-following than sarvam-105b. Auth is a Google SERVICE ACCOUNT
    # (JSON), not an API key: set VERTEX_CREDENTIALS_JSON (the full SA JSON string)
    # or VERTEX_CREDENTIALS_PATH (path to the file), plus VERTEX_PROJECT_ID. The SA
    # needs role roles/aiplatform.user and the Vertex AI API enabled in the project.
    # Gemini "thinking" is auto-disabled by pipecat (thinking_budget=0) → fast path.
    vertex_project_id: str = field(default_factory=lambda: _env("VERTEX_PROJECT_ID", ""))
    vertex_location: str = field(default_factory=lambda: _env("VERTEX_LOCATION", "asia-south1"))
    vertex_credentials_json: str = field(
        default_factory=lambda: _env("VERTEX_CREDENTIALS_JSON", "")
    )
    vertex_credentials_path: str = field(
        default_factory=lambda: _env("VERTEX_CREDENTIALS_PATH", "")
    )
    vertex_model: str = field(
        default_factory=lambda: _env("VERTEX_MODEL", "gemini-2.5-flash-lite")
    )

    # Telephony audio is 8 kHz mu-law on Plivo <Stream>.
    sample_rate: int = 8000

    # Turn-taking latency knobs (pipecat defaults: 0.8 / 0.5 — a full 1.3s of
    # dead air before the LLM even starts). vad_stop_secs = silence needed to
    # decide the caller finished; too low clips slow speakers mid-sentence.
    # agg_timeout_secs = extra wait for a late-arriving final transcript.
    vad_stop_secs: float = field(default_factory=lambda: float(_env("VAD_STOP_SECS", "0.5")))
    agg_timeout_secs: float = field(default_factory=lambda: float(_env("AGG_TIMEOUT_SECS", "0.2")))

    # Bulbul speaking pace: 1.0 = native. Founder feedback on the live calls:
    # 0.95 sounded noticeably slow on the phone; 1.1 is brisk but natural.
    tts_pace: float = field(default_factory=lambda: float(_env("TTS_PACE", "1.1")))

    # Filler acknowledgment ("Hmm…", "Achha…") spoken the moment the caller's
    # words are transcribed, masking the LLM+TTS gap — the pipeline's hard floor
    # is ~1.5s (0.5 VAD + 0.36 STT final + 0.8 Gemini TTFT) and this cuts the
    # PERCEIVED dead air to ~1s, which is what human agents do. Probability 0
    # disables; phrases are comma-separated and spoken verbatim.
    filler_probability: float = field(
        default_factory=lambda: float(_env("FILLER_PROBABILITY", "0.7"))
    )
    filler_phrases: tuple = field(
        default_factory=lambda: tuple(
            p.strip() for p in _env("FILLER_PHRASES", "Hmm…,Achha…,Ji…").split(",") if p.strip()
        )
    )

    # Call-open pacing: a real caller doesn't blast audio the instant the line
    # opens. On connect the bot waits up to this long for the callee to answer /
    # say "hello" (if they speak first, the normal turn greets them back so the
    # bot never talks over them); on continued silence, the bot opens itself.
    greet_delay_secs: float = field(default_factory=lambda: float(_env("GREET_DELAY_SECS", "2.0")))

    # Idle handling: nudge once after this silence, then hang up on continued
    # silence. The clock only runs while the BOT is not speaking (see bot.py).
    idle_timeout_secs: float = 7.0

    # Hard per-call ceiling when the agent config doesn't set maxCallMinutes —
    # bounds telephony + STT/LLM/TTS spend on a runaway conversation.
    max_call_minutes_default: float = 10.0

    # Max simultaneous live calls this bot process will run. Each call pins a
    # Silero VAD session + STT/LLM/TTS streams + a watchdog loop; past the box's
    # CPU ceiling ALL calls degrade (garbled audio, late turns) instead of new
    # ones being rejected. Over cap, /answer serves a "busy" hangup (no <Stream>)
    # and /ws closes immediately. Size to the box: ~10 for a 1 vCPU / 2 GB node.
    max_concurrent_calls: int = field(
        default_factory=lambda: int(_env("MAX_CONCURRENT_CALLS", "10"))
    )

    # Where /tts caches synthesized IVR-prompt audio. Backed by a Docker volume so
    # a prompt is synthesized ONCE (ever) and replayed free on every call — IVR
    # prompts are static, so there is no recurring TTS cost.
    tts_cache_dir: str = field(default_factory=lambda: _env("TTS_CACHE_DIR", "/tmp/tts-cache"))

    # IVR-prompt MP3 sample rate. MUST be 44100 (or 48000): at those rates Sarvam
    # emits MPEG-1 layer III, the ONLY MP3 profile Plivo's decoder plays. 8 kHz
    # forces MPEG-2.5, which Plivo renders as SILENCE (verified against Plivo's
    # published spec: "MPEG v1, 128 kbps, 44.1 kHz"). Distinct from sample_rate,
    # which is the 8 kHz telephony rate for the live-call audio stream.
    tts_prompt_sample_rate: int = field(
        default_factory=lambda: int(_env("TTS_PROMPT_SAMPLE_RATE", "44100"))
    )

    def wss_url(self, query: str) -> str:
        base = self.public_base.replace("https://", "wss://").replace("http://", "ws://")
        return f"{base}/ws?{query}"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
