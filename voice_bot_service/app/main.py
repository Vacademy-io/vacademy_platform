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
import contextlib
import logging
import time
from urllib.parse import urlencode
from xml.sax.saxutils import escape

import aiohttp
from fastapi import APIRouter, FastAPI, Query, WebSocket
from fastapi.responses import PlainTextResponse

from . import admin_core
from .bot import CallOutcome, run_bot
from .config import get_settings
from .report import build_and_post_report

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("voice_bot")


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
    return {"status": "ok", "ws": s.wss_url("corr=<corr>")}


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
    from pipecat.runner.utils import parse_telephony_websocket
    from pipecat.serializers.plivo import PlivoFrameSerializer
    from pipecat.transports.network.fastapi_websocket import (
        FastAPIWebsocketParams,
        FastAPIWebsocketTransport,
    )

    await websocket.accept()

    corr = websocket.query_params.get("corr") or ""
    agent = websocket.query_params.get("agent") or "default"
    if not corr:
        logger.warning("ws: missing corr — closing")
        await websocket.close()
        return

    # Provider handshake first (Plivo sends a start event with stream/call ids).
    transport_type, call_data = await parse_telephony_websocket(websocket)
    stream_id = (call_data or {}).get("stream_id")
    call_uuid = (call_data or {}).get("call_id")
    logger.info("ws connected corr=%s transport=%s call=%s", corr, transport_type, call_uuid)

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
            vad_analyzer=SileroVADAnalyzer(),
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


app.include_router(router)
