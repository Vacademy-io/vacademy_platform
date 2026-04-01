"""
Render Worker — Downloads inputs from S3, runs generate_video.py, uploads MP4.

Reuses the exact same Playwright + MoviePy + FFmpeg pipeline from
ai-video-gen-main/generate_video.py. The only difference is that inputs
come from S3 URLs instead of local paths.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Callable, Optional
from urllib.request import Request, urlopen

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger("render-worker")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

AWS_ACCESS_KEY = os.environ.get("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY", "")
AWS_REGION = os.environ.get("AWS_REGION", "ap-south-1")
S3_BUCKET = os.environ.get("AWS_S3_PUBLIC_BUCKET", "vacademy-media-storage-public")

# Path to generate_video.py (baked into Docker image)
RENDER_SCRIPT = Path(__file__).parent / "ai-video-gen-main" / "generate_video.py"
VIDEO_OPTIONS = Path(__file__).parent / "ai-video-gen-main" / "video_options.json"
CAPTIONS_SETTINGS = Path(__file__).parent / "ai-video-gen-main" / "captions_settings.json"
REPO_ROOT = Path(__file__).parent / "ai-video-gen-main"


class RenderWorker:
    """Downloads inputs, runs generate_video.py, uploads output."""

    def __init__(self):
        self._s3 = boto3.client(
            "s3",
            aws_access_key_id=AWS_ACCESS_KEY or None,
            aws_secret_access_key=AWS_SECRET_KEY or None,
            region_name=AWS_REGION,
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def render(
        self,
        video_id: str,
        timeline_url: str,
        audio_url: str,
        words_url: Optional[str] = None,
        branding_meta_url: Optional[str] = None,
        avatar_video_url: Optional[str] = None,
        show_captions: bool = True,
        audio_delay: float = 0.0,
        on_progress: Optional[Callable[[float], None]] = None,
    ) -> str:
        """
        Run the full render pipeline and return the S3 URL of the output MP4.

        Runs generate_video.py in a subprocess (blocking I/O offloaded
        to a thread so the event loop stays free).
        """
        work_dir = Path(tempfile.mkdtemp(prefix=f"render_{video_id}_"))
        logger.info(f"Work dir: {work_dir}")

        try:
            # ── Download inputs ──
            if on_progress:
                on_progress(5)

            audio_path = work_dir / "narration.mp3"
            timeline_path = work_dir / "time_based_frame.json"

            self._download(audio_url, audio_path)
            self._download(timeline_url, timeline_path)

            words_path = work_dir / "narration.words.json"
            if words_url:
                self._download(words_url, words_path)

            if branding_meta_url:
                branding_meta_path = work_dir / "branding_meta.json"
                self._download(branding_meta_url, branding_meta_path)
                # Override audio_delay from branding_meta if present
                try:
                    meta = json.loads(branding_meta_path.read_text())
                    bd = float(meta.get("intro_duration_seconds", 0.0))
                    if bd > 0:
                        audio_delay = bd
                        logger.info(f"Audio delay from branding_meta: {audio_delay}s")
                except Exception:
                    pass

            avatar_path: Optional[Path] = None
            if avatar_video_url:
                avatar_path = work_dir / "avatar_video.mp4"
                self._download(avatar_video_url, avatar_path)

            if on_progress:
                on_progress(15)

            # ── Parallel frame rendering ──
            # Split frames across N parallel Playwright processes for speed.
            # Each process renders a subset of frames, then we assemble with FFmpeg.
            NUM_WORKERS = int(os.environ.get("RENDER_PARALLEL_WORKERS", "2"))
            FPS = 22
            output_path = work_dir / "output.mp4"
            frames_dir = work_dir / ".render_frames"
            frames_dir.mkdir(parents=True, exist_ok=True)

            # First, compute total frames by doing a dry-run parse of timeline + audio
            import json as _json
            tl_data = _json.loads(timeline_path.read_text())
            if isinstance(tl_data, dict) and "entries" in tl_data:
                tl_entries = tl_data["entries"]
            else:
                tl_entries = tl_data
            from moviepy import AudioFileClip as _AFC
            _audio_dur = _AFC(str(audio_path)).duration
            tl_max_end = max((e.get("exitTime", 0) for e in tl_entries), default=0)
            total_duration = max(_audio_dur + audio_delay, tl_max_end)
            total_frames = int(total_duration * FPS) + 1
            logger.info(f"Total frames: {total_frames}, splitting across {NUM_WORKERS} workers")

            # Build base command (shared across all workers)
            base_cmd = [
                sys.executable,
                str(RENDER_SCRIPT),
                str(audio_path),
                str(timeline_path),
                str(output_path),  # not used in frames-only mode, but required arg
                "--frames-dir", str(frames_dir),
                "--background", "#000000",
                "--fps", str(FPS),
                "--frames-only",
            ]
            if VIDEO_OPTIONS.exists():
                base_cmd.extend(["--video-options", str(VIDEO_OPTIONS)])
            if words_url and words_path.exists():
                base_cmd.extend(["--captions-words", str(words_path)])
            if CAPTIONS_SETTINGS.exists():
                base_cmd.extend(["--captions-settings", str(CAPTIONS_SETTINGS)])
            if audio_delay > 0:
                base_cmd.extend(["--audio-delay", str(audio_delay)])
            if show_captions:
                base_cmd.append("--show-captions")

            # Split frame ranges
            chunk_size = (total_frames + NUM_WORKERS - 1) // NUM_WORKERS
            frame_ranges = []
            for i in range(NUM_WORKERS):
                start = i * chunk_size
                end = min(start + chunk_size, total_frames)
                if start < total_frames:
                    frame_ranges.append((start, end))

            if on_progress:
                on_progress(20)

            # Run workers in parallel
            logger.info(f"Launching {len(frame_ranges)} parallel render workers: {frame_ranges}")

            def _run_chunk(start: int, end: int) -> subprocess.CompletedProcess:
                chunk_cmd = base_cmd + ["--start-frame", str(start), "--end-frame", str(end)]
                return subprocess.run(
                    chunk_cmd,
                    check=False,
                    cwd=str(REPO_ROOT),
                    capture_output=True,
                    text=True,
                    timeout=5400,
                )

            loop = asyncio.get_event_loop()
            from concurrent.futures import ThreadPoolExecutor
            with ThreadPoolExecutor(max_workers=NUM_WORKERS) as pool:
                futures = [
                    loop.run_in_executor(pool, _run_chunk, start, end)
                    for start, end in frame_ranges
                ]
                results = await asyncio.gather(*futures)

            # Check all workers succeeded
            for i, result in enumerate(results):
                if result.returncode != 0:
                    logger.error(f"Worker {i} STDERR:\n{result.stderr[-2000:]}")
                    logger.error(f"Worker {i} STDOUT:\n{result.stdout[-1000:]}")
                    raise RuntimeError(
                        f"Render worker {i} (frames {frame_ranges[i]}) failed: "
                        f"{result.stderr[-500:]}"
                    )
                logger.info(f"Worker {i} done: {result.stdout[-200:]}")

            rendered_frames = sorted(frames_dir.glob("frame_*.png"))
            logger.info(f"Total rendered frames: {len(rendered_frames)}")

            if on_progress:
                on_progress(75)

            # ── Assemble with FFmpeg ──
            logger.info("Assembling video with FFmpeg...")
            ffmpeg_cmd = [
                "ffmpeg", "-y",
                "-framerate", str(FPS),
                "-i", str(frames_dir / "frame_%06d.png"),
                "-i", str(audio_path),
                "-filter_complex", f"[1:a]adelay={int(audio_delay * 1000)}|{int(audio_delay * 1000)}[delayed_audio]",
                "-map", "0:v",
                "-map", "[delayed_audio]",
                "-c:v", "libx264",
                "-pix_fmt", "yuv420p",
                "-crf", "23",
                "-preset", "fast",
                "-c:a", "aac",
                "-shortest",
                str(output_path),
            ]

            ffmpeg_result = await loop.run_in_executor(
                None,
                lambda: subprocess.run(
                    ffmpeg_cmd, check=False, capture_output=True, text=True, timeout=600
                ),
            )

            if ffmpeg_result.returncode != 0:
                logger.error(f"FFmpeg STDERR:\n{ffmpeg_result.stderr[-2000:]}")
                raise RuntimeError(f"FFmpeg assembly failed: {ffmpeg_result.stderr[-500:]}")

            if not output_path.exists():
                raise RuntimeError(f"FFmpeg completed but output.mp4 not found at {output_path}")

            logger.info(f"Video assembled: {output_path} ({output_path.stat().st_size / 1024 / 1024:.1f} MB)")

            if on_progress:
                on_progress(85)

            # ── Upload to S3 ──
            s3_key = f"ai-videos/{video_id}/video/output.mp4"
            video_url = self._upload(output_path, s3_key)
            logger.info(f"Uploaded to S3: {video_url}")

            if on_progress:
                on_progress(100)

            return video_url

        finally:
            # Clean up work directory
            try:
                shutil.rmtree(work_dir, ignore_errors=True)
                logger.info(f"Cleaned up {work_dir}")
            except Exception:
                pass

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _download(self, url: str, local_path: Path):
        """Download a file from S3 URL or any HTTP URL."""
        local_path.parent.mkdir(parents=True, exist_ok=True)

        # Try S3 download first (faster, no public URL needed)
        if S3_BUCKET and S3_BUCKET in url:
            try:
                parts = url.split(f"{S3_BUCKET}.s3.amazonaws.com/")
                if len(parts) == 2:
                    s3_key = parts[1]
                    self._s3.download_file(S3_BUCKET, s3_key, str(local_path))
                    logger.info(f"Downloaded (S3): {local_path.name}")
                    return
            except (ClientError, Exception) as e:
                logger.warning(f"S3 download failed, trying HTTP: {e}")

        # Fallback: HTTP download
        try:
            req = Request(url, headers={"User-Agent": "VacademyRenderWorker/1.0"})
            with urlopen(req, timeout=120) as resp:
                local_path.write_bytes(resp.read())
            logger.info(f"Downloaded (HTTP): {local_path.name}")
        except Exception as e:
            raise RuntimeError(f"Failed to download {url}: {e}")

    def _upload(self, local_path: Path, s3_key: str) -> str:
        """Upload a file to S3 and return the public URL."""
        self._s3.upload_file(
            str(local_path),
            S3_BUCKET,
            s3_key,
            ExtraArgs={"ContentType": "video/mp4"},
        )
        return f"https://{S3_BUCKET}.s3.amazonaws.com/{s3_key}"
