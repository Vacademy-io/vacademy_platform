"""DialogueWriter — the craft pass for DIALOGUE_SCENE lines.

The ShotPlanner writes serviceable but EXPOSITORY dialogue ("I used to stay
up just like you, Sir. But then I switched to Vacademy…" — brochure copy in a
character's mouth). This focused pass rewrites every scene's lines for
performability — subtext, character-specific voice, natural conversational
cadence — and adds per-line DELIVERY direction the pipeline can act on:

- ``emotion``: 2-4 words the Omni prompt speaks through (and a future
  emotive-TTS provider can consume);
- ``pause_after_ms``: a natural beat between lines — the per-character TTS
  concat inserts real silence instead of butt-joining MP3s.

One bounded LLM call per video; scenes that fail validation (wrong names,
over the word budget, empty) keep the planner's original lines. Pure
function over the plan dict → unit-testable.
"""
from __future__ import annotations

import json
import re
from typing import Any, Callable, Dict, List, Optional, Tuple

# Mirror of the plan lint's budget (shot_planner._DIALOGUE_MAX_WORDS).
MAX_SCENE_WORDS = 24
MAX_LINES = 2


def _dialogue_shots(plan: Dict[str, Any]) -> List[Dict[str, Any]]:
    return [
        s for s in (plan.get("shots") or [])
        if isinstance(s, dict)
        and str(s.get("shot_type") or "").upper() == "DIALOGUE_SCENE"
        and any(
            isinstance(l, dict) and str(l.get("line") or "").strip()
            for l in (s.get("dialogue") or [])
        )
    ]


def _scene_words(dialogue: List[Dict[str, Any]]) -> int:
    return sum(len(str(l.get("line") or "").split()) for l in dialogue if isinstance(l, dict))


def polish_dialogue(
    plan: Dict[str, Any],
    *,
    base_prompt: str,
    chat: Callable[..., Tuple[str, Dict[str, Any]]],
    model: Optional[str] = None,
    temperature: float = 0.7,
) -> Dict[str, Any]:
    """Rewrite every speaking scene's lines in place. Returns the LLM usage
    dict ({} when there was nothing to do or the call failed — the plan is
    never left worse than the planner wrote it)."""
    shots = _dialogue_shots(plan)
    if not shots:
        return {}
    cast = [
        c for c in (plan.get("characters") or [])
        if isinstance(c, dict) and str(c.get("name") or "").strip()
    ]
    cast_txt = "\n".join(
        f"- {c.get('name')}: {str(c.get('visual_description') or '')[:150]}"
        f" (voice: {str(c.get('voice_hint') or 'unspecified')[:60]})"
        for c in cast
    ) or "(cast unspecified — keep the names exactly as they appear in the scenes)"
    cc = plan.get("creative_concept") or {}
    scenes_txt = "\n".join(
        json.dumps({
            "shot_index": s.get("shot_index"),
            "scene_description": str(s.get("scene_description") or "")[:200],
            "emotional_beat": str(s.get("emotional_beat") or "")[:80],
            "dialogue": [
                {"character": str(l.get("character") or ""), "line": str(l.get("line") or "")}
                for l in (s.get("dialogue") or []) if isinstance(l, dict)
            ],
        }, ensure_ascii=False)
        for s in shots
    )
    prompt = (
        "You are a screenwriter punching up dialogue for a short story film. "
        "The current lines are EXPOSITORY AD-COPY — characters narrate the "
        "product pitch at each other. Rewrite each scene so real people could "
        "play it:\n"
        "- SUBTEXT over statement: characters talk about their lives, not "
        "features; feelings leak out sideways.\n"
        "- Character-specific voice (age, temperament, relationship) and "
        "natural conversational English as spoken in India — contractions, "
        "small interjections, never formal brochure phrasing.\n"
        "- Keep each scene's MEANING and story function; keep character names "
        f"EXACTLY as given; AT MOST {MAX_LINES} lines and {MAX_SCENE_WORDS} "
        "words total per scene (clips are ≤10s).\n"
        "- Per line add `emotion` (2-4 words of acting direction, e.g. 'weary, "
        "self-mocking') and `pause_after_ms` (a natural beat AFTER the line, "
        "0-800; 0 for the last line of a scene).\n"
        "- NEVER repeat a line or sentence across scenes — each thought is "
        "spoken exactly once in the whole film. When an exchange continues "
        "into the next scene, it continues with NEW words.\n"
        f"\nTONE: {str(cc.get('tonal_register') or 'warm, human')[:120]}\n"
        f"STORY: {str(base_prompt or '')[:800]}\n"
        f"CAST:\n{cast_txt}\n"
        f"\nSCENES (one JSON per line):\n{scenes_txt}\n"
        '\nReturn ONLY JSON: {"scenes": [{"shot_index": <int>, "dialogue": '
        '[{"character": "...", "line": "...", "emotion": "...", '
        '"pause_after_ms": <int>}]}]}'
    )
    try:
        raw, usage = chat(
            [{"role": "user", "content": prompt}],
            **({"model": model} if model else {}),
            temperature=temperature,
            max_tokens=1400,
            response_format={"type": "json_object"},
        )
        m = re.search(r"\{.*\}", raw or "", re.DOTALL)
        parsed = json.loads(m.group(0)) if m else {}
    except Exception:
        return {}
    by_index = {
        s.get("shot_index"): s.get("dialogue")
        for s in (parsed.get("scenes") or []) if isinstance(s, dict)
    }
    known = {str(c.get("name") or "").strip().lower() for c in cast}
    polished = 0
    # Cross-scene dedup guard: no line may be spoken in two scenes. A split
    # exchange sometimes repeats its boundary line — the viewer hears the
    # same words twice across the cut. Track normalized lines across ALL
    # accepted scenes; a rewrite that duplicates one keeps the original.
    _accepted_lines: set = set()

    def _norm_line(txt: str) -> str:
        return re.sub(r"[^a-z0-9 ]", "", txt.lower()).strip()

    for s in shots:
        new = by_index.get(s.get("shot_index"))
        if not isinstance(new, list) or not new:
            continue
        clean: List[Dict[str, Any]] = []
        for l in new[:MAX_LINES]:
            if not isinstance(l, dict):
                continue
            name = str(l.get("character") or "").strip()
            line = str(l.get("line") or "").strip()
            if not name or not line:
                continue
            if known and name.lower() not in known:
                clean = []
                break  # invented character → keep the original scene
            try:
                pause = max(0, min(800, int(l.get("pause_after_ms") or 0)))
            except (TypeError, ValueError):
                pause = 0
            clean.append({
                "character": name,
                "line": line[:200],
                "emotion": str(l.get("emotion") or "").strip()[:60],
                "pause_after_ms": pause,
            })
        if clean and _scene_words(clean) <= MAX_SCENE_WORDS:
            _norms = [
                _norm_line(l["line"]) for l in clean
                if len(_norm_line(l["line"]).split()) >= 3
            ]
            if any(n in _accepted_lines for n in _norms):
                # Rewrite repeats a line from an earlier scene — keep the
                # original scene (writer must never make things worse).
                continue
            _accepted_lines.update(_norms)
            s["dialogue"] = clean
            polished += 1
    if polished:
        print(f"   ✍️  DialogueWriter: polished {polished}/{len(shots)} scene(s)")
    return usage or {}
