#!/usr/bin/env python3
"""
Upload TTS voice samples to S3 via the Vacademy media service.

Usage:
    python upload_tts_samples.py --base-url https://backend-stage.vacademy.io --samples-dir ./tts-samples

Flow per file:
  1. POST /media-service/public/get-signed-url  → {id, url}
  2. PUT {presigned-url} with file bytes
  3. POST /media-service/public/get-public-url?fileId={id} → permanent S3 URL
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import httpx


def upload_sample(
    client: httpx.Client,
    base_url: str,
    file_path: Path,
    source: str = "TTS_SAMPLES",
    source_id: str = "VOICE_PREVIEW",
) -> str | None:
    """Upload a single MP3 file and return the permanent public URL."""

    file_name = file_path.name
    file_type = "audio/mpeg"

    # Step 1: Get presigned URL
    try:
        resp = client.post(
            f"{base_url}/media-service/public/get-signed-url",
            json={
                "file_name": file_name,
                "file_type": file_type,
                "source": source,
                "source_id": source_id,
            },
        )
        resp.raise_for_status()
    except httpx.HTTPStatusError:
        # Fallback to authenticated endpoint
        resp = client.post(
            f"{base_url}/media-service/get-signed-url",
            json={
                "file_name": file_name,
                "file_type": file_type,
                "source": source,
                "source_id": source_id,
            },
        )
        resp.raise_for_status()

    data = resp.json()
    file_id = data["id"]
    presigned_url = data["url"]

    # Step 2: Upload to S3 via presigned URL
    file_bytes = file_path.read_bytes()
    put_resp = client.put(
        presigned_url,
        content=file_bytes,
        headers={"Content-Type": file_type},
    )
    put_resp.raise_for_status()

    # Step 3: Get public URL
    try:
        pub_resp = client.get(
            f"{base_url}/media-service/public/get-public-url",
            params={"fileId": file_id, "expiryDays": 1},
        )
        pub_resp.raise_for_status()
    except httpx.HTTPStatusError:
        pub_resp = client.get(
            f"{base_url}/media-service/get-public-url",
            params={"fileId": file_id, "expiryDays": 1},
        )
        pub_resp.raise_for_status()

    public_url = pub_resp.text.strip().strip('"')
    return public_url


def main():
    parser = argparse.ArgumentParser(description="Upload TTS samples to S3")
    parser.add_argument("--base-url", default="https://backend-stage.vacademy.io")
    parser.add_argument("--samples-dir", default="./tts-samples")
    parser.add_argument("--output-json", default="./tts-samples/url_mapping.json",
                        help="Output JSON mapping voice_id → public URL")
    args = parser.parse_args()

    samples_dir = Path(args.samples_dir)
    if not samples_dir.exists():
        print(f"❌ Samples directory not found: {samples_dir}")
        sys.exit(1)

    url_mapping: dict[str, dict[str, str]] = {}

    with httpx.Client(timeout=30, follow_redirects=True) as client:
        for provider_dir in sorted(samples_dir.iterdir()):
            if not provider_dir.is_dir():
                continue
            provider = provider_dir.name  # "sarvam" or "edge"
            if provider not in ("sarvam", "edge", "google"):
                continue

            mp3_files = sorted(provider_dir.glob("*.mp3"))
            print(f"\n📤 Uploading {len(mp3_files)} {provider} samples...")
            url_mapping[provider] = {}

            for i, mp3_file in enumerate(mp3_files):
                voice_id = mp3_file.stem  # e.g. "shubh" or "en-US-AriaNeural"
                print(f"    [{i+1}/{len(mp3_files)}] {voice_id}...", end=" ", flush=True)

                try:
                    public_url = upload_sample(
                        client, args.base_url, mp3_file,
                        source="TTS_SAMPLES",
                        source_id=provider.upper(),
                    )
                    url_mapping[provider][voice_id] = public_url
                    print(f"✅ {public_url[:80]}...")
                except Exception as e:
                    print(f"❌ {e}")

    # Write URL mapping to JSON
    output_path = Path(args.output_json)
    output_path.write_text(json.dumps(url_mapping, indent=2))
    total = sum(len(v) for v in url_mapping.values())
    print(f"\n📊 Uploaded {total} samples. URL mapping saved to {output_path}")


if __name__ == "__main__":
    main()
