"""
Text overlay renderer — a short bright text callout (lower-third, kicker,
emphasis line) positioned over the underlying clip. Returns a full-canvas
transparent HTML body; text is bright so it composites over SOURCE_CLIP footage.

position ∈ {"top","center","bottom","lower_third"}.
style    ∈ {"plain","bold","highlight"} — "highlight" adds a bright accent
            underline (NOT a dark backing bar, which the worker would key out).
"""
from __future__ import annotations

from typing import Optional

from ._render_common import (
    DEFAULT_ACCENT_COLOR,
    DEFAULT_TEXT_COLOR,
    esc,
    wrap_overlay,
)

_POSITIONS = {
    "top": "top:8%;",
    "center": "top:50%;transform:translateY(-50%);",
    "bottom": "bottom:8%;",
    "lower_third": "bottom:16%;",
}
_STYLE_SIZE = {
    "plain": ("3.0vw", "600"),
    "bold": ("3.8vw", "800"),
    "highlight": ("3.4vw", "700"),
}


def render_text_overlay_html(
    text: str,
    *,
    position: str = "bottom",
    style: str = "plain",
    text_color: Optional[str] = None,
    accent_color: Optional[str] = None,
) -> str:
    """Render a text overlay. `text` required; unknown position/style fall back
    to bottom/plain."""
    text = (text or "").strip()
    if not text:
        return wrap_overlay("", label="text")

    color = text_color or DEFAULT_TEXT_COLOR
    a_color = accent_color or DEFAULT_ACCENT_COLOR
    pos_css = _POSITIONS.get(position, _POSITIONS["bottom"])
    font_size, font_weight = _STYLE_SIZE.get(style, _STYLE_SIZE["plain"])

    text_html = (
        f'<div style="color:{esc(color)};font-weight:{font_weight};'
        f'font-size:{font_size};line-height:1.2">' + esc(text) + "</div>"
    )
    accent_html = ""
    if style == "highlight":
        accent_html = (
            f'<div style="width:6vw;height:0.5vh;min-height:3px;'
            f'background:{esc(a_color)};border-radius:999px;margin-top:1.2vh"></div>'
        )

    inner = (
        f'<div style="position:absolute;left:6%;right:6%;{pos_css}'
        'display:flex;flex-direction:column;align-items:center;text-align:center">'
        f"{text_html}{accent_html}"
        "</div>"
    )
    return wrap_overlay(inner, label="text")
