"""
Engagement scoring for reels-from-long-video (Gate 1 / POST /scan).

Reads a parsed `video_context.json` produced by the indexing pipeline and
ranks candidate windows on four axes per §2.2 of the reels plan:

  Hook       — strength of the first 2.5s (opener, energy, sentence completeness)
  Pacing     — silence fraction, predicted post-trim duration fit, emphasis density
  Info       — unique content words/s, numeric tokens, keyword match
  Loop       — first/last similarity, presence of verbal CTAs at end

Composite = weighted geometric mean (one weak axis tanks the composite, which
is the right behavior — a great hook with bad pacing is still a bad clip).

Pure Python, no numpy: ~1800 windows over a 1hr source scored in well under 1s.
The expensive work (LLM word-importance, cut planning) lives in Gate 2.
"""
from __future__ import annotations

import logging
import math
import re
from collections import Counter
from dataclasses import dataclass, field
from typing import Optional, Sequence, Tuple

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Constants — research-anchored where possible (§12.2)
# ---------------------------------------------------------------------------

# Axis weights for composite (geometric mean). Hook is highest per research
# (3s gate is the kill switch — TTS Vibes / Socialync data).
AXIS_WEIGHTS = {
    "hook": 0.34,
    "pacing": 0.21,
    "info": 0.17,
    "loop": 0.13,
    # A3 (2026-05-22) — topic-coherence axis. Weights of the other four
    # were each scaled by 0.85 to make room. Sum stays at 1.00.
    "topic": 0.15,
}

# Window enumeration.
WINDOW_STRIDE_S = 2.0
# Window-size search band — explore target ± 50%.
WINDOW_SIZE_TOLERANCE = 0.5

# Hook config.
HOOK_LEAD_S = 2.5
BAD_OPENER_WORDS = {
    "so", "yeah", "yep", "um", "uh", "i", "today", "okay", "ok",
    "alright", "right", "well", "anyway", "basically", "literally",
}
HEDGE_OPENERS = {"think", "guess", "feel", "kind", "sort"}  # "I think", "I guess", "kind of"

# Verbal-CTA detection at the end (kills loop quality per §12.2).
CTA_END_PATTERNS = [
    re.compile(p, re.IGNORECASE) for p in (
        r"\bfollow (?:me|us|for|along)\b",
        r"\bsubscribe\b",
        r"\blike (?:this|and|the)\b",
        r"\bcomment below\b",
        r"\bhit (?:that|the) like\b",
        r"\bshare (?:this|with)\b",
        r"\btap (?:the|that)\b",
        r"\bdon'?t forget to\b",
        r"\bsmash (?:that|the)\b",
        r"\blink in (?:the )?bio\b",
    )
]

# Pacing — research §12.2.
SILENCE_TRIM_MIN_GAP_S = 0.15        # the keep-gap during silence trim
SILENCE_TRIM_THRESHOLD_S = 0.4       # default "on" mode in §1.3
# Emphasis density: scored RELATIVE to the source's own baseline (not
# absolute) — real-world data shows wide variance (one Steve Jobs clip we
# tested had 0.9 marks/s baseline; an academic lecture might have 0.1).
# Absolute thresholds penalize entire sources unfairly. The sweet spot is
# instead expressed as "ratio of window density to full-video mean":
#   ratio < 0.5  → dull stretch (penalty)
#   0.5-2.5     → engagement bonus, peaked around 1.5x
#   > 2.5       → small penalty (likely music/SFX spikes, not speech)
EMPHASIS_RATIO_DULL = 0.5
EMPHASIS_RATIO_PEAK = 1.5
EMPHASIS_RATIO_CHAOTIC = 2.5

# Hard rejects (§2.3).
MAX_WORD_CUT_PCT = 0.20              # >20% surgery would mangle meaning
MAX_SPEAKER_MOVES = 2                # ≥3 face_segments touching a window is jumpy

# A1 — dead-zone pre-filter (2026-05-22). Before paying the cost of computing
# the 4 axes, drop windows that are objectively unusable. Two signals fire:
#   1. SILENCE_FRACTION_REJECT: window is >this fraction silence. Even with
#      aggressive silence-trim, the kept content would be too thin.
#   2. FACE_COVERAGE_REJECT: face_segments touch <this fraction of the window
#      duration. Speaker isn't on screen — a stacked/PiP layout has nothing
#      to anchor on. Gated by `MIN_FACE_SEGMENTS_FOR_FILTER` so sources where
#      the indexer didn't run face detection (screen recordings) aren't
#      blanket-rejected.
SILENCE_FRACTION_REJECT = 0.50
FACE_COVERAGE_REJECT = 0.20
MIN_FACE_SEGMENTS_FOR_FILTER = 5     # only apply face filter when indexer has data

# Diversity penalty: windows within this many seconds of an already-top-ranked
# window get a recency penalty so the top-N spreads across the source.
DIVERSITY_RADIUS_S = 60.0


# ---------------------------------------------------------------------------
# Internal types (dataclasses — lighter than Pydantic in inner loop)
# ---------------------------------------------------------------------------

@dataclass
class ScoreVec:
    """One window's 5-axis score + composite + a breakdown payload.
    A3 (2026-05-22): added `topic` axis."""
    hook: float
    pacing: float
    info: float
    loop: float
    topic: float
    composite: float
    breakdown: dict = field(default_factory=dict)


@dataclass
class CandidateScore:
    """Scored window ready for persistence into ai_reel_candidates."""
    rank: int
    source_t_start: float
    source_t_end: float
    source_duration_s: float
    predicted_output_duration_s: float
    score: ScoreVec
    transcript_snippet: str


@dataclass
class ScoringRequest:
    """Trimmed-down ScanRequest, decoupled from the Pydantic layer so this
    module is reusable from a worker / test harness without FastAPI types."""
    target_duration_sec: int = 25
    duration_tolerance_sec: int = 3
    scan_limit: int = 30
    topic_keywords: Sequence[str] = ()
    must_include_ranges: Sequence[Tuple[float, float]] = ()


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def score_windows(
    context: dict,
    request: ScoringRequest,
) -> list[CandidateScore]:
    """Score every candidate window in `context` and return the top-N.

    Defensive against missing fields — older index runs may not populate
    every block we'd like.
    """
    meta = context.get("meta") or {}
    duration_s = float(meta.get("duration_s") or 0.0)
    if duration_s <= 0:
        logger.warning("score_windows: video_context has no duration; returning empty")
        return []

    transcript: list[dict] = context.get("transcript") or []
    emphasis: list[dict] = context.get("emphasis") or []
    prosody: dict = context.get("prosody") or {}
    scenes: list[dict] = context.get("scenes") or []
    face_segments: list[dict] = context.get("face_segments") or []

    # Pre-index everything we'll query repeatedly for O(1) / O(log n) lookups.
    # Real sentence boundaries come from `_build_sentence_boundaries`, which
    # filters out Whisper segment edges that aren't true sentence terminators
    # (last word is a continuator like "the/a/and/of/using"). 27% of Whisper
    # "segments" in production data end mid-sentence at a pause; the helper
    # drops those + prefers punctuation-derived boundaries when available.
    sentence_starts, sentence_ends = _build_sentence_boundaries(transcript)
    energy_series = prosody.get("energy_series") or []   # [{t, rms or v}]
    pitch_series = prosody.get("pitch_series") or []     # [{t, hz or v}]
    pauses = prosody.get("pauses") or []                  # [{start, end, duration_s}]
    mean_rms = float(prosody.get("mean_rms") or 0.0) or 0.001

    # Source-level emphasis baseline — used by pacing axis as a relative
    # ratio rather than absolute thresholds (R-tune-1). Floor at 0.05/s so
    # silent/sparse sources don't divide-by-near-zero.
    source_emphasis_density = max(0.05, len(emphasis) / max(1.0, duration_s))

    # A4 + A3 (Phase 3, 2026-05-22) — single-pass source-level baselines for
    # both info-density (A4) and topic-coherence (A3). One walk of the full
    # transcript: tokenize → strip stopwords → Counter. From that one Counter
    # we derive A4's `unique_count / duration` AND A3's per-token IDF input.
    # Same lowercase + STOPWORDS filter as `_score_info` keeps ratios apples-
    # to-apples. CR4 (2026-05-22): merged the two previously-separate passes.
    _src_blob = " ".join(s.get("text", "") for s in transcript)
    _src_tokens = re.findall(r"[A-Za-z']+", _src_blob.lower())
    source_token_counts: Counter[str] = Counter(
        t for t in _src_tokens if t not in STOPWORDS and len(t) > 2
    )
    source_total_content_tokens = max(1, sum(source_token_counts.values()))
    source_info_density = max(
        0.2,
        len(source_token_counts) / max(1.0, duration_s),
    )

    target = request.target_duration_sec
    tol = request.duration_tolerance_sec
    win_min = target * (1 - WINDOW_SIZE_TOLERANCE)
    win_max = target * (1 + WINDOW_SIZE_TOLERANCE)

    # Enumerate candidate windows: slide a target-sized window, snap to
    # nearest sentence boundary, then explore ±50% width via sentence growth.
    #
    # Memoize on the SNAPPED (start, end) so neighbouring raw windows that
    # snap to the same sentence boundaries don't re-run the axis math.
    # Typical savings: 5-15% on a 1hr source.
    candidates: list[CandidateScore] = []
    seen_windows: set[tuple[float, float]] = set()
    # P2-B observability: count what the pre-filter dropped so ops can tune
    # thresholds. Logged once at end. Cheap (just ints).
    enum_count = 0
    drop_silence = 0
    drop_face_coverage = 0
    drop_word_cut_pct = 0
    drop_speaker_moves = 0
    drop_no_snippet = 0
    t = 0.0
    while t + win_min < duration_s:
        win_start, win_end = _snap_window_to_sentence(
            t, t + target, transcript, sentence_starts, sentence_ends,
            duration_s, win_min, win_max,
        )
        if win_start is None or win_end is None:
            t += WINDOW_STRIDE_S
            continue
        if win_end <= win_start:
            t += WINDOW_STRIDE_S
            continue
        if win_end - win_start < win_min:
            t += WINDOW_STRIDE_S
            continue

        # Round to 100ms to deduplicate near-identical snaps.
        key = (round(win_start, 1), round(win_end, 1))
        if key in seen_windows:
            t += WINDOW_STRIDE_S
            continue
        seen_windows.add(key)
        enum_count += 1

        # P1 fix: user-pinned ranges bypass the pre-filter (and the existing
        # speaker_moves reject). If the caller explicitly said "include this
        # timestamp," respect the pin even if framing/silence aren't ideal —
        # framing fixes happen at SOURCE_CLIP and the user can edit cuts.
        is_pinned = bool(request.must_include_ranges) and _overlaps_any(
            win_start, win_end, request.must_include_ranges
        )

        # A1 — dead-zone pre-filter (2026-05-22). Reject windows that are
        # silence-dominated or have no speaker presence BEFORE paying for the
        # 4-axis computation. Cheap O(touching-segments) checks. Face filter
        # gated by indexer-has-data threshold so screen-recording sources
        # (no face tracking) aren't blanket-rejected.
        # P2-A: face_coverage_fraction is ALWAYS computed when face_segments
        # is non-empty (so the diagnostic chip is informative for low-segment
        # sources too); the rejection check only fires when count >= threshold.
        win_duration = win_end - win_start
        silence_s = _silence_seconds_in(pauses, win_start, win_end)
        silence_frac_check = silence_s / max(0.001, win_duration)
        if silence_frac_check > SILENCE_FRACTION_REJECT and not is_pinned:
            drop_silence += 1
            t += WINDOW_STRIDE_S
            continue
        face_cov: Optional[float] = None
        if face_segments:
            face_cov = _face_coverage_fraction(face_segments, win_start, win_end)
            if (
                len(face_segments) >= MIN_FACE_SEGMENTS_FOR_FILTER
                and face_cov < FACE_COVERAGE_REJECT
                and not is_pinned
            ):
                drop_face_coverage += 1
                t += WINDOW_STRIDE_S
                continue

        # Compute axes.
        breakdown: dict = {}
        if face_cov is not None:
            breakdown["face_coverage_fraction"] = round(face_cov, 3)
        hook = _score_hook(
            win_start, win_end, transcript, energy_series, pitch_series,
            mean_rms, breakdown,
        )
        pacing, predicted_duration, cut_pct = _score_pacing(
            win_start, win_end, transcript, emphasis, pauses, scenes,
            target, tol, source_emphasis_density, breakdown,
        )
        # Hard reject: too much word surgery needed (pinned ranges bypass).
        if cut_pct > MAX_WORD_CUT_PCT and not is_pinned:
            drop_word_cut_pct += 1
            t += WINDOW_STRIDE_S
            continue

        # User-pinned ranges bypass the speaker_moves rejection (F4) — if the
        # caller explicitly said "include this timestamp", we honor the pin
        # even if framing isn't perfect. They can fix framing in the editor.
        # (is_pinned already computed above pre-filter — P1 fix 2026-05-22.)
        speaker_moves = _count_speaker_moves(win_start, win_end, face_segments)
        breakdown["speaker_moves_in_window"] = speaker_moves
        if speaker_moves > MAX_SPEAKER_MOVES and not is_pinned:
            drop_speaker_moves += 1
            t += WINDOW_STRIDE_S
            continue

        info = _score_info(
            win_start, win_end, transcript, request.topic_keywords,
            source_info_density, breakdown,
        )
        loop = _score_loop(
            win_start, win_end, transcript, energy_series, pitch_series, breakdown,
        )
        topic = _score_topic_coherence(
            win_start, win_end, transcript,
            source_token_counts, source_total_content_tokens, breakdown,
        )

        # Must-include boost.
        if request.must_include_ranges and _overlaps_any(
            win_start, win_end, request.must_include_ranges
        ):
            hook = min(100.0, hook + 5.0)
            pacing = min(100.0, pacing + 5.0)

        snippet = _build_snippet(win_start, win_end, transcript)
        # Reject windows that don't overlap any transcribed speech — they're
        # in dead-air stretches and have no usable content to surface even
        # if the heuristic axes happen to land somewhere non-zero.
        if not snippet:
            drop_no_snippet += 1
            t += WINDOW_STRIDE_S
            continue

        composite = _composite(hook, pacing, info, loop, topic)
        # End-quality adjustment (Issue 4A — production audit 2026-05-21).
        # The previous boundary-alignment bonus was a math no-op (every
        # window got +10 because snap_to_sentence forced edges to align).
        # _end_quality_score measures the ACTUAL last-word + first-word
        # content of the snapped window, so mid-sentence picks pay the
        # penalty directly. Bounded to keep composite in [0, 100].
        eq_delta, eq_breakdown = _end_quality_score(win_start, win_end, transcript)
        composite = max(0.0, min(100.0, composite + eq_delta))
        breakdown.update(eq_breakdown)
        score = ScoreVec(
            hook=hook, pacing=pacing, info=info, loop=loop, topic=topic,
            composite=composite, breakdown=breakdown,
        )

        candidates.append(CandidateScore(
            rank=0,  # assigned after diversity + sort
            source_t_start=win_start,
            source_t_end=win_end,
            source_duration_s=win_end - win_start,
            predicted_output_duration_s=predicted_duration,
            score=score,
            transcript_snippet=snippet,
        ))
        t += WINDOW_STRIDE_S

    # P2-B observability log (single INFO line). Lets ops grep "[reels.scan]"
    # to see how the pre-filter is firing per source.
    logger.info(
        "[reels.scan] enumerated=%d passed=%d "
        "drop_silence=%d drop_face_coverage=%d drop_word_cut_pct=%d "
        "drop_speaker_moves=%d drop_no_snippet=%d "
        "face_segments=%d duration_s=%.1f",
        enum_count, len(candidates),
        drop_silence, drop_face_coverage, drop_word_cut_pct,
        drop_speaker_moves, drop_no_snippet,
        len(face_segments), duration_s,
    )

    if not candidates:
        return []

    # Diversity: penalize windows clustered near already-top picks. Greedy.
    ranked = _diversify(candidates, request.scan_limit, duration_s)
    for i, c in enumerate(ranked, start=1):
        c.rank = i
    return ranked


# ---------------------------------------------------------------------------
# Sentence-boundary detection (Issue 3 fix — production audit 2026-05-21)
#
# Whisper segments speech at PAUSES, not at semantic sentence terminators.
# 27% of Whisper segment-ends in the audited Indian-English lecture ended
# with a continuator word ("the/a/of/using/called/this/...") — they're
# mid-sentence false boundaries. Two signals fix this:
#
#   1. **Punctuation** (Issue 3B): when a segment's text contains `.`, `?`,
#      `!`, the real sentence end is AT THE PUNCTUATION, not at segment_end.
#      Walk word-by-word to find the timestamp of the punctuated word.
#   2. **Continuator-word check** (Issue 3A): segments ending in a known
#      continuator are not sentence terminators. Drop their segment_end
#      from the sentence-boundary set entirely.
# ---------------------------------------------------------------------------

# Words that strongly suggest the speaker hasn't finished a thought. If a
# Whisper segment ends with one of these, the segment_end is a pause, not
# a sentence terminator. List curated against the production data:
# 120/450 Whisper segments in the audited lecture ended with one of these.
_CONTINUATOR_WORDS = frozenset({
    # Articles / determiners
    "a", "an", "the", "this", "that", "these", "those", "my", "your",
    "our", "their", "his", "her", "its",
    # Prepositions
    "of", "in", "on", "at", "to", "for", "with", "by", "as", "from",
    "into", "onto", "about", "over", "under", "between", "through",
    # Conjunctions / connectives
    "and", "or", "but", "so", "yet", "then", "than", "if", "because",
    "while", "until", "though", "although", "since", "unless",
    # Auxiliary / linking verbs
    "is", "was", "are", "were", "be", "been", "being", "am",
    "have", "has", "had", "do", "does", "did",
    "will", "would", "can", "could", "should", "may", "might", "must",
    "shall",
    # Common participle / continuation cues
    "using", "called", "named", "based", "doing", "going", "getting",
    "making", "saying", "trying",
    # Pronouns (often start a continuation)
    "i", "we", "you", "they", "he", "she", "it",
    # Question / discourse fragments
    "what", "which", "who", "whom", "whose", "where", "when", "why", "how",
})

# Characters that mark a TRUE sentence end inside Whisper segment text.
_SENTENCE_TERMINATORS = frozenset(".!?")


def _build_sentence_boundaries(
    transcript: list[dict],
) -> tuple[list[float], list[float]]:
    """Return (sentence_starts, sentence_ends) using punctuation when
    Whisper emitted it, and falling back to segment edges otherwise —
    but dropping false-positive ends that trail a continuator word.

    Boundary detection order per segment:
      1. Walk the segment's `words` array. Every time a word ends with
         `.`, `!`, or `?`, record its `end` timestamp as a sentence_end
         AND the NEXT word's `start` (if any) as a sentence_start. This
         captures sentences that finish MID-segment — Whisper sometimes
         packs two sentences into one segment ("Right. Now look here.").
      2. If the segment had no punctuation, use `segment.end` as a
         candidate sentence_end ONLY when the last word is not a
         continuator. Otherwise drop it: that boundary is a pause.
      3. `segment.start` is always a candidate sentence_start (the
         start side has fewer false positives — speakers usually pause
         BEFORE starting a new thought).

    The two arrays are returned sorted, deduplicated within 50ms.
    """
    starts: list[float] = []
    ends: list[float] = []

    def _dedup_sort(arr: list[float]) -> list[float]:
        arr.sort()
        out: list[float] = []
        for v in arr:
            if not out or v - out[-1] > 0.05:
                out.append(v)
        return out

    for seg in transcript:
        seg_start = float(seg.get("start") or 0.0)
        seg_end = float(seg.get("end") or 0.0)
        if seg_end <= seg_start:
            continue
        starts.append(seg_start)

        words = seg.get("words") or []
        found_punct = False
        for i, w in enumerate(words):
            token = (w.get("word") or "").strip()
            if not token:
                continue
            # Punctuation-derived inner boundary (Issue 3B).
            if token[-1] in _SENTENCE_TERMINATORS and len(token) > 1:
                try:
                    w_end = float(w.get("end") or 0.0)
                except (TypeError, ValueError):
                    continue
                ends.append(w_end)
                found_punct = True
                # Next word starts the next sentence.
                if i + 1 < len(words):
                    try:
                        nxt_start = float(words[i + 1].get("start") or 0.0)
                        if nxt_start > 0:
                            starts.append(nxt_start)
                    except (TypeError, ValueError):
                        pass

        if found_punct:
            # If the last word also ended in punctuation, seg_end has
            # already been captured. If not, seg_end is the trailing
            # continuation — apply continuator-check before keeping it.
            last_word = (words[-1].get("word") or "").strip() if words else ""
            last_stripped = last_word.rstrip(",.!?;:\"')]").lower()
            if last_word and last_word[-1] in _SENTENCE_TERMINATORS:
                pass  # already captured
            elif last_stripped and last_stripped not in _CONTINUATOR_WORDS:
                ends.append(seg_end)
        else:
            # No internal punctuation. Issue 3A: drop seg_end if the
            # last word is a continuator — that's a pause, not a
            # sentence end.
            last_word = (words[-1].get("word") or "").strip() if words else ""
            if not last_word:
                # No words; fall back to segment text.
                text = (seg.get("text") or "").strip()
                last_word = text.split()[-1] if text else ""
            last_stripped = last_word.rstrip(",.!?;:\"')]").lower()
            if last_stripped and last_stripped not in _CONTINUATOR_WORDS:
                ends.append(seg_end)
            # else: dropped — this segment boundary is a pause, not a
            # sentence end. The snap algorithm will look at the NEXT
            # real sentence end past this point.

    return _dedup_sort(starts), _dedup_sort(ends)


# ---------------------------------------------------------------------------
# Window boundary snapping
# ---------------------------------------------------------------------------

# Snap tolerances (R1 — production audit 2026-05-21).
#
# Pre-fix: 0.5s start / 1.0s end. Worked because Whisper segment boundaries
# appeared every ~5s, so a real boundary was always within 1s of any raw
# window edge. After Issue 3 dropped 27% of false boundaries, real
# boundaries are 8-15s apart on Indian-English / code-mixed sources. The
# original tolerances now reject windows whose nearest real boundary is
# 2-6s away — even though that boundary is still the right answer.
#
# New behavior: prefer close real boundaries when available, but ALWAYS
# snap to the nearest real boundary even if it's far. The end-quality
# penalty (_end_quality_score) handles the case where snapping shifts
# the window past a continuator — that window pays −10 and naturally
# ranks below cleanly-snapped picks.
_SNAP_START_TOLERANCE_S = 4.0   # was 0.5; widened for sparser real boundaries
_SNAP_END_TOLERANCE_S = 4.0     # was 1.0; widened symmetrically
# How far past win_max we'll extend if the next real sentence end falls
# beyond it. The end-quality penalty + diversity filter handle the
# resulting score, but we cap so the window doesn't grow unboundedly.
_SNAP_WIN_MAX_OVERSHOOT_S = 8.0


def _snap_window_to_sentence(
    raw_start: float,
    raw_end: float,
    transcript: list[dict],
    sentence_starts: list[float],
    sentence_ends: list[float],
    duration_s: float,
    win_min: float,
    win_max: float,
) -> tuple[Optional[float], Optional[float]]:
    """Snap window edges to nearest real sentence boundary.

    Real boundaries (after Issue 3's continuator + punctuation filtering)
    are 8-15s apart on Indian-English sources. The wider tolerances
    accept far-but-real boundaries; the end-quality penalty
    differentiates the resulting candidates.

    If snapping leaves the window under win_min, extends to the next
    real sentence end up to win_max + _SNAP_WIN_MAX_OVERSHOOT_S. Returns
    (None, None) when there's no usable boundary within that envelope.
    """
    if not transcript:
        return (raw_start, min(duration_s, raw_end))

    # Snap start: prefer the closest sentence_start within tolerance. If
    # multiple candidates exist, pick the EARLIEST one to include the
    # speaker's full lead-in (Phase 2e selection-quality finding).
    new_start = raw_start
    best_start = None
    best_start_dist = _SNAP_START_TOLERANCE_S + 1
    for s_start in sentence_starts:
        if s_start > raw_start + _SNAP_START_TOLERANCE_S:
            break
        if s_start < raw_start - _SNAP_START_TOLERANCE_S:
            continue
        dist = abs(s_start - raw_start)
        if dist < best_start_dist or (
            dist == best_start_dist and best_start is not None and s_start < best_start
        ):
            best_start = s_start
            best_start_dist = dist
    if best_start is not None:
        new_start = best_start

    # Snap end: prefer the closest sentence_end within tolerance. Bias
    # toward LATER ends so the window is more likely to include a real
    # payoff sentence (and the end-quality scorer rewards punctuated ends).
    new_end = raw_end
    best_end = None
    best_end_dist = _SNAP_END_TOLERANCE_S + 1
    for s_end in sentence_ends:
        if s_end < raw_end - _SNAP_END_TOLERANCE_S:
            continue
        if s_end > raw_end + _SNAP_END_TOLERANCE_S:
            break
        dist = abs(s_end - raw_end)
        if dist < best_end_dist or (
            dist == best_end_dist and best_end is not None and s_end > best_end
        ):
            best_end = s_end
            best_end_dist = dist
    if best_end is not None:
        new_end = best_end
    else:
        # No real boundary within tolerance. raw_end may happen to coincide
        # with a Whisper segment edge that _build_sentence_boundaries dropped
        # as a false boundary (continuator-ending). Reach forward to the
        # NEXT real sentence end, capped at win_max + overshoot — better to
        # extend a window than to lock it on a known mid-sentence position.
        extension_cap = win_max + _SNAP_WIN_MAX_OVERSHOOT_S
        for s_end in sentence_ends:
            if s_end <= raw_end:
                continue
            if s_end - new_start > extension_cap:
                break
            new_end = s_end
            break

    # If duration is now under win_min, extend to the next real sentence
    # end. Allow overshoot up to _SNAP_WIN_MAX_OVERSHOOT_S past win_max
    # so we don't reject the candidate just because real boundaries are
    # sparse — the end-quality scorer + diversity filter sort it later.
    if new_end - new_start < win_min:
        extension_cap = win_max + _SNAP_WIN_MAX_OVERSHOOT_S
        extended = False
        for s_end in sentence_ends:
            if s_end <= new_end:
                continue
            if s_end - new_start >= win_min:
                if s_end - new_start <= extension_cap:
                    new_end = s_end
                    extended = True
                break
        if not extended:
            # No real boundary reachable within the overshoot envelope.
            # Fall back to raw_end clamped to win_max — the window won't
            # land cleanly but the end-quality penalty makes it visible.
            new_end = min(raw_end, new_start + win_max)
            if new_end - new_start < win_min:
                return (None, None)

    # If duration overshoots win_max (after extension or directly), pull
    # back to a closer real sentence end. We accept down to win_min,
    # otherwise leave it (end-quality will penalize).
    if new_end - new_start > win_max:
        target_end = new_end
        for s_end in reversed(sentence_ends):
            if s_end >= new_end:
                continue
            duration = s_end - new_start
            if win_min <= duration <= win_max:
                target_end = s_end
                break
        new_end = target_end

    new_end = min(new_end, duration_s)
    if new_end - new_start < win_min:
        return (None, None)
    return (new_start, new_end)


# ---------------------------------------------------------------------------
# Axis: HOOK (first 2.5s)
# ---------------------------------------------------------------------------

def _score_hook(
    win_start: float,
    win_end: float,
    transcript: list[dict],
    energy_series: list[dict],
    pitch_series: list[dict],
    mean_rms: float,
    breakdown: dict,
) -> float:
    """First 2.5s strength: opener + energy + completeness + vocal expressiveness."""
    hook_end = min(win_end, win_start + HOOK_LEAD_S)
    opening_sentence = _sentence_at(transcript, win_start)

    # 1. Opener quality (0 = filler opener, 100 = strong claim/question).
    opener_quality = _opener_quality(opening_sentence)
    breakdown["opener_quality"] = round(opener_quality, 1)

    # 2. Energy z-score over first 2.5s vs mean_rms.
    # R-tune-4: when the indexer didn't populate energy_series, energy_avg is
    # 0.0 across the board. The previous fallback of 50.0 was too generous —
    # absence of signal isn't neutral, it means we can't verify the hook
    # actually has any vocal punch. Drop to 30.0 so hook scoring leans more
    # heavily on opener_quality + completeness, which we DO have signal for.
    energy_avg = _series_window_avg(energy_series, win_start, hook_end)
    if not energy_series:
        # No series populated at all → unknown delivery; treat as small negative.
        energy_score = 30.0
    elif mean_rms > 0:
        z = (energy_avg - mean_rms) / max(mean_rms, 0.001)
        energy_score = _sigmoid(z * 2.5) * 100  # squish to 0-100
    else:
        energy_score = 40.0  # series present but mean_rms missing — slight penalty
    breakdown["energy_first_2_5s"] = round(energy_score, 1)

    # 3. First-sentence completeness — F3 fix.
    # Old rule: "does the first sentence END inside the hook window?" — that
    # only fired for sentences ≤2.5s long (~38% of typical podcast sentences).
    # Longer sentences got penalized regardless of content quality. Perverse.
    #
    # New rule: "did the speaker deliver at least ONE complete sentence in
    # the first 2.5s?" — fires whenever the SECOND sentence has started by
    # `hook_end`. That cleanly captures "speaker got a thought out fast" for
    # both short-sentence and tight-multi-sentence openers, without penalizing
    # naturally-paced single declarations.
    completeness_bonus = 0.0
    delivered_complete_thought = False
    if opening_sentence is not None:
        # Find the sentence immediately after opening_sentence. If its start
        # is within the hook window, we've gotten at least one full thought out.
        op_idx = None
        for i, s in enumerate(transcript):
            if s is opening_sentence:
                op_idx = i
                break
        if op_idx is not None and op_idx + 1 < len(transcript):
            next_start = transcript[op_idx + 1].get("start", 1e9)
            if next_start <= hook_end + 0.3:
                delivered_complete_thought = True
                completeness_bonus += 20
        # Fallback for the legacy case (very short opening sentence that
        # ends INSIDE the hook): still counts as a complete thought even if
        # we couldn't find a successor sentence.
        if not delivered_complete_thought and opening_sentence.get("end", 999) <= hook_end + 0.3:
            delivered_complete_thought = True
            completeness_bonus += 20
        if _contains_number_or_proper_noun(opening_sentence):
            completeness_bonus += 20
    breakdown["first_sentence_complete"] = delivered_complete_thought

    # 4. Vocal expressiveness in the hook — pitch range across the first 2.5s.
    #    High range = animated delivery; flat monotone reads as filler even
    #    if the words happen to be strong.
    pitch_samples = [
        s.get("v") for s in pitch_series
        if win_start <= s.get("t", -1) <= hook_end
        and s.get("v") is not None
        and not (isinstance(s.get("v"), float) and math.isnan(s.get("v")))
    ]
    expressiveness_bonus = 0.0
    if len(pitch_samples) >= 2:
        pitch_range = max(pitch_samples) - min(pitch_samples)
        # 20Hz range ≈ minimal modulation; 80Hz+ ≈ very expressive.
        expressiveness_bonus = min(10.0, pitch_range / 8.0)

    # Hook = weighted combine.
    raw = 0.55 * opener_quality + 0.30 * energy_score + completeness_bonus + expressiveness_bonus
    return max(0.0, min(100.0, raw))


def _opener_quality(sentence: Optional[dict]) -> float:
    """0..100. Penalizes filler openers, rewards concrete/contrarian openings."""
    if sentence is None:
        return 50.0
    text = (sentence.get("text") or "").strip()
    if not text:
        return 30.0

    words = re.findall(r"[A-Za-z']+", text.lower())
    if not words:
        return 30.0

    first = words[0]
    second = words[1] if len(words) > 1 else ""

    # Heavy penalty for filler opener — research §12.2.
    if first in BAD_OPENER_WORDS:
        # "I think", "I guess" — double-penalize the hedge phrase.
        if first == "i" and second in HEDGE_OPENERS:
            return 5.0
        return 15.0

    # Reward strong openers.
    score = 60.0
    contrarian_phrases = (
        "most people", "everyone", "everybody", "nobody knows",
        "the truth", "actually", "here's the thing", "wait", "stop",
        "warning", "the secret", "the reality", "what if",
    )
    if any(text.lower().startswith(p) for p in contrarian_phrases):
        score += 25
    # Numeric opener (e.g., "3 things…", "1 in 10…").
    if re.match(r"^\s*\d", text):
        score += 20
    # Question opener.
    if "?" in text[: min(80, len(text))]:
        score += 15
    return min(100.0, score)


def _contains_number_or_proper_noun(sentence: dict) -> bool:
    """Quick heuristic: any digit token OR a Capitalized non-sentence-start
    word within the first 80 chars of the sentence."""
    text = sentence.get("text") or ""
    if re.search(r"\d", text[:80]):
        return True
    # Proper-noun heuristic: capitalized token NOT at position 0.
    tokens = text.split()
    for i, tok in enumerate(tokens[:12]):
        if i == 0:
            continue
        if tok and tok[0].isupper() and tok[1:2].islower():
            return True
    return False


# ---------------------------------------------------------------------------
# Axis: PACING
# ---------------------------------------------------------------------------

def _score_pacing(
    win_start: float,
    win_end: float,
    transcript: list[dict],
    emphasis: list[dict],
    pauses: list[dict],
    scenes: list[dict],
    target: int,
    tol: int,
    source_emphasis_density: float,
    breakdown: dict,
) -> tuple[float, float, float]:
    """Returns (pacing_score, predicted_output_duration_s, word_cut_pct).

    `source_emphasis_density` is the per-second emphasis-mark rate over the
    full video — used to score the window's density RELATIVE to the source's
    own baseline (R-tune-1). Absolute thresholds penalize entire sources
    unfairly.

    word_cut_pct is the proportion of words we'd need to remove to hit
    target ± tol after silence trim. Above MAX_WORD_CUT_PCT → caller rejects.
    """
    duration = win_end - win_start

    # 1. Silence fraction inside window.
    silence_in_window = _silence_seconds_in(pauses, win_start, win_end)
    silence_fraction = silence_in_window / max(0.001, duration)
    breakdown["silence_fraction"] = round(silence_fraction, 3)

    # 2. Silence-trim savings: every pause >= threshold trims down to 0.15s gap.
    silence_savings = 0.0
    for p in pauses:
        ps, pe = p.get("start", 0.0), p.get("end", 0.0)
        # Pause must lie entirely inside window for the savings to apply here.
        if ps < win_start or pe > win_end:
            continue
        plen = pe - ps
        if plen >= SILENCE_TRIM_THRESHOLD_S:
            silence_savings += max(0.0, plen - SILENCE_TRIM_MIN_GAP_S)

    # 3. Predicted duration after silence trim alone (no word cuts, speedup=1.0).
    #    Note: distinct from `predicted_output_duration_s` at the candidate
    #    level, which factors in word cuts + speedup too.
    predicted_after_silence = duration - silence_savings

    # 4. How much extra word-cut do we need to hit target ± tol?
    excess = predicted_after_silence - target
    word_cut_needed = max(0.0, excess)
    # We can also be shorter than target: that's OK as long as still ≥ target - tol.
    breakdown["predicted_after_silence_s"] = round(predicted_after_silence, 2)

    # Estimate word count in window (sum sentence word counts; fallback to char/5).
    word_count = _count_words_in_window(transcript, win_start, win_end)
    # Average word duration ≈ duration / word_count (cheap approximation).
    avg_word_duration = duration / max(1, word_count)
    words_to_cut = word_cut_needed / max(0.05, avg_word_duration)
    word_cut_pct = words_to_cut / max(1, word_count)
    breakdown["word_cut_savings_needed_s"] = round(word_cut_needed, 2)
    breakdown["word_cut_savings_pct"] = round(word_cut_pct, 3)

    # 5. Duration-fit score: triangular around target.
    fit_score = _duration_fit_score(predicted_after_silence - word_cut_needed, target, tol)

    # 6. Emphasis density — scored RELATIVE to the source's own baseline.
    # The ratio of (this window's density) / (full-video mean density) is
    # the engagement signal. Windows much hotter than baseline get the
    # bonus; windows duller than baseline get penalized. Chaotic outliers
    # (likely music/SFX spikes, not speech engagement) get a small penalty.
    emphasis_in_window = sum(1 for m in emphasis if win_start <= m.get("t", -1) <= win_end)
    emphasis_density = emphasis_in_window / max(0.001, duration)
    breakdown["emphasis_density"] = round(emphasis_density, 3)
    ratio = emphasis_density / source_emphasis_density
    breakdown["emphasis_density_ratio"] = round(ratio, 2)
    if ratio < EMPHASIS_RATIO_DULL:
        # Linear ramp from 0 (zero emphasis) to 60 (at dull threshold).
        emphasis_score = 60.0 * (ratio / EMPHASIS_RATIO_DULL)
    elif ratio <= EMPHASIS_RATIO_PEAK:
        # Linear ramp from 60 (dull boundary) to 100 (at peak).
        span = EMPHASIS_RATIO_PEAK - EMPHASIS_RATIO_DULL
        emphasis_score = 60.0 + 40.0 * ((ratio - EMPHASIS_RATIO_DULL) / span)
    elif ratio <= EMPHASIS_RATIO_CHAOTIC:
        # Hold at 100 from peak through the chaotic threshold (broad sweet spot).
        emphasis_score = 100.0
    else:
        # Above chaotic — likely non-speech signal (music, SFX spikes).
        # Soft penalty: lose 25 points per unit-ratio above chaotic.
        emphasis_score = max(40.0, 100.0 - (ratio - EMPHASIS_RATIO_CHAOTIC) * 25.0)

    # 7. Scene-boundary alignment: bonus if either edge sits near a scene cut.
    scene_align = 0.0
    for s in scenes:
        st = s.get("t", -1)
        if abs(st - win_start) < 1.0 or abs(st - win_end) < 1.0:
            scene_align = 15.0
            break

    # 8. Silence penalty (dead-air windows are weak even after trim).
    silence_penalty = min(35.0, silence_fraction * 80.0)

    raw = (
        0.55 * fit_score
        + 0.30 * emphasis_score
        + scene_align
        - silence_penalty
    )
    # Predicted duration after BOTH silence-trim AND word cuts. Clamp at zero —
    # if word_cut_needed > predicted_after_silence (impossible-target case),
    # we'd otherwise surface a negative duration to the FE.
    predicted_final = max(0.0, predicted_after_silence - word_cut_needed)
    return max(0.0, min(100.0, raw)), predicted_final, word_cut_pct


def _duration_fit_score(predicted_s: float, target: int, tol: int) -> float:
    """Triangular peaked at target, zero at ±3*tol."""
    diff = abs(predicted_s - target)
    if diff <= tol:
        return 100.0
    span = max(1, 3 * tol)
    return max(0.0, 100.0 * (1.0 - (diff - tol) / span))


# ---------------------------------------------------------------------------
# Axis: INFO
# ---------------------------------------------------------------------------

# A small stopword set is enough for content-density estimation — we are not
# building a search engine, we're penalizing windows that are mostly filler.
STOPWORDS = {
    "a", "an", "the", "and", "or", "but", "if", "then", "of", "to", "in",
    "on", "at", "by", "for", "with", "from", "as", "is", "are", "was",
    "were", "be", "been", "being", "am", "i", "you", "he", "she", "it",
    "we", "they", "them", "us", "me", "my", "your", "his", "her", "its",
    "our", "their", "this", "that", "these", "those", "so", "well", "just",
    "now", "very", "really", "kind", "sort", "like", "right", "okay", "ok",
    "yeah", "yep", "um", "uh", "hmm", "huh", "oh",
}


def _score_info(
    win_start: float,
    win_end: float,
    transcript: list[dict],
    topic_keywords: Sequence[str],
    source_info_density: float,
    breakdown: dict,
) -> float:
    """Information density: unique content words/s + numeric tokens + keyword
    matches − repetition penalty.

    A4 (Phase 3): density is scored RELATIVE to the source-level baseline,
    not against absolute thresholds. A soft-spoken lecturer at 0.4 unique-
    words/s with a 0.3 source baseline scores well (1.33× the speaker's own
    norm); a fast podcaster at the same 0.4 with 1.5 source baseline scores
    poorly (0.27×). Per-speaker fair.
    """
    duration = win_end - win_start
    text_blob = " ".join(
        s.get("text", "")
        for s in transcript
        if s.get("start", 999) >= win_start and s.get("end", 0) <= win_end + 0.5
    )
    if not text_blob:
        return 30.0
    tokens = re.findall(r"[A-Za-z']+", text_blob.lower())
    content_tokens = [t for t in tokens if t not in STOPWORDS and len(t) > 2]
    unique_content = len(set(content_tokens))
    rate = unique_content / max(0.001, duration)
    breakdown["unique_content_words_per_s"] = round(rate, 2)

    # Same piecewise as emphasis but WITHOUT a chaotic cap on the high end
    # — high info density is generally good (research §12.2: dense content
    # holds attention longer). Bottoms out at 0 for ratio<<1, plateaus at
    # 100 above ratio=1.5×.
    ratio = rate / max(0.05, source_info_density)
    breakdown["info_density_ratio"] = round(ratio, 2)
    if ratio < 0.5:
        density_score = 60.0 * (ratio / 0.5)
    elif ratio <= 1.5:
        density_score = 60.0 + 40.0 * ((ratio - 0.5) / 1.0)
    else:
        density_score = 100.0

    # Numeric token bonus.
    numeric_count = sum(1 for t in re.findall(r"\b\d[\d,.]*\b", text_blob))
    breakdown["numeric_token_count"] = numeric_count
    numeric_bonus = min(20.0, numeric_count * 5.0)

    # Keyword match bonus.
    kw_bonus = 0.0
    if topic_keywords:
        blob_lower = text_blob.lower()
        for kw in topic_keywords:
            if not kw:
                continue
            if kw.lower() in blob_lower:
                kw_bonus += 8.0
        kw_bonus = min(30.0, kw_bonus)

    # Repetition penalty (very crude: top-3 most-common content tokens >25%).
    if content_tokens:
        c = Counter(content_tokens)
        top_share = sum(n for _, n in c.most_common(3)) / max(1, len(content_tokens))
        rep_penalty = max(0.0, (top_share - 0.25) * 80.0)
    else:
        rep_penalty = 0.0

    raw = density_score + numeric_bonus + kw_bonus - rep_penalty
    return max(0.0, min(100.0, raw))


# ---------------------------------------------------------------------------
# Axis: LOOP
# ---------------------------------------------------------------------------

def _score_loop(
    win_start: float,
    win_end: float,
    transcript: list[dict],
    energy_series: list[dict],
    pitch_series: list[dict],
    breakdown: dict,
) -> float:
    """Loop-back quality: first/last energy similarity, no verbal CTA at end."""
    # 1. Verbal CTA at the end — research §12.2.
    last_2s_text = _text_in_range(transcript, max(win_start, win_end - 2.5), win_end)
    has_cta = any(p.search(last_2s_text) for p in CTA_END_PATTERNS) if last_2s_text else False
    breakdown["has_verbal_cta_end"] = has_cta

    if has_cta:
        # Strong penalty — kills loop replays.
        return 15.0

    # 2. First-last energy/pitch similarity proxy for MFCC similarity.
    e_first = _series_window_avg(energy_series, win_start, win_start + 1.0)
    e_last = _series_window_avg(energy_series, win_end - 1.0, win_end)
    p_first = _series_window_avg(pitch_series, win_start, win_start + 1.0)
    p_last = _series_window_avg(pitch_series, win_end - 1.0, win_end)

    # Detect: do we actually HAVE prosody series data? When the indexer
    # didn't populate energy_series/pitch_series, all four samples come back
    # as 0.0 and the audio-based similarity is meaningless. Fall back to a
    # text-based callback heuristic in that case (R-tune-2).
    has_audio_signal = (
        (e_first > 0 or e_last > 0) or (p_first > 0 or p_last > 0)
    )

    if has_audio_signal:
        def _close(a: float, b: float, tol: float) -> float:
            if a == 0 and b == 0:
                return 0.5  # neutral when one side has no signal
            ref = max(abs(a), abs(b), tol)
            return max(0.0, 1.0 - abs(a - b) / ref)

        similarity = (_close(e_first, e_last, 0.001) + _close(p_first, p_last, 30.0)) / 2.0
        breakdown["first_last_mfcc_similarity"] = round(similarity, 3)
        similarity_score = similarity * 100
    else:
        # Text-based callback: does the last sentence echo the first?
        # Strong loop = at least one significant content word recurs.
        first_sent = _sentence_at(transcript, win_start + 0.05)
        last_sent = _sentence_at(transcript, max(win_start, win_end - 0.5))
        similarity_score = _text_callback_score(first_sent, last_sent)
        breakdown["text_callback_similarity"] = round(similarity_score / 100.0, 3)

    # 3. Bonus if window does NOT end at a sentence end (loop-friendly).
    ending_sentence = _sentence_at(transcript, win_end - 0.1)
    if ending_sentence is not None and abs(ending_sentence.get("end", 0) - win_end) < 0.3:
        # Hard stop at sentence boundary — slightly less loopy than mid-thought.
        sentence_end_penalty = 8.0
    else:
        sentence_end_penalty = 0.0

    raw = similarity_score - sentence_end_penalty
    return max(0.0, min(100.0, raw))


def _text_callback_score(first: Optional[dict], last: Optional[dict]) -> float:
    """Loop-back quality from text only.

    Used as the loop signal when audio prosody series weren't populated by
    the indexer. Jaccard similarity of meaningful content tokens between
    the first and last sentences of the window — high overlap suggests a
    "the answer to the opening claim is..." callback structure, which is
    the natural loop pattern in podcast/lecture content.

    Returns 0-100. Defaults to 35 (mild negative) when sentences are missing
    so absence of signal isn't a free pass.
    """
    if first is None or last is None:
        return 35.0
    if first is last:
        # Same sentence covers the whole window — short clip, no callback
        # possible. Treat as neutral so we don't double-penalize already
        # short candidates.
        return 50.0
    a_tokens = {
        t for t in re.findall(r"[A-Za-z']+", (first.get("text") or "").lower())
        if t not in STOPWORDS and len(t) > 3
    }
    b_tokens = {
        t for t in re.findall(r"[A-Za-z']+", (last.get("text") or "").lower())
        if t not in STOPWORDS and len(t) > 3
    }
    if not a_tokens or not b_tokens:
        return 35.0
    overlap = len(a_tokens & b_tokens)
    union = len(a_tokens | b_tokens)
    jaccard = overlap / union  # 0..1
    # Floor at 35 even with zero overlap — not having a callback isn't
    # actively bad, it's just not great. Strong callback (jaccard >= 0.2 →
    # 1+ shared keywords in a typical 30-word sentence pair) hits 100.
    return min(100.0, 35.0 + jaccard * 325.0)


# ---------------------------------------------------------------------------
# Axis: TOPIC COHERENCE  (A3 — added 2026-05-22)
# ---------------------------------------------------------------------------

def _score_topic_coherence(
    win_start: float,
    win_end: float,
    transcript: list[dict],
    source_token_counts: dict,
    source_total_content_tokens: int,
    breakdown: dict,
) -> float:
    """How focused is this window on a small set of topics?

    Uses TF-IDF against the FULL-SOURCE token distribution as the corpus.
    A focused window concentrates TF-IDF mass in a few rare-in-source
    tokens; a rambling window spreads mass evenly across many tokens.
    We score the share of the top-5 tokens' TF-IDF over the window's total.

    PB19 (2026-05-22) — thresholds calibrated from traced real numbers,
    not intuition. A 75-token window where one term repeats 8× yields a
    top-5 share around 0.16-0.18 (real focused content). An all-unique
    window yields ~0.05-0.07. The buckets reflect that observed range:
      * share < 0.08 → rambling / multi-topic
      * 0.08-0.18 → mixed
      * 0.18-0.30 → focused
      * >= 0.30 → very focused (single dominant concept)

    Floors at 0 (sub-rambling) and ceilings at 100. Each band is linear.
    """
    text_blob = " ".join(
        s.get("text", "")
        for s in transcript
        if s.get("start", 999) >= win_start and s.get("end", 0) <= win_end + 0.5
    )
    if not text_blob:
        return 30.0
    tokens = re.findall(r"[A-Za-z']+", text_blob.lower())
    content = [t for t in tokens if t not in STOPWORDS and len(t) > 2]
    if len(content) < 10:
        # Not enough tokens to compute a meaningful TF-IDF distribution.
        # PB20: scale the floor rather than returning a fixed mid-range
        # value — an empty window shouldn't outscore a focused one.
        return 15.0 + 15.0 * (len(content) / 10)

    win_counts = Counter(content)
    win_total = len(content)

    tfidf: dict[str, float] = {}
    for token, w_count in win_counts.items():
        tf = w_count / win_total
        src_count = source_token_counts.get(token, 1)
        # log(N / df) — common tokens get small IDF, rare ones get large.
        idf = math.log(max(1.0, source_total_content_tokens / max(1, src_count)))
        tfidf[token] = tf * idf

    total_tfidf = sum(tfidf.values())
    if total_tfidf <= 0:
        return 40.0

    # Top-5 share of the window's TF-IDF mass.
    sorted_tfidf = sorted(tfidf.items(), key=lambda kv: kv[1], reverse=True)
    top_share = sum(v for _, v in sorted_tfidf[:5]) / total_tfidf
    breakdown["topic_top5_share"] = round(top_share, 3)
    if sorted_tfidf:
        breakdown["topic_top_token"] = sorted_tfidf[0][0]

    # PB19: thresholds recalibrated to observed real-world top-5 shares.
    if top_share < 0.08:
        score = 30.0 * (top_share / 0.08)
    elif top_share < 0.18:
        score = 30.0 + 35.0 * ((top_share - 0.08) / 0.10)
    elif top_share < 0.30:
        score = 65.0 + 25.0 * ((top_share - 0.18) / 0.12)
    else:
        score = min(100.0, 90.0 + 10.0 * ((top_share - 0.30) / 0.20))
    return max(0.0, min(100.0, score))


# ---------------------------------------------------------------------------
# Compose + diversity
# ---------------------------------------------------------------------------

def _composite(
    hook: float, pacing: float, info: float, loop: float, topic: float,
) -> float:
    """Weighted geometric mean. Each axis floor of 1.0 to keep the product
    nonzero — otherwise a single 0 axis nukes the score for purely numeric
    reasons rather than reflecting the user-facing penalty we want."""
    h = max(1.0, hook)
    p = max(1.0, pacing)
    i = max(1.0, info)
    l = max(1.0, loop)
    tp = max(1.0, topic)
    log_sum = (
        AXIS_WEIGHTS["hook"] * math.log(h)
        + AXIS_WEIGHTS["pacing"] * math.log(p)
        + AXIS_WEIGHTS["info"] * math.log(i)
        + AXIS_WEIGHTS["loop"] * math.log(l)
        + AXIS_WEIGHTS["topic"] * math.log(tp)
    )
    return max(0.0, min(100.0, math.exp(log_sum)))


# Tolerance for "this edge matches a sentence boundary exactly". Most
# snapped edges land within a few ms of a recorded boundary; 50ms is
# tight enough that only genuinely-snapped windows pass, but loose
# enough to handle floating-point rounding from the snap logic upstream.
_BOUNDARY_SNAP_TOLERANCE_S = 0.05

# Direct end-quality scoring (Issue 4A — production audit 2026-05-21).
#
# The previous design (_boundary_quality_bonus, kept as a wrapper for
# backward compat) was a mathematical no-op: `_snap_window_to_sentence`
# already forces every candidate to align with a sentence boundary, so
# the post-snap alignment check always returned the +10 bonus.
#
# New design measures THE CONTENT of the first/last word in the snapped
# window — independent of whether the edge aligned with Whisper's segment
# boundaries. Continuator first/last words → penalty. Real sentence
# starters / terminators → small bonus. This is the signal the user
# perceives ("starts/ends mid-sentence"), measured directly.
_END_QUALITY_PENALTY_CONTINUATOR = -10.0  # last word is "the"/"a"/...
_END_QUALITY_PENALTY_NO_PUNCT = -3.0      # ends without punctuation
_END_QUALITY_BONUS_PUNCT = 5.0            # ends in . ! ?
_START_QUALITY_BONUS_CAPITAL = 2.0        # first content word is capitalized

# Words a clean sentence does NOT start with (filler / discourse).
_BAD_OPENER_WORDS = frozenset({
    "so", "and", "but", "or", "now", "okay", "yeah", "well", "actually",
    "literally", "basically", "i", "we", "you", "they", "anyway", "right",
    "like", "um", "uh", "hmm",
})


def _end_quality_score(
    win_start: float,
    win_end: float,
    transcript: list[dict],
) -> tuple[float, dict]:
    """Direct measurement of how 'finished' the window's last sentence
    feels + how clean its opener is. Returns (delta, breakdown_keys).

    delta combines:
      +5  if the last word ends in . ! ? (real terminator)
      -10 if the last word is a continuator (the/a/of/and/using/...)
      -3  otherwise (segment edge with no punctuation, no continuator)
      +2  if the first content word is capitalized AND not a bad opener

    breakdown_keys are merged into the ScoreVec breakdown so the FE/diag
    can see exactly why a candidate was ranked where it was.
    """
    breakdown: dict = {
        "end_quality_score": 0.0,
        "end_last_word": None,
        "end_terminator": None,
        "start_first_word": None,
        "start_bad_opener": None,
    }
    if not transcript:
        return 0.0, breakdown

    # Find the LAST word inside the window. Walking from the right
    # avoids scanning the whole transcript.
    last_word_text: str = ""
    for s in reversed(transcript):
        ss = float(s.get("start") or 0.0)
        if ss > win_end:
            continue
        words = s.get("words") or []
        for w in reversed(words):
            try:
                we = float(w.get("end") or 0.0)
            except (TypeError, ValueError):
                continue
            if win_start <= we <= win_end:
                last_word_text = (w.get("word") or "").strip()
                break
        if last_word_text:
            break
        # Segments without per-word data: fall back to seg text. L1 fix —
        # we need BOTH end <= win_end AND end > win_start (segment must
        # actually overlap the window, not just precede it).
        if not (s.get("words") or []):
            se = float(s.get("end") or 0.0)
            if se <= win_end and se > win_start:
                text = (s.get("text") or "").strip()
                if text:
                    last_word_text = text.split()[-1]
                    break

    # Find FIRST content word inside the window.
    first_word_text: str = ""
    for s in transcript:
        se = float(s.get("end") or 0.0)
        if se < win_start:
            continue
        words = s.get("words") or []
        for w in words:
            try:
                ws = float(w.get("start") or 0.0)
            except (TypeError, ValueError):
                continue
            if win_start <= ws <= win_end:
                first_word_text = (w.get("word") or "").strip()
                break
        if first_word_text:
            break
        # Segments without per-word data: fall back to seg text. L1 fix —
        # segment must start before win_end AND end after win_start.
        if not (s.get("words") or []):
            ss = float(s.get("start") or 0.0)
            if ss >= win_start and ss <= win_end:
                text = (s.get("text") or "").strip()
                if text:
                    first_word_text = text.split()[0]
                    break

    delta = 0.0
    breakdown["end_last_word"] = last_word_text or None
    breakdown["start_first_word"] = first_word_text or None

    # END side ---------------------------------------------------------
    # B1 fix — strip outer quotes/brackets BEFORE the terminator check.
    # `"foo."` ends in `"`, not in `.`; we'd misclassify as no_punct.
    if last_word_text:
        end_outer_stripped = last_word_text.rstrip("\"')]>")
        end_inner_stripped = end_outer_stripped.rstrip(",;:").lower()
        if end_outer_stripped and end_outer_stripped[-1] in _SENTENCE_TERMINATORS:
            delta += _END_QUALITY_BONUS_PUNCT
            breakdown["end_terminator"] = "punctuation"
        elif end_inner_stripped.rstrip(".!?") in _CONTINUATOR_WORDS:
            delta += _END_QUALITY_PENALTY_CONTINUATOR
            breakdown["end_terminator"] = "continuator"
        else:
            delta += _END_QUALITY_PENALTY_NO_PUNCT
            breakdown["end_terminator"] = "no_punct"

    # START side -------------------------------------------------------
    if first_word_text:
        first_stripped = first_word_text.strip("\"'([<").rstrip(",.!?;:>])").lower()
        is_bad = first_stripped in _BAD_OPENER_WORDS
        breakdown["start_bad_opener"] = is_bad
        if not is_bad and first_word_text and first_word_text[0].isupper():
            delta += _START_QUALITY_BONUS_CAPITAL

    breakdown["end_quality_score"] = round(delta, 1)
    return delta, breakdown




def _diversify(
    candidates: list[CandidateScore],
    keep_n: int,
    source_duration_s: float,
) -> list[CandidateScore]:
    """Greedy selection: highest composite first, but skip any candidate
    that overlaps >50% with an already-picked window, or whose midpoint is
    within `effective_radius` of an already-picked window's midpoint, OR
    whose content tokens have Jaccard similarity > `_JACCARD_DEDUP_THRESHOLD`
    with an already-picked window's snippet (Phase 2e bug-followup —
    catches near-duplicate candidates from the same monologue that pass
    the time filters but cover the same topic).

    R-tune-3: `effective_radius` is now proportional to source duration so
    short sources (a 3-min podcast) don't have a 60s exclusion zone that
    swallows half their candidates. Floor at 10s, cap at the original 60s.
    """
    if not candidates:
        return []
    effective_radius = max(10.0, min(DIVERSITY_RADIUS_S, source_duration_s / 5.0))
    sorted_cands = sorted(candidates, key=lambda c: c.score.composite, reverse=True)
    picked: list[CandidateScore] = []
    # Cache content-tokens per picked candidate so we don't re-tokenize on
    # every pairwise comparison. With keep_n=30 and a typical 10-15 tokens
    # per snippet, this is negligible — but the lazy caching keeps the
    # loop body simple and lets us reuse the tokens elsewhere if needed.
    picked_tokens: list[set[str]] = []
    for cand in sorted_cands:
        if len(picked) >= keep_n:
            break
        cm = (cand.source_t_start + cand.source_t_end) / 2.0
        # Skip if overlap > 50% with any pick (would surface the same window
        # twice with slightly different boundaries).
        if any(_overlap_ratio(cand, p) > 0.5 for p in picked):
            continue
        # Mild penalty for closeness — drop if within effective_radius AND
        # already have 5+ picks (early picks can be close; once we've spread,
        # require distance).
        if len(picked) >= 5:
            pm_dists = [abs(((p.source_t_start + p.source_t_end) / 2.0) - cm) for p in picked]
            if any(d < effective_radius for d in pm_dists):
                continue
        # Transcript-similarity dedup. Two candidates from the SAME
        # monologue covering the SAME topic produce ~identical content
        # token sets even when they're minutes apart. The audit case had
        # 3 such cards in the top-10 — this filter catches them.
        cand_tokens = _content_tokens(cand.transcript_snippet)
        if cand_tokens:
            too_similar = any(
                _jaccard(cand_tokens, pt) > _JACCARD_DEDUP_THRESHOLD
                for pt in picked_tokens
            )
            if too_similar:
                continue
        picked.append(cand)
        picked_tokens.append(cand_tokens)
    return picked


def _overlap_ratio(a: CandidateScore, b: CandidateScore) -> float:
    """Symmetric overlap as fraction of shorter window."""
    lo = max(a.source_t_start, b.source_t_start)
    hi = min(a.source_t_end, b.source_t_end)
    if hi <= lo:
        return 0.0
    overlap = hi - lo
    shorter = min(a.source_duration_s, b.source_duration_s) or 1.0
    return overlap / shorter


# Transcript-similarity diversify (Phase 2e bug-followup).
#
# The 2026-05-13 audit flagged that the candidate grid surfaced 3 near-
# duplicate cards all covering the same Sanskrit-numerals monologue — the
# time-overlap filter passed them because they were a few minutes apart,
# but their content overlap was 60-80%. Adding a Jaccard-on-content-tokens
# check filters those out so the user sees topically-distinct picks.
#
# Threshold tuning: 0.40 chosen so that:
#   - shared content ≥ 40% of the union → considered the same topic
#   - shared content < 40% → distinct enough to surface
# Calibration cases:
#   - "raven 10 heads dashanan" vs "dashanan because 10 heads raven" → 100%
#     (same monologue, different window) — dropped ✓
#   - "Sanskrit numerals eka dasha sahasra" vs "Bakhashali manuscript zero
#     invented India" — different topics — kept ✓
_JACCARD_DEDUP_THRESHOLD = 0.40


def _content_tokens(snippet: str) -> set[str]:
    """Lowercased non-stopword tokens for similarity comparison.

    Stripped of punctuation; words ≤2 chars dropped (mostly particles +
    articles + digits already in STOPWORDS — keeping them would over-
    boost similarity on padding tokens). Used by `_diversify` to dedupe
    topical near-duplicates that pass the time-overlap filter.
    """
    if not snippet:
        return set()
    out: set[str] = set()
    for raw in snippet.split():
        tok = raw.strip(",.!?;:\"'()[]…").lower()
        if not tok or len(tok) <= 2 or tok in STOPWORDS:
            continue
        out.add(tok)
    return out


def _jaccard(a: set[str], b: set[str]) -> float:
    """Standard Jaccard index — |A∩B| / |A∪B|. Returns 0 on empty sets."""
    if not a or not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    return inter / union if union else 0.0


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sentence_at(
    transcript: list[dict],
    t: float,
    forward_tolerance_s: float = 1.5,
) -> Optional[dict]:
    """First sentence whose [start, end] covers t. Linear scan — fine for
    inner loop given a typical transcript is 200-800 sentences.

    If no sentence covers t exactly (common when t falls in pre-roll silence
    before the first sentence, or in a pause between sentences), fall forward
    to the nearest sentence that STARTS within `forward_tolerance_s`. Without
    this, a window beginning at t=0 with first sentence at t=0.82 returns
    None, collapsing hook scoring to defaults (F1 bug).
    """
    nearest_forward: Optional[dict] = None
    nearest_gap = forward_tolerance_s + 1.0
    for s in transcript:
        s_start = s.get("start", 0)
        s_end = s.get("end", 0)
        if s_start <= t <= s_end:
            return s
        # Track the closest forward sentence in case nothing covers `t`.
        gap = s_start - t
        if 0 < gap <= forward_tolerance_s and gap < nearest_gap:
            nearest_forward = s
            nearest_gap = gap
    return nearest_forward


def _series_window_avg(series: list[dict], t_start: float, t_end: float) -> float:
    """Average of `v` / `rms` / `hz` over series samples falling in window.
    Returns 0.0 if no samples or all are None/NaN."""
    if not series or t_end <= t_start:
        return 0.0
    total = 0.0
    n = 0
    for sample in series:
        t = sample.get("t", -1)
        if t < t_start:
            continue
        if t > t_end:
            break
        v = sample.get("v", sample.get("rms", sample.get("hz")))
        if v is None:
            continue
        try:
            fv = float(v)
        except (TypeError, ValueError):
            continue
        if math.isnan(fv):
            continue
        total += fv
        n += 1
    return total / n if n else 0.0


def _silence_seconds_in(pauses: list[dict], t_start: float, t_end: float) -> float:
    """Total pause time inside [t_start, t_end] (handles partial overlaps)."""
    if not pauses:
        return 0.0
    total = 0.0
    for p in pauses:
        ps, pe = p.get("start", 0.0), p.get("end", 0.0)
        if pe <= t_start or ps >= t_end:
            continue
        total += min(pe, t_end) - max(ps, t_start)
    return total


def _face_coverage_fraction(
    face_segments: list[dict], t_start: float, t_end: float,
) -> float:
    """Fraction of [t_start, t_end] that has at least one face_segment.

    Handles overlapping segments by merging before measuring (avoids
    double-counting a stretch where two detections overlap)."""
    duration = max(0.001, t_end - t_start)
    if not face_segments:
        return 0.0
    intervals: list[tuple[float, float]] = []
    for seg in face_segments:
        ss = float(seg.get("t_start", 0.0))
        se = float(seg.get("t_end", 0.0))
        if se <= t_start or ss >= t_end:
            continue
        intervals.append((max(ss, t_start), min(se, t_end)))
    if not intervals:
        return 0.0
    intervals.sort()
    merged_total = 0.0
    cur_s, cur_e = intervals[0]
    for s, e in intervals[1:]:
        if s <= cur_e:
            cur_e = max(cur_e, e)
        else:
            merged_total += cur_e - cur_s
            cur_s, cur_e = s, e
    merged_total += cur_e - cur_s
    return merged_total / duration


def _count_words_in_window(transcript: list[dict], t_start: float, t_end: float) -> int:
    n = 0
    for s in transcript:
        if s.get("end", 0) < t_start or s.get("start", 0) > t_end:
            continue
        # Walk words list if present; otherwise approximate via text.
        words = s.get("words") or []
        if words:
            for w in words:
                ws, we = w.get("start", 0.0), w.get("end", 0.0)
                if ws >= t_start and we <= t_end:
                    n += 1
        else:
            txt = s.get("text") or ""
            n += len(re.findall(r"[A-Za-z']+", txt))
    return n


def _text_in_range(transcript: list[dict], t_start: float, t_end: float) -> str:
    parts: list[str] = []
    for s in transcript:
        if s.get("end", 0) < t_start or s.get("start", 0) > t_end:
            continue
        parts.append(s.get("text") or "")
    return " ".join(parts)


def _count_speaker_moves(t_start: float, t_end: float, face_segments: list[dict]) -> int:
    """Count actual speaker MOVES within the window, not segments touched.

    The indexer's `cluster_into_segments` breaks segments when face center
    moves >12% of canvas distance OR for unrelated reasons (brief detection
    gaps, lighting changes). A window touching 3 segments doesn't necessarily
    mean the speaker moved 3 times — they might have stayed put with the
    indexer just re-segmenting on noise (F2 bug).

    True signal: consecutive segments whose bbox centers actually differ by
    a meaningful displacement. Threshold mirrors the indexer's own SEGMENT_
    BREAK_DIST (12% canvas distance) but with hysteresis — re-counts only on
    a 10% jump, not the threshold itself, to avoid edge cases.
    """
    MOVE_THRESHOLD = 0.10  # 10% canvas distance counts as a real move.

    touching = [
        seg for seg in face_segments
        if not (seg.get("t_end", 0.0) <= t_start or seg.get("t_start", 0.0) >= t_end)
    ]
    if len(touching) <= 1:
        return 0

    # Order by t_start so we can step through consecutive segments.
    touching.sort(key=lambda s: s.get("t_start", 0.0))

    moves = 0
    prev_center: Optional[tuple[float, float]] = None
    for seg in touching:
        bbox = seg.get("bbox_norm") or [0.0, 0.0, 0.0, 0.0]
        if len(bbox) < 4:
            continue
        cx = bbox[0] + bbox[2] / 2.0
        cy = bbox[1] + bbox[3] / 2.0
        if prev_center is not None:
            dx = cx - prev_center[0]
            dy = cy - prev_center[1]
            displacement = math.hypot(dx, dy)
            if displacement >= MOVE_THRESHOLD:
                moves += 1
        prev_center = (cx, cy)
    return moves


def _overlaps_any(
    t_start: float,
    t_end: float,
    ranges: Sequence[Tuple[float, float]],
) -> bool:
    for rs, re_ in ranges:
        if re_ <= t_start or rs >= t_end:
            continue
        return True
    return False


# Leading-token cleanup for candidate snippet previews (Phase 2e bug-followup).
# The 2026-05-13 audit surfaced candidate snippets like "a there was a
# person you know..." — readable content buried under low-info openers.
# We strip a CONSERVATIVE whitelist from the start of the snippet's first
# sentence: articles, discourse markers, conjunctions, Whisper fillers.
# We do NOT strip mid-sentence verbs ("was", "used", "had") — those carry
# semantic content and stripping them would mislead the user about what
# the window actually contains. The underlying source window is
# unchanged; this is purely a display tweak in the snippet preview.
_SNIPPET_LEADING_DROP = {
    # Discourse markers / fillers
    "so", "now", "well", "actually", "literally", "basically",
    "anyway", "like", "yeah", "yep", "right", "okay", "ok", "alright",
    # Conjunctions that often start a clipped fragment
    "and", "but", "or",
    # Articles
    "a", "an", "the",
    # Whisper transcription fillers
    "um", "uh", "uhh", "umm", "hmm", "ah", "ahh", "er", "erm",
}

# Cap on how many leading tokens we'll strip. With more we'd risk eating
# the actual content; if the first 4 tokens are all fillers the window
# is degenerate and the user should see the messy snippet as a signal.
_SNIPPET_MAX_LEADING_DROPS = 4

# Minimum snippet length AFTER stripping. If stripping would shrink the
# snippet below this, we bail and return the original — better a long
# messy snippet than a 3-word fragment.
_SNIPPET_MIN_LENGTH_AFTER_STRIP = 20


def _strip_leading_filler(text: str) -> str:
    """Drop leading fillers / articles / discourse markers from a snippet.

    The window the scorer picked stays the same — only the displayed
    snippet text changes. Capitalizes the new first character so the
    cleaned snippet reads as a sentence opener.

    Bails out (returns original) if stripping would leave a fragment
    under _SNIPPET_MIN_LENGTH_AFTER_STRIP — that signals the window
    really is mostly filler and the messy preview is a useful warning.
    """
    if not text or len(text) < _SNIPPET_MIN_LENGTH_AFTER_STRIP:
        return text
    tokens = text.split()
    dropped = 0
    while tokens and dropped < _SNIPPET_MAX_LEADING_DROPS:
        candidate = tokens[0].strip(",.!?;:\"'()[]").lower()
        if not candidate or candidate in _SNIPPET_LEADING_DROP:
            tokens = tokens[1:]
            dropped += 1
        else:
            break
    if dropped == 0:
        return text  # nothing to strip
    rebuilt = " ".join(tokens)
    if len(rebuilt) < _SNIPPET_MIN_LENGTH_AFTER_STRIP:
        return text  # stripping gutted it; revert to original
    # Capitalize the new lead character so the snippet looks sentence-like.
    if rebuilt and rebuilt[0].islower():
        rebuilt = rebuilt[0].upper() + rebuilt[1:]
    return rebuilt


def _build_snippet(t_start: float, t_end: float, transcript: list[dict]) -> str:
    """First sentence + … + last sentence of the window, capped at 140 chars.

    Always returns a usable string even if transcript is empty or window
    falls in a silent stretch — FE shows the timestamp range as fallback.

    Only includes sentences with at least one WORD inside the window. A
    sentence-level overlap check alone (`s.start <= t_end AND s.end >= t_start`)
    pulls in sentences that merely touch the window's edges — e.g. a sentence
    whose start equals t_end has zero word content in the window, and a
    sentence that only catches the window's first ~0.2s likely has all but
    its last word outside. Both produce misleading snippets that disagree
    with the words /preview's `_extract_window_words` extracts for the
    same window. Word-level filtering keeps the two in sync.
    """
    inside: list[dict] = []
    for s in transcript:
        if s.get("end", 0) < t_start or s.get("start", 1e9) > t_end:
            continue
        # Require at least one word with non-trivial overlap. A sentence at
        # start=t_end has all its words at t_end-or-later → strict `<` excludes
        # it; a sentence at end=t_start has all its words at t_start-or-earlier
        # → strict `>` excludes it.
        words = s.get("words") or []
        has_inside_word = any(
            float(w.get("end", 0.0) or 0.0) > t_start
            and float(w.get("start", 0.0) or 0.0) < t_end
            for w in words
        )
        if not has_inside_word:
            continue
        inside.append(s)
    if not inside:
        return ""
    if len(inside) == 1:
        text = (inside[0].get("text") or "").strip()
    else:
        first = (inside[0].get("text") or "").strip()
        last = (inside[-1].get("text") or "").strip()
        # Clean leading filler from BOTH the first sentence and the last
        # sentence (Phase 2e fix) — the snippet shows "first … last" and
        # both halves benefit from a clean opener.
        first = _strip_leading_filler(first)
        last = _strip_leading_filler(last)
        text = f"{first} … {last}"
    # Single-sentence case: clean leading filler too.
    if len(inside) == 1:
        text = _strip_leading_filler(text)
    if len(text) > 140:
        text = text[:137] + "…"
    return text


def _sigmoid(x: float) -> float:
    """Standard logistic. Used to squish z-scores into a 0-1 band."""
    # Clamp to avoid math.exp overflow on huge z's.
    x = max(-30.0, min(30.0, x))
    return 1.0 / (1.0 + math.exp(-x))
