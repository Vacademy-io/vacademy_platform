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
from botocore.exceptions import ClientError
from urllib.request import Request, urlopen

from .audio import (
    analyze_prosody,
    assign_sentence_prosody,
    demux_audio,
    detect_emphasis,
    downsample_series,
    transcribe,
)
from .full_video_face import cluster_into_segments, scan_full_video_faces
from .highlight import select_highlight
from .matting import SelfieSegMatter
from .scene import detect_scenes
from .schemas import (
    AudioSummary,
    FaceSegment,
    SpeakerForeground,
    VideoContext,
    VideoMeta,
)
from .spatial import (
    create_spatial_db,
    write_change_rows,
    write_cursor_rows,
    write_dynamic_crops as write_spatial_dynamic_crops,
    write_face_segments,
    write_frame_rows,
    write_full_video_faces,
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

        output_urls: dict[str, Any] = {"assets": {}}

        # Re-encode source video to mp4 (browser-compatible) and upload to
        # public bucket so the FE player can show it in SOURCE_CLIP shots.
        _src_ext = source_url.rsplit(".", 1)[-1].split("?")[0] or "mp4"
        if _src_ext.lower() in ("mov", "avi", "mkv", "webm", "wmv"):
            source_mp4_path = work_dir / "source_browser.mp4"
            subprocess.run(
                [
                    "ffmpeg", "-y", "-i", str(video_path),
                    "-c:v", "libx264", "-preset", "fast", "-crf", "23",
                    "-c:a", "aac", "-b:a", "128k",
                    "-movflags", "+faststart",
                    str(source_mp4_path),
                ],
                capture_output=True, timeout=600,
            )
            upload_path = source_mp4_path
            upload_key = f"{s3_base}/source.mp4"
        else:
            upload_path = video_path
            upload_key = f"{s3_base}/source.{_src_ext}"
        source_public_url = s3.upload(
            upload_path,
            upload_key,
            content_type="video/mp4",
        )
        # Store INSIDE assets dict — the poller saves output_urls["assets"]
        # to the DB's assets_urls column, so top-level keys get lost.
        output_urls["assets"]["source_video"] = source_public_url
        logger.info(f"Source video copied to public bucket: {source_public_url}")

        on_progress(5)

        # ── STAGE 1: CHEAP PASS (5-30%) ───────────────────────────────
        logger.info("=== STAGE 1: Audio + Transcript + Prosody + Scenes ===")

        wav_path = work_dir / "audio.wav"
        demux_audio(video_path, wav_path)
        on_progress(10)

        sentences, all_words = transcribe(wav_path)
        on_progress(20)

        prosody, rms_times, rms_values, f0_times, f0_values = analyze_prosody(wav_path)
        on_progress(23)

        emphasis = detect_emphasis(all_words, rms_times, rms_values, prosody)
        on_progress(25)

        # Persist downsampled energy/pitch series so future engagement
        # pipelines don't have to re-run audio analysis.
        prosody.energy_series = downsample_series(rms_times, rms_values, hop_s=1.0)
        prosody.pitch_series = downsample_series(f0_times, f0_values, hop_s=1.0)

        # Scene detection — use higher threshold for podcast (less visual variety)
        scene_threshold = 33.0 if mode == "podcast" else 27.0
        scenes = detect_scenes(video_path, threshold=scene_threshold)
        on_progress(28)

        # ── STAGE 1.5: FULL-VIDEO FACE SCAN (28-30%, podcast only) ────
        # Lightweight 1fps face detection across the ENTIRE video so future
        # placement pipelines know where the speaker's face is at any point,
        # not just inside the highlight window.
        face_samples: list[dict] = []
        face_segments_list = []
        if mode == "podcast":
            try:
                logger.info("=== STAGE 1.5: Full-video face scan (1fps) ===")
                face_samples = scan_full_video_faces(
                    video_path=video_path,
                    sample_fps=1.0,
                    on_progress=on_progress,
                    progress_lo=28.0,
                    progress_hi=30.0,
                )
                face_segments_list = cluster_into_segments(face_samples)
            except Exception as e:
                logger.warning(f"Full-video face scan failed (non-fatal): {e}")
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

        # Per-sentence prosody enrichment (energy, pitch, speech rate).
        assign_sentence_prosody(sentences, rms_times, rms_values, f0_times, f0_values)

        # Top-level audio summary so downstream pipelines can decide whether
        # they need to load the transcript at all.
        total_words = sum(len(s.words) for s in sentences)
        speech_seconds = sum(max(0.0, s.end - s.start) for s in sentences)
        # "Present" = there's a transcribed word AND the audio has real energy
        # (a silent track can still produce stray Whisper artifacts).
        audio_present = total_words > 0 and prosody.mean_rms > 0.001
        audio_summary = AudioSummary(
            present=audio_present,
            total_words=total_words,
            words_per_minute=round((total_words / duration_s) * 60.0, 2) if duration_s > 0 else 0.0,
            speech_coverage=round(min(1.0, speech_seconds / duration_s), 3) if duration_s > 0 else 0.0,
        )

        # Persist full-video face data into the spatial DB for SQL queries.
        if face_samples:
            face_sample_rows = [
                {
                    "t": s["t"],
                    "face_x": s["face_x"], "face_y": s["face_y"],
                    "face_w": s["face_w"], "face_h": s["face_h"],
                    "detected": 1 if s["detected"] else 0,
                }
                for s in face_samples
            ]
            # Reopen the connection — it was closed at the end of Stage 3.
            conn = create_spatial_db(spatial_db_path)
            try:
                write_full_video_faces(conn, face_sample_rows)
                if face_segments_list:
                    seg_rows = [
                        {
                            "t_start": fs.t_start, "t_end": fs.t_end,
                            "bbox_x": fs.bbox_norm[0], "bbox_y": fs.bbox_norm[1],
                            "bbox_w": fs.bbox_norm[2], "bbox_h": fs.bbox_norm[3],
                            "free_regions": ",".join(fs.free_regions),
                            "sample_count": fs.sample_count,
                            "detection_rate": fs.detection_rate,
                        }
                        for fs in face_segments_list
                    ]
                    write_face_segments(conn, seg_rows)
            finally:
                conn.close()

        # Build video_context.json
        video_context = VideoContext(
            meta=VideoMeta(
                mode=mode,
                duration_s=round(duration_s, 3),
                resolution=[width, height],
                fps_original=round(fps_original, 2),
                fps_sampled_visual=sample_fps,
                highlight_window=highlight,
                audio=audio_summary,
            ),
            transcript=sentences,
            emphasis=emphasis,
            prosody=prosody,
            scenes=scenes,
            foreground=foreground if mode == "podcast" else None,
            face_segments=face_segments_list if mode == "podcast" else [],
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
