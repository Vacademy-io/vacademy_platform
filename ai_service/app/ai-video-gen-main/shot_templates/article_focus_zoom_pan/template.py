"""article_focus_zoom_pan — Show the source article page, slow GSAP zoom-pan
toward a highlighted quote box.

Used by ARTICLE_FOCUS shots in news_recap videos. The screenshot URL is
resolved at compose time from `ctx["scrape_artifacts"]` (a list of
`{id, url, name, type}` dicts produced by web_content_capture_service and
stamped with stable ids by video_generation_service._assign_capture_ids).

Required params:
  - screenshot_id: one of "above_fold" | "mid" | "footer" | "inline_0..N"
                   matching an entry in ctx.scrape_artifacts. Falls back to
                   the first available image if the requested id is missing.
  - quote_text:    verbatim sentence from the article (≤ 120 chars). Rendered
                   in an animated overlay card. Optional — pass empty string
                   for a clean Ken-Burns zoom with no overlay.

Optional params:
  - highlight_box_pct: { x_pct, y_pct, w_pct, h_pct } — rect in 0–100 scale
                       to zoom toward over the duration. Default {5,8,90,50}.
  - accent_color:      hex string for the quote's accent bar / quote-mark.
                       Default falls back to the brand accent color from the
                       shot pack.
  - source_label:      short attribution string ("BBC News" / "Reuters").
                       Optional. Renders as a small label under the quote.
"""
from typing import Dict, Any, List
import html as _html


METADATA = {
    "id": "article_focus_zoom_pan",
    "version": "1.1.0",
    "title": "Article Focus — Zoom-Pan with Quote Overlay",
    "description": (
        "Full-frame article page screenshot, slow GSAP zoom-pan toward a "
        "highlighted quote, with optional pull-quote overlay card. Tells the "
        "viewer 'this is real, here is the source.'"
    ),
    "use_when": (
        "news_recap videos where scrape_url captured the source article page. "
        "Use 1–2 ARTICLE_FOCUS shots per video at 3–5s each."
    ),
    "compatible_shot_types": ["ARTICLE_FOCUS", "*"],
    "requires_tier": "premium",
    "requires_canvas": "any",
    "example_params": {
        "screenshot_id": "above_fold",
        "quote_text": "The ceasefire is still in place — for now.",
        "highlight_box_pct": {"x_pct": 5, "y_pct": 8, "w_pct": 90, "h_pct": 50},
        "accent_color": "",
        "source_label": "BBC News",
    },
}


PARAMS_SCHEMA = {
    "type": "object",
    "required": ["screenshot_id"],
    "properties": {
        "screenshot_id": {"type": "string"},
        "quote_text": {"type": "string"},
        "highlight_box_pct": {"type": "object"},
        "accent_color": {"type": "string"},
        "source_label": {"type": "string"},
    },
}


_DEFAULT_BOX = {"x_pct": 5.0, "y_pct": 8.0, "w_pct": 90.0, "h_pct": 50.0}


def _resolve_screenshot_url(screenshot_id: str, artifacts: List[Dict[str, Any]]) -> str:
    """Look up the URL for `screenshot_id` in the captured-files list.

    Falls back to the first image-typed artifact if the requested id isn't
    found (graceful degradation when the Director references a screenshot
    that wasn't actually captured).
    """
    if not isinstance(artifacts, list) or not artifacts:
        return ""
    target = (screenshot_id or "").strip().lower()
    if target:
        for f in artifacts:
            if not isinstance(f, dict):
                continue
            if (f.get("id") or "").lower() == target:
                return f.get("url") or ""
    # Fallback — return the first image-y artifact
    for f in artifacts:
        if not isinstance(f, dict):
            continue
        if (f.get("type") or "image") == "image" and f.get("url"):
            return f.get("url") or ""
    return ""


def _normalize_box(raw: Any) -> Dict[str, float]:
    """Coerce highlight_box_pct into a dict of floats with sane defaults."""
    out = dict(_DEFAULT_BOX)
    if isinstance(raw, dict):
        for k in ("x_pct", "y_pct", "w_pct", "h_pct"):
            v = raw.get(k)
            try:
                if v is not None:
                    out[k] = float(v)
            except (TypeError, ValueError):
                pass
    # Clamp to valid percentage range, ensure non-zero size.
    out["x_pct"] = max(0.0, min(95.0, out["x_pct"]))
    out["y_pct"] = max(0.0, min(95.0, out["y_pct"]))
    out["w_pct"] = max(5.0, min(100.0 - out["x_pct"], out["w_pct"]))
    out["h_pct"] = max(5.0, min(100.0 - out["y_pct"], out["h_pct"]))
    return out


def render(shot: Dict[str, Any], params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    shot_idx = ctx.get("shot_index", 0)
    sid = f"taf{shot_idx}"
    pack = ctx.get("shot_pack") or {}
    palette = pack.get("color_tokens", {}) if isinstance(pack.get("color_tokens"), dict) else {}
    fs = pack.get("font_scale", {}) if isinstance(pack.get("font_scale"), dict) else {}
    ez = pack.get("ease", {}) if isinstance(pack.get("ease"), dict) else {}

    artifacts = ctx.get("scrape_artifacts") or []
    screenshot_id = (params.get("screenshot_id") or "").strip()
    image_url = _resolve_screenshot_url(screenshot_id, artifacts)

    # Page screenshots are tall (~1280×6000) and look best filling the frame
    # anchored to the article header; inline news photos are roughly 16:9 / 4:3
    # and look best contained (whole subject visible, no horizontal crop).
    _is_page_screenshot = screenshot_id.lower() in ("above_fold", "mid", "footer")
    _img_object_fit = "cover" if _is_page_screenshot else "contain"
    _img_object_pos = "center top" if screenshot_id.lower() == "above_fold" else "center center"

    quote_text = (params.get("quote_text") or "").strip()
    source_label = (params.get("source_label") or "").strip()
    accent = (params.get("accent_color") or "").strip() or "var(--brand-accent)"

    box = _normalize_box(params.get("highlight_box_pct"))

    # Compute scale + translate so the rect (box.x/y/w/h in % of frame) ends
    # up filling the canvas. We treat the canvas as 100×100 percent — the
    # final transform `scale(zs)` zooms by the inverse of box size, then we
    # translate so the box's center is on canvas center.
    zs_w = 100.0 / box["w_pct"]
    zs_h = 100.0 / box["h_pct"]
    zs = min(zs_w, zs_h)  # contain (not crop) — preserves aspect, leaves bars
    box_cx = box["x_pct"] + box["w_pct"] / 2.0
    box_cy = box["y_pct"] + box["h_pct"] / 2.0
    # transform-origin is canvas center (50,50); to bring box center to view
    # center we translate by (50 - box_cx) * zs in % of original frame, but
    # since we're operating on a 100% wrapper we can express it directly.
    tx_pct_end = (50.0 - box_cx)
    ty_pct_end = (50.0 - box_cy)

    # Image element. If we couldn't resolve a URL we render a neutral placeholder
    # rather than an empty <img> so the shot doesn't visually break — the rest
    # of the video can still play and the operator can investigate later.
    img_html = ""
    if image_url:
        img_html = (
            f"<img class=\"{sid}-screenshot\" src=\"{_html.escape(image_url, quote=True)}\" "
            f"alt=\"Source article screenshot\" data-img-resolved=\"true\" />"
        )
    else:
        img_html = (
            f"<div class=\"{sid}-screenshot {sid}-fallback\">"
            f"<span>Source article</span>"
            f"</div>"
        )

    # Quote overlay
    overlay_html = ""
    if quote_text:
        overlay_html = (
            f"<div class=\"{sid}-quote-card\" id=\"{sid}-q\">"
            f"<span class=\"{sid}-quote-bar\"></span>"
            f"<div class=\"{sid}-quote-body\">"
            f"<span class=\"{sid}-mark\">“</span>"
            f"{_html.escape(quote_text)}"
            f"<span class=\"{sid}-mark\">”</span>"
            f"</div>"
            + (
                f"<div class=\"{sid}-attr\">— {_html.escape(source_label)}</div>"
                if source_label else ""
            )
            + "</div>"
        )

    fs_caption = fs.get("caption", "clamp(1rem, min(2.4vw, 3vh), 1.8rem)")
    fs_body = fs.get("body", "clamp(1.2rem, min(2.4vw, 4.4vh), 2.4rem)")
    ease_entry = ez.get("entry", "power3.out")

    canvas_w = int(ctx.get("canvas_w", 1920) or 1920)
    canvas_h = int(ctx.get("canvas_h", 1080) or 1080)
    is_portrait = canvas_h > canvas_w

    text_color = palette.get("text", "#ffffff") if isinstance(palette, dict) else "#ffffff"
    bg_color = palette.get("background", "#0a0a0a") if isinstance(palette, dict) else "#0a0a0a"
    text_secondary = palette.get("text_secondary", "rgba(255,255,255,0.75)") if isinstance(palette, dict) else "rgba(255,255,255,0.75)"

    html = (
        f"<div class=\"{sid}-stage\">"
        f"<div class=\"{sid}-frame\" id=\"{sid}-frame\">"
        f"{img_html}"
        f"</div>"
        f"{overlay_html}"
        f"</div>"
    )

    css = f"""
.{sid}-stage {{
  position:absolute; inset:0; overflow:hidden;
  background: {bg_color};
  color: {text_color};
  font-family:'Inter',system-ui,sans-serif;
}}
.{sid}-frame {{
  position:absolute; inset:0;
  transform-origin: 50% 50%;
  will-change: transform;
}}
.{sid}-screenshot {{
  display:block; width:100%; height:100%;
  object-fit: {_img_object_fit};
  object-position: {_img_object_pos};
  background:#111;
}}
.{sid}-fallback {{
  display:flex; align-items:center; justify-content:center;
  font-size:1.5rem; color: {text_secondary};
  letter-spacing:0.06em; text-transform:uppercase;
}}
.{sid}-quote-card {{
  position:absolute; left:{"5%" if is_portrait else "6%"};
  right:{"5%" if is_portrait else "6%"};
  bottom:{"9%" if is_portrait else "7%"};
  display:flex; gap:1.3rem; align-items:flex-start;
  padding:{"1.8rem 1.8rem" if is_portrait else "1.6rem 1.8rem"};
  background: rgba(10,10,10,0.78);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.08);
  opacity: 0;
  transform: translateY(20px);
  will-change: transform, opacity;
}}
.{sid}-quote-bar {{
  flex: 0 0 4px;
  align-self: stretch;
  background: {accent};
  border-radius: 2px;
}}
.{sid}-quote-body {{
  font-family:'Inter','Georgia',serif;
  font-size: {fs_body};
  line-height: 1.35;
  color: {text_color};
  font-weight: 500;
}}
.{sid}-mark {{ color: {accent}; margin: 0 0.18em; font-weight: 700; }}
.{sid}-attr {{
  margin-top: 0.7rem;
  font-size: {fs_caption};
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: {text_secondary};
}}
"""

    # Shot duration for the zoom tween — read from the shot's time range so
    # the highlight box actually fills the frame within the shot's lifetime.
    # Falls back to 4.5s for the (rare) shot where times are missing/invalid.
    try:
        _start = float(shot.get("start_time", 0) or 0)
        _end = float(shot.get("end_time", 0) or 0)
        zoom_duration = max(1.5, _end - _start)
    except (TypeError, ValueError):
        zoom_duration = 4.5

    # GSAP timeline:
    # - frame: subtle initial scale 1.04 → zoom-pan to box rect over the shot duration.
    # - quote card: fade + rise in at ~20% of duration.
    js_lines = []
    js_lines.append(
        f"gsap.fromTo('#{sid}-frame', "
        f"{{scale:1.04, x:'0%', y:'0%'}}, "
        f"{{scale:{zs:.3f}, x:'{tx_pct_end:.2f}%', y:'{ty_pct_end:.2f}%', "
        f"duration:{zoom_duration:.2f}, ease:'power1.inOut'}});"
    )
    if quote_text:
        # Delay the overlay so the screenshot reads first; cap delay so very
        # short shots (≤2s) still get the overlay on screen for a beat.
        _quote_delay = min(0.85, max(0.20, zoom_duration * 0.20))
        js_lines.append(
            f"gsap.to('#{sid}-q', "
            f"{{opacity:1, y:0, duration:0.6, delay:{_quote_delay:.2f}, ease:'{ease_entry}'}});"
        )
    js = "\n".join(js_lines)

    audio_events = []
    if quote_text:
        audio_events.append({
            "role": "ui_emphasis",
            "t": round(min(0.85, max(0.20, zoom_duration * 0.20)), 3),
            "volume_mul": 0.85,
            "skill_id": "article_focus_zoom_pan",
        })

    return {"html": html, "css": css, "js": js, "audio_events": audio_events}
