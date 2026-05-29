"""
`arrange_sequence` tool — order the kept segments into the final sequence.

LLM emits, in `params`:
  { "order": [ {handle, t_start, t_end, crossfade_s?}, ... ] }

The `order` list IS the final playback order. Each item should correspond to a
segment from `pick_segments` (matched loosely by handle + overlapping range),
but we don't hard-require that — the LLM may legitimately re-cut. We validate
each item's shape and clamp crossfade to a sane range.

Validation:
  * `handle` must be a known asset handle (video OR image — images can sit in
    the sequence as still cards).
  * numeric `t_start`/`t_end` for videos (`0 <= start < end`); images may omit
    timing (a default still-duration is applied downstream at build time).
  * `crossfade_s` clamped to [0, 2].
  * empty/invalid order → drop the operation.
"""
from __future__ import annotations

from typing import Any, Dict

from . import ToolSpec, ToolValidationError, register_tool

_SUMMARY = "Put the kept segments (and any image stills) in final playback order."
_PARAMS_DOC = (
    '{ "order": [ { "handle": "v1", "t_start": <sec>, "t_end": <sec>, '
    '"crossfade_s": <0-2, optional> } ] } — list order = playback order; '
    "images may omit t_start/t_end (shown as a still); crossfade_s optional."
)

_MAX_CROSSFADE_S = 2.0


def _validate(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    raw = params.get("order")
    if not isinstance(raw, list) or not raw:
        raise ToolValidationError("arrange_sequence needs a non-empty 'order' list")

    all_handles = ctx.get("all_handles") or set()
    image_handles = ctx.get("image_handles") or set()
    durations: Dict[str, Any] = ctx.get("durations") or {}

    cleaned = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        handle = str(item.get("handle", "")).strip()
        if handle not in all_handles:
            continue
        entry: Dict[str, Any] = {"handle": handle}
        is_image = handle in image_handles

        if not is_image:
            try:
                t_start = float(item.get("t_start"))
                t_end = float(item.get("t_end"))
            except (TypeError, ValueError):
                # A video without valid timing is unusable in the sequence.
                continue
            if t_start < 0:
                t_start = 0.0
            dur = durations.get(handle)
            if isinstance(dur, (int, float)) and dur > 0:
                t_end = min(t_end, float(dur))
            if not (t_end > t_start):
                continue
            entry["t_start"] = round(t_start, 2)
            entry["t_end"] = round(t_end, 2)
        else:
            # Optional explicit still-duration for an image card.
            try:
                if item.get("t_end") is not None:
                    entry["still_duration_s"] = max(0.5, min(15.0, float(item["t_end"]) - float(item.get("t_start", 0))))
            except (TypeError, ValueError):
                pass

        cf = item.get("crossfade_s")
        if isinstance(cf, (int, float)):
            entry["crossfade_s"] = round(max(0.0, min(_MAX_CROSSFADE_S, float(cf))), 2)
        cleaned.append(entry)

    if not cleaned:
        raise ToolValidationError("arrange_sequence produced no valid items")
    return {"order": cleaned}


register_tool(ToolSpec(
    name="arrange_sequence",
    step="arrangement",
    min_tier="free",
    summary=_SUMMARY,
    params_doc=_PARAMS_DOC,
    validate=_validate,
))
