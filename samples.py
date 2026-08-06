"""Generate an A/B listening set, resampled to the 8 kHz the phone leg carries.

24 kHz side-by-side would flatter Rumik with fidelity Plivo throws away. What
matters is what the person on the phone hears, so every sample here goes through
the same 8 kHz narrowband squeeze a real call applies.
"""
import asyncio, audioop, base64, io, json, os, sys, time, wave

LINES = {
  "opening": "Namaste! Main Riya bol rahi hoon Vacademy se. Kya main aapse do minute baat kar sakti hoon?",
  "pitch":   "Sir, hum schools ke liye ek complete education platform banate hain - admissions, fees, classes, sab kuch ek jagah.",
  "question":"Aapke school mein abhi kitne students hain, aur aap konsa software use kar rahe hain?",
}
PAIRS = [("rumik","ira","female"),("sarvam","priya","female"),
         ("rumik","adam","male"),("sarvam","shubh","male")]

def to_wav(pcm, rate):
    b=io.BytesIO()
    with wave.open(b,"wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes(pcm)
    return b.getvalue()

def narrowband(pcm, src_rate):
    """Same squeeze the Plivo leg applies: down to 8 kHz mono."""
    out,_ = audioop.ratecv(pcm, 2, 1, src_rate, 8000, None)
    return out

async def rumik(text, speaker, key):
    import aiohttp
    async with aiohttp.ClientSession() as s:
        async with s.post("https://silk-api.rumik.ai/v1/tts/ws-connect",
                headers={"Authorization": f"Bearer {key}"},
                json={"model":"mulberry","text":text},
                timeout=aiohttp.ClientTimeout(total=25)) as r:
            m = await r.json()
        pcm=bytearray(); t0=time.time(); ttfb=None; meter=None
        async with s.ws_connect(f'{m["ws_url"]}?token={m["token"]}') as ws:
            await ws.send_json({"text":text,"speaker":speaker})
            while True:
                msg=await asyncio.wait_for(ws.receive(),timeout=40)
                if msg.type==aiohttp.WSMsgType.BINARY:
                    if ttfb is None: ttfb=time.time()-t0
                    pcm+=msg.data
                elif msg.type==aiohttp.WSMsgType.TEXT:
                    j=json.loads(msg.data)
                    if j.get("type")=="done": meter=j; break
                else: break
    return bytes(pcm), 24000, ttfb, meter

def sarvam(text, speaker, key):
    from sarvamai import SarvamAI
    c=SarvamAI(api_subscription_key=key); t0=time.time()
    r=c.text_to_speech.convert(text=text,model="bulbul:v3",speaker=speaker,
                               target_language_code="hi-IN")
    ttfb=time.time()-t0
    raw=base64.b64decode(r.audios[0])
    with wave.open(io.BytesIO(raw),"rb") as w:
        return w.readframes(w.getnframes()), w.getframerate(), ttfb, None

async def main():
    rk,sv = os.environ["RUMIK_API_KEY"], os.environ["SARVAM_API_KEY"]
    out={}
    for lk,text in LINES.items():
        for vendor,speaker,gender in PAIRS:
            key=f"{lk}|{vendor}|{speaker}"
            try:
                if vendor=="rumik": pcm,rate,ttfb,meter = await rumik(text,speaker,rk)
                else:               pcm,rate,ttfb,meter = sarvam(text,speaker,sv)
                nb = narrowband(pcm, rate)
                out[key]={"vendor":vendor,"speaker":speaker,"gender":gender,"line":lk,
                          "text":text,"ttfb":round(ttfb,3),
                          "secs":round(len(pcm)/2/rate,2),"chars":len(text),
                          "native_rate":rate,"meter":meter,
                          "wav8k":base64.b64encode(to_wav(nb,8000)).decode()}
                print(f"ok  {key}  ttfb={ttfb:.3f}s  {len(pcm)/2/rate:.2f}s  meter={meter and {k:meter[k] for k in ('credits_used','duration_s','ttfa_ms') if k in meter}}")
            except Exception as e:
                print(f"ERR {key}: {type(e).__name__}: {str(e)[:160]}")
    json.dump(out, open("/tmp/samples.json","w"))
    print("wrote", sum(len(v['wav8k']) for v in out.values())//1024, "KB of base64 across", len(out), "samples")

asyncio.run(main())
