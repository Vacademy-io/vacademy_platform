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


# Style cues per intent. KEEP THESE PHOTOGRAPHIC ONLY — every word here goes
# straight into the Seedream prompt, and the model treats editorial-layout
# language ("lower-third", "masthead", "title space", "type-led") as a
# directive to render text/UI inside the image. We want clean photographs
# with intent-appropriate mood; the FE overlay handles all on-screen text.
INTENT_PRESETS: Dict[str, Dict[str, str]] = {
    "ad": {
        "composition_cues": (
            "studio product photography, high contrast, dramatic lighting, "
            "shallow depth of field, polished commercial look"
        ),
        "mood_cues": "bold, premium, aspirational",
        "headline_tone": "benefit-promise — at most 4 punchy words, present tense",
        "max_words": 4,
    },
    "explainer": {
        "composition_cues": (
            "single clear subject, generous breathing room, soft directional light, "
            "minimal background, calm composition"
        ),
        "mood_cues": "clean, considered, approachable",
        "headline_tone": "topic noun-phrase — at most 5 words, no question marks",
        "max_words": 5,
    },
    "tutorial": {
        "composition_cues": (
            "hands-on workspace photograph, tools or materials on a clean surface, "
            "top-down or 3/4 angle, natural light"
        ),
        "mood_cues": "practical, hands-on, instructive",
        "headline_tone": "imperative 'How to X' phrasing — at most 5 words",
        "max_words": 5,
    },
    "announcement": {
        "composition_cues": (
            "celebratory environmental portrait or symbolic centerpiece, "
            "warm key light, soft halo, uncluttered background"
        ),
        "mood_cues": "celebratory, momentous, optimistic",
        "headline_tone": "event noun — at most 3 words, title-case",
        "max_words": 3,
    },
    "news_recap": {
        "composition_cues": (
            "documentary photograph of the relevant scene or subject, "
            "natural lighting, photojournalistic clarity, sharp focus"
        ),
        "mood_cues": "credible, informational, grounded",
        "headline_tone": "sharp news headline — at most 6 words, no period",
        "max_words": 6,
    },
    "story": {
        "composition_cues": (
            "cinematic environmental shot, atmospheric haze, shallow focus, "
            "evocative natural lighting"
        ),
        "mood_cues": "cinematic, evocative, atmospheric",
        "headline_tone": "evocative short phrase — at most 4 words",
        "max_words": 4,
    },
    "trailer": {
        "composition_cues": (
            "dramatic environmental hero shot, strong key light with rim light, "
            "heroic low-angle, deep contrast"
        ),
        "mood_cues": "dramatic, charged, premiere-quality",
        "headline_tone": "trailer-style title — at most 3 words, all caps okay",
        "max_words": 3,
    },
}


# Four (subject_focus, composition, layout) bundles. Each describes ONLY the
# visual framing — never anything about "where text will sit", "type space",
# or "the frontend will render typography". Seedream interprets those phrases
# as instructions to render text-shaped graphics. The FE overlay is purely a
# downstream concern the image generator should know nothing about.
OPTION_VARIANTS: List[Dict[str, str]] = [
    {
        "id": "thumb_1",
        "subject_focus": "hero_object",
        "composition": "bottom_band",
        "layout": "bottom_band",
        "framing_brief": (
            "the main subject sits in the upper two-thirds of the frame, "
            "with a gradual fade to deeper tones toward the bottom edge"
        ),
    },
    {
        "id": "thumb_2",
        "subject_focus": "hero_person",
        "composition": "rule_of_thirds",
        "layout": "top_left",
        "framing_brief": (
            "a single human subject framed on the right side of the image, "
            "with a softer, uncluttered area in the top-left of the scene"
        ),
    },
    {
        "id": "thumb_3",
        "subject_focus": "abstract_motif",
        "composition": "full_frame",
        "layout": "center",
        "framing_brief": (
            "a strong symbolic visual element fills the frame with a "
            "naturally darker center vignette"
        ),
    },
    {
        "id": "thumb_4",
        "subject_focus": "atmospheric",
        "composition": "full_frame",
        "layout": "none",
        "framing_brief": (
            "an atmospheric, painterly composition with strong directional "
            "lighting and one dominant tonal hue across the frame"
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


_TEXT_CUE_PATTERNS = [
    # Lines / phrases that, when present in the subject hint, cause Seedream
    # to render text on the image. We strip them aggressively.
    r"\b(title|subtitle|caption|headline|heading|subhead|label|callout)\s*(card|bar|strip|block|graphic|banner|chip|tag)?\b",
    r"\b(lower[- ]third|chyron|nameplate|masthead|watermark|logo|wordmark)\b",
    r"\b(text\s+(on|in|over|across)\b)",
    r"\b(type(set|written|face|graphy|writer))\b",
    r"\bwith the (text|words|caption|title|label)\b",
    r"\b(displaying|showing|reads?|says?)\s+['\"][^'\"]+['\"]",
    # Quoted strings — almost always a literal phrase to render.
    r"['\"][^'\"]{1,80}['\"]",
    # Hex color codes — Seedream renders them as readable text labels.
    r"#?\b[0-9a-fA-F]{6}\b",
    r"#?\b[0-9a-fA-F]{3}\b(?=\s|$|,|\.)",
]
_TEXT_CUE_REGEXES = [re.compile(p, re.IGNORECASE) for p in _TEXT_CUE_PATTERNS]


def _sanitize_for_image_gen(raw: Optional[str]) -> Optional[str]:
    """Strip text-rendering and identifier-leaking phrases from a free-text hint.

    Seedream is extremely literal: any mention of "title card", a quoted string,
    a hex code, or "lower-third" turns into text or UI rendered on the image.
    The Director's image_prompts and the script title regularly contain such
    cues. We strip them before feeding the hint to the image model.
    """
    if not raw:
        return None
    cleaned = raw
    for rx in _TEXT_CUE_REGEXES:
        cleaned = rx.sub(" ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" ,.;:-—")
    return cleaned or None


def build_seedream_prompt(
    *,
    intent: str,
    variant: Dict[str, str],
    hero_subject_label: Optional[str],
    visual_style: Optional[str],
) -> str:
    """Compose a Seedream prompt for ONE thumbnail option.

    Design rules learned the hard way:

    1. The no-text instruction goes FIRST and is the loudest signal in the
       prompt. Putting it last lets the model interpret all the cues above
       it as content to render before the guard kicks in.
    2. No word "YouTube" anywhere — the model renders literal YouTube
       branding even when we want stylistic energy.
    3. No palette hex codes in the prompt. Seedream renders `#FF6B00` as a
       text label on the image. Brand color binding is the FE overlay's job;
       the photograph just needs to be tonally clean — palette has been
       removed from the prompt entirely.
    4. The hero hint runs through `_sanitize_for_image_gen` to strip title-
       card / lower-third / quoted-string / hex cues that the Director may
       have written into the shot's `image_prompt`.
    5. No "title space", "type-led", "for overlay text" phrases — they all
       cue text-shaped graphics. The FE overlay is downstream and invisible
       to the image generator.
    """
    intent = normalize_intent(intent)
    preset = INTENT_PRESETS[intent]
    composition = preset["composition_cues"]
    mood = preset["mood_cues"]

    style_hint = (visual_style or "realistic cinematic photograph").strip()
    framing = variant["framing_brief"]

    subject = _sanitize_for_image_gen(hero_subject_label)
    # If sanitization gutted the hint (e.g. the Director wrote a "title card"
    # description full of quoted text + hex codes), what's left is usually
    # fragments like "with hex codes and" — useless and confusing to the
    # model. Drop the clause if the leftover is short, sparse, or starts with
    # a connective stopword (which is the tell that sanitization decapitated
    # the original noun phrase).
    _SUBJECT_FRAGMENT_STARTERS = {
        "with", "and", "or", "but", "from", "to", "of", "in", "on",
        "at", "the", "a", "an", "for", "by",
    }
    _is_meaningful = (
        subject is not None
        and len(subject) >= 20
        and len(subject.split()) >= 4
        and subject.split()[0].lower() not in _SUBJECT_FRAGMENT_STARTERS
    )
    if _is_meaningful:
        # Truncate aggressively — long Director image_prompts often contain
        # multi-sentence rambling that confuses the model.
        if len(subject) > 200:  # type: ignore[arg-type]
            subject = subject[:200].rsplit(" ", 1)[0]  # type: ignore[index]
        subject_clause = f"Visual focus: {subject}. "
    else:
        subject_clause = ""

    return (
        # 1. Hard "no text" rule. First sentence, in caps. Repeated below.
        "NO TEXT, NO LETTERS, NO NUMBERS, NO CAPTIONS, NO WORDS, "
        "NO LOGOS, NO WATERMARKS, NO UI ELEMENTS, NO SIGNAGE, "
        "NO STICKERS, NO HASHTAGS, NO BORDERS. "
        "Pure photographic image only — no graphic-design overlays. "
        # 2. Photographic style + intent mood.
        f"A high-impact editorial thumbnail photograph in the style of "
        f"{style_hint}. Mood: {mood}. "
        # 3. Composition + variant framing.
        f"{composition}. {framing}. "
        # 4. Subject hint (sanitized).
        f"{subject_clause}"
        # 5. Reinforce no-text at the end (Seedream pays more attention to
        # the tail of long prompts).
        "Crucially: the rendered image must NOT contain any visible text, "
        "letters, words, numbers, captions, logos, watermarks, hashtags, or "
        "UI mockups. No screen, browser, or video-player chrome of any kind. "
        "Clean professional photograph that reads instantly at thumbnail size."
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
