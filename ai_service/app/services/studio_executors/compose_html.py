"""
COMPOSE_HTML stage — append title/text overlay ENTRIES to the timeline that
ASSEMBLE_TIMELINE produced. Runs after BUILD_TIMELINE (needs ctx.timeline) and
before UPLOAD (which serializes ctx.timeline).

Overlays are SEPARATE, higher-z entries layered over the base SOURCE_CLIP /
IMAGE_STILL entries — the executor never reflows the base timeline, it only
appends. Each overlay anchors to a `segment_idx` (index into the confirmed
arrangement order) resolved to a composed time window via
`meta.segment_windows` (emitted by studio_timeline_builder).

Source of operations: the build's `plan_snapshot['overlays']` — BOTH
`operations` (LLM/confirmed) AND `manual_operations` (user-authored). Like the
cuts collector, we read by PARAM SHAPE (`params.titles` / `params.overlays`),
not by tool name, so a FE `manual_overlay` op with the same shape composes too.

The confirmed ops are not re-validated server-side, so this stage parses
defensively: coerce types, clamp timing to the segment window, drop anything
unresolvable. A missing/short window drops just that overlay (logged), never
the build.

⚠️ z-band + luma-key: overlays use the editor's overlay band (500–8999, below
the 8000+ caption band). Their HTML is bright-on-transparent so the worker's
brightness mask keeps the text over SOURCE_CLIP footage (see edit_overlays
package docstring).
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

from ..edit_overlays import render_text_overlay_html, render_title_html
from ..studio_orchestrator import STAGE_COMPOSE_HTML, BuildContext, register_stage_handler

logger = logging.getLogger(__name__)

# z bands (within the editor's 500–8999 overlay band; caption track is 8000+).
_Z_TEXT_BASE = 500
_Z_TITLE_BASE = 1500
_Z_BAND_MAX = 7999
_MIN_OVERLAY_S = 0.3  # drop overlays whose resolvable window is shorter


def _as_float(v: Any, default: float) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def _collect_overlay_ops(overlays_plan: Optional[dict]) -> List[dict]:
    if not isinstance(overlays_plan, dict):
        return []
    ops: List[dict] = []
    for key in ("operations", "manual_operations"):
        seq = overlays_plan.get(key)
        if isinstance(seq, list):
            ops.extend(o for o in seq if isinstance(o, dict))
    return ops


def _clamp_to_window(
    win: Dict[str, Any], *, offset_s: float, dur_s: float
) -> Optional[Tuple[float, float]]:
    """Resolve an overlay's [in,exit] inside a segment window. Returns None if
    the window can't host at least _MIN_OVERLAY_S."""
    w_in = _as_float(win.get("inTime"), 0.0)
    w_out = _as_float(win.get("exitTime"), 0.0)
    if w_out - w_in < _MIN_OVERLAY_S:
        return None
    in_t = w_in + max(0.0, offset_s)
    # Keep the start inside the window with room for the minimum duration.
    in_t = min(in_t, w_out - _MIN_OVERLAY_S)
    in_t = max(in_t, w_in)
    exit_t = min(in_t + max(_MIN_OVERLAY_S, dur_s), w_out)
    if exit_t - in_t < _MIN_OVERLAY_S:
        return None
    return round(in_t, 3), round(exit_t, 3)


async def _compose_html_stage(ctx: BuildContext) -> None:
    timeline = ctx.timeline
    if not timeline:
        raise ValueError("no timeline to compose overlays onto (BUILD_TIMELINE must run first)")

    overlays_plan = (ctx.plan_snapshot or {}).get("overlays")
    ops = _collect_overlay_ops(overlays_plan)
    if not ops:
        logger.info(f"[StudioBuild] {ctx.build_id} no overlays to compose")
        return

    meta = timeline.setdefault("meta", {})
    windows = {
        w.get("order_index"): w
        for w in (meta.get("segment_windows") or [])
        if isinstance(w, dict)
    }
    entries: List[Dict[str, Any]] = timeline.setdefault("entries", [])

    new_entries: List[Dict[str, Any]] = []
    n_titles = 0
    n_texts = 0
    dropped = 0

    for op in ops:
        params = op.get("params") or {}
        if not isinstance(params, dict):
            continue

        # Titles (by shape: params.titles[]).
        for t in params.get("titles") or []:
            if not isinstance(t, dict):
                continue
            title = str(t.get("title", "")).strip()
            if not title:
                continue
            win = windows.get(t.get("segment_idx"))
            if win is None:
                dropped += 1
                continue
            span = _clamp_to_window(win, offset_s=0.0, dur_s=_as_float(t.get("duration_s"), 3.0))
            if span is None:
                dropped += 1
                continue
            in_t, exit_t = span
            html = render_title_html(
                title,
                subtitle=(str(t["subtitle"]).strip() if t.get("subtitle") else None),
                placement=str(t.get("placement", "center")),
            )
            new_entries.append({
                "id": f"overlay-title-{n_titles}",
                "shot_type": "TITLE",
                "inTime": in_t,
                "exitTime": exit_t,
                "z": min(_Z_TITLE_BASE + n_titles, _Z_BAND_MAX),
                "html": html,
                "entry_meta": {
                    "shot_type": "title", "overlay_kind": "title",
                    "text": title, "order_index": t.get("segment_idx"),
                },
            })
            n_titles += 1

        # Text overlays (by shape: params.overlays[]).
        for o in params.get("overlays") or []:
            if not isinstance(o, dict):
                continue
            text = str(o.get("text", "")).strip()
            if not text:
                continue
            win = windows.get(o.get("segment_idx"))
            if win is None:
                dropped += 1
                continue
            span = _clamp_to_window(
                win, offset_s=_as_float(o.get("t_offset_s"), 0.0),
                dur_s=_as_float(o.get("dur_s"), 3.0),
            )
            if span is None:
                dropped += 1
                continue
            in_t, exit_t = span
            html = render_text_overlay_html(
                text,
                position=str(o.get("position", "bottom")),
                style=str(o.get("style", "plain")),
            )
            new_entries.append({
                "id": f"overlay-text-{n_texts}",
                "shot_type": "TEXT_OVERLAY",
                "inTime": in_t,
                "exitTime": exit_t,
                "z": min(_Z_TEXT_BASE + n_texts, _Z_TITLE_BASE - 1),
                "html": html,
                "entry_meta": {
                    "shot_type": "text_overlay", "overlay_kind": "text",
                    "text": text, "order_index": o.get("segment_idx"),
                },
            })
            n_texts += 1

    if new_entries:
        entries.extend(new_entries)
        # Overlays are clamped to existing windows so they can't exceed the
        # timeline, but bump total_duration defensively if one ever does.
        max_exit = max((e["exitTime"] for e in new_entries), default=0.0)
        if max_exit > _as_float(meta.get("total_duration"), 0.0):
            meta["total_duration"] = round(max_exit, 3)

    ctx.extra_metadata["overlay_count"] = len(new_entries)
    logger.info(
        f"[StudioBuild] {ctx.build_id} composed {n_titles} title(s) + {n_texts} "
        f"text overlay(s){f', dropped {dropped}' if dropped else ''}"
    )


register_stage_handler(STAGE_COMPOSE_HTML, _compose_html_stage)
