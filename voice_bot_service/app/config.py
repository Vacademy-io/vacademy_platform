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
    # STT model. saaras:v4 (chosen 2026-08-03) is a speech-to-text-TRANSLATE model:
    # it AUTO-DETECTS the spoken language and returns ENGLISH. saarika:v2.5, the
    # previous default, transcribes in the language actually spoken.
    #
    # Why the switch: pinned to hi-IN, saarika transliterated ENGLISH callers into
    # Devanagari ("इफ यू रिकॉर्ड योर नेम..." for "if you record your name"), and on
    # 2026-08-03 it went deaf on a live call — the caller said "hybrid model" four
    # times and saarika returned ZERO finals for it (one final in a 50s window,
    # first final of the call took 6.08s to process, 4 socket reconnects).
    #
    # KNOWN RISK, recorded honestly: an OLDER saaras (v3) was abandoned precisely
    # because it garbled code-switched Hinglish into gibberish ("Myapolicil tme we
    # face"), which the LLM then could not act on. v4 is two versions on, but if
    # Hinglish garbling returns, roll back with SARVAM_STT_MODEL=saarika:v2.5 —
    # no deploy needed.
    #
    # SIDE EFFECTS of a translate model, both real:
    #  * SARVAM_STT_LANGUAGE and any per-agent language pin become INERT (pipecat
    #    raises if a language is passed to saaras — build_stt drops it).
    #  * A Hindi caller now reaches the LLM as ENGLISH text, so the prompt's
    #    "speak the caller's language" rule can no longer infer their language
    #    from the transcript. Watch Hindi-first agents.
    #  * The name bias (`prompt`) only works on saaras, so it now ENGAGES — the
    #    agent's own name should stop coming back as "Aayushi"/"Aarush".
    # ── STT provider A/B (pipecat 1.4 migration, founder-approved 2026-08-05) ──
    # "sarvam" (default) | "google". Google = streaming v2 on the SAME GCP
    # project/credentials as the Vertex LLM; it sends INTERIM results (Sarvam
    # never does), which Smart Turn and the turn-gate both benefit from. Flip
    # per test call via env; nothing else changes.
    stt_provider: str = field(default_factory=lambda: _env("STT_PROVIDER", "sarvam"))
    google_stt_language: str = field(
        default_factory=lambda: _env("GOOGLE_STT_LANGUAGE", "hi-IN"))
    # "telephony", NOT "latest_long": measured on the caller channel of real call
    # 31a1acf1 (8 kHz Hindi phone audio), latest_long dropped most of every
    # utterance ("क्या बात कर रहा है?" for a 15-word sentence) while telephony
    # transcribed it nearly in full. Shipping latest_long would have rigged the
    # A/B against Google. chirp_2 is comparable but only serves from
    # us-central1 — a cross-ocean hop per turn from Mumbai, so not for live calls.
    google_stt_model: str = field(
        default_factory=lambda: _env("GOOGLE_STT_MODEL", "telephony"))
    google_stt_location: str = field(
        default_factory=lambda: _env("GOOGLE_STT_LOCATION", "global"))
    # How long the 1.4 turn-stop strategy may hold a turn waiting for Sarvam's
    # final (Sarvam never flags finalized=True). pipecat default 1.17 = ~1s of
    # added dead air EVERY turn; the founder POC ships 0.5.
    sarvam_ttfs_p99: float = field(
        default_factory=lambda: float(_env("SARVAM_TTFS_P99", "0.5")))
    # Smart Turn v3 semantic end-of-turn: max silence it may wait before forcing
    # the turn closed (the model usually decides much earlier).
    smart_turn_stop_secs: float = field(
        default_factory=lambda: float(_env("SMART_TURN_STOP_SECS", "1.5")))

    sarvam_stt_model: str = field(default_factory=lambda: _env("SARVAM_STT_MODEL", "saaras:v4"))
    # Pin STT to one language instead of auto-detect. Default "hi-IN": auto-detect
    # drifts a Hindi/Hinglish caller into a NEIGHBOURING Indic language — Punjabi or
    # Marathi (Marathi shares Devanagari, Punjabi is phonetically close) — and once one
    # turn is transcribed as Punjabi/Marathi the "speak the caller's language and stay
    # in it" rule makes the LLM reply, and the TTS speak, that language for the rest of
    # the call. Pinning hi-IN still transcribes the English words in a Hinglish sentence
    # (saarika is code-mixed aware) but never leaves Hindi. Set "" for auto-detect or
    # another BCP-47 tag (e.g. "en-IN") for an English-first agent. Read in build_stt.
    # saaras mode: transcribe | translate | verbatim | translit | codemix.
    # Only meaningful on saaras:v3/v4. "codemix" is the right default for
    # Hinglish agents — it keeps the caller's code-switched words instead of
    # forcing them into one script (saarika's hi-IN pin turned English callers
    # into Devanagari) or into English (translate mode).
    sarvam_stt_mode: str = field(default_factory=lambda: _env("SARVAM_STT_MODE", "transcribe"))
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
    # ── TTS provider ────────────────────────────────────────────────────────
    # Per-agent selectable; this is the fallback when an agent has no preference.
    # "rumik" = Rumik Silk mulberry 1.5 (Rs 0.50/1k chars). "sarvam" = bulbul:v3
    # (Rs 3.00/1k) — 6x dearer and priced to the customer accordingly.
    # FALLBACK when an agent has no tts_model of its own — deliberately "sarvam",
    # even though Rumik is the default for NEW agents. Absence of config means an
    # agent predates the picker, and those institutes are billed at the Sarvam
    # rate and have approved a Sarvam voice; moving them by omission would change
    # both what they hear and what they pay. New agents get "rumik" stamped
    # EXPLICITLY by admin_core, so the default never has to carry that decision.
    tts_model: str = field(default_factory=lambda: _env("TTS_MODEL", "sarvam"))
    rumik_api_key: str = field(default_factory=lambda: _env("RUMIK_API_KEY"))
    # ── Google Cloud TTS (3rd engine, added 2026-08-05) ─────────────────────
    # Founder picked Chirp3-HD by ear over Sarvam, Rumik and Google's other
    # tiers. Economics measured from OUR OWN calls (779 chars per call-minute,
    # 13 prod calls): Chirp3-HD $30/1M chars = Rs 2.06/call-min vs Sarvam's
    # Rs 2.34 — CHEAPER than what we ship today, plus 1M chars/month free
    # (~1,280 call-minutes). Neural2/WaveNet ($16/1M = Rs 1.10) are the
    # fallback tiers if Chirp3-HD ever bites at scale.
    # Auth reuses the Vertex service account (VERTEX_CREDENTIALS_*) — no new
    # vendor, no new secret.
    google_tts_voice: str = field(
        default_factory=lambda: _env("GOOGLE_TTS_VOICE", "hi-IN-Chirp3-HD-Achird"))
    google_tts_language: str = field(
        default_factory=lambda: _env("GOOGLE_TTS_LANGUAGE", "hi-IN"))
    # 1.0 = native. Chirp3-HD is already brisk; 1.05 matches our Sarvam pace 1.1
    # without clipping consonants.
    google_tts_speaking_rate: float = field(
        default_factory=lambda: float(_env("GOOGLE_TTS_SPEAKING_RATE", "1.05")))
    # Chirp3-HD streams 24 kHz; the output transport resamples to the 8 kHz leg.
    google_tts_sample_rate: int = field(
        default_factory=lambda: int(_env("GOOGLE_TTS_SAMPLE_RATE", "24000")))

    # ── Smallest.ai Lightning (4th engine, added 2026-08-05) ────────────────
    # Indian-language specialist; 146 of its 234 lightning_v3.1 voices are
    # Hindi-capable. Key is env-only (NEVER in code): the one pasted in chat on
    # 2026-08-05 must be treated as compromised and rotated.
    smallest_api_key: str = field(default_factory=lambda: _env("SMALLEST_API_KEY"))
    # lightning_v3.1 | lightning_v3.1_pro. NOTE the palettes DIFFER per model —
    # the API rejects a cross-model voice outright ("Voice 'devansh' is not
    # available on the lightning_v3.1_pro model"), which means a mute call.
    smallest_model: str = field(
        default_factory=lambda: _env("SMALLEST_MODEL", "lightning_v3.1"))
    smallest_voice: str = field(
        default_factory=lambda: _env("SMALLEST_VOICE", "devansh"))
    # Lightning emits 24 kHz; transport resamples to 8 kHz for Plivo.
    smallest_sample_rate: int = field(
        default_factory=lambda: int(_env("SMALLEST_SAMPLE_RATE", "24000")))
    rumik_voice: str = field(default_factory=lambda: _env("RUMIK_VOICE", "ira"))

    # ── Deepgram Aura-2 ─────────────────────────────────────────────────────
    # ENGLISH-ONLY. Verified against the live /v1/models catalog on 2026-08-13:
    # 102 TTS models spanning en/es/de/fr/nl/it/ja and NO Hindi — not shipped,
    # not announced. So this engine is for English-speaking agents only; a
    # Hinglish agent (Shreya, Ameet) must never be pointed at it or the caller
    # hears Devanagari read as English letters.
    # Native pipecat WebsocketTTSService, so barge-in cancel comes for free.
    # Key is env-only (NEVER in code) — the one pasted in chat on 2026-08-13
    # must be treated as compromised and rotated, same as the Smallest key above.
    deepgram_api_key: str = field(default_factory=lambda: _env("DEEPGRAM_API_KEY"))
    deepgram_tts_voice: str = field(
        default_factory=lambda: _env("DEEPGRAM_TTS_VOICE", "aura-2-asteria-en"))
    # Aura-2 emits 24 kHz linear16; the transport resamples to 8 kHz for Plivo.
    deepgram_tts_sample_rate: int = field(
        default_factory=lambda: int(_env("DEEPGRAM_TTS_SAMPLE_RATE", "24000")))

    # Deterministic Devanagari→Latin term fixes applied to text entering Rumik.
    # Rumik reads Devanagari-transliterated English as gibberish ("लाइव क्लासेस"
    # spoken as "लव असेस" — founder calls 8e1e00ad + ae7d3069). A prompt rule
    # failed TWICE to stop the LLM transliterating (11k-char authored prompts
    # win over rules), so the fix is a replacement at the synthesis boundary —
    # deterministic, testable, and invisible to transcripts/context (which keep
    # the written form). Longest-first; extend via env: "देवनागरी=Latin;…".
    rumik_term_map: tuple = field(default_factory=lambda: tuple(sorted(
        ((p.split("=", 1)[0].strip(), p.split("=", 1)[1].strip())
         for p in _env(
             "RUMIK_TERM_MAP",
             "लाइव क्लासेस=Live Classes;लाइव क्लास=Live Class;क्लासेस=classes;"
             "क्लास=class;लाइव=Live;असेसमेंट=assessment;व्हाट्सएप=WhatsApp;"
             "कॉन्सेप्ट्स=concepts;कॉन्सेप्ट=concept;सिलेबस=syllabus;"
             "डेमो=demo;ऑनलाइन=online;बैच=batch;इम्प्रूवमेंट=Improvement;"
             "प्रोग्राम=Program").split(";")
         if "=" in p and p.split("=", 1)[0].strip()),
        key=lambda kv: -len(kv[0]))))

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

    # ── How far ahead of real time we may push audio into Plivo ─────────────
    # THE root cause of "after I speak, it takes ages for the bot to stop"
    # (founder, three separate calls). pipecat's websocket transport sends each
    # chunk at TWICE real time (_send_interval = chunk_duration / 2), so Plivo
    # accumulates unplayed audio equal to ~half the reply — up to 10s on a 20s
    # pitch. Our barge-in duck can only hold what has NOT been sent yet, so on
    # live call d6e82def the interrupt logged "dropping 0 held frame(s)": the
    # whole reply was already inside Plivo and kept playing regardless.
    #
    # This caps the lead instead: burst until there is this much cushion, then
    # track real time. Plivo then holds ~this much, so ducking silences the line
    # within it, and BotStoppedSpeaking stops firing half a reply early (which
    # was also skewing every dead-air and idle measurement).
    # 0 disables the patch and restores pipecat's 2x behaviour.
    audio_max_lead_secs: float = field(
        default_factory=lambda: float(_env("AUDIO_MAX_LEAD_SECS", "0.3")))

    # Turn-taking latency knobs (pipecat defaults: 0.8 / 0.5 — a full 1.3s of
    # dead air before the LLM even starts). vad_stop_secs = silence needed to
    # decide the caller finished; too low clips slow speakers mid-sentence.
    # agg_timeout_secs = extra wait for a late-arriving final transcript.
    # 0.2 on pipecat 1.4 (was 0.5): end-of-turn is Smart Turn v3's job now — the
    # VAD stop only feeds the turn analyzer, and a long window here just delays
    # it. POC ships 0.15; 0.2 is one notch safer on noisy phone lines.
    # ⚠ REMOVE any VAD_STOP_SECS=0.5 override from box/k8s env on deploy.
    vad_stop_secs: float = field(default_factory=lambda: float(_env("VAD_STOP_SECS", "0.2")))
    # Silero gates on RMS volume BEFORE the model runs, default 0.6 — tuned for
    # headset/webrtc audio. On the founder's 2026-08-05 call (8e1e00ad) that gate
    # never passed for the CALLER's own voice (the loud call-screening robot DID
    # pass): zero VAD onsets during bot speech → the duck never engaged, the bot
    # talked through every interruption, and pipecat's emulated-VAD path deleted
    # the caller's words. 8 kHz telephony speech is simply quieter than 0.6.
    vad_min_volume: float = field(
        default_factory=lambda: float(_env("VAD_MIN_VOLUME", "0.35")))
    vad_confidence: float = field(
        default_factory=lambda: float(_env("VAD_CONFIDENCE", "0.6")))
    vad_start_secs: float = field(
        default_factory=lambda: float(_env("VAD_START_SECS", "0.2")))
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

    # ── Barge-in ducking (founder decision 2026-08-05: "absorb but never lose")
    # When the caller starts speaking over a reply, DuckGate holds the bot's
    # audio ~instantly instead of talking over them for the 2.5-4s the old
    # min-words strategy needed (caller utterance + VAD stop + STT final).
    # A backchannel ("haan", "theek hai") resumes the reply and is appended to
    # the LLM context without a generation; anything else commits a real
    # interruption. false = exact pre-duck behavior (rollback, no deploy).
    # Interrupt the bot the moment the caller's voice is detected, instead of
    # waiting for their words to be transcribed. MEASURED: with this off, the
    # bot kept talking 1.96s after the caller started (probe) because the reply
    # had already flowed past our duck into pipecat's output queue and Plivo's
    # buffer, and only a flush clears those. Cost: a cancelled reply cannot be
    # resumed, so a backchannel makes the bot pick up its sentence via a
    # regeneration cue (see TranscriptCollector). false = the duck-only
    # behaviour, if over-eager stopping on noisy lines ever outweighs this.
    # How long after a cancelled reply a bare acknowledgment still means "carry
    # on with what you were saying" rather than a new turn to answer.
    backchannel_carry_secs: float = field(
        default_factory=lambda: float(_env("BACKCHANNEL_CARRY_SECS", "3.0")))
    # How long into a call an operator/voicemail recording is still plausible.
    # Machine greetings run 10-20s (call 14029bd6's ran 10.4s), and after that a
    # phrase match is far more likely to be the caller than the network.
    machine_greeting_window_secs: float = field(
        default_factory=lambda: float(_env("MACHINE_GREETING_WINDOW_SECS", "22.0")))
    # Ceiling on how long a reply counts as "in flight" before its audio
    # starts. Covers LLM TTFB + TTS TTFB with headroom; capped so a generation
    # that dies pre-playout cannot swallow the caller's turns.
    # Gemini "thinking" tokens before the first reply token. 0 = off, which is
    # what a phone agent wants: measured 2.43s -> 0.51s TTFB on the Mumbai box.
    # Raise ONLY if a future agent genuinely needs reasoning, and re-measure.
    # Suppress a sentence the bot has already said in this call. Off = the old
    # behaviour, in case a deployment ever needs it back in a hurry.
    # Give an AUTHORED prompt the built-in safety rules too (`non_negotiable`).
    #
    # build_system_prompt branches at 600 characters: shorter prompts get the
    # seven rules, longer ones get none of them. 600 characters is about four
    # sentences, so every real agent takes the second branch — production prompts
    # measured 2026-08-14 were 2956, 3359, 3489, 5152 and 10078 characters. The
    # rules therefore reach only the built-in placeholder persona and never an
    # agent running real calls, even though each was added after a specific
    # live-call failure (frustration -> drop the script; conversation stops making
    # sense -> assume you mis-heard; a repeated question means your answer failed).
    #
    # OFF BY DEFAULT so this deploys as a no-op: every existing agent's prompt is
    # byte-identical until someone turns it on. Enable per deployment, watch
    # HANDBACK_LOOP and REPLY_LOOP, and be aware the prompt grows ~1.5k characters
    # — saturation is a known risk here (NoRepeatGate: four prompt-level fixes
    # failed at ~16k). A per-agent switch belongs in the agent editor later; this
    # is the env-level precursor.
    safety_rules_for_authored: bool = field(
        default_factory=lambda: _env("SAFETY_RULES_FOR_AUTHORED", "false").lower() == "true")
    no_repeat_enabled: bool = field(
        default_factory=lambda: _env("NO_REPEAT_ENABLED", "true").lower() == "true")
    # Drop the leading clause when a reply only parrots the caller's own answer
    # back ("ओके, सुबोध अभी आठवीं क्लास में है, तो …") — founder 2026-08-12, "there
    # is no need to reconfirm every time, it looks like an AI". Same reason this
    # is code and not a prompt rule as NO_REPEAT_ENABLED; same kill switch shape.
    no_echo_enabled: bool = field(
        default_factory=lambda: _env("NO_ECHO_ENABLED", "true").lower() == "true")
    # Block LLM generations that have nothing new to answer (last context
    # message not a fresh user message). Kills the reply-to-nothing class that
    # re-delivered the intro on calls 17be14f2/761decff — see bot.RunGuard.
    run_guard_enabled: bool = field(
        default_factory=lambda: _env("RUN_GUARD_ENABLED", "true").lower() == "true")
    # Edge read-aloud default voice. hi-IN-SwaraNeural (F) / hi-IN-MadhurNeural (M)
    # are the only Hindi ones; the en-IN trio is Neerja, NeerjaExpressive, Prabhat.
    edge_tts_voice: str = field(
        default_factory=lambda: _env("EDGE_TTS_VOICE", "hi-IN-SwaraNeural"))
    vertex_thinking_budget: int = field(
        default_factory=lambda: int(_env("VERTEX_THINKING_BUDGET", "0")))
    reply_inflight_grace_secs: float = field(
        default_factory=lambda: float(_env("REPLY_INFLIGHT_GRACE_SECS", "6.0")))
    interrupt_on_vad: bool = field(
        default_factory=lambda: _env("INTERRUPT_ON_VAD", "true").lower() == "true")

    duck_enabled: bool = field(
        default_factory=lambda: _env("DUCK_ENABLED", "true").lower() == "true")
    # VAD heard a sound but STT produced no words (cough, horn): resume the held
    # reply this long after the sound ended.
    duck_no_words_resume_secs: float = field(
        default_factory=lambda: float(_env("DUCK_NO_WORDS_RESUME_SECS", "2.0")))
    # Absolute ceiling on one hold — a lost transcript must never mute the bot.
    duck_max_hold_secs: float = field(
        default_factory=lambda: float(_env("DUCK_MAX_HOLD_SECS", "12.0")))
    # Extra absorb-list words (comma-separated) on top of turntake.py's list —
    # per-deployment tuning without a rebuild.
    backchannel_extra: tuple = field(
        default_factory=lambda: tuple(
            w.strip().casefold() for w in _env("BACKCHANNEL_EXTRA", "").split(",")
            if w.strip()))

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

    # How long silence must outlast an interrupted reply before we believe the
    # caller truly heard none of it. 95% of interrupted-while-quiet replies play
    # within ~0.2s anyway (pipecat keeps the TTS socket alive in that window).
    unplayed_confirm_secs: float = field(
        default_factory=lambda: float(_env("UNPLAYED_CONFIRM_SECS", "3.0")))

    # After this many consecutive unheard caller utterances, stop apologising and
    # close the call honestly. Live 393859bc: Sarvam STT never transcribed
    # "hybrid model" though the caller said it four times; the bot apologised
    # four times and re-asked the same question three times.
    max_deaf_streak: int = field(default_factory=lambda: int(_env("MAX_DEAF_STREAK", "2")))

    # How long the line stays open after the bot's farewell finishes playing. Any
    # real word from the caller in this window CANCELS the close. Live ee8e2168:
    # the caller answered "Yes, I can" after the goodbye, the bot asked for a
    # date and time, and the stale end-latch dropped the line before they could
    # reply — a demo booking lost to our own hangup.
    end_grace_secs: float = field(
        default_factory=lambda: float(_env("END_GRACE_SECS", "2.0")))

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
