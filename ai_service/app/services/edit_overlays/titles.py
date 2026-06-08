"""
Title overlay renderer — a centered or lower-third title card that sits ON TOP
of the underlying clip/still for a few seconds (intro card, section title,
name super). Returns a full-canvas transparent HTML body; the title text is
bright so it composites correctly over SOURCE_CLIP footage.

Placement:
  * "center" — large title vertically + horizontally centered (intro/section).
  * "lower"  — title block anchored in the lower third (name super / kicker).

Sizes are vw/vh-relative so the same card reads correctly at 16:9, 9:16, 1:1.
"""
from __future__ import annotations

from typing import Optional

from ._render_common import (
    DEFAULT_ACCENT_COLOR,
    DEFAULT_SUBTITLE_COLOR,
    DEFAULT_TITLE_COLOR,
    esc,
    wrap_overlay,
)


def render_title_html(
    title: str,
    *,
    subtitle: Optional[str] = None,
    placement: str = "center",
    title_color: Optional[str] = None,
    subtitle_color: Optional[str] = None,
    accent_color: Optional[str] = None,
) -> str:
    """Render a title card overlay.

    `title` is required; `subtitle` optional. Colors default to the bright
    palette. `placement` ∈ {"center","lower"} (unknown → "center").
    """
    title = (title or "").strip()
    if not title:
        return wrap_overlay("", label="title")

    t_color = title_color or DEFAULT_TITLE_COLOR
    s_color = subtitle_color or DEFAULT_SUBTITLE_COLOR
    a_color = accent_color or DEFAULT_ACCENT_COLOR

    if placement == "lower":
        block_pos = (
            "position:absolute;left:6%;right:6%;bottom:12%;text-align:left;"
        )
        title_size = "5.2vw"
        align_items = "flex-start"
    else:  # center
        block_pos = (
            "position:absolute;left:8%;right:8%;top:50%;"
            "transform:translateY(-50%);text-align:center;"
        )
        title_size = "6.4vw"
        align_items = "center"

    # A short bright accent bar above the title — survives the luma-key mask.
    accent = (
        f'<div style="width:9vw;height:0.5vh;min-height:3px;'
        f'background:{esc(a_color)};border-radius:999px;margin-bottom:1.6vh"></div>'
    )
    title_html = (
        f'<div style="color:{esc(t_color)};font-weight:800;'
        f"font-size:{title_size};line-height:1.06;letter-spacing:-0.01em;"
        '">' + esc(title) + "</div>"
    )
    subtitle_html = ""
    if subtitle and subtitle.strip():
        subtitle_html = (
            f'<div style="color:{esc(s_color)};font-weight:500;'
            'font-size:2.6vw;line-height:1.25;margin-top:1.4vh;opacity:0.92">'
            + esc(subtitle.strip())
            + "</div>"
        )

    inner = (
        f'<div style="{block_pos}display:flex;flex-direction:column;'
        f'align-items:{align_items}">'
        f"{accent}{title_html}{subtitle_html}"
        "</div>"
    )
    return wrap_overlay(inner, label="title")
