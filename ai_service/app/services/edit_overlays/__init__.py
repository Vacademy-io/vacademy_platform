"""
edit_overlays — studio-native overlay HTML renderers.

A small, dependency-free package that turns overlay specs (titles, text
overlays) into self-contained HTML strings for the Studio timeline's overlay
ENTRIES. Each renderer returns a FULL-CANVAS HTML body whose visible content is
positioned with internal absolute CSS over a TRANSPARENT background — so when
the render worker composites a SOURCE_CLIP under the rendered HTML frame, the
clip shows through everywhere the overlay is transparent/dark and only the
BRIGHT overlay pixels (the text) land on top (worker.py brightness mask).

Why studio-native (not extracted from reels):
  reels' caption/overlay renderers are coupled to reel-time (`_source_to_reel_time`
  + a single trim_map), reel layout names (`_CAPTION_BOTTOM_PCT_BY_LAYOUT`), and
  an `OverlaySpec` that lives inside the reels LLM director. Studio composes N
  source assets each in their own seconds and anchors overlays to the COMPOSED
  timeline, so these renderers take explicit numeric placement + final-timeline
  coordinates and carry none of reel's layout/reframe state. A future dedup
  refactor can unify the two with a shared spec; that is intentionally out of
  this slice (P6) to keep the shipped reels pipeline untouched.

⚠️ LUMA-KEY CONSTRAINT (read before adding a renderer): over a SOURCE_CLIP the
worker keeps only BRIGHT (non-black) overlay pixels. Use bright text; do NOT
rely on dark drop-shadows or dark/semi-transparent backing bars for legibility
over footage — they are keyed out in the final render (they only show in the
editor preview and over IMAGE_STILL entries). Bright accents (lines/underlines)
are safe. Keep visible content bright.
"""
from __future__ import annotations

from .titles import render_title_html
from .text_overlays import render_text_overlay_html

__all__ = ["render_title_html", "render_text_overlay_html"]
