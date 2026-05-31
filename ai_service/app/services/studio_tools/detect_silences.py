"""
`detect_silences` tool — deterministic. Finds pauses to trim from the kept
arrangement ranges using the indexer's prosody.pauses.

Deterministic tools expose `detect(ctx)` (run server-side, no LLM). The
plan service supplies a ctx carrying:
    { raw_contexts: {handle: video_context}, segments: [...], min_silence_s }

`validate` is a passthrough used only if a silence op ever arrives in a
confirmed plan — it coerces the cut-span shape and drops bad rows.
"""
from __future__ import annotations

from typing import Any, Dict, List

from .. import studio_cut_detectors
from . import ToolSpec, ToolValidationError, register_tool

_SUMMARY = "Auto-detect silent pauses to trim (deterministic; no AI)."
_PARAMS_DOC = '{ "cuts": [ { "handle", "t_start", "t_end", "kind": "silence" } ] }'


def _detect(ctx: Dict[str, Any]) -> List[Dict[str, Any]]:
    raw_contexts = ctx.get("raw_contexts") or {}
    segments = ctx.get("segments") or []
    min_silence_s = float(ctx.get("min_silence_s") or 1.0)
    cuts = studio_cut_detectors.detect_silences(
        segments, raw_contexts, min_silence_s=min_silence_s
    )
    if not cuts:
        return []
    return [{"tool": "detect_silences", "params": {"cuts": cuts},
             "reason": f"{len(cuts)} silent pause(s) ≥ {min_silence_s:g}s"}]


def _validate(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    raw = params.get("cuts")
    if not isinstance(raw, list):
        raise ToolValidationError("detect_silences needs a 'cuts' list")
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
            cleaned.append({"handle": h, "t_start": round(ts, 2),
                            "t_end": round(te, 2), "kind": "silence"})
    if not cleaned:
        raise ToolValidationError("detect_silences produced no valid cuts")
    return {"cuts": cleaned}


register_tool(ToolSpec(
    name="detect_silences",
    step="cuts",
    min_tier="free",
    summary=_SUMMARY,
    params_doc=_PARAMS_DOC,
    validate=_validate,
    detect=_detect,
))
