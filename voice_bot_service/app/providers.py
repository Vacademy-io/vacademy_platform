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

from pipecat.utils.text.simple_text_aggregator import SimpleTextAggregator

from .config import get_settings


class ClauseFlushAggregator(SimpleTextAggregator):
    """Sentence aggregation with Devanagari-danda + length fallbacks.

    The stock SimpleTextAggregator flushes ONLY at Latin end-of-sentence marks.
    Live evidence: English agents sometimes stream multi-sentence replies with no
    mid-response periods, and Hindi replies end sentences with the danda '।' the
    matcher doesn't recognize — either way the WHOLE response reaches the TTS as
    one giant unit. That unit is also the all-or-nothing context-commit unit, so a
    single barge-in wiped the entire block (INCLUDING the part the caller already
    heard) from the assistant context — the model then re-asked questions it had
    already asked ('memory reset' on live calls). Small units = small losses, plus
    earlier first audio.
    """

    _MAX_CHARS = 140

    async def aggregate(self, text):
        result = await super().aggregate(text)
        if result is not None:
            return result
        buf = self._text
        # Devanagari sentence end.
        danda = buf.find("।")
        if danda >= 0:
            out, self._text = buf[: danda + 1], buf[danda + 1:]
            return out.strip() or None
        # Length fallback for punctuation-less streams: cut at the last soft break.
        if len(buf) >= self._MAX_CHARS:
            cut = max(buf.rfind(", ", 0, self._MAX_CHARS + 20),
                      buf.rfind(" ", 0, self._MAX_CHARS + 20))
            if cut <= 0:
                cut = len(buf) - 1
            out, self._text = buf[: cut + 1], buf[cut + 1:]
            return out.strip() or None
        return None


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
    # The `prompt` bias is ONLY accepted by Sarvam STT-TRANSLATE models (saaras*);
    # saarika (transcription, our default) REJECTS it at construction with a ValueError.
    # So only attach the bias on a translate model — otherwise the name bias is silently
    # skipped (the language pin, which matters more, still applies).
    allow_bias = bool(bias) and "saaras" in (s.sarvam_stt_model or "").lower()
    params = None
    if tag or allow_bias:
        try:
            from pipecat.transcriptions.language import Language
            kwargs = {}
            if tag:
                kwargs["language"] = Language(tag)
            if allow_bias:
                kwargs["prompt"] = bias[:200]
            if s.sarvam_stt_high_vad:
                # Sarvam-side fast endpointing: measured (48h of live turns) as the
                # binding latency constraint — the server takes ~0.65-0.76s after end
                # of speech to finalize. High sensitivity finalizes sooner.
                kwargs["high_vad_sensitivity"] = True
            params = SarvamSTTService.InputParams(**kwargs)
        except Exception:
            params = None
    return ResilientSarvamSTTService(
        api_key=s.sarvam_api_key,
        model=s.sarvam_stt_model,
        sample_rate=sample_rate,
        params=params,
    )


def build_llm():
    s = get_settings()
    if s.llm_provider == "vertex":
        # Gemini on Vertex AI, served from vertex_location (asia-south1 = Mumbai):
        # in-country inference → low TTFT with no cross-ocean RTT. Lazy import so the
        # google extra is only touched when this provider is actually selected (the
        # sarvam/google/openrouter paths never load it). Auth = service account JSON.
        # pipecat's GoogleLLMService auto-sets thinking_budget=0 (thinking OFF) → the
        # fast path, no extra config. temperature 0.35 for proper-noun stability.
        from pipecat.services.google.llm import GoogleLLMService
        from pipecat.services.google.llm_vertex import GoogleVertexLLMService

        creds = s.vertex_credentials_json.strip() or None
        return GoogleVertexLLMService(
            credentials=creds,
            credentials_path=(s.vertex_credentials_path.strip() or None) if not creds else None,
            project_id=s.vertex_project_id or None,
            location=s.vertex_location,
            model=s.vertex_model,
            params=GoogleLLMService.InputParams(temperature=0.35, max_tokens=300),
        )
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
                temperature=0.35, max_tokens=300,
                extra={"extra_body": {"reasoning_effort": "none"}},
            ),
        )
    if s.llm_provider == "openrouter":
        # Lazy import — only needed when the fallback is active.
        from pipecat.services.openrouter.llm import OpenRouterLLMService

        return OpenRouterLLMService(
            api_key=s.openrouter_api_key,
            model=s.openrouter_model,
            params=OpenRouterLLMService.InputParams(temperature=0.35, max_tokens=300),
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
            temperature=0.35, max_tokens=300,
            extra={"extra_body": {"reasoning_effort": None}},
        ),
    )


def build_tts(sample_rate: int, voice: str | None = None, *, aiohttp_session,
              pace: float | None = None, temperature: float | None = None):
    """`aiohttp_session` is REQUIRED by SarvamTTSService (keyword-only, no
    default) — the FastAPI lifespan owns one shared session (see main.py).

    `pace`/`temperature` are the per-AGENT voice tuning (ai_agent.pace /
    .temperature via the call context); None falls back to the global TTS_PACE /
    Sarvam's model default. Clamped to Bulbul v3's documented ranges so a bad
    stored value can't 400 the TTS mid-call. (InputParams DOES carry temperature
    on pipecat 0.0.95 — verified against the installed package.)"""
    s = get_settings()
    eff_pace = _clamp(pace if pace is not None else s.tts_pace, 0.5, 2.0)
    kwargs = {"pace": eff_pace, "enable_preprocessing": True}
    if temperature is not None:
        kwargs["temperature"] = _clamp(temperature, 0.01, 2.0)
    # enable_preprocessing: bulbul normalizes numbers/dates/mixed-script text
    # before synthesis — noticeably cleaner Hinglish (POC voice recipe).
    if s.sarvam_tts_min_buffer > 0:
        # Server-side chars Sarvam buffers before the FIRST audio byte (default 50).
        # Clamped to Sarvam's validated floor: 20 was REJECTED by the WS config
        # ('Input parameters has to be a valid dictionary') → NO AUDIO on every call
        # (2026-07-20 outage). Probe-verified: 30 and 50 accepted.
        kwargs["min_buffer_size"] = max(30, s.sarvam_tts_min_buffer)
    return ResilientSarvamTTSService(
        api_key=s.sarvam_api_key,
        model=s.sarvam_tts_model,
        voice_id=voice or s.sarvam_tts_voice,
        sample_rate=sample_rate,
        aiohttp_session=aiohttp_session,
        params=SarvamTTSService.InputParams(**kwargs),
        # Clause-level TTS/context units — see ClauseFlushAggregator docstring.
        text_aggregator=ClauseFlushAggregator(),
        # pipecat 0.0.95's WS class NEVER puts pace into the config message (verified
        # from the live config dump + source), so pace historically applied only to
        # REST previews — never to live calls. Inject it ourselves (probe-verified:
        # Sarvam's WS config ACCEPTS 'pace' and returns audio).
        pace_override=eff_pace,
    )


def _clamp(v: float, lo: float, hi: float) -> float:
    try:
        return max(lo, min(hi, float(v)))
    except (TypeError, ValueError):
        return lo


class ResilientSarvamSTTService(SarvamSTTService):
    """Deaf-call guard. The stock run_stt SWALLOWS websocket send errors (it just
    logs 'Error sending audio to Sarvam') and never reconnects — one dropped Sarvam
    socket leaves the call deaf for its remainder (observed live: 617 consecutive
    send errors over 12s while the caller kept talking). Re-send through a fresh
    connection, at most once per cooldown so a hard Sarvam outage can't turn every
    20ms audio chunk into a reconnect storm. Faithful to the pinned pipecat==0.0.95
    internals (_socket_client / _disconnect / _connect) — re-verify on upgrade."""

    # Callable -> True when a wordless-but-voiced caller turn may be represented
    # as a synthetic backchannel (set by bot.py; None = feature off).
    _backchannel_gate = None

    def set_backchannel_gate(self, gate):
        self._backchannel_gate = gate

    async def _handle_message(self, message):
        await super()._handle_message(message)
        # Sarvam DROPS empty finals ("if transcript.strip()"), so a short "hmm"/
        # "okay" the STT can't words-ify produces NO frame at all: the model never
        # gets a turn-trigger and — because the VAD activity also re-arms the idle
        # nudge — the call sits in dead air until the caller says real words
        # (observed live: 13s mid-pitch stall, caller asked "why are you getting
        # paused again and again?"). Represent such finals as a minimal "Hmm."
        # transcript so the normal turn machinery continues the conversation.
        # RESTRAINED (live lesson): empty finals also fire on breath/noise right
        # around REAL captured utterances — un-throttled synthesis spawned extra
        # LLM turns mid-complaint and fed talk-over. One-shot until the next real
        # final, and suppressed within 2.5s of one (that empty is just its tail).
        try:
            if getattr(message, "type", None) != "data":
                return
            data = getattr(message, "data", None)
            t = getattr(data, "transcript", None)
            import time as _time
            if t and t.strip():
                self._synth_armed = True
                self._last_real_final_t = _time.monotonic()
                return
            gate = self._backchannel_gate
            if gate is None or not gate():
                return
            if not getattr(self, "_synth_armed", True):
                return
            if _time.monotonic() - getattr(self, "_last_real_final_t", 0.0) < 2.5:
                return
            self._synth_armed = False
            from pipecat.frames.frames import TranscriptionFrame
            from pipecat.utils.time import time_now_iso8601
            await self.push_frame(TranscriptionFrame("Hmm.", self._user_id, time_now_iso8601(), None))
        except Exception:
            pass

    _RECONNECT_COOLDOWN_SECS = 5.0

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._last_reconnect_at = 0.0

    async def _reconnect_once(self):
        import time as _time
        now = _time.monotonic()
        if now - self._last_reconnect_at < self._RECONNECT_COOLDOWN_SECS:
            return False
        self._last_reconnect_at = now
        try:
            await self._disconnect()
        except Exception:
            pass
        try:
            await self._connect()
            return self._socket_client is not None
        except Exception as e:
            logger = __import__("logging").getLogger("voice_bot")
            logger.warning("sarvam stt reconnect failed: %s", e)
            return False

    async def run_stt(self, audio: bytes):
        # Torn-down client (base disconnected but the pipeline is still feeding
        # audio): try to restore instead of yielding None forever.
        if not self._socket_client:
            await self._reconnect_once()
        try:
            async for f in super().run_stt(audio):
                yield f
            return
        except Exception:
            # Base normally swallows send errors; anything escaping is a dead socket.
            pass
        if await self._reconnect_once():
            try:
                async for f in super().run_stt(audio):
                    yield f
                return
            except Exception:
                pass
        yield None


class ResilientSarvamTTSService(SarvamTTSService):
    """Silent-bot guard + pace injection. (1) In pipecat 0.0.95, when Sarvam closes
    the TTS socket cleanly the receive loop exits WITHOUT reconnecting and leaves
    _receive_task as a finished-but-non-None task; the next run_tts calls _connect(),
    but task creation is guarded by `not self._receive_task`, so the NEW socket gets
    no receive loop → synthesized audio is never read → the bot goes silent. Clearing
    finished task handles before delegating closes the trap. (2) The stock class never
    sends 'pace' in the WS config (only the REST path uses it), so agent pace did
    nothing on live calls — inject it into the config dict (Sarvam-accepted,
    probe-verified 2026-07-20)."""

    def __init__(self, *args, pace_override: float | None = None, **kwargs):
        super().__init__(*args, **kwargs)
        self._pace_override = pace_override

    async def _send_config(self):
        if self._pace_override is not None:
            self._settings["pace"] = float(self._pace_override)
        await super()._send_config()

    async def _connect(self):
        for attr in ("_receive_task", "_keepalive_task"):
            t = getattr(self, attr, None)
            if t is not None and t.done():
                setattr(self, attr, None)
        await super()._connect()
