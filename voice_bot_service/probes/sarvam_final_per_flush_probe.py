"""Does Sarvam send exactly one "final" per flush, in order, when flushes go back to back?

The per-sentence flush fix (Sarvam + speech cache) files each sentence's audio under the
playing context and closes it on "final". That only works if every flush gets its own
final, after that sentence's audio and before the next sentence's audio.
"""
import asyncio
import base64
import json
import os
import time

import websockets

KEY = os.environ["SARVAM_API_KEY"]
MODELS = {
    "v4": ("bulbul:v4-flash", "ishita_enhi_customer", "en-IN"),
    "v3": ("bulbul:v3", "simran", "hi-IN"),
}
CASES = {
    "two_back_to_back": ["आमतौर पर कम marks आने के दो-तीन कारण होते हैं।",
                         "क्या आपको लगता है कि ऋषभ के साथ भी ऐसा हो रहा है?"],
    "short_then_long": ["एक सेकंड।", "Class में तीस-पैंतीस बच्चों के बीच कुछ बच्चों के concepts clear नहीं हो पाते।"],
    "three_mixed": ["Hmm…", "जी सर, मैं सुन रही हूँ।", "आप बताइए, बच्चा अभी किस class में है?"],
    "five_burst": ["जी।", "ठीक है।", "आमतौर पर कम marks आने के दो-तीन कारण होते हैं।", "एक सेकंड।",
                   "क्या आपको लगता है कि ऋषभ के साथ भी ऐसा हो रहा है?"],
}


async def run(name, case, texts, gap):
    model, voice, lang = MODELS[name]
    url = f"wss://api.sarvam.ai/text-to-speech/ws?model={model}&send_completion_event=true"
    cfg = {"target_language_code": lang, "speaker": voice, "speech_sample_rate": "8000",
           "enable_preprocessing": True, "min_buffer_size": 30, "max_chunk_length": 150,
           "output_audio_codec": "linear16", "output_audio_bitrate": "128k", "pace": 1.04,
           "model": model, "temperature": 0.9}
    events = []
    async with websockets.connect(url, additional_headers={"api-subscription-key": KEY}) as ws:
        await ws.send(json.dumps({"type": "config", "data": cfg}))
        t0 = time.time()
        for i, t in enumerate(texts):
            await ws.send(json.dumps({"type": "text", "data": {"text": t}}))
            await ws.send(json.dumps({"type": "flush"}))
            events.append((round(time.time() - t0, 3), f"SEND{i}"))
            if gap:
                await asyncio.sleep(gap)
        finals = 0
        try:
            while finals < len(texts):
                m = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
                ts = round(time.time() - t0, 3)
                if m.get("type") == "audio":
                    secs = len(base64.b64decode(m["data"]["audio"])) / 2 / 8000
                    rid = m.get("data", {}).get("request_id", "")
                    events.append((ts, f"audio{secs:.2f}s:{rid[-6:]}"))
                elif m.get("type") == "event":
                    finals += m.get("data", {}).get("event_type") == "final"
                    events.append((ts, "EVENT:" + json.dumps(m.get("data"))[:80]))
                else:
                    events.append((ts, json.dumps(m)[:100]))
        except asyncio.TimeoutError:
            events.append(("timeout", f"finals={finals}"))
    n_final = sum(1 for _, e in events if e.startswith("EVENT") and '"final"' in e)
    print(f"CASE,{name},{case},gap={gap},sent={len(texts)},finals={n_final}", flush=True)
    # Compress runs of audio chunks between markers.
    out, run_n, run_s = [], 0, 0.0
    for ts, e in events:
        if e.startswith("audio"):
            run_n += 1
            run_s += float(e[5:e.index("s:")])
            continue
        if run_n:
            out.append(f"[{run_n} chunks {run_s:.2f}s]")
            run_n, run_s = 0, 0.0
        out.append(f"{ts}:{e}")
    if run_n:
        out.append(f"[{run_n} chunks {run_s:.2f}s]")
    print("  SEQ " + " | ".join(out), flush=True)


async def main():
    for name in ("v4", "v3"):
        for case, texts in CASES.items():
            for gap in (0, 0.3):
                try:
                    await run(name, case, texts, gap)
                except Exception as e:  # noqa: BLE001
                    print(f"ERR,{name},{case},{type(e).__name__}: {str(e)[:150]}", flush=True)


asyncio.run(main())
