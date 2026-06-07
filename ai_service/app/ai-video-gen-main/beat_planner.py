"""BeatPlanner — Phase 1 of the pipeline-v2 refactor.

Plans an ordered list of beats from the user's prompt BEFORE the Script
Generator emits narration text and BEFORE TTS runs. In the legacy pipeline,
the Script Generator owned both beat planning AND narration; splitting them
gives the Director (Phase 2) a beat list to operate on pre-TTS, which is
what makes per-shot TTS and AudioPolicyPlanner work cleanly.

This module is intentionally narrow: it does ONE LLM call, parses the result
into a normalized beat list, and returns. No pipeline orchestration, no file
I/O, no caching. The caller (automation_pipeline.run() in Phase 2) owns
those concerns.

The output shape is forward-compatible with the legacy `beat_outline`:
each beat carries `narration` (legacy) AND the new fields. Until Phase 2
wires this in, callers MAY use the result to enrich an existing beat_outline,
but the canonical flip happens when STAGE_ORDER changes.

Public API
----------
- `plan_beats(...)`: returns {"beats": [...], "usage": {...}, "raw": "..."}.
- `BeatPlanError`: raised on unrecoverable parse / LLM errors.
- `BEAT_VISUAL_TYPES`, `BEAT_INTENT_ROLES`: enumerations for the new fields.

Off-by-default — gated by `QUALITY_TIERS[tier]["beat_planner_enabled"]` at
the call site in automation_pipeline.py.
"""
from __future__ import annotations

import json
import re
from typing import Any, Callable, Dict, List, Optional, Tuple


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------

# Allowed `visual_type_hint` values. The planner maps these to shot_types.
BEAT_VISUAL_TYPES: Tuple[str, ...] = (
    "motion_graphic",   # text + animation, no media (default)
    "image_hero",       # AI-generated still or stock photo, full canvas
    "stock_video",      # Pexels / Pixabay clip, full canvas
    "ai_video",         # fal.ai Veo clip (ultra+ only, opt-in)
    "infographic",      # SVG diagram / chart
    "device_mockup",    # UI screen mock
    "kinetic_title",    # title card with motion
    "annotation_map",   # map / floorplan with callouts
    "split_comparison", # left/right comparison
)

# Allowed `intent_role` values. These describe each beat's narrative function.
# Used by the Director and AudioPolicyPlanner to bias decisions (e.g. an
# `intent_role == "moment"` beat is a strong candidate for AI_VIDEO_HERO with
# audio_only policy).
BEAT_INTENT_ROLES: Tuple[str, ...] = (
    "hook",         # 0-5s opener — grab attention
    "setup",        # frame the problem / question
    "explanation", # core teaching content (most beats here)
    "example",      # worked example or demonstration
    "moment",       # cinematic / emotional beat (good fit for AI video)
    "recap",        # restate the key idea
    "cta",          # call-to-action / outro
)

# Default words-per-minute pacing estimate. Sarvam, Google, and Edge TTS pace
# around 140-160 wpm in English. 150 is the calibrated midpoint — Phase 1
# verification refines per-voice if the parity test flags drift.
DEFAULT_WPM = 150.0


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class BeatPlanError(RuntimeError):
    """Raised when beat planning produces an unusable result.

    Callers should fall back to the legacy Script-Generator-emits-beats
    path on this exception — the pipeline must keep working.
    """


# ---------------------------------------------------------------------------
# Prompt construction
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """You are a video planning assistant. Given a user request, you
produce a JSON list of "beats" — atomic story units that will become the
input to a per-shot Director stage.

A beat is a single unit of meaning with:
  - a narration_hint (whether the beat is spoken or visual-only)
  - a visual_type_hint (what kind of visual fits best)
  - an intent_role (what narrative function this beat plays)
  - a duration_estimate_s (in seconds, based on a 150 wpm pacing target)

Beats are ordered. Total estimated duration should match the target.

OUTPUT FORMAT — strict JSON, no prose, no markdown fences:
{
  "beats": [
    {
      "beat_idx": 0,
      "label": "short identifier (3-5 words)",
      "narration_hint": true,
      "intended_narration": "the words the narrator says, OR empty string when narration_hint is false",
      "visual_type_hint": "one of: motion_graphic | image_hero | stock_video | ai_video | infographic | device_mockup | kinetic_title | annotation_map | split_comparison",
      "intent_role": "one of: hook | setup | explanation | example | moment | recap | cta",
      "duration_estimate_s": 4.2
    },
    ...
  ]
}

RULES:
  1. First beat is intent_role=hook (≤ 5s).
  2. Last beat is intent_role=cta (≤ 6s).
  3. Most middle beats are intent_role=explanation; sprinkle example/moment/recap as content fits.
  4. narration_hint=false means the beat is purely visual — useful for cinematic moments where
     the visual alone carries meaning. Use sparingly (≤ 1 per video unless AI video is enabled).
  5. duration_estimate_s = word_count / 2.5 (i.e. 150 wpm = 2.5 wps) for narrated beats; for
     non-narrated beats, choose a duration that matches the visual's natural length (3-8s typical).
  6. Total of duration_estimate_s should be within ±10% of the target duration provided.
  7. visual_type_hint should follow the user's visual preferences when stated.
"""


def _build_user_prompt(
    *,
    prompt: str,
    target_duration_s: float,
    target_audience: str,
    language: str,
    content_type: str,
    tier: str,
    max_beats: int,
    input_assets: Optional[List[Dict[str, Any]]],
    visual_preferences: Optional[Dict[str, Any]],
    ai_video_enabled: bool,
) -> str:
    lines: List[str] = [
        f"USER REQUEST: {prompt}",
        f"TARGET DURATION: {target_duration_s:.1f} seconds",
        f"TARGET AUDIENCE: {target_audience}",
        f"LANGUAGE: {language}",
        f"CONTENT TYPE: {content_type}",
        f"QUALITY TIER: {tier}",
        f"MAX BEATS: {max_beats} (fewer is fine — aim for natural beat boundaries)",
    ]

    if ai_video_enabled:
        lines.append(
            "AI VIDEO IS ENABLED for this run — you MAY use visual_type_hint=\"ai_video\" "
            "for cinematic moment beats where stock footage wouldn't capture the intent. "
            "Use sparingly (1-3 per video max, cost-sensitive)."
        )
    else:
        lines.append(
            "AI VIDEO IS NOT ENABLED — do NOT use visual_type_hint=\"ai_video\". "
            "Stay with motion_graphic / image_hero / stock_video / infographic / etc."
        )

    if input_assets:
        lines.append("")
        lines.append("INPUT ASSETS (user-provided footage / images you can reference):")
        for a in input_assets[:5]:  # cap at 5 to bound prompt size
            kind = a.get("kind") or a.get("type") or "asset"
            name = a.get("name") or a.get("filename") or "unnamed"
            desc = a.get("description") or a.get("excerpt") or ""
            lines.append(f"  - [{kind}] {name}: {desc[:140]}")

    if visual_preferences:
        lines.append("")
        lines.append("VISUAL PREFERENCES (soft bias — content always wins on conflict):")
        for fam, bias in visual_preferences.items():
            if bias and bias != "auto":
                arrow = "PREFER" if bias == "high" else "AVOID"
                lines.append(f"  - {fam}: {arrow}")

    lines.append("")
    lines.append("Output the JSON now. No commentary, no fences, no preamble.")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Parsing & normalization
# ---------------------------------------------------------------------------

_JSON_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE | re.MULTILINE)


def _strip_fences(text: str) -> str:
    """Strip ```json ... ``` fences the LLM sometimes adds despite instructions."""
    return _JSON_FENCE_RE.sub("", text).strip()


def _find_json_object(text: str) -> Optional[str]:
    """Locate the outermost {...} in `text` — tolerates LLM preamble/postamble.
    Returns None if no balanced object is found."""
    start = text.find("{")
    if start < 0:
        return None
    depth = 0
    in_str = False
    esc = False
    for i in range(start, len(text)):
        ch = text[i]
        if esc:
            esc = False
            continue
        if ch == "\\":
            esc = True
            continue
        if ch == '"':
            in_str = not in_str
            continue
        if in_str:
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start:i + 1]
    return None


def _coerce_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _coerce_int(value: Any, default: int = 0) -> int:
    if isinstance(value, bool):
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        if isinstance(value, str):
            try:
                return int(value.strip())
            except (TypeError, ValueError):
                return default
        return default


def _word_count(text: str) -> int:
    return len([w for w in (text or "").split() if w.strip()])


def _normalize_beat(raw: Dict[str, Any], idx: int) -> Dict[str, Any]:
    """Coerce a raw LLM beat into the canonical shape.

    Out-of-vocabulary `visual_type_hint` / `intent_role` values fall back to
    safe defaults ("motion_graphic" / "explanation") rather than raising —
    we'd rather degrade quality than fail planning.
    """
    vt = str(raw.get("visual_type_hint") or "").strip().lower()
    if vt not in BEAT_VISUAL_TYPES:
        vt = "motion_graphic"
    role = str(raw.get("intent_role") or "").strip().lower()
    if role not in BEAT_INTENT_ROLES:
        role = "explanation"

    narration_hint_raw = raw.get("narration_hint")
    if isinstance(narration_hint_raw, bool):
        narration_hint = narration_hint_raw
    elif isinstance(narration_hint_raw, str):
        narration_hint = narration_hint_raw.strip().lower() in ("true", "yes", "1")
    else:
        # Default: narrated unless explicitly silent
        narration_hint = True

    intended_narration = str(raw.get("intended_narration") or "").strip()
    if not narration_hint:
        intended_narration = ""  # enforce the contract: silent beats have no text

    label = str(raw.get("label") or f"Beat {idx + 1}").strip()

    # Duration estimate: prefer LLM's value when provided, else compute from
    # word count at the default WPM. For non-narrated beats, default to 4s.
    dur = _coerce_float(raw.get("duration_estimate_s"), 0.0)
    if dur <= 0:
        if narration_hint and intended_narration:
            dur = _word_count(intended_narration) / (DEFAULT_WPM / 60.0)
        else:
            dur = 4.0
    # Clamp to a sane range: 1.5s minimum (otherwise the beat is too short for
    # any visual to land), 25s maximum (beats longer than that should be split).
    dur = max(1.5, min(25.0, dur))

    return {
        "beat_idx": _coerce_int(raw.get("beat_idx"), idx),
        "label": label,
        # Legacy compatibility: `narration` field consumed by existing
        # downstream code (line 3912+ in automation_pipeline.py). Equal to
        # intended_narration unless silent.
        "narration": intended_narration,
        # New v2 fields
        "narration_hint": narration_hint,
        "intended_narration": intended_narration,
        "visual_type_hint": vt,
        "intent_role": role,
        "duration_estimate_s": round(dur, 2),
    }


def _parse_beats(text: str) -> List[Dict[str, Any]]:
    """Parse the LLM response into a list of normalized beats.

    Tries strict JSON first, then strips fences, then extracts the outermost
    {...} block. Raises BeatPlanError on hopeless input.
    """
    candidates: List[str] = [text, _strip_fences(text)]
    extracted = _find_json_object(text)
    if extracted:
        candidates.append(extracted)

    last_err: Optional[Exception] = None
    for cand in candidates:
        cand = (cand or "").strip()
        if not cand:
            continue
        try:
            data = json.loads(cand)
        except Exception as err:
            last_err = err
            continue
        if not isinstance(data, dict):
            continue
        raw_beats = data.get("beats")
        if not isinstance(raw_beats, list) or not raw_beats:
            continue
        normalized: List[Dict[str, Any]] = []
        for i, rb in enumerate(raw_beats):
            if not isinstance(rb, dict):
                continue
            normalized.append(_normalize_beat(rb, i))
        if normalized:
            return normalized

    raise BeatPlanError(
        f"BeatPlanner produced no usable beats. Last parse error: {last_err}. "
        f"Response head: {text[:200]!r}"
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def to_script_plan_beat_outline(beats: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Convert BeatPlanner output → the `beat_outline` shape that the Director
    and Script Generator already consume (see director_prompts.py:1216,
    automation_pipeline._draft_script). One-to-one mapping; preserves order.

    BeatPlanner adds two fields the legacy outline didn't carry —
    `duration_estimate_s` and `intent_role` — both surface to the Director so
    it can plan shot timings before TTS runs.
    """
    outline: List[Dict[str, Any]] = []
    for i, b in enumerate(beats or []):
        outline.append({
            "label": b.get("label", f"Beat {i + 1}"),
            "narration": b.get("intended_narration") or b.get("narration") or "",
            "visual_type": b.get("visual_type_hint", ""),
            "visual_idea": "",
            "emotion": "",
            "pacing": "normal",
            "complexity_level": "moderate",
            "key_terms": [],
            # New v2 fields — opaque to legacy consumers (dict.get() noop).
            "duration_estimate_s": float(b.get("duration_estimate_s") or 0.0),
            "intent_role": b.get("intent_role", ""),
            "narration_hint": bool(b.get("narration_hint", True)),
        })
    return outline


def plan_beats(
    *,
    prompt: str,
    target_duration_s: float,
    target_audience: str = "general audience",
    language: str = "English",
    content_type: str = "VIDEO",
    tier: str = "premium",
    llm_chat: Callable[..., Tuple[str, Dict[str, Any]]],
    model: Optional[str] = None,
    input_assets: Optional[List[Dict[str, Any]]] = None,
    visual_preferences: Optional[Dict[str, Any]] = None,
    ai_video_enabled: bool = False,
    max_beats: int = 12,
    temperature: float = 0.5,
    max_tokens: int = 6000,
) -> Dict[str, Any]:
    """Plan beats for a video.

    `llm_chat` is a callable matching `OpenRouterClient.chat(...)` —
    `(messages, model=..., temperature=..., max_tokens=..., response_format=...) -> (text, usage)`.
    Passed in rather than instantiated here so callers can inject test
    doubles and so the module stays free of network deps.

    Returns:
      {
        "beats":    [<normalized beat dicts>],   # never empty on success
        "usage":    {<llm token usage>},
        "raw":      "<raw llm response>",        # for telemetry / debug
        "wpm":      150.0,                       # the pacing used for duration estimates
      }

    Raises:
      BeatPlanError on unrecoverable parse failure. The caller MUST handle
      this by falling back to the legacy Script-Generator-emits-beats path.
    """
    if not prompt or not prompt.strip():
        raise BeatPlanError("BeatPlanner requires a non-empty prompt")
    if target_duration_s <= 0:
        raise BeatPlanError(f"BeatPlanner requires positive target_duration_s, got {target_duration_s!r}")

    user_prompt = _build_user_prompt(
        prompt=prompt,
        target_duration_s=target_duration_s,
        target_audience=target_audience,
        language=language,
        content_type=content_type,
        tier=tier,
        max_beats=max_beats,
        input_assets=input_assets,
        visual_preferences=visual_preferences,
        ai_video_enabled=ai_video_enabled,
    )
    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]
    text, usage = llm_chat(
        messages,
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
        response_format={"type": "json_object"},
    )
    beats = _parse_beats(text or "")
    return {
        "beats": beats,
        "usage": usage or {},
        "raw": text or "",
        "wpm": DEFAULT_WPM,
    }
