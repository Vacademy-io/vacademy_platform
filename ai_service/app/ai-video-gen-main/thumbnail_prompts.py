"""
Thumbnail prompt builder — turns Director plan + intent into 4 Seedream prompts
and a small Gemini Flash call that returns 3 alternate headlines.

The pipeline calls this from `thumbnail_generator.run()` immediately after the
Director plan is finalized. The generated images deliberately contain NO text
or logos — overlays are rendered by the frontend so the brand kit's heading
font + palette + watermark stay authoritative.

Four options are produced per video, varying along two axes:
  - subject_focus:  hero_object | hero_person | abstract_motif | type_led
  - composition:    center | rule_of_thirds | bottom_band | full_frame
Layout (where the FE overlay goes) is paired so the cleared focal space in the
image lines up with where the headline will sit.
"""
from __future__ import annotations

import json
import re
from typing import Any, Callable, Dict, List, Optional, Tuple


# ---------------------------------------------------------------------------
# Intent presets
# ---------------------------------------------------------------------------

# Recognized intents. Anything outside this set is normalized to 'explainer'.
KNOWN_INTENTS = {
    "ad",
    "explainer",
    "tutorial",
    "announcement",
    "news_recap",
    "story",
    "trailer",
}


# Style cues per intent. Each entry feeds into the Seedream prompt and into
# the headline LLM call. Tone strings are descriptive ("benefit promise, ≤4
# words") rather than templated so the LLM has room to write good copy.
INTENT_PRESETS: Dict[str, Dict[str, str]] = {
    "ad": {
        "composition_cues": (
            "product-hero composition, high contrast, brand-saturated lighting, "
            "punchy depth of field, magazine-cover energy"
        ),
        "mood_cues": "bold, confident, sales-forward, conversion-focused",
        "headline_tone": "benefit-promise — at most 4 punchy words, present tense",
        "max_words": 4,
    },
    "explainer": {
        "composition_cues": (
            "single clear subject, generous negative space, soft directional light, "
            "conceptual illustration sensibility"
        ),
        "mood_cues": "calm, clear, intellectually inviting",
        "headline_tone": "topic noun-phrase — at most 5 words, no question marks",
        "max_words": 5,
    },
    "tutorial": {
        "composition_cues": (
            "UI screen or workbench framing, monitor-on-desk vibe, step or arrow motifs, "
            "isometric or 3/4 perspective"
        ),
        "mood_cues": "practical, capable, step-by-step",
        "headline_tone": "imperative 'How to X' phrasing — at most 5 words",
        "max_words": 5,
    },
    "announcement": {
        "composition_cues": (
            "emblem or badge composition, confetti-light accents, celebratory framing, "
            "centered hero with halo lighting"
        ),
        "mood_cues": "celebratory, momentous, on-brand",
        "headline_tone": "event noun — at most 3 words, title-case",
        "max_words": 3,
    },
    "news_recap": {
        "composition_cues": (
            "newsroom motif, lower-third zone, masthead-like type space, "
            "photojournalistic clarity"
        ),
        "mood_cues": "urgent, credible, informational",
        "headline_tone": "sharp news headline — at most 6 words, no period",
        "max_words": 6,
    },
    "story": {
        "composition_cues": (
            "cinematic vignette, character or location framing, atmospheric haze, "
            "shallow focus, narrative tension"
        ),
        "mood_cues": "cinematic, evocative, atmospheric",
        "headline_tone": "evocative short phrase — at most 4 words",
        "max_words": 4,
    },
    "trailer": {
        "composition_cues": (
            "movie-poster art direction, dramatic key light + rim light, oversized title space, "
            "heroic low-angle framing"
        ),
        "mood_cues": "dramatic, hyped, premiere-night",
        "headline_tone": "trailer-style title — at most 3 words, all caps okay",
        "max_words": 3,
    },
}


# Four (subject_focus, composition, layout) bundles. Layout names match the
# overlay slots rendered by the frontend ThumbnailRenderer.
OPTION_VARIANTS: List[Dict[str, str]] = [
    {
        "id": "thumb_1",
        "subject_focus": "hero_object",
        "composition": "bottom_band",
        "layout": "bottom_band",
        "framing_brief": (
            "hero object or product fills the upper two-thirds; bottom third left "
            "intentionally clear and gently darkened for overlay text"
        ),
    },
    {
        "id": "thumb_2",
        "subject_focus": "hero_person",
        "composition": "rule_of_thirds",
        "layout": "top_left",
        "framing_brief": (
            "single human subject on the right two-thirds, top-left quadrant kept "
            "uncluttered and softly lit for the title overlay"
        ),
    },
    {
        "id": "thumb_3",
        "subject_focus": "abstract_motif",
        "composition": "full_frame",
        "layout": "center",
        "framing_brief": (
            "abstract or symbolic motif filling the frame with a clear high-contrast "
            "center where overlay text will sit"
        ),
    },
    {
        "id": "thumb_4",
        "subject_focus": "type_led",
        "composition": "center",
        "layout": "none",
        "framing_brief": (
            "minimal abstract background with strong directional gradient, large empty "
            "center stage — no main subject; the frontend will render large typography only"
        ),
    },
]


def normalize_intent(value: Any) -> str:
    """Coerce arbitrary input to a known intent id; default 'explainer'."""
    if not isinstance(value, str):
        return "explainer"
    v = value.strip().lower()
    if v in KNOWN_INTENTS:
        return v
    return "explainer"


# ---------------------------------------------------------------------------
# Seedream prompt builder
# ---------------------------------------------------------------------------


def build_seedream_prompt(
    *,
    intent: str,
    variant: Dict[str, str],
    hero_subject_label: Optional[str],
    visual_style: Optional[str],
    palette: Optional[Dict[str, str]],
    title: Optional[str],
) -> str:
    """Compose a Seedream prompt for ONE thumbnail option.

    Hard rule baked in: no text, no captions, no logos in the rendered image.
    The frontend handles overlays so the model never has to render glyphs
    (which Seedream is unreliable at).
    """
    intent = normalize_intent(intent)
    preset = INTENT_PRESETS[intent]
    composition = preset["composition_cues"]
    mood = preset["mood_cues"]

    style_hint = (visual_style or "realistic cinematic photograph").strip()

    palette_str = ""
    if palette:
        accents: List[str] = []
        for key in ("primary", "secondary", "accent", "background"):
            v = palette.get(key)
            if isinstance(v, str) and v.strip():
                accents.append(f"{key} {v.strip()}")
        if accents:
            palette_str = "Color palette accents: " + ", ".join(accents) + ". "

    subject_clause = ""
    if hero_subject_label:
        subject_clause = (
            f"Subject of the video: {hero_subject_label}. Anchor the composition "
            "around this subject's identity (or a clearly related stand-in if "
            "the focus axis is abstract). "
        )
    elif title:
        subject_clause = f"Topic of the video: {title}. "

    framing = variant["framing_brief"]
    subject_focus = variant["subject_focus"]

    # The "no text" guard is repeated deliberately — Seedream sometimes
    # hallucinates captions when it sees marketing-style cues.
    return (
        f"YouTube-style thumbnail, {style_hint}. "
        f"Mood: {mood}. Composition: {composition}. "
        f"{subject_clause}"
        f"Focus axis: {subject_focus}. Framing: {framing}. "
        f"{palette_str}"
        "STRICT: do not render any text, captions, words, letters, numbers, "
        "watermarks, logos, brand marks, UI chrome, or signage anywhere in "
        "the image. The frame must read clearly at small thumbnail sizes "
        "with high contrast between subject and background. Tasteful "
        "professional studio look — no random doodles, no clutter, no "
        "garish overlays."
    )


# ---------------------------------------------------------------------------
# Headline LLM (one small Gemini Flash call → 3 alt headlines)
# ---------------------------------------------------------------------------

_HEADLINE_SYSTEM_PROMPT = (
    "You write short YouTube-style thumbnail headlines. Given a video's title, "
    "narration excerpt, and intent, you return THREE distinct alternate "
    "headlines (the caller already has a 'main' one). Each alternate should "
    "feel different — different angle, different word choice, different "
    "emotional pull — not paraphrases. Stay within the intent's word limit. "
    "Return JSON only: {\"headlines\": [\"...\", \"...\", \"...\"]}. No "
    "markdown fences. No commentary."
)


def _build_headline_user_prompt(
    *,
    title: str,
    intent: str,
    intent_tone: str,
    max_words: int,
    narration_hint: Optional[str],
) -> str:
    excerpt = (narration_hint or "").strip()
    if len(excerpt) > 360:
        excerpt = excerpt[:357] + "..."
    return (
        f"Video title: {title}\n"
        f"Intent: {intent}\n"
        f"Headline tone: {intent_tone}\n"
        f"Hard cap: {max_words} words per headline.\n"
        + (f"Narration sample: {excerpt}\n" if excerpt else "")
        + "\n"
        + "Write 3 alternate headlines, each ≤ "
        + str(max_words)
        + " words. Keep them tight, punchy, and visually scannable. Do not "
        + "include trailing punctuation. Return JSON {\"headlines\": [...]}"
    )


def _coerce_headline(raw: str, max_words: int) -> str:
    s = (raw or "").strip().strip('"').strip("'")
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"[.!?]+$", "", s)
    if not s:
        return ""
    words = s.split()
    if len(words) > max_words:
        words = words[:max_words]
    return " ".join(words)


def generate_alt_headlines(
    *,
    llm_chat: Callable[..., Tuple[str, Dict[str, Any]]],
    title: str,
    intent: str,
    narration_hint: Optional[str] = None,
) -> Tuple[List[str], Dict[str, Any]]:
    """Return (3 alternate headlines, usage dict).

    Soft-fails: any exception/parse error returns a deterministic 3-variant
    fallback derived from `title` so the caller can keep going.
    """
    intent = normalize_intent(intent)
    preset = INTENT_PRESETS[intent]
    max_words = int(preset.get("max_words", 5))
    tone = preset["headline_tone"]

    safe_title = (title or "").strip() or "New video"
    fallback = _fallback_headlines(safe_title, max_words)

    try:
        raw, usage = llm_chat(
            messages=[
                {"role": "system", "content": _HEADLINE_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": _build_headline_user_prompt(
                        title=safe_title,
                        intent=intent,
                        intent_tone=tone,
                        max_words=max_words,
                        narration_hint=narration_hint,
                    ),
                },
            ],
            temperature=0.7,
            max_tokens=300,
        )
    except Exception as e:
        print(f"   ⚠️ Headline LLM failed: {e} — using deterministic fallback")
        return fallback, {}

    parsed = _parse_headlines_json(raw)
    if not parsed:
        return fallback, usage or {}

    cleaned: List[str] = []
    seen: set = set()
    for item in parsed:
        h = _coerce_headline(str(item), max_words)
        if not h:
            continue
        key = h.lower()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(h)
        if len(cleaned) == 3:
            break

    while len(cleaned) < 3:
        # Top up from fallback so we always return exactly 3.
        for h in fallback:
            if h.lower() not in seen:
                cleaned.append(h)
                seen.add(h.lower())
                if len(cleaned) == 3:
                    break
        break

    return cleaned[:3], usage or {}


def _fallback_headlines(title: str, max_words: int) -> List[str]:
    words = title.split()
    short = " ".join(words[:max_words]) if words else title
    return [short, f"Watch: {short}".strip()[:80], short]


def _parse_headlines_json(raw: str) -> Optional[List[str]]:
    if not raw:
        return None
    text = raw.strip()
    # Strip optional ```json fences
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
    try:
        obj = json.loads(text)
    except Exception:
        # Fall back: find the first {...} block
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if not m:
            return None
        try:
            obj = json.loads(m.group(0))
        except Exception:
            return None
    if isinstance(obj, dict):
        h = obj.get("headlines")
        if isinstance(h, list):
            return [str(x) for x in h if x is not None]
    if isinstance(obj, list):
        return [str(x) for x in obj if x is not None]
    return None
