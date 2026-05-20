"""DefaultShotMapper — Phase 1 of the pipeline-v2 refactor.

Converts a beat list (from BeatPlanner) into a Director-shaped shot plan
using a pure-Python heuristic — no LLM call. Used by tiers that don't run
a real Director (free / standard today).

The output mirrors the Director's plan shape so downstream stages
(`_shot_task`, HTML gen, render compose) consume it without branching on
tier. Every shot covers exactly one beat at this layer; a future Director-
lite could merge consecutive short beats into composite shots, but that's
a Phase 7+ polish.

This module is intentionally LLM-free and side-effect-free: given a beat
list it always produces a deterministic shot plan. Pure function, easy to
unit-test, no caching needed.

Public API
----------
- `map_beats_to_shots(beats)`: returns a list of shot dicts.
- `VISUAL_TYPE_TO_SHOT_TYPE`: the canonical mapping used.

Off by default until Phase 2 wires it into automation_pipeline.run() for
tiers without `use_director=True`.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional


# Maps `visual_type_hint` (from BeatPlanner) to a Director shot_type.
# Keep this aligned with `beat_planner.BEAT_VISUAL_TYPES`.
#
# AI_VIDEO_HERO is intentionally absent: non-premium tiers never see
# `ai_video` from BeatPlanner (the planner is told it's disabled), but if
# one slips through, the safe fallback `IMAGE_HERO` keeps the shot useful
# rather than crashing the mapper. The Director (premium+) is the canonical
# place that emits AI_VIDEO_HERO.
VISUAL_TYPE_TO_SHOT_TYPE: Dict[str, str] = {
    "motion_graphic":   "TEXT_DIAGRAM",
    "image_hero":       "IMAGE_HERO",
    "stock_video":      "VIDEO_HERO",
    "ai_video":         "IMAGE_HERO",     # safe fallback — see comment above
    "infographic":      "INFOGRAPHIC_SVG",
    "device_mockup":    "DEVICE_MOCKUP",
    "kinetic_title":    "KINETIC_TITLE",
    "annotation_map":   "ANNOTATION_MAP",
    "split_comparison": "TEXT_DIAGRAM",  # composite layout the per-shot LLM handles
}

# Intent-role hints surfaced on the shot for downstream pacing rules.
# Director would consume `intent_role`; DefaultShotMapper preserves it so
# the same per-shot prompts can read it.
INTENT_ROLE_PASSTHROUGH = (
    "hook", "setup", "explanation", "example", "moment", "recap", "cta",
)


def _shot_type_for(visual_type_hint: str) -> str:
    """Look up the Director shot_type for a beat's visual_type_hint.

    Unknown values degrade to TEXT_DIAGRAM (the safe motion-graphic default
    that every tier supports).
    """
    return VISUAL_TYPE_TO_SHOT_TYPE.get((visual_type_hint or "").strip().lower(), "TEXT_DIAGRAM")


def map_beats_to_shots(
    beats: List[Dict[str, Any]],
    *,
    canvas: str = "landscape",
    initial_offset_s: float = 0.0,
) -> List[Dict[str, Any]]:
    """Produce a Director-shaped shot plan from a beat list.

    Each beat becomes one shot at the same duration. The shot's
    `in_time` / `exit_time` are derived from cumulative beat durations
    starting at `initial_offset_s` — these are ESTIMATES that the
    timing-reconciliation step (Phase 2) overwrites with actual per-shot
    TTS durations.

    Args:
      beats: list of normalized beat dicts (see beat_planner.plan_beats)
      canvas: "landscape" or "portrait" — surfaced on each shot so
              downstream HTML gen can branch on it
      initial_offset_s: when this shot plan covers only part of a longer
              video, the offset of the first beat in the master timeline

    Returns:
      List of shot dicts with keys mirroring the Director plan:
        - shot_index, shot_type, in_time, exit_time, shot_duration_s
        - narration_text, intended_narration, label
        - visual_type_hint, intent_role, audio_policy ("narration_only" default)
        - canvas, source ("default_shot_mapper")
    """
    shots: List[Dict[str, Any]] = []
    cum = float(initial_offset_s or 0.0)
    for i, beat in enumerate(beats):
        if not isinstance(beat, dict):
            continue
        # Pull beat fields with safe defaults — BeatPlanner already
        # normalizes, but we defend in case a hand-built beat sneaks in.
        try:
            dur = float(beat.get("duration_estimate_s") or 0.0)
        except (TypeError, ValueError):
            dur = 0.0
        if dur <= 0:
            dur = 4.0
        visual_type_hint = (beat.get("visual_type_hint") or "motion_graphic").strip().lower()
        intent_role = (beat.get("intent_role") or "explanation").strip().lower()
        if intent_role not in INTENT_ROLE_PASSTHROUGH:
            intent_role = "explanation"
        narration_text = (beat.get("intended_narration") or beat.get("narration") or "").strip()
        narration_hint = bool(beat.get("narration_hint", bool(narration_text)))
        label = str(beat.get("label") or f"Shot {i + 1}").strip()

        shot_type = _shot_type_for(visual_type_hint)
        in_time = round(cum, 3)
        exit_time = round(cum + dur, 3)
        cum += dur

        shots.append({
            "shot_index": i,
            "shot_type": shot_type,
            "in_time": in_time,
            "exit_time": exit_time,
            "shot_duration_s": round(dur, 3),
            "narration_text": narration_text if narration_hint else "",
            "intended_narration": narration_text,
            "narration_hint": narration_hint,
            "label": label,
            "visual_type_hint": visual_type_hint,
            "intent_role": intent_role,
            # Default audio policy. AudioPolicyPlanner (Phase 5) may override
            # this to "intrinsic_only" for AI-video-with-audio shots, but
            # DefaultShotMapper is used on tiers that don't see AI video, so
            # narration_only is always correct here.
            "audio_policy": "narration_only",
            "canvas": canvas,
            "source": "default_shot_mapper",
        })
    return shots


def total_duration_s(shots: List[Dict[str, Any]]) -> float:
    """Sum of `shot_duration_s` across shots. Convenience for callers that
    want to compare against the BeatPlanner-targeted duration before
    invoking the timing-reconciliation step."""
    total = 0.0
    for s in shots:
        if not isinstance(s, dict):
            continue
        try:
            total += float(s.get("shot_duration_s") or 0.0)
        except (TypeError, ValueError):
            continue
    return round(total, 3)
