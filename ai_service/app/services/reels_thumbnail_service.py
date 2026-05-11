"""
Thumbnail generation for reel candidates (Gate 1 /scan).

Generates one still frame per candidate window — taken at the window's
midpoint, scaled to 320px wide, uploaded to S3. The FE shows this frame
as the candidate card poster; a future iteration can upgrade to a
short looping clip (FE Phase B).

Design:
- ffmpeg seeks via HTTPS range request on the source URL (no full download).
- Upload to S3 under `ai-reels/thumbnails/{candidate_id}.jpg`.
- Wrapped in `asyncio.to_thread` so callers can `asyncio.gather` many at once.
- Per-thumbnail wall-time budget capped (default 4s). Failures return None
  — FE renders a placeholder; this is non-blocking polish, not a hard
  requirement of the scan response.
"""
from __future__ import annotations

import asyncio
import logging
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Optional

from .s3_service import S3Service

logger = logging.getLogger(__name__)


# Per-thumbnail budget in seconds. Beyond this, ffmpeg is killed and we
# log a warning. The /scan flow proceeds; the row keeps `thumbnail_strip_url=NULL`
# and the FE shows a placeholder.
FFMPEG_TIMEOUT_S = 4

# Output frame size. 320px-wide gives a sharp 9:16 card thumb (~180×320) and
# a clean 16:9 card thumb (~320×180) without being expensive.
THUMB_WIDTH_PX = 320


class ReelsThumbnailService:
    """Single still-frame thumbnails for reel candidates."""

    def __init__(self, s3: Optional[S3Service] = None):
        self._s3 = s3
        self._ffmpeg_path = shutil.which("ffmpeg") or "ffmpeg"

    def _ensure_s3(self) -> S3Service:
        if self._s3 is None:
            self._s3 = S3Service()
        return self._s3

    # ── Sync entry point (one candidate) ──────────────────────────────────

    def generate_one_sync(
        self,
        source_url: str,
        t_midpoint: float,
        candidate_id: str,
    ) -> Optional[str]:
        """Generate one thumbnail. Blocking — call from a thread or executor.

        Returns the S3 public URL, or None on any failure (network, ffmpeg,
        upload). Errors are logged but never raised — thumbnails are
        best-effort polish.
        """
        if not source_url:
            return None
        if t_midpoint < 0:
            return None

        out_dir = Path(tempfile.mkdtemp(prefix="reels-thumb-"))
        out_path = out_dir / f"{candidate_id}.jpg"

        try:
            # `-ss <t> -i <url>` (seek BEFORE input) does a fast keyframe
            # seek via HTTPS range requests — does NOT download the whole
            # source. `-frames:v 1` grabs one frame. `-vf scale` resizes.
            cmd = [
                self._ffmpeg_path,
                "-hide_banner", "-loglevel", "error", "-y",
                "-ss", f"{max(0.0, t_midpoint):.3f}",
                "-i", source_url,
                "-frames:v", "1",
                "-vf", f"scale={THUMB_WIDTH_PX}:-2",
                "-q:v", "4",  # JPEG quality 1-31, 4 is high quality / small
                str(out_path),
            ]
            try:
                subprocess.run(
                    cmd,
                    check=True,
                    capture_output=True,
                    timeout=FFMPEG_TIMEOUT_S,
                )
            except subprocess.TimeoutExpired:
                logger.warning(
                    f"Thumbnail ffmpeg timeout (>{FFMPEG_TIMEOUT_S}s) for "
                    f"candidate {candidate_id} at t={t_midpoint}"
                )
                return None
            except subprocess.CalledProcessError as e:
                stderr = (e.stderr or b"").decode("utf-8", errors="replace")[:300]
                logger.warning(
                    f"Thumbnail ffmpeg failed for candidate {candidate_id}: {stderr}"
                )
                return None

            if not out_path.exists() or out_path.stat().st_size == 0:
                logger.warning(f"Thumbnail ffmpeg produced no output for {candidate_id}")
                return None

            try:
                s3 = self._ensure_s3()
            except Exception as e:
                logger.error(f"Thumbnail S3 init failed: {e}")
                return None

            s3_key = f"ai-reels/thumbnails/{candidate_id}.jpg"
            try:
                url = s3.upload_file(out_path, s3_key=s3_key, content_type="image/jpeg")
            except Exception as e:
                logger.warning(f"Thumbnail S3 upload failed for {candidate_id}: {e}")
                return None

            return url
        finally:
            # rmtree handles non-empty dirs (e.g. ffmpeg crashed mid-write and
            # left partials) and silently no-ops on already-deleted dirs.
            shutil.rmtree(out_dir, ignore_errors=True)

    # ── Async batch (concurrent ffmpeg via thread pool) ───────────────────

    async def generate_batch(
        self,
        source_url: str,
        candidates: list[tuple[str, float]],
    ) -> dict[str, Optional[str]]:
        """Generate thumbnails for many candidates concurrently.

        `candidates` is a list of `(candidate_id, t_midpoint)` pairs.
        Returns `{candidate_id: thumbnail_url_or_None}`.

        Concurrency is bounded implicitly by the default asyncio thread pool
        size (typically 32). For a 30-candidate scan that's fine; if we need
        finer control later, swap in a semaphore.
        """
        if not candidates:
            return {}

        async def _one(cid: str, t: float) -> tuple[str, Optional[str]]:
            try:
                url = await asyncio.to_thread(
                    self.generate_one_sync, source_url, t, cid
                )
            except Exception as e:
                logger.warning(f"Thumbnail batch worker error for {cid}: {e}")
                url = None
            return cid, url

        results = await asyncio.gather(
            *(_one(cid, t) for cid, t in candidates),
            return_exceptions=False,
        )
        return dict(results)
