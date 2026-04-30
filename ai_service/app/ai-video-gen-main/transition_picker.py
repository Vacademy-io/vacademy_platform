"""
Transition Picker — deterministic content-aware transition resolution.

Today the Director emits a `transition_in` value per shot, and the Act Planner
emits `transition_out` per act, but the latter is mostly dropped. This module
unifies both into one deterministic pick based on:

  - act boundary (Act Planner's `transition_out` overrides the next shot's
                  `transition_in` when crossing an act boundary)
  - shot family relationship (cinematic → infographic → product → motion-graphics)
  - same-type sequences (e.g. VIDEO_HERO → VIDEO_HERO motion-matched)
  - the Director's stated transition (used as a tiebreaker / fallback)

The picker is pure: same input → same output. No LLM calls. Adds zero per-video
cost. Bad picks fall back to `fade` so the picker can never regress.
"""
from __future__ import annotations

from typing import Dict, Any, List, Optional, Tuple


# Transition IDs known to TRANSITION_CSS_BLOCKS in prompts.py. Picker output
# values must be a subset.
_KNOWN_TRANSITIONS = {
    "cut",
    "fade",
    "slide_left",
    "slide_right",
    "slide_up",
    "zoom_in",
    "zoom_out",
    "wipe_right",
    "dissolve_up",
    # New entries (added in this change):
    "whip_pan",
    "zoom_through",
    "vignette_fade",
}

# Map shot_type → visual family. When two adjacent shots are in different
# families the picker reaches for a stronger transition. See the docs §7.1
# for the canonical family taxonomy.
_FAMILY = {
    "VIDEO_HERO":      "cinematic",
    "IMAGE_HERO":      "cinematic",
    "IMAGE_SPLIT":     "cinematic",
    "ANNOTATION_MAP":  "cinematic",
    "ANIMATED_ASSET":  "cinematic",
    "INFOGRAPHIC_SVG": "infographic",
    "KINETIC_TITLE":   "infographic",
    "PRODUCT_HERO":    "product",
    "TEXT_DIAGRAM":    "motion",
    "PROCESS_STEPS":   "motion",
    "DATA_STORY":      "motion",
    "EQUATION_BUILD":  "motion",
    "KINETIC_TEXT":    "motion",
    "LOWER_THIRD":     "overlay",
    "SOURCE_CLIP":     "source_clip",
}

# Act Planner's transition_out vocabulary → our TRANSITION_CSS_BLOCKS keys.
# `kinetic_title_interstitial` is handled at planning time (an extra shot is
# inserted between acts), not as a CSS block, so we map it to `vignette_fade`
# here — the picker emits a fallback for the case where the interstitial shot
# wasn't actually inserted.
_ACT_TRANSITION_MAP = {
    "hard_cut":                  "cut",
    "kinetic_title_interstitial": "vignette_fade",
    "zoom_through":              "zoom_through",
    "vignette_fade":             "vignette_fade",
    "fade":                      "fade",
    "cut":                       "cut",
}


def family_of(shot_type: str) -> str:
    return _FAMILY.get(shot_type or "", "motion")


def normalize(transition_id: str) -> str:
    """Coerce any transition value to a known one. Unknown → fade."""
    if not transition_id or not isinstance(transition_id, str):
        return "fade"
    t = transition_id.strip().lower()
    if t in _KNOWN_TRANSITIONS:
        return t
    # Common aliases the Director might emit.
    aliases = {
        "whip": "whip_pan",
        "whippan": "whip_pan",
        "vignette": "vignette_fade",
        "zoom": "zoom_through",
        "crossfade": "fade",
        "dissolve": "dissolve_up",
    }
    return aliases.get(t, "fade")


def pick(
    prev_shot: Optional[Dict[str, Any]],
    shot: Dict[str, Any],
    *,
    is_act_boundary: bool = False,
    act_transition_out: Optional[str] = None,
) -> Tuple[str, str]:
    """Resolve the entry transition for `shot` given the previous shot.

    Returns (transition_id, reason) where transition_id is a key into
    TRANSITION_CSS_BLOCKS and reason is a short diagnostic string.

    Rule order (first match wins):
      1. First shot of the video → director's choice or `zoom_in` for KINETIC_TITLE
      2. Act boundary with Act Planner's `transition_out` set → use that
      3. KINETIC_TEXT → always cut (forces snappy enter)
      4. KINETIC_TITLE → zoom_in (matches existing convention)
      5. Cross-family (e.g. cinematic → infographic) → vignette_fade 0.5s
      6. Same-family VIDEO_HERO → VIDEO_HERO without cut hint → whip_pan
      7. Same family same shot_type with motion content → respect Director cut/fade
      8. Otherwise → director's choice, normalized
    """
    director_choice = normalize(shot.get("transition_in"))
    shot_type = shot.get("shot_type") or ""
    shot_fam = family_of(shot_type)

    # 1. First shot
    if prev_shot is None:
        if shot_type == "KINETIC_TITLE":
            return "zoom_in", "first shot KINETIC_TITLE → zoom_in"
        return director_choice, f"first shot → director choice ({director_choice})"

    prev_type = prev_shot.get("shot_type") or ""
    prev_fam = family_of(prev_type)

    # 2. Act boundary override
    if is_act_boundary and act_transition_out:
        mapped = _ACT_TRANSITION_MAP.get(act_transition_out.strip().lower())
        if mapped:
            return mapped, f"act boundary transition_out={act_transition_out} → {mapped}"

    # 3. KINETIC_TEXT — entrances are word-driven; outer wrapper should cut.
    if shot_type == "KINETIC_TEXT":
        return "cut", "KINETIC_TEXT → cut"

    # 4. KINETIC_TITLE — convention is zoom_in unless director said otherwise emphatically
    if shot_type == "KINETIC_TITLE":
        if director_choice in ("zoom_in", "wipe_right", "fade", "vignette_fade"):
            return director_choice, f"KINETIC_TITLE → respect director ({director_choice})"
        return "zoom_in", "KINETIC_TITLE → zoom_in (default)"

    # 5. Cross-family hard cut (cinematic ↔ infographic ↔ product)
    style_worlds = {"cinematic", "infographic", "product"}
    if prev_fam in style_worlds and shot_fam in style_worlds and prev_fam != shot_fam:
        return "vignette_fade", f"cross-family {prev_fam} → {shot_fam} → vignette_fade"

    # 6. Same-shot-type cinematic sequence — use whip_pan to keep momentum
    if prev_type == shot_type and shot_type in ("VIDEO_HERO", "IMAGE_HERO"):
        if director_choice in ("cut", "fade"):
            return "whip_pan", f"{shot_type} → {shot_type} sequence → whip_pan"

    # 7. PRODUCT_HERO chain — keep crossfades subtle
    if prev_type == "PRODUCT_HERO" and shot_type == "PRODUCT_HERO":
        return "fade", "PRODUCT_HERO sequence → fade"

    # 8. Stat sequence — slide_left for serial reveals
    if prev_type == "DATA_STORY" and shot_type == "DATA_STORY":
        return "slide_left", "DATA_STORY sequence → slide_left"

    # 9. INFOGRAPHIC_SVG sequence — wipe_right for blueprint progression
    if prev_type == "INFOGRAPHIC_SVG" and shot_type == "INFOGRAPHIC_SVG":
        return "wipe_right", "INFOGRAPHIC_SVG sequence → wipe_right"

    # 10. Default — respect what the Director emitted (already normalized)
    return director_choice, f"director choice ({director_choice})"


def apply_to_plan(
    director_plan: Dict[str, Any],
    *,
    act_plan: Optional[Dict[str, Any]] = None,
) -> List[Tuple[int, str, str, str]]:
    """Walk a Director plan and rewrite every shot's `transition_in` in place.

    Returns a list of (shot_index, old_value, new_value, reason) tuples for
    diagnostic logging. Caller should print these as `🎬 Shot N transition: ...`.
    """
    shots: List[Dict[str, Any]] = director_plan.get("shots") or []
    acts: List[Dict[str, Any]] = (act_plan or {}).get("acts") or []

    # Build a quick map: shot_index that starts a new act → that act's predecessor's transition_out
    act_boundary_for: Dict[int, str] = {}
    if acts:
        # Acts have start_time/end_time. Find shot_index where start_time matches an act's start_time
        # (skipping the first act since shot 0 isn't a "boundary").
        for ai in range(1, len(acts)):
            prev_act = acts[ai - 1]
            cur_act = acts[ai]
            cur_start = float(cur_act.get("start_time", 0))
            prev_out = (prev_act.get("transition_out") or "").strip()
            if not prev_out:
                continue
            for si, s in enumerate(shots):
                if abs(float(s.get("start_time", 0)) - cur_start) < 0.05:
                    act_boundary_for[si] = prev_out
                    break

    changes: List[Tuple[int, str, str, str]] = []
    for i, shot in enumerate(shots):
        prev = shots[i - 1] if i > 0 else None
        old = shot.get("transition_in") or ""
        boundary_out = act_boundary_for.get(i)
        chosen, reason = pick(
            prev,
            shot,
            is_act_boundary=boundary_out is not None,
            act_transition_out=boundary_out,
        )
        if chosen != old:
            shot["transition_in"] = chosen
            changes.append((i, old or "(none)", chosen, reason))
    return changes
