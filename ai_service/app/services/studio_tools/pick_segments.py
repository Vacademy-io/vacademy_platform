"""
`pick_segments` tool — choose time ranges to keep from source videos.

LLM emits, in `params`:
  { "segments": [ {handle, t_start, t_end, reason?}, ... ] }

Validation:
  * `handle` must reference a video asset present in the manifest.
  * `t_start`/`t_end` numeric, `0 <= t_start < t_end`.
  * range is clamped to the asset's known duration when available.
  * out-of-vocab handles / inverted ranges drop the single segment, not the
    whole operation (a partial pick is better than none).
  * if NO segment survives, the operation itself is dropped (raises).
"""
from __future__ import annotations

from typing import Any, Dict

from . import ToolSpec, ToolValidationError, register_tool

_SUMMARY = "Choose the time ranges to KEEP from one or more source videos."
_PARAMS_DOC = (
    '{ "segments": [ { "handle": "v1", "t_start": <sec>, "t_end": <sec>, '
    '"reason": "<why this clip>" } ] } — t_end > t_start; only reference video '
    "handles from the manifest; ranges must lie within the asset duration."
)


def _validate(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    raw = params.get("segments")
    if not isinstance(raw, list) or not raw:
        raise ToolValidationError("pick_segments needs a non-empty 'segments' list")

    # ctx carries {video_handles: set[str], durations: {handle: float|None}}.
    video_handles = ctx.get("video_handles") or set()
    durations: Dict[str, Any] = ctx.get("durations") or {}

    cleaned = []
    for seg in raw:
        if not isinstance(seg, dict):
            continue
        handle = str(seg.get("handle", "")).strip()
        if handle not in video_handles:
            continue
        try:
            t_start = float(seg.get("t_start"))
            t_end = float(seg.get("t_end"))
        except (TypeError, ValueError):
            continue
        if t_start < 0:
            t_start = 0.0
        dur = durations.get(handle)
        if isinstance(dur, (int, float)) and dur > 0:
            t_end = min(t_end, float(dur))
        if not (t_end > t_start):
            continue
        out = {"handle": handle, "t_start": round(t_start, 2), "t_end": round(t_end, 2)}
        reason = seg.get("reason")
        if isinstance(reason, str) and reason.strip():
            out["reason"] = reason.strip()[:280]
        cleaned.append(out)

    if not cleaned:
        raise ToolValidationError("pick_segments produced no valid segments")
    return {"segments": cleaned}


register_tool(ToolSpec(
    name="pick_segments",
    step="arrangement",
    min_tier="free",
    summary=_SUMMARY,
    params_doc=_PARAMS_DOC,
    validate=_validate,
))
