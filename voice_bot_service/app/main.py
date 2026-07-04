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
import logging
import os
import re
import time
from urllib.parse import urlencode
from xml.sax.saxutils import escape

import aiohttp
from fastapi import APIRouter, FastAPI, Query, Request, Response, WebSocket
from fastapi.responses import FileResponse, PlainTextResponse

from . import admin_core
from .bot import CallOutcome, run_bot
from .config import get_settings
from .report import build_and_post_report

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("voice_bot")

# Live-call admission control. The event loop is single-threaded, so a plain int
# read+increment with no intervening await is atomic — the /ws gate below relies
# on that. Tracks active /ws pipelines (the CPU-heavy resource), not /answer hits.
_active_calls = 0


def _capacity_left() -> bool:
    return _active_calls < get_settings().max_concurrent_calls


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    # One shared HTTP session for the process — SarvamTTSService requires an
    # aiohttp session (keyword-only, no default in the pinned pipecat).
    app.state.http_session = aiohttp.ClientSession()
    try:
        yield
    finally:
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


# Renderer uses /tts.mp3 (FreeSWITCH keys on the extension). /tts and /tts.wav stay
# as aliases but ALSO serve MP3 (audio/mpeg) — the content is what matters, and
# FreeSWITCH plays our WAV as silence.
@router.get("/tts")
@router.get("/tts.wav")
@router.get("/tts.mp3")
async def tts(
    request: Request,
    text: str = Query(..., max_length=4000),
    voice: str = Query(""),
    lang: str = Query("hi-IN"),
):
    """Natural-voice audio (MP3) for a piece of prompt text (IVR menus etc.), in the
    SAME Sarvam voice as the AI agent — so IVR prompts stop sounding like a foreign TTS
    reading Hindi. Plivo <Play>s this URL. Synthesized ONCE per (text, voice, lang) and
    cached to disk (a Docker volume), so playback on every subsequent call is free —
    IVR prompts are static, so there is no recurring TTS cost. Served via FileResponse
    for proper HTTP Range (206) support."""
    logger.info("tts req path=%s xff=%s ua=%r range=%s",
                request.url.path,
                request.headers.get("x-forwarded-for"),
                (request.headers.get("user-agent") or "")[:60],
                request.headers.get("range"))
    s = get_settings()
    speaker = (voice or s.sarvam_tts_voice).strip()
    model = s.sarvam_tts_model
    key = hashlib.sha1(
        f"mp3|{s.tts_prompt_sample_rate}|{model}|{speaker}|{lang}|{text}".encode()).hexdigest()
    path = os.path.join(s.tts_cache_dir, key + ".mp3")

    if not os.path.exists(path):
        audio = _TTS_MEM.get(key) or await _synth_audio(text, speaker, model, lang)
        if not audio:
            # Rare (Sarvam down + cold cache). Plivo skips a <Play> it can't fetch;
            # the GATHER's no-input branch recovers and it caches next time.
            return Response(status_code=502)
        try:
            os.makedirs(s.tts_cache_dir, exist_ok=True)
            tmp = f"{path}.{os.getpid()}.tmp"
            with open(tmp, "wb") as f:
                f.write(audio)
            os.replace(tmp, path)  # atomic: a concurrent reader never sees a partial file
        except Exception:
            logger.exception("tts: disk cache write failed")
            # Fall back to an in-memory body (no range support, but better than 502).
            return Response(content=audio, media_type="audio/mpeg")
        if len(_TTS_MEM) >= _TTS_MEM_MAX:
            _TTS_MEM.pop(next(iter(_TTS_MEM)))
        _TTS_MEM[key] = audio

    return FileResponse(path, media_type="audio/mpeg",
                        headers={"Cache-Control": "public, max-age=31536000"})


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
    # inject query params into the wss URL Plivo will connect to.
    ws_url = s.wss_url(urlencode({"corr": corr, "agent": agent, "inst": inst}))

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
    from pipecat.audio.vad.silero import SileroVADAnalyzer
    from pipecat.audio.vad.vad_analyzer import VADParams
    from pipecat.runner.utils import parse_telephony_websocket
    from pipecat.serializers.plivo import PlivoFrameSerializer
    from pipecat.transports.network.fastapi_websocket import (
        FastAPIWebsocketParams,
        FastAPIWebsocketTransport,
    )

    global _active_calls
    await websocket.accept()

    corr = websocket.query_params.get("corr") or ""
    agent = websocket.query_params.get("agent") or "default"
    if not corr:
        logger.warning("ws: missing corr — closing")
        await websocket.close()
        return

    # Admission control (authoritative backstop; /answer already turns most excess
    # away). The check + increment are adjacent with NO await between them, so on
    # the single-threaded event loop concurrent handshakes cannot both pass. Every
    # exit path below is inside the try/finally that releases the slot.
    s = get_settings()
    if _active_calls >= s.max_concurrent_calls:
        logger.warning("ws: at capacity (%d/%d) — closing corr=%s",
                       _active_calls, s.max_concurrent_calls, corr)
        await websocket.close()
        return
    _active_calls += 1

    call_uuid = None
    try:
        # Provider handshake first (Plivo sends a start event with stream/call ids).
        transport_type, call_data = await parse_telephony_websocket(websocket)
        stream_id = (call_data or {}).get("stream_id")
        call_uuid = (call_data or {}).get("call_id")
        logger.info("ws connected corr=%s transport=%s call=%s active=%d",
                    corr, transport_type, call_uuid, _active_calls)

        # Context BEFORE the pipeline — a call without persona/lead must not proceed.
        try:
            context = await admin_core.get_call_context(corr, agent)
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
                # stop_secs below the 0.8 default: how much silence ends the caller's
                # turn — the single biggest chunk of perceived response latency.
                vad_analyzer=SileroVADAnalyzer(
                    params=VADParams(stop_secs=s.vad_stop_secs)
                ),
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
        # Release the admission slot on EVERY exit (context-fetch return, crash,
        # normal end, cancellation) — a leak here would silently shrink capacity.
        _active_calls -= 1


app.include_router(router)
