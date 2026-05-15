"""
Thumbnail prompt builder — single Recraft call with text baked in.

The pipeline calls this from `thumbnail_generator.run()` immediately after the
Director plan is finalized. Recraft generates ONE thumbnail per video with the
headline typography rendered directly into the image (Recraft does text well).
No client-side overlay is needed.

Design intent: YouTube-style click-worthy thumbnails. The model is asked to
produce a high-impact editorial composition with a bold headline, intent-
appropriate mood, and clear visual hierarchy — like a top creator's channel,
not a generic stock image.
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


# Style cues per intent. Each entry pairs a visual mood with headline style
# guidance so Recraft can render both the photograph and the typography in
# matching register. The `headline_brief` is what we ask the LLM to write —
# tuned for YouTube click-through, not literal video titles.
INTENT_PRESETS: Dict[str, Dict[str, Any]] = {
    "ad": {
        "visual_mood": (
            "premium product photography energy, dramatic studio lighting, "
            "saturated brand-forward palette, bold and confident"
        ),
        "type_style": (
            "heavy condensed sans-serif in pure white or hot accent color, "
            "tightly tracked, all caps, sharp drop shadow for contrast"
        ),
        "headline_brief": (
            "Punchy benefit promise that triggers desire (4 words max). "
            "Think product hero — what makes someone click."
        ),
        "max_words": 4,
    },
    "explainer": {
        "visual_mood": (
            "clean editorial portrait or single-subject photograph, "
            "soft directional light, generous breathing room, intelligent and curious"
        ),
        "type_style": (
            "bold modern sans-serif, slightly oversized, mixed case for "
            "readability, with strong contrast against the backdrop"
        ),
        "headline_brief": (
            "Topic phrased as a curiosity hook (5 words max). "
            "Promise the insight without giving the answer away."
        ),
        "max_words": 5,
    },
    "tutorial": {
        "visual_mood": (
            "hands-on workspace photograph, top-down or 3/4 angle, "
            "natural light, practical and instructive feel"
        ),
        "type_style": (
            "chunky sans-serif, friendly weight, mixed case, often with a "
            "subtle highlight bar behind the title"
        ),
        "headline_brief": (
            "Imperative how-to phrase or numbered hook (5 words max). "
            "'How to X', 'X Step by Step', 'X in 5 Minutes' — make it feel "
            "achievable and concrete."
        ),
        "max_words": 5,
    },
    "announcement": {
        "visual_mood": (
            "celebratory hero shot, warm key light, optional confetti or "
            "halo lighting, optimistic and momentous"
        ),
        "type_style": (
            "bold display serif or condensed sans-serif, large and centered, "
            "title-case, with a vibrant accent color"
        ),
        "headline_brief": (
            "Big-news event phrase (3 words max). 'Finally Here', "
            "'Major Update', 'It's Live' — short and electrifying."
        ),
        "max_words": 3,
    },
    "news_recap": {
        "visual_mood": (
            "documentary photograph of the relevant subject or scene, "
            "photojournalistic clarity, natural lighting, grounded credibility"
        ),
        "type_style": (
            "compressed bold sans-serif news headline style, "
            "white on a strong accent color band (red/yellow/black)"
        ),
        "headline_brief": (
            "Sharp news headline with implication (6 words max). "
            "Stakes-forward — what changed, why it matters."
        ),
        "max_words": 6,
    },
    "story": {
        "visual_mood": (
            "cinematic environmental shot, atmospheric haze, shallow focus, "
            "evocative natural lighting, emotionally resonant"
        ),
        "type_style": (
            "elegant serif or refined sans-serif, smaller and lower in the "
            "frame, italics permitted, subtle gradient or glow for legibility"
        ),
        "headline_brief": (
            "Evocative short phrase that hints at the journey (4 words max). "
            "Mystery and emotion over explanation."
        ),
        "max_words": 4,
    },
    "trailer": {
        "visual_mood": (
            "dramatic environmental hero shot, deep contrast, strong rim light, "
            "heroic low-angle framing, premiere-quality charge"
        ),
        "type_style": (
            "very heavy display sans-serif, massive scale, all caps, "
            "with a sharp inner stroke or glow effect"
        ),
        "headline_brief": (
            "Trailer-style title (3 words max). All caps. "
            "Maximum impact, minimum words."
        ),
        "max_words": 3,
    },
}


def normalize_intent(value: Any) -> str:
    """Coerce arbitrary input to a known intent id; default 'explainer'."""
    if not isinstance(value, str):
        return "explainer"
    v = value.strip().lower()
    if v in KNOWN_INTENTS:
        return v
    return "explainer"


# ---------------------------------------------------------------------------
# Subject hint sanitizer
# ---------------------------------------------------------------------------

# Lines / phrases that, when present in the subject hint, cause image models
# to misbehave (render literal text, draw UI mockups, etc). Stripped aggressively.
_TEXT_CUE_PATTERNS = [
    r"\b(title|subtitle|caption|headline|heading|subhead|label|callout)\s*(card|bar|strip|block|graphic|banner|chip|tag)?\b",
    r"\b(lower[- ]third|chyron|nameplate|masthead|watermark|logo|wordmark)\b",
    r"\b(text\s+(on|in|over|across)\b)",
    r"\b(type(set|written|face|graphy|writer))\b",
    r"\bwith the (text|words|caption|title|label)\b",
    r"\b(displaying|showing|reads?|says?)\s+['\"][^'\"]+['\"]",
    r"['\"][^'\"]{1,80}['\"]",
    r"#?\b[0-9a-fA-F]{6}\b",
    r"#?\b[0-9a-fA-F]{3}\b(?=\s|$|,|\.)",
]
_TEXT_CUE_REGEXES = [re.compile(p, re.IGNORECASE) for p in _TEXT_CUE_PATTERNS]


def _sanitize_subject(raw: Optional[str]) -> Optional[str]:
    """Strip text-rendering and identifier-leaking phrases from a free-text hint.

    Image models are extremely literal: any mention of "title card", a quoted
    string, a hex code, or "lower-third" turns into stray rendered text or UI
    layered on the image. The Director's image_prompts and the script title
    regularly contain such cues. We strip them before feeding the hint to the
    image model.
    """
    if not raw:
        return None
    cleaned = raw
    for rx in _TEXT_CUE_REGEXES:
        cleaned = rx.sub(" ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" ,.;:-—")
    return cleaned or None


_SUBJECT_FRAGMENT_STARTERS = {
    "with", "and", "or", "but", "from", "to", "of", "in", "on",
    "at", "the", "a", "an", "for", "by",
}


def _subject_is_meaningful(subject: Optional[str]) -> bool:
    """A sanitized subject is usable iff it has substance + doesn't open as a fragment."""
    if not subject:
        return False
    if len(subject) < 20:
        return False
    words = subject.split()
    if len(words) < 4:
        return False
    if words[0].lower() in _SUBJECT_FRAGMENT_STARTERS:
        return False
    return True


# ---------------------------------------------------------------------------
# Brand color hint
# ---------------------------------------------------------------------------

# Coarse hex → color-family name mapping. Image models render literal hex
# strings as text labels on the image, but they handle descriptive color
# names fine. We translate before composing the prompt.
_COLOR_NAMES: List[Tuple[Tuple[int, int, int], str]] = [
    ((220, 20, 60), "vivid crimson red"),
    ((255, 99, 71), "warm coral red"),
    ((255, 140, 0), "bold orange"),
    ((255, 193, 7), "rich amber yellow"),
    ((255, 235, 59), "bright lemon yellow"),
    ((76, 175, 80), "vibrant forest green"),
    ((0, 200, 150), "fresh teal green"),
    ((0, 188, 212), "cool cyan"),
    ((33, 150, 243), "electric blue"),
    ((63, 81, 181), "deep indigo blue"),
    ((103, 58, 183), "rich royal purple"),
    ((233, 30, 99), "hot magenta pink"),
    ((121, 85, 72), "warm brown"),
    ((158, 158, 158), "cool neutral grey"),
    ((30, 30, 30), "deep charcoal black"),
    ((250, 250, 250), "clean off-white"),
]


def _hex_to_color_name(hex_value: str) -> Optional[str]:
    """Return a descriptive color name for a #RRGGBB string, or None if unparseable.

    Picks the nearest entry in `_COLOR_NAMES` by squared RGB distance. We
    deliberately avoid feeding raw hex into image prompts — the model treats
    the hex string as a text label to render.
    """
    if not hex_value:
        return None
    m = re.match(r"^#?([0-9a-fA-F]{6})$", hex_value.strip())
    if not m:
        return None
    v = m.group(1)
    r = int(v[0:2], 16)
    g = int(v[2:4], 16)
    b = int(v[4:6], 16)
    best: Optional[Tuple[int, str]] = None
    for (rr, gg, bb), name in _COLOR_NAMES:
        dist = (r - rr) ** 2 + (g - gg) ** 2 + (b - bb) ** 2
        if best is None or dist < best[0]:
            best = (dist, name)
    return best[1] if best else None


# ---------------------------------------------------------------------------
# Recraft prompt builder
# ---------------------------------------------------------------------------


def build_recraft_thumbnail_prompt(
    *,
    intent: str,
    headline: str,
    hero_subject_label: Optional[str],
    visual_style: Optional[str],
    brand_color_hex: Optional[str] = None,
) -> str:
    """Compose a Recraft prompt for a single thumbnail with text baked in.

    Recraft (unlike Seedream) renders typography reliably, so the headline
    goes directly into the prompt with explicit type-styling guidance. The
    brand color is fed as a descriptive color name rather than a hex code
    (image models treat hex as text to render).

    Design contract:
      1. Recraft is responsible for BOTH the photograph AND the typography.
         There's no FE overlay — what the model renders is what ships.
      2. The headline is the only text in the image. Everything else (UI
         chrome, captions, hex codes, watermarks) is explicitly forbidden.
      3. Brand color is a SOFT cue — use if it serves engagement, ignore
         if a different palette would click better.
    """
    intent = normalize_intent(intent)
    preset = INTENT_PRESETS[intent]
    visual_mood = preset["visual_mood"]
    type_style = preset["type_style"]

    style_hint = (visual_style or "realistic cinematic photograph").strip()

    # Subject hint — sanitized + meaningful-length guard.
    subject = _sanitize_subject(hero_subject_label)
    if _subject_is_meaningful(subject):
        if len(subject) > 200:  # type: ignore[arg-type]
            subject = subject[:200].rsplit(" ", 1)[0]  # type: ignore[index]
        subject_clause = f"Visual subject: {subject}. "
    else:
        subject_clause = ""

    # Brand color — translate hex to a color family name. The model is told
    # to USE THIS COLOR ONLY IF IT FITS — engagement is the priority.
    brand_clause = ""
    if brand_color_hex:
        color_name = _hex_to_color_name(brand_color_hex)
        if color_name:
            brand_clause = (
                f"Brand accent color (soft hint, use only if it strengthens "
                f"the composition; otherwise pick a more eye-catching palette): "
                f"{color_name}. "
            )

    # Escape any double quotes in the headline so the embedded "..." string
    # doesn't break the prompt format.
    safe_headline = (headline or "").replace('"', '').strip()

    return (
        # 1. The job. Be specific: this is a thumbnail, not a still.
        # Note: we deliberately avoid naming any video platform (YouTube,
        # TikTok, etc.) in the prompt — image models render those names as
        # literal logos in the frame.
        "Create a high-impact editorial video thumbnail designed to compel a "
        "click on a streaming-platform feed. The image must combine a striking "
        "photographic background with one bold typographic headline rendered "
        "directly inside the image. "
        # 2. The text. Quoted so Recraft treats it literally.
        f"Render this exact headline as the only text in the image: \"{safe_headline}\". "
        f"Typography style: {type_style}. "
        "The text must be perfectly spelled, sharp, and the strongest read at "
        "thumbnail size. No other words, captions, logos, watermarks, hashtags, "
        "platform branding, UI chrome, browser frames, or signage anywhere in "
        "the image. "
        # 3. The picture.
        f"Photographic backdrop style: {style_hint}. Mood: {visual_mood}. "
        f"{subject_clause}"
        "Composition: one clear focal point, strong visual hierarchy, dramatic "
        "lighting, saturated colors, generous contrast between subject and text. "
        # 4. Brand binding (soft).
        f"{brand_clause}"
        # 5. Quality bar.
        "Premium editorial production value — the visual energy of a top creator's "
        "best-performing thumbnail, not a generic stock image. No clutter, no "
        "doodles, no random graphic overlays. Sharp focus. The headline and the "
        "image must feel like they were designed together."
    )


# ---------------------------------------------------------------------------
# Headline LLM — one punchy YouTube-style headline
# ---------------------------------------------------------------------------

_HEADLINE_SYSTEM_PROMPT = (
    "You write YouTube thumbnail headlines for high click-through. Given a "
    "video's title, narration excerpt, and intent, you return ONE single "
    "headline tuned for the intent's brief. The headline must be punchy, "
    "specific, and create a curiosity gap — never a literal video-title "
    "restatement. Stay within the word cap. No trailing punctuation. No "
    "quotes around the headline. Return JSON only: {\"headline\": \"...\"}. "
    "No markdown fences. No commentary."
)


def _build_headline_user_prompt(
    *,
    title: str,
    intent: str,
    headline_brief: str,
    max_words: int,
    narration_hint: Optional[str],
) -> str:
    excerpt = (narration_hint or "").strip()
    if len(excerpt) > 360:
        excerpt = excerpt[:357] + "..."
    return (
        f"Video title: {title}\n"
        f"Intent: {intent}\n"
        f"Headline brief: {headline_brief}\n"
        f"Hard cap: {max_words} words.\n"
        + (f"Narration sample: {excerpt}\n" if excerpt else "")
        + "\n"
        + "Write ONE headline (no alternates). It must read like the title of "
        + "a video a YouTube viewer would click instantly. Avoid clickbait "
        + "lies — keep it true to the video. Return JSON: {\"headline\": \"...\"}"
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


def generate_thumbnail_headline(
    *,
    llm_chat: Optional[Callable[..., Tuple[str, Dict[str, Any]]]],
    title: str,
    intent: str,
    narration_hint: Optional[str] = None,
) -> Tuple[str, Dict[str, Any]]:
    """Return (single headline, usage dict).

    Soft-fails: if `llm_chat` is None or the call raises/parses badly, falls
    back to a deterministic truncation of the title so the pipeline always
    has SOMETHING to render.
    """
    intent = normalize_intent(intent)
    preset = INTENT_PRESETS[intent]
    max_words = int(preset.get("max_words", 5))
    brief = preset["headline_brief"]

    safe_title = (title or "").strip() or "Watch this"
    fallback = _coerce_headline(safe_title, max_words) or "Watch this"

    if llm_chat is None:
        return fallback, {}

    try:
        raw, usage = llm_chat(
            messages=[
                {"role": "system", "content": _HEADLINE_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": _build_headline_user_prompt(
                        title=safe_title,
                        intent=intent,
                        headline_brief=brief,
                        max_words=max_words,
                        narration_hint=narration_hint,
                    ),
                },
            ],
            temperature=0.7,
            max_tokens=200,
        )
    except Exception as e:
        print(f"   ⚠️ Headline LLM failed: {e} — using deterministic fallback")
        return fallback, {}

    parsed = _parse_headline_json(raw)
    if not parsed:
        return fallback, usage or {}

    cleaned = _coerce_headline(parsed, max_words)
    if not cleaned:
        return fallback, usage or {}
    return cleaned, usage or {}


def _parse_headline_json(raw: str) -> Optional[str]:
    if not raw:
        return None
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
    try:
        obj = json.loads(text)
    except Exception:
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if not m:
            return None
        try:
            obj = json.loads(m.group(0))
        except Exception:
            return None
    if isinstance(obj, dict):
        h = obj.get("headline") or obj.get("title") or obj.get("text")
        if isinstance(h, str):
            return h
    if isinstance(obj, str):
        return obj
    return None
