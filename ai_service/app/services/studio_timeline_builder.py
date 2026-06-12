"""
Studio timeline builder — turns a confirmed wizard plan into the editor's
`{meta, entries}` timeline contract.

Pure, deterministic, no I/O. Consumes:
  * the confirmed ARRANGEMENT step (order of kept segments + image stills)
  * the confirmed CUTS step (silence/filler/manual spans to remove)
  * per-handle asset kind + source URL + aspect/fps

Produces SOURCE_CLIP entries (one per kept sub-segment after cuts) and image
still entries, sequenced on the output timeline. Source clips keep their own
intrinsic audio (Studio is multi-source editing — there is no separate TTS
narration track), so no audio assembly stage is needed for editor handoff.

Render-worker contract per SOURCE_CLIP entry (see render_worker/worker.py):
  shot_type="SOURCE_CLIP", source_start, source_end, source_video_index,
  in_time, exit_time. `meta.source_video_urls[]` is the index→URL table. The
  entry `html` also embeds the source URL so the editor + browser player can
  show the clip without extra plumbing.
"""
from __future__ import annotations

import html as _html
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

# Output canvas per target aspect.
_DIMENSIONS = {
    "16:9": (1920, 1080),
    "9:16": (1080, 1920),
    "1:1": (1080, 1080),
}
_DEFAULT_ASPECT = "16:9"
_DEFAULT_FPS = 30
_DEFAULT_STILL_S = 4.0
_MIN_SUBSEG_S = 0.15  # drop sub-segments shorter than this (sub-frame slivers)


# ---------------------------------------------------------------------------
# Plan extraction
# ---------------------------------------------------------------------------

def _operations(step_plan: Optional[dict]) -> List[dict]:
    if not isinstance(step_plan, dict):
        return []
    ops = step_plan.get("operations")
    return ops if isinstance(ops, list) else []


def extract_order(arrangement: Optional[dict]) -> List[Dict[str, Any]]:
    """Ordered playback list from the confirmed arrangement. Prefers
    arrange_sequence's `order`; falls back to pick_segments. Items:
    {handle, t_start?, t_end?, still_duration_s?, crossfade_s?}."""
    order: List[Dict[str, Any]] = []
    picks: List[Dict[str, Any]] = []
    for op in _operations(arrangement):
        if not isinstance(op, dict):
            continue
        params = op.get("params") or {}
        if op.get("tool") == "arrange_sequence":
            for it in params.get("order", []) or []:
                if isinstance(it, dict) and it.get("handle"):
                    order.append(it)
        elif op.get("tool") == "pick_segments":
            for it in params.get("segments", []) or []:
                if isinstance(it, dict) and it.get("handle"):
                    picks.append(it)
    return order or picks


def extract_cuts_by_handle(cuts_plan: Optional[dict]) -> Dict[str, List[Tuple[float, float]]]:
    """Collect every cut span (silence/filler/manual) grouped by handle, from
    BOTH `operations` and `manual_operations`. Spans are raw (unmerged)."""
    by_handle: Dict[str, List[Tuple[float, float]]] = {}
    if not isinstance(cuts_plan, dict):
        return by_handle
    all_ops = list(_operations(cuts_plan))
    manual = cuts_plan.get("manual_operations")
    if isinstance(manual, list):
        all_ops.extend(o for o in manual if isinstance(o, dict))
    for op in all_ops:
        for c in (op.get("params") or {}).get("cuts", []) or []:
            if not isinstance(c, dict):
                continue
            h = c.get("handle")
            try:
                ts, te = float(c.get("t_start")), float(c.get("t_end"))
            except (TypeError, ValueError):
                continue
            if h and te > ts:
                by_handle.setdefault(h, []).append((ts, te))
    return by_handle


def merge_spans(spans: List[Tuple[float, float]]) -> List[Tuple[float, float]]:
    """Merge overlapping/adjacent spans. P3 review note: silence + filler
    detectors can overlap; the builder MUST merge before subtracting so a
    segment isn't split twice on the same region."""
    if not spans:
        return []
    ordered = sorted(spans)
    merged: List[Tuple[float, float]] = [ordered[0]]
    for s, e in ordered[1:]:
        ls, le = merged[-1]
        if s <= le:
            merged[-1] = (ls, max(le, e))
        else:
            merged.append((s, e))
    return merged


def subtract_cuts(
    seg_start: float,
    seg_end: float,
    cuts: List[Tuple[float, float]],
) -> List[Tuple[float, float]]:
    """Return the sub-segments of [seg_start, seg_end] that survive after
    removing the (merged) cut spans intersecting it. Sub-segments shorter than
    _MIN_SUBSEG_S are dropped."""
    merged = merge_spans([
        (max(s, seg_start), min(e, seg_end))
        for s, e in cuts
        if e > seg_start and s < seg_end
    ])
    subs: List[Tuple[float, float]] = []
    cursor = seg_start
    for cs, ce in merged:
        if cs > cursor:
            subs.append((cursor, cs))
        cursor = max(cursor, ce)
    if cursor < seg_end:
        subs.append((cursor, seg_end))
    return [(s, e) for s, e in subs if (e - s) >= _MIN_SUBSEG_S]


# ---------------------------------------------------------------------------
# Entry HTML
# ---------------------------------------------------------------------------

def _source_clip_html(url: str, source_start: float, source_end: float) -> str:
    """Full-frame <video> for a source-clip range. The media-fragment hint
    (#t=) lets a plain browser preview seek; the editor's engine uses the
    structured source_start/source_end fields.

    NOT muted: Studio has no TTS narration — the source clip's own audio is
    the soundtrack, and the EDITOR plays it from this <video> directly. The
    render worker does NOT capture browser <video> audio (it strips
    data-source-clip tags and composites pixels only — Playwright frames are
    silent); the rendered MP4's soundtrack is the P7 ASSEMBLE_AUDIO master
    track (s3_urls.audio), assembled from the same source ranges. Keep the two
    in sync: muting this tag silences the editor, not the render."""
    safe = _html.escape(url, quote=True)
    frag = f"#t={source_start:.2f},{source_end:.2f}"
    return (
        '<div style="position:absolute;inset:0;background:#000">'
        f'<video data-source-clip src="{safe}{frag}" '
        'style="width:100%;height:100%;object-fit:contain;display:block" '
        'playsinline preload="metadata"></video>'
        '</div>'
    )


def _image_still_html(url: str) -> str:
    safe = _html.escape(url, quote=True)
    return (
        '<div style="position:absolute;inset:0;background:#000">'
        f'<img src="{safe}" '
        'style="width:100%;height:100%;object-fit:contain;display:block" alt=""/>'
        '</div>'
    )


# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

def build_timeline(
    *,
    arrangement: Optional[dict],
    cuts_plan: Optional[dict],
    asset_kinds: Dict[str, str],
    source_urls: Dict[str, str],
    aspect: Optional[str],
    fps: Optional[int] = None,
) -> Dict[str, Any]:
    """Assemble the `{meta, entries}` timeline.

    Sequencing: each order item is laid end-to-end on the output timeline.
    Video items are split around their (merged) cuts into SOURCE_CLIP entries;
    image items become a single still of `still_duration_s` (default 4s).
    Handles without a resolvable source URL are skipped (logged by caller).
    """
    aspect = aspect if aspect in _DIMENSIONS else _DEFAULT_ASPECT
    width, height = _DIMENSIONS[aspect]
    fps = fps or _DEFAULT_FPS

    order = extract_order(arrangement)
    cuts_by_handle = extract_cuts_by_handle(cuts_plan)

    # Stable source_video_index per handle, in first-appearance order.
    source_index: Dict[str, int] = {}
    source_video_urls: List[str] = []

    def _index_for(handle: str) -> Optional[int]:
        url = source_urls.get(handle)
        if not url:
            return None
        if handle not in source_index:
            source_index[handle] = len(source_video_urls)
            source_video_urls.append(url)
        return source_index[handle]

    entries: List[Dict[str, Any]] = []
    # segment_windows: per arrangement order-item that produced ≥1 entry, the
    # composed [inTime, exitTime) window it occupies. The COMPOSE_HTML executor
    # (P6) resolves an overlay's `segment_idx` (an index into THIS `order`, the
    # same list build_timeline iterates) to its window. Items that produce no
    # entries (unresolved URL / bad range) are simply absent from the map.
    segment_windows: List[Dict[str, Any]] = []
    cursor = 0.0

    for order_index, item in enumerate(order):
        handle = item.get("handle")
        if not handle:
            continue
        url = source_urls.get(handle)
        if not url:
            continue  # unresolved asset — skip (caller logs)
        kind = asset_kinds.get(handle, "video")
        win_start = cursor

        if kind == "image":
            dur = _DEFAULT_STILL_S
            try:
                if item.get("still_duration_s") is not None:
                    dur = max(0.5, min(15.0, float(item["still_duration_s"])))
            except (TypeError, ValueError):
                pass
            entries.append({
                "id": str(uuid4()),
                "shot_type": "IMAGE_STILL",
                "inTime": round(cursor, 3),
                "exitTime": round(cursor + dur, 3),
                "z": 0,
                "html": _image_still_html(url),
                "htmlStartX": 0, "htmlStartY": 0,
                "htmlEndX": width, "htmlEndY": height,
                "entry_meta": {"handle": handle, "kind": "image", "order_index": order_index},
            })
            cursor += dur
            segment_windows.append({
                "order_index": order_index, "handle": handle, "kind": "image",
                "inTime": round(win_start, 3), "exitTime": round(cursor, 3),
            })
            continue

        # Video — need a range.
        try:
            t_start = float(item.get("t_start"))
            t_end = float(item.get("t_end"))
        except (TypeError, ValueError):
            continue
        if t_end <= t_start:
            continue

        idx = _index_for(handle)
        if idx is None:
            continue
        subs = subtract_cuts(t_start, t_end, cuts_by_handle.get(handle, []))
        for ss, se in subs:
            out_dur = se - ss
            entries.append({
                "id": str(uuid4()),
                "shot_type": "SOURCE_CLIP",
                "source_video_index": idx,
                "source_start": round(ss, 3),
                "source_end": round(se, 3),
                "inTime": round(cursor, 3),
                "exitTime": round(cursor + out_dur, 3),
                "z": 0,
                "html": _source_clip_html(url, ss, se),
                "htmlStartX": 0, "htmlStartY": 0,
                "htmlEndX": width, "htmlEndY": height,
                "entry_meta": {"handle": handle, "kind": "source_clip", "order_index": order_index},
            })
            cursor += out_dur
        if cursor > win_start:  # produced ≥1 surviving sub-segment
            segment_windows.append({
                "order_index": order_index, "handle": handle, "kind": "source_clip",
                "inTime": round(win_start, 3), "exitTime": round(cursor, 3),
            })

    meta: Dict[str, Any] = {
        "kind": "studio",
        "dimensions": {"width": width, "height": height},
        "orientation": "portrait" if height > width else "landscape",
        "aspect": aspect,
        "fps": fps,
        "total_duration": round(cursor, 3),
        "source_video_urls": source_video_urls,
        "segment_windows": segment_windows,
    }
    return {"meta": meta, "entries": entries}
