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


# Style cues per intent. Tuned to high-CTR YouTube thumbnail conventions:
#   - Visual: a clear focal SUBJECT (face/person preferred when plausible,
#     else dramatic hero object) — never empty scenery.
#   - Type: heavy condensed sans-serif by default, oversized, with a clear
#     color accent on the most important word. Avoid thin serifs entirely —
#     they look stock-photo-ad-y at thumbnail scale.
#   - Headline: written like a top creator, not a marketing copywriter.
#     Concrete examples per intent guide the LLM away from generic CTAs.
INTENT_PRESETS: Dict[str, Dict[str, Any]] = {
    "ad": {
        "visual_mood": (
            "a person interacting with the product, strong facial expression "
            "(surprise / delight / focus), dramatic studio or location lighting, "
            "vibrant saturated palette. The person's face is in the frame "
            "and gives the thumbnail its energy"
        ),
        "type_style": (
            "ultra-heavy condensed sans-serif (Impact / Bebas Neue / Anton style), "
            "all caps, very tight letter spacing, oversized so it fills 35-50% of "
            "the frame height, pure white with a black or hot-color stroke. "
            "ONE word painted in an accent color for emphasis"
        ),
        "headline_brief": (
            "Write like MrBeast / Marques Brownlee promo copy — a punchy benefit "
            "or contradiction that triggers desire (4 words max, ALL CAPS okay). "
            "GOOD: 'WAY BETTER THAN APPLE', '$50 vs $5000 KIT'. "
            "BAD: 'Buy Now', 'Best Value Today', 'Save 10% Today'."
        ),
        "max_words": 4,
    },
    "explainer": {
        "visual_mood": (
            "a person making a strong, curious or 'aha' facial expression, "
            "with a clear visual metaphor for the concept beside them. "
            "Soft dramatic light, clean backdrop, the face anchors the frame"
        ),
        "type_style": (
            "heavy condensed sans-serif, all caps or mixed-case bold, oversized, "
            "white with a colored stroke. ONE key noun painted in a punchy "
            "accent color (yellow, cyan, hot pink, lime)"
        ),
        "headline_brief": (
            "Write a curiosity-gap headline (5 words max). Tease the surprising "
            "finding without spoiling it. "
            "GOOD: 'THIS BREAKS PHYSICS', 'YOUR BRAIN IS LYING', "
            "'WHY OCEANS ARE BLUE'. "
            "BAD: 'Understanding Quantum Mechanics', 'How Things Work', "
            "'An Intro To X'."
        ),
        "max_words": 5,
    },
    "tutorial": {
        "visual_mood": (
            "a person mid-action (focused / triumphant) with the workspace / "
            "tool / result clearly in frame. 3/4 angle, natural light, the "
            "creator's hands or face visible. Optional progress markers or arrows"
        ),
        "type_style": (
            "chunky heavy sans-serif, all caps or sentence case bold, oversized, "
            "white on a contrasting color band or stroke. ONE number or key "
            "word painted in an accent color"
        ),
        "headline_brief": (
            "Write a results-forward or stakes-forward tutorial hook (5 words max). "
            "Numbers and time-bounds work. "
            "GOOD: 'I TRIED THIS FOR 30 DAYS', 'FIX IT IN 60 SECONDS', "
            "'STOP DOING THIS WRONG'. "
            "BAD: 'How To Do X', 'A Beginner's Guide', 'Tutorial: X'."
        ),
        "max_words": 5,
    },
    "announcement": {
        "visual_mood": (
            "the subject of the announcement front-and-center with a strong "
            "emotional expression (excitement, awe). Warm key light, halo, "
            "a hint of confetti or motion. No empty scenery"
        ),
        "type_style": (
            "very heavy display sans-serif, all caps, massive scale, "
            "white with a vibrant accent color (red, yellow, cyan) on the "
            "key word or as a background band"
        ),
        "headline_brief": (
            "Write an electrifying event reveal (3 words max). All caps okay. "
            "GOOD: 'IT'S FINALLY HERE', 'EVERYTHING JUST CHANGED', "
            "'WE DID IT'. "
            "BAD: 'New Product Launch', 'Major Update', 'We Are Live'."
        ),
        "max_words": 3,
    },
    "news_recap": {
        "visual_mood": (
            "a dramatic moment from the story — the protagonist's face mid-reaction, "
            "the location at its most charged, a specific telling detail. "
            "Photojournalistic clarity, natural lighting, but always with a "
            "clear focal subject. NEVER empty scenery"
        ),
        "type_style": (
            "ultra-condensed news-display sans-serif (Impact / Anton style), "
            "all caps, oversized, white with a heavy black stroke OR white on a "
            "blood-red / hot-yellow color band. ONE key word in an accent color"
        ),
        "headline_brief": (
            "Write a news hook with stakes or revelation (6 words max). "
            "GOOD: 'THE FARM SCAM EXPOSED', 'EVERYTHING WAS A LIE', "
            "'$2 BILLION VANISHED'. "
            "BAD: 'Latest News On X', 'Reform Announcement', 'Update On X'."
        ),
        "max_words": 6,
    },
    "story": {
        "visual_mood": (
            "the protagonist's face in close-up with raw emotion (grief, "
            "determination, joy), or a single charged object that anchors the "
            "story. Cinematic shallow focus, atmospheric light. Subject-forward"
        ),
        "type_style": (
            "bold condensed sans-serif (Oswald / Bebas style), oversized, "
            "white with subtle color tint or glow, all caps or title case. "
            "Tighter spacing, lower in the frame so the face dominates"
        ),
        "headline_brief": (
            "Write an emotional one-line hook (4 words max). "
            "GOOD: 'I LOST EVERYTHING', 'SHE NEVER CAME BACK', "
            "'THE LAST RIDE'. "
            "BAD: 'A Personal Journey', 'My Story', 'Things I Learned'."
        ),
        "max_words": 4,
    },
    "trailer": {
        "visual_mood": (
            "the hero / subject in a heroic low-angle close-up, dramatic rim "
            "light, deep contrast. Subject's face or signature object fills "
            "the frame. Movie-poster intensity"
        ),
        "type_style": (
            "very heavy display sans-serif (Impact / Bebas style), MASSIVE scale, "
            "all caps, white with a strong stroke or chrome / gold gradient. "
            "Treat it like a film title — the heaviest text style of any intent"
        ),
        "headline_brief": (
            "Write a movie-trailer title (3 words max, ALL CAPS). "
            "GOOD: 'THE COMEBACK', 'NO TURNING BACK', 'GAME OVER'. "
            "BAD: 'My New Series', 'Coming Soon', 'Watch Now'."
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
        # 1. The job — designed to compel a click on a video feed.
        # Note: we deliberately avoid naming any video platform (YouTube,
        # TikTok, etc.) in the prompt — image models render those names as
        # literal logos in the frame.
        "Create a high-impact viral video thumbnail designed to compel a click. "
        "This is for a top-tier creator's feed, not a stock-photo ad. "
        # 2. The subject — mandatory focal point. Empty scenery is the #1
        # failure mode of cheap auto-generated thumbnails, so we ban it
        # explicitly and steer toward a face-with-emotion default.
        "MANDATORY: the frame MUST have a clear FOCAL SUBJECT — strongly "
        "prefer a single human subject with a vivid facial expression "
        "(surprise, intensity, awe, fear, joy, focus) front-and-center. "
        "If a person isn't possible, use a dramatic close-up of a hero "
        "object or location detail. NEVER an empty landscape or wide "
        "scenery shot — the eye must lock onto one subject instantly. "
        # 3. The text. Quoted so Recraft treats it literally.
        f"Render this exact headline as the only text in the image: \"{safe_headline}\". "
        f"Typography directive: {type_style}. "
        "The headline must be OVERSIZED — large enough to read at "
        "thumbnail size on a phone, occupying at least 30-50% of the frame "
        "height. Perfectly spelled, crisp, with strong stroke or outline "
        "for separation from the background. "
        "No other words, captions, logos, watermarks, hashtags, platform "
        "branding, UI chrome, browser frames, or signage anywhere in the image. "
        # 4. The picture style + intent mood.
        f"Photographic style: {style_hint}. Mood: {visual_mood}. "
        f"{subject_clause}"
        # 5. Composition rules borrowed from top YT thumbnails.
        "Composition rules: (a) one undeniable focal point that grabs the "
        "eye in under 0.5 seconds; (b) high saturation and strong contrast "
        "— skies are vibrant, shadows are deep; (c) dramatic side or rim "
        "lighting, not flat front lighting; (d) shallow depth of field so "
        "the subject pops; (e) the headline and subject occupy DIFFERENT "
        "zones of the frame so neither obscures the other. "
        # 6. Brand binding (soft).
        f"{brand_clause}"
        # 7. Anti-patterns — the failure modes we've seen in practice.
        "AVOID at all costs: empty wide landscapes with no subject; thin "
        "tall serif fonts; small text; cluttered overlays; generic stock-"
        "photo blandness; muted desaturated palettes; type that competes "
        "with itself in shape; soft-pastel marketing-brochure energy. "
        # 8. Quality bar.
        "This thumbnail should look like the best-performing thumbnail on a "
        "successful creator's channel — emotion-forward, visually loud, "
        "instantly clickable. Sharp focus throughout. The headline and the "
        "image must feel like they were designed together by a single art "
        "director."
    )


# ---------------------------------------------------------------------------
# Headline LLM — one punchy YouTube-style headline
# ---------------------------------------------------------------------------

_HEADLINE_SYSTEM_PROMPT = (
    "You write thumbnail headlines for the world's top YouTube creators. "
    "Given a video's title, narration excerpt, and intent, you return ONE "
    "single headline engineered for maximum click-through. "
    "\n\n"
    "RULES:\n"
    "1. Write like a top creator (MrBeast, Veritasium, Cleo Abram, Marques "
    "Brownlee, Casey Neistat), NOT like a marketing copywriter. The "
    "headline must feel like a story hook, not a slogan.\n"
    "2. Use ONE of these proven patterns: stakes ('I LOST EVERYTHING'), "
    "specificity ('$2M IN 24 HOURS'), contradiction ('CHEAPER THAN APPLE'), "
    "revelation ('WHAT THEY HID'), curiosity gap ('THIS BREAKS PHYSICS'), "
    "or transformation ('30 DAYS LATER').\n"
    "3. BANNED patterns: generic CTAs ('Buy Now', 'Watch Now', 'Click "
    "Here', 'Secure Yours Today'); dictionary titles ('Understanding X', "
    "'Introduction to X'); soft promises ('A Better Way to X'); "
    "instructional phrasing without stakes ('How to Do X' unless wrapped "
    "in drama like 'How I Survived X').\n"
    "4. Stay within the intent's word cap.\n"
    "5. ALL CAPS is allowed and often best. No trailing punctuation. "
    "No quotes around the headline.\n"
    "6. Be true to the video — don't invent claims the narration won't "
    "back up. But pick the DRAMATIC angle in the narration, not the "
    "neutral summary.\n"
    "\n"
    "Return JSON only: {\"headline\": \"...\"}. No markdown fences. No "
    "commentary."
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
    if len(excerpt) > 480:
        excerpt = excerpt[:477] + "..."
    return (
        f"Video title: {title}\n"
        f"Intent: {intent}\n"
        f"Hard cap: {max_words} words.\n"
        f"Intent-specific brief: {headline_brief}\n"
        + (f"\nNarration sample (use this to find the most dramatic angle):\n{excerpt}\n" if excerpt else "")
        + "\n"
        + "Pick the SINGLE most dramatic moment, contradiction, stake, or "
        + "revelation from the narration above — not a neutral summary of "
        + "the topic. Write the headline as if you were the creator's "
        + "thumbnail strategist trying to win the next 10M views. "
        + "Return JSON: {\"headline\": \"...\"}"
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
            # Higher temperature so the model takes more dramatic angles
            # rather than safe, marketing-copy phrasings.
            temperature=0.95,
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
