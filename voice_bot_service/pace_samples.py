"""Generate the pace ladder for the founder's ear, at real 8 kHz phone quality.

The open question is not speed — that is measured. It is whether steering Rumik
with prose changes WHO the voice sounds like, which no metric of mine can answer.
"""
import asyncio, audioop, base64, io, json, os, sys, time, wave
sys.path.insert(0, "/tmp/rkC")

from app.providers import rumik_pace_description

LINES = {
  "pitch": "Sir, hum schools ke liye ek complete education platform banate hain - admissions, fees, classes, sab kuch ek jagah.",
  "opening": "Namaste! Main Riya bol rahi hoon Vacademy se. Kya main aapse do minute baat kar sakti hoon?",
}

def to_wav(pcm, rate):
    b = io.BytesIO()
    with wave.open(b, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes(pcm)
    return b.getvalue()

def narrowband(pcm, src):
    out, _ = audioop.ratecv(pcm, 2, 1, src, 8000, None)
    return out

async def rumik(sess, key, text, desc):
    import aiohttp
    async with sess.post("https://silk-api.rumik.ai/v1/tts/ws-connect",
            headers={"Authorization": f"Bearer {key}"},
            json={"model": "mulberry", "text": text},
            timeout=aiohttp.ClientTimeout(total=20)) as r:
        m = await r.json()
    pcm = bytearray(); t0 = time.time(); ttfb = None; dur = None
    payload = {"text": text, "speaker": "ira"}
    if desc: payload["description"] = desc
    async with sess.ws_connect(f'{m["ws_url"]}?token={m["token"]}') as ws:
        await ws.send_json(payload)
        while True:
            msg = await asyncio.wait_for(ws.receive(), timeout=45)
            if msg.type == aiohttp.WSMsgType.BINARY:
                if ttfb is None: ttfb = time.time() - t0
                pcm += msg.data
            elif msg.type == aiohttp.WSMsgType.TEXT:
                j = json.loads(msg.data)
                if j.get("type") == "done":
                    dur = float(j.get("duration_s") or 0); break
                if j.get("type") in ("error", "cancelled"): break
            else: break
    return bytes(pcm), 24000, ttfb, dur

def sarvam(text, key, pace):
    from sarvamai import SarvamAI
    c = SarvamAI(api_subscription_key=key); t0 = time.time()
    r = c.text_to_speech.convert(text=text, model="bulbul:v3", speaker="priya",
                                 target_language_code="hi-IN", pace=pace)
    raw = base64.b64decode(r.audios[0])
    with wave.open(io.BytesIO(raw), "rb") as w:
        return w.readframes(w.getnframes()), w.getframerate(), time.time()-t0, None

async def main():
    rk, sv = os.environ["RUMIK_API_KEY"], os.environ["SARVAM_API_KEY"]
    import aiohttp
    out = {}
    VARIANTS = [
        ("rumik-none", "Rumik, no pace steering", None, "what you heard"),
        ("rumik-1.0",  "Rumik at pace 1.0",        1.0, "quick"),
        ("rumik-1.1",  "Rumik at pace 1.1",        1.1, "PROPOSED DEFAULT"),
        ("rumik-1.2",  "Rumik at pace 1.2",        1.2, "fastest grade"),
    ]
    async with aiohttp.ClientSession() as sess:
        for lk, text in LINES.items():
            for vid, label, pace, note in VARIANTS:
                desc = rumik_pace_description(pace) if pace else None
                pcm, rate, ttfb, dur = await rumik(sess, rk, text, desc)
                if not pcm:
                    print("ERR", lk, vid); continue
                nb = narrowband(pcm, rate)
                out[f"{lk}|{vid}"] = {
                    "line": lk, "variant": vid, "label": label, "note": note,
                    "desc": desc, "text": text, "ttfb": round(ttfb or 0, 3),
                    "secs": round(len(pcm)/2/rate, 2),
                    "cps": round(len(text)/(len(pcm)/2/rate), 1),
                    "wav8k": base64.b64encode(to_wav(nb, 8000)).decode()}
                print(f"ok {lk:8s} {vid:12s} {len(pcm)/2/rate:5.2f}s "
                      f"{len(text)/(len(pcm)/2/rate):5.1f} chars/s")
            # the reference the founder's ear is calibrated to
            pcm, rate, ttfb, _ = sarvam(text, sv, 1.1)
            nb = narrowband(pcm, rate)
            out[f"{lk}|sarvam-1.1"] = {
                "line": lk, "variant": "sarvam-1.1",
                "label": "Sarvam at pace 1.1", "note": "today's live calls",
                "desc": None, "text": text, "ttfb": round(ttfb, 3),
                "secs": round(len(pcm)/2/rate, 2),
                "cps": round(len(text)/(len(pcm)/2/rate), 1),
                "wav8k": base64.b64encode(to_wav(nb, 8000)).decode()}
            print(f"ok {lk:8s} {'sarvam-1.1':12s} {len(pcm)/2/rate:5.2f}s "
                  f"{len(text)/(len(pcm)/2/rate):5.1f} chars/s  <- reference")
    json.dump(out, open("/tmp/pace_samples.json", "w"))
    print("samples:", len(out))

asyncio.run(main())
