"""
Subject Extractor — identifies recurring subjects across a Director shot plan.

The pipeline calls this once per video, after the Director plan is finalized.
It analyzes every shot's `image_prompt` + `visual_description` and returns a
mapping `{shot_index: subject_id}` for shots that share a subject (e.g. the
same character, product, location).

The image generation flow uses this mapping to:
  1. Generate the FIRST shot of each subject normally (text-only Seedream).
  2. Cache that image's S3 URL as the subject's reference.
  3. Pass `reference_image_url` to subsequent shots' Seedream calls so the
     model conditions on the cached image (image-to-image continuity).

LLM call: one Gemini Flash request per video. Cost: ~$0.001. Cached on the
pipeline run so retries don't double-bill. On any failure the mapping is
empty and the pipeline degrades to today's text-only behavior — never fatal.
"""
from __future__ import annotations

import json
from typing import Dict, Any, List, Optional, Tuple


_SYSTEM_PROMPT = (
    "You are a continuity supervisor for an animated explainer video. Given a "
    "shot plan, you identify recurring subjects — specific characters, "
    "products, vehicles, locations, or distinctive objects that appear in "
    "MULTIPLE shots and should look visually consistent across them.\n\n"
    "Rules:\n"
    "1. Only flag subjects that appear in 2+ shots. Singletons get no subject_id.\n"
    "2. A subject is a SPECIFIC instance, not a generic category. "
    "'A 1965 Ford Mustang in candy-apple red' is a subject; 'a car' is not.\n"
    "3. Generic backgrounds (a beach, a city skyline, a sunset) are NOT "
    "subjects unless the shot plan specifies the SAME beach / city / sunset.\n"
    "4. Pronouns and indirect references count — 'the car' in shot 5 is the "
    "same subject as 'a 1965 Mustang' in shot 2 if context makes it obvious.\n"
    "5. Use stable IDs: short snake_case slugs ('mustang_red', 'dr_chen', "
    "'product_logo'). Don't invent flavor text.\n\n"
    "Return JSON only: {\"subjects\": [{\"id\": \"...\", \"label\": \"...\", "
    "\"shot_indices\": [1, 3, 5]}]}. No commentary, no markdown fences. "
    "If no recurring subjects, return {\"subjects\": []}."
)


def _build_user_prompt(shots: List[Dict[str, Any]]) -> str:
    lines: List[str] = ["Shot plan (review for recurring subjects):", ""]
    for i, s in enumerate(shots):
        ip = (s.get("image_prompt") or "").strip()
        vd = (s.get("visual_description") or "").strip()
        ne = (s.get("narration_excerpt") or "").strip()
        if not (ip or vd or ne):
            continue
        line = f"Shot {i}:"
        if ip:
            line += f" image_prompt='{ip[:160]}'"
        if vd and not ip:
            line += f" visual='{vd[:160]}'"
        if ne:
            line += f" narration='{ne[:120]}'"
        lines.append(line)
    return "\n".join(lines)


def extract_subjects(
    shots: List[Dict[str, Any]],
    llm_chat: Any,
    *,
    min_shots_per_subject: int = 2,
    max_shots_input: int = 60,
) -> Tuple[Dict[int, str], List[Dict[str, Any]]]:
    """Run a Gemini Flash call to identify recurring subjects.

    Args:
        shots: the Director plan's shots[] list.
        llm_chat: a callable matching `OpenRouterClient.chat(messages, ...)`
                  that returns (raw_text, usage_dict). Caller passes the same
                  client used for the Director / per-shot HTML calls.
        min_shots_per_subject: ignore subjects that don't recur N+ times.
        max_shots_input: cap shots fed into the prompt to control token cost.

    Returns:
        (mapping, subjects_list)
        - mapping: {shot_index: subject_id} for every shot that participates
          in a multi-shot subject (singletons absent).
        - subjects_list: raw [{id, label, shot_indices}] for logging/debug.

        On any failure (parse error, LLM exception) returns ({}, []). Caller
        treats this as "no continuity for this run" and proceeds normally.
    """
    if not shots:
        return {}, []

    candidate_shots = [s for s in shots[:max_shots_input] if s.get("image_prompt") or s.get("visual_description")]
    if len(candidate_shots) < 2:
        return {}, []

    user_prompt = _build_user_prompt(shots[:max_shots_input])

    try:
        raw, _usage = llm_chat(
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
            max_tokens=2000,
        )
    except Exception as e:
        print(f"   ⚠️ Subject extractor LLM call failed: {e} — falling back to text-only image gen")
        return {}, []

    parsed = _parse_subjects_json(raw)
    if not parsed:
        return {}, []

    subjects = parsed.get("subjects") or []
    if not isinstance(subjects, list):
        return {}, []

    mapping: Dict[int, str] = {}
    valid_subjects: List[Dict[str, Any]] = []
    for sub in subjects:
        if not isinstance(sub, dict):
            continue
        sid = (sub.get("id") or "").strip()
        if not sid:
            continue
        indices = sub.get("shot_indices") or []
        if not isinstance(indices, list):
            continue
        # Coerce to int and clamp to valid range
        ints: List[int] = []
        for v in indices:
            try:
                iv = int(v)
            except (TypeError, ValueError):
                continue
            if 0 <= iv < len(shots):
                ints.append(iv)
        # Dedup while preserving order
        seen = set()
        ints = [i for i in ints if not (i in seen or seen.add(i))]
        if len(ints) < min_shots_per_subject:
            continue
        for idx in ints:
            # First subject wins if a shot is double-claimed.
            mapping.setdefault(idx, sid)
        valid_subjects.append({
            "id": sid,
            "label": (sub.get("label") or sid),
            "shot_indices": ints,
        })

    return mapping, valid_subjects


def _parse_subjects_json(raw: str) -> Optional[Dict[str, Any]]:
    """Parse the LLM's JSON output. Tolerates markdown fences and bare lists."""
    if not raw or not isinstance(raw, str):
        return None
    text = raw.strip()
    # Strip common code fences
    if text.startswith("```"):
        lines = text.split("\n")
        # Drop opening fence and any closing fence
        if lines:
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    # Find the outermost {...} or [...]
    obj_start = text.find("{")
    list_start = text.find("[")
    starts = [s for s in (obj_start, list_start) if s >= 0]
    if not starts:
        return None
    start = min(starts)
    text = text[start:]

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        # Try truncating at last close brace / bracket
        last_close = max(text.rfind("}"), text.rfind("]"))
        if last_close > 0:
            try:
                parsed = json.loads(text[: last_close + 1])
            except json.JSONDecodeError:
                return None
        else:
            return None

    if isinstance(parsed, list):
        return {"subjects": parsed}
    if isinstance(parsed, dict):
        return parsed
    return None
