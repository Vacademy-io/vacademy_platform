"""
Video indexing pipeline orchestrator — 3-stage extraction.

Stage 1: Cheap pass (full video) — audio + transcript + prosody + scenes
Stage 2: LLM highlight selection — pick 30-60s window
Stage 3: Expensive pass (window only) — visual extraction by mode

Called from main.py via asyncio.run_in_executor() (blocking, runs in thread pool).
"""
from __future__ import annotations

import json
import logging
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Callable

import boto3
import numpy as np
from botocore.exceptions import ClientError
from urllib.request import Request, urlopen

from .audio import analyze_prosody, demux_audio, detect_emphasis, transcribe
from .highlight import select_highlight
from .matting import SelfieSegMatter
from .scene import detect_scenes
from .schemas import (
    SpeakerForeground,
    VideoContext,
    VideoMeta,
)
from .spatial import (
    create_spatial_db,
    write_change_rows,
    write_cursor_rows,
    write_dynamic_crops as write_spatial_dynamic_crops,
    write_frame_rows,
    write_ocr_rows,
    write_ui_cutouts as write_spatial_ui_cutouts,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# S3 helper (same pattern as worker.py, decoupled)
# ---------------------------------------------------------------------------

class _S3Helper:
    def __init__(self):
        self._s3 = boto3.client(
            "s3",
            aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID") or None,
            aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY") or None,
            region_name=os.environ.get("AWS_REGION", "ap-south-1"),
        )
        self.bucket = os.environ.get("AWS_S3_PUBLIC_BUCKET", "vacademy-media-storage-public")

    def download(self, url: str, local_path: Path) -> None:
        local_path.parent.mkdir(parents=True, exist_ok=True)
        if self.bucket and self.bucket in url:
            try:
                parts = url.split(f"{self.bucket}.s3.amazonaws.com/")
                if len(parts) == 2:
                    self._s3.download_file(self.bucket, parts[1], str(local_path))
                    return
            except (ClientError, Exception):
                pass
        # Fallback HTTP
        try:
            # Try non-public bucket too
            for bucket_name in ["vacademy-media-storage", self.bucket]:
                if bucket_name in url:
                    try:
                        parts = url.split(f"{bucket_name}.s3.amazonaws.com/")
                        if len(parts) == 2:
                            self._s3.download_file(bucket_name, parts[1], str(local_path))
                            return
                    except Exception:
                        continue
            req = Request(url, headers={"User-Agent": "VacademyIndexer/1.0"})
            with urlopen(req, timeout=300) as resp:
                local_path.write_bytes(resp.read())
        except Exception as e:
            raise RuntimeError(f"Failed to download {url}: {e}")

    def upload(self, local_path: Path, s3_key: str, content_type: str = "application/octet-stream") -> str:
        self._s3.upload_file(
            str(local_path), self.bucket, s3_key,
            ExtraArgs={"ContentType": content_type},
        )
        return f"https://{self.bucket}.s3.amazonaws.com/{s3_key}"


# ---------------------------------------------------------------------------
# ffprobe
# ---------------------------------------------------------------------------

def _probe_video(video_path: Path) -> dict[str, Any]:
    """Get video metadata via ffprobe."""
    cmd = [
        "ffprobe", "-v", "quiet",
        "-print_format", "json",
        "-show_format", "-show_streams",
        str(video_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        raise RuntimeError(f"ffprobe failed: {result.stderr[:300]}")
    data = json.loads(result.stdout)

    # Extract useful fields
    duration = float(data.get("format", {}).get("duration", 0))
    width, height, fps = 0, 0, 30.0
    for stream in data.get("streams", []):
        if stream.get("codec_type") == "video":
            width = int(stream.get("width", 0))
            height = int(stream.get("height", 0))
            # Parse fps from r_frame_rate (e.g., "30/1")
            rfr = stream.get("r_frame_rate", "30/1")
            parts = rfr.split("/")
            if len(parts) == 2 and int(parts[1]) > 0:
                fps = int(parts[0]) / int(parts[1])
            break

    return {"duration_s": duration, "width": width, "height": height, "fps": fps}


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def run_index_pipeline(
    input_video_id: str,
    source_url: str,
    mode: str,
    on_progress: Callable[[float], None],
) -> dict[str, Any]:
    """Main pipeline. Blocking — runs in thread pool executor.

    Returns:
        {
            "output_urls": {"context_json": ..., "spatial_db": ..., "assets": {...}},
            "duration_seconds": float,
            "resolution": "WxH",
        }
    """
    work_dir = Path(tempfile.mkdtemp(prefix=f"index_{input_video_id}_"))
    s3 = _S3Helper()
    s3_base = f"ai-input-videos/{input_video_id}"

    try:
        # ── SETUP (0-5%) ──────────────────────────────────────────────
        on_progress(2)
        video_path = work_dir / "source_video"
        logger.info(f"Downloading source video: {source_url}")
        s3.download(source_url, video_path)
        on_progress(4)

        probe = _probe_video(video_path)
        duration_s = probe["duration_s"]
        width = probe["width"]
        height = probe["height"]
        fps_original = probe["fps"]
        resolution = f"{width}x{height}"
        logger.info(f"Video: {resolution} @ {fps_original:.1f}fps, {duration_s:.1f}s")
        on_progress(5)

        # ── STAGE 1: CHEAP PASS (5-30%) ───────────────────────────────
        logger.info("=== STAGE 1: Audio + Transcript + Prosody + Scenes ===")

        wav_path = work_dir / "audio.wav"
        demux_audio(video_path, wav_path)
        on_progress(10)

        sentences, all_words = transcribe(wav_path)
        on_progress(20)

        prosody, rms_times, rms_values = analyze_prosody(wav_path)
        on_progress(23)

        emphasis = detect_emphasis(all_words, rms_times, rms_values, prosody)
        on_progress(25)

        # Scene detection — use higher threshold for podcast (less visual variety)
        scene_threshold = 33.0 if mode == "podcast" else 27.0
        scenes = detect_scenes(video_path, threshold=scene_threshold)
        on_progress(30)

        # ── STAGE 2: LLM HIGHLIGHT (30-40%) ───────────────────────────
        logger.info("=== STAGE 2: Highlight Selection ===")

        highlight = select_highlight(
            transcript=sentences,
            emphasis_marks=emphasis,
            scene_boundaries=scenes,
            prosody=prosody,
            duration_s=duration_s,
            rms_times=rms_times,
            rms_values=rms_values,
        )
        logger.info(f"Highlight window: {highlight.t_start:.1f}-{highlight.t_end:.1f}s ({highlight.reason})")
        on_progress(40)

        # ── STAGE 3: EXPENSIVE PASS (40-90%) ──────────────────────────
        logger.info(f"=== STAGE 3: Visual Extraction ({mode}) ===")

        matter = SelfieSegMatter()
        output_urls: dict[str, Any] = {"assets": {}}
        spatial_db_path = work_dir / "video_spatial.sqlite"
        conn = create_spatial_db(spatial_db_path)

        sample_fps = 6.0

        if mode == "podcast":
            from .podcast_visual import extract_podcast_visuals

            pv_result = extract_podcast_visuals(
                video_path=video_path,
                highlight=highlight,
                output_dir=work_dir,
                matter=matter,
                on_progress=on_progress,
            )

            # Write frame data to spatial DB
            write_frame_rows(conn, pv_result.frame_data)

            # Build foreground metadata
            foreground = SpeakerForeground(
                asset_path="assets/speaker_fg.webm",
                has_alpha=True,
                typical_bbox_norm=pv_result.typical_face_bbox,
                free_regions=pv_result.free_regions,
            )

            # Upload speaker_fg.webm
            if pv_result.speaker_fg_path and pv_result.speaker_fg_path.exists():
                url = s3.upload(
                    pv_result.speaker_fg_path,
                    f"{s3_base}/assets/speaker_fg.webm",
                    content_type="video/webm",
                )
                output_urls["assets"]["speaker_fg"] = url

        elif mode == "demo":
            from .demo_visual import extract_demo_visuals
            from .schemas import DemoContext

            dv_result = extract_demo_visuals(
                video_path=video_path,
                highlight=highlight,
                scene_boundaries=scenes,
                output_dir=work_dir,
                matter=matter,
                on_progress=on_progress,
            )

            sample_fps = 2.0
            foreground = None

            # Write to spatial DB
            write_ocr_rows(conn, dv_result.ocr_events)
            write_cursor_rows(conn, dv_result.cursor_track)
            write_change_rows(conn, dv_result.change_events)

            if dv_result.dynamic_crops:
                crop_rows = [
                    {
                        "t_start": c.t_start, "t_end": c.t_end,
                        "crop_x": c.crop_bbox_norm[0], "crop_y": c.crop_bbox_norm[1],
                        "crop_w": c.crop_bbox_norm[2], "crop_h": c.crop_bbox_norm[3],
                        "follows": c.follows,
                    }
                    for c in dv_result.dynamic_crops
                ]
                write_spatial_dynamic_crops(conn, crop_rows)

            if dv_result.ui_cutouts:
                cutout_rows = [
                    {
                        "id": c.id, "asset_path": c.asset_path,
                        "t_start": c.t, "t_end": c.t + 1.0,
                        "bbox_x": c.bbox_norm[0], "bbox_y": c.bbox_norm[1],
                        "bbox_w": c.bbox_norm[2], "bbox_h": c.bbox_norm[3],
                        "label": c.label,
                    }
                    for c in dv_result.ui_cutouts
                ]
                write_spatial_ui_cutouts(conn, cutout_rows)

            # Upload PiP foreground
            if dv_result.pip_fg_path and dv_result.pip_fg_path.exists():
                url = s3.upload(
                    dv_result.pip_fg_path,
                    f"{s3_base}/assets/pip_fg.webm",
                    content_type="video/webm",
                )
                output_urls["assets"]["pip_fg"] = url

            # Upload UI cutout images
            for cp in dv_result.ui_cutout_paths:
                if cp.exists():
                    ext = cp.suffix
                    ct = "image/png" if ext == ".png" else "video/webm"
                    url = s3.upload(cp, f"{s3_base}/assets/ui_cutouts/{cp.name}", content_type=ct)
                    output_urls["assets"][f"ui_cutout_{cp.stem}"] = url

            # Build demo context for video_context.json
            demo_context = DemoContext(
                ui_elements_seen=dv_result.ui_elements_seen,
                cursor_path_summary=f"{len(dv_result.cursor_track)} positions tracked",
                key_onscreen_events=dv_result.key_events,
                dynamic_crops=dv_result.dynamic_crops,
                pip=dv_result.pip_region,
                ui_cutouts=dv_result.ui_cutouts,
            )
        else:
            foreground = None
            demo_context = None

        conn.close()
        on_progress(90)

        # ── OUTPUT (90-100%) ──────────────────────────────────────────
        logger.info("=== OUTPUT: Building artifacts ===")

        # Assign energy_mean to sentences
        for sent in sentences:
            mask = (rms_times >= sent.start) & (rms_times <= sent.end)
            if mask.any():
                sent.energy_mean = round(float(np.mean(rms_values[mask])), 6)

        # Build video_context.json
        video_context = VideoContext(
            meta=VideoMeta(
                mode=mode,
                duration_s=round(duration_s, 3),
                resolution=[width, height],
                fps_original=round(fps_original, 2),
                fps_sampled_visual=sample_fps,
                highlight_window=highlight,
            ),
            transcript=sentences,
            emphasis=emphasis,
            prosody=prosody,
            scenes=scenes,
            foreground=foreground if mode == "podcast" else None,
            demo_only=demo_context if mode == "demo" else None,
        )

        # Write JSON
        context_json_path = work_dir / "video_context.json"
        context_json_path.write_text(
            video_context.model_dump_json(indent=2, exclude_none=True),
            encoding="utf-8",
        )
        on_progress(92)

        # Upload all artifacts
        context_url = s3.upload(
            context_json_path,
            f"{s3_base}/video_context.json",
            content_type="application/json",
        )
        output_urls["context_json"] = context_url

        spatial_url = s3.upload(
            spatial_db_path,
            f"{s3_base}/video_spatial.sqlite",
            content_type="application/x-sqlite3",
        )
        output_urls["spatial_db"] = spatial_url
        on_progress(98)

        logger.info(f"Pipeline complete: {len(output_urls)} artifacts uploaded")

        return {
            "output_urls": output_urls,
            "duration_seconds": round(duration_s, 2),
            "resolution": resolution,
        }

    finally:
        try:
            shutil.rmtree(work_dir, ignore_errors=True)
        except Exception:
            pass
