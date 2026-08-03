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
    # Sarvam-side fast endpointing: server endpointing (~0.65-0.76s from end of speech)
    # is the measured binding constraint on reply latency — high VAD sensitivity asks
    # Sarvam to finalize sooner. Env-off if it starts clipping slow speakers.
    sarvam_stt_high_vad: bool = field(
        default_factory=lambda: _env("SARVAM_STT_HIGH_VAD", "true").lower() == "true")
    sarvam_tts_model: str = field(default_factory=lambda: _env("SARVAM_TTS_MODEL", "bulbul:v3"))
    sarvam_tts_voice: str = field(default_factory=lambda: _env("SARVAM_TTS_VOICE", "priya"))
    # Server-side chars Sarvam buffers before synthesizing the first audio (default 50).
    # DEFAULT 0 = DON'T SEND (server default 50): at 30 the smaller chunks produced
    # audible SEAMS — callers reported 'network-like' breaking on some sentences
    # (2026-07-20). And 20 is outright REJECTED by Sarvam's config validation, which
    # killed TTS on every call (silent-call outage same day; probe: 20 rejected,
    # 30/50 accepted). providers.build_tts clamps any override to >= 30. Smoothness
    # beats the ~0.1s first-audio win — leave at 0 unless re-testing deliberately.
    sarvam_tts_min_buffer: int = field(
        default_factory=lambda: int(_env("SARVAM_TTS_MIN_BUFFER", "0")))

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
    # gemini-2.5-flash-lite is NOT served in asia-south1 (404 verified 2026-07-14) — only
    # gemini-2.5-flash is. Default to what the target region actually has; override per region.
    vertex_model: str = field(
        default_factory=lambda: _env("VERTEX_MODEL", "gemini-2.5-flash")
    )

    # Telephony audio is 8 kHz mu-law on Plivo <Stream>.
    sample_rate: int = 8000

    # Turn-taking latency knobs (pipecat defaults: 0.8 / 0.5 — a full 1.3s of
    # dead air before the LLM even starts). vad_stop_secs = silence needed to
    # decide the caller finished; too low clips slow speakers mid-sentence.
    # agg_timeout_secs = extra wait for a late-arriving final transcript.
    vad_stop_secs: float = field(default_factory=lambda: float(_env("VAD_STOP_SECS", "0.5")))
    # Measured on live calls (48h, 141 turns): Sarvam's STT final trails local VAD stop in
    # 85% of turns, so this timeout is PURE additive delay on top of an already-final
    # transcript. 0.08 keeps a small merge window for split finals; saves ~0.12s/turn.
    agg_timeout_secs: float = field(default_factory=lambda: float(_env("AGG_TIMEOUT_SECS", "0.08")))

    # Bulbul speaking pace: 1.0 = native. Founder feedback on the live calls:
    # 0.95 sounded noticeably slow on the phone; 1.1 is brisk but natural.
    tts_pace: float = field(default_factory=lambda: float(_env("TTS_PACE", "1.1")))

    # Filler acknowledgment ("Hmm…", "Achha…") spoken the moment the caller's
    # words are transcribed, masking the LLM+TTS gap — the pipeline's hard floor
    # is ~1.5s (0.5 VAD + 0.36 STT final + 0.8 Gemini TTFT) and this cuts the
    # PERCEIVED dead air to ~1s, which is what human agents do. Probability 0
    # disables; phrases are comma-separated and spoken verbatim.
    # 0.25 (was 0.7): with Gemini's ~0.5s TTFT the filler often COLLIDES with the
    # real reply, and on live calls a reply-shaped filler ('Okay…') played right
    # before an interrupted response read as the bot answering then going silent.
    # 0.10 (was 0.25): live feedback — still "too much Hmm-ing". The filler is
    # only a latency mask; with Gemini at ~0.5s TTFT it is rarely needed.
    filler_probability: float = field(
        default_factory=lambda: float(_env("FILLER_PROBABILITY", "0.10"))
    )
    # 'Hmm…' only: clearly a thinking sound. 'Achha…'/'Ji…'/'Okay…' sound like
    # complete replies, which made stalls read as answers.
    filler_phrases: tuple = field(
        default_factory=lambda: tuple(
            p.strip() for p in _env("FILLER_PHRASES", "Hmm…").split(",") if p.strip()
        )
    )

    # Call-open pacing: on OUTBOUND the callee already said "hello" on pickup, so the
    # bot SPEAKS FIRST after this short beat — long enough not to clip their "hello",
    # short enough to avoid dead air / the "double hello". Was 2.0s (the main cause of
    # the robotic-feeling start); ~0.8s is the production sweet spot (Vapi/Retell fire
    # the greeting ~0.3-0.8s after the human is on the line). If they say something
    # substantive in this window, their turn drives the reply and the bot doesn't open.
    greet_delay_secs: float = field(default_factory=lambda: float(_env("GREET_DELAY_SECS", "0.8")))

    # Idle handling: nudge once after this silence, then hang up on continued
    # silence. The clock only runs while the BOT is not speaking AND the caller is not
    # mid-utterance (VAD-armed — see bot.py). 10s: at 7s the nudge kept firing while a
    # slow-thinking caller was composing an answer (observed live).
    idle_timeout_secs: float = field(default_factory=lambda: float(_env("IDLE_TIMEOUT_SECS", "8.0")))
    # Audio-stall auto-recovery: ON (Wave 2 Stage E). The v1 false-fire (stale
    # pending-stamp → agents repeated 3x) is fixed — stamps arm only while the
    # bot is quiet and clear on BOTH speaking transitions — and the mechanism is
    # covered by the timeline harness (multi-clause replies produce ZERO stall
    # decisions; true stalls recover once, capped at 3). TTS connect/disconnect
    # is now lock-serialized so the forced reconnect can't race the pipeline's
    # own reconnects. Env kill-switch retained.
    stall_recovery_enabled: bool = field(
        default_factory=lambda: _env("STALL_RECOVERY_ENABLED", "true").lower() == "true")

    # ── Watchdog thresholds ──────────────────────────────────────────────────
    # Every WatchdogConfig field is env-overridable. These ran on dataclass
    # defaults with NO knob, so tuning turn-taking on a service calling real
    # parents required a rebuild + redeploy. Defaults below are byte-identical to
    # the dataclass defaults, so plumbing them changed no behaviour.
    stall_after_secs: float = field(
        default_factory=lambda: float(_env("STALL_AFTER_SECS", "3.5")))
    stall_max_recoveries: int = field(
        default_factory=lambda: int(_env("STALL_MAX_RECOVERIES", "3")))
    stop_reissue_every_secs: float = field(
        default_factory=lambda: float(_env("STOP_REISSUE_EVERY_SECS", "3.0")))
    orphan_min_utterance_secs: float = field(
        default_factory=lambda: float(_env("ORPHAN_MIN_UTTERANCE_SECS", "0.4")))
    orphan_window_lo_secs: float = field(
        default_factory=lambda: float(_env("ORPHAN_WINDOW_LO_SECS", "2.5")))
    orphan_window_hi_secs: float = field(
        default_factory=lambda: float(_env("ORPHAN_WINDOW_HI_SECS", "10.0")))
    orphan_bot_quiet_secs: float = field(
        default_factory=lambda: float(_env("ORPHAN_BOT_QUIET_SECS", "2.0")))
    orphan_connect_grace_secs: float = field(
        default_factory=lambda: float(_env("ORPHAN_CONNECT_GRACE_SECS", "6.0")))
    # Clock-skew guard: Sarvam's server-side final vs pipecat's local Silero
    # onset. 0.0 restores the old (broken) strict comparison — kill-switch only.
    orphan_transcript_lookback_secs: float = field(
        default_factory=lambda: float(_env("ORPHAN_TRANSCRIPT_LOOKBACK_SECS", "1.5")))
    max_nudges: int = field(default_factory=lambda: int(_env("MAX_NUDGES", "2")))
    no_words_timeout_secs: float = field(
        default_factory=lambda: float(_env("NO_WORDS_TIMEOUT_SECS", "30.0")))

    # Refuse to derive a substantive disposition from a call with no caller turn
    # (voicemail/IVR pickups were booking demos onto real leads). Kill-switch.
    report_require_conversation: bool = field(
        default_factory=lambda: _env("REPORT_REQUIRE_CONVERSATION", "true").lower() == "true")

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

    # /tts and /preview are PUBLIC endpoints (Plivo has to fetch them) that write
    # synthesized audio to disk — unbounded, an attacker filling the volume kills
    # deploys on this box (observed failure mode: disk-full → silent stale-image
    # deploys). Oldest-mtime .mp3 files are evicted past either bound.
    tts_cache_max_files: int = field(
        default_factory=lambda: int(_env("TTS_CACHE_MAX_FILES", "4000")))
    tts_cache_max_bytes: int = field(
        default_factory=lambda: int(_env("TTS_CACHE_MAX_BYTES", str(500 * 1024 * 1024))))

    # Failed end-of-call reports spool here and a background sweeper retries them.
    # Lives UNDER the tts-cache dir on purpose: that's the one mounted volume, so
    # spooled reports survive container restarts. A lost report strands the paused
    # CALL_AI workflow until its safety timeout and lies to the retry engine.
    @property
    def report_spool_dir(self) -> str:
        return os.path.join(self.tts_cache_dir, "_report_spool")

    def wss_url(self, query: str) -> str:
        base = self.public_base.replace("https://", "wss://").replace("http://", "ws://")
        return f"{base}/ws?{query}"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
