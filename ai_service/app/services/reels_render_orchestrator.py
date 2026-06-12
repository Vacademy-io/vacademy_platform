"""
Gate 3 (RENDER) orchestrator — async background pipeline that runs the
multi-stage render of an AiReel.

Phase 3a (this commit): scaffolding only. Each stage handler is a no-op
that just sleeps briefly + updates progress, exercising the full PENDING →
… → COMPLETED transition. Real stage implementations land in 3b-e.

Stage pipeline (matches plan §2.1 Gate 3 stages):

  PENDING       → starting state
  AUDIO_EDIT    → cut+splice source audio per candidate's cut_plan, atempo
  SOURCE_CLIP   → aspect-cropped re-encoded video, frame-accurate cuts
  STYLE_GUIDE   → palette/typography
  DIRECTOR      → shot plan with SOURCE_CLIP entries + overlay graphics
  HTML          → per-shot HTML generation
  ASSEMBLE      → final {meta, entries} JSON
  RENDER        → hand off to render worker, poll, write final s3_urls
  COMPLETED     → terminal success
  FAILED        → terminal failure (set on any stage exception)

Each stage has a [start_pct, end_pct] band for the overall progress bar.
The `stages` JSONB on the AiReel row carries per-stage progress so the FE
can render a stage-by-stage status UI (§13.11).
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Awaitable, Callable, Optional

from ..repositories.ai_reel_repository import AiReelRepository

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Stage constants
# ---------------------------------------------------------------------------

STAGE_PENDING = "PENDING"
STAGE_AUDIO_EDIT = "AUDIO_EDIT"
STAGE_SOURCE_CLIP = "SOURCE_CLIP"
STAGE_STYLE_GUIDE = "STYLE_GUIDE"
STAGE_DIRECTOR = "DIRECTOR"
STAGE_HTML = "HTML"
STAGE_ASSEMBLE = "ASSEMBLE"
STAGE_RENDER = "RENDER"
STAGE_COMPLETED = "COMPLETED"
STAGE_FAILED = "FAILED"

STATUS_PENDING = "PENDING"
STATUS_IN_PROGRESS = "IN_PROGRESS"
STATUS_COMPLETED = "COMPLETED"
STATUS_FAILED = "FAILED"


# Per-stage overall-progress weights. Picked to match the percentages in
# plan §2.1 Gate 3. Each stage occupies [start, end] of the 0-100 bar.
@dataclass(frozen=True)
class StageDef:
    name: str
    start_pct: int
    end_pct: int


# Band widths roughly track real wall-clock cost per stage (2026-06-12
# audit): the worker RENDER dominates, SOURCE_CLIP (densify + optional
# matting) is second, HTML is a no-op. The previous bands gave 30% of the
# bar to the no-op HTML stage and 10% to RENDER, so the bar sprinted to
# 90% and froze for minutes — indistinguishable from a hang.
STAGE_PIPELINE: list[StageDef] = [
    StageDef(STAGE_AUDIO_EDIT,   0, 10),
    StageDef(STAGE_SOURCE_CLIP, 10, 35),
    StageDef(STAGE_STYLE_GUIDE, 35, 38),
    StageDef(STAGE_DIRECTOR,    38, 55),
    StageDef(STAGE_HTML,        55, 58),
    StageDef(STAGE_ASSEMBLE,    58, 62),
    StageDef(STAGE_RENDER,      62, 100),
]


# ---------------------------------------------------------------------------
# Context passed to every stage handler
# ---------------------------------------------------------------------------

@dataclass
class RenderContext:
    """Per-render mutable state. Stages read/write fields here; the
    orchestrator persists snapshots after each stage.

    Phase 3a: only the identifiers + config are populated; later phases will
    add fields like `speaker_clip_url`, `trim_map`, `shot_plan`, etc."""
    reel_pk: str
    reel_id: str
    institute_id: str
    input_asset_id: str
    candidate_id: Optional[str]
    config: dict
    source_window: dict
    # Populated by stages as they run (filled in by 3b-e).
    s3_urls: dict = field(default_factory=dict)
    trim_map: Optional[dict] = None
    extra_metadata: dict = field(default_factory=dict)


# Stage handler signature.
StageHandler = Callable[[RenderContext], Awaitable[None]]


# ---------------------------------------------------------------------------
# Phase 3a stage handlers — NO-OP (replaced in 3b-e)
# ---------------------------------------------------------------------------

# Tiny sleep so we can observe stage transitions in real time during dev.
# Set to 0 for tests via the env var below.
import os
_NOOP_DELAY_S = float(os.getenv("REELS_RENDER_NOOP_DELAY_S", "0.1"))


async def _noop_stage(_ctx: RenderContext) -> None:
    """Placeholder until the real stage implementation lands. `_ctx` is
    underscore-prefixed to mark it as intentionally unused — every stage
    handler must accept it for protocol compatibility."""
    await asyncio.sleep(_NOOP_DELAY_S)


# Per-stage handlers — every entry maps a STAGE constant to a handler. New
# stages add a line here; the orchestrator picks up the rest.
STAGE_HANDLERS: dict[str, StageHandler] = {
    STAGE_AUDIO_EDIT:   _noop_stage,  # Phase 3b
    STAGE_SOURCE_CLIP:  _noop_stage,  # Phase 3c
    STAGE_STYLE_GUIDE:  _noop_stage,  # Phase 3d
    STAGE_DIRECTOR:     _noop_stage,  # Phase 3d
    STAGE_HTML:         _noop_stage,  # Phase 3d
    STAGE_ASSEMBLE:     _noop_stage,  # Phase 3d
    STAGE_RENDER:       _noop_stage,  # Phase 3e
}


def register_stage_handler(stage_name: str, handler: StageHandler) -> None:
    """Replace the no-op for a stage with a real implementation. Used by
    Phase 3b-e modules so they don't have to edit this file."""
    if stage_name not in STAGE_HANDLERS:
        raise KeyError(f"Unknown stage {stage_name!r}; must be one of {list(STAGE_HANDLERS)}")
    STAGE_HANDLERS[stage_name] = handler


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

async def run_render(ctx: RenderContext) -> None:
    """Run a full Gate-3 render against a single AiReel row.

    Designed to be invoked via `dispatch_render(ctx)` from the `/render`
    endpoint — fire-and-forget. All progress/error state lives in the
    `ai_reels` row, so a separate poll on `/{reel_id}/status` is the FE's
    read path.

    All exceptions are caught and recorded as FAILED on the row. The caller
    never sees a propagated error.
    """
    repo = AiReelRepository()
    completed_stages: list[dict] = []
    # G3: track last successful progress so a failure preserves the bar
    # instead of resetting to 0 (which would make the FE look paradoxical:
    # 5 stages complete but progress=0).
    last_progress = 0
    # G1: name of stage currently in flight, surfaced on failure.
    current_stage_name: str = STAGE_PENDING

    # 0. Flip to IN_PROGRESS so the FE knows work has started.
    try:
        repo.update_stage(
            ctx.reel_pk,
            current_stage=STAGE_AUDIO_EDIT,  # first real stage
            progress=0,
            stages=completed_stages,
            status=STATUS_IN_PROGRESS,
        )
    except Exception as e:
        logger.error(f"[Render] {ctx.reel_id} initial status update failed: {e}")
        return

    try:
        for stage_def in STAGE_PIPELINE:
            handler = STAGE_HANDLERS.get(stage_def.name)
            if handler is None:
                raise RuntimeError(f"No handler registered for stage {stage_def.name!r}")

            current_stage_name = stage_def.name
            # Mark stage as starting.
            repo.update_stage(
                ctx.reel_pk,
                current_stage=stage_def.name,
                progress=stage_def.start_pct,
                stages=completed_stages + [{"stage": stage_def.name, "progress": 0}],
            )
            last_progress = stage_def.start_pct
            logger.info(f"[Render] {ctx.reel_id} stage={stage_def.name} starting")

            await handler(ctx)

            # Mark stage as complete.
            completed_stages.append({"stage": stage_def.name, "progress": 100})
            repo.update_stage(
                ctx.reel_pk,
                current_stage=stage_def.name,
                progress=stage_def.end_pct,
                stages=completed_stages,
            )
            last_progress = stage_def.end_pct
            logger.info(f"[Render] {ctx.reel_id} stage={stage_def.name} done")

        # All stages complete → mark COMPLETED.
        repo.update_on_completion(
            ctx.reel_pk,
            s3_urls=ctx.s3_urls,
            trim_map=ctx.trim_map,
            metadata=ctx.extra_metadata,
        )
        logger.info(f"[Render] {ctx.reel_id} COMPLETED")

    except asyncio.CancelledError:
        # Worker shutdown — leave row mid-flight; we'll be honest about it.
        logger.warning(f"[Render] {ctx.reel_id} cancelled during {current_stage_name}")
        repo.update_stage(
            ctx.reel_pk,
            current_stage=STAGE_FAILED,
            progress=last_progress,
            stages=completed_stages,
            status=STATUS_FAILED,
            error_message=(
                f"[{current_stage_name}] Render was cancelled (likely a worker restart). Try again."
            ),
        )
        raise
    except Exception as e:
        # Any stage exception → terminal FAILED with the error surfaced.
        logger.exception(f"[Render] {ctx.reel_id} FAILED in {current_stage_name}: {e}")
        # G1: prefix the stage name so the user sees WHICH stage failed
        # without needing to cross-reference current_stage on the row.
        msg = f"[{current_stage_name}] {e}"
        repo.update_stage(
            ctx.reel_pk,
            current_stage=STAGE_FAILED,
            progress=last_progress,  # G3: preserve the bar position
            stages=completed_stages,
            status=STATUS_FAILED,
            error_message=msg[:500],
        )


# G2: Module-level pending-task set. asyncio.create_task() returns a Task
# that is only weakly referenced internally — if the only strong reference
# is the request scope (which ends as soon as the response is sent), the
# GC can collect the task mid-render, causing "Task was destroyed but it
# is pending" warnings and silently killed renders. The fix is to keep a
# strong reference until the task completes.
_PENDING_RENDER_TASKS: set[asyncio.Task] = set()


def dispatch_render(ctx: RenderContext) -> asyncio.Task:
    """Fire-and-forget task wrapper. Holds a strong reference to the task
    in a module-level set until it completes — protects against GC."""
    task = asyncio.create_task(run_render(ctx), name=f"render-{ctx.reel_id}")
    _PENDING_RENDER_TASKS.add(task)
    task.add_done_callback(_PENDING_RENDER_TASKS.discard)
    return task


# ---------------------------------------------------------------------------
# Stuck-render reaper
# ---------------------------------------------------------------------------
# Renders run as in-process asyncio tasks — a deploy/crash/OOMKill strands
# rows in PENDING/IN_PROGRESS forever, the FE polls a corpse, and (before
# the dedup-staleness fix) the zombie blocked re-rendering its candidate.
# The reaper sweeps on startup and every REAPER_INTERVAL_S thereafter,
# failing rows whose updated_at is older than REAPER_STALE_MINUTES. Healthy
# renders write progress far more often than that, so the cutoff is
# replica-safe.

REAPER_INTERVAL_S = 300
REAPER_STALE_MINUTES = 30

_REAPER_TASK: Optional[asyncio.Task] = None


async def _reaper_loop() -> None:
    while True:
        try:
            # Reels with a live task in THIS process are never reaped, even
            # past the staleness cutoff — failing a row whose pipeline is
            # still running would let /retry start a second pipeline against
            # the same row. Task names are set in dispatch_render.
            live_reel_ids = [
                t.get_name().removeprefix("render-")
                for t in _PENDING_RENDER_TASKS
                if not t.done() and t.get_name().startswith("render-")
            ]
            reaped = await asyncio.to_thread(
                AiReelRepository().reap_stuck, REAPER_STALE_MINUTES, live_reel_ids
            )
            if reaped:
                logger.warning(
                    "[REAPER] failed %d stuck reel(s) older than %d min",
                    reaped, REAPER_STALE_MINUTES,
                )
        except Exception:
            logger.exception("[REAPER] sweep raised — will retry next interval")
        await asyncio.sleep(REAPER_INTERVAL_S)


def start_reels_reaper() -> None:
    """Start the periodic reaper task (idempotent). Call from app startup
    (lifespan) — requires a running event loop."""
    global _REAPER_TASK
    if _REAPER_TASK is not None and not _REAPER_TASK.done():
        return
    _REAPER_TASK = asyncio.create_task(_reaper_loop(), name="reels-reaper")


# G6: Explicit registration helper. The orchestrator's STAGE_HANDLERS dict
# starts with no-ops; real handlers are installed by importing each stage
# module. This relies on import order — fine when the router is the only
# entry point, but a footgun for future entry points (CLI, tests, scripts).
#
# Calling `register_all_stages()` forces all stage modules to be imported,
# guaranteeing their `register_stage_handler(...)` side effects have run.
# Idempotent — safe to call repeatedly.
def register_all_stages() -> None:
    """Import every stage module so their handlers are registered. Call
    this from any entry point that might dispatch a render."""
    # Local imports — defer the cost until explicitly requested AND avoid
    # circular-import surprises at orchestrator load time.
    from . import reels_audio_edit_service       # noqa: F401  # registers AUDIO_EDIT
    from . import reels_source_clip_service      # noqa: F401  # registers SOURCE_CLIP
    from . import reels_style_guide_service      # noqa: F401  # registers STYLE_GUIDE
    from . import reels_director_service         # noqa: F401  # registers DIRECTOR
    from . import reels_assemble_service         # noqa: F401  # registers ASSEMBLE
    from . import reels_render_finalize_service  # noqa: F401  # registers RENDER
    # Future: HTML when promoted from no-op (Phase 2 polish).
