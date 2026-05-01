"""
Curated background-music fallback for when Lyria generation fails.

Lyria failures are non-fatal but a video without a score lands flat. This
module picks a royalty-free bed from a small curated library based on the
music plan's `style_direction` + `emotional_beat`. Beats no music.

The actual audio files (a curated set of ~30 royalty-free beds tagged by
mood/BPM) are an asset task — this module exposes the integration point
and reads bed URLs from environment variables so a future deploy can
populate the library without a code change. When no env vars are set the
picker returns None and the pipeline falls back to silence as before.

Env var convention: `MUSIC_BED_<MOOD>` for each mood key. Example:
    MUSIC_BED_AMBIENT=https://vacademy-media-storage-public.s3.../beds/ambient_a.mp3
    MUSIC_BED_TRIUMPHANT=https://...
    MUSIC_BED_CINEMATIC=https://...
    MUSIC_BED_TENSE=https://...
    MUSIC_BED_PLAYFUL=https://...
    MUSIC_BED_REFLECTIVE=https://...
    MUSIC_BED_DEFAULT=https://...   # used when no mood matches

The asset rollout is tracked in AI_VIDEO_GENERATION.md §12.
"""
from __future__ import annotations

import os
from typing import Dict, Any, Optional


# Map low-level emotional/style keywords to a small set of mood buckets the
# fallback library is indexed by. Keep this list short — adding more buckets
# without adding the corresponding audio files just produces silence.
_MOOD_KEYWORDS: Dict[str, list[str]] = {
    "ambient": [
        "ambient", "contemplative", "calm", "minimal", "subtle", "intimate",
        "thoughtful", "exposition",
    ],
    "triumphant": [
        "triumphant", "celebratory", "epic", "anthemic", "victorious",
        "powerful", "climax", "resolution",
    ],
    "cinematic": [
        "cinematic", "dramatic", "atmospheric", "score", "trailer",
        "establishing", "hero", "awe",
    ],
    "tense": [
        "tense", "suspense", "ominous", "anxious", "dark", "uneasy",
        "investigative", "mystery",
    ],
    "playful": [
        "playful", "upbeat", "quirky", "fun", "bouncy", "energetic",
        "kinetic", "lively",
    ],
    "reflective": [
        "reflective", "melancholy", "wistful", "introspective", "tender",
        "nostalgic", "gentle",
    ],
}


def _env_bed_url(mood: str) -> Optional[str]:
    val = os.environ.get(f"MUSIC_BED_{mood.upper()}", "").strip()
    return val or None


def _classify_mood(text: str) -> str:
    """Return the best mood bucket for a free-text descriptor. Default: ambient."""
    if not text:
        return "ambient"
    lower = text.lower()
    best = "ambient"
    best_hits = 0
    for mood, keywords in _MOOD_KEYWORDS.items():
        hits = sum(1 for k in keywords if k in lower)
        if hits > best_hits:
            best_hits = hits
            best = mood
    return best


def pick_fallback_bed(music_plan: Optional[Dict[str, Any]]) -> Optional[Dict[str, str]]:
    """Return a bed URL + chosen mood for a Lyria-failed video, or None.

    `music_plan` is the same dict the Director emits — typically `{"segments":
    [...]}` where each segment has `prompt` / `mood` / `style_direction` /
    `emotional_beat`. We classify on whatever fields are present.

    Returns:
        {"url": <s3 url>, "mood": <mood>} on a hit;
        None when no env-var URL is configured for the chosen mood and no
        DEFAULT bed is set.
    """
    if not isinstance(music_plan, dict):
        music_plan = {}

    # Build a single descriptor string from the plan to classify against.
    parts: list[str] = []
    for k in ("style_direction", "emotional_beat", "overall_mood", "mood"):
        v = music_plan.get(k)
        if isinstance(v, str):
            parts.append(v)
    segments = music_plan.get("segments")
    if isinstance(segments, list):
        for seg in segments[:6]:
            if not isinstance(seg, dict):
                continue
            for k in ("prompt", "mood", "emotional_beat", "style_direction"):
                v = seg.get(k)
                if isinstance(v, str):
                    parts.append(v)
    descriptor = " ".join(parts)

    mood = _classify_mood(descriptor)
    url = _env_bed_url(mood) or _env_bed_url("default")
    if not url:
        return None
    return {"url": url, "mood": mood}
