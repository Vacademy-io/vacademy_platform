"""
`propose_sfx` tool (Audio step, premium+) — deterministic.

SFX in Studio is a subtle whoosh at each segment boundary, synthesized at
build time (no asset lookup) — so like `propose_captions` this tool is
DETERMINISTIC (`detect`): it proposes a sensible sfx CONFIG
({enabled, placement, volume_db}) honoring the project's `sfx_policy`
preference; the user toggles it in the Audio UI and the confirmed config rides
in `confirmed_plan['audio']`.

No LLM, no cost — registered with `detect=` like the cut detectors. `validate`
is a passthrough re-check used only if an sfx op ever arrives in a confirmed
plan — it coerces the config shape and clamps volume_db.
"""
from __future__ import annotations

from typing import Any, Dict, List

from . import ToolSpec, ToolValidationError, register_tool

# Mirror schemas.SfxPolicy ('auto'|'always'|'never').
_PLACEMENTS = {"segment_boundaries", "all_cuts"}
_DEFAULT_PLACEMENT = "segment_boundaries"
_DEFAULT_VOLUME_DB = -10.0

_SUMMARY = "Add a subtle whoosh at each segment change (deterministic; no AI)."
_PARAMS_DOC = (
    '{ "enabled": <bool>, "placement": "segment_boundaries"|"all_cuts", '
    '"volume_db": <-30..0, default -10> }'
)


def _detect(ctx: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Propose a default sfx config from the project's preference."""
    policy = str((ctx or {}).get("sfx_policy") or "auto").strip().lower()
    if policy == "never":
        return []
    return [{
        "tool": "propose_sfx",
        "params": {"enabled": True, "placement": _DEFAULT_PLACEMENT,
                   "volume_db": _DEFAULT_VOLUME_DB},
        "reason": "Subtle whoosh at each segment change",
    }]


def _validate(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(params, dict):
        raise ToolValidationError("propose_sfx needs an object")
    placement = str(params.get("placement") or "").strip().lower()
    if placement not in _PLACEMENTS:
        placement = _DEFAULT_PLACEMENT
    try:
        volume_db = float(params.get("volume_db"))
    except (TypeError, ValueError):
        volume_db = _DEFAULT_VOLUME_DB
    volume_db = round(max(-30.0, min(0.0, volume_db)), 1)
    return {
        "enabled": bool(params.get("enabled", True)),
        "placement": placement,
        "volume_db": volume_db,
    }


register_tool(ToolSpec(
    name="propose_sfx",
    step="audio",
    min_tier="premium",
    summary=_SUMMARY,
    params_doc=_PARAMS_DOC,
    validate=_validate,
    detect=_detect,
))
