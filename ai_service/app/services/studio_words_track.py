"""
Studio captions words-track builder — pure, deterministic, no I/O.

Studio has no TTS narration (source clips carry their own audio), so there is no
narration words.json. To caption a Studio build we REMAP each kept clip's indexed
word-level transcript onto the COMPOSED output timeline, using the exact same
SOURCE_CLIP layout the timeline builder produced. Output is the flat
`[{word, start, end}]` array the editor (`loadCaptionWords`) and render worker
(`--captions-words`) both consume — times in master-timeline seconds.

Alignment is exact because we drive off the built timeline's SOURCE_CLIP entries:
each entry already encodes `source_start`/`source_end` (its slice of the source)
and `inTime` (where that slice lands on the output). A word at source time `w`
maps to output time `inTime + (w - source_start)`. Words inside a cut span never
appear in any surviving sub-segment, so they're dropped automatically; a word
straddling a cut boundary is clamped to the surviving part.
"""
from __future__ import annotations

from typing import Any, Dict, List


def flatten_words(transcript: Any) -> List[Dict[str, Any]]:
    """Flatten an indexed `video_context.transcript` (list of sentences, each
    with `words: [{word,start,end}]`) into one ordered word list. Tolerant of
    missing/malformed entries."""
    out: List[Dict[str, Any]] = []
    if not isinstance(transcript, list):
        return out
    for sent in transcript:
        for w in (sent or {}).get("words", []) or []:
            if not isinstance(w, dict):
                continue
            try:
                ws = float(w.get("start"))
                we = float(w.get("end"))
            except (TypeError, ValueError):
                continue
            text = str(w.get("word", "")).strip()
            if text and we > ws:
                out.append({"word": text, "start": ws, "end": we})
    out.sort(key=lambda x: x["start"])
    return out


def build_words_track(
    entries: List[Dict[str, Any]],
    words_by_handle: Dict[str, List[Dict[str, Any]]],
) -> List[Dict[str, Any]]:
    """Remap source words onto the composed timeline.

    `entries` are the built timeline's entries (SOURCE_CLIP entries drive
    captions; images carry no words). `words_by_handle` maps each video handle to
    its flattened word list (in SOURCE seconds). Returns `[{word, start, end}]`
    in output-timeline seconds, ordered by start.
    """
    track: List[Dict[str, Any]] = []
    for e in entries:
        if e.get("shot_type") != "SOURCE_CLIP":
            continue
        handle = (e.get("entry_meta") or {}).get("handle")
        words = words_by_handle.get(handle)
        if not words:
            continue
        try:
            src_start = float(e["source_start"])
            src_end = float(e["source_end"])
            in_time = float(e["inTime"])
            exit_time = float(e["exitTime"])
        except (KeyError, TypeError, ValueError):
            continue
        if src_end <= src_start:
            continue
        for w in words:
            ws, we = w["start"], w["end"]
            # Overlap with this sub-segment's source range?
            if we <= src_start or ws >= src_end:
                continue
            clipped_start = max(ws, src_start)
            clipped_end = min(we, src_end)
            out_start = in_time + (clipped_start - src_start)
            out_end = in_time + (clipped_end - src_start)
            # Clamp into the entry's output window (defensive against rounding).
            out_start = max(in_time, min(out_start, exit_time))
            out_end = max(in_time, min(out_end, exit_time))
            if out_end > out_start:
                track.append({
                    "word": w["word"],
                    "start": round(out_start, 3),
                    "end": round(out_end, 3),
                })
    track.sort(key=lambda x: x["start"])
    return track
