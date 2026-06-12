"""
`propose_bgm` tool (Audio step, premium+).

LLM emits, in `params`:
  { "enabled": true, "mood": "uplifting corporate",
    "music_prompt": "warm ambient electronic, soft pads, no vocals",
    "volume": 0.12 }

ONE background-music bed under the WHOLE video — never per-segment tracks or
playlists. `mood` is the short human-facing label the wizard shows;
`music_prompt` is the concrete text-to-music description the build's audio
stage feeds to the generator (falls back to `mood`). `volume` is linear gain
applied by the render worker's audio_tracks mix; the low default keeps speech
dominant (no sidechain ducking in v1 — the track stays editable in the editor).

Validation: honor the project's `bgm_policy` ('never' drops the op — the LLM
shouldn't have proposed it, defense-in-depth), coerce enabled, trim/cap the
strings, clamp volume.
"""
from __future__ import annotations

from typing import Any, Dict

from . import ToolSpec, ToolValidationError, register_tool

_SUMMARY = (
    "Add ONE background-music bed under the whole video (mood + concrete "
    "music description). Subtle by design — mixed quietly under the speech."
)
_PARAMS_DOC = (
    '{ "enabled": true, "mood": "uplifting corporate", '
    '"music_prompt": "warm ambient electronic, soft pads, no vocals", '
    '"volume": <0.0-0.5, default 0.12> }'
)

_MAX_TEXT_LEN = 200
_DEFAULT_MOOD = "neutral ambient"
_DEFAULT_VOLUME = 0.12


def _validate(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(params, dict):
        raise ToolValidationError("propose_bgm needs an object")
    if (ctx or {}).get("bgm_policy") == "never":
        raise ToolValidationError("project bgm_policy is 'never'")

    mood = str(params.get("mood") or "").strip()[:_MAX_TEXT_LEN] or _DEFAULT_MOOD
    music_prompt = (
        str(params.get("music_prompt") or "").strip()[:_MAX_TEXT_LEN] or mood
    )

    try:
        volume = float(params.get("volume"))
    except (TypeError, ValueError):
        volume = _DEFAULT_VOLUME
    volume = round(max(0.0, min(0.5, volume)), 3)

    return {
        "enabled": bool(params.get("enabled", True)),
        "mood": mood,
        "music_prompt": music_prompt,
        "volume": volume,
    }


register_tool(ToolSpec(
    name="propose_bgm",
    step="audio",
    min_tier="premium",
    summary=_SUMMARY,
    params_doc=_PARAMS_DOC,
    validate=_validate,
))
