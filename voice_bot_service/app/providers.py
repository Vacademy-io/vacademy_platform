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


def _register_saaras_v4() -> bool:
    """Teach pipecat 1.4 about saaras:v4 (our production STT model).

    1.4's MODEL_CONFIGS table stops at saaras:v3 and REJECTS anything else with
    ValueError("Unsupported model") — which would crash build_stt on every call.
    Caught by the migration dry-run, never by a test.

    This is a DATA entry, not a behaviour patch: v4 is v3's capability shape
    (language pin + mode + server VAD params on the transcribe endpoint), which
    is exactly what we proved in production for a month via the 0.0.95 socket
    shim. Downgrading instead is worse: saaras:v3 garbled code-switched Hinglish
    ("Myapolicil tme we face") and saarika:v2.5 transliterated English callers
    into Devanagari and went deaf on a live call.

    Returns True when v4 is registered/known; False means we must fall back.
    """
    try:
        from pipecat.services.sarvam import stt as _sarvam_stt
        configs = _sarvam_stt.MODEL_CONFIGS
        if "saaras:v4" in configs:
            return True
        base = configs.get("saaras:v3")
        if base is None:
            return False
        import dataclasses
        configs["saaras:v4"] = dataclasses.replace(base)
        logger.info("stt: registered saaras:v4 with pipecat (v3 capability shape)")
        return True
    except Exception:
        logger.exception("stt: could not register saaras:v4 — falling back to v3")
        return False


def build_stt(sample_rate: int, language: str | None = None, bias: str | None = None,
              mode: str | None = None):
    """STT factory with an A/B provider switch (STT_PROVIDER=sarvam|google).

    Why the switch exists: across the founder's four 2026-08-05 test calls the
    chronic offender was Saaras — interjections the VAD heard but STT never
    transcribed (the "gap"), 3.8-4.4s finals, mid-phrase fragment splits, and
    garbage like "जी, चॉपी अच्छा". Google STT (same GCP project as the Vertex
    LLM, streaming v2 with INTERIM results — which Sarvam never sends) is the
    comparison arm. Flip per call via the env; nothing else changes.

    pipecat 1.4 note: Sarvam mode/language/prompt/high-vad are NATIVE now
    (settings=), so the 0.0.95 socket-proxy shim era is over. ttfs_p99_latency
    matters: the Smart Turn stop strategy HOLDS the user turn for
    max(0, ttfs_p99 - vad_stop) waiting for a final (Sarvam never flags
    finalized=True). The pipecat default 1.17 adds ~1s of dead air per turn —
    the POC ships 0.5.
    """
    s = get_settings()
    if s.stt_provider == "google":
        from pipecat.services.google.stt import GoogleSTTService
        langs = []
        for t in ((language or s.google_stt_language) or "hi-IN").split(","):
            t = t.strip()
            if not t:
                continue
            try:
                from pipecat.transcriptions.language import Language
                langs.append(Language(t))
            except Exception:
                logger.warning("build_stt: unknown google language tag %r", t)
        creds = s.vertex_credentials_json.strip() or None
        return GoogleSTTService(
            credentials=creds,
            credentials_path=(s.vertex_credentials_path.strip() or None) if not creds else None,
            location=s.google_stt_location,
            sample_rate=sample_rate,
            params=GoogleSTTService.InputParams(
                languages=langs or None,
                model=s.google_stt_model,
                enable_automatic_punctuation=True,
                # Interims give the turn-stop strategy real-time evidence and let
                # the turn-gate see words sooner than Sarvam ever could.
                enable_interim_results=True,
            ),
        )
    # ── Sarvam (default) ──
    mode = (mode or s.sarvam_stt_mode or "transcribe").strip()
    stt_model = (s.sarvam_stt_model or "").strip()
    # saaras:v4 is not in pipecat 1.4's model table; register it (v3's capability
    # shape) or fall back to v3 rather than raising on every call.
    if "v4" in stt_model and not _register_saaras_v4():
        logger.warning("stt: saaras:v4 unavailable on this pipecat — using saaras:v3")
        stt_model = "saaras:v3"
    tag = language or s.sarvam_stt_language
    # ASK pipecat what this model accepts instead of guessing. 1.4 raises on any
    # unsupported field ("does not support prompt parameter"), and the families
    # differ in BOTH directions: saaras:v2.5 takes a prompt but no language;
    # saaras:v3/v4 take language + mode + server VAD params but NO prompt;
    # saarika takes language only. Guessing here cost a whole dry-run cycle.
    caps = None
    try:
        from pipecat.services.sarvam import stt as _sarvam_stt
        caps = _sarvam_stt.MODEL_CONFIGS.get(stt_model)
    except Exception:
        pass

    def _supports(field: str, default: bool) -> bool:
        return bool(getattr(caps, f"supports_{field}", default)) if caps else default

    settings_kwargs = {"model": stt_model}
    if tag and _supports("language", True):
        # An unknown tag must not take high_vad down with it (deep-review B2),
        # hence the per-field guard.
        try:
            from pipecat.transcriptions.language import Language
            settings_kwargs["language"] = Language(tag)
        except Exception:
            logger.warning("build_stt: unknown language tag %r — auto-detect", tag)
    if bias and _supports("prompt", False):
        settings_kwargs["prompt"] = bias[:200]
    if s.sarvam_stt_high_vad and _supports("vad_params", False):
        settings_kwargs["high_vad_sensitivity"] = True
    try:
        stt_settings = SarvamSTTService.Settings(**settings_kwargs)
    except Exception:
        logger.warning("build_stt: Settings rejected %r — model only", settings_kwargs)
        stt_settings = SarvamSTTService.Settings(model=stt_model)
    return SarvamSTTService(
        api_key=s.sarvam_api_key,
        # Capability-gated, same reason as the settings above: saaras:v2.5 (a
        # documented SARVAM_STT_MODEL rollback target) has supports_mode=False
        # and 1.4 raises "does not support mode parameter" — that would have
        # crashed every call the moment anyone used the rollback.
        mode=mode if _supports("mode", False) else None,
        sample_rate=sample_rate,
        settings=stt_settings,
        ttfs_p99_latency=s.sarvam_ttfs_p99,
    )


def build_llm():
    s = get_settings()
    if s.llm_provider == "vertex":
        # Gemini on Vertex AI, served from vertex_location (asia-south1 = Mumbai):
        # in-country inference → low TTFT with no cross-ocean RTT. Auth = service
        # account JSON.
        #
        # THINKING MUST BE EXPLICITLY OFF. The comment that used to sit here said
        # "pipecat auto-disables Gemini thinking → the fast path". That was simply
        # untrue: InputParams.thinking defaults to None, pipecat sends no
        # thinkingConfig at all, and gemini-2.5-flash then applies its own DYNAMIC
        # thinking — it decides per request how long to reason before emitting a
        # first token.
        #
        # Which makes it a latency landmine, because it is a function of the
        # PROMPT. It cost 0.43s TTFB in the morning and 2.35s p50 / 5.76s p95 by
        # midday on 2026-08-06, with no LLM code change between — what changed was
        # that the system prompt grew richer (register rules, language rules, a
        # staged script with branching), so the model started thinking about it.
        #
        # Measured from the Mumbai box, same region, same model, idle host:
        #     thinking default : 2.16 / 2.43 / 2.55 s   (min/med/max of 3)
        #     thinking_budget=0: 0.37 / 0.51 / 0.91 s
        # 4.8x, for a scripted sales conversation that needs no reasoning at all.
        # Other regions were measured too and are all WORSE than Mumbai once
        # thinking is off (asia-southeast1 0.60, us-central1 0.62, global 0.82),
        # so the region was never the problem and does not change.
        from pipecat.services.google.llm import GoogleLLMService
        from pipecat.services.google.vertex.llm import GoogleVertexLLMService

        creds = s.vertex_credentials_json.strip() or None
        return GoogleVertexLLMService(
            credentials=creds,
            credentials_path=(s.vertex_credentials_path.strip() or None) if not creds else None,
            project_id=s.vertex_project_id,
            location=s.vertex_location,
            model=s.vertex_model,
            params=GoogleLLMService.InputParams(
                temperature=0.35, max_tokens=300,
                thinking=GoogleLLMService.ThinkingConfig(
                    thinking_budget=s.vertex_thinking_budget)),
        )
    if s.llm_provider == "google":
        # Gemini via its OpenAI-compat endpoint, hit directly (no proxy hop).
        # reasoning_effort 'none' via extra_body: 3.1 thinks by default.
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
        from pipecat.services.openrouter.llm import OpenRouterLLMService

        return OpenRouterLLMService(
            api_key=s.openrouter_api_key,
            model=s.openrouter_model,
            params=OpenRouterLLMService.InputParams(temperature=0.35, max_tokens=300),
        )
    # Sarvam's OpenAI-compatible chat API. reasoning_effort MUST be the literal
    # JSON null (Python None inside extra_body — the SDK drops None kwargs but
    # keeps them in extra_body): the ONLY value that disables hybrid thinking.
    # 0.14s median TTFT from Mumbai with null; 6-14s (or content=None) without.
    return OpenAILLMService(
        api_key=s.sarvam_api_key,
        base_url=s.sarvam_llm_base_url,
        model=s.sarvam_llm_model,
        params=OpenAILLMService.InputParams(
            temperature=0.35, max_tokens=300,
            extra={"extra_body": {"reasoning_effort": None}},
        ),
    )


def build_tts(sample_rate: int, voice: str | None = None, *, aiohttp_session=None,
              tts_model: str | None = None,
              pace: float | None = None, temperature: float | None = None):
    """TTS factory. `aiohttp_session` is accepted for call-site compatibility but
    unused on 1.4 (Sarvam's service owns its own websocket).

    pipecat 1.4 upgrades absorbed here: SarvamTTSService now has native
    reconnect/keepalive (the Resilient wrapper is gone), and InputParams carries
    pace/temperature/enable_preprocessing natively (the pace_override config
    injection is dead). Rumik stays a custom service — UNVERIFIED on 1.4 beyond
    construction; Sarvam is the production engine (founder decision 2026-08-05
    after Mulberry garbled phone-leg Hindi: प्रतिशत → "प्रतिलत")."""
    s = get_settings()
    model = (tts_model or s.tts_model or "").strip().lower()
    eff_pace = _clamp(pace if pace is not None else s.tts_pace, 0.5, 2.0)

    if model.startswith("google") or model.startswith("chirp"):
        # Google Cloud TTS — founder's pick by ear (Chirp3-HD), and measured
        # CHEAPER per call-minute than Sarvam (Rs 2.06 vs 2.34) with 1M
        # chars/month free. Auth reuses the Vertex service account: no new
        # vendor, no new secret, no new failure mode to learn.
        #
        # FALL THROUGH to Sarvam on ANY construction failure (missing creds is
        # the likely one — VERTEX_CREDENTIALS_* is per-deployment). A misconfig
        # must degrade to a working call in a different voice, never to the mute
        # call that the 1.4 signature drift already cost us once.
        try:
            from pipecat.services.google.tts import GoogleTTSService
            creds = s.vertex_credentials_json.strip() or None
            voice_id = (voice or s.google_tts_voice).strip() or s.google_tts_voice
            # Chirp3-HD ignores speaking_rate on some tiers but never errors on
            # it; Neural2/WaveNet honour it. Pass it either way (probe-verified).
            return GoogleTTSService(
                credentials=creds,
                credentials_path=(s.vertex_credentials_path.strip() or None) if not creds else None,
                voice_id=voice_id,
                sample_rate=s.google_tts_sample_rate,
                params=GoogleTTSService.InputParams(
                    language=_google_language(s.google_tts_language),
                    speaking_rate=_clamp(
                        eff_pace if pace is not None else s.google_tts_speaking_rate,
                        0.25, 4.0),
                ),
            )
        except Exception:
            logger.exception("tts: google TTS unavailable (creds?) — "
                             "falling back to Sarvam bulbul")

    if model.startswith("smallest") or model.startswith("lightning"):
        # Smallest.ai Lightning — Indian-language specialist, native pipecat
        # websocket service (so barge-in cancel comes for free).
        from pipecat.services.smallest.tts import SmallestTTSService
        if not s.smallest_api_key:
            logger.error("tts: SMALLEST_API_KEY unset — falling back to Sarvam bulbul")
        else:
            sm_model = s.smallest_model
            # An explicit "smallest:<model>" wins over the env default, so one
            # agent can run pro while others run standard.
            if ":" in model:
                cand = model.split(":", 1)[1].strip()
                if cand:
                    sm_model = cand if cand.startswith("lightning") else f"lightning_{cand}"
            sm_voice = (voice or s.smallest_voice).strip() or s.smallest_voice
            try:
                return _build_smallest(SmallestTTSService, s, sm_model, sm_voice,
                                       _clamp(eff_pace, 0.5, 2.0))
            except Exception:
                logger.exception("tts: smallest unavailable — falling back to Sarvam")
    if model.startswith("rumik") or model.startswith("silk"):
        if not s.rumik_api_key:
            logger.error("tts: RUMIK_API_KEY unset — falling back to Sarvam bulbul")
        else:
            return RumikTTSService(
                api_key=s.rumik_api_key,
                # Rumik emits 24 kHz ONLY; the output transport resamples to the
                # 8 kHz Plivo leg.
                sample_rate=24000,
                voice=(voice or s.rumik_voice).strip() or "ira",
                model="mulberry",
                description=rumik_pace_description(eff_pace),
            )
    kwargs = {"pace": eff_pace, "enable_preprocessing": True}
    if temperature is not None:
        kwargs["temperature"] = _clamp(temperature, 0.01, 2.0)
    if s.sarvam_tts_min_buffer > 0:
        # Sarvam's WS validation floor is 30 (20 = rejected config = silent call,
        # 2026-07-20 outage).
        kwargs["min_buffer_size"] = max(30, s.sarvam_tts_min_buffer)
    return SarvamTTSService(
        api_key=s.sarvam_api_key,
        model=s.sarvam_tts_model,
        voice_id=voice or s.sarvam_tts_voice,
        sample_rate=sample_rate,
        params=SarvamTTSService.InputParams(**kwargs),
    )


def _build_smallest(cls, s, model: str, voice: str, speed: float):
    """Construct Smallest.ai Lightning. Split out so build_tts can wrap it in one
    try/except: Lightning takes a REAL numeric speed multiplier (unlike Rumik,
    which only responds to prose), and its voice palettes are per-model — the API
    hard-rejects a cross-model voice, which is a mute call."""
    return cls(
        api_key=s.smallest_api_key,
        sample_rate=s.smallest_sample_rate,
        settings=cls.Settings(model=model, voice=voice,
                              language=_smallest_language(), speed=speed),
    )


def _google_language(tag: str):
    """BCP-47 tag → pipecat Language for Google TTS; None = let Google infer from
    the voice name (every hi-IN voice is locale-prefixed, so that is safe)."""
    try:
        from pipecat.transcriptions.language import Language
        return Language(tag)
    except Exception:
        logger.warning("tts: unknown google language tag %r — inferring from voice", tag)
        return None


def _smallest_language():
    """Lightning takes a language string; Hindi voices code-switch into English
    natively, so hi is right for Hinglish agents too."""
    try:
        from pipecat.transcriptions.language import Language
        return Language.HI
    except Exception:
        return None


def _clamp(v: float, lo: float, hi: float) -> float:
    try:
        return max(lo, min(hi, float(v)))
    except (TypeError, ValueError):
        return lo

_RUMIK_PACE_STYLES = (
    (1.15, "speaks extremely fast, rushed and hurried, clipped delivery, no pauses at all"),
    (1.05, "speaks rapidly with urgency, fast and energetic, no pauses"),
    (0.95, "speaks quickly and briskly, energetic and upbeat"),
    (0.85, "speaks at a brisk, upbeat conversational pace"),
    (0.75, None),   # Rumik's natural rate
)
_RUMIK_SLOW_STYLE = "speaks slowly and calmly, unhurried, with deliberate pauses"


def normalize_for_rumik(text: str, term_map=None) -> str:
    """Deterministic Devanagari→Latin replacement for terms Rumik mispronounces.

    The LLM transliterates English product terms into Devanagari when composing
    Hindi ("Live Classes" in the prompt → "लाइव क्लासेस" in the reply) and Rumik
    then speaks gibberish ("लव असेस" — heard on both founder test calls). Prompt
    rules failed to stop the transliteration twice, so this runs where it cannot
    be ignored: on the text actually sent for synthesis. Applied ONLY on the
    Rumik paths — transcripts, context, and Sarvam agents keep the written form.
    Map is longest-key-first (config guarantees the sort) so 'लाइव क्लासेस' wins
    over the bare 'क्लासेस'.
    """
    if not text:
        return text
    mapping = term_map if term_map is not None else get_settings().rumik_term_map
    for dev, latin in mapping:
        if dev in text:
            text = text.replace(dev, latin)
    return text


def rumik_pace_description(pace):
    """Prose that makes Rumik speak at the rate `pace` means on Sarvam."""
    if pace is None:
        return None
    for threshold, phrase in _RUMIK_PACE_STYLES:
        if pace >= threshold:
            return phrase
    return _RUMIK_SLOW_STYLE


async def rumik_synthesize_wav(text: str, voice: str, api_key: str,
                               session=None, model: str = "mulberry",
                               description: str | None = None) -> bytes:
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
    # Same term normalization as the live call, so the admin's audition never
    # sounds better than what the caller will hear.
    text = normalize_for_rumik(text)
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
            payload = {"text": text, "speaker": (voice or "ira").strip().lower()}
            # The preview MUST carry the same pace steering a call would, or the
            # admin auditions a delivery the caller never hears.
            if description:
                payload["description"] = description
            await ws.send_json(payload)
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
        # 1.4 validates that every settings field is initialized (None = "this
        # service does not support it"); leaving them NOT_GIVEN logs an ERROR on
        # every call and leaves the metrics model name blank.
        try:
            self._settings.voice = voice
            self._settings.language = None
        except Exception:
            pass
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
        # 1.4: set_model_name is gone — the model lives in self._settings.model
        # (synced to metrics); keep a plain model_name attr for our diagnostics.
        try:
            self._settings.model = f"silk-{model}"
            self._sync_model_name_to_metrics()
        except Exception:
            pass
        self.model_name = f"silk-{model}"
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
    async def run_tts(self, text: str, context_id: str | None = None):
        """1.4 calls ``run_tts(prepared_text, context_id)``; 0.0.95 passed text
        only. The mismatch made EVERY reply raise "takes 2 positional arguments
        but 3 were given" — a MUTE bot on the founder's first 1.4 call, with the
        error swallowed into an ErrorFrame the diagnostics never surfaced.
        context_id is accepted and unused: our sender loop is per-socket, and
        pipecat correlates frames itself via the id it passed in."""
        """Enqueue one sentence. Returns immediately — the sender loop serialises.

        Nothing here may block: pipecat calls this from the pipeline task, and
        awaiting a previous request's completion inline would delay the
        InterruptionFrame that stops the bot talking over the caller.
        """
        from pipecat.frames.frames import ErrorFrame, TTSStartedFrame
        from websockets.protocol import State
        # Devanagari-transliterated English terms → Latin BEFORE synthesis (the
        # 'लाइव क्लासेस' → 'लव असेस' class; see normalize_for_rumik).
        text = normalize_for_rumik(text)
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
