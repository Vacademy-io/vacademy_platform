"""Does Rumik Mulberry pronounce ROMANIZED Hindi, or only Devanagari?

The docs say "hindi in devanagari, english in latin". Our LLM is instructed to
emit romanized Hindi because that is what Sarvam bulbul wants. If Mulberry reads
"kaise chal raha hai" as English phonetics, every Hinglish call is mush.

I cannot listen. So: synthesize, then read the audio back with Sarvam STT and
compare against what the sentence MEANS. Garbled pronunciation shows up as a
garbled transcript. Same sentence, three ways, one judge.
"""
import asyncio, io, json, os, struct, sys, time, wave
sys.path.insert(0, "/tmp/rk")

ROMAN = "Namaste! Main Riya bol rahi hoon Vacademy se. Aapka school kaise chal raha hai?"
DEVA  = "नमस्ते! मैं रिया बोल रही हूँ Vacademy से। आपका school कैसे चल रहा है?"

def wav(pcm: bytes, rate: int) -> bytes:
    b = io.BytesIO()
    with wave.open(b, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes(pcm)
    return b.getvalue()

async def rumik(text, key):
    import aiohttp
    async with aiohttp.ClientSession() as s:
        async with s.post("https://silk-api.rumik.ai/v1/tts/ws-connect",
                          headers={"Authorization": f"Bearer {key}"},
                          json={"model": "mulberry", "text": text},
                          timeout=aiohttp.ClientTimeout(total=20)) as r:
            m = await r.json()
        pcm = bytearray(); t0 = time.time(); ttfb = None
        async with s.ws_connect(f'{m["ws_url"]}?token={m["token"]}') as ws:
            await ws.send_json({"text": text, "speaker": "ira"})
            while True:
                msg = await asyncio.wait_for(ws.receive(), timeout=30)
                if msg.type == aiohttp.WSMsgType.BINARY:
                    if ttfb is None: ttfb = time.time() - t0
                    pcm += msg.data
                elif msg.type == aiohttp.WSMsgType.TEXT:
                    if json.loads(msg.data).get("type") == "done": break
                else: break
        return wav(bytes(pcm), 24000), ttfb, len(pcm) / 2 / 24000

async def sarvam_tts(text, key):
    from sarvamai import SarvamAI
    c = SarvamAI(api_subscription_key=key)
    r = c.text_to_speech.convert(text=text, model="bulbul:v3", speaker="priya",
                                 target_language_code="hi-IN")
    import base64
    raw = base64.b64decode(r.audios[0])
    return raw, None, None   # already a wav container

def stt(wav_bytes, key, label):
    from sarvamai import SarvamAI
    c = SarvamAI(api_subscription_key=key)
    f = io.BytesIO(wav_bytes); f.name = "a.wav"
    r = c.speech_to_text.transcribe(file=f, model="saarika:v2.5", language_code="hi-IN")
    return getattr(r, "transcript", str(r))

async def main():
    rk, sv = os.environ["RUMIK_API_KEY"], os.environ["SARVAM_API_KEY"]
    cases = []
    for label, text in (("rumik/roman", ROMAN), ("rumik/devanagari", DEVA)):
        w, ttfb, secs = await rumik(text, rk)
        cases.append((label, text, w, ttfb, secs))
    w, _, _ = await sarvam_tts(ROMAN, sv)
    cases.append(("sarvam/roman", ROMAN, w, None, None))

    print("SENT (meaning): Namaste! I am Riya from Vacademy. How is your school going?\n")
    out = {}
    for label, text, w, ttfb, secs in cases:
        t = stt(w, sv, label)
        print(f"--- {label}")
        print(f"    sent      : {text}")
        print(f"    heard back: {t}")
        if ttfb: print(f"    ttfb {ttfb:.3f}s  audio {secs:.2f}s  bytes {len(w)}")
        print()
        out[label] = {"sent": text, "heard": t, "wav_len": len(w)}
        open(f"/tmp/{label.replace('/','_')}.wav", "wb").write(w)
    json.dump(out, open("/tmp/roundtrip.json", "w"), ensure_ascii=False, indent=1)

asyncio.run(main())
