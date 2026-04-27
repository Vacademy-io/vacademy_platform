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

    Raises SentenceMappingError if the sentence-to-word mapping fails badly.
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
    """For each sentence, consume the matching number of words from the
    word stream and emit its [start_time, end_time] plus the per-sentence
    word list (with times rebased to the sentence start).

    The mapping is a sequential walk — we trust Whisper's word ordering
    against the script's word ordering. If the running drift between the
    sentence text and the consumed words exceeds a sanity threshold we
    raise rather than silently producing misaligned clips.
    """
    cursor = 0
    out: List[_MappedSentence] = []
    for idx, sentence in enumerate(sentences):
        sentence_tokens = _tokenize(sentence)
        if not sentence_tokens:
            continue
        n = len(sentence_tokens)
        if cursor + n > len(words):
            # Common cause: script has trailing words the audio never
            # spoke, or words.json is truncated. Take whatever's left.
            n = len(words) - cursor
            if n <= 0:
                logger.warning(
                    "sentence %d (%r) has no remaining words; stopping mapping",
                    idx, sentence[:40],
                )
                break

        slice_words = words[cursor:cursor + n]
        _check_alignment(sentence_tokens, slice_words, idx, sentence)

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
        cursor += n

    return out


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

# When the first words of the consumed slice and the sentence diverge by
# more than this fraction, we abort instead of producing garbage clips.
# Calibrated for typical Whisper jitter ("F1" vs "F-1", "don't" vs "dont").
_ALIGNMENT_DRIFT_THRESHOLD = 0.5


def _tokenize(text: str) -> List[str]:
    """Whitespace-split + per-token normalization. Empty tokens are dropped."""
    return [t for t in (_normalize(p) for p in text.split()) if t]


def _normalize(token: str) -> str:
    return _NORMALIZE_RE.sub("", token).lower()


def _check_alignment(
    sentence_tokens: List[str],
    slice_words: List[Dict[str, Any]],
    idx: int,
    sentence: str,
) -> None:
    """Compare the first few tokens of the sentence against the first few
    consumed words. If too many disagree, the mapping has drifted and the
    rest of the output would be garbage — raise so the caller can decide
    whether to abort or fall back to legacy single-MP3 mode."""
    head = sentence_tokens[:5]
    consumed = [_normalize(str(w.get("word", ""))) for w in slice_words[:5]]
    if not head or not consumed:
        return
    mismatches = sum(1 for a, b in zip(head, consumed) if a != b)
    drift = mismatches / max(len(head), 1)
    if drift > _ALIGNMENT_DRIFT_THRESHOLD:
        raise SentenceMappingError(
            f"sentence {idx} alignment drift {drift:.0%}: "
            f"expected {head!r}, got {consumed!r} (sentence={sentence[:60]!r})"
        )
