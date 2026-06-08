"""
Shared bits for the studio overlay renderers: HTML escaping, the full-canvas
transparent wrapper, and the default bright palette.

Kept tiny and dependency-free (stdlib `html` only) so both titles.py and
text_overlays.py — and any future studio overlay renderer — share one wrapper
and one escaping path.
"""
from __future__ import annotations

import html as _html
from typing import Optional

# Bright, legible defaults. Everything here must stay BRIGHT — see the package
# docstring's luma-key note. The accent is a vivid hue that survives the
# brightness mask as a thin bright line.
DEFAULT_TITLE_COLOR = "#ffffff"
DEFAULT_SUBTITLE_COLOR = "#e8eaed"
DEFAULT_TEXT_COLOR = "#ffffff"
DEFAULT_ACCENT_COLOR = "#ffd54a"

# Safe font stack present on the render worker (system + common web fonts).
FONT_STACK = (
    "'Inter','Montserrat','Helvetica Neue',Arial,'Noto Sans',system-ui,sans-serif"
)


def esc(text: Optional[str]) -> str:
    """HTML-escape user/LLM text for safe inline embedding (quotes included)."""
    return _html.escape(str(text or ""), quote=True)


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def wrap_overlay(inner_html: str, *, label: str = "overlay") -> str:
    """Wrap positioned inner content in a full-canvas, TRANSPARENT layer.

    The entry is rendered into a 100%×100% iframe (EditorCanvas/worker), so the
    wrapper fills the canvas and the inner content positions itself with
    absolute CSS. Background stays transparent so footage shows through.
    `pointer-events:none` keeps the overlay from stealing clicks in the editor.
    """
    return (
        f'<div data-studio-overlay="{esc(label)}" '
        'style="position:absolute;inset:0;overflow:hidden;'
        'background:transparent;pointer-events:none;'
        f'font-family:{FONT_STACK}">'
        f"{inner_html}"
        "</div>"
    )
