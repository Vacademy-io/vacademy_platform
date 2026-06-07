"""Edit-Choreographer — the LLM film editor that authors the CUT between shots.

The ShotPlanner already emits a `transition_in` per shot, but while juggling ~17
other fields. This is a focused, cheap pass that sees the WHOLE timeline at once
and re-authors every transition so the cuts are MOTIVATED — by content, the
energy curve, and act/world structure — instead of a uniform fade.

It is the "LLM authors" half of the Edit-Choreographer pattern; the deterministic
`transition_picker.apply_to_plan` then VALIDATES the result (normalizes unknowns,
enforces the non-negotiable KINETIC_* rules, family/sequence sanity, fade-floor).
The LLM authors; the picker validates and can never regress.

Pure: injected `llm_chat` (matches OpenRouterClient.chat), no network deps.
Returns ({}, {}) on any failure so the caller keeps the ShotPlanner's transitions.

See: transition_picker.py (the validator) + TRANSITION_CSS_BLOCKS in prompts.py.
"""
from __future__ import annotations

import json
import re
from typing import Any, Callable, Dict, List, Optional, Tuple


PROMPT_VERSION = "ec1"

# MUST stay a subset of TRANSITION_CSS_BLOCKS (prompts.py) + _KNOWN_TRANSITIONS
# (transition_picker.py). The picker drops anything outside its known set.
VOCAB: Tuple[str, ...] = (
    "cut", "fade", "slide_left", "slide_right", "slide_up", "zoom_in", "zoom_out",
    "wipe_right", "dissolve_up", "whip_pan", "zoom_through", "vignette_fade",
    "circle_iris", "diagonal_wipe", "hexagon_iris", "blinds_horizontal",
    "smash_cut", "dip_to_black",
)
_VOCAB_SET = set(VOCAB)


SYSTEM_PROMPT = f"""You are the Edit-Choreographer — a film editor choosing the CUT into every shot of a short video. Prompt version: {PROMPT_VERSION}. You see the whole timeline at once. Assign each shot's ENTRY transition (transition_in) so the cuts MEAN something — motivated by content, the energy curve, and act/world structure — never a uniform fade.

VOCABULARY (use EXACTLY these ids): {", ".join(VOCAB)}.

PRINCIPLES:
- Motivated: a hard `cut` / `smash_cut` on a surprise or a hard fact; a slow `dissolve_up` / `fade` / `vignette_fade` on a reflective or somber beat; `whip_pan` to keep momentum between two same-family cinematic shots; `zoom_in` INTO a key concept; `zoom_out` to reveal larger context; `dip_to_black` for a deliberate time / topic jump.
- Energy curve: rising energy → tighter, harder cuts (`cut` / `smash_cut` / `whip_pan`); falling / calm → `dissolve_up` / `fade`. Match each section's energy.
- Structure: mark an act / world change (a shift in shot family or background, or a new section) with a STATEMENT reveal — `circle_iris` / `hexagon_iris` / `blinds_horizontal` / `dip_to_black`. RESERVE these for structural beats (act opener / hook / payoff): at most ~1-2 per video, and reuse the SAME reveal for the same structural role so it becomes part of the rhythm.
- Restraint: most cuts should be simple (`cut` / `fade` / a slide). The bold reveals land BECAUSE the rest are restrained — do NOT give every shot a fancy transition.

NON-NEGOTIABLE:
- Shot 0 (first): `cut`, or `zoom_in` if it is a KINETIC_TITLE.
- KINETIC_TEXT → always `cut`.
- KINETIC_TITLE → `zoom_in`.
- The shot immediately AFTER a KINETIC_TITLE → `wipe_right` or `blinds_horizontal`.

Output raw JSON ONLY (first char {{, last char }}, no prose, no fences):
{{"transitions": [{{"shot_index": 0, "transition_in": "cut", "reason": "<=8 words"}}]}}
One entry per input shot, in order. Each transition_in MUST be one of the vocabulary ids."""


def _section_energy_for(shot_idx: Any, beat_map: List[Dict[str, Any]]) -> Optional[float]:
    if not isinstance(shot_idx, int):
        return None
    for seg in beat_map:
        if not isinstance(seg, dict):
            continue
        try:
            if int(seg.get("from_shot", -1)) <= shot_idx <= int(seg.get("to_shot", -1)):
                e = seg.get("energy")
                return float(e) if isinstance(e, (int, float)) else None
        except (TypeError, ValueError):
            continue
    return None


def _shot_brief(s: Dict[str, Any], beat_map: List[Dict[str, Any]]) -> Dict[str, Any]:
    brief: Dict[str, Any] = {
        "shot_index": s.get("shot_index"),
        "shot_type": s.get("shot_type"),
        "intent_role": s.get("intent_role"),
        "background_treatment": s.get("background_treatment"),
    }
    for k in ("emotion", "pacing_role"):
        if s.get(k):
            brief[k] = s[k]
    energy = _section_energy_for(s.get("shot_index"), beat_map)
    if energy is not None:
        brief["section_energy"] = round(energy, 2)
    txt = (s.get("narration_brief") or s.get("visual_description") or "")
    if txt:
        brief["brief"] = str(txt)[:120]
    return brief


_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE | re.MULTILINE)


def _parse(raw: str) -> Optional[Dict[str, Any]]:
    if not raw:
        return None
    for cand in (raw, _FENCE_RE.sub("", raw).strip()):
        cand = (cand or "").strip()
        a, b = cand.find("{"), cand.rfind("}")
        if a < 0 or b <= a:
            continue
        try:
            data = json.loads(cand[a:b + 1])
            if isinstance(data, dict):
                return data
        except Exception:
            continue
    return None


def choreograph_transitions(
    shots: List[Dict[str, Any]],
    *,
    llm_chat: Callable[..., Tuple[str, Dict[str, Any]]],
    model: Optional[str] = None,
    beat_map: Optional[List[Dict[str, Any]]] = None,
    temperature: float = 0.4,
    max_tokens: int = 1500,
) -> Tuple[Dict[int, str], Dict[str, Any]]:
    """Author transition_in across the whole timeline. Returns
    ({shot_index: transition_in}, usage) keeping ONLY in-vocabulary values; the
    deterministic picker still validates downstream. Returns ({}, {}) on any
    failure so the caller keeps the existing transitions."""
    valid_shots = [s for s in (shots or []) if isinstance(s, dict)]
    if len(valid_shots) < 2:
        return {}, {}
    beat_map = beat_map if isinstance(beat_map, list) else []
    payload = {"shots": [_shot_brief(s, beat_map) for s in valid_shots]}
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": (
            "TIMELINE (assign transition_in for every shot):\n"
            + json.dumps(payload, ensure_ascii=False, indent=1)
            + "\n\nReturn the transitions JSON now."
        )},
    ]
    try:
        try:
            raw, usage = llm_chat(
                messages, model=model, temperature=temperature,
                max_tokens=max_tokens, response_format={"type": "json_object"},
            )
        except TypeError:
            raw, usage = llm_chat(messages, model=model, temperature=temperature, max_tokens=max_tokens)
    except Exception:
        return {}, {}

    parsed = _parse(raw or "")
    if not isinstance(parsed, dict):
        return {}, (usage or {})
    entries = parsed.get("transitions")
    if not isinstance(entries, list):
        return {}, (usage or {})

    out: Dict[int, str] = {}
    for e in entries:
        if not isinstance(e, dict):
            continue
        try:
            idx = int(e.get("shot_index"))
        except (TypeError, ValueError):
            continue
        t = str(e.get("transition_in") or "").strip().lower()
        if t in _VOCAB_SET:
            out[idx] = t
    return out, (usage or {})


# ─────────────────────────────────────────────────────────────────────────────
# Smoke test
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    shots = [
        {"shot_index": 0, "shot_type": "KINETIC_TITLE", "intent_role": "hook", "narration_brief": "open"},
        {"shot_index": 1, "shot_type": "DATA_STORY", "intent_role": "explanation", "emotion": "surprise"},
        {"shot_index": 2, "shot_type": "PRODUCT_HERO", "intent_role": "cta", "emotion": "calm"},
    ]
    bmap = [{"from_shot": 0, "to_shot": 1, "energy": 0.4}, {"from_shot": 2, "to_shot": 2, "energy": 0.9}]

    def fake(messages, **kw):
        # echo a valid choreography + one invalid id (should be dropped)
        return json.dumps({"transitions": [
            {"shot_index": 0, "transition_in": "zoom_in", "reason": "title"},
            {"shot_index": 1, "transition_in": "smash_cut", "reason": "surprise fact"},
            {"shot_index": 2, "transition_in": "banana_wipe", "reason": "invalid"},
        ]}), {"prompt_tokens": 300, "completion_tokens": 40}

    tmap, usage = choreograph_transitions(shots, llm_chat=fake, beat_map=bmap)
    assert tmap == {0: "zoom_in", 1: "smash_cut"}, tmap  # invalid 'banana_wipe' dropped
    assert usage.get("prompt_tokens") == 300

    def fake_raise(messages, **kw):
        raise RuntimeError("boom")
    assert choreograph_transitions(shots, llm_chat=fake_raise) == ({}, {})

    assert choreograph_transitions([shots[0]], llm_chat=fake) == ({}, {})  # <2 shots → skip

    print("edit_choreographer.py smoke test passed.")
