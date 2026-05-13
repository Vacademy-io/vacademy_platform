"""
Phase 2c.4 — Auto b-roll fetch for stacked / PiP layouts.

When a user picks `stacked_speaker_with_broll` or `pip_corner_speaker` and
leaves `background_video_url` empty, the director consults this service to
fetch ONE relevant b-roll video from Pexels keyed on the reel's most-
emphasized content word.

Phase 1 scope (intentional):
  * One b-roll per render — fills the layout's bg slot, not per-phrase overlays
  * Concept = single highest-importance non-stopword (no LLM concept-extraction)
  * Pexels search only — no Storyblocks, no curated internal library
  * Direct Pexels URL embedded into the timeline; no S3 mirror
  * Per-process LRU cache (same concept across renders → free re-use)

Returns None when:
  * No `PEXELS_API_KEYS` env configured (graceful — director falls back to
    full_speaker_with_overlays)
  * Search returns no results
  * Transient Pexels error (logged; director also falls back)

The director treats a None result identically to the "user didn't supply
a URL AND can't auto-fetch" path: silent downgrade to the default layout.
"""
from __future__ import annotations

import asyncio
import logging
import sys
from collections import OrderedDict
from pathlib import Path
from threading import Lock
from typing import Optional, Sequence

from ..config import get_settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Cap concept length so we don't send sentence-fragments to Pexels.
_MAX_CONCEPT_LEN = 40

# Per-process cache of concept → bgv URL. LRU bounded to a small number
# because b-rolls are sticky — once a concept maps to a video, we want
# subsequent renders from the same word to pick the same clip (visual
# consistency across reels generated from the same source). 256 entries is
# plenty for a typical institute's per-day usage.
_CACHE_MAX = 256

# Concept-extraction stopwords. Mirrors `reels_preview_service.STOPWORDS` +
# `reels_llm_director_service._FALLBACK_STOPWORDS` plus a few words that
# look important but are useless b-roll queries on their own (numbers,
# pronouns the LLM upgraded to importance ≥ 3 etc).
_BAD_CONCEPT_WORDS = {
    # Articles / prepositions / pronouns
    "a", "an", "the", "and", "or", "but", "if", "then", "of", "to", "in",
    "on", "at", "by", "for", "with", "from", "as", "is", "are", "was",
    "were", "be", "been", "being", "am", "i", "you", "he", "she", "it",
    "we", "they", "them", "us", "me", "my", "your", "his", "her", "its",
    "our", "their", "this", "that", "these", "those", "so", "well", "just",
    "now", "very", "would", "could", "should", "do", "does", "did", "has",
    "have", "had", "yeah", "yep", "oh", "okay", "right", "kind", "sort",
    # Filler / discourse markers
    "actually", "literally", "basically", "really", "anyway", "like",
    "know", "mean", "see", "though", "still", "even",
    # Numbers as bare words — "42" doesn't pull a useful b-roll
    "one", "two", "three", "four", "five", "six", "seven", "eight",
    "nine", "ten", "first", "second", "last",
}

# Minimum word length for a viable concept. Sub-4-letter content words
# ("ai", "ml") COULD be valid topics but Pexels search treats them
# generically; the importance-rank top hit is usually a better target.
_MIN_CONCEPT_LEN = 4

# Phase-1 default orientation. Pexels' video CDN returns mostly 1920×1080;
# CSS `object-fit:cover` on the bg layer handles whatever aspect the reel
# happens to be. Future polish: aspect-aware orientation selection.
_DEFAULT_ORIENTATION = "landscape"

# Pexels videos shorter than this aren't worth using — the loop becomes
# obvious in a 24s reel.
_MIN_BROLL_DURATION_S = 6


# ---------------------------------------------------------------------------
# Lazy PexelsService import
#
# The pipeline's existing PexelsService lives under
# `app/ai-video-gen-main/pexels_service.py` — a directory with a hyphen,
# which Python can't import as a normal package. Existing callers add the
# directory to `sys.path` then `import pexels_service`. We do the same once
# here, behind a lazy-import helper so we don't pay the path-manipulation
# cost when no b-roll is requested.
# ---------------------------------------------------------------------------

_PEXELS_SERVICE_DIR = (
    Path(__file__).resolve().parent.parent / "ai-video-gen-main"
)


def _get_pexels_service():
    """Lazy import + instantiation of `PexelsService`. Returns the cached
    singleton, or None if no keys are configured.

    Caches the service on the function object so we don't re-instantiate
    (the inner key-rotation state is meaningful across calls). Imports are
    inside the function so module load doesn't fault when the venv lacks
    pexels_service or settings aren't available."""
    if getattr(_get_pexels_service, "_singleton", None) is not None:
        return _get_pexels_service._singleton  # type: ignore[attr-defined]
    if getattr(_get_pexels_service, "_resolved_none", False):
        return None

    settings = get_settings()
    keys_csv = (settings.pexels_api_keys or "").strip()
    if not keys_csv:
        # Mark resolved so we don't repeat the directory traversal.
        _get_pexels_service._resolved_none = True  # type: ignore[attr-defined]
        return None

    # Path-hack to import from the hyphenated `ai-video-gen-main` dir.
    if str(_PEXELS_SERVICE_DIR) not in sys.path:
        sys.path.insert(0, str(_PEXELS_SERVICE_DIR))
    try:
        from pexels_service import PexelsService  # type: ignore
    except ImportError as e:
        logger.warning(f"[BrollService] cannot import PexelsService: {e}")
        _get_pexels_service._resolved_none = True  # type: ignore[attr-defined]
        return None

    instance = PexelsService(keys_csv)
    if not instance.is_available:
        _get_pexels_service._resolved_none = True  # type: ignore[attr-defined]
        return None
    _get_pexels_service._singleton = instance  # type: ignore[attr-defined]
    return instance


# ---------------------------------------------------------------------------
# Concept extraction
# ---------------------------------------------------------------------------

def extract_concept(word_importance_reel_time: Sequence[dict]) -> Optional[str]:
    """Pick the best single search query from the reel's word_importance.

    Strategy (intentionally simple for Phase 1):
      1. Drop words with importance < 2 — those are filler / stopwords
         the cut planner could remove.
      2. Drop stopwords + bare numbers (`_BAD_CONCEPT_WORDS`).
      3. Drop sub-4-letter tokens (too generic on Pexels).
      4. Prefer `keyword_type` words (the LLM tagged them as important /
         definition / warning) over plain importance=2 words — they're
         hand-picked by the LLM as the clip's "topic".
      5. Among the remaining pool, pick the one with highest importance;
         tie-break by length (longer = more specific / better search).

    Returns the cleaned word, lowercase, punctuation stripped. None if no
    word qualifies (rare — usually means the transcript is degenerate).
    """
    candidates: list[tuple[int, int, str]] = []
    # (score, length_tiebreak, normalized_word). score is engineered so
    # `max(...)` picks the best candidate in one pass.
    for w in word_importance_reel_time or []:
        try:
            importance = int(w.get("importance") or 0)
        except (TypeError, ValueError):
            continue
        if importance < 2:
            continue
        raw = str(w.get("word") or "").strip()
        if not raw:
            continue
        # Strip trailing punctuation that Whisper sometimes leaves attached.
        cleaned = raw.strip(".,!?;:\"'()[]").lower()
        if len(cleaned) < _MIN_CONCEPT_LEN:
            continue
        if cleaned in _BAD_CONCEPT_WORDS:
            continue
        # Score: keyword_type adds 5 (effectively makes any LLM-tagged
        # keyword beat any non-tagged importance=3 candidate). Importance
        # contributes 0-3.
        score = importance + (5 if w.get("keyword_type") else 0)
        # length capped at _MAX_CONCEPT_LEN so a runaway token can't
        # dominate the tiebreak.
        length = min(len(cleaned), _MAX_CONCEPT_LEN)
        candidates.append((score, length, cleaned))

    if not candidates:
        return None
    candidates.sort(reverse=True)
    return candidates[0][2]


# ---------------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------------

# `OrderedDict` gives us LRU semantics: move_to_end on hit, popitem(last=False)
# on eviction. Lock guards both ends because the cache is shared across the
# asyncio loop's thread-pool workers (PexelsService is sync; we run it via
# `asyncio.to_thread`).
_cache_lock = Lock()
_concept_cache: "OrderedDict[str, str]" = OrderedDict()


def _cache_get(key: str) -> Optional[str]:
    with _cache_lock:
        if key not in _concept_cache:
            return None
        _concept_cache.move_to_end(key)
        return _concept_cache[key]


def _cache_set(key: str, url: str) -> None:
    with _cache_lock:
        _concept_cache[key] = url
        _concept_cache.move_to_end(key)
        while len(_concept_cache) > _CACHE_MAX:
            _concept_cache.popitem(last=False)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def find_b_roll(
    concept: str,
    *,
    orientation: str = _DEFAULT_ORIENTATION,
    min_duration_s: int = _MIN_BROLL_DURATION_S,
) -> Optional[str]:
    """Resolve a concept → b-roll MP4 URL.

    Cached per `(concept, orientation, min_duration_s)`. Returns None when
    Pexels isn't configured, search yields nothing, or any transient error
    is logged. Caller (the director) treats None as "no auto b-roll
    available — fall back to full_speaker_with_overlays".

    The sync PexelsService is offloaded to a worker thread so the asyncio
    loop stays responsive (the search is a 200-500ms HTTPS round trip).
    """
    concept = (concept or "").strip().lower()
    if not concept:
        return None
    cache_key = f"v|{concept}|{orientation}|{min_duration_s}"
    cached = _cache_get(cache_key)
    if cached:
        logger.info(f"[BrollService] cache hit (video) for {concept!r} → {cached[:60]}…")
        return cached

    svc = _get_pexels_service()
    if svc is None:
        return None

    try:
        result = await asyncio.to_thread(
            svc.search_videos,
            concept,
            orientation=orientation,
            per_page=3,
            min_duration=min_duration_s,
        )
    except Exception as e:
        # Network / API errors should never break the render. Log + return
        # None so the director picks the default layout.
        logger.warning(f"[BrollService] Pexels search for {concept!r} failed: {e}")
        return None

    if not result or not result.get("url"):
        logger.info(f"[BrollService] no Pexels hit for {concept!r}")
        return None

    url = str(result["url"])
    _cache_set(cache_key, url)
    logger.info(f"[BrollService] {concept!r} → {url[:80]}…")
    return url


async def find_b_roll_image(
    concept: str,
    *,
    orientation: str = _DEFAULT_ORIENTATION,
) -> Optional[str]:
    """Resolve a concept → Pexels photo URL (large2x ~2000px).

    Companion to `find_b_roll` for the LLM-director's `broll_image` spec
    type. Used when the speaker references something iconic + static
    (logos, products, geographic markers) — where a still photo is more
    on-message than a stock video clip with implied motion.

    Same cache shape as `find_b_roll`, distinguished by an `i|` prefix
    so video / image lookups for the same concept don't collide. Returns
    None on any failure — director's per-spec handler drops the spec.
    """
    concept = (concept or "").strip().lower()
    if not concept:
        return None
    cache_key = f"i|{concept}|{orientation}"
    cached = _cache_get(cache_key)
    if cached:
        logger.info(f"[BrollService] cache hit (image) for {concept!r} → {cached[:60]}…")
        return cached

    svc = _get_pexels_service()
    if svc is None:
        return None

    try:
        result = await asyncio.to_thread(
            svc.search_photos,
            concept,
            orientation=orientation,
            per_page=3,
        )
    except Exception as e:
        logger.warning(
            f"[BrollService] Pexels photo search for {concept!r} failed: {e}"
        )
        return None

    if not result or not result.get("url"):
        logger.info(f"[BrollService] no Pexels photo hit for {concept!r}")
        return None

    url = str(result["url"])
    _cache_set(cache_key, url)
    logger.info(f"[BrollService] photo {concept!r} → {url[:80]}…")
    return url
