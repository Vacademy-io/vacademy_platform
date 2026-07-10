"""Startup sweeper for orphaned ai_gen_video rows.

The AI-video pipeline runs stages as in-process asyncio tasks (the course-flow
HTML continuation is fire-and-forget); a deploy/crash kills them silently and
the row stays PENDING/IN_PROGRESS forever — the slide viewer then spins
"generating" indefinitely and the charged credits are never refunded.

Mirrors sweep_stale_tasks (ai_task) / the reels reaper: on startup, rows stuck
in a non-terminal status past the TTL are marked FAILED and their credits
refunded (institute recovered from the charge transactions, batch_id=video_id).
Best-effort — a sweeper failure must never block boot.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta

from sqlalchemy import text

from ..db import db_session
from ..models.ai_gen_video import AiGenVideo
from .token_usage_service import TokenUsageService

logger = logging.getLogger(__name__)

# Generous TTL: the longest legitimate runs (ultra-tier HTML with images) take
# well under an hour; anything older than this is orphaned.
STALE_AFTER_HOURS = 6


def sweep_stale_ai_videos() -> int:
    """Refund credits for orphaned PENDING/IN_PROGRESS ai_gen_video rows and
    mark them FAILED. Returns the number of rows swept.

    Order matters: refund FIRST, then flip the status. refund_video_credits is
    idempotent (it nets prior REFUND rows against USAGE_DEDUCTION), so a crash
    between the two just re-nets to zero on the next sweep — whereas marking
    FAILED first would permanently skip the refund (FAILED rows are never
    revisited)."""
    swept = 0
    try:
        cutoff = datetime.utcnow() - timedelta(hours=STALE_AFTER_HOURS)
        with db_session() as db:
            stale = (
                db.query(AiGenVideo)
                .filter(
                    AiGenVideo.status.in_(("PENDING", "IN_PROGRESS")),
                    AiGenVideo.updated_at < cutoff,
                )
                .all()
            )
            token_service = TokenUsageService(db)
            for video in stale:
                try:
                    row = db.execute(
                        text(
                            "SELECT institute_id FROM credit_transactions "
                            "WHERE batch_id = :vid AND transaction_type = 'USAGE_DEDUCTION' "
                            "AND institute_id IS NOT NULL LIMIT 1"
                        ),
                        {"vid": video.video_id},
                    ).fetchone()
                    if row and row.institute_id:
                        token_service.refund_video_credits(video.video_id, row.institute_id)
                except Exception as exc:  # noqa: BLE001
                    logger.warning(
                        "Sweeper refund failed for %s: %s", video.video_id, exc
                    )
                video.status = "FAILED"
                video.error_message = (
                    f"Marked failed by sweeper: stuck in "
                    f"{video.current_stage or 'UNKNOWN'} for over {STALE_AFTER_HOURS}h "
                    f"(process likely restarted mid-generation)"
                )
                swept += 1
            db.commit()
        if swept:
            logger.warning("ai_gen_video sweeper: marked %d orphaned run(s) FAILED", swept)
    except Exception as exc:  # noqa: BLE001
        logger.warning("ai_gen_video sweeper skipped: %s", exc)
    return swept


# Re-sweep interval: a crash orphans rows that are younger than the TTL when
# the replacement pod boots — a startup-only sweep would miss them until some
# future restart. 30 min keeps the worst-case wait at TTL + 30 min.
SWEEP_INTERVAL_SECONDS = 30 * 60


def start_ai_video_sweeper() -> None:
    """Run one sweep now, then re-sweep periodically (mirrors the reels reaper)."""
    import asyncio

    async def _loop() -> None:
        while True:
            await asyncio.sleep(SWEEP_INTERVAL_SECONDS)
            await asyncio.to_thread(sweep_stale_ai_videos)

    sweep_stale_ai_videos()
    asyncio.get_event_loop().create_task(_loop())


__all__ = [
    "sweep_stale_ai_videos",
    "start_ai_video_sweeper",
    "STALE_AFTER_HOURS",
    "SWEEP_INTERVAL_SECONDS",
]
