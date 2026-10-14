"""Does Sarvam speak a 9-character line ("एक सेकंड।") sent with a flush?

Live call c6847f91 (2026-10-14, bulbul:v4-flash): the watchdog's bridge line got NO
audio for 15.8 s and pipecat's TTS stayed paused behind it. This replays that shape on
one long-lived socket (pipecat keeps one per call and pings every 20 s), for v4 and v3.
"""
import asyncio
import base64
import json
import os
import time

import websockets

KEY = os.environ["SARVAM_API_KEY"]
LONG = ["आमतौर पर कम marks आने के दो-तीन कारण होते हैं।",
        "Class में तीस-पैंतीस बच्चों के बीच कुछ बच्चों के concepts clear नहीं हो पाते।",
        "क्या आपको लगता है कि ऋषभ के साथ भी ऐसा हो रहा है?"]
SHORTS = ["एक सेकंड।", "Just a second.", "एक सेकंड, मैं देख रही हूँ।"]
MODELS = {
    "v4": ("bulbul:v4-flash", "ishita_enhi_customer", "en-IN", 0.9),
    "v3": ("bulbul:v3", "simran", "hi-IN", 0.9),
}


class Sock:
    def __init__(self, ws):
        self.ws = ws
        self.q: asyncio.Queue = asyncio.Queue()
        self.task = asyncio.create_task(self._recv())

    async def _recv(self):
        try:
            async for raw in self.ws:
                self.q.put_nowait((time.time(), json.loads(raw)))
        except Exception as e:  # noqa: BLE001
            self.q.put_nowait((time.time(), {"type": "closed", "err": str(e)[:120]}))

    async def say(self, texts, wait=20.0):
        while not self.q.empty():
            self.q.get_nowait()
        t0 = time.time()
        for t in texts:
            await self.ws.send(json.dumps({"type": "text", "data": {"text": t}}))
        await self.ws.send(json.dumps({"type": "flush"}))
        first, secs, final, other = None, 0.0, None, []
        while time.time() - t0 < wait:
            try:
                ts, m = await asyncio.wait_for(self.q.get(), timeout=wait - (time.time() - t0))
            except asyncio.TimeoutError:
                break
            if m.get("type") == "audio":
                first = first if first is not None else round(ts - t0, 2)
                secs += len(base64.b64decode(m["data"]["audio"])) / 2 / 8000
            elif m.get("type") == "event" and m.get("data", {}).get("event_type") == "final":
                final = round(ts - t0, 2)
                break
            else:
                other.append(json.dumps(m)[:160])
        return f"first_audio={first} audio={round(secs, 2)}s final={final} other={other}"


async def session(name, min_buf, gap, short):
    model, voice, lang, temp = MODELS[name]
    url = f"wss://api.sarvam.ai/text-to-speech/ws?model={model}&send_completion_event=true"
    cfg = {"target_language_code": lang, "speaker": voice, "speech_sample_rate": "8000",
           "enable_preprocessing": True, "min_buffer_size": min_buf, "max_chunk_length": 150,
           "output_audio_codec": "linear16", "output_audio_bitrate": "128k", "pace": 1.04,
           "model": model, "temperature": temp}
    async with websockets.connect(url, additional_headers={"api-subscription-key": KEY}) as ws:
        await ws.send(json.dumps({"type": "config", "data": cfg}))
        s = Sock(ws)
        tag = f"{name},buf={min_buf},gap={gap}s,short={short!r}"
        if gap is None:
            print(f"SHORT,{tag},fresh-socket,{await s.say([short])}", flush=True)
            return
        print(f"LONG,{tag},{await s.say(LONG)}", flush=True)
        if gap >= 20:
            await ws.send(json.dumps({"type": "ping"}))
        await asyncio.sleep(gap)
        print(f"SHORT,{tag},after-reply,{await s.say([short])}", flush=True)
        print(f"AGAIN,{tag},{await s.say([short])}", flush=True)
        s.task.cancel()


async def main():
    for name in ("v4", "v3"):
        for min_buf in (30, 50):
            for short in SHORTS:
                for gap in (None, 3, 21):
                    try:
                        await session(name, min_buf, gap, short)
                    except Exception as e:  # noqa: BLE001
                        print(f"ERR,{name},{min_buf},{gap},{short!r},{type(e).__name__}: {str(e)[:160]}", flush=True)


asyncio.run(main())
