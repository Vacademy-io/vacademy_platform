"""Probe Sarvam bulbul:v4-flash before wiring it as an engine (runs on a GitHub runner).

A. Gender sweep: synthesize one short line per voice over REST (8 kHz WAV) and measure
   median F0. Sarvam publishes no genders; Hindi verb endings depend on it.
B. WebSocket: the exact config pipecat 1.4 sends on a live call (8 kHz, linear16,
   preprocessing on, temperature, pace), for a hi / enhi / en voice and a few variants,
   to prove the streaming path speaks v4-flash.
C. pipecat: SarvamTTSService constructs once bulbul:v4-flash is registered.
"""
import asyncio
import base64
import io
import json
import os
import statistics
import sys
import time
import wave
from concurrent.futures import ThreadPoolExecutor

import httpx
import numpy as np

KEY = os.environ["SARVAM_API_KEY"]
MODEL = "bulbul:v4-flash"
IDS = [l.strip() for l in open(os.path.join(os.path.dirname(__file__), "sarvam_v4_ids.txt")) if l.strip()]

TEXT = {
    "hi": "नमस्ते जी, मैं आपके बच्चे की पढ़ाई के बारे में दो मिनट बात करना चाहती थी।",
    "enhi": "नमस्ते जी, मैं आपके बच्चे की live classes के बारे में दो मिनट बात करना चाहती थी।",
    "en": "Hello, I am calling about the classes you enquired about. Is this a good time?",
    "mr": "नमस्कार, मी तुमच्या मुलाच्या अभ्यासाबद्दल दोन मिनिटे बोलू शकते का?",
    "kn": "ನಮಸ್ಕಾರ, ನಿಮ್ಮ ಮಗುವಿನ ತರಗತಿಗಳ ಬಗ್ಗೆ ಎರಡು ನಿಮಿಷ ಮಾತನಾಡಬಹುದೇ?",
    "pa": "ਸਤ ਸ੍ਰੀ ਅਕਾਲ, ਕੀ ਮੈਂ ਤੁਹਾਡੇ ਬੱਚੇ ਦੀ ਪੜ੍ਹਾਈ ਬਾਰੇ ਦੋ ਮਿੰਟ ਗੱਲ ਕਰ ਸਕਦਾ ਹਾਂ?",
    "ta": "வணக்கம், உங்கள் குழந்தையின் வகுப்புகள் பற்றி இரண்டு நிமிடம் பேசலாமா?",
    "te": "నమస్కారం, మీ పిల్లల తరగతుల గురించి రెండు నిమిషాలు మాట్లాడవచ్చా?",
    "gu": "નમસ્તે, શું હું તમારા બાળકના અભ્યાસ વિશે બે મિનિટ વાત કરી શકું?",
    "bn": "নমস্কার, আপনার সন্তানের পড়াশোনা নিয়ে দুই মিনিট কথা বলতে পারি?",
}
LANG = {"hi": "hi-IN", "enhi": "hi-IN", "en": "en-IN", "mr": "mr-IN", "kn": "kn-IN", "pa": "pa-IN",
        "ta": "ta-IN", "te": "te-IN", "gu": "gu-IN", "bn": "bn-IN"}


def lang_of(voice_id: str) -> str:
    return voice_id.split("_")[1]


def f0_median(pcm: np.ndarray, sr: int) -> float | None:
    """Median pitch of voiced 40 ms frames by autocorrelation (70-350 Hz)."""
    x = pcm.astype(np.float64)
    if x.size < sr // 2:
        return None
    x -= x.mean()
    frame = int(0.04 * sr)
    hop = frame // 2
    rms_all = np.sqrt(np.mean(x ** 2)) or 1.0
    lo, hi = int(sr / 350), int(sr / 70)
    out = []
    for i in range(0, x.size - frame, hop):
        f = x[i:i + frame] * np.hanning(frame)
        if np.sqrt(np.mean(f ** 2)) < 0.5 * rms_all:
            continue
        ac = np.correlate(f, f, mode="full")[frame - 1:]
        if ac[0] <= 0:
            continue
        seg = ac[lo:hi]
        if seg.size == 0:
            continue
        lag = lo + int(np.argmax(seg))
        if ac[lag] / ac[0] < 0.35:
            continue
        out.append(sr / lag)
    return float(np.median(out)) if len(out) >= 5 else None


def synth_rest(voice_id: str, text: str | None = None, lang: str | None = None, sr: int = 16000, extra=None):
    body = {"text": text or TEXT[lang_of(voice_id)], "target_language_code": lang or LANG[lang_of(voice_id)],
            "speaker": voice_id, "model": MODEL, "pace": 1.0, "speech_sample_rate": sr,
            "output_audio_codec": "wav"}
    body.update(extra or {})
    t = time.time()
    r = httpx.post("https://api.sarvam.ai/text-to-speech", json=body,
                   headers={"api-subscription-key": KEY}, timeout=60)
    ms = int((time.time() - t) * 1000)
    if r.status_code != 200:
        return r.status_code, None, ms, r.text[:200]
    b64 = r.json()["audios"][0]
    with wave.open(io.BytesIO(base64.b64decode(b64))) as w:
        pcm = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
        rate = w.getframerate()
    return 200, (pcm, rate), ms, None


def sweep(ids=None, workers=6):
    print("== A. gender sweep (REST, 16 kHz)")
    rows = []

    def one(v):
        for attempt in range(6):
            try:
                st, audio, ms, err = synth_rest(v)
            except Exception as e:  # noqa: BLE001
                return v, "ERR", None, 0, str(e)[:120]
            if st == 429:
                time.sleep(3 * (attempt + 1))
                continue
            break
        if st != 200:
            return v, st, None, ms, err
        pcm, rate = audio
        if workers == 1:
            time.sleep(0.8)
        return v, 200, f0_median(pcm, rate), ms, round(pcm.size / rate, 2)

    with ThreadPoolExecutor(max_workers=workers) as ex:
        for v, st, f0, ms, info in ex.map(one, ids or IDS):
            g = "?" if f0 is None else ("male" if f0 < 155 else "female" if f0 > 175 else "CHECK")
            rows.append((v, st, f0, g))
            print(f"VOICE,{v},{st},{'' if f0 is None else round(f0)},{g},{ms},{info}")
    bad = [r for r in rows if r[1] != 200]
    unclear = [r for r in rows if r[3] in ("?", "CHECK")]
    print(f"SWEEP_DONE ok={len(rows) - len(bad)} failed={len(bad)} unclear={len(unclear)}")


async def ws_case(label, voice, lang, text, *, preprocessing=True, temperature=0.6, sr="8000"):
    import websockets
    url = f"wss://api.sarvam.ai/text-to-speech/ws?model={MODEL}&send_completion_event=true"
    cfg = {"target_language_code": lang, "speaker": voice, "speech_sample_rate": sr,
           "enable_preprocessing": preprocessing, "min_buffer_size": 50, "max_chunk_length": 150,
           "output_audio_codec": "linear16", "output_audio_bitrate": "128k", "pace": 1.0, "model": MODEL}
    if temperature is not None:
        cfg["temperature"] = temperature
    t0 = time.time()
    first = None
    nbytes = 0
    errors = []
    try:
        async with websockets.connect(url, additional_headers={"api-subscription-key": KEY}) as ws:
            await ws.send(json.dumps({"type": "config", "data": cfg}))
            await ws.send(json.dumps({"type": "text", "data": {"text": text}}))
            await ws.send(json.dumps({"type": "flush"}))
            while True:
                msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=20))
                if msg.get("type") == "audio":
                    if first is None:
                        first = time.time() - t0
                    nbytes += len(base64.b64decode(msg["data"]["audio"]))
                elif msg.get("type") == "event" and msg.get("data", {}).get("event_type") == "final":
                    break
                elif msg.get("type") == "error":
                    errors.append(json.dumps(msg)[:300])
                    break
    except Exception as e:  # noqa: BLE001
        errors.append(f"{type(e).__name__}: {str(e)[:200]}")
    secs = nbytes / 2 / int(sr) if nbytes else 0
    print(f"WS,{label},voice={voice},lang={lang},pre={preprocessing},temp={temperature},sr={sr},"
          f"first_audio={None if first is None else round(first, 2)}s,audio={round(secs, 2)}s,errors={errors}")


async def ws_tests():
    print("== B. websocket (live-call config)")
    hi = TEXT["hi"]
    await ws_case("enhi-default", "shubh_enhi_ads", "hi-IN", TEXT["enhi"])
    await ws_case("enhi-en-target", "shubh_enhi_ads", "en-IN", TEXT["enhi"])
    await ws_case("hi-female", "ritu_hi_customer", "hi-IN", hi)
    await ws_case("hi-female-en-target", "ritu_hi_customer", "en-IN", hi)
    await ws_case("en-female", "simran_en_customer", "en-IN", TEXT["en"])
    await ws_case("no-preprocessing", "ritu_hi_customer", "hi-IN", hi, preprocessing=False)
    await ws_case("no-temperature", "ritu_hi_customer", "hi-IN", hi, temperature=None)
    await ws_case("temp-1.0", "ritu_hi_customer", "hi-IN", hi, temperature=1.0)
    await ws_case("16k", "ritu_hi_customer", "hi-IN", hi, sr="16000")
    await ws_case("v3-voice-on-v4", "priya", "hi-IN", hi)
    # Latency vs v3 for the same text.
    print("== B2. v3 vs v4 first-audio (3 runs each)")
    for model, voice in (("bulbul:v3", "ritu"), (MODEL, "ritu_hi_customer")):
        import websockets
        times = []
        for _ in range(3):
            url = f"wss://api.sarvam.ai/text-to-speech/ws?model={model}&send_completion_event=true"
            cfg = {"target_language_code": "hi-IN", "speaker": voice, "speech_sample_rate": "8000",
                   "enable_preprocessing": True, "min_buffer_size": 50, "max_chunk_length": 150,
                   "output_audio_codec": "linear16", "output_audio_bitrate": "128k", "pace": 1.0,
                   "model": model, "temperature": 0.6}
            t0 = time.time()
            try:
                async with websockets.connect(url, additional_headers={"api-subscription-key": KEY}) as ws:
                    await ws.send(json.dumps({"type": "config", "data": cfg}))
                    t0 = time.time()
                    await ws.send(json.dumps({"type": "text", "data": {"text": hi}}))
                    await ws.send(json.dumps({"type": "flush"}))
                    while True:
                        msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=20))
                        if msg.get("type") == "audio":
                            times.append(round(time.time() - t0, 3))
                            break
                        if msg.get("type") == "error":
                            times.append("err")
                            break
            except Exception as e:  # noqa: BLE001
                times.append(f"exc:{type(e).__name__}")
        print(f"LATENCY,{model},{voice},{times}")


def pipecat_construct():
    print("== C. pipecat construction")
    from pipecat.services.sarvam import tts as st
    try:
        st.SarvamTTSService(api_key="x", model=MODEL, voice_id="shubh_enhi_ads", sample_rate=8000)
        print("PIPECAT,unpatched,constructed")
    except Exception as e:  # noqa: BLE001
        print(f"PIPECAT,unpatched,{type(e).__name__}: {e}")
    st.TTS_MODEL_CONFIGS[MODEL] = st.TTSModelConfig(
        supports_pitch=False, supports_loudness=False, supports_temperature=True,
        default_sample_rate=24000, default_speaker="shubh_enhi_ads", pace_range=(0.5, 2.0),
        preprocessing_always_enabled=True, speakers=tuple(IDS))
    try:
        svc = st.SarvamTTSService(api_key="x", model=MODEL, voice_id="shubh_enhi_ads", sample_rate=8000,
                                  params=st.SarvamTTSService.InputParams(pace=1.0, temperature=0.6,
                                                                         enable_preprocessing=True))
        print(f"PIPECAT,patched,constructed url={svc._websocket_url}")
    except Exception as e:  # noqa: BLE001
        print(f"PIPECAT,patched,{type(e).__name__}: {e}")


if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    if which in ("all", "pipecat"):
        pipecat_construct()
    if which in ("all", "ws"):
        asyncio.run(ws_tests())
    if which in ("all", "sweep"):
        sweep()
    if which == "retry":
        retry = [l.strip() for l in open(os.path.join(os.path.dirname(__file__), "sarvam_v4_retry.txt")) if l.strip()]
        sweep(retry, workers=1)
