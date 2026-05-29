"""
`detect_fillers` tool — deterministic. Scans word-level transcript for
disfluencies (um/uh/…; softer words + phrases when aggressive) within the kept
arrangement ranges.

Same deterministic contract as detect_silences: `detect(ctx)` runs server-side
from `ctx.raw_contexts` + `ctx.segments`; `aggressive` comes from the project's
cut aggressiveness. `validate` is a passthrough for confirmed-plan re-checks.
"""
from __future__ import annotations

from typing import Any, Dict, List

from .. import studio_cut_detectors
from . import ToolSpec, ToolValidationError, register_tool

_SUMMARY = "Auto-detect filler words to trim (deterministic; no AI)."
_PARAMS_DOC = '{ "cuts": [ { "handle", "t_start", "t_end", "word", "kind": "filler" } ] }'


def _detect(ctx: Dict[str, Any]) -> List[Dict[str, Any]]:
    raw_contexts = ctx.get("raw_contexts") or {}
    segments = ctx.get("segments") or []
    aggressive = bool(ctx.get("fillers_aggressive"))
    cuts = studio_cut_detectors.detect_fillers(
        segments, raw_contexts, aggressive=aggressive
    )
    if not cuts:
        return []
    return [{"tool": "detect_fillers", "params": {"cuts": cuts},
             "reason": f"{len(cuts)} filler word(s)"}]


def _validate(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    raw = params.get("cuts")
    if not isinstance(raw, list):
        raise ToolValidationError("detect_fillers needs a 'cuts' list")
    cleaned = []
    for c in raw:
        if not isinstance(c, dict):
            continue
        try:
            ts, te = float(c.get("t_start")), float(c.get("t_end"))
        except (TypeError, ValueError):
            continue
        h = str(c.get("handle", "")).strip()
        if h and te > ts >= 0:
            row = {"handle": h, "t_start": round(ts, 2),
                   "t_end": round(te, 2), "kind": "filler"}
            word = c.get("word")
            if isinstance(word, str) and word.strip():
                row["word"] = word.strip()[:40]
            cleaned.append(row)
    if not cleaned:
        raise ToolValidationError("detect_fillers produced no valid cuts")
    return {"cuts": cleaned}


register_tool(ToolSpec(
    name="detect_fillers",
    step="cuts",
    min_tier="free",
    summary=_SUMMARY,
    params_doc=_PARAMS_DOC,
    validate=_validate,
    detect=_detect,
))
