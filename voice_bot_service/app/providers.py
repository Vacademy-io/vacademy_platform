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

import logging
import re

logger = logging.getLogger("voice_bot")

# A chunk with no word character is not speech. Sarvam REJECTS such input with
# "Text must contain at least one character from the allowed languages" — and
# pipecat 0.0.95 only logs that error and pushes an ErrorFrame: it never closes
# the socket, so `run_tts`'s `state is State.CLOSED` guard never fires and every
# LATER reply is sent into a dead-but-open socket, producing ZERO audio until our
# stall watchdog notices ~3.5s later. That is the 8-10.4s dead air the founder
# heard on 2026-07-29 (13 stalls / 7 of 220 calls). \w minus '_' , Unicode-aware
# so Devanagari counts as a word character.
_WORD_CHAR_RE = re.compile(r"[^\W_]", re.UNICODE)


def has_word_char(text: str | None) -> bool:
    """True if `text` contains at least one letter/digit in ANY script."""
    return bool(text) and _WORD_CHAR_RE.search(text) is not None


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
            # A flush unit with NO word character (e.g. a lone closing quote left
            # by an authored script's quoted line) is not speech — and Sarvam
            # REJECTS it with "Text must contain at least one character from the
            # allowed languages", which wedges the TTS socket open-but-dead (see
            # ResilientSarvamTTSService). Push it back so it merges into the next
            # unit: emitted text stays byte-identical to the old concatenation.
            if not has_word_char(result):
                self._text = result + self._text
                return None
            return result
        buf = self._text
        # Devanagari sentence end.
        danda = buf.find("।")
        if danda >= 0:
            out, rest = buf[: danda + 1], buf[danda + 1:]
            if not has_word_char(out):
                return None          # leave it buffered; merges into the next unit
            self._text = rest
            return out.strip() or None
        # Length fallback for punctuation-less streams: cut at the last soft break.
        if len(buf) >= self._MAX_CHARS:
            cut = max(buf.rfind(", ", 0, self._MAX_CHARS + 20),
                      buf.rfind(" ", 0, self._MAX_CHARS + 20))
            if cut <= 0:
                cut = len(buf) - 1
            out, rest = buf[: cut + 1], buf[cut + 1:]
            if not has_word_char(out):
                return None
            self._text = rest
            return out.strip() or None
        return None


class _SaarasStreamingShim:
    """Makes pipecat's translate-socket call land on the TRANSCRIBE socket.

    pipecat 0.0.95 routes every non-"saarika" model to
    speech_to_text_translate_streaming, which takes no language_code and always
    returns English. Sarvam's websocket docs list saaras:v4 on the normal
    transcribe channel WITH `language-code` and a `mode`
    (transcribe|translate|verbatim|translit|codemix, saaras:v3/v4 only).

    Swapping the endpoint UNDER pipecat — rather than overriding _connect — keeps
    its receive-task, prompt and handler wiring intact, which the deaf-detection
    fix depends on. `mode` is absent from the pinned SDK's signature, so it rides
    RequestOptions' additional_query_parameters.
    """

    def __init__(self, client, language_code: str, mode: str):
        self._client = client
        self._language_code = language_code
        self._mode = mode

    def connect(self, **kwargs):
        from sarvamai.core.request_options import RequestOptions
        kwargs["language_code"] = self._language_code
        kwargs["request_options"] = RequestOptions(
            additional_query_parameters={"mode": self._mode})
        return self._client.speech_to_text_streaming.connect(**kwargs)


def _install_saaras_shim(svc, language_code: str, mode: str) -> None:
    try:
        svc._sarvam_client.speech_to_text_translate_streaming = _SaarasStreamingShim(
            svc._sarvam_client, language_code, mode)
        svc._stt_mode = mode
        logger.info("stt: %s mode=%s language=%s", svc.model_name, mode, language_code)
    except Exception:
        # Fail OPEN: without the shim pipecat still connects (translate mode), so
        # the bot keeps hearing — it just loses the language pin and the mode.
        logger.exception("stt: saaras shim not installed — using pipecat default routing")


def build_stt(sample_rate: int, language: str | None = None, bias: str | None = None,
              mode: str | None = None):
    s = get_settings()
    # Pin STT to the agent's configured language (BCP-47, e.g. "hi-IN"), falling back to
    # the SARVAM_STT_LANGUAGE env default. A pin matters: auto-detect drifts a Hindi/
    # Hinglish caller into a neighbouring Indic language (Punjabi/Marathi) and the call
    # follows it. `bias` is a short vocabulary hint (the agent's own name, e.g. "Aarushi")
    # fed to saarika's `prompt` so a caller repeating the name isn't transcribed as
    # "Aayushi"/"Aarush" and fed back into the LLM context as a wrong name. Guarded so a
    # bad value can't crash startup — it just falls back to auto / no bias.
    # saaras* are STT-TRANSLATE models: they AUTO-DETECT the language and pipecat
    # raises ValueError("Model does not accept language parameter") if one is
    # passed — which would crash EVERY call the moment the model env was flipped.
    # The two families take mutually exclusive params: saaras takes `prompt` (the
    # name bias) and refuses `language`; saarika takes `language` and refuses
    # `prompt`. Decide once, here.
    # saaras:v3/v4 are UNIFIED models: per Sarvam's websocket docs they accept
    # `language-code` AND a `mode` (transcribe | translate | verbatim | translit |
    # codemix). pipecat 0.0.95 predates that — it routes ANY "saaras*" model to
    # the translate socket and raises if a language is passed — so we keep the
    # language here and re-route in _connect below. saarika (legacy) is
    # transcribe-only and takes language_code natively.
    mode = (mode or s.sarvam_stt_mode or "transcribe").strip()
    model_l = (s.sarvam_stt_model or "").lower()
    is_saaras = "saaras" in model_l
    tag = language or s.sarvam_stt_language
    # The name bias (`prompt`) is saaras-only, and pipecat validates BOTH ways:
    # saarika raises on `prompt`, saaras raises on `language`. Since the saaras
    # path constructs a saarika-shaped shim (below) to get the language accepted,
    # the prompt can never go through InputParams — it is set on the instance
    # after construction instead.
    allow_bias = False
    params = None
    if tag or allow_bias or s.sarvam_stt_high_vad:
        # Field-by-field: a single bad value (e.g. an unknown language tag) must
        # not silently discard the OTHER params — the old blanket except dropped
        # high_vad_sensitivity (+0.7s/turn) and the language pin together
        # (deep-review B2; Odia's wrong tag triggered exactly this).
        kwargs = {}
        if tag:
            try:
                from pipecat.transcriptions.language import Language
                kwargs["language"] = Language(tag)
            except Exception:
                logger.warning("build_stt: unknown language tag %r — auto-detect", tag)
        if allow_bias:
            kwargs["prompt"] = bias[:200]
        if s.sarvam_stt_high_vad:
            # Sarvam-side fast endpointing: measured (48h of live turns) as the
            # binding latency constraint — the server takes ~0.65-0.76s after end
            # of speech to finalize. High sensitivity finalizes sooner.
            kwargs["high_vad_sensitivity"] = True
        try:
            params = SarvamSTTService.InputParams(**kwargs)
        except Exception:
            logger.warning("build_stt: InputParams rejected %r — using defaults", kwargs)
            params = None
    if is_saaras:
        # Construct as saarika so pipecat's "saaras must not get a language" guard
        # does not fire and _language_string is still resolved for us, then restore
        # the real model name.
        svc = ResilientSarvamSTTService(
            api_key=s.sarvam_api_key,
            model="saarika:v2.5",
            sample_rate=sample_rate,
            params=params,
        )
        svc.set_model_name(s.sarvam_stt_model)
        if bias:
            svc._prompt = bias[:200]
        _install_saaras_shim(svc, language_code=tag or "unknown", mode=mode)
        return svc
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
                pending = getattr(self, "_synth_task", None)
                if pending is not None and not pending.done():
                    pending.cancel()   # real words beat the debounced synth
                return
            gate = self._backchannel_gate
            if gate is None or not gate():
                return
            if not getattr(self, "_synth_armed", True):
                return
            if _time.monotonic() - getattr(self, "_last_real_final_t", 0.0) < 2.5:
                return
            # DEBOUNCE 1.2s: Sarvam can emit the empty final (breath tail) 100-300ms
            # BEFORE the real final of the same utterance — an immediate synth then
            # produced TWO back-to-back LLM turns (deep-review A8). The pending task
            # is cancelled the moment a real final arrives.
            pending = getattr(self, "_synth_task", None)
            if pending is not None and not pending.done():
                return
            import asyncio as _asyncio
            self._synth_task = _asyncio.create_task(self._delayed_backchannel())
        except Exception:
            pass

    async def _delayed_backchannel(self):
        import asyncio as _asyncio
        try:
            await _asyncio.sleep(1.2)
            gate = self._backchannel_gate
            if gate is None or not gate():
                return
            self._synth_armed = False
            from pipecat.frames.frames import TranscriptionFrame
            from pipecat.utils.time import time_now_iso8601
            # Bracketed cue, NOT "Hmm." — prompt rule 7 reads a spoken 'hmm' as
            # CONSENT, so a cough/breath was auto-agreeing to demos (deep-review
            # A8 "phantom consent"). A cue can't be read as a yes, and the
            # transcript honestly records an unclear sound.
            await self.push_frame(TranscriptionFrame(
                "[unclear sound from the caller]", self._user_id, time_now_iso8601(), None))
        except _asyncio.CancelledError:
            pass
        except Exception:
            pass

    _RECONNECT_COOLDOWN_SECS = 5.0

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._last_reconnect_at = 0.0

    _diag = None

    def set_diagnostics(self, diag):
        self._diag = diag

    async def _reconnect_once(self):
        import time as _time
        try:
            if self._diag is not None:
                self._diag.bump("stt_reconnects")
        except Exception:
            pass
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
        # REAL deaf-call detection (deep-review A5). The old exception-based
        # retry here was DEAD CODE: base run_stt wraps its send in
        # `except Exception` (log + ErrorFrame + yield None) so NOTHING ever
        # escapes, and a mid-call socket death never nulls _socket_client — the
        # 617-consecutive-error deaf call was still possible. The RELIABLE
        # signal is the receive task having EXITED: the server closed the
        # socket, the base's _receive_task_handler returned, and every
        # subsequent send silently no-ops. Detect that and reconnect (5s
        # cooldown so a hard Sarvam outage can't turn every 20ms chunk into a
        # connect storm).
        rt = getattr(self, "_receive_task", None)
        if self._socket_client is None or (rt is not None and rt.done()):
            await self._reconnect_once()
        async for f in super().run_stt(audio):
            yield f


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

    # bot.py wires this to stamp "a response's audio is now pending" — the
    # audio-stall watchdog uses it to detect a generated-but-never-heard reply
    # (observed live: TTS first-byte spiked to 7s; every reply was cancelled by
    # the caller's next 'hello' before its audio started → permanently silent call).
    _on_generate = None

    def set_generate_callback(self, cb):
        self._on_generate = cb

    # Set when Sarvam answers with {"type":"error"}. pipecat's _receive_messages
    # only logs it and pushes an ErrorFrame — it never closes the socket, so the
    # socket stays OPEN but never synthesizes again and run_tts's
    # `state is State.CLOSED` guard can't see it. We treat any TTS error as
    # socket death and force a reconnect before the next synthesis.
    _wedged = False
    _diag = None

    def set_diagnostics(self, diag):
        self._diag = diag

    def _diag_bump(self, name):
        try:
            if self._diag is not None:
                self._diag.bump(name)
        except Exception:
            pass

    async def push_frame(self, frame, direction=None):
        # Cheap isinstance on the frame stream — the ONLY place the Sarvam error
        # surfaces (it is pushed, not raised, and not returned by run_tts).
        try:
            from pipecat.frames.frames import ErrorFrame as _ErrF
            if isinstance(frame, _ErrF) and "TTS Error" in str(getattr(frame, "error", "")):
                if not self._wedged:
                    self._diag_bump("tts_wedges")
                    logger.error("tts: Sarvam rejected input — marking socket wedged, "
                                 "will reconnect before next synthesis: %s",
                                 str(getattr(frame, "error", ""))[:160])
                self._wedged = True
        except Exception:
            pass
        if direction is None:
            await super().push_frame(frame)
        else:
            await super().push_frame(frame, direction)

    async def run_tts(self, text: str):
        # 1) Never SEND letterless text: it is not speech, and it is what wedges
        #    the socket in the first place. Skipped BEFORE _on_generate so a
        #    chunk we never send can't arm the audio-stall stamp (which would
        #    make the watchdog "recover" from a stall that cannot happen).
        if not has_word_char(text):
            self._diag_bump("tts_letterless_skipped")
            logger.info("tts: skipping letterless chunk %r", (text or "")[:40])
            return
        # 2) A previously-wedged socket produces ZERO audio forever. Rebuild it
        #    before synthesizing rather than waiting ~3.5s for the stall watchdog.
        if self._wedged:
            self._diag_bump("tts_wedge_reconnects")
            logger.warning("tts: reconnecting wedged socket before synthesis")
            self._wedged = False
            try:
                await self._disconnect()
                await self._connect()
            except Exception as e:
                logger.warning("tts: wedge reconnect failed: %s", e)
        self._diag_bump("replies_generated")
        if self._on_generate is not None:
            try:
                self._on_generate()
            except Exception:
                pass
        async for frame in super().run_tts(text):
            yield frame

    async def process_frame(self, frame, direction):
        await super().process_frame(frame, direction)
        # Stock 0.0.95 sends Sarvam's {"type":"flush"} BEFORE super() reads the
        # aggregator remainder — so a short unpunctuated response TAIL is sent
        # post-flush and sits unsynthesized in Sarvam's server buffer until the
        # NEXT turn (or is discarded on reconnect). ClauseFlushAggregator makes
        # short tails frequent → "last words of a reply never play" (deep-review
        # A4). Re-flushing AFTER super() pushes the tail out immediately.
        from pipecat.frames.frames import LLMFullResponseEndFrame as _EndF
        if isinstance(frame, _EndF):
            try:
                await self.flush_audio()
            except Exception as e:
                logger.warning("post-remainder flush failed: %s", e)

    def __init__(self, *args, pace_override: float | None = None, **kwargs):
        super().__init__(*args, **kwargs)
        self._pace_override = pace_override
        # Serializes connect/disconnect: three drivers touch the socket (the
        # processor's run_tts error path, the interruption handler's per-barge-in
        # reconnect, and the watchdog's stall recovery). The base's
        # _connect_websocket is check-then-act with awaits in between — two
        # concurrent calls both pass the check and the loser's socket LEAKS OPEN
        # server-side (deep-review B1/F5; plausible contributor to Sarvam's
        # first-byte stalls). Verified: base _connect/_disconnect never nest, so
        # a non-reentrant Lock is safe.
        import asyncio as _asyncio
        self._conn_lock = _asyncio.Lock()

    async def _send_config(self):
        if self._pace_override is not None:
            self._settings["pace"] = float(self._pace_override)
        await super()._send_config()

    async def _connect(self):
        async with self._conn_lock:
            for attr in ("_receive_task", "_keepalive_task"):
                t = getattr(self, attr, None)
                if t is not None and t.done():
                    setattr(self, attr, None)
            await super()._connect()

    async def _disconnect(self):
        async with self._conn_lock:
            await super()._disconnect()
