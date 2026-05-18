"""Background music generation via Google Lyria (Vertex AI).

Generates a per-video ambient/cinematic background score based on the Director's
`music_plan` output. Each Lyria call produces up to ~180 s of audio; longer
videos are tiled across multiple segment calls and merged into a single MP3 via
the render_worker's /concat_audio endpoint.

The final artifact is uploaded to S3 and returned as a single URL that the
pipeline stores in `meta.audio_tracks[]`.

Reuses the same Google service-account credentials as the Google TTS path, so
no new secrets need to be provisioned — the existing service account just needs
`aiplatform.endpoints.predict` permission for the Lyria model.
"""
from __future__ import annotations

import base64
import json
import logging
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

_log = logging.getLogger(__name__)

# Vertex AI / Lyria defaults. Override via env vars for rollout without a code change.
_DEFAULT_PROJECT = os.environ.get("GOOGLE_CLOUD_PROJECT", "")
_DEFAULT_LOCATION = os.environ.get("LYRIA_LOCATION", "us-central1")
_DEFAULT_MODEL = os.environ.get("LYRIA_MODEL_ID", "lyria-3-pro-preview")
# Hard safety cap under Lyria's per-call output cap (~180s for Lyria 3 Pro).
# A single Lyria call produces one coherent piece up to this length; for longer
# videos we tile multiple calls and concat. The Director is asked to size its
# `chunks[]` accordingly.
MAX_CHUNK_SECONDS = 180.0
# Legacy alias kept for any external callers that imported the old name.
MAX_SEGMENT_SECONDS = MAX_CHUNK_SECONDS

_AWS_BUCKET = os.environ.get("AWS_BUCKET_NAME", "vacademy-media-storage")
_AWS_REGION = os.environ.get("AWS_REGION", "ap-south-1")
_AWS_PUBLIC_HOST = f"{_AWS_BUCKET}.s3.amazonaws.com"


def _load_google_credentials():
    """Mirror the TTS credentials loader so music reuses the same service account."""
    from google.oauth2 import service_account

    repo_root = Path(__file__).resolve().parent
    credentials_path = repo_root / "google_credentials.json"
    credentials_json = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS_JSON")

    if credentials_path.exists():
        return service_account.Credentials.from_service_account_file(
            str(credentials_path),
            scopes=["https://www.googleapis.com/auth/cloud-platform"],
        )
    if credentials_json:
        clean = credentials_json.strip()
        if clean.startswith(("'", '"')) and clean.endswith(("'", '"')):
            clean = clean[1:-1]
        info = json.loads(clean)
        if "private_key" in info and "\\n" in info["private_key"]:
            info["private_key"] = info["private_key"].replace("\\n", "\n")
        return service_account.Credentials.from_service_account_info(
            info,
            scopes=["https://www.googleapis.com/auth/cloud-platform"],
        )
    raise RuntimeError(
        "Google credentials not found — Lyria needs the same service account as Google TTS. "
        "Set GOOGLE_APPLICATION_CREDENTIALS_JSON or place google_credentials.json in ai-video-gen-main/."
    )


def _get_project_id(credentials) -> str:
    if _DEFAULT_PROJECT:
        return _DEFAULT_PROJECT
    pid = getattr(credentials, "project_id", None)
    if pid:
        return pid
    raise RuntimeError(
        "Google Cloud project id not set. Export GOOGLE_CLOUD_PROJECT or use a "
        "service-account JSON that includes project_id."
    )


def _s3_client():
    import boto3
    # The service uses S3_AWS_ACCESS_KEY / S3_AWS_ACCESS_SECRET (s3_service.py pattern).
    # Fall back to the standard AWS_ names so both k8s configs and local dev work.
    _key = (
        os.environ.get("S3_AWS_ACCESS_KEY")
        or os.environ.get("AWS_ACCESS_KEY_ID")
        or None
    )
    _secret = (
        os.environ.get("S3_AWS_ACCESS_SECRET")
        or os.environ.get("AWS_SECRET_ACCESS_KEY")
        or None
    )
    return boto3.client(
        "s3",
        aws_access_key_id=_key,
        aws_secret_access_key=_secret,
        region_name=_AWS_REGION,
    )


def _s3_upload_bytes(data: bytes, key: str, content_type: str = "audio/mpeg") -> str:
    s3 = _s3_client()
    # Match the existing ai_service S3 pattern (s3_service.py, image_service.py):
    # no explicit ACL — the bucket policy makes these objects public, and
    # setting ACL="public-read" would fail on buckets with BPA enabled.
    s3.put_object(
        Bucket=_AWS_BUCKET,
        Key=key,
        Body=data,
        ContentType=content_type,
    )
    return f"https://{_AWS_PUBLIC_HOST}/{key}"


def _is_lyria3_family(model: str) -> bool:
    """Lyria 3 (Pro/Full-Song) lives on a different REST surface than Lyria 2."""
    return model.startswith("lyria-3")


def _sniff_audio_format(data: bytes) -> tuple[str, str]:
    """Detect audio format from the first few bytes.

    Returns (extension, content_type). Defaults to ('mp3', 'audio/mpeg')
    if nothing matches — most browsers can still play unknown audio when
    served as audio/mpeg.
    """
    if len(data) < 12:
        return "mp3", "audio/mpeg"
    head = data[:12]
    # WAV: "RIFF....WAVE"
    if head[:4] == b"RIFF" and head[8:12] == b"WAVE":
        return "wav", "audio/wav"
    # FLAC: "fLaC"
    if head[:4] == b"fLaC":
        return "flac", "audio/flac"
    # OGG: "OggS"
    if head[:4] == b"OggS":
        return "ogg", "audio/ogg"
    # MP3: ID3 tag or MPEG frame sync (0xFF Ex/Fx)
    if head[:3] == b"ID3" or (head[0] == 0xFF and (head[1] & 0xE0) == 0xE0):
        return "mp3", "audio/mpeg"
    # MP4/M4A container: 'ftyp' at offset 4
    if head[4:8] == b"ftyp":
        return "m4a", "audio/mp4"
    return "mp3", "audio/mpeg"


def _fresh_token(credentials) -> str:
    from google.auth.transport.requests import Request as _AuthRequest
    credentials.refresh(_AuthRequest())
    return credentials.token


def _call_lyria_v2(prompt: str, model: str, credentials, project_id: str,
                   negative_prompt: str = "vocals, lyrics, singing, narration, speech",
                   seed: Optional[int] = None) -> bytes:
    """Lyria 2 (`lyria-002`) — regional :predict endpoint, instrumental output."""
    import requests  # type: ignore

    token = _fresh_token(credentials)
    endpoint = (
        f"https://{_DEFAULT_LOCATION}-aiplatform.googleapis.com/v1/"
        f"projects/{project_id}/locations/{_DEFAULT_LOCATION}/"
        f"publishers/google/models/{model}:predict"
    )
    instance: Dict[str, Any] = {
        "prompt": prompt,
        "negative_prompt": negative_prompt,
        "sample_count": 1,
    }
    if seed is not None:
        instance["seed"] = int(seed)

    resp = requests.post(
        endpoint,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={"instances": [instance], "parameters": {}},
        timeout=180,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"Lyria v2 predict failed ({resp.status_code}): {resp.text[:500]}")

    preds = resp.json().get("predictions") or []
    if not preds:
        raise RuntimeError(f"Lyria v2 returned no predictions: {resp.text[:500]}")
    b64 = preds[0].get("bytesBase64Encoded") or preds[0].get("audioContent")
    if not b64:
        raise RuntimeError(f"Lyria v2 missing audio field: keys={list(preds[0].keys())}")
    return base64.b64decode(b64)


def _call_lyria_v3(prompt: str, model: str, credentials, project_id: str) -> bytes:
    """Lyria 3 (`lyria-3-pro-preview`) — global /interactions endpoint.

    NOTE on output: Lyria 3 Pro is a *full-song* model — it generates
    structured songs that include vocals and lyrics, not an instrumental bed.
    For pure background music under narration, prefer `lyria-002` instead.
    The response also returns lyrics + a textual description alongside the
    audio; we extract only the audio bytes.
    """
    import requests  # type: ignore

    token = _fresh_token(credentials)
    endpoint = (
        f"https://aiplatform.googleapis.com/v1beta1/"
        f"projects/{project_id}/locations/global/interactions"
    )
    payload = {
        "model": model,
        "input": [{"type": "text", "text": prompt}],
    }

    resp = requests.post(
        endpoint,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json=payload,
        timeout=300,  # full-song generation can take longer than instrumental loops
    )
    if resp.status_code != 200:
        raise RuntimeError(f"Lyria v3 interactions failed ({resp.status_code}): {resp.text[:500]}")

    data = resp.json()
    if data.get("status") and data["status"] not in ("completed", "succeeded"):
        raise RuntimeError(f"Lyria v3 status={data['status']}: {json.dumps(data)[:300]}")

    # Outputs is a heterogenous list — find the first audio entry.
    outputs = data.get("outputs") or []
    audio_b64 = None
    for out in outputs:
        if out.get("type") == "audio" and out.get("data"):
            audio_b64 = out["data"]
            break
    if not audio_b64:
        raise RuntimeError(
            f"Lyria v3 returned no audio output. Output types: "
            f"{[o.get('type') for o in outputs]}"
        )
    return base64.b64decode(audio_b64)


def _call_lyria(prompt: str, credentials, project_id: str,
                negative_prompt: str = "vocals, lyrics, singing, narration, speech",
                seed: Optional[int] = None) -> bytes:
    """Dispatch to the right Lyria backend based on the configured model id."""
    model = _DEFAULT_MODEL
    if _is_lyria3_family(model):
        return _call_lyria_v3(prompt, model, credentials, project_id)
    return _call_lyria_v2(prompt, model, credentials, project_id,
                          negative_prompt=negative_prompt, seed=seed)


def _format_mmss(seconds: float) -> str:
    s = max(0, int(round(seconds)))
    return f"[{s // 60:02d}:{s % 60:02d}]"


def _compose_timestamped_prompt_from_segments(segments: List[Dict[str, Any]],
                                              chunk_start: float) -> str:
    """Stitch legacy `segments[]` items into one Lyria timestamped prompt.

    Marker times are CHUNK-RELATIVE: subtract `chunk_start` from each segment's
    start_time. Each segment contributes one `[mm:ss] {prompt}` block.
    """
    parts: List[str] = []
    for seg in segments:
        rel = max(0.0, float(seg.get("start_time", 0.0)) - chunk_start)
        prompt = str(seg.get("prompt") or "").strip()
        if not prompt:
            mood = seg.get("mood", "ambient background")
            genre = seg.get("genre", "cinematic instrumental")
            tempo = seg.get("tempo_bpm")
            bits = [genre, mood]
            if tempo:
                bits.append(f"{int(tempo)} bpm")
            bits.append("no vocals, no lyrics")
            prompt = ", ".join(p for p in bits if p)
        parts.append(f"{_format_mmss(rel)} {prompt}")
    return " ".join(parts)


def _normalize_to_chunks(music_plan: Dict[str, Any],
                         audio_duration: float) -> List[Dict[str, Any]]:
    """Normalize either shape (`chunks[]` or legacy `segments[]`) into a
    canonical list of `{start_time, end_time, timestamped_prompt}` chunks,
    each ≤ MAX_CHUNK_SECONDS, tiling the full audio duration.

    Returns an empty list if the plan is unusable or the duration is too short.
    """
    if audio_duration <= 1.0:
        return []

    chunks_in = music_plan.get("chunks")
    if chunks_in:
        return _normalize_chunks_array(chunks_in, audio_duration)

    # Legacy path — fold segments[] into chunks of ≤ MAX_CHUNK_SECONDS.
    segments = list(music_plan.get("segments") or [])
    if not segments:
        # Last resort: synthesize a single chunk from overall_mood / genre.
        return _synth_chunks_from_overall(music_plan, audio_duration)

    segments.sort(key=lambda s: float(s.get("start_time", 0.0)))
    chunks: List[Dict[str, Any]] = []
    current: List[Dict[str, Any]] = []
    chunk_start = float(segments[0].get("start_time", 0.0))
    for seg in segments:
        seg_start = float(seg.get("start_time", chunk_start))
        seg_end = min(float(seg.get("end_time", seg_start)), audio_duration)
        if seg_end <= seg_start:
            continue
        # If adding this segment overflows the current chunk, close it first.
        if current and seg_end - chunk_start > MAX_CHUNK_SECONDS:
            chunks.append({
                "start_time": chunk_start,
                "end_time": float(current[-1]["end_time"]),
                "timestamped_prompt": _compose_timestamped_prompt_from_segments(current, chunk_start),
            })
            current = []
            chunk_start = seg_start
        current.append({"start_time": seg_start, "end_time": seg_end,
                        **{k: seg[k] for k in ("prompt", "mood", "genre", "tempo_bpm") if k in seg}})
    if current:
        chunks.append({
            "start_time": chunk_start,
            "end_time": float(current[-1]["end_time"]),
            "timestamped_prompt": _compose_timestamped_prompt_from_segments(current, chunk_start),
        })

    # Pad the tail if the Director undercovered the video.
    if chunks and chunks[-1]["end_time"] < audio_duration - 1.0:
        cursor = chunks[-1]["end_time"]
        last_prompt = chunks[-1]["timestamped_prompt"]
        while cursor < audio_duration - 1.0:
            seg_end = min(cursor + MAX_CHUNK_SECONDS, audio_duration)
            chunks.append({
                "start_time": cursor,
                "end_time": seg_end,
                "timestamped_prompt": (
                    f"[00:00] Seamless continuation of the previous chunk, "
                    f"matching its instrumentation and mood — "
                    f"{last_prompt[:200]}. Sustain to a gentle resolution. No vocals, no lyrics."
                ),
            })
            cursor = seg_end
    return chunks


def _normalize_chunks_array(chunks_in: List[Dict[str, Any]],
                            audio_duration: float) -> List[Dict[str, Any]]:
    """Sanitize the Director-emitted `chunks[]` array."""
    chunks_in = sorted(
        (c for c in chunks_in if isinstance(c, dict)),
        key=lambda c: float(c.get("start_time", 0.0)),
    )
    fixed: List[Dict[str, Any]] = []
    for c in chunks_in:
        start = float(c.get("start_time", 0.0))
        end = min(float(c.get("end_time", start + MAX_CHUNK_SECONDS)), audio_duration)
        if end - start > MAX_CHUNK_SECONDS:
            end = start + MAX_CHUNK_SECONDS
        if end - start <= 1.0:
            continue
        prompt = str(c.get("timestamped_prompt") or c.get("prompt") or "").strip()
        if not prompt:
            continue
        # Defensive: ensure "no vocals" appears somewhere in the prompt.
        if "no vocals" not in prompt.lower() and "instrumental" not in prompt.lower():
            prompt = prompt + " — instrumental only, no vocals, no lyrics"
        fixed.append({"start_time": start, "end_time": end, "timestamped_prompt": prompt})
    return fixed


def _synth_chunks_from_overall(music_plan: Dict[str, Any],
                               audio_duration: float) -> List[Dict[str, Any]]:
    """Synthesize a minimal timestamped prompt when only `overall_*` fields exist."""
    mood = music_plan.get("overall_mood") or "calm, attentive, lightly uplifting"
    genre = music_plan.get("overall_genre") or "cinematic ambient with soft piano"
    base_prompt = (
        f"Soft warm cinematic instrumental — {genre}, {mood}, gentle pulse "
        f"around 72 bpm, subtle evolution, no vocals, no lyrics."
    )
    chunks: List[Dict[str, Any]] = []
    cursor = 0.0
    while cursor < audio_duration - 1.0:
        end = min(cursor + MAX_CHUNK_SECONDS, audio_duration)
        chunks.append({
            "start_time": cursor,
            "end_time": end,
            "timestamped_prompt": f"[00:00] {base_prompt}",
        })
        cursor = end
    return chunks


def _concat_via_render_worker(segment_urls: List[Dict[str, Any]],
                              output_key: str,
                              crossfade_seconds: float = 2.0) -> str:
    """POST to render_worker /concat_audio. Returns merged S3 URL."""
    import requests  # type: ignore
    render_worker_url = os.environ.get("RENDER_WORKER_URL", "").rstrip("/")
    if not render_worker_url:
        raise RuntimeError(
            "RENDER_WORKER_URL not set — cannot concatenate multi-segment music. "
            "Either configure the render worker or restrict background music to "
            "videos shorter than one Lyria segment."
        )
    render_key = os.environ.get("RENDER_KEY", "")
    resp = requests.post(
        f"{render_worker_url}/concat_audio",
        json={
            "segments": segment_urls,
            "crossfade_seconds": crossfade_seconds,
            "output_key": output_key,
            "bucket": _AWS_BUCKET,
        },
        headers={"X-Render-Key": render_key} if render_key else {},
        timeout=300,
    )
    if resp.status_code != 200:
        raise RuntimeError(
            f"/concat_audio failed ({resp.status_code}): {resp.text[:500]}"
        )
    return resp.json()["url"]


def generate_background_music(
    music_plan: Dict[str, Any],
    audio_duration: float,
    video_id: str,
    run_dir: Optional[Path] = None,
    progress_callback: Optional[Any] = None,
) -> Optional[Dict[str, Any]]:
    """Generate background music for a video.

    Args:
        music_plan: Director output. Preferred shape uses `chunks[]` where each
            chunk has `{start_time, end_time, timestamped_prompt}` — the
            timestamped_prompt is a single prose string with `[mm:ss]` markers
            (chunk-relative) that drive Lyria's intra-track transitions.
            Legacy `segments[]` shape is also accepted and folded into chunks.
        audio_duration: Total narration duration in seconds.
        video_id: Used as the S3 key prefix.
        run_dir: Optional local run directory for debug copies.
        progress_callback: Optional callable(event_dict) for SSE progress.

    Returns a dict with `url` (final merged audio S3 URL), `chunks` (list of
    {start, end, url}) for observability, and `duration` — or None if skipped.
    """
    chunks = _normalize_to_chunks(music_plan, audio_duration)
    if not chunks:
        _log.info("No music chunks after normalization — skipping background music.")
        return None

    _log.info(
        "🎼 Generating background music: %d chunk(s) covering %.1fs",
        len(chunks), audio_duration,
    )
    if progress_callback:
        try:
            progress_callback({
                "type": "sub_stage",
                "sub_stage": "background_music_start",
                "message": f"Generating background music ({len(chunks)} chunk(s))",
                "chunks": len(chunks),
            })
        except Exception:
            pass

    credentials = _load_google_credentials()
    project_id = _get_project_id(credentials)

    chunk_records: List[Dict[str, Any]] = []
    for i, chunk in enumerate(chunks):
        prompt = str(chunk.get("timestamped_prompt") or "").strip()
        chunk_dur = float(chunk["end_time"]) - float(chunk["start_time"])
        _log.info("   Chunk %d/%d (%.1fs): %s", i + 1, len(chunks), chunk_dur, prompt[:160])
        if progress_callback:
            try:
                progress_callback({
                    "type": "sub_stage",
                    "sub_stage": "background_music_segment",
                    "message": f"Lyria generating chunk {i + 1}/{len(chunks)}",
                    "segment_index": i,
                    "segment_total": len(chunks),
                })
            except Exception:
                pass

        # Simple retry — Lyria occasionally 429s or 503s.
        last_err: Optional[Exception] = None
        audio_bytes: Optional[bytes] = None
        for attempt in range(3):
            try:
                audio_bytes = _call_lyria(prompt, credentials, project_id)
                break
            except Exception as exc:
                last_err = exc
                _log.warning("   Lyria attempt %d failed: %s", attempt + 1, exc)
                time.sleep(2 ** attempt)
        if audio_bytes is None:
            raise RuntimeError(f"Lyria failed after retries: {last_err}")

        ext, content_type = _sniff_audio_format(audio_bytes)
        key = f"ai-videos/{video_id}/background_music/chunk_{i:02d}.{ext}"
        chunk_url = _s3_upload_bytes(audio_bytes, key, content_type=content_type)
        if run_dir is not None:
            try:
                (run_dir / f"background_music_chunk_{i:02d}.{ext}").write_bytes(audio_bytes)
            except Exception:
                pass

        chunk_records.append({
            "index": i,
            "start_time": float(chunk["start_time"]),
            "end_time": float(chunk["end_time"]),
            "url": chunk_url,
            "prompt": prompt,
        })

    if len(chunk_records) == 1:
        final_url = chunk_records[0]["url"]
    else:
        concat_payload = [
            {
                "url": r["url"],
                "fade_in": 1.5 if i == 0 else 0.0,
                "fade_out": 2.5 if i == len(chunk_records) - 1 else 0.0,
            }
            for i, r in enumerate(chunk_records)
        ]
        output_key = f"ai-videos/{video_id}/background_music/music.mp3"
        if progress_callback:
            try:
                progress_callback({
                    "type": "sub_stage",
                    "sub_stage": "background_music_concat",
                    "message": f"Merging {len(chunk_records)} chunks via render worker",
                })
            except Exception:
                pass
        final_url = _concat_via_render_worker(concat_payload, output_key)

    if progress_callback:
        try:
            progress_callback({
                "type": "sub_stage",
                "sub_stage": "background_music_done",
                "message": "Background music ready",
                "url": final_url,
            })
        except Exception:
            pass

    return {"url": final_url, "chunks": chunk_records, "duration": audio_duration}
