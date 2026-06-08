"""
`propose_captions` tool (Overlays step, all tiers / free+).

Captions in Studio are a single karaoke-style WORDS TRACK built deterministically
from the spoken transcript (remapped onto the composed timeline at build time —
see `studio_words_track`), NOT per-segment HTML. So this tool is DETERMINISTIC
(`detect`): it proposes a sensible caption CONFIG ({enabled, preset}) from the
project's `caption_preset` preference; the user toggles it in the Overlays UI and
the confirmed config rides in `confirmed_plan['overlays']`. The build's
ASSEMBLE_WORDS stage reads `enabled` to decide whether to build the words track;
the render passes the words url + `caption_preset`.

No LLM, no cost — registered with `detect=` like the cut detectors.
"""
from __future__ import annotations

from typing import Any, Dict, List

from . import ToolSpec, ToolValidationError, register_tool

# Mirror schemas.CaptionPreset + FE CaptionPreset.
_PRESETS = {"hormozi", "karaoke", "pop", "clean", "none"}
_DEFAULT_PRESET = "clean"

_SUMMARY = "Turn on karaoke captions generated from the spoken transcript."
_PARAMS_DOC = (
    '{ "enabled": <bool>, "preset": "hormozi"|"karaoke"|"pop"|"clean"|"none" }'
)


def _resolve_preset(value: Any) -> str:
    preset = str(value or "").strip().lower()
    return preset if preset in _PRESETS else _DEFAULT_PRESET


def _detect(ctx: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Propose a default caption config from the project's preference."""
    pref = (ctx or {}).get("caption_preset")
    preset = _resolve_preset(pref) if pref else _DEFAULT_PRESET
    enabled = preset != "none"
    return [{
        "tool": "propose_captions",
        "params": {"enabled": enabled, "preset": preset},
        "reason": "Karaoke captions from the spoken transcript.",
    }]


def _validate(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(params, dict):
        raise ToolValidationError("propose_captions needs an object")
    return {
        "enabled": bool(params.get("enabled", True)),
        "preset": _resolve_preset(params.get("preset")),
    }


register_tool(ToolSpec(
    name="propose_captions",
    step="overlays",
    min_tier="free",
    summary=_SUMMARY,
    params_doc=_PARAMS_DOC,
    validate=_validate,
    detect=_detect,
))
