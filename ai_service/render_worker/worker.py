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

            # ── Build render command ──
            output_path = work_dir / "output.mp4"
            frames_dir = work_dir / ".render_frames"

            cmd = [
                sys.executable,
                str(RENDER_SCRIPT),
                str(audio_path),
                str(timeline_path),
                str(output_path),
                "--frames-dir", str(frames_dir),
                "--background", "#000000",
            ]

            if VIDEO_OPTIONS.exists():
                cmd.extend(["--video-options", str(VIDEO_OPTIONS)])
            if words_url and words_path.exists():
                cmd.extend(["--captions-words", str(words_path)])
            if CAPTIONS_SETTINGS.exists():
                cmd.extend(["--captions-settings", str(CAPTIONS_SETTINGS)])
            if audio_delay > 0:
                cmd.extend(["--audio-delay", str(audio_delay)])
            if show_captions:
                cmd.append("--show-captions")
            if avatar_path and avatar_path.exists():
                cmd.extend(["--avatar-video", str(avatar_path)])

            logger.info(f"Render command: {' '.join(cmd[:6])}...")

            # ── Run generate_video.py ──
            if on_progress:
                on_progress(20)

            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: subprocess.run(
                    cmd,
                    check=True,
                    cwd=str(REPO_ROOT),
                    capture_output=True,
                    text=True,
                    timeout=1800,  # 30-minute timeout
                ),
            )
            logger.info(f"Render stdout (last 500 chars): ...{result.stdout[-500:]}")

            if not output_path.exists():
                raise RuntimeError(f"Render completed but output.mp4 not found at {output_path}")

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
