"""
Gate 3e — RENDER stage (final).

Hands the assembled `{meta, entries}` payload + speaker audio off to the
existing render worker (Hetzner box that runs the playwright-based
generate_video pipeline), polls until the final MP4 lands, writes the URL
to `ctx.s3_urls['video']`.

The render worker is reused as-is — no worker-side changes per plan §6.
We just submit a job with the same shape the generation pipeline uses.

Key differences from the generation pipeline's render submission:
  - `source_video_urls` includes our `speaker_clip` so the worker rewrites
    the `<video data-source-clip src=...>` URLs in our entries to local
    paths before rendering.
  - `show_captions=False` — our captions are already entries in the
    timeline; we don't want the worker overlaying a second caption track
    from a words.json file.
  - `audio_delay=0` — our audio + video are already aligned via trim_map.
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Optional

from ..config import get_settings
from ..repositories.ai_reel_repository import AiReelRepository
from ..services.render_service import RenderService
from ..services.reels_render_orchestrator import (
    RenderContext,
    STAGE_RENDER,
    register_stage_handler,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Polling config
# ---------------------------------------------------------------------------

# Total render budget. A 60s vertical reel typically renders in 60-120s on
# the worker; 10 minutes is comfortable headroom for outliers.
RENDER_DEADLINE_S = 600

# Poll cadence. Slightly aggressive at first (worker is fast for short
# reels) then ramps to be gentle on the worker.
INITIAL_POLL_INTERVAL_S = 3
MAX_POLL_INTERVAL_S = 15

# RENDER stage occupies overall progress 90-100. We map the worker's
# 0-100 progress into this band for intermediate writes.
STAGE_PROGRESS_FLOOR = 90
STAGE_PROGRESS_CEILING = 100

# How often to write intermediate progress back to ai_reels. Don't churn
# the DB on every poll — write only on meaningful change.
PROGRESS_WRITE_THRESHOLD = 5  # % overall (i.e., 50% worker progress)


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class ReelsRenderFinalizeService:
    """Submits + polls the existing render worker."""

    def __init__(self, render_service: Optional[RenderService] = None):
        self._render_service = render_service

    def _ensure_render_service(self) -> RenderService:
        if self._render_service is None:
            settings = get_settings()
            self._render_service = RenderService(
                render_server_url=settings.render_server_url,
                render_key=settings.render_server_key,
            )
        return self._render_service

    def run(self, ctx: RenderContext) -> None:
        """Submit, poll until done. Writes `ctx.s3_urls['video']` on
        success. Raises on timeout or worker failure."""
        # 1. Validate inputs.
        timeline_url = (ctx.s3_urls or {}).get("time_based_frame")
        audio_url = (ctx.s3_urls or {}).get("speaker_audio")
        speaker_clip_url = (ctx.s3_urls or {}).get("speaker_clip")
        if not timeline_url:
            raise RuntimeError("time_based_frame URL not set — ASSEMBLE must run before RENDER")
        if not audio_url:
            raise RuntimeError("speaker_audio URL not set — AUDIO_EDIT must run before RENDER")
        if not speaker_clip_url:
            raise RuntimeError("speaker_clip URL not set — SOURCE_CLIP must run before RENDER")

        out_res = (ctx.extra_metadata or {}).get("output_resolution") or {}
        width = int(out_res.get("width") or 1080)
        height = int(out_res.get("height") or 1920)

        # 2. Worker handoff.
        rs = self._ensure_render_service()
        if not rs.is_configured:
            raise RuntimeError(
                "RENDER_SERVER_URL not configured — render worker unreachable"
            )

        # Submit. The worker rewrites `<video data-source-clip src=URL>` in
        # the timeline JSON to local paths after downloading the URLs in
        # source_video_urls. show_captions=False because OUR captions are
        # entries in the timeline — we don't want a second overlay track.
        try:
            job_id = rs.submit(
                video_id=ctx.reel_id,
                timeline_url=timeline_url,
                audio_url=audio_url,
                source_video_urls=[speaker_clip_url],
                width=width,
                height=height,
                show_captions=False,
                show_branding=False,
                audio_delay=0.0,
            )
        except RuntimeError as e:
            raise RuntimeError(f"render worker submission failed: {e}")

        logger.info(f"[Render3e] {ctx.reel_id} submitted as job {job_id} ({width}x{height})")

        # 3. Poll until completion / failure / deadline.
        self._poll_until_done(rs, job_id, ctx)

    # ── Polling loop ──────────────────────────────────────────────────────

    def _poll_until_done(
        self,
        rs: RenderService,
        job_id: str,
        ctx: RenderContext,
    ) -> None:
        """Block on the worker until terminal state. Intermediate progress
        writes go back to ai_reels via the AiReelRepository so the FE's
        status poll advances the bar from 90→100 as the worker progresses."""
        reel_repo = AiReelRepository()
        started_at = time.monotonic()
        interval = INITIAL_POLL_INTERVAL_S
        last_written_progress = STAGE_PROGRESS_FLOOR

        while True:
            elapsed = time.monotonic() - started_at
            if elapsed > RENDER_DEADLINE_S:
                # Best-effort cancel signal: just abandon the job.
                raise RuntimeError(
                    f"render exceeded deadline of {RENDER_DEADLINE_S}s "
                    f"(worker job {job_id} status last unknown)"
                )

            time.sleep(interval)
            interval = min(MAX_POLL_INTERVAL_S, interval + 2)

            resp = rs.check_status(job_id)
            worker_status = resp.get("status", "unknown")

            if worker_status == "completed":
                video_url = resp.get("video_url")
                if not video_url:
                    raise RuntimeError(
                        f"worker reported completed but produced no video_url "
                        f"(job {job_id}): {resp!r}"
                    )
                ctx.s3_urls["video"] = video_url
                # Stash the worker's reported job_id in metadata for debug.
                ctx.extra_metadata["render_job_id"] = job_id
                ctx.extra_metadata["render_duration_s"] = round(
                    time.monotonic() - started_at, 1
                )
                logger.info(
                    f"[Render3e] {ctx.reel_id} render completed in "
                    f"{ctx.extra_metadata['render_duration_s']}s → {video_url}"
                )
                return

            if worker_status == "failed":
                err = resp.get("error") or "unknown render error"
                raise RuntimeError(f"render worker failed: {err}")

            if worker_status not in ("running", "queued", "unknown"):
                # Defensive — unknown status string from worker.
                logger.warning(
                    f"[Render3e] {ctx.reel_id} unexpected worker status "
                    f"{worker_status!r}, continuing to poll"
                )
                continue

            # Intermediate progress write. Map worker's 0-100 into 90-100.
            wp_raw = resp.get("progress")
            try:
                worker_progress = int(wp_raw) if wp_raw is not None else 0
                worker_progress = max(0, min(100, worker_progress))
            except (TypeError, ValueError):
                worker_progress = 0
            overall = STAGE_PROGRESS_FLOOR + int(
                round(
                    (STAGE_PROGRESS_CEILING - STAGE_PROGRESS_FLOOR)
                    * worker_progress / 100.0
                )
            )
            # Cap at one-below-ceiling so we don't appear "done" until the
            # orchestrator's COMPLETED write fires.
            overall = min(overall, STAGE_PROGRESS_CEILING - 1)

            if overall - last_written_progress >= PROGRESS_WRITE_THRESHOLD:
                try:
                    # Note: we ONLY update current_stage + progress here.
                    # The orchestrator owns the `stages` list; updating it
                    # mid-flight from a stage handler would race the
                    # orchestrator's bookkeeping.
                    reel_repo.update_stage(
                        ctx.reel_pk,
                        current_stage=STAGE_RENDER,
                        progress=overall,
                    )
                    last_written_progress = overall
                except Exception as e:
                    logger.warning(
                        f"[Render3e] {ctx.reel_id} intermediate progress write failed: {e}"
                    )


# ---------------------------------------------------------------------------
# Stage registration
# ---------------------------------------------------------------------------

async def _render_stage(ctx: RenderContext) -> None:
    """Async handler — offloads the blocking submit + poll loop to a thread
    so the asyncio loop stays responsive."""
    svc = ReelsRenderFinalizeService()
    await asyncio.to_thread(svc.run, ctx)


register_stage_handler(STAGE_RENDER, _render_stage)
