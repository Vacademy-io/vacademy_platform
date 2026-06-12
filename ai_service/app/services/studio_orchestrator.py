"""
Studio build orchestrator — async background runner that turns a confirmed
plan snapshot into an editor-ready `{meta, entries}` timeline in S3.

Mirrors the reels orchestrator pattern (StageDef bands, register_stage_handler,
dispatch with a GC-safe pending-task set, per-stage progress persisted on the
row). The stages:

  PENDING           → starting state
  ASSEMBLE_TIMELINE → assemble {meta, entries} from the plan snapshot
  COMPOSE_HTML      → append confirmed title/text overlay entries (P6a)
  ASSEMBLE_WORDS    → captions words track, if enabled (P6b)
  ASSEMBLE_AUDIO    → master soundtrack from the source clips + bgm/sfx (P7)
  UPLOAD            → S3 PUT timeline.json under ai-studio/{build_id}/
  HANDOFF           → flip build → AWAITING_EDIT (FE polls + opens the editor)

RENDER-to-MP4 happens later, from inside the editor (POST /builds/{id}/render,
P5). Any stage exception → terminal FAILED with the stage name surfaced.
"""
from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Dict, List, Optional

from ..repositories.ai_studio_build_repository import AiStudioBuildRepository

logger = logging.getLogger(__name__)

# Stage constants.
STAGE_PENDING = "PENDING"
STAGE_BUILD_TIMELINE = "ASSEMBLE_TIMELINE"
STAGE_COMPOSE_HTML = "COMPOSE_HTML"  # P6a: append title/text overlay entries
STAGE_ASSEMBLE_WORDS = "ASSEMBLE_WORDS"  # P6b: build captions words track (if enabled)
STAGE_ASSEMBLE_AUDIO = "ASSEMBLE_AUDIO"  # P7: master soundtrack + bgm/sfx
STAGE_UPLOAD = "UPLOAD"
STAGE_HANDOFF = "HANDOFF"
STAGE_FAILED = "FAILED"


@dataclass(frozen=True)
class StageDef:
    name: str
    start_pct: int
    end_pct: int


STAGE_PIPELINE = [
    StageDef(STAGE_BUILD_TIMELINE, 0, 30),
    StageDef(STAGE_COMPOSE_HTML, 30, 45),
    StageDef(STAGE_ASSEMBLE_WORDS, 45, 60),
    StageDef(STAGE_ASSEMBLE_AUDIO, 60, 85),
    StageDef(STAGE_UPLOAD, 85, 95),
    StageDef(STAGE_HANDOFF, 95, 100),
]


@dataclass
class BuildContext:
    """Per-build mutable state. Stages read/write fields here; the
    orchestrator persists progress after each stage."""
    build_id: str
    project_id: str
    institute_id: str
    version: int
    plan_snapshot: dict          # frozen ConfirmedPlan (per-step dict)
    asset_kinds: Dict[str, str]  # handle -> 'video'|'image'
    source_urls: Dict[str, str]  # handle -> source URL
    aspect: Optional[str]
    fps: Optional[int]
    source_asset_refs: List[dict] = field(default_factory=list)  # raw refs; P6b ASSEMBLE_WORDS fetches transcripts
    preferences: Dict[str, Any] = field(default_factory=dict)    # P7: bgm/sfx policies enforced at build time
    # Filled by stages.
    timeline: Optional[dict] = None
    s3_urls: Dict[str, Any] = field(default_factory=dict)
    extra_metadata: Dict[str, Any] = field(default_factory=dict)


StageHandler = Callable[[BuildContext], Awaitable[None]]

_NOOP_DELAY_S = float(os.getenv("STUDIO_BUILD_NOOP_DELAY_S", "0"))


async def _noop_stage(_ctx: BuildContext) -> None:
    if _NOOP_DELAY_S:
        await asyncio.sleep(_NOOP_DELAY_S)


STAGE_HANDLERS: Dict[str, StageHandler] = {
    STAGE_BUILD_TIMELINE: _noop_stage,  # replaced by studio_executors.build_timeline
    STAGE_COMPOSE_HTML: _noop_stage,    # replaced by studio_executors.compose_html
    STAGE_ASSEMBLE_WORDS: _noop_stage,  # replaced by studio_executors.assemble_words
    STAGE_ASSEMBLE_AUDIO: _noop_stage,  # replaced by studio_executors.assemble_audio
    STAGE_UPLOAD: _noop_stage,          # replaced by studio_executors.upload_artifacts
    STAGE_HANDOFF: _noop_stage,         # handoff is finalized by the orchestrator itself
}


def register_stage_handler(stage_name: str, handler: StageHandler) -> None:
    if stage_name not in STAGE_HANDLERS:
        raise KeyError(f"Unknown studio stage {stage_name!r}; one of {list(STAGE_HANDLERS)}")
    STAGE_HANDLERS[stage_name] = handler


def register_all_stages() -> None:
    """Import every executor module so its register_stage_handler runs.
    Idempotent; call from any entry point that dispatches a build."""
    from .studio_executors import build_timeline as _bt   # noqa: F401
    from .studio_executors import compose_html as _ch     # noqa: F401
    from .studio_executors import assemble_words as _aw   # noqa: F401
    from .studio_executors import assemble_audio as _aa   # noqa: F401
    from .studio_executors import upload_artifacts as _ua  # noqa: F401


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

async def run_build(ctx: BuildContext) -> None:
    """Run the full build for one ai_studio_builds row. Fire-and-forget via
    dispatch_build(). All progress/error state lives on the row."""
    repo = AiStudioBuildRepository()
    completed: list = []
    last_progress = 0
    current = STAGE_PENDING

    try:
        repo.update_stage(
            ctx.build_id, build_stage=STAGE_BUILD_TIMELINE, progress=0,
            stages=completed, status="BUILDING",
        )
    except Exception as e:
        logger.error(f"[StudioBuild] {ctx.build_id} initial status update failed: {e}")
        return

    try:
        for stage in STAGE_PIPELINE:
            handler = STAGE_HANDLERS.get(stage.name)
            if handler is None:
                raise RuntimeError(f"No handler for studio stage {stage.name!r}")
            current = stage.name
            repo.update_stage(
                ctx.build_id, build_stage=stage.name, progress=stage.start_pct,
                stages=completed + [{"stage": stage.name, "progress": 0}],
            )
            last_progress = stage.start_pct
            logger.info(f"[StudioBuild] {ctx.build_id} stage={stage.name} starting")
            await handler(ctx)
            completed.append({"stage": stage.name, "progress": 100})
            repo.update_stage(
                ctx.build_id, build_stage=stage.name, progress=stage.end_pct,
                stages=completed,
            )
            last_progress = stage.end_pct
            logger.info(f"[StudioBuild] {ctx.build_id} stage={stage.name} done")

        # Terminal success → AWAITING_EDIT with the artifact URLs.
        repo.update_on_handoff(
            ctx.build_id, s3_urls=ctx.s3_urls, extra_metadata=ctx.extra_metadata,
        )
        logger.info(f"[StudioBuild] {ctx.build_id} → AWAITING_EDIT")

    except asyncio.CancelledError:
        logger.warning(f"[StudioBuild] {ctx.build_id} cancelled during {current}")
        repo.update_stage(
            ctx.build_id, build_stage=STAGE_FAILED, progress=last_progress,
            stages=completed, status="FAILED",
            error_message=f"[{current}] Build cancelled (worker restart). Try again.",
        )
        raise
    except Exception as e:
        logger.exception(f"[StudioBuild] {ctx.build_id} FAILED in {current}: {e}")
        repo.update_stage(
            ctx.build_id, build_stage=STAGE_FAILED, progress=last_progress,
            stages=completed, status="FAILED",
            error_message=f"[{current}] {e}"[:500],
        )


_PENDING_BUILD_TASKS: set = set()


def dispatch_build(ctx: BuildContext) -> "asyncio.Task":
    """Fire-and-forget build task; holds a strong ref until done (GC-safe)."""
    task = asyncio.create_task(run_build(ctx), name=f"studio-build-{ctx.build_id}")
    _PENDING_BUILD_TASKS.add(task)
    task.add_done_callback(_PENDING_BUILD_TASKS.discard)
    return task
