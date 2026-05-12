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
from dataclasses import dataclass, field
from typing import Optional, Sequence, Tuple

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Constants — research-anchored where possible (§12.2)
# ---------------------------------------------------------------------------

# Axis weights for composite (geometric mean). Hook is highest per research
# (3s gate is the kill switch — TTS Vibes / Socialync data).
AXIS_WEIGHTS = {"hook": 0.40, "pacing": 0.25, "info": 0.20, "loop": 0.15}

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

# Diversity penalty: windows within this many seconds of an already-top-ranked
# window get a recency penalty so the top-N spreads across the source.
DIVERSITY_RADIUS_S = 60.0


# ---------------------------------------------------------------------------
# Internal types (dataclasses — lighter than Pydantic in inner loop)
# ---------------------------------------------------------------------------

@dataclass
class ScoreVec:
    """One window's 4-axis score + composite + a breakdown payload."""
    hook: float
    pacing: float
    info: float
    loop: float
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
    sentence_starts = [s.get("start", 0.0) for s in transcript]
    sentence_ends = [s.get("end", 0.0) for s in transcript]
    energy_series = prosody.get("energy_series") or []   # [{t, rms or v}]
    pitch_series = prosody.get("pitch_series") or []     # [{t, hz or v}]
    pauses = prosody.get("pauses") or []                  # [{start, end, duration_s}]
    mean_rms = float(prosody.get("mean_rms") or 0.0) or 0.001

    # Source-level emphasis baseline — used by pacing axis as a relative
    # ratio rather than absolute thresholds (R-tune-1). Floor at 0.05/s so
    # silent/sparse sources don't divide-by-near-zero.
    source_emphasis_density = max(0.05, len(emphasis) / max(1.0, duration_s))

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

        # Compute axes.
        breakdown: dict = {}
        hook = _score_hook(
            win_start, win_end, transcript, energy_series, pitch_series,
            mean_rms, breakdown,
        )
        pacing, predicted_duration, cut_pct = _score_pacing(
            win_start, win_end, transcript, emphasis, pauses, scenes,
            target, tol, source_emphasis_density, breakdown,
        )
        # Hard reject: too much word surgery needed.
        if cut_pct > MAX_WORD_CUT_PCT:
            t += WINDOW_STRIDE_S
            continue

        # User-pinned ranges bypass the speaker_moves rejection (F4) — if the
        # caller explicitly said "include this timestamp", we honor the pin
        # even if framing isn't perfect. They can fix framing in the editor.
        is_pinned = bool(request.must_include_ranges) and _overlaps_any(
            win_start, win_end, request.must_include_ranges
        )
        speaker_moves = _count_speaker_moves(win_start, win_end, face_segments)
        breakdown["speaker_moves_in_window"] = speaker_moves
        if speaker_moves > MAX_SPEAKER_MOVES and not is_pinned:
            t += WINDOW_STRIDE_S
            continue

        info = _score_info(win_start, win_end, transcript, request.topic_keywords, breakdown)
        loop = _score_loop(
            win_start, win_end, transcript, energy_series, pitch_series, breakdown,
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
            t += WINDOW_STRIDE_S
            continue

        composite = _composite(hook, pacing, info, loop)
        score = ScoreVec(
            hook=hook, pacing=pacing, info=info, loop=loop, composite=composite,
            breakdown=breakdown,
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

    if not candidates:
        return []

    # Diversity: penalize windows clustered near already-top picks. Greedy.
    ranked = _diversify(candidates, request.scan_limit, duration_s)
    for i, c in enumerate(ranked, start=1):
        c.rank = i
    return ranked


# ---------------------------------------------------------------------------
# Window boundary snapping
# ---------------------------------------------------------------------------

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
    """Snap window edges to nearest sentence boundary within 200ms tolerance.

    If snapping pushes width outside [win_min, win_max], we extend the end
    to the next sentence end to bring duration back into range.
    """
    if not transcript:
        return (raw_start, min(duration_s, raw_end))

    # Snap start: move forward to nearest sentence start within 0.5s, else
    # keep raw_start (we allow mid-word starts in pathological cases — the
    # word-cut planner can clean them up later).
    new_start = raw_start
    for s_start in sentence_starts:
        if s_start > raw_start + 0.5:
            break
        if abs(s_start - raw_start) <= 0.5:
            new_start = s_start
            break

    # Snap end: move forward to nearest sentence end within 1.0s.
    new_end = raw_end
    for s_end in sentence_ends:
        if s_end < raw_end - 1.0:
            continue
        if s_end > raw_end + 1.0:
            break
        new_end = s_end
        break

    # If duration is now under win_min, grow to the next sentence end.
    if new_end - new_start < win_min:
        for s_end in sentence_ends:
            if s_end <= new_end:
                continue
            if s_end - new_start >= win_min:
                new_end = s_end
                break
        else:
            # Couldn't extend — abandon.
            return (None, None)

    # If duration overshoots win_max, shrink to a closer sentence end.
    if new_end - new_start > win_max:
        for s_end in reversed(sentence_ends):
            if s_end >= new_end:
                continue
            if new_end - s_end <= 0 or s_end - new_start <= 0:
                continue
            if s_end - new_start <= win_max and s_end - new_start >= win_min:
                new_end = s_end
                break

    new_end = min(new_end, duration_s)
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
    breakdown: dict,
) -> float:
    """Information density: unique content words/s + numeric tokens + keyword
    matches − repetition penalty."""
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

    # 1.5-3.0 unique content words/s is a comfortable density.
    if rate >= 3.0:
        density_score = 100.0
    elif rate >= 1.5:
        density_score = 70.0 + (rate - 1.5) * 20.0
    elif rate >= 0.7:
        density_score = 40.0 + (rate - 0.7) * 37.5
    else:
        density_score = max(0.0, 40.0 * rate / 0.7)

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
        from collections import Counter
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
# Compose + diversity
# ---------------------------------------------------------------------------

def _composite(hook: float, pacing: float, info: float, loop: float) -> float:
    """Weighted geometric mean. Each axis floor of 1.0 to keep the product
    nonzero — otherwise a single 0 axis nukes the score for purely numeric
    reasons rather than reflecting the user-facing penalty we want."""
    h = max(1.0, hook)
    p = max(1.0, pacing)
    i = max(1.0, info)
    l = max(1.0, loop)
    log_sum = (
        AXIS_WEIGHTS["hook"] * math.log(h)
        + AXIS_WEIGHTS["pacing"] * math.log(p)
        + AXIS_WEIGHTS["info"] * math.log(i)
        + AXIS_WEIGHTS["loop"] * math.log(l)
    )
    return max(0.0, min(100.0, math.exp(log_sum)))


def _diversify(
    candidates: list[CandidateScore],
    keep_n: int,
    source_duration_s: float,
) -> list[CandidateScore]:
    """Greedy selection: highest composite first, but skip any candidate
    that overlaps >50% with an already-picked window, or whose midpoint is
    within `effective_radius` of an already-picked window's midpoint.

    R-tune-3: `effective_radius` is now proportional to source duration so
    short sources (a 3-min podcast) don't have a 60s exclusion zone that
    swallows half their candidates. Floor at 10s, cap at the original 60s.
    """
    if not candidates:
        return []
    effective_radius = max(10.0, min(DIVERSITY_RADIUS_S, source_duration_s / 5.0))
    sorted_cands = sorted(candidates, key=lambda c: c.score.composite, reverse=True)
    picked: list[CandidateScore] = []
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
        picked.append(cand)
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
        text = f"{first} … {last}"
    if len(text) > 140:
        text = text[:137] + "…"
    return text


def _sigmoid(x: float) -> float:
    """Standard logistic. Used to squish z-scores into a 0-1 band."""
    # Clamp to avoid math.exp overflow on huge z's.
    x = max(-30.0, min(30.0, x))
    return 1.0 / (1.0 + math.exp(-x))
