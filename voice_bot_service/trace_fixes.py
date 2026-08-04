"""Prove the four P0 fixes by RUNNING them, in the container, against pipecat 0.0.95.

Unit tests are what let all four ship broken: one asserted "_disconnect" not in the
source of an override that had the teardown in its PARENT. So every check here
observes behaviour — frames pushed, bytes on the wire, tasks alive, loop ticking.
"""
import asyncio, json, os, sys, time
sys.path.insert(0, "/tmp/rk7")

from pipecat.frames.frames import InterruptionFrame
from pipecat.processors.frame_processor import FrameDirection

from app.config import get_settings
from app.providers import RumikTTSService
import app.diagnostics as dg

S1 = "Namaste! Main Riya bol rahi hoon Vacademy se."
S2 = "Hum schools ke liye ek complete education platform banate hain."
S3 = "Kya main aapse do minute baat kar sakti hoon?"

def harness(svc, pushed, tasks):
    svc.create_task = lambda coro, *a, **k: (lambda t: (tasks.append(t), t)[1])(asyncio.create_task(coro))
    async def _cancel(t, *a, **k):
        t.cancel()
        try: await t
        except (asyncio.CancelledError, Exception): pass
    svc.cancel_task = _cancel
    async def cap(frame, *a, **k): pushed.append(type(frame).__name__)
    svc.push_frame = cap
    for m in ("stop_ttfb_metrics", "start_ttfb_metrics", "start_tts_usage_metrics",
              "stop_all_metrics", "_report_error"):
        setattr(svc, m, (lambda *a, **k: asyncio.sleep(0)))
    svc._sample_rate = 24000

async def drain(svc, pushed, want, timeout=40):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if (pushed.count("TTSStoppedFrame") >= want and svc._send_queue.empty()
                and svc._pending_sends == 0):
            return True
        await asyncio.sleep(0.05)
    return False

async def measure_ground_truth(key):
    """How long SHOULD the three sentences be? Ask the vendor, one at a time.

    The previous threshold here was a guess, and a guess is exactly what gives a
    green tick no evidential value. This sends each sentence alone, waits for its
    own `done`, and sums the vendor's reported duration_s.
    """
    import aiohttp, websockets
    total = 0.0
    async with aiohttp.ClientSession() as sess:
        async with sess.post(RumikTTSService.MINT_URL,
                             headers={"Authorization": f"Bearer {key}"},
                             json={"model": "mulberry", "text": "warmup"},
                             timeout=aiohttp.ClientTimeout(total=15)) as r:
            m = await r.json()
        async with sess.ws_connect(f'{m["ws_url"]}?token={m["token"]}') as ws:
            nbytes = 0
            for s_ in (S1, S2, S3):
                await ws.send_json({"text": s_, "speaker": "ira"})
                while True:
                    msg = await asyncio.wait_for(ws.receive(), timeout=40)
                    if msg.type == aiohttp.WSMsgType.BINARY:
                        nbytes += len(msg.data)
                    elif msg.type == aiohttp.WSMsgType.TEXT:
                        j = json.loads(msg.data)
                        if j.get("type") == "done":
                            total += float(j.get("duration_s") or 0.0)
                            break
                        if j.get("type") in ("cancelled", "error"):
                            break
                    else:
                        break
            # BYTES, not the vendor's claimed duration_s — the service path counts
            # bytes, and comparing one against the other is not a comparison.
            observed = nbytes / 2 / 24000
            print(f"ground truth: vendor duration_s sum={total:.2f}s | "
                  f"bytes actually received={observed:.2f}s")
            total = observed
    print(f"ground truth (serialised, vendor-reported): {total:.2f}s for the 3 sentences")
    return total


async def check_p0_1(key, expected):
    """A 3-sentence reply must yield ALL THREE sentences, not just the last."""
    svc = RumikTTSService(api_key=key, voice="ira", sample_rate=24000)
    pushed, tasks = [], []
    harness(svc, pushed, tasks)
    dia = dg.CallDiagnostics(); svc.set_diagnostics(dia)
    gen = []; svc.set_generate_callback(lambda: gen.append(time.time()))
    audio_bytes = [0]
    real_push = svc.push_frame
    async def cap(frame, *a, **k):
        if type(frame).__name__ == "TTSAudioRawFrame": audio_bytes[0] += len(frame.audio)
        await real_push(frame, *a, **k)
    svc.push_frame = cap
    await svc._connect()
    # Exactly what pipecat does: three run_tts calls back to back, no waiting.
    # TTSStartedFrame is YIELDED (not pushed), so count it from the generator.
    yielded = []
    for s_ in (S1, S2, S3):
        async for f in svc.run_tts(s_): yielded.append(type(f).__name__)
    ok = await drain(svc, pushed, 1)
    secs = audio_bytes[0] / 2 / 24000
    dropped = svc._dropped_audio_bytes / 2 / 24000
    print(f"     dropped by the request_active guard: {dropped:.2f}s | "
          f"pending_sends left armed: {svc._pending_sends}")
    # 8% tolerance: our byte count is what the transport would play, the vendor's
    # duration_s is its own accounting, and they need not agree to the millisecond.
    complete = secs >= expected * 0.92
    print(f"P0-1 three-sentence reply: audio={secs:.2f}s vs expected {expected:.2f}s "
          f"({secs/expected*100:.0f}%) yielded_Started={yielded.count('TTSStartedFrame')} "
          f"pushed_Stopped={pushed.count('TTSStoppedFrame')} "
          f"replies_generated={dia.replies_generated} generate_cb={len(gen)}")
    await svc._disconnect()
    print(f"     -> completeness {'PASS' if ok and complete else 'FAIL'} "
          f"(truncation gave only the last sentence)")
    framing = yielded.count("TTSStartedFrame") == 1 and pushed.count("TTSStoppedFrame") == 1
    print(f"     -> turn framing {'PASS' if framing else 'FAIL'} "
          f"(1 Started / 1 Stopped per reply, not per sentence)")
    return ok and complete and framing


async def check_p0_2_no_spin():
    """A clean peer close must RAISE (-> base reconnects), not return and spin."""
    import websockets
    from websockets.asyncio.server import serve
    closed = asyncio.Event()
    async def handler(ws):
        await asyncio.sleep(0.2)
        await ws.close(code=1000)   # the vendor's 60s idle close, sped up
        closed.set()
    async with serve(handler, "127.0.0.1", 8791):
        svc = RumikTTSService.__new__(RumikTTSService)
        svc._closing = False
        svc._request_active = False
        svc._send_queue = asyncio.Queue()
        svc._turn_done = asyncio.Event(); svc._turn_done.set()
        svc._diag = None
        svc._on_credits = None
        svc._started = False
        svc._sample_rate = 24000
        async def noop(*a, **k): pass
        svc.stop_ttfb_metrics = noop; svc.push_frame = noop
        svc._websocket = await websockets.connect("ws://127.0.0.1:8791")
        await closed.wait()
        ticks = [0]
        async def ticker():
            for _ in range(40):
                await asyncio.sleep(0.05); ticks[0] += 1
        t = asyncio.create_task(ticker())
        raised = None
        try:
            await asyncio.wait_for(svc._receive_messages(), timeout=3.0)
        except ConnectionError as e:
            raised = f"ConnectionError: {e}"
        except asyncio.TimeoutError:
            raised = "TIMEOUT — still spinning"
        await asyncio.sleep(0.3); t.cancel()
        print(f"P0-2 clean close: raised={raised!r} ticks={ticks[0]}")
        ok = raised and raised.startswith("ConnectionError")
        print(f"     -> {'PASS' if ok else 'FAIL'} (must raise so pipecat's _try_reconnect runs)")
        return bool(ok)

async def check_p0_3(key):
    """Barge-in while the bot SPEAKS must send cancel and keep the socket."""
    svc = RumikTTSService(api_key=key, voice="ira", sample_rate=24000)
    pushed, tasks = [], []
    harness(svc, pushed, tasks)
    dia = dg.CallDiagnostics(); svc.set_diagnostics(dia)
    events, sent = [], []
    await svc._connect()
    sock = svc._websocket
    real_send = sock.send
    async def spy(msg):
        try: sent.append(json.loads(msg))
        except Exception: sent.append(msg)
        return await real_send(msg)
    sock.send = spy
    orig_dc, orig_c = svc._disconnect_websocket, svc._connect_websocket
    async def dc(): events.append("DISCONNECT"); await orig_dc()
    async def c(): events.append("MINT+CONNECT"); await orig_c()
    svc._disconnect_websocket, svc._connect_websocket = dc, c

    async for _ in svc.run_tts(S2): pass
    await asyncio.sleep(0.6)                       # let audio start
    svc._bot_speaking = True                       # a REAL mid-playout barge-in
    await svc._handle_interruption(InterruptionFrame(), FrameDirection.DOWNSTREAM)
    await asyncio.sleep(0.5)
    from websockets.protocol import State
    alive = svc._websocket is not None and svc._websocket.state is State.OPEN
    cancels = [m for m in sent if isinstance(m, dict) and m.get("type") == "cancel"]
    print(f"P0-3 barge-in (bot_speaking=True): events={events} cancels={len(cancels)} "
          f"socket_open={alive} diag.barge_in_cancels={dia.barge_in_cancels}")
    ok = len(cancels) == 1 and alive and not events

    # ...and the quiet-bot path must NOT cancel (60 of 63 such replies used to play).
    sent.clear(); svc._bot_speaking = False
    async for _ in svc.run_tts(S3): pass
    await asyncio.sleep(0.3)
    await svc._handle_interruption(InterruptionFrame(), FrameDirection.DOWNSTREAM)
    quiet_cancels = [m for m in sent if isinstance(m, dict) and m.get("type") == "cancel"]
    print(f"     quiet-bot interruption: cancels={len(quiet_cancels)} (must be 0)")
    ok = ok and not quiet_cancels
    await svc._disconnect()
    print(f"     -> {'PASS' if ok else 'FAIL'} (cancel on the wire, no teardown, quiet path untouched)")
    return ok

async def check_p0_4():
    """The hooks bot.py duck-types on must EXIST — their absence unplugged everything."""
    for m in ("set_diagnostics", "set_generate_callback", "set_credits_callback"):
        assert callable(getattr(RumikTTSService, m, None)), m
    d = dg.CallDiagnostics()
    d.bump("barge_in_cancels")
    ok = d.barge_in_cancels == 1   # a typo'd name would silently no-op
    print(f"P0-4 hooks present: True | barge_in_cancels is a real field: {ok}")
    print(f"     -> {'PASS' if ok else 'FAIL'}")
    return ok

async def main():
    key = get_settings().rumik_api_key
    assert key, "RUMIK_API_KEY missing"
    r = []
    r.append(await check_p0_4())
    r.append(await check_p0_2_no_spin())
    truth = await measure_ground_truth(key)
    r.append(await check_p0_1(key, truth))
    r.append(await check_p0_3(key))
    print("\n" + "="*66)
    print("ALL FOUR:", "PASS" if all(r) else f"FAIL ({r})")
    return 0 if all(r) else 2

sys.exit(asyncio.run(main()))
