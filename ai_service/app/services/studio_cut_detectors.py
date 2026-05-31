"""
Deterministic cut detectors for the Studio Cuts wizard step.

Pure functions over already-fetched video contexts + the confirmed-arrangement
segments. NO LLM — these run server-side from the indexer's prosody.pauses and
word-level transcript. Each returns a list of cut-span dicts:
    {handle, t_start, t_end, kind, ...}
in SOURCE-asset seconds (same coordinate space as pick_segments).

`detect_silences` uses prosody.pauses (filtered by a min-duration that scales
with the project's cut aggressiveness). `detect_fillers` scans transcript words
for disfluencies. Both restrict detection to the kept arrangement ranges so we
never suggest cutting footage that isn't even in the video.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Sequence, Tuple

logger = logging.getLogger(__name__)

# Min-silence threshold (seconds) by cut aggressiveness. Lighter = only cut
# obvious dead air; aggressive = trim shorter beats too.
SILENCE_MIN_BY_AGGRESSIVENESS = {
    "light": 2.0,
    "medium": 1.0,
    "aggressive": 0.6,
}
_DEFAULT_SILENCE_MIN_S = 1.0

# Disfluency tokens. Multi-word phrases are matched on the joined word stream.
_FILLER_WORDS = {
    "um", "uh", "er", "erm", "ah", "uhh", "umm", "hmm", "mm",
    "like", "basically", "actually", "literally", "honestly",
    "right", "okay", "ok", "so", "well", "anyway",
}
_FILLER_PHRASES = (
    ("you", "know"),
    ("i", "mean"),
    ("sort", "of"),
    ("kind", "of"),
    ("you", "see"),
)

# A filler match is only worth cutting if it's a standalone beat — we require
# a small gap around it OR it being a known interjection. To keep P3 simple +
# safe we only cut the single-word interjections that are almost always
# disfluencies; softer words ("like","so","right") are cut only when the
# aggressiveness is high.
_ALWAYS_FILLER = {"um", "uh", "er", "erm", "ah", "uhh", "umm", "hmm", "mm", "erm"}


def _norm(word: str) -> str:
    return "".join(c for c in word.lower() if c.isalpha())


def _segments_for_handle(
    segments: Sequence[Dict[str, Any]],
    handle: str,
) -> List[Tuple[float, float]]:
    """Kept [t_start, t_end] ranges for one asset. Empty list → no constraint
    (caller treats as 'whole video')."""
    out: List[Tuple[float, float]] = []
    for s in segments:
        if s.get("handle") != handle:
            continue
        try:
            ts = float(s.get("t_start"))
            te = float(s.get("t_end"))
        except (TypeError, ValueError):
            continue
        if te > ts:
            out.append((ts, te))
    return out


def _in_any(t_start: float, t_end: float, ranges: List[Tuple[float, float]]) -> bool:
    """True if [t_start,t_end] overlaps any kept range (or no ranges given)."""
    if not ranges:
        return True
    return any(t_end > rs and t_start < re for rs, re in ranges)


def detect_silences(
    segments: Sequence[Dict[str, Any]],
    raw_contexts: Dict[str, dict],
    *,
    min_silence_s: float = _DEFAULT_SILENCE_MIN_S,
) -> List[Dict[str, Any]]:
    """Find pauses ≥ min_silence_s inside the kept ranges of each video."""
    cuts: List[Dict[str, Any]] = []
    for handle, ctx in raw_contexts.items():
        prosody = (ctx or {}).get("prosody") or {}
        pauses = prosody.get("pauses")
        if not isinstance(pauses, list):
            continue
        kept = _segments_for_handle(segments, handle)
        for p in pauses:
            if not isinstance(p, dict):
                continue
            try:
                ps = float(p.get("start"))
                pe = float(p.get("end"))
            except (TypeError, ValueError):
                continue
            dur = pe - ps
            if dur < min_silence_s or pe <= ps:
                continue
            if not _in_any(ps, pe, kept):
                continue
            cuts.append({
                "handle": handle,
                "t_start": round(ps, 2),
                "t_end": round(pe, 2),
                "kind": "silence",
                "duration_s": round(dur, 2),
            })
    cuts.sort(key=lambda c: (c["handle"], c["t_start"]))
    return cuts


def detect_fillers(
    segments: Sequence[Dict[str, Any]],
    raw_contexts: Dict[str, dict],
    *,
    aggressive: bool = False,
) -> List[Dict[str, Any]]:
    """Scan word-level transcript for filler words inside the kept ranges.

    Conservative by default: only always-filler interjections (um/uh/…) are
    cut. With `aggressive`, the softer set + phrases are included too.
    """
    cuts: List[Dict[str, Any]] = []
    soft_set = _FILLER_WORDS if aggressive else _ALWAYS_FILLER
    for handle, ctx in raw_contexts.items():
        transcript = (ctx or {}).get("transcript")
        if not isinstance(transcript, list):
            continue
        kept = _segments_for_handle(segments, handle)

        # Flatten words across sentences for phrase matching.
        words: List[dict] = []
        for sent in transcript:
            for w in (sent or {}).get("words", []) or []:
                if isinstance(w, dict) and "start" in w and "end" in w:
                    words.append(w)

        n = len(words)
        i = 0
        while i < n:
            w = words[i]
            try:
                ws = float(w.get("start"))
                we = float(w.get("end"))
            except (TypeError, ValueError):
                i += 1
                continue
            token = _norm(str(w.get("word", "")))

            # Phrase match (aggressive only) takes priority.
            matched_phrase: Optional[str] = None
            if aggressive and i + 1 < n:
                nxt = _norm(str(words[i + 1].get("word", "")))
                if (token, nxt) in _FILLER_PHRASES:
                    matched_phrase = f"{token} {nxt}"

            if matched_phrase:
                try:
                    pe = float(words[i + 1].get("end"))
                except (TypeError, ValueError):
                    pe = we
                if _in_any(ws, pe, kept):
                    cuts.append({
                        "handle": handle, "t_start": round(ws, 2),
                        "t_end": round(pe, 2), "kind": "filler",
                        "word": matched_phrase,
                    })
                i += 2
                continue

            if token in soft_set and _in_any(ws, we, kept):
                cuts.append({
                    "handle": handle, "t_start": round(ws, 2),
                    "t_end": round(we, 2), "kind": "filler", "word": token,
                })
            i += 1

    cuts.sort(key=lambda c: (c["handle"], c["t_start"]))
    return cuts


def min_silence_for(preferences: Optional[dict]) -> float:
    """Resolve the silence threshold from the project's cut aggressiveness."""
    agg = (preferences or {}).get("cut_aggressiveness")
    return SILENCE_MIN_BY_AGGRESSIVENESS.get(agg, _DEFAULT_SILENCE_MIN_S)


def fillers_aggressive(preferences: Optional[dict]) -> bool:
    return (preferences or {}).get("cut_aggressiveness") == "aggressive"


def arrangement_segments(prior_steps: Optional[dict]) -> List[Dict[str, Any]]:
    """Extract the kept segments from the confirmed arrangement step.

    Prefers the arrange_sequence order (the final cut), falling back to
    pick_segments. Returns [] when no arrangement is confirmed yet — detectors
    then scan whole videos.
    """
    arr = (prior_steps or {}).get("arrangement") or {}
    ops = arr.get("operations") or []
    order_segs: List[Dict[str, Any]] = []
    pick_segs: List[Dict[str, Any]] = []
    for op in ops:
        if not isinstance(op, dict):
            continue
        params = op.get("params") or {}
        if op.get("tool") == "arrange_sequence":
            for it in params.get("order", []) or []:
                if isinstance(it, dict) and "t_start" in it and "t_end" in it:
                    order_segs.append(it)
        elif op.get("tool") == "pick_segments":
            for it in params.get("segments", []) or []:
                if isinstance(it, dict):
                    pick_segs.append(it)
    return order_segs or pick_segs
