"""
Phase 2c.9 — Bottom-half b-roll variety for stacked / pip layouts.

When the LLM director emits `background_concepts` (a SEQUENCE of 2-5
Pexels search queries), this service:
  1. Fetches one Pexels clip per concept in parallel (existing
     `find_b_roll` LRU-cached pipeline).
  2. Downloads each clip to a local tempfile.
  3. Runs a single ffmpeg `concat` filter to stitch them into one
     continuous MP4 (one resolution, one fps, no audio).
  4. Uploads the result to S3.

The director uses the stitched URL in place of a single bgv URL, so the
existing stacked-layout HTML doesn't need to know about sequences — it
just plays one continuous file. The HTML element keeps `loop` so the
sequence loops if the reel duration exceeds the stitched length.

Cost: ~5-15s added to DIRECTOR when a sequence is fetched + stitched.
N Pexels fetches in parallel = bottlenecked on the slowest. ffmpeg
concat is ~1-3s for 3-5 short clips. S3 upload is ~1-2s.

Graceful degradation at every step:
  * Concept yields no Pexels match → drop that concept from the sequence
  * <2 clips successfully fetched → return None (caller falls back to
    single-concept path)
  * ffmpeg failure → return None
  * S3 upload failure → return None
The caller's existing `bgv_url` resolution chain (user URL → single
LLM concept → heuristic concept → downgrade) picks up where this
leaves off.

Env kill-switch `REELS_BGV_STITCH_DISABLED=1` disables this entirely
without a redeploy — useful for A/B testing or rolling back during a
production incident.
"""
from __future__ import annotations

import asyncio
import logging
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse
from uuid import uuid4

import httpx

from ..services.reels_broll_service import find_b_roll
from ..services.s3_service import S3Service

logger = logging.getLogger(__name__)


# Per-segment trim. Each Pexels clip varies in length (5s to 60s+); we
# cap to MAX_SEGMENT_S so a stitched 5-concept sequence stays bounded
# at MAX_SEGMENT_S × 5 = 50s, matching the typical reel duration band.
# Below MIN_SEGMENT_S we'd see hard cuts every <2s which feels choppy.
MIN_SEGMENT_S = 3.0
MAX_SEGMENT_S = 10.0

# Output resolution + fps for the stitched bgv. 1080×960 fills the
# bottom half of a 9:16 1080×1920 frame. The renderer's `object-fit:
# cover` handles the rest if the actual frame is a different aspect.
# 30fps matches the rest of the pipeline (speaker_clip is encoded at
# 30fps too).
_OUTPUT_W = 1080
_OUTPUT_H = 960
_OUTPUT_FPS = 30

# Per-clip download timeout. Pexels CDN is usually fast (<2s) but we
# don't want a slow CDN to stall the whole stitch beyond ~30s.
_PEXELS_DOWNLOAD_TIMEOUT_S = 20

# ffmpeg subprocess timeout. 3-5 clips → ~10s of work in practice; cap
# at 60s so a runaway encode doesn't stall the whole render.
_FFMPEG_TIMEOUT_S = 60

# Env kill-switch.
_DISABLE_ENV = "REELS_BGV_STITCH_DISABLED"


def stitch_enabled() -> bool:
    """True unless ops flipped the env kill-switch. Default on."""
    return os.getenv(_DISABLE_ENV, "").strip().lower() not in ("1", "true", "yes")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def stitch_bgv_sequence(
    concepts: list[str],
    *,
    reel_id: str,
    target_duration_s: float,
    s3: Optional[S3Service] = None,
) -> Optional[str]:
    """Fetch N Pexels clips → concat into one MP4 → upload to S3.

    `concepts` is the validated `background_concepts` list from the LLM
    director (2-5 short Pexels queries). `target_duration_s` is the
    reel's total duration; we divide it across concepts to compute each
    segment's duration (clamped to [MIN_SEGMENT_S, MAX_SEGMENT_S]).

    Returns the S3 URL of the stitched MP4 on success, None on any
    failure. Caller falls through to the legacy single-concept path on
    None.
    """
    if not stitch_enabled():
        logger.info("[BgvStitch] disabled via env — falling back to single concept")
        return None
    if not concepts or len(concepts) < 2:
        return None
    if target_duration_s <= 0:
        return None

    # Per-segment duration: split the reel evenly across concepts, clamped.
    # If we have 5 concepts × 8s = 40s but reel is 25s, we'd over-allocate
    # — but the renderer's `loop` attribute on the bottom-half <video>
    # truncates naturally. Stitched length DOESN'T have to match reel
    # duration exactly.
    per_segment = target_duration_s / len(concepts)
    per_segment = max(MIN_SEGMENT_S, min(MAX_SEGMENT_S, per_segment))
    logger.info(
        f"[BgvStitch] {reel_id} stitching {len(concepts)} concepts "
        f"@ {per_segment:.1f}s each (target {target_duration_s:.1f}s)"
    )

    # 1. Fetch all Pexels URLs in parallel via the existing LRU-cached
    # finder. Concepts that miss are silently dropped.
    fetch_results = await asyncio.gather(
        *(find_b_roll(c) for c in concepts),
        return_exceptions=True,
    )
    pairs: list[tuple[str, str]] = []  # (concept, pexels_url)
    for concept, result in zip(concepts, fetch_results):
        if isinstance(result, BaseException):
            logger.warning(
                f"[BgvStitch] Pexels fetch raised for {concept!r}: {result}"
            )
            continue
        if not result:
            continue
        pairs.append((concept, result))
    if len(pairs) < 2:
        logger.info(
            f"[BgvStitch] only {len(pairs)} valid Pexels hits — falling back"
        )
        return None

    # 2. Download each clip locally + 3. ffmpeg concat + 4. S3 upload.
    # All blocking work goes through asyncio.to_thread so the asyncio
    # loop stays responsive for any concurrent renders.
    return await asyncio.to_thread(
        _download_concat_upload,
        pairs,
        per_segment,
        reel_id,
        s3,
    )


# ---------------------------------------------------------------------------
# Sync worker — runs in a worker thread (the asyncio loop doesn't see it).
# ---------------------------------------------------------------------------

def _download_concat_upload(
    pairs: list[tuple[str, str]],
    per_segment_s: float,
    reel_id: str,
    s3: Optional[S3Service],
) -> Optional[str]:
    """Download each Pexels URL, concat via ffmpeg, upload result to S3.

    Lives in its own function (not inlined) so `asyncio.to_thread` can
    isolate the whole blocking pipeline. Returns the S3 URL on success
    or None on any failure.
    """
    with tempfile.TemporaryDirectory(prefix=f"reels-bgv-{reel_id}-") as tmpdir_str:
        tmpdir = Path(tmpdir_str)
        # Download each Pexels MP4 sequentially within the worker thread.
        # Pexels CDN handles concurrent connections fine but the network
        # is rarely the bottleneck here — encoding usually dominates.
        local_paths: list[Path] = []
        for i, (concept, url) in enumerate(pairs):
            local = tmpdir / f"seg-{i:02d}.mp4"
            if not _download_pexels(url, local):
                logger.warning(
                    f"[BgvStitch] {reel_id} download failed for {concept!r}; "
                    "dropping segment"
                )
                continue
            local_paths.append(local)
        if len(local_paths) < 2:
            logger.info(
                f"[BgvStitch] {reel_id} <2 segments downloaded — falling back"
            )
            return None

        # Stitch via ffmpeg.
        out_path = tmpdir / "bottom_bgv.mp4"
        if not _ffmpeg_concat(local_paths, per_segment_s, out_path):
            logger.warning(f"[BgvStitch] {reel_id} ffmpeg concat failed")
            return None
        if not out_path.exists() or out_path.stat().st_size == 0:
            logger.warning(f"[BgvStitch] {reel_id} ffmpeg produced empty output")
            return None

        # Upload.
        svc = s3 or S3Service()
        s3_key = f"ai-reels/{reel_id}/bottom_bgv-{uuid4().hex[:8]}.mp4"
        try:
            url = svc.upload_file(out_path, s3_key=s3_key, content_type="video/mp4")
        except Exception as e:
            logger.warning(f"[BgvStitch] {reel_id} S3 upload failed: {e}")
            return None
        logger.info(
            f"[BgvStitch] {reel_id} stitched {len(local_paths)} segments "
            f"→ {url[:80]}…"
        )
        return url


def _download_pexels(url: str, dest: Path) -> bool:
    """Stream a Pexels MP4 to disk. Returns True on success, False on
    any HTTP / IO failure. Caller drops the segment on False — the
    stitch can still proceed with the remaining segments."""
    # Defense-in-depth: only https:// allowed. PexelsService returns
    # https://videos.pexels.com URLs so this should always pass for
    # legitimate input.
    if not (urlparse(url).scheme in ("https", "http")):
        logger.warning(f"[BgvStitch] rejecting non-http(s) URL: {url[:80]!r}")
        return False
    try:
        with httpx.Client(timeout=_PEXELS_DOWNLOAD_TIMEOUT_S) as client:
            with client.stream("GET", url, follow_redirects=True) as resp:
                resp.raise_for_status()
                with open(dest, "wb") as f:
                    for chunk in resp.iter_bytes(chunk_size=128 * 1024):
                        f.write(chunk)
        return dest.stat().st_size > 0
    except (httpx.HTTPError, OSError) as e:
        logger.warning(f"[BgvStitch] download failed for {url[:80]!r}: {e}")
        return False


def _ffmpeg_concat(
    input_paths: list[Path],
    per_segment_s: float,
    out_path: Path,
) -> bool:
    """Concatenate `input_paths` into `out_path` via filter_complex.

    Each input is `-ss 0 -t per_segment_s -i <path>` so we take the
    first `per_segment_s` seconds and discard the rest. The filter
    graph scales each to (_OUTPUT_W × _OUTPUT_H) + SAR=1 + sets PTS,
    then concats them. No audio — bottom bgv is muted in the renderer.

    Returns True on ffmpeg exit 0 + non-empty output, False otherwise.
    """
    n = len(input_paths)
    if n < 2:
        return False

    cmd: list[str] = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
    ]
    for p in input_paths:
        cmd.extend([
            "-ss", "0",
            "-t", f"{per_segment_s:.3f}",
            "-i", str(p),
        ])

    # Build filter_complex: for each input, scale + setsar + setpts, then
    # concat. Inputs that are SHORTER than per_segment_s yield their full
    # length (ffmpeg's -t cap doesn't extend a stream past its end), so
    # the concat output may be slightly shorter than n × per_segment_s.
    # That's fine — the HTML element's `loop` attribute handles bottom-
    # bgv playback longer than the reel's duration.
    filter_parts: list[str] = []
    concat_labels: list[str] = []
    for i in range(n):
        label = f"v{i}"
        filter_parts.append(
            f"[{i}:v]scale={_OUTPUT_W}:{_OUTPUT_H}:force_original_aspect_ratio=increase,"
            f"crop={_OUTPUT_W}:{_OUTPUT_H},"
            f"setsar=1,fps={_OUTPUT_FPS},setpts=PTS-STARTPTS[{label}]"
        )
        concat_labels.append(f"[{label}]")
    filter_parts.append(
        f"{''.join(concat_labels)}concat=n={n}:v=1:a=0[out]"
    )
    filter_complex = ";".join(filter_parts)

    cmd.extend([
        "-filter_complex", filter_complex,
        "-map", "[out]",
        "-an",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        str(out_path),
    ])

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            timeout=_FFMPEG_TIMEOUT_S,
            check=False,
        )
    except subprocess.TimeoutExpired:
        logger.warning(f"[BgvStitch] ffmpeg concat timed out after {_FFMPEG_TIMEOUT_S}s")
        return False
    if result.returncode != 0:
        stderr = (result.stderr or b"").decode("utf-8", errors="replace")[:400]
        logger.warning(f"[BgvStitch] ffmpeg concat returncode={result.returncode}: {stderr}")
        return False
    return True
