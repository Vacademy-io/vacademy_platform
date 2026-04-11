#!/usr/bin/env python3
"""
Generate TTS voice sample audio files for the voice preview feature.

Usage:
    python generate_tts_samples.py --sarvam-key <KEY> [--output-dir ./tts-samples]

Generates:
    tts-samples/sarvam/{voice_id}.mp3   (39 voices)
    tts-samples/edge/{voice_name}.mp3   (32 voices)
"""
from __future__ import annotations

import argparse
import asyncio
import base64
import io
import json
import os
import sys
from pathlib import Path

import httpx

# ---------------------------------------------------------------------------
# Voice catalogs (must match router + pipeline)
# ---------------------------------------------------------------------------

SARVAM_VOICES = {
    "male": [
        "shubh", "aditya", "rahul", "rohan", "amit", "dev", "ratan", "varun",
        "manan", "sumit", "kabir", "aayan", "ashutosh", "advait", "anand",
        "tarun", "sunny", "mani", "gokul", "vijay", "mohit", "rehan", "soham",
    ],
    "female": [
        "ritu", "priya", "neha", "pooja", "simran", "kavya", "ishita", "shreya",
        "roopa", "amelia", "sophia", "tanya", "shruti", "suhani", "kavitha", "rupali",
    ],
}

EDGE_VOICES = {
    "en-US-AriaNeural": "Aria",
    "en-US-ChristopherNeural": "Christopher",
    "en-GB-SoniaNeural": "Sonia",
    "en-GB-RyanNeural": "Ryan",
    "en-IN-NeerjaNeural": "Neerja",
    "en-IN-PrabhatNeural": "Prabhat",
    "hi-IN-SwaraNeural": "Swara",
    "hi-IN-MadhurNeural": "Madhur",
    "bn-IN-TanishaaNeural": "Tanishaa",
    "bn-IN-BashkarNeural": "Bashkar",
    "ta-IN-PallaviNeural": "Pallavi",
    "ta-IN-ValluvarNeural": "Valluvar",
    "te-IN-ShrutiNeural": "Shruti",
    "te-IN-MohanNeural": "Mohan",
    "mr-IN-AarohiNeural": "Aarohi",
    "mr-IN-ManoharNeural": "Manohar",
    "kn-IN-SapnaNeural": "Sapna",
    "kn-IN-GaganNeural": "Gagan",
    "gu-IN-DhwaniNeural": "Dhwani",
    "gu-IN-NiranjanNeural": "Niranjan",
    "ml-IN-SobhanaNeural": "Sobhana",
    "ml-IN-MidhunNeural": "Midhun",
    "es-ES-ElviraNeural": "Elvira",
    "es-ES-AlvaroNeural": "Alvaro",
    "fr-FR-DeniseNeural": "Denise",
    "fr-FR-HenriNeural": "Henri",
    "de-DE-KatjaNeural": "Katja",
    "de-DE-ConradNeural": "Conrad",
    "ja-JP-NanamiNeural": "Nanami",
    "ja-JP-KeitaNeural": "Keita",
    "zh-CN-XiaoxiaoNeural": "Xiaoxiao",
    "zh-CN-YunxiNeural": "Yunxi",
}

SAMPLE_TEXT_TEMPLATE = "Hello, I am {name}. Welcome to Vacademy AI Content Studio."


# ---------------------------------------------------------------------------
# Sarvam TTS
# ---------------------------------------------------------------------------

async def generate_sarvam_samples(api_key: str, output_dir: Path) -> None:
    """Generate sample audio for all Sarvam voices."""
    sarvam_dir = output_dir / "sarvam"
    sarvam_dir.mkdir(parents=True, exist_ok=True)

    all_voices = []
    for gender, voices in SARVAM_VOICES.items():
        for voice in voices:
            all_voices.append((voice, gender))

    print(f"\n🗣️  Generating {len(all_voices)} Sarvam voice samples...")

    async with httpx.AsyncClient(timeout=30) as client:
        for i, (voice_id, gender) in enumerate(all_voices):
            out_path = sarvam_dir / f"{voice_id}.mp3"
            if out_path.exists():
                print(f"    ⏭️  [{i+1}/{len(all_voices)}] {voice_id} — already exists, skipping")
                continue

            name = voice_id.capitalize()
            text = SAMPLE_TEXT_TEMPLATE.format(name=name)

            print(f"    🎙️  [{i+1}/{len(all_voices)}] {voice_id} ({gender})...", end=" ", flush=True)

            try:
                resp = await client.post(
                    "https://api.sarvam.ai/text-to-speech",
                    headers={
                        "api-subscription-key": api_key,
                        "Content-Type": "application/json",
                    },
                    json={
                        "inputs": [text],
                        "target_language_code": "en-IN",
                        "speaker": voice_id,
                        "model": "bulbul:v3",
                        "speech_sample_rate": 24000,
                        "enable_preprocessing": True,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                audios = data.get("audios", [])
                if not audios:
                    print("❌ empty response")
                    continue

                wav_bytes = base64.b64decode(audios[0])

                # Convert WAV → MP3
                try:
                    from pydub import AudioSegment
                    audio = AudioSegment.from_wav(io.BytesIO(wav_bytes))
                    audio.export(str(out_path), format="mp3", bitrate="128k")
                except ImportError:
                    # Fallback: save as WAV and convert with ffmpeg
                    wav_path = sarvam_dir / f"{voice_id}.wav"
                    wav_path.write_bytes(wav_bytes)
                    import subprocess
                    subprocess.run(
                        ["ffmpeg", "-y", "-i", str(wav_path), "-codec:a", "libmp3lame",
                         "-b:a", "128k", str(out_path)],
                        check=True, capture_output=True,
                    )
                    wav_path.unlink(missing_ok=True)

                print(f"✅ ({out_path.stat().st_size // 1024} KB)")

            except httpx.HTTPStatusError as e:
                print(f"❌ HTTP {e.response.status_code}: {e.response.text[:100]}")
            except Exception as e:
                print(f"❌ {e}")

            # Small delay to respect rate limits
            await asyncio.sleep(0.3)

    print(f"✅ Sarvam samples done → {sarvam_dir}/")


# ---------------------------------------------------------------------------
# Edge TTS
# ---------------------------------------------------------------------------

async def generate_edge_samples(output_dir: Path) -> None:
    """Generate sample audio for all Edge TTS voices."""
    try:
        import edge_tts
    except ImportError:
        print("⚠️  edge_tts not installed. Run: pip install edge-tts")
        return

    edge_dir = output_dir / "edge"
    edge_dir.mkdir(parents=True, exist_ok=True)

    voices = list(EDGE_VOICES.items())
    print(f"\n🗣️  Generating {len(voices)} Edge TTS voice samples...")

    for i, (voice_name, display_name) in enumerate(voices):
        out_path = edge_dir / f"{voice_name}.mp3"
        if out_path.exists():
            print(f"    ⏭️  [{i+1}/{len(voices)}] {voice_name} — already exists, skipping")
            continue

        text = SAMPLE_TEXT_TEMPLATE.format(name=display_name)
        print(f"    🎙️  [{i+1}/{len(voices)}] {voice_name}...", end=" ", flush=True)

        try:
            communicate = edge_tts.Communicate(text, voice_name)
            audio_data = bytearray()
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_data.extend(chunk["data"])

            if audio_data:
                out_path.write_bytes(audio_data)
                print(f"✅ ({len(audio_data) // 1024} KB)")
            else:
                print("❌ no audio data")
        except Exception as e:
            print(f"❌ {e}")

        await asyncio.sleep(0.2)

    print(f"✅ Edge TTS samples done → {edge_dir}/")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def main():
    parser = argparse.ArgumentParser(description="Generate TTS voice samples")
    parser.add_argument("--sarvam-key", required=True, help="Sarvam AI API key")
    parser.add_argument("--output-dir", default="./tts-samples", help="Output directory")
    parser.add_argument("--sarvam-only", action="store_true", help="Only generate Sarvam samples")
    parser.add_argument("--edge-only", action="store_true", help="Only generate Edge samples")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"📂 Output directory: {output_dir.resolve()}")

    do_all = not args.sarvam_only and not args.edge_only

    if do_all or args.sarvam_only:
        await generate_sarvam_samples(args.sarvam_key, output_dir)

    if do_all or args.edge_only:
        await generate_edge_samples(output_dir)

    # Print summary
    total = 0
    for provider_dir in output_dir.iterdir():
        if provider_dir.is_dir():
            count = len(list(provider_dir.glob("*.mp3")))
            total += count
            print(f"\n📊 {provider_dir.name}: {count} samples")

    print(f"\n🎉 Total: {total} voice samples generated in {output_dir.resolve()}")


if __name__ == "__main__":
    asyncio.run(main())
