"""
`propose_text_overlays` tool (Overlays step, premium+).

LLM emits, in `params`:
  { "overlays": [ {segment_idx, text, t_offset_s?, dur_s?, position?, style?}, ... ] }

A text overlay is a short bright callout (lower-third / kicker / emphasis) shown
over a kept segment for a few seconds. `segment_idx` indexes the confirmed
arrangement order; `t_offset_s` is seconds from that segment's start; COMPOSE_HTML
resolves both against `meta.segment_windows`.

Validation: drop malformed overlays, clamp duration/offset, default
position/style; an empty result drops the operation.
"""
from __future__ import annotations

from typing import Any, Dict

from . import ToolSpec, ToolValidationError, register_tool

_SUMMARY = (
    "Add a short on-screen text callout (lower-third / emphasis line) over a "
    "chosen segment."
)
_PARAMS_DOC = (
    '{ "overlays": [ { "segment_idx": <int, index into the arrangement order>, '
    '"text": "<short callout>", "t_offset_s": <seconds from segment start, '
    'default 0>, "dur_s": <1-15, default 3>, '
    '"position": "top"|"center"|"bottom"|"lower_third", '
    '"style": "plain"|"bold"|"highlight" } ] }'
)

_MAX_OVERLAYS = 12
_POSITIONS = {"top", "center", "bottom", "lower_third"}
_STYLES = {"plain", "bold", "highlight"}
_DEFAULT_DUR_S = 3.0


def _validate(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    raw = params.get("overlays")
    if not isinstance(raw, list) or not raw:
        raise ToolValidationError("propose_text_overlays needs a non-empty 'overlays' list")

    seg_count = ctx.get("segment_count")
    seg_count = seg_count if isinstance(seg_count, int) and seg_count > 0 else None

    cleaned = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        text = str(item.get("text", "")).strip()
        if not text:
            continue
        try:
            seg_idx = int(item.get("segment_idx"))
        except (TypeError, ValueError):
            continue
        if seg_idx < 0 or (seg_count is not None and seg_idx >= seg_count):
            continue

        entry: Dict[str, Any] = {"segment_idx": seg_idx, "text": text[:200]}

        off = item.get("t_offset_s")
        try:
            entry["t_offset_s"] = round(max(0.0, float(off)), 2) if off is not None else 0.0
        except (TypeError, ValueError):
            entry["t_offset_s"] = 0.0

        dur = item.get("dur_s")
        try:
            entry["dur_s"] = round(max(1.0, min(15.0, float(dur))), 2) if dur is not None else _DEFAULT_DUR_S
        except (TypeError, ValueError):
            entry["dur_s"] = _DEFAULT_DUR_S

        position = str(item.get("position", "bottom")).strip().lower()
        entry["position"] = position if position in _POSITIONS else "bottom"

        style = str(item.get("style", "plain")).strip().lower()
        entry["style"] = style if style in _STYLES else "plain"

        cleaned.append(entry)
        if len(cleaned) >= _MAX_OVERLAYS:
            break

    if not cleaned:
        raise ToolValidationError("propose_text_overlays produced no valid overlays")
    return {"overlays": cleaned}


register_tool(ToolSpec(
    name="propose_text_overlays",
    step="overlays",
    min_tier="premium",
    summary=_SUMMARY,
    params_doc=_PARAMS_DOC,
    validate=_validate,
))
