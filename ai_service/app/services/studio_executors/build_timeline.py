"""
ASSEMBLE_TIMELINE stage — build the `{meta, entries}` timeline from the
build's plan snapshot and stash it on the context for UPLOAD.

Pure CPU (timeline builder is deterministic); runs in-loop. Raises if the
plan yields zero entries (nothing to build) so the build fails loudly rather
than handing the editor an empty timeline.
"""
from __future__ import annotations

import logging

from .. import studio_timeline_builder
from ..studio_orchestrator import STAGE_BUILD_TIMELINE, BuildContext, register_stage_handler

logger = logging.getLogger(__name__)


async def _build_timeline_stage(ctx: BuildContext) -> None:
    plan = ctx.plan_snapshot or {}
    timeline = studio_timeline_builder.build_timeline(
        arrangement=plan.get("arrangement"),
        cuts_plan=plan.get("cuts"),
        asset_kinds=ctx.asset_kinds,
        source_urls=ctx.source_urls,
        aspect=ctx.aspect,
        fps=ctx.fps,
    )
    entries = timeline.get("entries") or []
    if not entries:
        raise ValueError(
            "plan produced no timeline entries — confirm an arrangement with at "
            "least one clip before building"
        )
    ctx.timeline = timeline
    ctx.extra_metadata["entry_count"] = len(entries)
    ctx.extra_metadata["total_duration"] = timeline["meta"]["total_duration"]
    logger.info(
        f"[StudioBuild] {ctx.build_id} assembled {len(entries)} entries, "
        f"{timeline['meta']['total_duration']}s"
    )


register_stage_handler(STAGE_BUILD_TIMELINE, _build_timeline_stage)
