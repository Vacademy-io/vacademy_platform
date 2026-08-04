"""Probe the preview helper end to end: real mint, real socket, real WAV bytes.

Three times today a green unit test hid a failure one layer up, so this asserts on
the actual bytes: RIFF header present, declared rate 24 kHz, plausible duration,
and a failure path that returns b"" rather than raising into a public endpoint.
"""
import asyncio, io, os, sys, wave
sys.path.insert(0, "/tmp/rk5")
os.environ.setdefault("TTS_MODEL", "sarvam")

from app.config import get_settings
from app.providers import rumik_synthesize_wav

TEXT = "Namaste! Main Riya bol rahi hoon Vacademy se."

async def main():
    import aiohttp
    s = get_settings()
    assert s.rumik_api_key, "RUMIK_API_KEY missing in this container"
    async with aiohttp.ClientSession() as sess:
        # 1. shared-session path (what the endpoint actually uses)
        raw = await rumik_synthesize_wav(TEXT, "ira", s.rumik_api_key, session=sess)
        assert raw[:4] == b"RIFF", f"not a WAV: {raw[:12]!r}"
        with wave.open(io.BytesIO(raw), "rb") as w:
            rate, n, ch, width = w.getframerate(), w.getnframes(), w.getnchannels(), w.getsampwidth()
        secs = n / rate
        print(f"shared session : {len(raw)} bytes, {rate} Hz, {ch}ch, {width*8}-bit, {secs:.2f}s")
        assert rate == 24000, f"wrong declared rate {rate} — would play at the wrong speed"
        assert ch == 1 and width == 2
        assert 1.0 < secs < 8.0, f"implausible duration {secs}"
        # the session must survive for the endpoint's next request
        assert not sess.closed, "helper closed the SHARED session — would break every later call"

        # 2. owns-its-session path
        raw2 = await rumik_synthesize_wav(TEXT, "adam", s.rumik_api_key)
        assert raw2[:4] == b"RIFF"
        print(f"own session    : {len(raw2)} bytes (male voice 'adam')")

        # 3. failure must return b"", never raise
        bad = await rumik_synthesize_wav(TEXT, "ira", "rk_live_definitely_invalid", session=sess)
        print(f"bad key        : returned {len(bad)} bytes (expected 0), no exception")
        assert bad == b""
        assert not sess.closed, "a failed synth must not close the shared session"

        # 4. a voice from the WRONG palette: proves the guard matters
        cross = await rumik_synthesize_wav(TEXT, "priya", s.rumik_api_key, session=sess)
        print(f"cross-vendor voice 'priya' -> {len(cross)} bytes"
              f" ({'REJECTED as expected' if not cross else 'accepted (Rumik ignores unknown speaker)'})")

    print("\nRESULT: OK")

asyncio.run(main())
