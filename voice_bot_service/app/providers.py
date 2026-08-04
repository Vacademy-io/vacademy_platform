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
from pipecat.services.tts_service import InterruptibleTTSService, TTSService

from pipecat.utils.text.simple_text_aggregator import SimpleTextAggregator

from .config import get_settings

import asyncio
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


class _SaarasSocketProxy:
    """Gives a TRANSCRIBE socket the surface pipecat expects of a TRANSLATE one.

    pipecat branches on the model name in TWO places, not one:
      _connect  -> chooses the endpoint      (handled by _SaarasStreamingShim)
      run_stt   -> calls socket.translate()  (handled HERE)
    A transcribe socket exposes only flush/on/recv/start_listening/transcribe, so
    `translate()` raised AttributeError on EVERY audio frame: the socket connected,
    the receive task ran, and not one byte of audio was ever sent — a live call
    produced ZERO transcripts while the caller said "Hello" seven times. set_prompt
    is a no-op for the same reason (it exists only on the translate socket).
    """

    def __init__(self, sock):
        self._sock = sock

    def __getattr__(self, name):
        return getattr(self._sock, name)

    async def translate(self, **kwargs):
        return await self._sock.transcribe(**kwargs)

    async def set_prompt(self, *args, **kwargs):
        return None


class _SaarasConnectCtx:
    """Async-CM wrapper so pipecat's __aenter__/__aexit__ get the proxied socket."""

    def __init__(self, ctx):
        self._ctx = ctx

    async def __aenter__(self):
        return _SaarasSocketProxy(await self._ctx.__aenter__())

    async def __aexit__(self, *exc):
        return await self._ctx.__aexit__(*exc)


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
        return _SaarasConnectCtx(self._client.speech_to_text_streaming.connect(**kwargs))


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
        # DO NOT set _prompt here. pipecat's _connect calls
        # `self._socket_client.set_prompt(...)` whenever "saaras" is in the model
        # name — but set_prompt exists ONLY on the TRANSLATE socket, and the shim
        # hands it a TRANSCRIBE socket. Setting it raised inside _connect, so the
        # socket was never usable and run_stt's deaf-detection hammered reconnect:
        # a live call logged 1827 reconnects with zero transcripts. The name bias
        # is simply not available on this path; the language pin and mode matter
        # far more. (Verified: transcribe socket exposes only
        # flush/on/recv/start_listening/transcribe.)
        svc._prompt = None
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
              tts_model: str | None = None,
              pace: float | None = None, temperature: float | None = None):
    """`aiohttp_session` is REQUIRED by SarvamTTSService (keyword-only, no
    default) — the FastAPI lifespan owns one shared session (see main.py).

    `pace`/`temperature` are the per-AGENT voice tuning (ai_agent.pace /
    .temperature via the call context); None falls back to the global TTS_PACE /
    Sarvam's model default. Clamped to Bulbul v3's documented ranges so a bad
    stored value can't 400 the TTS mid-call. (InputParams DOES carry temperature
    on pipecat 0.0.95 — verified against the installed package.)"""
    s = get_settings()
    # TTS PROVIDER SWITCH. Per-agent, defaulting to the env. "rumik" is the
    # default going forward: Rs 0.50/1k chars against Sarvam's Rs 3.00 on the line
    # that is 65% of per-call cost, with a real cancel primitive so barge-in does
    # not require closing (and wedging) the socket.
    model = (tts_model or s.tts_model or "").strip().lower()
    if model.startswith("rumik") or model.startswith("silk"):
        if not s.rumik_api_key:
            logger.error("tts: RUMIK_API_KEY unset — falling back to Sarvam bulbul:v3")
        else:
            return RumikTTSService(
                api_key=s.rumik_api_key,
                # Rumik emits 24 kHz ONLY; the output transport resamples to the
                # 8 kHz Plivo leg.
                sample_rate=24000,
                voice=(voice or s.rumik_voice).strip() or "ira",
                model="mulberry",
            )
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
        now = _time.monotonic()
        if now - self._last_reconnect_at < self._RECONNECT_COOLDOWN_SECS:
            return False
        # Count AFTER the cooldown gate. run_stt calls this per audio frame
        # (~50/s), so counting before it turned "reconnect attempts" into "frames
        # seen while the socket was down" — a live call reported 1827 when the
        # true number was ~7. A metric that inflates 250x is worse than none.
        try:
            if self._diag is not None:
                self._diag.bump("stt_reconnects")
        except Exception:
            pass
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


# ── Rumik Silk TTS ───────────────────────────────────────────────────────────

async def rumik_synthesize_wav(text: str, voice: str, api_key: str,
                               session=None, model: str = "mulberry") -> bytes:
    """One-shot Rumik synthesis -> WAV bytes. For the admin voice tester.

    Deliberately NOT reusing RumikTTSService: that is a pipecat pipeline component
    whose output goes to frames and whose lifecycle assumes a running call. A
    preview needs bytes, and giving it its own short path keeps a preview bug from
    ever touching live-call code.

    Returns b"" on any failure — the caller decides the HTTP status. Never raises,
    because a public preview endpoint must not 500 on a vendor hiccup.
    """
    import aiohttp
    import io
    import json as _json
    import wave
    own = session is None
    if own:
        session = aiohttp.ClientSession()
    try:
        async with session.post(
                RumikTTSService.MINT_URL,
                headers={"Authorization": f"Bearer {api_key}"},
                json={"model": model, "text": text},
                timeout=aiohttp.ClientTimeout(total=15)) as resp:
            if resp.status != 200:
                logger.warning("rumik preview: mint %s: %s", resp.status,
                               (await resp.text())[:200])
                return b""
            mint = await resp.json()
        pcm = bytearray()
        async with session.ws_connect(f'{mint["ws_url"]}?token={mint["token"]}',
                                      timeout=aiohttp.ClientTimeout(total=20)) as ws:
            await ws.send_json({"text": text, "speaker": (voice or "ira").strip().lower()})
            while True:
                msg = await asyncio.wait_for(ws.receive(), timeout=25)
                if msg.type == aiohttp.WSMsgType.BINARY:
                    pcm += msg.data
                elif msg.type == aiohttp.WSMsgType.TEXT:
                    j = _json.loads(msg.data)
                    if j.get("type") in ("done", "cancelled"):
                        break
                    if j.get("type") == "error":
                        logger.warning("rumik preview: %s", str(j)[:200])
                        return b""
                else:
                    break
        if not pcm:
            return b""
        buf = io.BytesIO()
        with wave.open(buf, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            # 24 kHz is Rumik's only output rate; the WAV header must say so or the
            # browser plays it at the wrong speed.
            w.setframerate(24000)
            w.writeframes(bytes(pcm))
        return buf.getvalue()
    except Exception:
        logger.exception("rumik preview failed")
        return b""
    finally:
        if own:
            await session.close()


class RumikTTSService(InterruptibleTTSService):
    """Rumik Silk (mulberry 1.5) streaming TTS.

    pipecat 0.0.95 has no Rumik service, so this is hand-written to the
    WebsocketService contract: implement _connect_websocket /
    _disconnect_websocket / _receive_messages and the base gives us connection
    verification (ping) and reconnection-with-backoff for free. It therefore uses
    the `websockets` library, NOT aiohttp — the base calls .ping() and inspects
    .state, which only the former exposes.

    THE PROTOCOL MISMATCH THIS CLASS EXISTS TO BRIDGE. Sarvam's socket is a
    streaming-TEXT protocol: you may push clause after clause and the server
    buffers and flushes one continuous stream. Rumik's is REQUEST/RESPONSE and
    strictly one at a time — a second {"text":...} on the same socket CANCELS the
    first, which the server reports as {"type":"cancelled","reason":"interrupt"}.
    pipecat sends one socket message per aggregated sentence as the LLM streams
    and does not wait for completion, so the naive port truncated every
    multi-sentence reply to its LAST sentence (probed live: 85 ms of sentence 1,
    then only sentence 2 spoken). Hence the sender loop below: sends are
    serialised per socket, in a BACKGROUND task rather than inline in run_tts,
    because blocking run_tts would hold the pipeline task and delay the very
    InterruptionFrame that barge-in depends on.

    Why Rumik — measured against the live API from the box, not claimed:
      * Rs 0.50 / 1k characters vs Sarvam bulbul:v3's Rs 3.00. TTS is 65% of our
        per-call cost, so this is a 6x cut on the dominant line.
      * TTFB 0.295s end to end (server reported ttfa_ms 112.5), against Sarvam's
        0.20s median but 4.5s p95. Measured rtf 0.325 — generation runs ~3x ahead
        of playout, which is why serialising sends costs no audible latency.
      * A real cancel that PRESERVES the socket, so barge-in needs no reconnect.
        Sarvam has no cancel at all, which is why barge-in there means closing the
        socket — the root of 13 stalls across 220 calls.

    Protocol, verified live:
      mint  POST https://silk-api.rumik.ai/v1/tts/ws-connect  (Bearer key,
            body {"model":"mulberry","text":...}) -> {ws_url, token, expires_in}
      conn  wss://silk-api.rumik.ai/ws/tts?token=<token>
      send  {"text":..., "speaker":"ira"}          ONE AT A TIME
      recv  binary PCM int16 LE @ 24 kHz mono, then
            {"type":"done", credits_used, duration_s, ttfa_ms, ...}
      stop  {"type":"cancel"} -> {"type":"cancelled","reason":"cancel"}
      idle  {"type":"timeout","message":"Connection idle for 1 minute"} then a
            CLEAN (code 1000) close. Client pings do NOT refresh the vendor timer.

    24 kHz is the ONLY output format (no 8 kHz, no mu-law), so we declare 24 kHz
    and let pipecat's output transport resample onto the 8 kHz Plivo leg.
    """

    MINT_URL = "https://silk-api.rumik.ai/v1/tts/ws-connect"

    def __init__(self, *, api_key: str, voice: str = "ira",
                 model: str = "mulberry", sample_rate: int = 24000,
                 description: str | None = None,
                 turn_wait_secs: float = 20.0, **kwargs):
        super().__init__(sample_rate=sample_rate, **kwargs)
        self._api_key = api_key
        self._voice = voice
        self._model = model
        self._description = description
        self._receive_task = None
        self._sender_task = None
        self._request_active = False
        # Initialised HERE, not left to TTSService.start(): run_tts reads it, and
        # if the attribute is missing the FIRST utterance of every call dies with
        # AttributeError (caught by the e2e; a connect-only probe cannot see it).
        self._started = False
        # Rumik's own meter, echoed on the terminal frame — bot.py records it so
        # the health panel can report ACTUAL vendor spend per call instead of
        # inferring it from character counts.
        self._on_credits = None
        self._pending_chars = 0
        self._diag = None
        self._on_generate = None
        # Serialisation state. _turn_done starts SET: the first send must not wait.
        self._send_queue = asyncio.Queue()
        self._turn_done = asyncio.Event()
        self._turn_done.set()
        self._turn_wait_secs = turn_wait_secs
        # Intentional teardown. Without this, closing the socket at end of call
        # looks identical to the vendor's idle-close and would trigger a pointless
        # reconnect during shutdown.
        self._closing = False
        # Cancels actually put on the wire vs interruptions seen. Recorded because
        # "the cancel never fires" is invisible otherwise — it is precisely how the
        # first version of this class shipped broken.
        self._cancels_sent = 0
        self._dropped_audio_bytes = 0
        # Sentences enqueued but not yet terminated by the vendor. NOT the queue's
        # length: the sender pops an item BEFORE sending it, so an empty queue means
        # "nothing waiting", not "nothing outstanding". Gating the end of the bot's
        # turn on queue emptiness ended the turn while the LAST sentence was still
        # unsent, and its audio then arrived after TTSStoppedFrame — 71% of a
        # three-sentence reply reached the caller. Only a runtime trace showed it.
        self._pending_sends = 0
        self._interruptions_seen = 0
        self.set_model_name(f"silk-{model}")
        self.set_voice(voice)

    def set_credits_callback(self, cb):
        self._on_credits = cb

    # ── diagnostics hooks (SAME duck-typed contract bot.py uses for Sarvam) ──
    # These are not optional extras. bot.py wires stall detection through
    # `hasattr(tts, "set_generate_callback")` and `hasattr(_svc,
    # "set_diagnostics")`; without them both guards skip SILENTLY, tts_gen_t is
    # never stamped, watchdog_decide can never return STALL_RECOVER, and the
    # reconnect-and-say-it-again recovery is dead code — on the provider whose
    # whole justification was fixing stalls.
    def set_diagnostics(self, diag):
        self._diag = diag

    def set_generate_callback(self, cb):
        self._on_generate = cb

    def _diag_bump(self, name: str, by: int = 1):
        try:
            if self._diag is not None:
                self._diag.bump(name, by)
        except Exception:
            pass

    def can_generate_metrics(self) -> bool:
        return True

    # ── lifecycle ──
    async def start(self, frame):
        await super().start(frame)
        await self._connect()

    async def stop(self, frame):
        await super().stop(frame)
        await self._disconnect()

    async def cancel(self, frame):
        await super().cancel(frame)
        await self._disconnect()

    async def _connect(self):
        await self._connect_websocket()
        # `not self._receive_task` alone is WRONG: a task that has finished is
        # done-but-not-None, so a fresh socket would come up with no reader and the
        # call would be silent forever. Same trap already fixed for Sarvam.
        if self._websocket and (self._receive_task is None or self._receive_task.done()):
            self._receive_task = self.create_task(
                self._receive_task_handler(self._report_error))
        if self._sender_task is None or self._sender_task.done():
            self._sender_task = self.create_task(self._sender_loop())

    async def _disconnect(self):
        self._closing = True
        for attr in ("_receive_task", "_sender_task"):
            task = getattr(self, attr, None)
            if task:
                await self.cancel_task(task, timeout=2.0)
                setattr(self, attr, None)
        await self._disconnect_websocket()

    # ── WebsocketService contract ──
    async def _connect_websocket(self):
        from websockets.asyncio.client import connect as websocket_connect
        from websockets.protocol import State
        try:
            if self._websocket and self._websocket.state is State.OPEN:
                return
            mint = await self._mint()
            self._websocket = await websocket_connect(
                f"{mint['ws_url']}?token={mint['token']}")
            self._closing = False
            # A reconnect must not inherit the old turn's block, or the first send
            # on the new socket waits out the full timeout for a `done` that can
            # never arrive.
            self._turn_done.set()
            logger.info("rumik: connected (%s voice=%s)", self.model_name, self._voice)
        except Exception as e:
            logger.error("rumik: connect failed: %s", e)
            self._websocket = None

    async def _disconnect_websocket(self):
        try:
            await self.stop_all_metrics()
            if self._websocket:
                await self._websocket.close()
        except Exception as e:
            logger.warning("rumik: close failed: %s", e)
        finally:
            self._started = False
            self._request_active = False
            self._websocket = None
            self._pending_sends = 0
            # Release anything waiting on a `done` that will never come.
            self._turn_done.set()

    async def _receive_messages(self):
        """Binary -> audio frames; the terminal frame ends one request.

        MUST RAISE when the socket closes. `websockets.__aiter__` swallows
        ConnectionClosedOK and returns normally, and pipecat's
        _receive_task_handler is `while True: await self._receive_messages()` with
        nothing in the loop that yields — so returning quietly spins the event loop
        at 100% and starves EVERY concurrent call on the box, the Plivo sockets and
        the health endpoint (proven: a 0.05s ticker recorded 0 ticks). Raising
        routes into the base's _try_reconnect, which re-mints with backoff and
        keeps the reader alive.
        """
        import json as _json
        from pipecat.frames.frames import TTSAudioRawFrame, TTSStoppedFrame
        async for message in self._websocket:
            if isinstance(message, (bytes, bytearray)):
                # Drop audio arriving for a request we cancelled: otherwise the
                # tail of a barged-in reply leaks into the next turn. Counted,
                # because "audio we threw away" is the difference between a reply
                # the caller heard and one they did not.
                if not self._request_active:
                    self._dropped_audio_bytes += len(message)
                    continue
                await self.stop_ttfb_metrics()
                await self.push_frame(TTSAudioRawFrame(bytes(message), self.sample_rate, 1))
                continue
            try:
                j = _json.loads(message)
            except Exception:
                continue
            kind = j.get("type")
            if kind in ("done", "cancelled"):
                self._request_active = False
                self._turn_done.set()
                if kind == "done":
                    try:
                        if self._on_credits is not None:
                            self._on_credits(float(j.get("credits_used") or 0.0),
                                             float(j.get("duration_s") or 0.0),
                                             self._pending_chars)
                    except Exception:
                        pass
                # End the bot's TURN only when no sentence of this reply is still
                # outstanding — one Started/Stopped pair per REPLY, not per
                # sentence, or the caller-silence measurements that hang off
                # BotStoppedSpeaking fire in the middle of a reply.
                await self._complete_one_request()
            elif kind == "timeout":
                # The vendor's idle notice, immediately followed by a clean close.
                logger.info("rumik: vendor idle timeout — will reconnect on demand")
            elif kind == "error":
                logger.error("rumik: %s", str(j)[:200])
                self._request_active = False
                self._turn_done.set()
                self._diag_bump("tts_wedges")
                await self._complete_one_request()
        # Loop exited => socket closed. See the docstring: never return quietly.
        if not self._closing:
            raise ConnectionError("rumik: websocket closed by peer")

    async def _complete_one_request(self, *, push_stopped: bool = True):
        """One request finished (or was abandoned). Close the turn if it was the last.

        The counter must never leak: a stuck positive value means TTSStoppedFrame is
        never pushed and the pipeline believes the bot is still speaking for the rest
        of the call, so every path that removes work calls this exactly once.
        """
        from pipecat.frames.frames import TTSStoppedFrame
        self._pending_sends = max(0, self._pending_sends - 1)
        if self._pending_sends == 0 and self._started and push_stopped:
            self._started = False
            await self.push_frame(TTSStoppedFrame())

    async def _sender_loop(self):
        """Serialise sends: one outstanding Rumik request per socket, ever."""
        import json as _json
        from websockets.protocol import State
        while True:
            text = await self._send_queue.get()
            try:
                if not self._turn_done.is_set():
                    try:
                        await asyncio.wait_for(self._turn_done.wait(),
                                               timeout=self._turn_wait_secs)
                    except asyncio.TimeoutError:
                        # Push through rather than wedge. A missing `done` must
                        # degrade to "this sentence cancelled the last one", never
                        # to "the call is silent from here with no signal".
                        self._diag_bump("tts_silent_generations")
                        logger.warning("rumik: no terminal frame in %.1fs — sending anyway",
                                       self._turn_wait_secs)
                if not self._websocket or self._websocket.state is not State.OPEN:
                    logger.warning("rumik: dropping queued sentence, socket down")
                    self._diag_bump("tts_silent_generations")
                    await self._complete_one_request()
                    continue
                self._turn_done.clear()
                self._request_active = True
                # Chars are OUR side of the cost equation (Rs 0.50/1k), recorded
                # per request so the panel can cross-check the vendor's meter
                # against what we actually sent instead of trusting either alone.
                self._pending_chars = len(text)
                payload = {"text": text, "speaker": self._voice}
                if self._description:
                    payload["description"] = self._description
                await self._websocket.send(_json.dumps(payload))
                await self.start_tts_usage_metrics(text)
            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.error("rumik: send failed: %s", e)
                self._request_active = False
                self._turn_done.set()
                self._diag_bump("tts_wedges")
                await self._complete_one_request()
            finally:
                self._send_queue.task_done()

    async def _mint(self):
        """One-shot session token. Separate HTTP call, so it is the one place a
        network hiccup can delay first audio — kept tight at 10s."""
        import aiohttp
        async with aiohttp.ClientSession() as sess:
            async with sess.post(
                    self.MINT_URL,
                    headers={"Authorization": f"Bearer {self._api_key}"},
                    json={"model": self._model, "text": "warmup"},
                    timeout=aiohttp.ClientTimeout(total=10)) as r:
                if r.status != 200:
                    raise RuntimeError(f"rumik mint {r.status}: {(await r.text())[:200]}")
                return await r.json()

    # ── barge-in ──
    async def _handle_interruption(self, frame, direction):
        """Cancel the in-flight request; NEVER tear the socket down.

        Deliberately does NOT call super(): InterruptibleTTSService's version is
        `if self._bot_speaking: await self._disconnect(); await self._connect()`,
        which closes the socket and re-mints — the exact close-and-reconnect path
        this vendor was chosen to avoid, and it runs BEFORE any cancel we send, so
        the cancel became dead code. Traced: bot_speaking=True gave
        [DISCONNECT, MINT+CONNECT] and cancel_sent=False. So we call TTSService's
        version directly (aggregator/filter reset only) and handle the socket here.

        The quiet-bot case is left ALONE on purpose. pipecat pushes an
        InterruptionFrame on every VAD onset while the bot is silent, and our own
        measurement says 60 of 63 such pre-playout kills went on to play anyway.
        Cancelling there would turn a cough or a "hmm" into a lost answer the LLM
        believes it delivered.
        """
        from websockets.protocol import State
        await TTSService._handle_interruption(self, frame, direction)
        self._interruptions_seen += 1
        if not self._bot_speaking:
            return
        # Drop anything still queued for the abandoned reply, and zero the
        # outstanding count in one step — the whole reply is gone, so the
        # per-request decrements will never arrive.
        while not self._send_queue.empty():
            try:
                self._send_queue.get_nowait()
                self._send_queue.task_done()
            except asyncio.QueueEmpty:
                break
        self._pending_sends = 0
        if (self._request_active and self._websocket
                and self._websocket.state is State.OPEN):
            try:
                import json as _json
                await self._websocket.send(_json.dumps({"type": "cancel"}))
                self._cancels_sent += 1
                self._diag_bump("barge_in_cancels")
            except Exception as e:
                logger.warning("rumik: cancel failed: %s", e)
        # AFTER the cancel branch, not before: the receive loop drops binary while
        # this is False, and clearing it earlier would discard the audio of a reply
        # the quiet-window early-return above means to preserve.
        self._request_active = False
        self._started = False
        self._turn_done.set()

    # ── synthesis ──
    async def run_tts(self, text: str):
        """Enqueue one sentence. Returns immediately — the sender loop serialises.

        Nothing here may block: pipecat calls this from the pipeline task, and
        awaiting a previous request's completion inline would delay the
        InterruptionFrame that stops the bot talking over the caller.
        """
        from pipecat.frames.frames import ErrorFrame, TTSStartedFrame
        from websockets.protocol import State
        # Letterless input is not speech; same guard as Sarvam (has_word_char).
        if not has_word_char(text):
            logger.info("rumik: skipping letterless chunk %r", (text or "")[:40])
            self._diag_bump("tts_letterless_skipped")
            return
        try:
            if not self._websocket or self._websocket.state is not State.OPEN:
                await self._connect()
            if not self._websocket:
                yield ErrorFrame(error="rumik: no connection")
                return
            if not self._started:
                await self.start_ttfb_metrics()
                yield TTSStartedFrame()
                self._started = True
                # Stamp on SEND, never on `done`. A stamp that lands after the
                # audio makes the stall condition unreachable by construction.
                if self._on_generate is not None:
                    try:
                        self._on_generate()
                    except Exception:
                        pass
                self._diag_bump("replies_generated")
            self._pending_sends += 1
            await self._send_queue.put(text)
        except Exception as e:
            logger.error("rumik run_tts failed: %s", e)
            self._diag_bump("tts_wedges")
            yield ErrorFrame(error=f"rumik error: {e}")
            await self._disconnect()
