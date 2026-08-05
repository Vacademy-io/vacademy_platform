"""Vacademy AI voice-bot service — FastAPI entrypoint.

Endpoints (mirrors the validated POC server.py, productionized):
  GET  /health            — liveness + computed wss URL
  GET/POST /answer        — Plivo answer XML: [<Record recordSession>] + <Stream>
                            to our /ws + <Redirect> to admin_core's /plivo/ai-next
                            (handoff <Dial> or hangup). Stateless: everything it
                            needs rides the query string, placed there by
                            VacademyAiOutboundCaller (or the IVR renderer).
  WS   /ws                — the Plivo <Stream> audio socket; runs the Pipecat
                            pipeline, then builds + posts the end-of-call report.
"""
from __future__ import annotations

import asyncio
import base64
import contextlib
import hashlib
import hmac
import json
import logging
import os
import re
import time
from urllib.parse import urlencode
from xml.sax.saxutils import escape

import aiohttp
from fastapi import APIRouter, FastAPI, Query, Request, Response, WebSocket
from fastapi.responses import PlainTextResponse

from . import admin_core
from .bot import CallOutcome, run_bot
from .config import get_settings
from .providers import rumik_pace_description
from .report import build_and_post_report, report_spool_sweeper

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("voice_bot")

# Live-call admission control. The event loop is single-threaded, so a plain int
# read+increment with no intervening await is atomic — the /ws gate below relies
# on that. Tracks active /ws pipelines (the CPU-heavy resource), not /answer hits.
_active_calls = 0
# Sockets accepted but still in the telephony handshake (pre-pipeline). Counted
# SEPARATELY from _active_calls so a flood of stalled handshakes (an attacker who
# connects and never sends the Plivo start event) is bounded on its own and can't
# consume the running-call budget legit calls need (deep-review W3).
_inflight_handshakes = 0


def _capacity_left() -> bool:
    return _active_calls < get_settings().max_concurrent_calls


def _warm_llm() -> None:
    """Import + construct the LLM service once at startup, OFF the event loop.
    On Vertex the constructor performs a synchronous service-account OAuth
    (~1-2s of pure loop blocking when done per-call at answer time — audible as
    garble on concurrent calls). Runs in a thread so /health stays responsive
    while the heavy pipecat/google-auth imports load."""
    from .providers import build_llm
    build_llm()


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    # One shared HTTP session for the process — SarvamTTSService requires an
    # aiohttp session (keyword-only, no default in the pinned pipecat).
    app.state.http_session = aiohttp.ClientSession()

    async def _warm():
        try:
            await asyncio.to_thread(_warm_llm)
            logger.info("lifespan: LLM provider pre-warmed")
        except Exception:
            logger.exception("lifespan: LLM pre-warm failed (non-fatal)")

    # Background on purpose: pre-warm and the spool sweeper must not delay
    # startup (the probe window) or block /answer for live traffic.
    app.state.warm_task = asyncio.create_task(_warm())
    app.state.spool_task = asyncio.create_task(report_spool_sweeper())
    try:
        yield
    finally:
        for t in (app.state.warm_task, app.state.spool_task):
            t.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await t
        await app.state.http_session.close()


app = FastAPI(title="Vacademy AI Voice Bot", lifespan=lifespan)

# Served under the shared cluster host at /voice-bot-service (same pattern as
# /ai-service): the ingress forwards the FULL path, so every route carries the
# prefix. PUBLIC_BASE must include it too.
router = APIRouter(prefix="/voice-bot-service")


@router.get("/health")
async def health():
    s = get_settings()
    return {
        "status": "ok",
        "activeCalls": _active_calls,
        "maxConcurrentCalls": s.max_concurrent_calls,
        "ws": s.wss_url("corr=<corr>"),
    }


_SARVAM_TTS_URL = "https://api.sarvam.ai/text-to-speech"
_TTS_MEM: dict[str, bytes] = {}   # small hot cache in front of the disk cache
_TTS_MEM_MAX = 128


def _tts_chunks(text: str, limit: int = 450) -> list[str]:
    """Split on sentence boundaries so each Sarvam input stays within its limit."""
    parts = re.split(r"(?<=[.!?।])\s+", text.strip())
    out, cur = [], ""
    for p in parts:
        if cur and len(cur) + len(p) + 1 > limit:
            out.append(cur)
            cur = p
        else:
            cur = f"{cur} {p}".strip()
    if cur:
        out.append(cur)
    return out or [text[:limit]]


async def _synth_chunk(session, chunk: str, speaker: str, model: str, lang: str, sample_rate: int):
    body = {
        "inputs": [chunk],
        "target_language_code": lang,
        "speaker": speaker,
        "model": model,
        "speech_sample_rate": sample_rate,
        # MP3, not WAV: FreeSWITCH (Plivo's media engine, UA mod_httapi) fetched our
        # valid 8 kHz WAV and still played SILENCE — its <Play> is picky about WAV
        # containers, but plays MP3 reliably. MP3 is also the telephony default.
        "output_audio_codec": "mp3",
    }
    async with session.post(_SARVAM_TTS_URL, json=body,
                            headers={"api-subscription-key": get_settings().sarvam_api_key},
                            timeout=aiohttp.ClientTimeout(total=20)) as resp:
        if resp.status != 200:
            logger.warning("tts: sarvam %s for %r", resp.status, chunk[:40])
            return None
        data = await resp.json()
    return data.get("audios") or []


async def _synth_audio(text: str, speaker: str, model: str, lang: str) -> bytes | None:
    """Sarvam Bulbul REST → one MP3. Returns None on failure so the caller can fall
    back to Plivo's built-in TTS. Chunks synthesize CONCURRENTLY (cold latency is one
    Sarvam round-trip, not the sum); MP3 frames concatenate by raw byte join and play
    back-to-back, so no container surgery is needed."""
    s = get_settings()
    session: aiohttp.ClientSession = app.state.http_session
    chunks = _tts_chunks(text)
    try:
        # 44.1 kHz (not the 8 kHz call rate) → MPEG-1 MP3, the only profile Plivo plays.
        results = await asyncio.gather(
            *[_synth_chunk(session, c, speaker, model, lang, s.tts_prompt_sample_rate)
              for c in chunks])
    except Exception:
        logger.exception("tts: sarvam call failed")
        return None
    if any(r is None for r in results):
        return None
    out = b"".join(base64.b64decode(b64) for audios in results for b64 in audios)
    return out or None


def _prompt_key(text: str) -> str:
    """Stable id for a prompt's audio — the ADMIN-CORE renderer computes the identical
    SHA-1(text) to build the clean play URL, so both sides agree with no shared state.
    IVR uses one voice/rate, so the text alone is a sufficient key."""
    return hashlib.sha1(text.encode("utf-8")).hexdigest()


async def _ensure_cached(text: str, voice: str, lang: str) -> str | None:
    """Ensure {cache}/{sha1(text)}.mp3 exists (44.1 kHz MPEG-1); return its path or None."""
    s = get_settings()
    speaker = (voice or s.sarvam_tts_voice).strip()
    path = os.path.join(s.tts_cache_dir, _prompt_key(text) + ".mp3")
    if os.path.exists(path):
        return path
    audio = await _synth_audio(text, speaker, s.sarvam_tts_model, lang)
    if not audio:
        return None
    try:
        os.makedirs(s.tts_cache_dir, exist_ok=True)
        tmp = f"{path}.{os.getpid()}.tmp"
        with open(tmp, "wb") as f:
            f.write(audio)
        os.replace(tmp, path)  # atomic: a concurrent reader never sees a partial file
    except Exception:
        logger.exception("tts: disk cache write failed")
        return None
    await _evict_tts_cache_async()
    return path


def _serve_audio(path: str, media_type: str, *, touch: bool = False) -> Response:
    """Same delivery contract as _serve_mp3 (full-body 200, LRU touch, 404 on an
    eviction race) for a non-mp3 container. Rumik previews are WAV because Rumik
    streams raw PCM and we carry no mp3 encoder."""
    return _serve_mp3(path, touch=touch, media_type=media_type)


def _serve_mp3(path: str, *, touch: bool = False, media_type: str = "audio/mpeg") -> Response:
    # Plain 200 with the FULL body (NOT FileResponse/206): FreeSWITCH's mod_httapi
    # fetches the whole file and plays SILENCE on a 206 partial response. Content is a
    # 44.1 kHz MPEG-1 MP3 (the only profile Plivo's decoder plays).
    # touch=True bumps mtime so the eviction sweep is a TRUE LRU: a prompt played
    # on live IVR calls stays "recent" and outlives write-once junk — without this
    # the oldest files ARE the warmed IVR prompts, which eviction would delete
    # first, 404-ing the play route with no re-synthesis path (deep-review W3).
    if touch:
        # Best-effort LRU bump — NEVER fail the serve on it: a readable file on a
        # read-only/ownership-degraded volume (EROFS/EPERM/EIO) must still play,
        # not 500 (that would reintroduce the outage the 404 guard below removes,
        # exactly in the disk-trouble conditions eviction exists for — round-2).
        with contextlib.suppress(OSError):
            os.utime(path, None)
    try:
        with open(path, "rb") as f:
            body = f.read()
    except FileNotFoundError:
        # Raced by the eviction thread between the caller's exists-check and here;
        # a 404 lets Plivo fall through to its <Speak> fallback rather than 500.
        return Response(status_code=404)
    return Response(content=body, media_type=media_type,
                    headers={"Cache-Control": "public, max-age=31536000",
                             "Content-Length": str(len(body))})


@router.get("/tts/{token}.mp3")
async def tts_by_token(request: Request, token: str):
    """The URL the renderer gives Plivo: a CLEAN .mp3 path with NO query string, so
    FreeSWITCH's extension-based format detection sees ".mp3". Serves the pre-warmed
    file; 404 if it was never synthesized (warm-on-save populates it)."""
    logger.info("tts play token=%s xff=%s ua=%r range=%s",
                token, request.headers.get("x-forwarded-for"),
                (request.headers.get("user-agent") or "")[:40], request.headers.get("range"))
    path = os.path.join(get_settings().tts_cache_dir, os.path.basename(token) + ".mp3")
    if not os.path.exists(path):
        return Response(status_code=404)
    # touch: this is the LIVE IVR play route — every serve marks the prompt recent.
    return _serve_mp3(path, touch=True)


# By-text route: used by warm-on-save (and on-demand). Caches under sha1(text) so the
# clean /tts/{token}.mp3 play route finds it.
@router.get("/tts")
@router.get("/tts.wav")
@router.get("/tts.mp3")
async def tts(
    request: Request,
    text: str = Query(..., max_length=4000),
    voice: str = Query(""),
    lang: str = Query("hi-IN"),
):
    """Natural-voice audio (44.1 kHz MPEG-1 MP3) for a prompt, in the SAME Sarvam voice
    as the AI agent. Synthesized ONCE per text and cached to disk (a Docker volume), so
    playback is free — IVR prompts are static, no recurring TTS cost."""
    logger.info("tts synth path=%s text=%r", request.url.path, text[:40])
    path = await _ensure_cached(text, voice, lang)
    if not path:
        return Response(status_code=502)
    return _serve_mp3(path)


def _cache_write(path: str, data: bytes) -> bool:
    """Atomic cache write; False means "serve inline instead" (never 500)."""
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        tmp = f"{path}.{os.getpid()}.tmp"
        with open(tmp, "wb") as f:
            f.write(data)
        os.replace(tmp, path)
        return True
    except Exception:
        logger.exception("preview: cache write failed")
        return False


def _google_tts_mp3(text: str, voice: str, pace: float) -> bytes:
    """One-shot Google Cloud TTS -> MP3. Blocking client, so callers push it to a
    thread. Deliberately NOT reusing the pipecat service: that is a pipeline
    component whose lifecycle assumes a live call.

    44.1 kHz on purpose: Plivo only plays MPEG-1 layer III, and 8 kHz forces
    MPEG-2.5 which it renders as SILENCE (the same trap the IVR /tts route hit)."""
    s = get_settings()
    try:
        from google.cloud import texttospeech
        from google.oauth2 import service_account
        raw = s.vertex_credentials_json.strip()
        if raw:
            creds = service_account.Credentials.from_service_account_info(json.loads(raw))
        else:
            creds = service_account.Credentials.from_service_account_file(
                s.vertex_credentials_path.strip() or "/etc/vertex-sa.json")
        client = texttospeech.TextToSpeechClient(credentials=creds)
        name = (voice or s.google_tts_voice).strip() or s.google_tts_voice
        # "hi-IN-Chirp3-HD-Achird" -> language "hi-IN"
        lang_code = "-".join(name.split("-")[:2]) if name.count("-") >= 2 else s.google_tts_language
        resp = client.synthesize_speech(
            input=texttospeech.SynthesisInput(text=text),
            voice=texttospeech.VoiceSelectionParams(language_code=lang_code, name=name),
            audio_config=texttospeech.AudioConfig(
                audio_encoding=texttospeech.AudioEncoding.MP3,
                sample_rate_hertz=44100,
                speaking_rate=max(0.25, min(4.0, pace)),
            ),
        )
        return resp.audio_content or b""
    except Exception:
        logger.exception("preview: google tts failed voice=%s", voice)
        return b""


async def _smallest_tts_wav(text: str, voice: str, model: str, pace: float) -> bytes:
    """One-shot Smallest.ai Lightning synthesis over its websocket -> WAV bytes.

    Protocol probe-verified 2026-08-05: one JSON message with flush=True returns
    base64 PCM chunks in `data.audio`, terminated by status="complete"."""
    import base64
    import io
    import wave
    s = get_settings()
    try:
        import websockets
    except ImportError:
        logger.error("preview: websockets missing for smallest")
        return b""
    pcm = bytearray()
    try:
        async with websockets.connect(
                "wss://api.smallest.ai/waves/v1/tts/live",
                additional_headers={"Authorization": f"Bearer {s.smallest_api_key}"},
                open_timeout=15) as ws:
            await ws.send(json.dumps({
                "text": text, "voice_id": (voice or s.smallest_voice).strip(),
                "model": model, "language": "hi",
                "sample_rate": s.smallest_sample_rate, "output_format": "pcm",
                "speed": max(0.5, min(2.0, pace)), "continue": False, "flush": True,
            }))
            while True:
                msg = await asyncio.wait_for(ws.recv(), timeout=20)
                if isinstance(msg, (bytes, bytearray)):
                    pcm += msg
                    continue
                ev = json.loads(msg)
                chunk = (ev.get("data") or {}).get("audio")
                if chunk:
                    pcm += base64.b64decode(chunk)
                status = ev.get("status")
                if status in ("complete", "error"):
                    if status == "error":
                        logger.warning("preview: smallest error %s", str(ev)[:200])
                    break
    except Exception:
        logger.exception("preview: smallest tts failed voice=%s model=%s", voice, model)
        return b""
    if not pcm:
        return b""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(s.smallest_sample_rate)
        w.writeframes(bytes(pcm))
    return buf.getvalue()


@router.get("/preview.mp3")
async def preview(
    text: str = Query(..., max_length=300),
    voice: str = Query(..., max_length=32),
    lang: str = Query("hi-IN", max_length=8),
    pace: float = Query(1.0, ge=0.5, le=2.0),
    temperature: float | None = Query(None, ge=0.01, le=2.0),
    model: str = Query("sarvam", max_length=24),
):
    """Voice tester for the admin AI-Agents editor: speak a short sample text in any
    Bulbul speaker at a chosen pace/expressiveness, so admins can A/B voices before
    saving an agent. SEPARATE from /tts on purpose: the IVR cache there is keyed by
    sha1(text) ALONE (the admin-core play URL depends on that contract — see
    VacademyAiAnswerUrls.ttsUrl), so previewing the same text in two voices through
    /tts would collide and corrupt IVR playback. Preview caches under its own
    voice+pace-aware key. Text is capped hard: this is a public endpoint spending
    Sarvam credits — cache + cap bound the cost (same exposure class as /tts)."""
    s = get_settings()
    # Route to the SAME engine the agent will use on a call. Without this the admin
    # auditions a Sarvam voice and the caller hears Rumik (or, for a Rumik voice
    # name, Sarvam 400s and the tester just fails) — an audition that lies about
    # what ships is worse than no audition.
    engine = (model or "").strip().lower()

    if engine.startswith("google") or engine.startswith("chirp"):
        # Google Cloud TTS audition. Chirp3-HD is the founder's pick; the voice
        # name IS locale-prefixed (hi-IN-Chirp3-HD-Achird), so no language param
        # is needed and a wrong-vendor name fails loudly instead of substituting.
        key = hashlib.sha1(
            f"pv|google|{voice}|{pace}|{text}".encode("utf-8")).hexdigest()
        path = os.path.join(s.tts_cache_dir, f"pv-{key}.mp3")
        if not os.path.exists(path):
            audio = await asyncio.to_thread(_google_tts_mp3, text, voice, pace)
            if not audio:
                return Response(status_code=502)
            if not _cache_write(path, audio):
                return Response(content=audio, media_type="audio/mpeg")
            await _evict_tts_cache_async()
        return _serve_mp3(path)

    if engine.startswith("smallest") or engine.startswith("lightning"):
        # Smallest.ai Lightning audition. Its palettes are PER-MODEL and the API
        # hard-rejects a cross-model voice, so pass the model through: an admin
        # auditioning a _pro voice must hit _pro, or the preview lies.
        if not s.smallest_api_key:
            logger.warning("preview: smallest requested but SMALLEST_API_KEY unset")
            return Response(status_code=503)
        sm_model = s.smallest_model
        if ":" in engine:
            cand = engine.split(":", 1)[1].strip()
            if cand:
                sm_model = cand if cand.startswith("lightning") else f"lightning_{cand}"
        key = hashlib.sha1(
            f"pv|{sm_model}|{voice}|{pace}|{text}".encode("utf-8")).hexdigest()
        # Lightning streams raw PCM over its websocket; wrap as WAV (same reason
        # as the Rumik path — no mp3 encoder in this image).
        path = os.path.join(s.tts_cache_dir, f"pv-{key}.wav")
        if not os.path.exists(path):
            raw = await _smallest_tts_wav(text, voice, sm_model, pace)
            if not raw:
                return Response(status_code=502)
            if not _cache_write(path, raw):
                return Response(content=raw, media_type="audio/wav")
            await _evict_tts_cache_async()
        return _serve_audio(path, "audio/wav")

    is_rumik = engine.startswith("rumik") or engine.startswith("silk") \
        or engine.startswith("mulberry")
    if is_rumik:
        if not s.rumik_api_key:
            logger.warning("preview: rumik requested but RUMIK_API_KEY unset")
            return Response(status_code=503)
        # pace MUST be in the cache key. Without it the first pace previewed for a
        # given voice+text is served forever, so moving the slider appears to do
        # nothing — which is indistinguishable from the steering being broken.
        pace_desc = rumik_pace_description(pace)
        key = hashlib.sha1(
            f"pv|rumik|{voice}|{pace_desc}|{text}".encode("utf-8")).hexdigest()
        # .wav, not .mp3: Rumik streams raw PCM and we do not carry an mp3 encoder.
        # The route name is historical; the Content-Type is what browsers obey.
        path = os.path.join(s.tts_cache_dir, f"pv-{key}.wav")
        if not os.path.exists(path):
            from .providers import rumik_synthesize_wav
            raw = await rumik_synthesize_wav(text, voice, s.rumik_api_key,
                                             session=app.state.http_session,
                                             description=pace_desc)
            if not raw:
                return Response(status_code=502)
            try:
                os.makedirs(s.tts_cache_dir, exist_ok=True)
                tmp = f"{path}.{os.getpid()}.tmp"
                with open(tmp, "wb") as f:
                    f.write(raw)
                os.replace(tmp, path)
            except Exception:
                logger.exception("preview: cache write failed")
                return Response(content=raw, media_type="audio/wav")
            await _evict_tts_cache_async()
        return _serve_audio(path, "audio/wav")
    key = hashlib.sha1(
        f"pv|{s.sarvam_tts_model}|{voice}|{lang}|{pace}|{temperature}|{text}".encode("utf-8")
    ).hexdigest()
    path = os.path.join(s.tts_cache_dir, f"pv-{key}.mp3")
    if not os.path.exists(path):
        session = app.state.http_session
        body = {
            "inputs": [text],
            "target_language_code": lang,
            "speaker": voice.strip().lower(),
            "model": s.sarvam_tts_model,
            "speech_sample_rate": s.tts_prompt_sample_rate,
            "output_audio_codec": "mp3",
            "pace": pace,
        }
        if temperature is not None:
            body["temperature"] = temperature
        try:
            async with session.post(_SARVAM_TTS_URL, json=body,
                                    headers={"api-subscription-key": s.sarvam_api_key},
                                    timeout=aiohttp.ClientTimeout(total=20)) as resp:
                if resp.status != 200:
                    detail = (await resp.text())[:200]
                    logger.warning("preview: sarvam %s voice=%s: %s", resp.status, voice, detail)
                    return Response(status_code=502)
                data = await resp.json()
        except Exception:
            logger.exception("preview: sarvam call failed")
            return Response(status_code=502)
        audios = data.get("audios") or []
        raw = b"".join(base64.b64decode(b64) for b64 in audios)
        if not raw:
            return Response(status_code=502)
        try:
            os.makedirs(s.tts_cache_dir, exist_ok=True)
            tmp = f"{path}.{os.getpid()}.tmp"
            with open(tmp, "wb") as f:
                f.write(raw)
            os.replace(tmp, path)
        except Exception:
            logger.exception("preview: cache write failed")
            return Response(content=raw, media_type="audio/mpeg")
        await _evict_tts_cache_async()
    return _serve_mp3(path)


# ── /ws admission token ──────────────────────────────────────────────────────
# /answer authors the wss URL Plivo connects to, so /answer mints a short-lived
# HMAC token that /ws verifies. This RAISES the bar on the open-socket hole
# (anyone who knew the path could hold all MAX_CONCURRENT_CALLS slots and burn
# Sarvam/LLM spend) with no admin_core change (key = VOICE_BOT_CLIENT_SECRET,
# already provisioned). It is NOT a complete DoS shield: /answer is public
# (Plivo must reach it) so an attacker can still mint tokens. Two further guards
# in /ws bound the residual: tokens are SINGLE-USE (one token → one socket, no
# replay amplification), and the capacity slot is claimed only AFTER a
# successful telephony handshake, with stalled pre-handshake sockets bounded by
# a SEPARATE cap so they can't starve the running-call budget (deep-review W3).
# Edge rate-limiting (Cloudflare/nginx on /answer + /ws) remains the real fix
# for a determined flood and is tracked as a follow-up.
_WS_TOKEN_TTL_SECS = 900.0  # Plivo connects within seconds of fetching the XML
# Signatures already spent, so a captured token can't be replayed across many
# sockets. Single-process service (the _active_calls int is relied on as atomic),
# so an in-memory set is authoritative; it resets on deploy (fine — tokens are
# minted seconds before use). Pruned opportunistically so it can't grow unbounded.
_spent_ws_tokens: dict = {}


def _mint_ws_token(corr: str, now: float | None = None) -> str:
    secret = get_settings().internal_client_secret
    exp = int((now if now is not None else time.time()) + _WS_TOKEN_TTL_SECS)
    sig = hmac.new(secret.encode(), f"{corr}|{exp}".encode(), hashlib.sha256).hexdigest()[:32]
    return f"{exp}.{sig}"


def _verify_ws_token(corr: str, token: str, now: float | None = None) -> bool:
    secret = get_settings().internal_client_secret
    if not secret:
        # Unconfigured secret = the service can't fetch call context either, so
        # nothing real runs; don't brick dev setups, just log once per connect.
        logger.warning("ws-token: VOICE_BOT_CLIENT_SECRET unset — token check skipped")
        return True
    try:
        exp_s, sig = token.split(".", 1)
        exp = int(exp_s)
    except (ValueError, AttributeError):
        return False
    if (now if now is not None else time.time()) > exp:
        return False
    want = hmac.new(secret.encode(), f"{corr}|{exp}".encode(), hashlib.sha256).hexdigest()[:32]
    return hmac.compare_digest(want, sig)


def _consume_ws_token(corr: str, token: str, now: float | None = None) -> bool:
    """Verify the token AND spend it — a second /ws carrying the same token is
    rejected, so one /answer fetch admits exactly one socket. No-op single-use
    when the secret is unset (dev)."""
    now = now if now is not None else time.time()
    if not _verify_ws_token(corr, token, now):
        return False
    if not get_settings().internal_client_secret:
        return True  # dev: verify already logged + returned True; nothing to spend
    key = f"{corr}|{token}"
    if key in _spent_ws_tokens:
        logger.warning("ws-token: replay rejected corr=%s", corr)
        return False
    # Opportunistic prune of expired signatures (bounded memory).
    if len(_spent_ws_tokens) > 2048:
        for k, exp in list(_spent_ws_tokens.items()):
            if exp < now:
                _spent_ws_tokens.pop(k, None)
    _spent_ws_tokens[key] = now + _WS_TOKEN_TTL_SECS
    return True


def _evict_tts_cache(cache_dir: str, max_files: int, max_bytes: int) -> int:
    """Bound the public-endpoint disk cache. Eviction order: voice-preview files
    ("pv-*", freely re-synthesizable) first, then least-recently-SERVED within
    each class — the play route bumps mtime on every serve (_serve_mp3 touch=True)
    so a live IVR prompt outlives write-once junk. IVR prompts have no re-synth
    path (the /tts/{token}.mp3 URL 404s until an admin re-saves), so protecting
    the actively-served ones is essential. Runs in a thread. Returns count."""
    try:
        scan = list(os.scandir(cache_dir))
    except FileNotFoundError:
        return 0  # cache dir not created yet — nothing to evict
    entries = []
    for e in scan:
        try:
            if e.is_file() and e.name.endswith(".mp3"):
                st = e.stat()
                entries.append((not e.name.startswith("pv-"), st.st_mtime, st.st_size, e.path))
        except FileNotFoundError:
            # A concurrent eviction/write unlinked this entry between scandir and
            # stat — skip it, do NOT abort the whole pass (a blanket except around
            # the loop mistook this for a missing dir and skipped eviction under
            # exactly the write pressure it defends against — deep-review W3).
            continue
    total = sum(sz for _, _, sz, _ in entries)
    if len(entries) <= max_files and total <= max_bytes:
        return 0
    entries.sort()
    evicted = 0
    while entries and (len(entries) > max_files or total > max_bytes):
        _, _, sz, path = entries.pop(0)
        try:
            os.remove(path)
            total -= sz
            evicted += 1
        except OSError:
            pass
    if evicted:
        logger.warning("tts cache: evicted %d oldest files (cap %d files / %d bytes)",
                       evicted, max_files, max_bytes)
    return evicted


async def _evict_tts_cache_async() -> None:
    s = get_settings()
    try:
        await asyncio.to_thread(
            _evict_tts_cache, s.tts_cache_dir, s.tts_cache_max_files, s.tts_cache_max_bytes)
    except Exception:
        logger.exception("tts cache: eviction failed")


@router.api_route("/answer", methods=["GET", "POST"], response_class=PlainTextResponse)
async def answer(
    corr: str = Query(...),
    agent: str = Query("default"),
    inst: str = Query(""),
    nxt: str = Query(""),
    rcb: str = Query(""),
):
    """Plivo fetches this when the callee answers. XML order matters:
    <Record recordSession> starts background full-session recording, <Stream>
    runs the conversation, and when the stream closes Plivo falls through to
    <Redirect> (handoff/hangup continuation served by admin_core)."""
    s = get_settings()

    # Admission control: at capacity, don't open a <Stream> we'd immediately have
    # to drop (a garbled/half-connected bot is worse than a clean fallback). Serve
    # a short apology + the <Redirect> so Plivo falls through to admin_core's
    # /plivo/ai-next (human handoff or hangup) exactly as a finished call would.
    if not _capacity_left():
        logger.warning("answer: at capacity (%d/%d) — serving busy fallback corr=%s",
                       _active_calls, s.max_concurrent_calls, corr)
        busy_redirect = f'<Redirect method="POST">{escape(nxt)}</Redirect>' if nxt else "<Hangup/>"
        busy_xml = (
            '<?xml version="1.0" encoding="UTF-8"?><Response>'
            "<Speak>Sorry, all our lines are busy right now. Please try again shortly.</Speak>"
            f"{busy_redirect}</Response>"
        )
        return PlainTextResponse(busy_xml, media_type="application/xml")

    # urlencode: agent/inst are institute-typed free text — '&'/'=' must not
    # inject query params into the wss URL Plivo will connect to. `tok` gates
    # /ws: only a socket carrying a fresh /answer-minted HMAC may run a pipeline.
    ws_url = s.wss_url(urlencode(
        {"corr": corr, "agent": agent, "inst": inst, "tok": _mint_ws_token(corr)}))

    record_el = (
        f'<Record recordSession="true" redirect="false" maxLength="3600" '
        f'callbackUrl="{escape(rcb)}" callbackMethod="POST"/>'
        if rcb else ""
    )
    redirect_el = f'<Redirect method="POST">{escape(nxt)}</Redirect>' if nxt else ""

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        "<Response>"
        f"{record_el}"
        f'<Stream bidirectional="true" keepCallAlive="true" '
        f'contentType="audio/x-mulaw;rate=8000">{escape(ws_url)}</Stream>'
        f"{redirect_el}"
        "</Response>"
    )
    logger.info("answer XML served corr=%s agent=%s record=%s", corr, agent, bool(rcb))
    return PlainTextResponse(xml, media_type="application/xml")


@router.websocket("/ws")
async def ws_endpoint(websocket: WebSocket):
    """One live call. Plivo connects here per the <Stream> URL; we wire the
    socket into Pipecat and run the conversation."""
    # Imported here so /health and /answer work even while heavy audio deps load.
    # pipecat 1.4: transports.network is gone (→ transports.websocket.fastapi),
    # and the VAD moved off the transport onto the user aggregator (bot.py owns
    # it now, with the telephony min_volume tuning).
    from pipecat.runner.utils import parse_telephony_websocket
    from pipecat.serializers.plivo import PlivoFrameSerializer
    from pipecat.transports.websocket.fastapi import (
        FastAPIWebsocketParams,
        FastAPIWebsocketTransport,
    )

    global _active_calls, _inflight_handshakes
    await websocket.accept()

    corr = websocket.query_params.get("corr") or ""
    agent = websocket.query_params.get("agent") or "default"
    if not corr:
        logger.warning("ws: missing corr — closing")
        await websocket.close()
        return

    # Single-use admission token minted by /answer (see _mint_ws_token). A socket
    # without a fresh, unspent token never reaches the handshake, the context
    # fetch, or a capacity slot — and a captured token admits exactly one socket.
    if not _consume_ws_token(corr, websocket.query_params.get("tok") or ""):
        logger.warning("ws: bad/missing/replayed admission token corr=%s — closing", corr)
        await websocket.close()
        return

    s = get_settings()
    # Pre-handshake admission: bound stalled handshakes separately from running
    # calls. Check + increment are adjacent (no await between) → atomic on the
    # single-threaded loop. The cap is generous (3× the call cap) so bursts of
    # real calls are never turned away here; it exists to cap a stall flood.
    pending_cap = s.max_concurrent_calls * 3 + 5
    if _inflight_handshakes >= pending_cap:
        logger.warning("ws: too many pending handshakes (%d/%d) — closing corr=%s",
                       _inflight_handshakes, pending_cap, corr)
        await websocket.close()
        return
    _inflight_handshakes += 1

    call_uuid = None
    _inflight_held = True
    _active_slot = False
    try:
        # Provider handshake first (Plivo sends a start event with stream/call ids).
        # Bounded: a client that connects and never sends the start event is dropped
        # here without ever consuming a running-call slot.
        try:
            transport_type, call_data = await asyncio.wait_for(
                parse_telephony_websocket(websocket), timeout=10.0)
        except asyncio.TimeoutError:
            logger.warning("ws: telephony handshake timeout corr=%s — closing", corr)
            await websocket.close()
            return

        # Handshake done → hand off from the pending bucket to a real call slot.
        # Adjacent check + increment (no await) keeps the slot count exact.
        _inflight_handshakes -= 1
        _inflight_held = False
        if _active_calls >= s.max_concurrent_calls:
            logger.warning("ws: at capacity (%d/%d) — closing corr=%s",
                           _active_calls, s.max_concurrent_calls, corr)
            await websocket.close()
            return
        _active_calls += 1
        _active_slot = True

        stream_id = (call_data or {}).get("stream_id")
        call_uuid = (call_data or {}).get("call_id")
        logger.info("ws connected corr=%s transport=%s call=%s active=%d",
                    corr, transport_type, call_uuid, _active_calls)

        # Context BEFORE the pipeline — a call without persona/lead must not proceed.
        try:
            _t0 = __import__("time").time()
            context = await admin_core.get_call_context(corr, agent)
            logger.info("setup timing corr=%s ctx_fetch=%.2fs", corr, __import__("time").time() - _t0)
        except Exception:
            logger.exception("ws: context fetch failed corr=%s — closing", corr)
            await websocket.close()
            return

        serializer = PlivoFrameSerializer(
        stream_id=stream_id,
        call_id=call_uuid,
        # auto_hang_up MUST stay off: the call has to SURVIVE the stream's end so
        # Plivo falls through to <Redirect> → admin_core /plivo/ai-next, which
        # serves the human-handoff <Dial> (or <Hangup/>). The default (True)
        # would API-kill the call on EndFrame and no handoff could ever happen.
            params=PlivoFrameSerializer.InputParams(auto_hang_up=False),
        )
        transport = FastAPIWebsocketTransport(
            websocket=websocket,
            params=FastAPIWebsocketParams(
                audio_in_enabled=True,
                audio_out_enabled=True,
                add_wav_header=False,
                # pipecat 1.4: NO vad_analyzer here — the VAD (with the telephony
                # min_volume=0.35 tuning from live call 8e1e00ad) lives on the
                # user aggregator in bot.run_bot, alongside Smart Turn v3.
                serializer=serializer,
            ),
        )

        # The outcome is owned HERE (not inside run_bot) so a mid-pipeline crash
        # still leaves a reportable object — a lost report strands the paused
        # workflow until its safety timeout.
        outcome = CallOutcome(corr=corr, context=context)
        try:
            await run_bot(transport, corr, context, outcome,
                          aiohttp_session=websocket.app.state.http_session)
        except Exception:
            # Marked on the outcome so the report is HONEST: a crash with no real
            # conversation must reach admin_core as "failed", not "no-answer" —
            # mapStatus stamps unknown/absent statuses COMPLETED on the call log
            # and the classifier would count a phantom connect (verified 2026-07-27).
            outcome.crashed = True
            logger.exception("ws: pipeline crashed corr=%s", corr)
        finally:
            if outcome.ended_at is None:  # crash before run_bot's own finally ran
                outcome.ended_at = time.time()
            try:
                # shield: if this WS coroutine is being cancelled (abrupt disconnect /
                # shutdown), the report task still runs to completion.
                await asyncio.shield(build_and_post_report(outcome, call_uuid))
            except Exception:
                logger.exception("ws: report failed corr=%s", corr)
    finally:
        # Release whichever bucket this socket still holds on EVERY exit
        # (handshake timeout, capacity reject, context-fetch return, crash, normal
        # end, cancellation) — a leak here would silently shrink capacity. Exactly
        # one of the two is held at any point after the pending increment.
        if _inflight_held:
            _inflight_handshakes -= 1
        if _active_slot:
            _active_calls -= 1


app.include_router(router)
