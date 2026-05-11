"""
Host-run planner — transforms a Director shot plan into a list of host runs.

A "host run" is a maximal contiguous span of shots where:
  - host_present is True
  - host_layout is constant

Each run is split into ≤cap-second segments at sentence/clause/silence/word
boundaries (the cascade in §Qa) so each segment fits the active fal model's
audio cap. Within a run, ONE Seedream image is rendered (not per-shot) and
ONE fal call is issued PER SEGMENT — segment MP4s are then ffmpeg-concat'd
into a continuous run MP4 and split back to per-shot MP4s using each shot's
audio offset.

This module is intentionally I/O-free: no subprocess, no S3, no fal calls.
It takes pure data in, returns pure data out. The renderer
(`automation_pipeline._render_host_runs`) consumes the plan.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple


# ---------------------------------------------------------------------------
# Sentinels for the boundary cascade
# ---------------------------------------------------------------------------
# Window radius for each priority tier (Qa cascade): we look around the cap
# target for a boundary of the right kind, expanding the window only after
# the previous tier yields nothing.
_WINDOW_SENTENCE_S = 5.0
_WINDOW_CLAUSE_S = 2.0
_WINDOW_SILENCE_S = 2.0

# Silence-gap thresholds. The ≥0.7s threshold for "sentence end" matches the
# rough gap a narrator leaves between sentences in conversational TTS; ≥0.3s
# captures clause/breath breaks; ≥0.25s is the floor below which we stop
# treating a gap as meaningful.
_SILENCE_SENTENCE_S = 0.7
_SILENCE_CLAUSE_S = 0.3
_SILENCE_FLOOR_S = 0.25

# Punctuation classes — used when the word objects happen to retain trailing
# punctuation (some TTS aligners preserve it; the Whisper aligner in
# parse_timestamps.py strips it). When stripped, we fall back to silence-gap
# detection alone.
_SENTENCE_END_RE = re.compile(r"[.!?]$")
_CLAUSE_END_RE = re.compile(r"[,;:—–\-]$")


# ---------------------------------------------------------------------------
# Data shapes
# ---------------------------------------------------------------------------

@dataclass
class HostSegment:
    """One ≤cap-second slice of a run's audio. Becomes one fal call.

    Boundaries refer to absolute timeline seconds in the master TTS MP3.
    """
    segment_index: int                       # 0-based within the run
    audio_start_s: float
    audio_end_s: float
    # Shots whose [start_time, end_time] window is fully inside this segment.
    # When a shot spans a segment boundary (rare — the planner tries to align
    # boundaries to shot edges) it is assigned to whichever segment contains
    # most of its duration.
    shot_indices_covered: List[int] = field(default_factory=list)
    # Per-shot offset (relative to segment start) — used to ffmpeg-split the
    # rendered segment MP4 back to per-shot MP4 files.
    shot_offsets_in_segment: List[Tuple[int, float, float]] = field(default_factory=list)
    # Boundary tier that produced the END of this segment. For telemetry —
    # so we can see in run logs whether we hit good sentence boundaries or
    # had to fall back to word-edges.
    boundary_tier: str = "shot_edge"   # one of: "shot_edge" | "sentence" | "clause" | "silence" | "word"

    @property
    def duration_s(self) -> float:
        return max(0.0, self.audio_end_s - self.audio_start_s)


@dataclass
class HostRun:
    """A maximal contiguous host span sharing one layout.

    All shots in a run share a single Seedream image. Each segment within
    the run becomes one fal.ai call; segments are concatenated into the
    run MP4 and then split back per shot.
    """
    run_index: int
    layout: str                              # "centered" | "free_left" | "free_right" | "free_top" | "free_bottom"
    shot_indices: List[int]                  # contiguous, in shot-plan order
    audio_start_s: float
    audio_end_s: float
    segments: List[HostSegment] = field(default_factory=list)

    @property
    def total_duration_s(self) -> float:
        return max(0.0, self.audio_end_s - self.audio_start_s)


# ---------------------------------------------------------------------------
# Boundary detection (cascade Qa)
# ---------------------------------------------------------------------------

def _word_punct(word_text: str) -> str:
    """Return 'sentence' | 'clause' | '' for trailing punctuation on a word.

    Robust to whitespace and quoting around the punctuation char.
    """
    if not word_text:
        return ""
    s = word_text.rstrip()
    # strip trailing quote/bracket so 'world."' still counts as sentence-end
    s = s.rstrip('"”\')]}')
    if not s:
        return ""
    if _SENTENCE_END_RE.search(s):
        return "sentence"
    if _CLAUSE_END_RE.search(s):
        return "clause"
    return ""


def _windowed_words(
    words: List[Dict[str, Any]],
    target_s: float,
    radius_s: float,
    *,
    min_s: float,
    max_s: float,
) -> List[Tuple[int, Dict[str, Any]]]:
    """Words whose `end` time lies within [target-radius, target+radius] AND
    inside the run's [min_s, max_s] window. Returns enumerated tuples so
    callers can also see neighbours via index.

    Sorted by absolute distance from target — first match is closest.
    """
    lo = max(min_s, target_s - radius_s)
    hi = min(max_s, target_s + radius_s)
    candidates: List[Tuple[int, Dict[str, Any], float]] = []
    for i, w in enumerate(words):
        try:
            end = float(w.get("end", 0.0))
        except (TypeError, ValueError):
            continue
        if lo <= end <= hi:
            candidates.append((i, w, abs(end - target_s)))
    candidates.sort(key=lambda t: t[2])
    return [(i, w) for (i, w, _) in candidates]


def _find_split_point(
    words: List[Dict[str, Any]],
    target_s: float,
    *,
    run_start_s: float,
    run_end_s: float,
) -> Tuple[float, str]:
    """Resolve a single split point near `target_s` using the Qa cascade.

    Returns (split_time_s, tier) where tier ∈
    {"sentence","clause","silence","word"}. Falls back to the target itself
    (tier="word") if no word lies within any window — caller should treat
    that as best-effort.
    """
    if not words:
        return target_s, "word"

    # Tier 1 — sentence end within ±5s
    cands = _windowed_words(
        words, target_s, _WINDOW_SENTENCE_S, min_s=run_start_s, max_s=run_end_s
    )
    for i, w in cands:
        if _word_punct(str(w.get("word", ""))) == "sentence":
            return float(w.get("end", target_s)), "sentence"
        # Or: this word's END is followed by a long silence gap before next word
        if i + 1 < len(words):
            nxt = words[i + 1]
            try:
                gap = float(nxt.get("start", 0.0)) - float(w.get("end", 0.0))
            except (TypeError, ValueError):
                gap = 0.0
            if gap >= _SILENCE_SENTENCE_S:
                return float(w.get("end", target_s)), "sentence"

    # Tier 2 — clause break within ±2s
    cands = _windowed_words(
        words, target_s, _WINDOW_CLAUSE_S, min_s=run_start_s, max_s=run_end_s
    )
    for i, w in cands:
        punct = _word_punct(str(w.get("word", "")))
        if punct == "clause":
            return float(w.get("end", target_s)), "clause"
        if i + 1 < len(words):
            nxt = words[i + 1]
            try:
                gap = float(nxt.get("start", 0.0)) - float(w.get("end", 0.0))
            except (TypeError, ValueError):
                gap = 0.0
            if _SILENCE_CLAUSE_S <= gap < _SILENCE_SENTENCE_S:
                return float(w.get("end", target_s)), "clause"

    # Tier 3 — any silence gap ≥ floor within ±2s
    cands = _windowed_words(
        words, target_s, _WINDOW_SILENCE_S, min_s=run_start_s, max_s=run_end_s
    )
    for i, w in cands:
        if i + 1 < len(words):
            nxt = words[i + 1]
            try:
                gap = float(nxt.get("start", 0.0)) - float(w.get("end", 0.0))
            except (TypeError, ValueError):
                gap = 0.0
            if gap >= _SILENCE_FLOOR_S:
                return float(w.get("end", target_s)), "silence"

    # Tier 4 — word boundary nearest the target (unbounded radius — last resort)
    nearest = None
    nearest_d = float("inf")
    for w in words:
        try:
            end = float(w.get("end", 0.0))
        except (TypeError, ValueError):
            continue
        if end < run_start_s or end > run_end_s:
            continue
        d = abs(end - target_s)
        if d < nearest_d:
            nearest_d = d
            nearest = end
    if nearest is not None:
        return float(nearest), "word"
    return target_s, "word"


# ---------------------------------------------------------------------------
# Public API — group shots into runs, then split runs into segments
# ---------------------------------------------------------------------------

def _group_into_runs(shots: List[Dict[str, Any]]) -> List[Tuple[int, List[int], str, float, float]]:
    """Walk shots, emit (run_index, shot_indices, layout, start_s, end_s) tuples.

    A run breaks when:
      - host_present flips False
      - host_layout changes
    """
    out: List[Tuple[int, List[int], str, float, float]] = []
    current: Optional[List[Any]] = None  # [indices, layout, start_s, end_s]

    for idx, s in enumerate(shots):
        if not s.get("host_present"):
            if current is not None:
                out.append((len(out), current[0], current[1], current[2], current[3]))
                current = None
            continue
        layout = (s.get("host_layout") or "centered").strip() or "centered"
        try:
            st = float(s.get("start_time", 0.0))
            en = float(s.get("end_time", st))
        except (TypeError, ValueError):
            st = 0.0
            en = 0.0

        if current is None:
            current = [[idx], layout, st, en]
        elif current[1] != layout:
            # Layout change — close current run, start a new one.
            out.append((len(out), current[0], current[1], current[2], current[3]))
            current = [[idx], layout, st, en]
        else:
            current[0].append(idx)
            current[3] = max(current[3], en)

    if current is not None:
        out.append((len(out), current[0], current[1], current[2], current[3]))
    return out


def _split_run_into_segments(
    *,
    shot_indices: List[int],
    shots: List[Dict[str, Any]],
    run_start_s: float,
    run_end_s: float,
    audio_cap_s: float,
    words: List[Dict[str, Any]],
) -> List[HostSegment]:
    """Split a run's audio span into ≤cap segments using the Qa cascade.

    If the run already fits inside cap, returns a single segment. Otherwise
    we walk forward in cap-sized strides, resolving each split point via
    `_find_split_point` so segments end on natural boundaries.
    """
    duration = run_end_s - run_start_s
    if audio_cap_s <= 0 or duration <= audio_cap_s:
        seg = HostSegment(
            segment_index=0,
            audio_start_s=run_start_s,
            audio_end_s=run_end_s,
            boundary_tier="shot_edge",
        )
        _assign_shots_to_segment(seg, shot_indices, shots)
        return [seg]

    # Pre-compute shot boundary times within this run — used to snap split
    # points so we don't split mid-shot (which truncates the per-shot avatar
    # by up to ~50% of its duration). Tested at audit time on a 100%-mode
    # 4.5min video: without this snap, 11% of shots in long runs lost
    # 0.5-2.1s of host video each.
    _shot_boundaries: List[float] = []
    for idx in shot_indices:
        if idx < len(shots):
            try:
                _shot_boundaries.append(float(shots[idx].get("end_time", 0.0)))
            except (TypeError, ValueError):
                pass

    segments: List[HostSegment] = []
    cursor = run_start_s
    seg_idx = 0
    # Reserve a small tail margin so the FINAL segment doesn't end at exactly
    # cap (some encoders round up by 0.1-0.3s). The model cap already has a
    # 2s safety margin baked in via fal_avatar_client.get_audio_cap_s, so
    # this is belt-and-braces.
    while True:
        remaining = run_end_s - cursor
        if remaining <= audio_cap_s:
            seg = HostSegment(
                segment_index=seg_idx,
                audio_start_s=cursor,
                audio_end_s=run_end_s,
                boundary_tier="shot_edge",
            )
            _assign_shots_to_segment(seg, shot_indices, shots)
            segments.append(seg)
            break

        target = cursor + audio_cap_s
        split_s, tier = _find_split_point(
            words,
            target,
            run_start_s=cursor,
            run_end_s=run_end_s,
        )
        # Guardrails — never split before cursor; never produce a sub-2s seg
        # (fal models hate tiny clips). If the cascade picks something silly,
        # fall back to the cap target itself.
        if split_s <= cursor + 2.0 or split_s >= run_end_s - 0.5:
            split_s = target
            tier = "word"
        # And never exceed cap.
        if split_s - cursor > audio_cap_s:
            split_s = cursor + audio_cap_s
            tier = "word"

        # Shot-boundary snap — applied AFTER guardrails so we snap from the
        # FINAL post-clamp split point. Prefer landing on a shot edge within
        # ±2s. Avoids truncating the per-shot avatar MP4 at the split-back
        # stage (without this, a shot with <50% in this seg gets dropped by
        # `_assign_shots_to_segment`'s 50% threshold and loses up to ~50%
        # of its duration). Bounded so it never exceeds cap.
        if _shot_boundaries:
            _snap_radius = 2.0
            _candidates = [
                b for b in _shot_boundaries
                if cursor + 2.0 < b <= cursor + audio_cap_s
                and abs(b - split_s) <= _snap_radius
            ]
            if _candidates:
                _best = min(_candidates, key=lambda b: abs(b - split_s))
                split_s = _best
                tier = "shot_edge"

        seg = HostSegment(
            segment_index=seg_idx,
            audio_start_s=cursor,
            audio_end_s=split_s,
            boundary_tier=tier,
        )
        _assign_shots_to_segment(seg, shot_indices, shots)
        segments.append(seg)
        cursor = split_s
        seg_idx += 1
        # Safety: forward progress is mandatory.
        if seg_idx > 256:
            raise RuntimeError(
                f"host run segmentation exceeded 256 segments — bug in cascade "
                f"(run {run_start_s:.1f}-{run_end_s:.1f}s, cap {audio_cap_s:.1f}s)"
            )

    return segments


def _assign_shots_to_segment(
    seg: HostSegment,
    shot_indices: List[int],
    shots: List[Dict[str, Any]],
) -> None:
    """Populate seg.shot_indices_covered + seg.shot_offsets_in_segment.

    A shot belongs to the segment whose [audio_start_s, audio_end_s] window
    contains the majority of the shot's [start_time, end_time]. Mid-shot
    splits are not produced by `_split_run_into_segments` (the cascade tries
    to land on shot edges — see Qa) but if one happens, the shot lands in
    whichever segment holds more of its mass.
    """
    seg_lo, seg_hi = seg.audio_start_s, seg.audio_end_s
    for idx in shot_indices:
        if idx >= len(shots):
            continue
        s = shots[idx]
        try:
            shot_lo = float(s.get("start_time", 0.0))
            shot_hi = float(s.get("end_time", shot_lo))
        except (TypeError, ValueError):
            continue
        # Overlap fraction of the shot inside this segment.
        overlap = max(0.0, min(seg_hi, shot_hi) - max(seg_lo, shot_lo))
        shot_dur = max(1e-6, shot_hi - shot_lo)
        if overlap / shot_dur >= 0.5:
            seg.shot_indices_covered.append(idx)
            # Offset of this shot's audio within the segment's audio.
            offset_in_seg = max(0.0, shot_lo - seg_lo)
            length_in_seg = min(seg_hi, shot_hi) - max(seg_lo, shot_lo)
            seg.shot_offsets_in_segment.append((idx, offset_in_seg, length_in_seg))


def plan_host_runs(
    *,
    shots: List[Dict[str, Any]],
    audio_cap_s: float,
    words: Optional[List[Dict[str, Any]]] = None,
) -> List[HostRun]:
    """Top-level entry — group host_present shots into runs, then segment.

    Args:
        shots: Director's `shots[]` list (mutates nothing).
        audio_cap_s: Effective per-segment cap. Pass
            `fal_avatar_client.get_audio_cap_s(model_id)` from the caller.
            0.0 means "no cap" — all runs become single-segment regardless
            of duration (use only when the model has no documented limit).
        words: Whisper word timestamps from `narration.words.json` —
            optional. When provided, segment splits land on sentence/
            clause/silence boundaries via the Qa cascade. When absent,
            segments split at word-target offsets only.

    Returns: List[HostRun] in shot-order.
    """
    grouped = _group_into_runs(shots or [])
    runs: List[HostRun] = []
    safe_words = words or []
    for run_idx, shot_indices, layout, start_s, end_s in grouped:
        segments = _split_run_into_segments(
            shot_indices=shot_indices,
            shots=shots,
            run_start_s=start_s,
            run_end_s=end_s,
            audio_cap_s=audio_cap_s,
            words=safe_words,
        )
        runs.append(
            HostRun(
                run_index=run_idx,
                layout=layout,
                shot_indices=shot_indices,
                audio_start_s=start_s,
                audio_end_s=end_s,
                segments=segments,
            )
        )
    return runs
