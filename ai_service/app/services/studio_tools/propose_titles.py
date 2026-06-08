"""
`propose_titles` tool (Overlays step, premium+).

LLM emits, in `params`:
  { "titles": [ {segment_idx, title, subtitle?, duration_s?, placement?}, ... ] }

A title overlays the START of a kept segment (an intro/section card or name
super) — it does NOT insert a new clip, so it never reflows the base timeline.
`segment_idx` indexes the confirmed arrangement order (0-based); the build's
COMPOSE_HTML stage resolves it to that segment's composed time window via
`meta.segment_windows`.

Validation: drop malformed titles, clamp duration, default placement; an empty
result drops the whole operation.
"""
from __future__ import annotations

from typing import Any, Dict

from . import ToolSpec, ToolValidationError, register_tool

_SUMMARY = (
    "Add a title card or name-super over the start of a chosen segment "
    "(intro/section title). Does not add a new clip."
)
_PARAMS_DOC = (
    '{ "titles": [ { "segment_idx": <int, index into the arrangement order>, '
    '"title": "<short title>", "subtitle": "<optional one line>", '
    '"duration_s": <1-8, default 3>, "placement": "center"|"lower" } ] }'
)

_MAX_TITLES = 8
_PLACEMENTS = {"center", "lower"}
_DEFAULT_DURATION_S = 3.0


def _validate(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    raw = params.get("titles")
    if not isinstance(raw, list) or not raw:
        raise ToolValidationError("propose_titles needs a non-empty 'titles' list")

    seg_count = ctx.get("segment_count")
    seg_count = seg_count if isinstance(seg_count, int) and seg_count > 0 else None

    cleaned = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title", "")).strip()
        if not title:
            continue
        try:
            seg_idx = int(item.get("segment_idx"))
        except (TypeError, ValueError):
            continue
        if seg_idx < 0 or (seg_count is not None and seg_idx >= seg_count):
            continue

        entry: Dict[str, Any] = {"segment_idx": seg_idx, "title": title[:120]}

        subtitle = item.get("subtitle")
        if isinstance(subtitle, str) and subtitle.strip():
            entry["subtitle"] = subtitle.strip()[:160]

        dur = item.get("duration_s")
        try:
            entry["duration_s"] = round(max(1.0, min(8.0, float(dur))), 2) if dur is not None else _DEFAULT_DURATION_S
        except (TypeError, ValueError):
            entry["duration_s"] = _DEFAULT_DURATION_S

        placement = str(item.get("placement", "center")).strip().lower()
        entry["placement"] = placement if placement in _PLACEMENTS else "center"

        cleaned.append(entry)
        if len(cleaned) >= _MAX_TITLES:
            break

    if not cleaned:
        raise ToolValidationError("propose_titles produced no valid titles")
    return {"titles": cleaned}


register_tool(ToolSpec(
    name="propose_titles",
    step="overlays",
    min_tier="premium",
    summary=_SUMMARY,
    params_doc=_PARAMS_DOC,
    validate=_validate,
))
