"""Vision-LLM reviewer for one generated shot.

Sends 1–3 PNG screenshots of a rendered shot to a Gemini Flash–class vision
model along with the shot's metadata and brand palette, and parses the
model's structured JSON verdict. Returns a normalized record the pipeline
can persist to vision_review_cases and act on (corrective regen, ship, log).

The rubric (SYSTEM_PROMPT) and the per-shot user template are deliberately
frozen as PROMPT_VERSION strings — every change bumps the version so DB
rows stay comparable across time.
"""
from __future__ import annotations

import base64
import json
import logging
import time
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)

# Bumped from "v1" → "v2" because (a) the default model changed to
# Gemini 2.5 Pro and (b) a TEXT_WRAP_BREAK rubric item was added. Rows in
# vision_review_cases carry this version so engineers can compare hit rates
# across rubric revisions.
PROMPT_VERSION = "v2"

# Cost per million tokens. Defaults match OpenRouter's published rates for
# google/gemini-2.5-pro; bump if the rate card changes. Used only for
# telemetry — does not gate behaviour. (Flash was ~17× cheaper but
# measurably weaker at fine text/layout inspection; we eat the cost to
# catch the defects users actually see.)
_DEFAULT_INPUT_COST_PER_M = 1.25    # USD per 1M input tokens (incl. image tokens)
_DEFAULT_OUTPUT_COST_PER_M = 5.00   # USD per 1M output tokens

ISSUE_CODES = frozenset({
    # Generic
    "LEGIBILITY",
    "TEXT_WRAP_BREAK",       # NEW v2 — word splits mid-token, or single word wraps across two lines
    "HIERARCHY",
    "PALETTE",
    "FRAMING",
    "LAYOUT",
    "NO_MOTION",
    "RESIDUAL",
    "IRRELEVANT_MEDIA",
    "SYNC_DRIFT",
    # Host-specific
    "HOST_FACE_COUNT",
    "TEXT_ON_FACE",
    "TEXT_CLIPPED",
    "HOST_LAYOUT_MISMATCH",
    "HOST_IDENTITY_DRIFT",
})


SYSTEM_PROMPT = f"""You are a strict, conservative video frame reviewer for an AI-generated educational explainer.
Reviewer prompt version: {PROMPT_VERSION}.

You will see 1 to 3 screenshots from one shot in the order: early frame, middle frame, exit frame.
Your job is to identify SHIPPING-BLOCKING defects and IGNORE subjective taste calls.

Block the shot ONLY if one or more of the checks below clearly fails. Subjective preferences
("I would have used a different colour", "I'd have made the title bigger") are NEVER blocking.

CHECKLIST (apply in order):

1. LEGIBILITY
   - Every visible text element must be readable at this resolution.
   - Contrast must be sufficient (rough WCAG-AA — 4.5:1 for body text, 3:1 for large headlines).
   - Block (severity 3) if any visible text is illegible (tiny, low-contrast, or visually behind another element).

1b. TEXT_WRAP_BREAK  (DISTINCT from LEGIBILITY — text is readable, but laid out wrong)
   - Inspect every line of every text element CAREFULLY, especially headlines.
   - Block (severity 3, code TEXT_WRAP_BREAK) if ANY of these is true:
       (a) A single word is split across two lines (e.g. "UNDERSTAND-" on line 1, "ING" on line 2 — mid-word break).
       (b) A single short word sits alone on its own line because the line above ran out of room.
       (c) A two-word headline wraps so that one word is on each line when the design clearly intended a single line.
       (d) A line ends with a partial word and the rest is clipped off the canvas edge.
   - This is the most common defect we see in production. Be aggressive about flagging it.
   - Suggestion field MUST give a concrete CSS fix, e.g.:
       "Add max-width:88% and word-break:keep-all to the headline container."
       "Reduce font-size from Xrem to Yrem so the headline fits on one line."
       "Add hyphens:none to prevent the renderer from breaking 'PHOTOSYNTHESIS' across lines."

2. HIERARCHY
   - The eye should land on the most important element first.
   - The most important word/value should be the largest.
   - Block (severity 3) ONLY if the visual hierarchy actively misleads (e.g. a footnote is bigger than the title).

3. PALETTE COMPLIANCE
   - Compare visible colours against the BRAND PALETTE supplied in the user prompt.
   - Block (severity 2-3) if a non-brand hex appears as a primary or accent colour.
   - Do NOT block if the brand palette appears at lower saturation due to overlays, or for neutrals used for body text or content-color reds/greens.

4. FRAMING
   - If a subject (image hero, product, character) is present, it must not be cropped at a damaging point (eyeline, chin, knees).
   - The most important content must not be cut off the frame.
   - Block (severity 3) if a subject is cropped in a way that breaks readability.

5. LAYOUT INTEGRITY
   - Elements must not visibly collide (text on top of text, image clipping a label, etc.).
   - Flexbox/grid must not have collapsed wrongly at this aspect ratio.
   - Block (severity 3) on visible collision.

6. MOTION PRESENCE
   - Compare early vs middle vs exit frames. Has anything changed?
   - For shots ≥3s: block (severity 2) if all frames are identical (static shot).
   - For shots <3s: motion presence is optional — do not block.

7. RESIDUAL ARTIFACTS (exit frame only)
   - The exit frame should not show a vignette overlay still visible, or a transition tween mid-flight (text 70% slid in).
   - Block (severity 3) if the exit frame is mid-transition.

8. STOCK-MEDIA RELEVANCE
   - If the SHOT TYPE is VIDEO_HERO or IMAGE_HERO, the visible media must plausibly match the visual description.
   - Block (severity 3) if the media is wildly off-topic (e.g. daytime stock photo for a "neon night alleys" shot).
   - Code: IRRELEVANT_MEDIA.

9. SYNC ALIGNMENT
   - For each sync_point time provided in the shot meta, the corresponding screenshot frame
     should show the related visual element entering or active at that moment.
   - Flag (severity 2) if the visual is fully static at the sync timestamp, or if the wrong
     element is animating. Code: SYNC_DRIFT.

HOST-SHOT MODE — applies only when host_present=true in the user prompt
   - The shot must contain EXACTLY ONE human face — the on-screen host.
   - Flag (severity 3, code HOST_FACE_COUNT) if you see TWO+ faces (e.g. host plus a stock-photo
     headshot inside an overlay card) or ZERO faces.
   - Flag (severity 3, code TEXT_ON_FACE) if any overlay text intersects the bounding box of the
     host's face/torso (lips, eyes, neck, chest).
   - Flag (severity 3, code TEXT_CLIPPED) if any text is clipped at any canvas edge.
   - Flag (severity 3, code HOST_LAYOUT_MISMATCH) if host is on the wrong side of the canvas
     for the supplied host_layout (e.g. layout='free_right' means host expected on left half).
   - Flag (severity 2, code HOST_IDENTITY_DRIFT) if the host's apparent age/ethnicity/face structure
     differs noticeably from the supplied reference_face_url.

USER-AUTHORED 'TEXT ONLY' MODE — applies only when user_authored_no_imagery=true
   - Flag (severity 3, code IRRELEVANT_MEDIA) if any image, photograph, or human figure appears.

ISSUE CODES (use ONLY these, exact spelling): LEGIBILITY, TEXT_WRAP_BREAK, HIERARCHY, PALETTE,
FRAMING, LAYOUT, NO_MOTION, RESIDUAL, IRRELEVANT_MEDIA, SYNC_DRIFT, HOST_FACE_COUNT, TEXT_ON_FACE,
TEXT_CLIPPED, HOST_LAYOUT_MISMATCH, HOST_IDENTITY_DRIFT.

OUTPUT — return ONLY a JSON object, no markdown fences, no commentary:
{{
  "passes": <bool: true if no blocking issues>,
  "issues": [
    {{
      "code": "<one of the codes above>",
      "severity": <1=minor, 2=notable, 3=must-fix>,
      "description": "<one sentence pointing at the specific element>",
      "suggestion": "<one sentence telling the regen LLM exactly how to fix it>"
    }}
  ],
  "severity_max": <0..3 — max severity across issues, 0 if issues=[]>
}}

Rules of engagement:
- ≤4 issues per shot. Pick the most-important.
- Severity 3 is reserved for genuine breakage. Don't issue a 3 for taste.
- If everything looks fine, return {{"passes": true, "issues": [], "severity_max": 0}}.
"""


def _build_user_prompt(
    *,
    shot: Dict[str, Any],
    shot_pack: Optional[Dict[str, Any]],
    canvas: str,
    host_meta: Optional[Dict[str, Any]],
    timestamps: List[float],
    palette: Optional[Dict[str, Any]] = None,
) -> str:
    # Brand palette comes from the run's style_guide (hex values), NOT from
    # shot_pack — shot_pack stores CSS var references (`var(--brand-primary)`),
    # which the vision model can't compare visually.
    palette = palette or {}
    font_scale = (shot_pack or {}).get("font_scale") or {}
    sync_points = shot.get("sync_points") or []
    sync_lines = "\n".join(
        f"  - t={float(sp.get('time', 0)):.2f}s — word={sp.get('word', '?')!r} action={sp.get('action', '?')!r}"
        for sp in sync_points[:8]
    ) or "  (none)"
    duration = float(shot.get("duration") or shot.get("end", 0) - shot.get("start", 0) or 0)
    narration = (shot.get("narration") or shot.get("script") or shot.get("narration_excerpt") or "").strip()
    if len(narration) > 600:
        narration = narration[:600] + "…"
    visual_desc = (shot.get("visual_description") or shot.get("visual_direction") or "").strip()
    if len(visual_desc) > 400:
        visual_desc = visual_desc[:400] + "…"

    parts = [
        "SHOT META",
        f"- Shot type: {shot.get('shot_type') or shot.get('type') or 'UNKNOWN'}",
        f"- Canvas: {canvas}",
        f"- Duration: {duration:.2f}s",
        f"- Narration: {narration!r}",
        f"- Director visual direction: {visual_desc!r}",
        f"- Sync points:\n{sync_lines}",
        f"- Screenshot timestamps (shot-relative seconds, in order): {timestamps}",
        "",
        "BRAND PALETTE (these are the dominant non-neutral colours that should appear)",
        f"- primary: {palette.get('primary', '(unset)')}",
        f"- accent:  {palette.get('accent', '(unset)')}",
        f"- text:    {palette.get('text', '(unset)')}",
        f"- bg:      {palette.get('background', '(unset)')}",
        "",
        "FONT SCALE (rem; for legibility reference)",
        f"- display: {font_scale.get('display', '(unset)')}",
        f"- h1:      {font_scale.get('h1', '(unset)')}",
        f"- body:    {font_scale.get('body', '(unset)')}",
    ]

    if host_meta and host_meta.get("host_present"):
        parts += [
            "",
            "HOST META",
            f"- host_present: true",
            f"- host_layout: {host_meta.get('host_layout', '(unset)')}",
            f"- expected_host_position: {host_meta.get('expected_host_position', '(unset)')}",
            f"- expected_overlay_zone:  {host_meta.get('expected_overlay_zone', '(unset)')}",
            f"- expected_face_count:    {host_meta.get('expected_face_count', 1)}",
            f"- reference_face_url:     {host_meta.get('reference_face_url', '(none)')}",
            f"- user_authored_no_imagery: {bool(host_meta.get('user_authored_no_imagery'))}",
        ]
    elif host_meta and host_meta.get("user_authored_no_imagery"):
        parts += [
            "",
            "USER-AUTHORED MODE",
            "- user_authored_no_imagery: true (NO images/photos/people allowed in this frame)",
        ]

    parts += [
        "",
        "Return JSON only. Screenshots follow.",
    ]
    return "\n".join(parts)


def _parse_review_json(raw: str) -> Optional[Dict[str, Any]]:
    """Forgiving JSON parser — strips markdown fences, finds the outermost JSON object,
    falls back to truncation at the last close brace. Mirrors subject_extractor._parse_subjects_json.
    """
    if not raw or not isinstance(raw, str):
        return None
    text = raw.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        if lines:
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    obj_start = text.find("{")
    if obj_start < 0:
        return None
    text = text[obj_start:]
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        last_close = text.rfind("}")
        if last_close > 0:
            try:
                parsed = json.loads(text[: last_close + 1])
            except json.JSONDecodeError:
                return None
        else:
            return None
    if not isinstance(parsed, dict):
        return None
    return parsed


def _normalize_review(parsed: Dict[str, Any]) -> Dict[str, Any]:
    """Coerce loose model output into a stable shape. Drops unknown issue codes
    rather than failing — the reviewer will still ship; we just don't act on
    bogus codes downstream."""
    issues_raw = parsed.get("issues") or []
    issues: List[Dict[str, Any]] = []
    sev_max = 0
    if isinstance(issues_raw, list):
        for item in issues_raw[:4]:
            if not isinstance(item, dict):
                continue
            code = str(item.get("code") or "").strip().upper()
            if code not in ISSUE_CODES:
                logger.debug(f"reviewer returned unknown issue code (dropped): {code!r}")
                continue
            try:
                sev = int(item.get("severity") or 0)
            except (TypeError, ValueError):
                sev = 0
            sev = max(0, min(3, sev))
            sev_max = max(sev_max, sev)
            issues.append({
                "code": code,
                "severity": sev,
                "description": str(item.get("description") or "").strip()[:500],
                "suggestion": str(item.get("suggestion") or "").strip()[:500],
            })
    passes = bool(parsed.get("passes")) and not issues
    return {"passes": passes, "issues": issues, "severity_max": sev_max}


def _png_to_data_url(png: bytes) -> str:
    return f"data:image/png;base64,{base64.b64encode(png).decode('ascii')}"


def review_shot(
    *,
    screenshots: List[bytes],
    shot: Dict[str, Any],
    shot_pack: Optional[Dict[str, Any]],
    canvas: str,
    timestamps: List[float],
    llm_chat: Callable[..., Any],
    host_meta: Optional[Dict[str, Any]] = None,
    palette: Optional[Dict[str, Any]] = None,
    model: str = "google/gemini-2.5-pro",
    # Pro on OpenRouter consumes tokens on internal reasoning before emitting
    # JSON. With a verbose rubric, 1200 was occasionally truncated. Output
    # cost on 2400 tokens at $5/M is ~$0.012 per shot — small on top of the
    # input-token cost which dominates with 3 PNGs.
    max_tokens: int = 2400,
    temperature: float = 0.0,
    input_cost_per_m: float = _DEFAULT_INPUT_COST_PER_M,
    output_cost_per_m: float = _DEFAULT_OUTPUT_COST_PER_M,
) -> Dict[str, Any]:
    """Run the vision review against a single shot. Never raises — every error
    path returns a no-op record so the caller can ship the original HTML.

    Returns a record dict:
      - passes: bool
      - issues: [{code, severity, description, suggestion}]
      - severity_max: int (0..3)
      - review_ms: int
      - cost_usd: float
      - prompt_version: str (frozen)
      - raw: str  (model's raw response — kept for debugging, persisted to DB)
      - model: str
      - error: str | None (set on failure paths; passes will be True so the shot ships)
    """
    if not screenshots:
        return _no_op_record(prompt_version=PROMPT_VERSION, model=model, error="no screenshots")

    user_text = _build_user_prompt(
        shot=shot,
        shot_pack=shot_pack,
        canvas=canvas,
        host_meta=host_meta,
        timestamps=list(timestamps),
        palette=palette,
    )

    # Build a multimodal user message: text part + N image parts (in order).
    user_content: List[Dict[str, Any]] = [{"type": "text", "text": user_text}]
    for png in screenshots:
        user_content.append({
            "type": "image_url",
            "image_url": {"url": _png_to_data_url(png)},
        })

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]

    started = time.monotonic()
    try:
        raw, usage = llm_chat(
            messages=messages,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            response_format={"type": "json_object"},
        )
    except TypeError:
        # Older clients may not accept response_format kwarg — retry without it.
        try:
            raw, usage = llm_chat(
                messages=messages,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
            )
        except Exception as exc:
            logger.warning(f"vision review LLM call failed: {exc}")
            return _no_op_record(prompt_version=PROMPT_VERSION, model=model, error=str(exc))
    except Exception as exc:
        logger.warning(f"vision review LLM call failed: {exc}")
        return _no_op_record(prompt_version=PROMPT_VERSION, model=model, error=str(exc))

    review_ms = int((time.monotonic() - started) * 1000)

    parsed = _parse_review_json(raw or "")
    if parsed is None:
        logger.warning(f"vision review returned unparseable JSON; raw[:200]={ (raw or '')[:200]!r}")
        return _no_op_record(
            prompt_version=PROMPT_VERSION,
            model=model,
            error="unparseable JSON",
            raw=raw,
            review_ms=review_ms,
            usage=usage,
            input_cost_per_m=input_cost_per_m,
            output_cost_per_m=output_cost_per_m,
        )

    norm = _normalize_review(parsed)
    cost_usd = _estimate_cost(usage, input_cost_per_m, output_cost_per_m)

    return {
        **norm,
        "review_ms": review_ms,
        "cost_usd": cost_usd,
        "prompt_version": PROMPT_VERSION,
        "model": model,
        "raw": raw,
        "error": None,
    }


def _estimate_cost(usage: Optional[Dict[str, Any]], in_per_m: float, out_per_m: float) -> float:
    if not usage:
        return 0.0
    try:
        prompt = int(usage.get("prompt_tokens") or 0)
        completion = int(usage.get("completion_tokens") or 0)
    except (TypeError, ValueError):
        return 0.0
    cost = (prompt / 1_000_000.0) * in_per_m + (completion / 1_000_000.0) * out_per_m
    return round(cost, 6)


def _no_op_record(
    *,
    prompt_version: str,
    model: str,
    error: str,
    raw: Optional[str] = None,
    review_ms: int = 0,
    usage: Optional[Dict[str, Any]] = None,
    input_cost_per_m: float = _DEFAULT_INPUT_COST_PER_M,
    output_cost_per_m: float = _DEFAULT_OUTPUT_COST_PER_M,
) -> Dict[str, Any]:
    """Return a 'pass-through' record. The shot ships, no regen fires, no row
    is written by the caller (caller checks `error` → skips persistence)."""
    return {
        "passes": True,
        "issues": [],
        "severity_max": 0,
        "review_ms": review_ms,
        "cost_usd": _estimate_cost(usage, input_cost_per_m, output_cost_per_m),
        "prompt_version": prompt_version,
        "model": model,
        "raw": raw,
        "error": error,
    }
