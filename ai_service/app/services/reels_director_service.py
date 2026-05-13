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

from ..services.reels_broll_service import (
    extract_concept,
    find_b_roll,
    find_b_roll_image,
)
from ..services.reels_llm_director_service import LLMDirector, OverlaySpec
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
# Media overlays (Phase 2c.5 broll_video / broll_image) sit above the base
# speaker_clip but below text overlays so:
#   * `full` position media REPLACES the speaker visually for its duration
#   * Text overlays (hook / micro_hook / loop_back / emphasis) at z=500+
#     still render on top — they can layer over media without conflict.
Z_BROLL_MEDIA = 200
Z_HOOK_OVERLAY = 500
Z_CAPTION = 8000

# Local mirror of the LLM director's non-text-visual type sets — director
# needs to branch on these without importing the LLM module's internals
# from a tight loop. Kept in sync with `_MEDIA_OVERLAY_TYPES` +
# `_STAT_OVERLAY_TYPES` in reels_llm_director_service.
_MEDIA_OVERLAY_TYPES_LOCAL: frozenset[str] = frozenset({"broll_video", "broll_image"})
_STAT_OVERLAY_TYPES_LOCAL: frozenset[str] = frozenset({"animated_stat", "motion_graphic"})

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

# Hormozi-style default palette. STYLE_GUIDE stage (Phase 2b) can override
# individual tokens by writing into `ctx.extra_metadata["style_palette"]`.
# Use `_effective_caption_palette(ctx)` rather than reading DEFAULT directly
# so source_derived overrides flow through every consumer (caption builder,
# stat HTML, motion-graphic renderers).
DEFAULT_CAPTION_PALETTE = {
    "body": "#FFFFFF",
    "important": "#F7C204",   # yellow
    "definition": "#02FB23",  # green
    "warning": "#FF3B30",     # red
    "stroke": "#000000",
}


def _effective_caption_palette(style_override: Optional[dict]) -> dict:
    """Merge a STYLE_GUIDE-derived override (or `None`) onto the default
    Hormozi palette. Tokens not present in the override fall through to
    the default — STYLE_GUIDE only writes `important` for now since the
    semantic colors (definition green, warning red) stay fixed across
    reels regardless of source palette.

    Defensive: ignores invalid hex values, non-dict overrides, and any
    tokens that aren't in the known palette set. Always returns a full
    palette dict so consumers don't have to handle missing keys.
    """
    if not isinstance(style_override, dict) or not style_override:
        return dict(DEFAULT_CAPTION_PALETTE)
    out = dict(DEFAULT_CAPTION_PALETTE)
    import re as _re
    hex_re = _re.compile(r"^#[0-9A-Fa-f]{6}$")
    for token, value in style_override.items():
        if token not in DEFAULT_CAPTION_PALETTE:
            continue
        if isinstance(value, str) and hex_re.fullmatch(value.strip()):
            out[token] = value.strip()
    return out


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
    """Phase 2c shot composer — deterministic base + captions, LLM-generated
    overlay storyline track on top.

    Layered design:
      1. Base SOURCE_CLIP shot (deterministic, always)
      2. Storyline overlays — hook + micro_hook + loop_back + emphasis,
         generated by `LLMDirector`. Falls back to a single deterministic
         hook overlay (using the candidate's enriched title) if the LLM is
         unavailable or returns nothing usable.
      3. Caption blocks (deterministic, always — driven by word_importance).
    """

    async def run(self, ctx: RenderContext) -> None:
        """Build the shot plan + per-shot HTML. Writes
        `ctx.extra_metadata['shots']` for ASSEMBLE to consume.

        Async because the optional LLM overlay step is a network hop. The
        rest is pure composition.
        """
        # 1. Resolve inputs.
        speaker_clip_url = (ctx.s3_urls or {}).get("speaker_clip")
        if not speaker_clip_url:
            raise RuntimeError(
                "speaker_clip URL not set — SOURCE_CLIP must run before DIRECTOR"
            )
        # Phase 2d: alpha-matted speaker silhouette, produced by SOURCE_CLIP
        # only when layout=pip_corner_speaker AND matting succeeded. May be
        # None if matting was disabled/failed — base-shot builder falls back
        # to the rectangular PiP HTML.
        speaker_fg_url = (ctx.s3_urls or {}).get("speaker_fg")

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
        rationale = (enriched.get("rationale") or "").strip()

        # 2. Remap word_importance to reel-time FIRST — used by the LLM
        # director, the caption builder, AND the b-roll concept extractor
        # (below). Pulled out of the original 2b slot so layout resolution
        # can consult the reel's content words for auto-bgv fetching.
        word_importance = enriched.get("word_importance") or []
        trim_map = ctx.trim_map or {}
        word_importance_reel_time = _remap_word_importance(word_importance, trim_map)

        # 3. Storyline overlays run FIRST so we get the LLM's optional
        # `background_concept` along with the overlay specs — both come
        # from the same call (Phase 2c.8). Moving this above bgv-resolution
        # lets the bgv chain prefer the LLM's scene-level concept over
        # the heuristic single-word pick from `extract_concept`.
        overlay_shots, overlay_method, llm_bg_concept = await self._build_storyline_overlays(
            reel_duration_s=total_duration,
            title=title,
            rationale=rationale,
            word_importance_reel_time=word_importance_reel_time,
        )

        # 4. Layout resolution. Both `stacked_speaker_with_broll` and
        # `pip_corner_speaker` need a bgv URL to render meaningfully —
        # without it the bottom half / bg fill is a black void. Resolution
        # order:
        #   a. User-supplied `background_video_url` (the "URL" source mode)
        #   b. Auto-fetched Pexels b-roll, concept picked by EITHER the
        #      LLM director's `background_concept` (preferred, 2-5 word
        #      scene query — Phase 2c.8) OR the heuristic single-word
        #      `extract_concept` (Phase 2c.4 fallback).
        #   c. Silent downgrade to `full_speaker_with_overlays` if neither
        #      yields a usable URL.
        # The effective layout + the bgv source choice are tracked on
        # `extra_metadata` so FE / audit can tell which path fired.
        requested_layout = str((ctx.config or {}).get("layout") or "full_speaker_with_overlays")
        bgv_url_raw = (ctx.config or {}).get("background_video_url")
        bgv_url = _resolve_http_url(bgv_url_raw) if bgv_url_raw else None
        bgv_source = "user_url" if bgv_url else "none"
        bgv_concept_used: Optional[str] = None

        if (
            not bgv_url
            and requested_layout in ("stacked_speaker_with_broll", "pip_corner_speaker")
            and word_importance_reel_time
        ):
            # Try the LLM's scene-concept first; fall back to the
            # heuristic single-word pick. Both go through the same
            # Pexels finder + per-process LRU cache, so a hot concept
            # short-circuits to the cached URL.
            concept_candidates: list[tuple[str, str]] = []
            if llm_bg_concept:
                concept_candidates.append(("llm", llm_bg_concept))
            heuristic_concept = extract_concept(word_importance_reel_time)
            if heuristic_concept and heuristic_concept != llm_bg_concept:
                concept_candidates.append(("heuristic", heuristic_concept))
            for source, concept in concept_candidates:
                auto_url = await find_b_roll(concept)
                if auto_url:
                    bgv_url = auto_url
                    bgv_source = f"auto_pexels_{source}"
                    bgv_concept_used = concept
                    logger.info(
                        f"[Director] {ctx.reel_id} auto-fetched bgv via "
                        f"{source} concept={concept!r} → {auto_url[:60]}…"
                    )
                    break
                logger.info(
                    f"[Director] {ctx.reel_id} {source} concept={concept!r} "
                    f"yielded no Pexels hit"
                )

        effective_layout = requested_layout
        if requested_layout in ("stacked_speaker_with_broll", "pip_corner_speaker") and not bgv_url:
            logger.info(
                f"[Director] {ctx.reel_id} requested {requested_layout} without "
                f"usable bgv URL — falling back to full_speaker_with_overlays"
            )
            effective_layout = "full_speaker_with_overlays"

        # 5. Compose shots.
        shots: list[_Shot] = []

        # 5a. Base shot covering the whole reel — shape depends on layout.
        shots.append(self._build_base_shot(
            speaker_clip_url,
            total_duration,
            layout=effective_layout,
            background_video_url=bgv_url,
            speaker_fg_url=speaker_fg_url,
        ))

        # 5b. Storyline overlays (already built in step 3).
        shots.extend(overlay_shots)

        # 5c. Captions — same word list, but grouped into phrase blocks.
        # Stacked layout pushes captions up so they sit on the speaker half,
        # just above the 50/50 split. Other layouts use the default
        # bottom-third position. Palette merges any STYLE_GUIDE override
        # (Phase 2b) onto DEFAULT_CAPTION_PALETTE so source_derived reels
        # pick up their per-clip accent.
        palette = _effective_caption_palette(
            (ctx.extra_metadata or {}).get("style_palette")
        )
        if word_importance_reel_time:
            caption_shots = self._build_caption_blocks_from_reel_time(
                word_importance_reel_time,
                total_duration=total_duration,
                layout=effective_layout,
                palette=palette,
            )
            shots.extend(caption_shots)

        # 6. Stash for ASSEMBLE.
        ctx.extra_metadata["shots"] = [s.to_entry_dict() for s in shots]
        ctx.extra_metadata["canvas_dimensions"] = {"width": canvas_w, "height": canvas_h}
        ctx.extra_metadata["total_duration_s"] = round(total_duration, 3)
        ctx.extra_metadata["director_overlay_method"] = overlay_method
        ctx.extra_metadata["effective_layout"] = effective_layout
        ctx.extra_metadata["bgv_source"] = bgv_source
        # Surface the concept that actually fed Pexels (if any). Useful
        # for debugging "why did this reel pick THIS b-roll?" and for the
        # FE detail page to show "ambient b-roll: 'data analytics' (auto)".
        if bgv_concept_used:
            ctx.extra_metadata["bgv_concept"] = bgv_concept_used
        logger.info(
            f"[Director] {ctx.reel_id} composed {len(shots)} shots "
            f"(1 base + {len(overlay_shots)} overlays via {overlay_method} + "
            f"{len(shots) - 1 - len(overlay_shots)} captions) for "
            f"{total_duration:.2f}s reel · bgv_source={bgv_source}"
        )

    async def _build_storyline_overlays(
        self,
        *,
        reel_duration_s: float,
        title: str,
        rationale: str,
        word_importance_reel_time: list[dict],
    ) -> tuple[list[_Shot], str, Optional[str]]:
        """LLM-direct overlay specs → `_Shot` list, with deterministic fallback.

        Returns (shots, method, bg_concept) where:
          * `method` ∈ {"llm", "deterministic_fallback"} — tracked in
            extra_metadata for A/B comparison.
          * `bg_concept` is the LLM-emitted 2-5 word Pexels search query
            for layouts that need ambient bgv (stacked / pip_corner_speaker);
            None if the LLM didn't emit one OR fell back to deterministic.
            Caller's bgv-resolution chain prefers this over the heuristic.
        """
        bg_concept: Optional[str] = None
        try:
            director = LLMDirector()
            specs, bg_concept = await director.generate_overlays(
                reel_duration_s=reel_duration_s,
                title=title,
                rationale=rationale,
                word_importance_reel_time=word_importance_reel_time,
            )
        except Exception as e:
            # Defensive — the LLMDirector already catches its own transport
            # errors and returns ([], None); this is for any unexpected breakage.
            logger.warning(f"[Director] LLMDirector raised: {e}; falling back")
            specs = []

        if specs:
            # Media specs need a Pexels lookup before we can emit HTML —
            # resolve them all in parallel so the per-render network cost
            # is one round-trip-time, not N. Failed lookups drop the spec
            # silently rather than failing the whole director. Stat /
            # graphic specs need no network — they render directly from
            # the spec fields.
            media_url_by_index = await self._resolve_media_urls(specs)
            shots: list[_Shot] = []
            for i, spec in enumerate(specs):
                if spec.type in _MEDIA_OVERLAY_TYPES_LOCAL:
                    url = media_url_by_index.get(i)
                    if not url:
                        # Pexels miss / no key — skip this media overlay.
                        # The rest of the reel still ships.
                        continue
                    shots.append(self._media_spec_to_shot(spec, i, url))
                elif spec.type in _STAT_OVERLAY_TYPES_LOCAL:
                    shots.append(self._stat_spec_to_shot(spec, i))
                else:
                    shots.append(self._spec_to_shot(spec, i))
            return shots, "llm", bg_concept

        # Fallback — Phase 1 behavior: one deterministic hook overlay with
        # the candidate's enriched title. No bg_concept on this path —
        # the heuristic extractor will pick a single-word fallback.
        hook_end = min(HOOK_DURATION_S, reel_duration_s)
        if hook_end > 0.3:
            return [self._build_hook_overlay(title, hook_end)], "deterministic_fallback", None
        return [], "deterministic_fallback", None

    async def _resolve_media_urls(
        self,
        specs: list[OverlaySpec],
    ) -> dict[int, str]:
        """Parallel-fetch Pexels URLs for every media spec in `specs`.

        Returns `{spec_index: url}`. Missing entries = lookup failed (no
        Pexels key, no match, transient error — all silent). Caller drops
        the corresponding spec entirely. Indices match the input order so
        spec_to_shot can map back without a per-spec ID.

        We fan out via `asyncio.gather(return_exceptions=True)` so one
        Pexels hiccup doesn't take down the whole batch.
        """
        media_indices: list[int] = []
        coros = []
        for i, spec in enumerate(specs):
            if spec.type == "broll_video":
                media_indices.append(i)
                coros.append(find_b_roll(spec.concept))
            elif spec.type == "broll_image":
                media_indices.append(i)
                coros.append(find_b_roll_image(spec.concept))
        if not coros:
            return {}
        results = await asyncio.gather(*coros, return_exceptions=True)
        out: dict[int, str] = {}
        for idx, res in zip(media_indices, results):
            if isinstance(res, BaseException):
                logger.warning(
                    f"[Director] media fetch raised for spec {idx}: {res}"
                )
                continue
            if isinstance(res, str) and res:
                out[idx] = res
        return out

    def _media_spec_to_shot(
        self,
        spec: OverlaySpec,
        idx: int,
        media_url: str,
    ) -> _Shot:
        """Map a broll_video / broll_image spec + its resolved Pexels URL
        to a `_Shot`. HTML strategy varies by type + position."""
        return _Shot(
            id=f"shot-overlay-{spec.type}-{idx:02d}",
            in_time=round(spec.t_start, 3),
            exit_time=round(spec.t_end, 3),
            # Stable stacking inside the media band — same idx ordering
            # as text overlays, but in a different band so text always
            # renders on top.
            z=Z_BROLL_MEDIA + idx,
            html=_build_media_overlay_html(spec, media_url),
            entry_meta={
                "shot_type": f"overlay_{spec.type}",
                "concept": spec.concept,
                "position": spec.position,
                "media_url": media_url,
            },
        )

    def _stat_spec_to_shot(self, spec: OverlaySpec, idx: int) -> _Shot:
        """Map an animated_stat / motion_graphic spec to a `_Shot`. HTML is
        entirely self-contained (CSS keyframes + inline SVG/divs for the
        graphic) so no Pexels lookup is needed and the render worker just
        captures the rendered frames."""
        if spec.type == "animated_stat":
            html = _build_stat_html(spec)
            meta = {
                "shot_type": f"overlay_{spec.type}",
                "value": spec.value,
                "subtitle": spec.subtitle,
                "position": spec.position,
                "color_intent": spec.color_intent,
            }
        else:  # motion_graphic
            html = _build_motion_graphic_html(spec)
            meta = {
                "shot_type": f"overlay_{spec.type}",
                "graphic_kind": spec.graphic_kind,
                "bars": spec.bars,
                "position": spec.position,
                "color_intent": spec.color_intent,
            }
        return _Shot(
            id=f"shot-overlay-{spec.type}-{idx:02d}",
            in_time=round(spec.t_start, 3),
            exit_time=round(spec.t_end, 3),
            # Same band as media — these are all "non-text visual" overlays
            # sharing the same z space. Text + captions render above.
            z=Z_BROLL_MEDIA + idx,
            html=html,
            entry_meta=meta,
        )

    def _spec_to_shot(self, spec: OverlaySpec, idx: int) -> _Shot:
        """Map one TEXT OverlaySpec to a styled `_Shot`. Visual treatment
        varies by `type` so hook / micro_hook / loop_back / emphasis don't
        all look identical. Media specs go through `_media_spec_to_shot`."""
        return _Shot(
            id=f"shot-overlay-{spec.type}-{idx:02d}",
            in_time=round(spec.t_start, 3),
            exit_time=round(spec.t_end, 3),
            z=Z_HOOK_OVERLAY + idx,   # 500, 501, 502, ... stable stacking
            html=_build_overlay_html(spec),
            entry_meta={
                "shot_type": f"overlay_{spec.type}",
                "text": spec.text,
                "color_intent": spec.color_intent,
            },
        )

    # ── Shot builders ─────────────────────────────────────────────────────

    @staticmethod
    def _build_base_shot(
        speaker_clip_url: str,
        duration: float,
        *,
        layout: str = "full_speaker_with_overlays",
        background_video_url: Optional[str] = None,
        speaker_fg_url: Optional[str] = None,
    ) -> _Shot:
        """Base shot HTML — shape depends on `layout`.

        Default (`full_speaker_with_overlays`): a single full-bleed
        `<video>` of the trimmed speaker clip. Playwright autoplays it
        muted during the per-frame screenshot pass; render worker captures
        frames as the video advances.

        `stacked_speaker_with_broll`: a `<div>` flex-column with the
        speaker on the top 50% and a user-supplied b-roll video on the
        bottom 50%. The b-roll is mute-autoplay-loop so it acts as
        ambient engagement glue (research §12.3 — dual-attention
        anchoring holds attention 30-45% longer). Required URL is
        validated upstream in `run()`; this builder trusts it.

        `pip_corner_speaker`: when `speaker_fg_url` is set (Phase 2d
        alpha-matte cutout) we render the speaker as a transparent
        silhouette overlay above the bgv — no rectangular border, no
        rounded-corner box. When `speaker_fg_url` is None (matting
        disabled / failed / older reels), we fall back to the original
        rectangular PiP window.
        """
        # data-source-start=0 — speaker_clip is ALREADY trimmed; play from
        # its own beginning, not a source-video offset.
        safe_speaker = html_lib.escape(speaker_clip_url, quote=True)

        if layout == "stacked_speaker_with_broll" and background_video_url:
            safe_bgv = html_lib.escape(background_video_url, quote=True)
            fragment = (
                '<div style="position:absolute;inset:0;display:flex;'
                'flex-direction:column;background:#000;">'
                # Speaker (top 50%) — crop to fill via object-fit:cover.
                '<div style="flex:1 1 50%;overflow:hidden;">'
                f'<video data-source-clip src="{safe_speaker}" '
                f'data-source-start="0" autoplay muted playsinline '
                'style="width:100%;height:100%;object-fit:cover;'
                'display:block"></video>'
                '</div>'
                # B-roll (bottom 50%) — loop so a short clip covers the
                # whole reel duration; muted because reel audio is owned
                # by the speaker_audio track.
                '<div style="flex:1 1 50%;overflow:hidden;">'
                f'<video src="{safe_bgv}" autoplay muted loop playsinline '
                'style="width:100%;height:100%;object-fit:cover;'
                'display:block"></video>'
                '</div>'
                '</div>'
            )
            entry_meta = {
                "shot_type": "stacked_base",
                "background_video_url": background_video_url,
            }
        elif layout == "pip_corner_speaker" and background_video_url:
            # Two variants share this branch:
            #   * Phase-2c.3 rectangular PiP — rounded bottom-right window
            #     showing the cropped speaker clip on top of the bgv.
            #   * Phase-2d alpha-matte cutout — when SOURCE_CLIP produced
            #     a transparent speaker_fg.webm, we render the silhouette
            #     full-frame over the bgv (no rectangular border, no
            #     rounded-corner box).
            # The variant is decided ENTIRELY by whether `speaker_fg_url`
            # is set; the upstream pipeline owns the policy (env flag +
            # matting success). Renderer just picks the right HTML.
            safe_bgv = html_lib.escape(background_video_url, quote=True)
            if speaker_fg_url:
                # Alpha-matte cutout (Phase 2d). The webm is RGBA so the
                # browser composites it directly over the bgv — no extra
                # blend-mode needed. We keep the `data-source-clip` data
                # attribute on the FG layer so the render worker scrubs
                # this video's currentTime in lockstep with the audio
                # track (same mechanism as the rectangular PiP).
                safe_fg = html_lib.escape(speaker_fg_url, quote=True)
                fragment = (
                    '<div style="position:absolute;inset:0;background:#000;">'
                    # Background fills the whole frame.
                    f'<video src="{safe_bgv}" autoplay muted loop playsinline '
                    'style="position:absolute;inset:0;width:100%;height:100%;'
                    'object-fit:cover;display:block"></video>'
                    # Speaker silhouette — full-frame alpha-matted webm.
                    # object-fit:cover matches the bgv crop strategy so
                    # the speaker stays centered + filling at any aspect.
                    f'<video data-source-clip src="{safe_fg}" '
                    f'data-source-start="0" autoplay muted playsinline '
                    'style="position:absolute;inset:0;width:100%;height:100%;'
                    'object-fit:cover;display:block;pointer-events:none"></video>'
                    '</div>'
                )
                entry_meta = {
                    "shot_type": "pip_alpha_cutout_base",
                    "background_video_url": background_video_url,
                    "speaker_fg_url": speaker_fg_url,
                }
            else:
                # Phase-2c.3 fallback: rectangular PiP. Speaker sits in a
                # rounded bottom-right window, bgv fills the rest. Sized
                # by HEIGHT (`height:35%; aspect-ratio:9/16`) rather than
                # width — that's the only way to keep the box vertically
                # bounded across all three aspect ratios. With width-driven
                # sizing the PiP would be ~614×1092px in a 1920×1080
                # (16:9) frame and overflow the bottom edge; height-driven
                # sizing keeps it at ~378px tall everywhere.
                fragment = (
                    '<div style="position:absolute;inset:0;background:#000;">'
                    f'<video src="{safe_bgv}" autoplay muted loop playsinline '
                    'style="position:absolute;inset:0;width:100%;height:100%;'
                    'object-fit:cover;display:block"></video>'
                    f'<video data-source-clip src="{safe_speaker}" '
                    f'data-source-start="0" autoplay muted playsinline '
                    'style="position:absolute;bottom:8%;right:6%;height:35%;'
                    'aspect-ratio:9/16;object-fit:cover;border-radius:16px;'
                    'box-shadow:0 8px 32px rgba(0,0,0,0.5);display:block"></video>'
                    '</div>'
                )
                entry_meta = {
                    "shot_type": "pip_corner_base",
                    "background_video_url": background_video_url,
                }
        else:
            fragment = (
                f'<video data-source-clip src="{safe_speaker}" '
                f'data-source-start="0" autoplay muted playsinline '
                'style="width:100%;height:100%;object-fit:cover;display:block"></video>'
            )
            entry_meta = {"shot_type": "speaker_clip_base"}

        return _Shot(
            id="shot-base",
            in_time=0.0,
            exit_time=round(duration, 3),
            z=Z_BASE,
            html=fragment,
            entry_meta=entry_meta,
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
    def _build_caption_blocks_from_reel_time(
        remapped: list[dict],
        total_duration: float,
        *,
        layout: str = "full_speaker_with_overlays",
        palette: Optional[dict] = None,
    ) -> list[_Shot]:
        """Group already-reel-time word_importance into caption phrase blocks.

        `remapped` is the output of `_remap_word_importance` — words have
        post-trim, post-atempo timestamps in `t_start`/`t_end`. We rename
        them here to `in_time`/`exit_time` for the grouping logic.

        `layout` controls vertical placement. For stacked layouts (which
        consume the bottom half of the frame for b-roll), captions shift
        upward so they sit on the speaker portion. Other layouts keep the
        default Y position.

        `palette` is the effective caption palette (already merged from
        STYLE_GUIDE's `style_palette` override onto DEFAULT_CAPTION_PALETTE
        by the caller). When None, falls back to DEFAULT inside the block
        builder for backwards-compatibility with older call paths.
        """
        remapped = [
            {
                "word": w["word"],
                "in_time": w["t_start"],
                "exit_time": w["t_end"],
                "importance": w["importance"],
                "keyword_type": w.get("keyword_type"),
                "emoji": w.get("emoji"),
            }
            for w in remapped
        ]

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
            html = _build_caption_block_html(block, layout=layout, palette=palette)
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

def _resolve_http_url(raw: Optional[str]) -> Optional[str]:
    """Apply the same http(s)-only gate we use for source_video and bgm URLs
    to layout-specific URLs (today: stacked layout's background video).

    Returns the trimmed URL if it parses as http(s) scheme; None otherwise.
    Defense in depth — `<video src=...>` rendered by Playwright happily
    fetches anything the URL resolves to, including local-file paths if the
    upstream config ever drifted.
    """
    if not raw or not isinstance(raw, str):
        return None
    url = raw.strip()
    if not url:
        return None
    lower = url.lower()
    if not (lower.startswith("https://") or lower.startswith("http://")):
        logger.warning(f"[Director] rejecting non-http(s) URL: {url[:80]!r}")
        return None
    return url


def _remap_word_importance(
    word_importance: list[dict],
    trim_map: dict,
) -> list[dict]:
    """Translate every word's source timecodes through `trim_map` so the
    rest of the director (LLM prompt + caption blocks) operates entirely
    in reel-timeline coordinates.

    Words that fall outside the source window or get fully consumed by a
    cut span are dropped.
    """
    out: list[dict] = []
    for w in word_importance:
        try:
            t_s = float(w.get("t_start") or 0.0)
            t_e = float(w.get("t_end") or 0.0)
        except (TypeError, ValueError):
            continue
        new_s = _source_to_reel_time(t_s, trim_map)
        new_e = _source_to_reel_time(t_e, trim_map)
        if new_s is None or new_e is None or new_e <= new_s:
            continue
        out.append({
            "word": str(w.get("word") or ""),
            "t_start": new_s,
            "t_end": new_e,
            "importance": int(w.get("importance") or 2),
            "keyword_type": w.get("keyword_type"),
            "emoji": w.get("emoji"),
        })
    return out


# Visual treatment per overlay type — bigger/bolder for the structural hooks,
# softer for emphasis so they don't fight the captions.
_OVERLAY_STYLE_BY_TYPE = {
    "hook": {
        "top_pct": 14, "font_weight": 900, "font_size_vw": 6.5,
        "uppercase": True, "letter_spacing": "-0.01em",
        "stroke_px": 1.5, "shadow": "0 4px 14px rgba(0,0,0,0.55)",
    },
    "micro_hook": {
        "top_pct": 28, "font_weight": 900, "font_size_vw": 5.5,
        "uppercase": True, "letter_spacing": "-0.005em",
        "stroke_px": 1.5, "shadow": "0 3px 10px rgba(0,0,0,0.55)",
    },
    "loop_back": {
        "top_pct": 14, "font_weight": 900, "font_size_vw": 6.5,
        "uppercase": True, "letter_spacing": "-0.01em",
        "stroke_px": 1.5, "shadow": "0 4px 14px rgba(0,0,0,0.55)",
    },
    "emphasis": {
        "top_pct": 36, "font_weight": 800, "font_size_vw": 4.5,
        "uppercase": False, "letter_spacing": "0",
        "stroke_px": 1.0, "shadow": "0 2px 6px rgba(0,0,0,0.5)",
    },
}

# Color intent → CSS color. Mirrors caption palette so the look stays cohesive
# between caption keyword pops and storyline overlays.
_OVERLAY_COLOR_BY_INTENT = {
    "neutral":    "#FFFFFF",
    "important":  DEFAULT_CAPTION_PALETTE["important"],
    "definition": DEFAULT_CAPTION_PALETTE["definition"],
    "warning":    DEFAULT_CAPTION_PALETTE["warning"],
}


def _build_overlay_html(spec: "OverlaySpec") -> str:
    """Render one OverlaySpec to a body-fragment HTML string.

    All overlays share the same "absolutely-positioned bold caption" base;
    `type` + `color_intent` choose the visual variant.
    """
    style = _OVERLAY_STYLE_BY_TYPE.get(spec.type, _OVERLAY_STYLE_BY_TYPE["emphasis"])
    color = _OVERLAY_COLOR_BY_INTENT.get(spec.color_intent, "#FFFFFF")
    text = html_lib.escape(spec.text)
    transform = "uppercase" if style["uppercase"] else "none"
    return (
        '<div style="'
        'position:absolute;'
        'left:6%;right:6%;'
        f'top:{style["top_pct"]}%;'
        f'font:{style["font_weight"]} {style["font_size_vw"]}vw/1.15 Inter,Montserrat,sans-serif;'
        f'letter-spacing:{style["letter_spacing"]};'
        f'text-transform:{transform};'
        f'color:{color};'
        'text-align:center;'
        f'-webkit-text-stroke:{style["stroke_px"]}px #000;'
        f'text-shadow:{style["shadow"]};'
        'pointer-events:none;'
        '">'
        f'{text}'
        '</div>'
    )


# CSS for media overlays at each supported position. The element itself
# (img or video) gets `object-fit:cover` so cropping handles whatever
# aspect Pexels returned vs whatever the reel is rendering at. Captions +
# text overlays sit at higher z-indexes so they always read on top.
_MEDIA_POSITION_CSS: dict[str, str] = {
    "full": (
        "position:absolute;inset:0;width:100%;height:100%;"
        "object-fit:cover;display:block;"
    ),
    # PiP-style top-right window. ~32% of frame width with a soft shadow +
    # border-radius so it reads as an inset card, not a glitch.
    "corner": (
        "position:absolute;top:6%;right:6%;width:32%;aspect-ratio:16/9;"
        "object-fit:cover;border-radius:12px;"
        "box-shadow:0 4px 16px rgba(0,0,0,0.45);display:block;"
    ),
    # Strip running across the bottom 30% of the frame. Captions in
    # full-speaker layout sit at bottom:18% (≈ y=80% from top) so they
    # land INSIDE this strip — fine for stock-footage backdrops where the
    # caption naturally reads against the b-roll content. The whoosh-cut
    # feel is what we want here, not pixel-perfect non-overlap.
    "lower_third": (
        "position:absolute;bottom:0;left:0;width:100%;height:30%;"
        "object-fit:cover;display:block;"
    ),
}


def _build_media_overlay_html(spec: "OverlaySpec", media_url: str) -> str:
    """Render a broll_video / broll_image OverlaySpec to HTML.

    Videos autoplay muted on loop — Playwright fetches the URL during the
    per-frame screenshot pass; muting is required for Chromium's autoplay
    policy to apply.

    Images use a plain `<img>` since they don't need playback. Same
    positioning CSS for both — the only difference is the element tag.

    Unknown position values fall back to "full" (the most-common b-roll
    convention; the validator already gates this but defense in depth).
    """
    css = _MEDIA_POSITION_CSS.get(spec.position, _MEDIA_POSITION_CSS["full"])
    safe_url = html_lib.escape(media_url, quote=True)
    if spec.type == "broll_video":
        return (
            f'<video src="{safe_url}" autoplay muted loop playsinline '
            f'style="{css}"></video>'
        )
    # broll_image
    safe_alt = html_lib.escape(spec.concept, quote=True)
    return f'<img src="{safe_url}" alt="{safe_alt}" style="{css}" />'


# ---------------------------------------------------------------------------
# Stat + motion-graphic HTML (Phase 2c.5 Slice 2)
# ---------------------------------------------------------------------------
#
# Both render entirely from spec fields — no Pexels, no S3. The render
# worker captures whatever Chromium paints during the per-frame screenshot
# pass, so CSS keyframe animations + inline SVG / div-based charts work
# unchanged.

# Where on the frame each stat/graphic position lives. Stat cards and bar
# charts are SMALL — they don't want to fill the frame the way a b-roll
# video does. `full` means "centered, large"; `corner` and `lower_third`
# keep the speaker visible.
#
# Each entry returns a "wrapper" CSS string that the type-specific builder
# slots its content into.
_STAT_WRAPPER_CSS: dict[str, str] = {
    # Centered card, ~70% of frame width. Top:32% leaves room for a hook
    # overlay above + captions below.
    "full": (
        "position:absolute;top:32%;left:15%;right:15%;height:36%;"
        "display:flex;flex-direction:column;align-items:center;justify-content:center;"
        "text-align:center;"
    ),
    "corner": (
        "position:absolute;top:6%;right:6%;width:36%;"
        "display:flex;flex-direction:column;align-items:center;justify-content:center;"
        "text-align:center;"
    ),
    # bottom:30% (not 18%) so the wrapper clears captions at bottom:18%
    # in full-speaker layout. The wrapper occupies y=48-70% from top —
    # still in the "lower half" semantically, just above the caption band.
    "lower_third": (
        "position:absolute;bottom:30%;left:6%;right:6%;height:22%;"
        "display:flex;flex-direction:column;align-items:center;justify-content:center;"
        "text-align:center;"
    ),
}

# Accent color picked from the caption palette per color_intent so stats /
# graphics stay visually coherent with keyword highlights.
_STAT_COLOR_BY_INTENT: dict[str, str] = {
    "neutral": "#FFFFFF",
    "important": DEFAULT_CAPTION_PALETTE["important"],   # yellow
    "definition": DEFAULT_CAPTION_PALETTE["definition"], # green
    "warning": DEFAULT_CAPTION_PALETTE["warning"],       # red
}


def _build_stat_html(spec: "OverlaySpec") -> str:
    """Render an animated_stat OverlaySpec.

    Big bold `value` with a scale-pop entry animation, optional `subtitle`
    underneath in smaller weight. Color comes from `color_intent`.
    Document-scoped @keyframes — each entry becomes its own iframe so
    keyframe names don't collide across shots.
    """
    wrapper = _STAT_WRAPPER_CSS.get(spec.position, _STAT_WRAPPER_CSS["full"])
    color = _STAT_COLOR_BY_INTENT.get(spec.color_intent, "#FFFFFF")
    value = html_lib.escape(spec.value)
    subtitle = html_lib.escape(spec.subtitle) if spec.subtitle else ""
    # Font size scales by position — full is much larger than corner.
    value_font_vw = {"full": 14, "corner": 7, "lower_third": 10}.get(spec.position, 14)
    subtitle_font_vw = {"full": 4, "corner": 2.5, "lower_third": 3}.get(spec.position, 4)
    subtitle_html = (
        f'<div style="font:700 {subtitle_font_vw}vw/1.25 Inter,Montserrat,sans-serif;'
        f'color:#FFFFFF;margin-top:0.6vw;letter-spacing:0.02em;'
        f'text-shadow:0 2px 8px rgba(0,0,0,0.55);">{subtitle}</div>'
        if subtitle else ""
    )
    return (
        '<style>'
        # Big scale-pop with slight overshoot — feels like the number
        # snaps in. 480ms is the sweet spot; faster looks twitchy.
        '@keyframes stat-pop{'
        '0%{opacity:0;transform:scale(0.35) translateY(20px)}'
        '60%{opacity:1;transform:scale(1.12) translateY(-4px)}'
        '100%{opacity:1;transform:scale(1) translateY(0)}'
        '}'
        '</style>'
        f'<div style="{wrapper}pointer-events:none;">'
        f'<div style="font:900 {value_font_vw}vw/1 Inter,Montserrat,sans-serif;'
        f'color:{color};letter-spacing:-0.02em;'
        '-webkit-text-stroke:2px #000;'
        'text-shadow:0 6px 20px rgba(0,0,0,0.6);'
        'animation:stat-pop 480ms both;">'
        f'{value}</div>'
        f'{subtitle_html}'
        '</div>'
    )


# Pie-chart wedge palette. Picks 4 distinguishable hues from the caption
# palette plus a complementary blue so 2-4 wedges always look distinct.
# Cycled positionally — wedge[i] = _PIE_PALETTE[i % len(_PIE_PALETTE)].
_PIE_PALETTE = [
    DEFAULT_CAPTION_PALETTE["important"],   # yellow
    DEFAULT_CAPTION_PALETTE["definition"],  # green
    DEFAULT_CAPTION_PALETTE["warning"],     # red
    "#5BC0EB",                              # complementary blue
]


def _format_chart_value(v: float) -> str:
    """Inline display of a numeric chart value.

    Integer-looking values render as ints ("100"); small floats keep one
    decimal ("2.5"); larger floats round to int ("104.7" → "105"). Used
    by every motion_graphic renderer so value formatting stays consistent
    across bar / line / pie / comparison.
    """
    if v == 0:
        return "0"
    if v == int(v):
        return f"{int(v)}"
    if abs(v) < 10:
        return f"{v:.1f}"
    return f"{int(round(v))}"


def _build_motion_graphic_html(spec: "OverlaySpec") -> str:
    """Dispatch a motion_graphic OverlaySpec to its kind-specific renderer.

    Adding a new graphic_kind:
      1. Append to `_GRAPHIC_KIND_SPECS` in `reels_llm_director_service.py`
         with its (min_bars, max_bars, values_required, max_label_len).
      2. Add a `_build_<kind>_html(spec)` function below.
      3. Wire its branch into this dispatcher.
    Validator + LLM prompt already cover the data shape.
    """
    if not spec.bars:
        return '<div></div>'
    if spec.graphic_kind == "bar_chart":
        return _build_bar_chart_html(spec)
    if spec.graphic_kind == "line_chart":
        return _build_line_chart_html(spec)
    if spec.graphic_kind == "pie_chart":
        return _build_pie_chart_html(spec)
    if spec.graphic_kind == "comparison_icons":
        return _build_comparison_icons_html(spec)
    # Unknown kind shouldn't reach here (validator blocks) — defensive
    # empty fragment so a malformed spec never breaks the render.
    return '<div></div>'


def _build_bar_chart_html(spec: "OverlaySpec") -> str:
    """Vertical bar chart (2-3 bars).

    Bars are flex children of a row-flex container, each grows from
    height:0 to its computed share-of-max via a `bar-grow` keyframe.
    Bars stagger 120ms each so the chart fills in left-to-right rather
    than blocking up at once — matches TikTok motion-graphic conventions.

    Per-bar height capped at 70% (NOT 100%) of the bar column because the
    bar div is a flex-column sibling of value-text + label-text. Letting
    the bar consume 100% would push the labels out of view.
    """
    wrapper = _STAT_WRAPPER_CSS.get(spec.position, _STAT_WRAPPER_CSS["full"])
    color = _STAT_COLOR_BY_INTENT.get(spec.color_intent, "#FFFFFF")
    max_value = max((float(b.get("value") or 0) for b in spec.bars), default=1.0)
    if max_value <= 0:
        max_value = 1.0
    bar_html: list[str] = []
    for i, b in enumerate(spec.bars):
        label = html_lib.escape(str(b.get("label") or ""))
        val = float(b.get("value") or 0)
        display_v = _format_chart_value(val)
        # 8% floor keeps tiny bars (relative to a huge max) still visible.
        height_pct = max(8.0, min(70.0, (val / max_value) * 70.0))
        delay_s = i * 0.12
        bar_html.append(
            '<div style="flex:1;display:flex;flex-direction:column;align-items:center;'
            'justify-content:flex-end;height:100%;gap:0.4vw;">'
            f'<div style="font:800 3vw/1 Inter,Montserrat,sans-serif;'
            f'color:{color};letter-spacing:-0.01em;'
            '-webkit-text-stroke:1.5px #000;'
            'text-shadow:0 2px 6px rgba(0,0,0,0.5);">'
            f'{display_v}</div>'
            f'<div class="vx-bar" style="width:62%;background:{color};'
            'border-radius:8px 8px 0 0;'
            f'animation:bar-grow 520ms {delay_s:.2f}s both;'
            f'--vx-target-h:{height_pct:.1f}%;'
            'box-shadow:0 4px 16px rgba(0,0,0,0.45);">'
            '</div>'
            f'<div style="font:700 2.2vw/1.2 Inter,Montserrat,sans-serif;'
            'color:#FFFFFF;letter-spacing:0.02em;'
            'text-shadow:0 2px 6px rgba(0,0,0,0.55);">'
            f'{label}</div>'
            '</div>'
        )
    bars_inner = "".join(bar_html)
    return (
        '<style>'
        # CSS custom property `--vx-target-h` carries the per-bar target
        # height; the keyframe interpolates from 0 to that value.
        '@keyframes bar-grow{'
        '0%{height:0%}'
        '100%{height:var(--vx-target-h)}'
        '}'
        '</style>'
        f'<div style="{wrapper}pointer-events:none;">'
        # `min-height:22vh` is load-bearing for the corner position: that
        # wrapper has no explicit height, so `height:100%` here would
        # resolve to auto → the bar's `height:var(--vx-target-h)` (a %)
        # would have no resolved parent height to compute against and
        # render at 0px. `vh` (not `vw`) is critical: `22vh` exactly
        # equals the `lower_third` wrapper's `height:22%` regardless of
        # aspect, so it never overflows there; in 16:9 the `full`
        # wrapper's 36% × 1080 = 388px also exceeds 22vh = 237px. Using
        # `22vw` would have overflowed in 16:9 (22% × 1920 = 422px).
        '<div style="display:flex;align-items:flex-end;justify-content:center;'
        'gap:6%;width:100%;height:100%;min-height:22vh;">'
        f'{bars_inner}'
        '</div>'
        '</div>'
    )


def _build_line_chart_html(spec: "OverlaySpec") -> str:
    """SVG line chart with animated stroke-dashoffset draw (2-5 points).

    Uses an SVG viewBox of 0-100 in both axes so all sizing is relative.
    `preserveAspectRatio="xMidYMid meet"` letterboxes the chart inside
    the wrapper at any aspect, keeping the curve geometry intact (vs
    `none` which would warp stroke widths and circle radii).

    Animation: the polyline's `stroke-dasharray` is set to the polyline's
    total length and `stroke-dashoffset` animates from that length to 0
    so the line "draws" left-to-right over ~700ms. Point dots + value
    labels fade in staggered behind the draw cursor.
    """
    bars = spec.bars
    n = len(bars)
    if n < 2:
        return '<div></div>'
    wrapper = _STAT_WRAPPER_CSS.get(spec.position, _STAT_WRAPPER_CSS["full"])
    color = _STAT_COLOR_BY_INTENT.get(spec.color_intent, "#FFFFFF")

    values = [float(b.get("value") or 0) for b in bars]
    labels = [str(b.get("label") or "") for b in bars]
    min_v = min(values)
    max_v = max(values)
    # When all values are equal the range collapses. Detect this and
    # force y_norm=0.5 so the flat line sits at the chart's vertical
    # midline. The naive divide-by-zero fallback (range_v=1.0) would
    # produce y_norm=0 — pinning the line to the BOTTOM of the chart.
    range_v = max_v - min_v
    all_equal = range_v < 1e-6
    if all_equal:
        range_v = 1.0

    # Chart-area bounds inside viewBox 0..100. Top 15 reserved for value
    # labels above points; bottom 18 reserved for x-axis labels below.
    x_lo, x_hi = 6.0, 94.0
    y_lo, y_hi = 18.0, 78.0  # y_lo is the TOP (where max value sits)
    points: list[tuple[float, float]] = []
    for i, v in enumerate(values):
        x = x_lo + (x_hi - x_lo) * (i / (n - 1))
        # SVG y-axis is top-down: higher value → lower y. All-equal case
        # is forced to midline (see all_equal comment above).
        y_norm = 0.5 if all_equal else (v - min_v) / range_v
        y = y_hi - (y_hi - y_lo) * y_norm
        points.append((x, y))
    polyline_pts = " ".join(f"{x:.2f},{y:.2f}" for x, y in points)

    # Total polyline length for stroke-dashoffset trick. Overestimate by
    # 5% so the draw animation always completes cleanly even if our
    # rounding introduces tiny error.
    perimeter = sum(
        ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5
        for (x1, y1), (x2, y2) in zip(points, points[1:])
    )
    perimeter = max(40.0, perimeter * 1.05)

    # Per-point dots + value labels + x-axis labels. Each dot/label fades
    # in just after the draw cursor reaches it: dot delay = 0.08 + i*draw_pct.
    draw_ms = 700
    point_delay_lead_ms = 80
    circles_html: list[str] = []
    value_label_html: list[str] = []
    axis_label_html: list[str] = []
    for i, (x, y) in enumerate(points):
        # Fraction of the way through the line, scaled to the draw time
        delay_s = (point_delay_lead_ms + draw_ms * (i / max(1, n - 1))) / 1000.0
        circles_html.append(
            f'<circle cx="{x:.2f}" cy="{y:.2f}" r="1.6" '
            f'fill="{color}" stroke="#000" stroke-width="0.5" '
            f'style="opacity:0;animation:line-point 220ms {delay_s:.2f}s forwards;'
            'filter:drop-shadow(0 1px 2px rgba(0,0,0,0.55));" />'
        )
        value_label_html.append(
            f'<text x="{x:.2f}" y="{max(6.0, y - 4.0):.2f}" '
            'font-family="Inter,Montserrat,sans-serif" font-weight="800" '
            f'font-size="4.2" fill="{color}" text-anchor="middle" '
            f'paint-order="stroke" stroke="#000" stroke-width="1" '
            f'style="opacity:0;animation:line-point 220ms {delay_s:.2f}s forwards;">'
            f'{html_lib.escape(_format_chart_value(values[i]))}</text>'
        )
        axis_label_html.append(
            f'<text x="{x:.2f}" y="92" '
            'font-family="Inter,Montserrat,sans-serif" font-weight="700" '
            'font-size="4" fill="#FFFFFF" text-anchor="middle" '
            'paint-order="stroke" stroke="#000" stroke-width="0.8" '
            f'style="opacity:0;animation:line-point 220ms {delay_s:.2f}s forwards;">'
            f'{html_lib.escape(labels[i])}</text>'
        )

    # Inner container sets its own aspect-ratio so the SVG has dimensions
    # at "corner" position too (the corner wrapper has no explicit height).
    inner_aspect = {"full": "16/10", "corner": "1/1", "lower_third": "16/9"}.get(
        spec.position, "16/10"
    )
    return (
        '<style>'
        '@keyframes line-draw{to{stroke-dashoffset:0}}'
        '@keyframes line-point{to{opacity:1}}'
        '</style>'
        f'<div style="{wrapper}pointer-events:none;">'
        f'<div style="width:100%;aspect-ratio:{inner_aspect};max-height:100%;">'
        '<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" '
        'style="width:100%;height:100%;overflow:visible;">'
        f'<polyline points="{polyline_pts}" fill="none" stroke="{color}" '
        'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" '
        f'style="stroke-dasharray:{perimeter:.1f};stroke-dashoffset:{perimeter:.1f};'
        f'animation:line-draw {draw_ms}ms {point_delay_lead_ms}ms forwards;'
        'filter:drop-shadow(0 3px 6px rgba(0,0,0,0.55));" />'
        f'{"".join(circles_html)}'
        f'{"".join(value_label_html)}'
        f'{"".join(axis_label_html)}'
        '</svg>'
        '</div>'
        '</div>'
    )


def _build_pie_chart_html(spec: "OverlaySpec") -> str:
    """Conic-gradient pie chart with scale-pop entry + percentage legend (2-4 wedges).

    Uses CSS `conic-gradient` rather than SVG arc paths — much simpler
    and chromium handles it cleanly in our playwright render pipeline.
    Each wedge gets a color from `_PIE_PALETTE` cycled positionally so
    2-4 wedges always look distinct (color_intent influences the legend
    accent only — the pie itself uses the full palette for differentiation).

    Animation: the whole disc scales + rotates in over 600ms; legend
    items fade in staggered after that.
    """
    bars = spec.bars
    if len(bars) < 2:
        return '<div></div>'
    wrapper = _STAT_WRAPPER_CSS.get(spec.position, _STAT_WRAPPER_CSS["full"])

    values = [float(b.get("value") or 0) for b in bars]
    labels = [str(b.get("label") or "") for b in bars]
    total = sum(values)
    if total <= 0:
        # All-zero would render as a degenerate disc; validator should
        # have blocked this but be defensive.
        return '<div></div>'

    wedge_colors = [_PIE_PALETTE[i % len(_PIE_PALETTE)] for i in range(len(values))]

    # Build conic-gradient color stops as cumulative percentages.
    stops: list[str] = []
    cumulative_pct = 0.0
    for v, c in zip(values, wedge_colors):
        start_pct = cumulative_pct
        cumulative_pct += (v / total) * 100.0
        stops.append(f"{c} {start_pct:.2f}% {cumulative_pct:.2f}%")
    gradient = ", ".join(stops)

    # Per-position sizing for the disc + legend.
    disc_width = {"full": "55%", "corner": "70%", "lower_third": "30%"}.get(
        spec.position, "55%"
    )
    legend_font_vw = {"full": 2.4, "corner": 1.3, "lower_third": 2.0}.get(
        spec.position, 2.4
    )
    legend_dot_vw = {"full": 1.4, "corner": 0.9, "lower_third": 1.2}.get(
        spec.position, 1.4
    )
    legend_gap_vw = {"full": 2.0, "corner": 1.0, "lower_third": 1.5}.get(
        spec.position, 2.0
    )

    legend_items: list[str] = []
    for i, (label, val) in enumerate(zip(labels, values)):
        pct = (val / total) * 100.0
        delay_s = 0.55 + i * 0.08
        legend_items.append(
            f'<div style="display:flex;align-items:center;gap:0.5vw;'
            f'opacity:0;animation:pie-legend 280ms {delay_s:.2f}s forwards;'
            f'font:800 {legend_font_vw}vw/1.1 Inter,Montserrat,sans-serif;'
            'color:#FFFFFF;letter-spacing:0.02em;'
            '-webkit-text-stroke:0.8px #000;'
            'text-shadow:0 2px 6px rgba(0,0,0,0.55);">'
            f'<span style="display:inline-block;width:{legend_dot_vw}vw;'
            f'height:{legend_dot_vw}vw;border-radius:50%;background:{wedge_colors[i]};'
            'box-shadow:0 0 0 1px rgba(0,0,0,0.55), 0 2px 4px rgba(0,0,0,0.45);">'
            '</span>'
            f'<span>{html_lib.escape(label)} {pct:.0f}%</span>'
            '</div>'
        )
    legend_html = "".join(legend_items)

    return (
        '<style>'
        '@keyframes pie-pop{'
        '0%{opacity:0;transform:scale(0.4) rotate(-90deg)}'
        '70%{opacity:1;transform:scale(1.08) rotate(-12deg)}'
        '100%{opacity:1;transform:scale(1) rotate(0)}'
        '}'
        '@keyframes pie-legend{to{opacity:1}}'
        '</style>'
        f'<div style="{wrapper}pointer-events:none;gap:1vw;">'
        # The pie disc — conic-gradient renders the wedges; pie-pop
        # animates it in.
        f'<div style="width:{disc_width};aspect-ratio:1;border-radius:50%;'
        f'background:conic-gradient({gradient});'
        'box-shadow:0 8px 28px rgba(0,0,0,0.55),inset 0 0 0 2px rgba(0,0,0,0.25);'
        'animation:pie-pop 600ms both;"></div>'
        # Legend row below
        f'<div style="display:flex;flex-wrap:wrap;justify-content:center;'
        f'align-items:center;gap:0.6vw {legend_gap_vw}vw;max-width:96%;">'
        f'{legend_html}'
        '</div>'
        '</div>'
    )


def _build_comparison_icons_html(spec: "OverlaySpec") -> str:
    """Two-card qualitative comparison with VS divider (exactly 2 items).

    Cards slide in from their respective sides (left from left, right from
    right) with the VS pill popping in between them after a brief delay.
    Values are optional — when a bar's value <= 0 we render label-only;
    when > 0 we show the value above the label as a big bold number.

    Layout: row-flex with `flex:1` on each card, centered VS pill between.
    The wrapper's outer column-flex is overridden by an inner row-flex
    div that sets `flex-direction:row` explicitly.
    """
    bars = spec.bars
    if len(bars) < 2:
        return '<div></div>'
    left, right = bars[0], bars[1]
    wrapper = _STAT_WRAPPER_CSS.get(spec.position, _STAT_WRAPPER_CSS["full"])
    color = _STAT_COLOR_BY_INTENT.get(spec.color_intent, "#FFFFFF")

    # Per-position sizing — comparison cards are big at full, compact at
    # corner (small space), wide at lower_third (horizontal band).
    value_vw = {"full": 6.0, "corner": 3.0, "lower_third": 4.5}.get(spec.position, 6.0)
    label_vw = {"full": 3.6, "corner": 2.0, "lower_third": 3.0}.get(spec.position, 3.6)
    vs_vw = {"full": 4.5, "corner": 2.5, "lower_third": 3.5}.get(spec.position, 4.5)

    def _card_html(item: dict, side: str) -> str:
        label = html_lib.escape(str(item.get("label") or ""))
        val = float(item.get("value") or 0)
        delay_ms = 0 if side == "left" else 120
        anim = "cmp-slide-left" if side == "left" else "cmp-slide-right"
        value_block = ""
        if val > 0:
            value_block = (
                f'<div style="font:900 {value_vw}vw/1 Inter,Montserrat,sans-serif;'
                f'color:{color};letter-spacing:-0.01em;'
                '-webkit-text-stroke:1.5px #000;'
                'text-shadow:0 3px 10px rgba(0,0,0,0.55);">'
                f'{_format_chart_value(val)}</div>'
            )
        return (
            f'<div style="flex:1;display:flex;flex-direction:column;'
            'align-items:center;justify-content:center;gap:0.7vw;'
            f'animation:{anim} 480ms {delay_ms}ms both;opacity:0;">'
            f'{value_block}'
            f'<div style="font:800 {label_vw}vw/1.15 Inter,Montserrat,sans-serif;'
            'color:#FFFFFF;letter-spacing:0.02em;text-align:center;'
            'padding:0 0.4vw;'
            '-webkit-text-stroke:1.1px #000;'
            'text-shadow:0 2px 8px rgba(0,0,0,0.55);">'
            f'{label}</div>'
            '</div>'
        )

    return (
        '<style>'
        '@keyframes cmp-slide-left{'
        '0%{opacity:0;transform:translateX(-30%)}'
        '100%{opacity:1;transform:translateX(0)}'
        '}'
        '@keyframes cmp-slide-right{'
        '0%{opacity:0;transform:translateX(30%)}'
        '100%{opacity:1;transform:translateX(0)}'
        '}'
        '@keyframes cmp-vs-pop{'
        '0%{opacity:0;transform:scale(0.3)}'
        '70%{opacity:1;transform:scale(1.2)}'
        '100%{opacity:1;transform:scale(1)}'
        '}'
        '</style>'
        f'<div style="{wrapper}pointer-events:none;">'
        # Inner row-flex — overrides the wrapper's column direction.
        '<div style="display:flex;flex-direction:row;align-items:center;'
        'justify-content:center;gap:1vw;width:100%;height:100%;">'
        f'{_card_html(left, "left")}'
        # VS divider — pops in after both cards have started sliding.
        f'<div style="font:900 {vs_vw}vw/1 Inter,Montserrat,sans-serif;'
        f'color:{color};letter-spacing:0.04em;flex:0 0 auto;'
        '-webkit-text-stroke:2px #000;'
        'text-shadow:0 4px 12px rgba(0,0,0,0.65);'
        'animation:cmp-vs-pop 480ms 220ms both;opacity:0;">'
        'VS</div>'
        f'{_card_html(right, "right")}'
        '</div>'
        '</div>'
    )


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


# Caption Y-position per layout. Default `bottom:18%` sits in the lower
# third of the frame (research §12.4 — Y≈70% from top is the universal
# caption convention). Stacked layout has b-roll occupying the bottom 50%
# of the frame, so captions shift up to sit just above the split — still
# inside the speaker half. New layouts get appended here without touching
# the HTML builder body.
_CAPTION_BOTTOM_PCT_BY_LAYOUT: dict = {
    "full_speaker_with_overlays": 18,
    "stacked_speaker_with_broll": 53,   # ~1056px from bottom in a 1920 frame
    # PiP speaker corner is sized by HEIGHT (35% of frame). Across aspects,
    # the PiP's top edge sits at 1 - 0.08 - 0.35 = 57% of frame height from
    # the bottom — so caption `bottom` must exceed 57% to clear it, with
    # margin for the caption's own text height (~5% of frame). 45% gives a
    # safe ~10% clearance in the worst case (1:1 aspect).
    "pip_corner_speaker": 45,
}
_CAPTION_BOTTOM_PCT_DEFAULT = 18


def _build_caption_block_html(
    block: list[dict],
    *,
    layout: str = "full_speaker_with_overlays",
    palette: Optional[dict] = None,
) -> str:
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
        from `palette` (default Hormozi yellow / definition green /
        warning red, or a STYLE_GUIDE override for `important`); normal
        words are white. Both pop on reveal.
      - Y position varies by `layout` — see `_CAPTION_BOTTOM_PCT_BY_LAYOUT`.

    NB: scrubbing the editor backward then forward will re-mount the
    iframe — animations replay from the start. Live playback (the render
    worker's case) plays linearly so animations sync correctly.
    """
    # Fall back to DEFAULT_CAPTION_PALETTE when caller didn't pass one
    # (e.g. test fixtures, future call sites that haven't been migrated).
    pal = palette if isinstance(palette, dict) and palette else DEFAULT_CAPTION_PALETTE
    body_color = pal.get("body", DEFAULT_CAPTION_PALETTE["body"])
    stroke_color = pal.get("stroke", DEFAULT_CAPTION_PALETTE["stroke"])
    block_in = float(block[0]["in_time"])
    bottom_pct = _CAPTION_BOTTOM_PCT_BY_LAYOUT.get(layout, _CAPTION_BOTTOM_PCT_DEFAULT)

    spans: list[str] = []
    for w in block:
        text = html_lib.escape(str(w["word"]).strip())
        if not text:
            continue
        kt = w.get("keyword_type")
        color = pal.get(kt) if kt else body_color
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
        # Emoji punctuation (Phase 2c.7) — appended AFTER the word's
        # main span when the LLM tagged this slot. The emoji pops in
        # 150ms after the word reveals so it punches rather than competes
        # with the word's own scale-pop. -webkit-text-stroke and
        # text-shadow inherited from the block wrapper would harm emoji
        # rendering, so we reset them on the emoji span. Emoji escaping
        # via html_lib is harmless — emoji characters pass through.
        emoji = w.get("emoji")
        if emoji:
            emoji_offset = offset + 0.15
            safe_emoji = html_lib.escape(str(emoji))
            spans.append(
                '<span style="'
                'display:inline-block;'
                'opacity:0;'
                'margin-left:0.18em;'
                '-webkit-text-stroke:0;'
                'text-shadow:0 2px 4px rgba(0,0,0,0.45);'
                f'animation:emoji-pop 360ms {emoji_offset:.3f}s both;'
                '">'
                f'{safe_emoji}'
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
        # Emoji-pop is a wider scale + slight rotation so it visually
        # contrasts with the karaoke-reveal of adjacent words. Larger
        # overshoot than karaoke-reveal (1.4× vs 1.12×) makes the emoji
        # feel like a punchline rather than continuation.
        '@keyframes emoji-pop{'
        '0%{opacity:0;transform:scale(0.3) rotate(-15deg)}'
        '60%{opacity:1;transform:scale(1.4) rotate(8deg)}'
        '100%{opacity:1;transform:scale(1) rotate(0)}'
        '}'
        '</style>'
        '<div style="'
        'position:absolute;'
        'left:6%;right:6%;'
        f'bottom:{bottom_pct}%;'
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
    """Async handler. The LLM overlay step is a real network hop, so
    `run()` is async natively — no thread wrapper needed."""
    svc = ReelsDirectorService()
    await svc.run(ctx)


register_stage_handler(STAGE_DIRECTOR, _director_stage)
