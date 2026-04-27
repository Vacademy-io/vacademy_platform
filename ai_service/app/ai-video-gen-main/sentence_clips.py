"""
Per-sentence audio clip builder.

The TTS pipeline produces one global narration.mp3 plus a flat list of word
timestamps (narration.words.json). The script-editor on the frontend wants
to edit one sentence at a time and re-narrate just that sentence — so we
need to know, for each sentence in the script, the time range it occupies
inside the global MP3, plus a per-sentence MP3 clip.

This module owns:
  - Splitting the script into sentence-shaped strings.
  - Mapping each sentence onto the word-timestamp stream to derive its
    [start_time, end_time].
  - Calling the render worker to slice the global MP3 into per-sentence
    clips and return a serializable SentenceClip[] list.

Used in two places:
  - automation_pipeline.py — post-TTS, persist meta.sentences[] into the
    new timeline JSON for every newly generated video.
  - external_video_generation.py — the on-demand backfill endpoint, for
    older videos that were generated before this module existed.

Both call paths invoke the same `build_sentence_clips()` entry point.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, asdict
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)

# Sentence boundary: any of [.!?] followed by whitespace. Matches the regex
# the rest of the pipeline already uses (TTS chunker, beat-narration repair).
_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+")

# Word normalization for matching against Whisper output. Whisper word
# entries usually drop terminal punctuation but keep apostrophes (e.g.
# "F1", "don't", "Newton's"). Normalize by lowercasing and stripping any
# non-alphanumeric/apostrophe characters from both ends.
_NORMALIZE_RE = re.compile(r"[^a-z0-9']+", re.IGNORECASE)


# ---------------------------------------------------------------------------
# Public types
# ---------------------------------------------------------------------------

@dataclass
class SentenceWord:
    """One word inside a sentence clip. Times are RELATIVE to the clip
    (0..clip_duration), so per-sentence words can be consumed without
    knowing the sentence's position in the global timeline."""
    word: str
    start: float
    end: float


@dataclass
class SentenceClip:
    """Persisted into timeline.json under meta.sentences[]."""
    id: str
    text: str
    audio_url: str
    start_time: float          # position in the global narration.mp3
    duration: float
    words: List[SentenceWord]

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        return d


@dataclass
class _MappedSentence:
    """Internal: a sentence after we've found its slice of the word stream.
    Becomes a SentenceClip once we have its uploaded clip URL."""
    id: str
    text: str
    start_time: float
    end_time: float
    words: List[SentenceWord]


class SentenceMappingError(RuntimeError):
    """Raised when sentences can't be mapped onto the word stream — usually
    because the script and the audio are out of sync (script edited after
    TTS, or Whisper alignment was poor)."""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

# Slicer signature: takes (audio_url, cuts, output_prefix) → list of dicts
# {id, audio_url, duration}. We accept it as a callable rather than the
# RenderService type so this module stays free of the ai_service import
# graph and is unit-testable with a fake.
SliceFn = Callable[[str, List[Dict[str, Any]], str], List[Dict[str, Any]]]


def build_sentence_clips(
    *,
    script_text: str,
    words: List[Dict[str, Any]],
    audio_url: str,
    output_prefix: str,
    slice_fn: SliceFn,
    id_prefix: str = "sent",
) -> List[SentenceClip]:
    """Split `script_text` into sentences, map each onto `words` to derive
    its time range, slice the global MP3 into per-sentence clips, and
    return the resulting SentenceClip[].

    Args:
        script_text: full narration script as written.
        words: list of `{"word": str, "start": float, "end": float}` from
               narration.words.json. Must be sorted by start time.
        audio_url: public URL of the global narration.mp3.
        output_prefix: S3 key prefix for the per-sentence clips
                       (e.g. "videos/vid_abc/sentences/").
        slice_fn: callable that uploads each cut and returns its URL.

    Sentences whose alignment can't be found in the word stream are
    skipped (with a warning) rather than aborting the whole map; the
    returned list may be shorter than `split_into_sentences(script_text)`.
    Raises SentenceMappingError only when the input is structurally
    unusable (empty `words`).
    """
    sentences = split_into_sentences(script_text)
    if not sentences:
        return []
    if not words:
        raise SentenceMappingError("words list is empty; cannot map sentences to time")

    mapped = map_sentences_to_words(sentences, words, id_prefix=id_prefix)
    if not mapped:
        return []

    cuts = [
        {"id": s.id, "start": s.start_time, "end": s.end_time}
        for s in mapped
    ]
    slice_results = slice_fn(audio_url, cuts, output_prefix)
    by_id = {r["id"]: r for r in slice_results}

    clips: List[SentenceClip] = []
    for s in mapped:
        slice_info = by_id.get(s.id)
        if slice_info is None:
            logger.warning("sentence %s missing from slice results; skipping", s.id)
            continue
        clips.append(SentenceClip(
            id=s.id,
            text=s.text,
            audio_url=slice_info["audio_url"],
            start_time=s.start_time,
            duration=float(slice_info.get("duration") or (s.end_time - s.start_time)),
            words=s.words,
        ))
    return clips


def split_into_sentences(text: str) -> List[str]:
    """Split a script into sentence strings. Empty / whitespace-only inputs
    return an empty list. Any trailing/leading whitespace per sentence is
    stripped, but internal whitespace is preserved verbatim so the result
    can be re-joined into the original."""
    cleaned = (text or "").strip()
    if not cleaned:
        return []
    parts = _SENTENCE_RE.split(cleaned)
    return [p.strip() for p in parts if p.strip()]


def map_sentences_to_words(
    sentences: List[str],
    words: List[Dict[str, Any]],
    *,
    id_prefix: str = "sent",
) -> List[_MappedSentence]:
    """For each sentence, find its slice of the word stream by SEARCHING
    a small window around the expected position rather than counting
    sequentially. Drift caused by token-count mismatches (contractions,
    numbers spelled out, symbols) gets re-anchored every sentence instead
    of accumulating across the file.

    Sentences whose anchor can't be found inside the search window are
    SKIPPED with a warning rather than aborting the whole map — the
    caller still gets clips for every sentence that did align. The
    cursor advances by the expected token count after a skip so we don't
    keep searching the same dead spot.

    Empty `words` raises SentenceMappingError; everything else degrades
    gracefully.
    """
    if not words:
        raise SentenceMappingError("words list is empty; cannot map sentences to time")

    cursor = 0
    out: List[_MappedSentence] = []
    word_tokens = [_normalize(str(w.get("word", ""))) for w in words]
    skipped: List[int] = []

    for idx, sentence in enumerate(sentences):
        sentence_tokens = _tokenize(sentence)
        if not sentence_tokens:
            continue
        if cursor >= len(words):
            logger.warning("sentence %d (%r) has no remaining words; stopping",
                           idx, sentence[:40])
            break

        anchor = _find_sentence_anchor(
            word_tokens=word_tokens,
            sentence_tokens=sentence_tokens,
            cursor=cursor,
        )
        if anchor is None:
            logger.warning(
                "sentence %d alignment lost; skipping (%r)", idx, sentence[:60],
            )
            skipped.append(idx)
            # Best-effort cursor bump so we don't search the same window
            # repeatedly. Underestimates by design — better to re-find the
            # next sentence than to leapfrog past several real ones.
            cursor = min(len(words), cursor + max(1, len(sentence_tokens) // 2))
            continue

        start_idx, end_idx = anchor
        slice_words = words[start_idx:end_idx + 1]
        start_time = float(slice_words[0]["start"])
        end_time = float(slice_words[-1]["end"])
        rel_words = [
            SentenceWord(
                word=str(w["word"]),
                start=float(w["start"]) - start_time,
                end=float(w["end"]) - start_time,
            )
            for w in slice_words
        ]
        out.append(_MappedSentence(
            id=f"{id_prefix}-{idx}",
            text=sentence,
            start_time=start_time,
            end_time=end_time,
            words=rel_words,
        ))
        cursor = end_idx + 1

    if skipped:
        logger.warning(
            "mapped %d/%d sentences (%d skipped due to alignment drift)",
            len(out), len(sentences), len(skipped),
        )
    return out


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

# How far past the cursor we'll search for a sentence's start anchor.
# Calibrated against typical Whisper drift on numbers / abbreviations
# / symbols ("1990" → "nineteen ninety", "F1" → "F" "1", "%" → "percent").
# A 30-word window is roughly 6-8 seconds of audio at normal speech rate
# — comfortably wider than any single Whisper drift event we've seen.
_ANCHOR_SEARCH_WINDOW = 30
# How many tokens to compare when scoring an anchor candidate. More tokens
# = more confidence; fewer = works on very short sentences. 3 is the sweet
# spot — works for "Yes." (1 token, falls back to expected position) up to
# multi-paragraph sentences.
_ANCHOR_PREFIX_LEN = 3
_ANCHOR_SUFFIX_LEN = 3
# Minimum fraction of prefix tokens that must match to accept a candidate.
# At 0.67, two of three must match — robust to one dropped/misheard word
# at the boundary while still rejecting unrelated positions.
_ANCHOR_MIN_SCORE = 0.67


def _find_sentence_anchor(
    *,
    word_tokens: List[str],
    sentence_tokens: List[str],
    cursor: int,
) -> Optional[tuple]:
    """Locate the [start_idx, end_idx] in `word_tokens` that best matches
    `sentence_tokens`, searching forward from `cursor`. Returns None when
    no candidate clears the score threshold (sentence is unmappable).

    The search is two-step:
      1. Find the START by scoring sentence's first N tokens against each
         candidate position in [cursor, cursor + window).
      2. Find the END similarly, anchored to (start + expected_len) ± window.
    """
    expected_len = len(sentence_tokens)
    prefix = sentence_tokens[:_ANCHOR_PREFIX_LEN]
    suffix = sentence_tokens[-_ANCHOR_SUFFIX_LEN:]

    start_idx = _best_match(
        word_tokens=word_tokens,
        needle=prefix,
        search_from=cursor,
        search_to=min(len(word_tokens), cursor + _ANCHOR_SEARCH_WINDOW),
    )
    if start_idx is None:
        return None

    # Predicted end position; search a small window around it for the
    # actual suffix. Clamp to stream bounds. If the sentence is short
    # enough that prefix and suffix overlap, just use start + len - 1.
    if expected_len <= _ANCHOR_PREFIX_LEN + _ANCHOR_SUFFIX_LEN:
        end_idx = min(len(word_tokens) - 1, start_idx + expected_len - 1)
        return start_idx, end_idx

    predicted_end = start_idx + expected_len - len(suffix)
    end_search_from = max(start_idx + 1, predicted_end - _ANCHOR_SEARCH_WINDOW // 2)
    end_search_to = min(len(word_tokens), predicted_end + _ANCHOR_SEARCH_WINDOW // 2 + len(suffix))

    suffix_start = _best_match(
        word_tokens=word_tokens,
        needle=suffix,
        search_from=end_search_from,
        search_to=end_search_to,
    )
    if suffix_start is None:
        # Fall back to the count-based prediction. The clip will be roughly
        # right; only the tail seconds may be off.
        end_idx = min(len(word_tokens) - 1, start_idx + expected_len - 1)
    else:
        end_idx = suffix_start + len(suffix) - 1

    return start_idx, end_idx


def _best_match(
    *,
    word_tokens: List[str],
    needle: List[str],
    search_from: int,
    search_to: int,
) -> Optional[int]:
    """Return the index in word_tokens[search_from:search_to] where
    `needle` aligns best, or None if no candidate clears the score
    threshold. Score = fraction of tokens matching at that offset."""
    if not needle or search_from >= search_to:
        return None
    needle_len = len(needle)
    best_idx: Optional[int] = None
    best_score = 0.0
    for i in range(search_from, search_to):
        if i + needle_len > len(word_tokens):
            break
        matches = sum(
            1 for a, b in zip(needle, word_tokens[i:i + needle_len]) if a == b
        )
        score = matches / needle_len
        # Prefer the EARLIEST position when scores tie — keeps us moving
        # forward and avoids accidentally skipping past short sentences.
        if score > best_score:
            best_score = score
            best_idx = i
        if best_score == 1.0:
            break
    return best_idx if best_score >= _ANCHOR_MIN_SCORE else None


def _tokenize(text: str) -> List[str]:
    """Whitespace-split + per-token normalization. Empty tokens are dropped."""
    return [t for t in (_normalize(p) for p in text.split()) if t]


def _normalize(token: str) -> str:
    return _NORMALIZE_RE.sub("", token).lower()
