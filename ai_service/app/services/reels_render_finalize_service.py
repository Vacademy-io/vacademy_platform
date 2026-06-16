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
import re
import time
from typing import Optional

from ..config import get_settings
from ..repositories.ai_reel_repository import AiReelRepository
from ..services.render_service import RenderService
from ..services.reels_render_orchestrator import (
    RenderContext,
    STAGE_PIPELINE,
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

# The worker's 0-100 progress maps into the RENDER band of the overall bar.
# Derived from the orchestrator's pipeline so the two can't drift apart —
# the orchestrator already wrote `start_pct` when this stage began.
_RENDER_BAND = next(s for s in STAGE_PIPELINE if s.name == STAGE_RENDER)
STAGE_PROGRESS_FLOOR = _RENDER_BAND.start_pct
STAGE_PROGRESS_CEILING = _RENDER_BAND.end_pct

# The shared render worker caps concurrent jobs (render + indexing + PDF
# OCR all share the slots) and answers 429 when full. A slot frees in
# 1-3 min, so capacity exhaustion is transient by nature — failing the
# reel terminally after the user already sat through every prior stage is
# the worst outcome. Backoff schedule per retry; total wait fits well
# inside the reaper's staleness cutoff because we write a heartbeat before
# each sleep.
SUBMIT_BUSY_BACKOFF_S = (15, 30, 60)

# User-facing notes surfaced via `metadata.stage_note` while we wait for a
# worker slot, so the FE shows why the bar is parked instead of silence.
_WAITING_NOTE = "Waiting for a render slot — the render worker is at capacity. Retrying automatically."
_QUEUED_NOTE = "Waiting for a render slot — your reel is queued and will start shortly."

# Submit failures surface as RuntimeError("Render server returned <status>: …")
# from RenderService.submit — there's no typed status on the exception, so
# busy-detection parses the message. 429 = explicit capacity response;
# 503 = worker restarting/behind a draining LB, equally transient.
_SUBMIT_STATUS_RE = re.compile(r"Render server returned (\d{3})")
_BUSY_STATUSES = {429, 503}


def _is_worker_busy_error(exc: Exception) -> bool:
    msg = str(exc)
    m = _SUBMIT_STATUS_RE.search(msg)
    if m and int(m.group(1)) in _BUSY_STATUSES:
        return True
    return "busy" in msg.lower()


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
        reel_repo = AiReelRepository()
        job_id = self._submit_with_retry(
            rs,
            ctx,
            reel_repo,
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

        logger.info(f"[Render3e] {ctx.reel_id} submitted as job {job_id} ({width}x{height})")

        # 3. Poll until completion / failure / deadline.
        self._poll_until_done(rs, job_id, ctx, reel_repo)

    # ── Submission with busy-retry ────────────────────────────────────────

    def _submit_with_retry(
        self,
        rs: RenderService,
        ctx: RenderContext,
        reel_repo: AiReelRepository,
        **submit_kwargs,
    ) -> str:
        """Submit the job, retrying on worker-busy (429/503) with backoff.

        Non-busy failures (bad payload, auth, network exhaustion inside the
        client) raise immediately — only capacity contention is worth
        waiting out. Each wait writes a `stage_note` heartbeat so the FE
        explains the parked bar and the reaper sees a live updated_at."""
        attempts = len(SUBMIT_BUSY_BACKOFF_S) + 1
        waited = False
        for attempt in range(attempts):
            try:
                submit_result = rs.submit(**submit_kwargs)
                if waited:
                    # Drop the waiting note now that a slot was secured.
                    reel_repo.update_stage(
                        ctx.reel_pk,
                        current_stage=STAGE_RENDER,
                        progress=STAGE_PROGRESS_FLOOR,
                        stage_note=None,
                    )
                return submit_result
            except RuntimeError as e:
                if not _is_worker_busy_error(e) or attempt == attempts - 1:
                    raise RuntimeError(f"render worker submission failed: {e}")
                delay_s = SUBMIT_BUSY_BACKOFF_S[attempt]
                logger.warning(
                    f"[Render3e] {ctx.reel_id} worker busy on submit "
                    f"(attempt {attempt + 1}/{attempts}) — retrying in {delay_s}s: {e}"
                )
                reel_repo.update_stage(
                    ctx.reel_pk,
                    current_stage=STAGE_RENDER,
                    progress=STAGE_PROGRESS_FLOOR,
                    stage_note=_WAITING_NOTE,
                )
                waited = True
                time.sleep(delay_s)
        # Unreachable — the last loop iteration either returns or raises.
        raise RuntimeError("render worker submission failed: retries exhausted")

    # ── Polling loop ──────────────────────────────────────────────────────

    def _poll_until_done(
        self,
        rs: RenderService,
        job_id: str,
        ctx: RenderContext,
        reel_repo: AiReelRepository,
    ) -> None:
        """Block on the worker until terminal state. Intermediate progress
        writes go back to ai_reels via the AiReelRepository so the FE's
        status poll advances the bar through the RENDER band as the worker
        progresses."""
        started_at = time.monotonic()
        interval = INITIAL_POLL_INTERVAL_S
        last_written_progress = STAGE_PROGRESS_FLOOR
        # Whether metadata.stage_note currently shows the queued message —
        # written/cleared only on transitions to avoid jsonb churn per poll.
        queued_note_shown = False

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

            # Intermediate progress write. Map worker's 0-100 into the
            # RENDER band, monotonic (a transient "unknown" status reports
            # progress 0 — never walk the bar backwards for it).
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
            overall = max(overall, last_written_progress)

            # Queued jobs sit at zero progress for as long as the worker's
            # backlog lasts — tell the user why instead of a parked bar.
            note_kwargs: dict = {}
            if worker_status == "queued" and not queued_note_shown:
                note_kwargs["stage_note"] = _QUEUED_NOTE
                queued_note_shown = True
            elif worker_status != "queued" and queued_note_shown:
                note_kwargs["stage_note"] = None
                queued_note_shown = False

            # Heartbeat: write EVERY poll iteration, even when progress
            # hasn't moved. The reaper fails rows whose updated_at goes
            # stale — a long worker queue (job accepted but not started)
            # produces zero progress movement for minutes, and a healthy-
            # but-queued render must never look reapable. Poll cadence is
            # 3-15s, so the write volume is trivial.
            try:
                # Note: we ONLY update current_stage + progress (+ the
                # stage_note metadata key) here. The orchestrator owns the
                # `stages` list; updating it mid-flight from a stage
                # handler would race the orchestrator's bookkeeping.
                reel_repo.update_stage(
                    ctx.reel_pk,
                    current_stage=STAGE_RENDER,
                    progress=overall,
                    **note_kwargs,
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
