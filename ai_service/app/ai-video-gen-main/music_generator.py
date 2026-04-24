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
# Hard safety cap under Lyria's documented per-clip maximum.
MAX_SEGMENT_SECONDS = 170.0

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
    return boto3.client(
        "s3",
        aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID") or None,
        aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY") or None,
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


def _call_lyria(prompt: str, credentials, project_id: str,
                negative_prompt: str = "vocals, lyrics, singing, narration, speech",
                seed: Optional[int] = None) -> bytes:
    """Call Lyria predict endpoint and return raw audio bytes (MP3 or WAV)."""
    import requests  # type: ignore
    from google.auth.transport.requests import Request as _AuthRequest

    # Refresh access token
    credentials.refresh(_AuthRequest())
    token = credentials.token

    endpoint = (
        f"https://{_DEFAULT_LOCATION}-aiplatform.googleapis.com/v1/"
        f"projects/{project_id}/locations/{_DEFAULT_LOCATION}/"
        f"publishers/google/models/{_DEFAULT_MODEL}:predict"
    )
    instance: Dict[str, Any] = {
        "prompt": prompt,
        "negative_prompt": negative_prompt,
        "sample_count": 1,
    }
    if seed is not None:
        instance["seed"] = int(seed)
    payload = {"instances": [instance], "parameters": {}}

    resp = requests.post(
        endpoint,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json=payload,
        timeout=180,
    )
    if resp.status_code != 200:
        raise RuntimeError(
            f"Lyria predict failed ({resp.status_code}): {resp.text[:500]}"
        )
    data = resp.json()
    preds = data.get("predictions") or []
    if not preds:
        raise RuntimeError(f"Lyria returned no predictions: {json.dumps(data)[:500]}")
    # Response shape follows Vertex's convention: first prediction carries
    # either `bytesBase64Encoded` (raw audio) or `audioContent` depending on
    # model revision. Handle both.
    pred = preds[0]
    b64 = pred.get("bytesBase64Encoded") or pred.get("audioContent")
    if not b64:
        raise RuntimeError(
            f"Lyria prediction missing audio field: keys={list(pred.keys())}"
        )
    return base64.b64decode(b64)


def _validate_music_plan(music_plan: Dict[str, Any], audio_duration: float) -> List[Dict[str, Any]]:
    """Defensive: ensure segments tile the full duration and are within Lyria's cap."""
    segments = list(music_plan.get("segments") or [])
    if not segments:
        return []

    # Sort and clamp segment durations.
    segments.sort(key=lambda s: float(s.get("start_time", 0.0)))
    fixed: List[Dict[str, Any]] = []
    for i, seg in enumerate(segments):
        start = float(seg.get("start_time", 0.0))
        end = float(seg.get("end_time", start + MAX_SEGMENT_SECONDS))
        end = min(end, audio_duration)
        if end - start > MAX_SEGMENT_SECONDS:
            end = start + MAX_SEGMENT_SECONDS
        if end - start <= 1.0:
            continue  # skip unusably short segments
        seg_fixed = dict(seg)
        seg_fixed["start_time"] = start
        seg_fixed["end_time"] = end
        fixed.append(seg_fixed)

    # If the Director undercovered the video, pad with a repeat of the last prompt.
    if fixed and fixed[-1]["end_time"] < audio_duration - 1.0:
        last = fixed[-1]
        cursor = last["end_time"]
        while cursor < audio_duration - 1.0:
            seg_end = min(cursor + MAX_SEGMENT_SECONDS, audio_duration)
            fixed.append({
                "start_time": cursor,
                "end_time": seg_end,
                "mood": last.get("mood", "consistent with previous segment"),
                "genre": last.get("genre", ""),
                "tempo_bpm": last.get("tempo_bpm"),
                "prompt": last.get("prompt", "") + " (seamless continuation of previous segment)",
            })
            cursor = seg_end
    return fixed


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
        music_plan: Director output — {overall_mood, overall_genre, segments:[...]}
        audio_duration: Total narration duration in seconds.
        video_id: Used as the S3 key prefix.
        run_dir: Optional local run directory for debug copies of segments.
        progress_callback: Optional callable(event_dict) for SSE progress.

    Returns a dict with `url` (final merged MP3 S3 URL) and `segments` (list of
    {start, end, url}) for observability, or None if generation is skipped.
    """
    segments = _validate_music_plan(music_plan, audio_duration)
    if not segments:
        _log.info("No music segments after validation — skipping background music.")
        return None

    _log.info(
        "🎼 Generating background music: %d segment(s) covering %.1fs",
        len(segments), audio_duration,
    )
    if progress_callback:
        try:
            progress_callback({
                "type": "sub_stage",
                "sub_stage": "background_music_start",
                "message": f"Generating background music ({len(segments)} segment(s))",
                "segments": len(segments),
            })
        except Exception:
            pass

    credentials = _load_google_credentials()
    project_id = _get_project_id(credentials)

    segment_records: List[Dict[str, Any]] = []
    for i, seg in enumerate(segments):
        prompt = str(seg.get("prompt") or "").strip()
        if not prompt:
            # Minimal fallback prompt built from mood/genre/tempo.
            mood = seg.get("mood", "ambient background")
            genre = seg.get("genre", "cinematic instrumental")
            tempo = seg.get("tempo_bpm")
            parts = [genre, mood]
            if tempo:
                parts.append(f"{int(tempo)} bpm")
            parts.append("no vocals, educational background score")
            prompt = ", ".join(p for p in parts if p)

        seg_dur = float(seg["end_time"]) - float(seg["start_time"])
        _log.info("   Segment %d/%d (%.1fs): %s", i + 1, len(segments), seg_dur, prompt[:120])
        if progress_callback:
            try:
                progress_callback({
                    "type": "sub_stage",
                    "sub_stage": "background_music_segment",
                    "message": f"Lyria generating segment {i + 1}/{len(segments)}",
                    "segment_index": i,
                    "segment_total": len(segments),
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

        key = f"ai-videos/{video_id}/background_music/segment_{i:02d}.mp3"
        seg_url = _s3_upload_bytes(audio_bytes, key)
        if run_dir is not None:
            try:
                (run_dir / f"background_music_seg_{i:02d}.mp3").write_bytes(audio_bytes)
            except Exception:
                pass

        segment_records.append({
            "index": i,
            "start_time": float(seg["start_time"]),
            "end_time": float(seg["end_time"]),
            "url": seg_url,
            "prompt": prompt,
        })

    if len(segment_records) == 1:
        final_url = segment_records[0]["url"]
    else:
        concat_payload = [
            {
                "url": r["url"],
                "fade_in": 1.5 if i == 0 else 0.0,
                "fade_out": 2.5 if i == len(segment_records) - 1 else 0.0,
            }
            for i, r in enumerate(segment_records)
        ]
        output_key = f"ai-videos/{video_id}/background_music/music.mp3"
        if progress_callback:
            try:
                progress_callback({
                    "type": "sub_stage",
                    "sub_stage": "background_music_concat",
                    "message": f"Merging {len(segment_records)} segments via render worker",
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

    return {"url": final_url, "segments": segment_records, "duration": audio_duration}
