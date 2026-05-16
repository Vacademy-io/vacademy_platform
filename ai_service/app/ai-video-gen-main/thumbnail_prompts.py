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
    headline: HeadlinePackage,
    hero_subject_label: Optional[str],
    visual_style: Optional[str],
    brand_color_hex: Optional[str] = None,
    topic_context: Optional[Dict[str, Any]] = None,
) -> str:
    """Compose a Recraft prompt for a single thumbnail with text baked in.

    `headline` is a structured package with `primary` (largest), optional
    `secondary` (second line, smaller), optional `tagline` (small badge in a
    contrasting visual treatment), and optional `accent_word` (one word from
    primary/secondary to color-emphasize).

    Recraft (unlike Seedream) renders typography reliably, so we feed
    explicit per-tier type directives and trust it to lay out the hierarchy.

    Design contract:
      1. Recraft is responsible for BOTH the photograph AND the typography.
         There's no FE overlay — what the model renders is what ships.
      2. Only the package's text appears in the image. Everything else
         (UI chrome, captions, hex codes, watermarks) is explicitly banned.
      3. Subject sits in one third of the frame; text occupies the opposite
         portion. They share the frame side-by-side, NOT stacked on top of
         each other (which is what produced the uniform single-line look).
      4. Brand color is a SOFT cue — use if it serves engagement, ignore
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

    # Topic anchor — the authoritative grounding signal. Take precedence
    # over the (possibly diluted) hero_subject_label. Strip text-cue
    # language before injecting so we don't pull title-card / hex code /
    # quoted-string patterns into the image prompt.
    topic_anchor_clause = ""
    if topic_context:
        op_raw = (topic_context.get("original_prompt") or "").strip()
        op_clean = _sanitize_subject(op_raw)
        if op_clean and len(op_clean) >= 12:
            if len(op_clean) > 240:
                op_clean = op_clean[:240].rsplit(" ", 1)[0]
            topic_anchor_clause = (
                f"TOPIC (most authoritative — the actual video subject the "
                f"viewer is searching for): {op_clean}. "
                "The thumbnail's people, props, location, clothing, signage, "
                "and visual cues MUST be authentic to this topic — including "
                "cultural, regional, and contextual specifics. If the topic "
                "is about an Indian institution, use Indian people and "
                "settings; if it's about Brazilian football, use Brazilian "
                "players and stadiums; if it's about a Japanese craft, use "
                "Japanese practitioners and surroundings. Do NOT default to "
                "a generic Western stock-photo person if the topic implies "
                "another culture or region. "
            )
        # Also surface the key terms as concrete grounding nouns.
        key_terms = topic_context.get("key_terms") or []
        if isinstance(key_terms, list) and key_terms:
            cleaned_terms = [
                _sanitize_subject(str(t)) for t in key_terms[:8]
                if isinstance(t, str) and t.strip()
            ]
            cleaned_terms = [t for t in cleaned_terms if t]
            if cleaned_terms:
                topic_anchor_clause += (
                    "Key topic nouns to reflect visually where natural: "
                    + ", ".join(cleaned_terms) + ". "
                )

    # Sanitize all package fields before injecting into the prompt.
    def _safe(v: Any) -> str:
        return (v or "").replace('"', '').strip() if isinstance(v, str) else ""

    primary = _safe(headline.get("primary"))
    secondary = _safe(headline.get("secondary"))
    tagline = _safe(headline.get("tagline"))
    accent_word = _safe(headline.get("accent_word"))
    # Accent word must appear inside primary or secondary; if not, drop it
    # so we don't tell Recraft to color a word that isn't present.
    if accent_word and accent_word.lower() not in f"{primary} {secondary}".lower():
        accent_word = ""

    # Build the typography directive block — one tier line per non-empty
    # field so Recraft has explicit hierarchy guidance.
    tier_lines: List[str] = []
    if primary:
        tier_lines.append(
            f"TIER 1 (largest, dominant headline): the words \"{primary}\". "
            "Render OVERSIZED, occupying ~25-35% of the frame height. "
            f"{type_style}."
        )
    if secondary:
        tier_lines.append(
            f"TIER 2 (smaller, immediately below TIER 1, same font family but "
            f"~50-65% of TIER 1's height): the words \"{secondary}\". "
            "Same alignment as TIER 1, slightly tighter weight okay."
        )
    if tagline:
        tier_lines.append(
            f"TIER 3 (SMALL contrasting badge / chip / callout in a different "
            f"visual treatment from TIER 1+2 — e.g. a speech-bubble shape, a "
            f"solid-color label tag, or an underline-style banner): the words "
            f"\"{tagline}\". Place it in a different corner or zone from the "
            "main headline so it reads as a separate visual element."
        )
    if accent_word:
        tier_lines.append(
            f"ACCENT: render the word \"{accent_word}\" inside TIER 1 or TIER 2 "
            "in a vivid accent color (electric yellow, hot orange, lime, cyan, "
            "or a saturated brand-aligned hue) instead of white. Same font and "
            "weight as its tier; just a color swap on that one word."
        )
    typography_block = " ".join(tier_lines)

    # All text that should appear in the image (used to forbid extras).
    all_text_quoted = " / ".join(
        f"\"{t}\"" for t in (primary, secondary, tagline) if t
    )

    return (
        # 1. The job.
        "Create a high-impact viral video thumbnail designed to compel a click. "
        "This is for a top-tier creator's feed, not a stock-photo ad. "
        # 2. Topic anchor — comes BEFORE composition rules so the model
        # treats authentic topic-grounding as a hard constraint that shapes
        # every other downstream choice (subject's identity, clothing,
        # setting, props, palette).
        f"{topic_anchor_clause}"
        # 3. The mandatory subject + side-composition rule.
        "MANDATORY composition: the frame is split into a SUBJECT ZONE and a "
        "TEXT ZONE, side by side. The SUBJECT ZONE (one third or one half of "
        "the frame, your choice of left or right) contains a single clear "
        "focal subject — strongly prefer a human face with a vivid expression "
        "(surprise, intensity, awe, focus, fear, joy) framed close enough to "
        "see emotion. If a person genuinely isn't possible, use a dramatic "
        "close-up of a hero object, prop, or storytelling element. NEVER an "
        "empty landscape or wide scenery shot. The TEXT ZONE occupies the "
        "remainder of the frame and holds the typography — subject and text "
        "do NOT stack on top of each other; they coexist side by side. "
        # 3. Typography hierarchy — the structural change vs the previous
        # uniform single-line look.
        f"{typography_block} "
        "All tiers must be perfectly spelled and crisp. Use a strong stroke, "
        "outline, or contrasting backdrop band so every tier reads cleanly "
        "against the background. "
        f"The ONLY text in the image is: {all_text_quoted}. No other words, "
        "captions, logos, watermarks, hashtags, platform branding, UI chrome, "
        "browser frames, or signage anywhere in the image. "
        # 4. Picture style + intent mood.
        f"Photographic style: {style_hint}. Mood: {visual_mood}. "
        f"{subject_clause}"
        # 5. Storytelling props — invited but not required.
        "Welcome storytelling elements that reinforce the headline: hand-drawn "
        "circles or arrows over a chart, chains around a prop, a speech bubble "
        "near the subject, a torn-paper banner, or a small annotation. Use "
        "sparingly — one props element max — and only if it amplifies the hook. "
        # 6. Composition rules.
        "Composition rules: (a) one undeniable focal point in the SUBJECT ZONE "
        "that grabs the eye in under 0.5 seconds; (b) high saturation, strong "
        "contrast, deep shadows, vibrant highlights; (c) dramatic side or rim "
        "lighting on the subject, not flat front lighting; (d) shallow depth "
        "of field so the subject pops; (e) the TEXT ZONE has a calmer or "
        "darkened backdrop so the typography reads cleanly. "
        # 7. Brand binding (soft).
        f"{brand_clause}"
        # 8. Anti-patterns.
        "AVOID at all costs: subject and text stacked on top of each other; "
        "single line of uniform-sized text spanning the full width; empty "
        "wide landscapes with no subject; thin tall serif fonts; small text; "
        "cluttered overlays; generic stock-photo blandness; muted desaturated "
        "palettes; soft-pastel marketing-brochure energy. "
        # 9. Quality bar.
        "This thumbnail should look like the best-performing thumbnail on a "
        "successful creator's channel — emotion-forward, visually loud, "
        "instantly clickable, with text laid out in a clear hierarchy. Sharp "
        "focus throughout. The headline tiers and the image must feel like "
        "they were designed together by a single art director."
    )


# ---------------------------------------------------------------------------
# Headline LLM — one punchy YouTube-style headline
# ---------------------------------------------------------------------------

_HEADLINE_SYSTEM_PROMPT = (
    "You write thumbnail headline PACKAGES for the world's top YouTube "
    "creators. Given a video's TOPIC CONTEXT (original user prompt, title, "
    "key terms, narration), you return a structured text package engineered "
    "for maximum click-through — but ANCHORED IN THE ACTUAL TOPIC, not a "
    "generic clickbait pattern. "
    "\n\n"
    "TOPIC ANCHORING — THE MOST IMPORTANT RULE:\n"
    "The headline package MUST contain at least one specific noun, proper "
    "noun, or domain term from the video's actual topic. Take it from the "
    "user prompt, the title, or the key terms — NEVER invent unrelated "
    "topics (no 'physics' for a coaching video, no 'crypto' for a cooking "
    "video). If the topic is 'UPSC coaching new batch starting', the "
    "headline must reference UPSC / coaching / batch / civil services — "
    "not generic dramatic words. The viewer must see the headline and "
    "immediately know what the video is about.\n"
    "\n"
    "OUTPUT SHAPE (return JSON, no markdown fences, no commentary):\n"
    "{\n"
    "  \"primary\": \"...\",        // Line 1, BIGGEST text. 1-3 words. "
    "Carries the punch.\n"
    "  \"secondary\": \"...\",      // Line 2, smaller text below the "
    "primary. 1-3 words. May be empty (\"\").\n"
    "  \"tagline\": \"...\",        // Optional small badge / chip text in "
    "a different visual treatment. ≤4 words. May be empty.\n"
    "  \"accent_word\": \"...\"    // Optional ONE word lifted from "
    "primary or secondary to be color-emphasized. May be empty.\n"
    "}\n"
    "\n"
    "WRITING RULES:\n"
    "1. STYLE — write like a top creator (MrBeast, Veritasium, Cleo Abram, "
    "Marques Brownlee, Casey Neistat). Not a marketing copywriter. The "
    "package must feel like a story hook, not a slogan.\n"
    "2. CONTENT — every concrete noun you use must come from the topic "
    "context. The DRAMA is in how you frame the topic, not in inventing "
    "different topics. If the topic doesn't have a natural drama angle, "
    "use a curiosity hook around the topic's actual name or terms (e.g. "
    "'THE UPSC TRAP', 'WHY THIS BATCH IS DIFFERENT').\n"
    "3. Two-line hierarchy is the default: a SHORT loud primary plus a "
    "smaller secondary that completes the thought. The combined read "
    "should make sense to someone who knows nothing about the video. "
    "Example for a UPSC coaching announcement: primary='NEW UPSC BATCH', "
    "secondary='Limited Seats'. For a Telangana forest scandal recap: "
    "primary='TELANGANA FOREST', secondary='Scandal Exposed'.\n"
    "4. PATTERNS — pick the framing that fits the topic: stakes (loss / "
    "danger), specificity (a number, place, date), contradiction (two "
    "things in opposition), revelation (something hidden), curiosity gap "
    "(promise without spoiling), transformation (before/after), or "
    "comparison (X vs Y). The framing serves the topic, not the other way "
    "around.\n"
    "5. The optional `tagline` is a small contrasting label that ADDS "
    "information — a date, category, location, or status badge. Use only "
    "when it sharpens the topic (e.g. tagline='Starts Aug 15', "
    "tagline='Live Now', tagline='Hyderabad'). If you can't add real "
    "information, leave it empty.\n"
    "6. The `accent_word` is one word from primary or secondary that "
    "deserves a colored highlight — the most provocative noun or number. "
    "Prefer the topic-specific noun (UPSC, TELANGANA, $2M) over a generic "
    "drama word (NEW, SECRET).\n"
    "7. BANNED patterns: generic CTAs ('Buy Now', 'Watch Now', 'Secure "
    "Yours Today'); off-topic clickbait ('You won't believe what X did' "
    "where X is unrelated to the actual topic); dictionary titles "
    "('Understanding X'); soft promises ('A Better Way to X').\n"
    "8. ALL CAPS is allowed and often best for primary. No trailing "
    "punctuation. No quotes inside any field.\n"
    "9. Be true to the video — every claim must be backed by the "
    "narration. Drama yes, fabrication no."
)


def _build_headline_user_prompt(
    *,
    title: str,
    intent: str,
    headline_brief: str,
    max_words: int,
    narration_hint: Optional[str],
    topic_context: Optional[Dict[str, Any]] = None,
) -> str:
    excerpt = (narration_hint or "").strip()
    if len(excerpt) > 480:
        excerpt = excerpt[:477] + "..."

    # Topic context block — the authoritative grounding signal. Listed FIRST
    # so the model anchors to it before reading style guidance.
    topic_block_parts: List[str] = []
    if topic_context:
        op = (topic_context.get("original_prompt") or "").strip()
        if op:
            if len(op) > 400:
                op = op[:397] + "..."
            topic_block_parts.append(f"ORIGINAL USER PROMPT (most authoritative — the actual topic): {op}")
        sd = topic_context.get("subject_domain")
        if isinstance(sd, str) and sd.strip():
            topic_block_parts.append(f"Subject domain: {sd.strip()}")
        key_terms = topic_context.get("key_terms") or []
        if isinstance(key_terms, list) and key_terms:
            terms_str = ", ".join(str(t) for t in key_terms[:10])
            topic_block_parts.append(
                f"Key topic terms (use AT LEAST ONE of these in the headline): {terms_str}"
            )

    topic_block = ""
    if topic_block_parts:
        topic_block = "TOPIC CONTEXT — anchor the headline to these:\n" + "\n".join(topic_block_parts) + "\n\n"

    return (
        topic_block
        + f"Video title: {title}\n"
        + f"Intent: {intent}\n"
        + f"Combined-read word cap (primary + secondary): {max_words} words.\n"
        + f"Intent-specific brief: {headline_brief}\n"
        + (f"\nNarration sample (find the dramatic angle WITHIN this topic):\n{excerpt}\n" if excerpt else "")
        + "\n"
        + "Anchor the headline to the actual topic above. Pick the most "
        + "dramatic angle within that topic — not a generic drama unrelated "
        + "to the video. Every concrete noun in the headline must trace "
        + "back to the user prompt, title, key terms, or narration. "
        + "Write as the creator's thumbnail strategist trying to win the "
        + "next 10M views, but staying TRUE TO THE VIDEO.\n"
        + "\n"
        + "Return JSON with the exact shape from the system prompt: "
        + "{\"primary\": \"...\", \"secondary\": \"...\", \"tagline\": "
        + "\"...\", \"accent_word\": \"...\"}. Empty strings are valid for "
        + "secondary / tagline / accent_word."
    )


def _coerce_text(raw: Any, max_words: int) -> str:
    """Clean LLM-returned text into a renderable string with a word cap."""
    if not isinstance(raw, str):
        return ""
    s = raw.strip().strip('"').strip("'")
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"[.!?]+$", "", s)
    if not s:
        return ""
    words = s.split()
    if len(words) > max_words:
        words = words[:max_words]
    return " ".join(words)


class HeadlinePackage(Dict[str, str]):
    """Typed shape of the structured headline output.

    Subclasses Dict[str, str] so the package can be passed straight through
    JSONB persistence without conversion. Keys: primary, secondary, tagline,
    accent_word. All values are plain strings (empty string when unused).
    """
    pass


def _empty_package(primary_fallback: str) -> HeadlinePackage:
    pkg: HeadlinePackage = HeadlinePackage()
    pkg["primary"] = primary_fallback
    pkg["secondary"] = ""
    pkg["tagline"] = ""
    pkg["accent_word"] = ""
    return pkg


def package_to_flat_headline(pkg: HeadlinePackage) -> str:
    """Collapse a structured package to the single string we persist.

    Used as the `headline` field on the thumbnail option dict for back-compat
    with anywhere the FE still reads a single headline string. Recraft itself
    receives the structured fields separately (see build_recraft_thumbnail_prompt).
    """
    parts: List[str] = []
    p = pkg.get("primary", "").strip()
    s = pkg.get("secondary", "").strip()
    t = pkg.get("tagline", "").strip()
    if p:
        parts.append(p)
    if s:
        parts.append(s)
    flat = "\n".join(parts)
    if t and t.lower() not in flat.lower():
        flat = f"{flat}\n— {t}" if flat else t
    return flat or "Watch this"


def generate_thumbnail_headline(
    *,
    llm_chat: Optional[Callable[..., Tuple[str, Dict[str, Any]]]],
    title: str,
    intent: str,
    narration_hint: Optional[str] = None,
    topic_context: Optional[Dict[str, Any]] = None,
) -> Tuple[HeadlinePackage, Dict[str, Any]]:
    """Return (headline package, usage dict).

    Soft-fails: if `llm_chat` is None or the call raises/parses badly, falls
    back to a deterministic truncation of the title so the pipeline always
    has SOMETHING to render.
    """
    intent = normalize_intent(intent)
    preset = INTENT_PRESETS[intent]
    max_words = int(preset.get("max_words", 5))
    brief = preset["headline_brief"]

    safe_title = (title or "").strip() or "Watch this"
    # Primary fallback: first ~2 words of the title (so it has size hierarchy
    # potential); leaves secondary/tagline empty.
    fallback_primary = _coerce_text(safe_title, min(max_words, 3)) or "Watch this"
    fallback_pkg = _empty_package(fallback_primary)
    if max_words > 3:
        # Push remaining words into secondary so the two-line layout still
        # has something to lay out, even without an LLM.
        words = safe_title.split()
        if len(words) > 3:
            secondary_words = words[3:max_words]
            if secondary_words:
                fallback_pkg["secondary"] = _coerce_text(" ".join(secondary_words), max_words - 3)

    if llm_chat is None:
        return fallback_pkg, {}

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
                        topic_context=topic_context,
                    ),
                },
            ],
            # Moderate temperature: enough creativity to find the dramatic
            # angle, low enough that the model stays grounded in the actual
            # topic. 0.95 was over-rotating into off-topic clickbait.
            temperature=0.8,
            max_tokens=300,
        )
    except Exception as e:
        print(f"   ⚠️ Headline LLM failed: {e} — using deterministic fallback")
        return fallback_pkg, {}

    parsed = _parse_headline_json(raw)
    if not parsed:
        return fallback_pkg, usage or {}

    # Apply intent word caps. The combined `primary + secondary` should fit
    # within `max_words`; tagline gets its own small cap; accent_word is one word.
    primary = _coerce_text(parsed.get("primary"), max_words)
    if not primary:
        return fallback_pkg, usage or {}
    remaining_for_secondary = max(0, max_words - len(primary.split()))
    secondary = _coerce_text(parsed.get("secondary"), remaining_for_secondary) if remaining_for_secondary else ""
    tagline = _coerce_text(parsed.get("tagline"), 4)
    accent_word = _coerce_text(parsed.get("accent_word"), 1)

    # Accent word must actually appear in primary or secondary (case-insensitive).
    combined_lower = f"{primary} {secondary}".lower()
    if accent_word and accent_word.lower() not in combined_lower:
        accent_word = ""

    pkg: HeadlinePackage = HeadlinePackage()
    pkg["primary"] = primary
    pkg["secondary"] = secondary
    pkg["tagline"] = tagline
    pkg["accent_word"] = accent_word
    return pkg, usage or {}


def _parse_headline_json(raw: str) -> Optional[Dict[str, Any]]:
    """Parse the LLM response into a dict with primary/secondary/tagline/accent_word.

    Also accepts the legacy `{"headline": "..."}` shape — splits it into
    primary on the first half + secondary on the rest as a graceful fallback.
    """
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
    if not isinstance(obj, dict):
        return None
    if "primary" in obj:
        return obj
    legacy = obj.get("headline") or obj.get("title") or obj.get("text")
    if isinstance(legacy, str) and legacy.strip():
        words = legacy.strip().split()
        cut = max(1, len(words) // 2)
        return {
            "primary": " ".join(words[:cut]),
            "secondary": " ".join(words[cut:]),
            "tagline": "",
            "accent_word": "",
        }
    return None
