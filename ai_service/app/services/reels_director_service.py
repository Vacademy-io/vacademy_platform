"""
Gate 3d — DIRECTOR_REEL stage (Phase 1 MVP).

Composes the reel's shot plan + per-shot HTML. Phase 1 is a deterministic
template — no LLM call. Future phases will replace this with the full
research-anchored Director from plan §2.4 (visual library, b-roll insertion,
loop-back ending, etc.).

The Phase 1 MVP produces three layers of shots:

  1. **Base SOURCE_CLIP entry** (z=0) covering the entire reel duration.
     Renders the trimmed speaker_clip.mp4 via the editor's
     `<video data-source-clip>` element (already supported per
     VIDEO_EDITOR_REVIEW.md §9). One entry, full-bleed.

  2. **Hook overlay entry** (z=500) for the first 2.5s, displaying the
     enriched candidate's `title`. Bold caption-style text near the top
     of the frame. Research §12.2: 84.3% of viral TikToks open with a
     psych hook in the first 3s — this is our hook.

  3. **Caption blocks** (z=8000+) — one entry per phrase (≤17 chars per
     second per the renderer's reading-speed rule), generated from the
     candidate's `word_importance` array. Each block highlights its
     active word in yellow (Hormozi-style default).

All shot timings are in POST-TRIM-AND-ATEMPO seconds (i.e., the reel's
own timeline, not source video timecodes). The renderer composites these
HTML entries on top of the speaker_clip video.

HTML output is a body fragment (no <html>/<head>) — the editor's
html-processor wraps it into a complete document at render time, injecting
GSAP/styles/etc. per the existing contract.
"""
from __future__ import annotations

import asyncio
import html as html_lib
import logging
from dataclasses import dataclass, field
from typing import Optional

from ..services.reels_render_orchestrator import (
    RenderContext,
    STAGE_DIRECTOR,
    register_stage_handler,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Z-index bands — match the editor's `ai-video-player` convention:
#   0-499    base content
#   500-7999 motion graphics / overlays
#   8000+    captions / UI on top
Z_BASE = 0
Z_HOOK_OVERLAY = 500
Z_CAPTION = 8000

# Hook overlay duration. Research §12.2: 2.5s is the hook window.
HOOK_DURATION_S = 2.5

# Caption phrase batching — group words into blocks of N for display.
# 2-3 words at a time is the proven sweet spot for short-form readability.
CAPTION_WORDS_PER_BLOCK = 3
# Don't show a block longer than this (research-anchored 17 CPS limit
# becomes ~1.5-2s for 3 words ≈ 15 chars).
CAPTION_MAX_BLOCK_DURATION_S = 2.0
# Below this, the block is too short to read — merge with neighbor.
CAPTION_MIN_BLOCK_DURATION_S = 0.3

# Hormozi-style default palette. Future STYLE_GUIDE stage can override.
DEFAULT_CAPTION_PALETTE = {
    "body": "#FFFFFF",
    "important": "#F7C204",   # yellow
    "definition": "#02FB23",  # green
    "warning": "#FF3B30",     # red
    "stroke": "#000000",
}


# ---------------------------------------------------------------------------
# Internal types
# ---------------------------------------------------------------------------

@dataclass
class _Shot:
    """One Entry/shot in the final payload."""
    id: str
    in_time: float
    exit_time: float
    z: int
    html: str
    entry_meta: dict = field(default_factory=dict)

    def to_entry_dict(self) -> dict:
        """Map to the editor's Entry shape (per VIDEO_EDITOR_REVIEW.md §1).
        Field names use camelCase / inTime per the existing convention."""
        return {
            "id": self.id,
            "inTime": round(self.in_time, 3),
            "exitTime": round(self.exit_time, 3),
            "z": self.z,
            "html": self.html,
            "entry_meta": self.entry_meta or {},
        }


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class ReelsDirectorService:
    """Phase 1 deterministic shot composer."""

    def run(self, ctx: RenderContext) -> None:
        """Build the shot plan + per-shot HTML. Writes
        `ctx.extra_metadata['shots']` for ASSEMBLE to consume.

        Sync method — no I/O, just composition. The async wrapper offloads
        to a thread to keep the pattern consistent with other stages."""
        # 1. Resolve inputs.
        speaker_clip_url = (ctx.s3_urls or {}).get("speaker_clip")
        if not speaker_clip_url:
            raise RuntimeError(
                "speaker_clip URL not set — SOURCE_CLIP must run before DIRECTOR"
            )

        total_duration = float(
            (ctx.trim_map or {}).get("total_new_duration_s") or 0.0
        )
        if total_duration <= 0:
            raise RuntimeError(
                "trim_map.total_new_duration_s missing or non-positive — "
                "AUDIO_EDIT must run before DIRECTOR"
            )

        out_res = (ctx.extra_metadata or {}).get("output_resolution") or {}
        canvas_w = int(out_res.get("width") or 1080)
        canvas_h = int(out_res.get("height") or 1920)

        # The candidate's enriched payload (snapshotted at /render — G4).
        enriched = (ctx.config or {}).get("enriched_snapshot") or {}
        title = (enriched.get("title") or "").strip() or "Watch this"

        # 2. Compose shots.
        shots: list[_Shot] = []

        # 2a. Base SOURCE_CLIP shot covering the whole reel.
        shots.append(self._build_base_shot(speaker_clip_url, total_duration))

        # 2b. Hook overlay — first HOOK_DURATION_S seconds with the title.
        hook_end = min(HOOK_DURATION_S, total_duration)
        if hook_end > 0.3:
            shots.append(self._build_hook_overlay(title, hook_end))

        # 2c. Captions — derived from word_importance (post-trim timestamps).
        # Note: enriched.word_importance has SOURCE timestamps. We need to
        # remap to post-trim timestamps using ctx.trim_map. Then group into
        # phrase blocks.
        word_importance = enriched.get("word_importance") or []
        if word_importance:
            caption_shots = self._build_caption_blocks(
                word_importance,
                trim_map=ctx.trim_map or {},
                total_duration=total_duration,
            )
            shots.extend(caption_shots)

        # 3. Stash for ASSEMBLE.
        ctx.extra_metadata["shots"] = [s.to_entry_dict() for s in shots]
        ctx.extra_metadata["canvas_dimensions"] = {"width": canvas_w, "height": canvas_h}
        ctx.extra_metadata["total_duration_s"] = round(total_duration, 3)
        logger.info(
            f"[Director] {ctx.reel_id} composed {len(shots)} shots "
            f"(1 base + 1 hook + {len(shots)-2} captions) for "
            f"{total_duration:.2f}s reel"
        )

    # ── Shot builders ─────────────────────────────────────────────────────

    @staticmethod
    def _build_base_shot(speaker_clip_url: str, duration: float) -> _Shot:
        """Full-bleed SOURCE_CLIP entry referencing the speaker_clip MP4.

        The editor's html-processor recognizes `<video data-source-clip>`
        and handles seek + autoplay (per VIDEO_EDITOR_REVIEW.md §9).
        """
        # data-source-start=0 — speaker_clip is ALREADY trimmed; play from
        # its own beginning, not a source-video offset.
        safe_url = html_lib.escape(speaker_clip_url, quote=True)
        fragment = (
            f'<video data-source-clip '
            f'src="{safe_url}" '
            f'data-source-start="0" '
            f'autoplay muted playsinline '
            f'style="width:100%;height:100%;object-fit:cover;display:block"></video>'
        )
        return _Shot(
            id="shot-base",
            in_time=0.0,
            exit_time=round(duration, 3),
            z=Z_BASE,
            html=fragment,
            entry_meta={"shot_type": "speaker_clip_base"},
        )

    @staticmethod
    def _build_hook_overlay(title: str, hook_end: float) -> _Shot:
        """Bold caption-style overlay for the hook window.

        Hormozi-style: Inter 900, white + drop shadow, near the top of the
        9:16 frame (research §12.4 says Y=70% is the caption convention,
        but the *hook* overlay sits higher to leave room for spoken
        captions below).
        """
        safe = html_lib.escape(title)
        # Positioned with vw-relative font for resolution independence.
        # ~5vw on a 1080px-wide frame = ~54px; on 540px wide = ~27px.
        fragment = (
            '<div style="'
            'position:absolute;'
            'left:6%;right:6%;'
            'top:14%;'
            'font:900 6.5vw/1.15 Inter,Montserrat,sans-serif;'
            'letter-spacing:-0.01em;'
            'text-transform:uppercase;'
            'color:#FFFFFF;'
            'text-align:center;'
            '-webkit-text-stroke:1.5px #000;'
            'text-shadow:0 4px 14px rgba(0,0,0,0.55);'
            'pointer-events:none;'
            '">'
            f'{safe}'
            '</div>'
        )
        return _Shot(
            id="shot-hook",
            in_time=0.0,
            exit_time=round(hook_end, 3),
            z=Z_HOOK_OVERLAY,
            html=fragment,
            entry_meta={"shot_type": "hook_overlay", "text": title},
        )

    @staticmethod
    def _build_caption_blocks(
        word_importance: list[dict],
        trim_map: dict,
        total_duration: float,
    ) -> list[_Shot]:
        """Group word_importance into caption phrase blocks and emit one
        Entry per block.

        Word timestamps in `word_importance` are in SOURCE timecodes (the
        post-/preview cut_plan has been computed from source words too).
        We remap each word's timestamp through the trim_map's spans to
        get the equivalent post-trim post-atempo timestamp on the reel
        timeline.
        """
        # Translate source timecodes → post-trim timecodes.
        remapped = []
        for w in word_importance:
            t_s = float(w.get("t_start") or 0.0)
            t_e = float(w.get("t_end") or 0.0)
            new_s = _source_to_reel_time(t_s, trim_map)
            new_e = _source_to_reel_time(t_e, trim_map)
            if new_s is None or new_e is None or new_e <= new_s:
                continue
            remapped.append({
                "word": str(w.get("word") or ""),
                "in_time": new_s,
                "exit_time": new_e,
                "importance": int(w.get("importance") or 2),
                "keyword_type": w.get("keyword_type"),
            })

        if not remapped:
            return []

        # Group into N-word blocks. We prefer to break at sentence-ending
        # punctuation (.?!) so caption transitions align with natural
        # spoken pauses (D2). When no sentence boundary is nearby we fall
        # back to the N-word / max-duration limit.
        blocks: list[list[dict]] = []
        cursor: list[dict] = []
        for w in remapped:
            cursor.append(w)
            block_dur = cursor[-1]["exit_time"] - cursor[0]["in_time"]
            # Sentence boundary detection: the word's text ends in .?!
            # (allowing for adjacent quotes — Whisper sometimes emits
            # "word.\"" as a single token).
            tail = str(w.get("word") or "").rstrip("'\"")
            ends_sentence = bool(tail) and tail[-1] in ".?!"
            # Break if: (a) hit sentence end with at least 1 word, OR
            # (b) reached N-word cap, OR (c) block already too long.
            if (
                ends_sentence
                or len(cursor) >= CAPTION_WORDS_PER_BLOCK
                or block_dur >= CAPTION_MAX_BLOCK_DURATION_S
            ):
                blocks.append(cursor)
                cursor = []
        if cursor:
            blocks.append(cursor)

        # Drop sub-MIN_BLOCK_DURATION_S blocks — too fast to read.
        blocks = [b for b in blocks if (b[-1]["exit_time"] - b[0]["in_time"]) >= CAPTION_MIN_BLOCK_DURATION_S]
        if not blocks:
            return []

        shots: list[_Shot] = []
        for i, block in enumerate(blocks):
            in_t = block[0]["in_time"]
            out_t = min(block[-1]["exit_time"], total_duration)
            if out_t <= in_t:
                continue
            html = _build_caption_block_html(block)
            shots.append(_Shot(
                id=f"shot-cap-{i:03d}",
                in_time=in_t,
                exit_time=out_t,
                z=Z_CAPTION + i,  # incrementally above 8000 for stacking
                html=html,
                entry_meta={
                    "shot_type": "caption_block",
                    "text": " ".join(w["word"] for w in block),
                },
            ))
        return shots


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _source_to_reel_time(t_source: float, trim_map: dict) -> Optional[float]:
    """Translate a source-video timestamp to the equivalent post-trim
    timestamp on the reel timeline.

    If the source time falls inside a kept span, returns the proportional
    new-time. If it falls inside a CUT range (between kept spans), returns
    the start of the next kept span's new time (clamping forward). If it's
    outside the entire window, returns None.
    """
    spans = trim_map.get("spans") or []
    if not spans:
        return None
    win_start = float(trim_map.get("window_t_start") or 0.0)
    win_end = float(trim_map.get("window_t_end") or 0.0)
    if t_source < win_start or t_source > win_end:
        return None
    # NB: the trim_map's new_t_* are ALREADY post-atempo (audio service
    # divides by speed_multiplier when building it). So linear interp
    # between ns_ and ne_ correctly accounts for speed — no extra factor
    # needed here.

    for s in spans:
        os_, oe = float(s["orig_t_start"]), float(s["orig_t_end"])
        ns_, ne = float(s["new_t_start"]), float(s["new_t_end"])
        if os_ <= t_source <= oe:
            # Linear interpolation inside the span.
            frac = (t_source - os_) / max(1e-6, oe - os_)
            return ns_ + frac * (ne - ns_)
        # If t_source falls in the GAP just before this span (i.e., inside
        # a cut), snap forward to this span's start. Avoids losing words
        # that the cut planner marked as cuttable but might still be
        # surfaced via emphasis/keyword floors.
        if t_source < os_:
            return ns_
    # Past the last span's orig_t_end — return its new_t_end (clamp).
    return float(spans[-1]["new_t_end"])


def _build_caption_block_html(block: list[dict]) -> str:
    """Build a single caption block fragment with **per-word karaoke
    reveal** animation (Phase 2a).

    Each word fades-in + scales-up at its own `t_start` (relative to the
    block's `in_time`) — matching the "word-by-word reveal" pattern
    research §12.4 identifies as the highest-retention style across
    educational + storytelling short-form.

    Implementation:
      - One `<style>` block defines the `karaoke-reveal` keyframes.
        Keyframes are document-scoped per CSS spec — defining inside the
        entry's iframe body works correctly.
      - One `<span>` per word with `animation-delay` set to the word's
        offset from `block_in_time`. Each entry becomes its own iframe;
        CSS animation timeline starts from iframe load = entry's
        `inTime` on the reel timeline. So animation-delay maps 1:1 to
        per-word reveal moments.
      - Color encoding: keyword_type words stay in their assigned color
        (yellow/green/red); normal words are white. Both pop on reveal.

    NB: scrubbing the editor backward then forward will re-mount the
    iframe — animations replay from the start. Live playback (the render
    worker's case) plays linearly so animations sync correctly.
    """
    body_color = DEFAULT_CAPTION_PALETTE["body"]
    stroke_color = DEFAULT_CAPTION_PALETTE["stroke"]
    block_in = float(block[0]["in_time"])

    spans: list[str] = []
    for w in block:
        text = html_lib.escape(str(w["word"]).strip())
        if not text:
            continue
        kt = w.get("keyword_type")
        color = DEFAULT_CAPTION_PALETTE.get(kt) if kt else body_color
        # Negative or sub-millisecond offsets get clamped to 0 — protects
        # against rounding/precision edge cases at block boundaries.
        offset = max(0.0, float(w["in_time"]) - block_in)
        spans.append(
            f'<span style="'
            f'color:{color};'
            'display:inline-block;'
            'opacity:0;'
            f'animation:karaoke-reveal 280ms {offset:.3f}s both;'
            '">'
            f'{text}'
            '</span>'
        )
    inner = " ".join(spans)
    return (
        # Document-scoped @keyframes. Defining inside the entry iframe
        # body is valid per CSS spec and keeps the entry self-contained.
        '<style>'
        '@keyframes karaoke-reveal{'
        '0%{opacity:0;transform:scale(0.6) translateY(8px)}'
        '55%{opacity:1;transform:scale(1.12) translateY(-2px)}'
        '100%{opacity:1;transform:scale(1) translateY(0)}'
        '}'
        '</style>'
        '<div style="'
        'position:absolute;'
        'left:6%;right:6%;'
        'bottom:18%;'
        'font:800 6vw/1.2 Inter,Montserrat,sans-serif;'
        'letter-spacing:0;'
        'text-align:center;'
        f'-webkit-text-stroke:2px {stroke_color};'
        'text-shadow:0 3px 8px rgba(0,0,0,0.6);'
        'pointer-events:none;'
        '">'
        f'{inner}'
        '</div>'
    )


# ---------------------------------------------------------------------------
# Stage registration
# ---------------------------------------------------------------------------

async def _director_stage(ctx: RenderContext) -> None:
    """Async handler. Sync compose work — wrap in thread for parity."""
    svc = ReelsDirectorService()
    await asyncio.to_thread(svc.run, ctx)


register_stage_handler(STAGE_DIRECTOR, _director_stage)
