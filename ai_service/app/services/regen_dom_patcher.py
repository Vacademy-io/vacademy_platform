"""Deterministic DOM patcher — applies regen patch_ops without an LLM.

When the intent classifier says "user wants to change one attribute," we
shouldn't ask the LLM to faithfully reproduce 9000 tokens of HTML just to
swap one value. This module does the swap directly, using BeautifulSoup
for resilience against attribute-order / whitespace variation.

Each op:
  - `image` / `media_query`: rewrite `data-video-query` / `data-img-prompt`
    so the render-time asset cascade re-fetches the right asset. NEVER
    writes `src` directly — that would bypass the cascade.
  - `text`: rewrite the text content of the matched element. Preserves
    nested inline-block animation spans by reading their combined text and
    writing back at the top level only when the element has no children
    that look like animation markers.
  - `color`: rewrite a CSS custom-property value inside `:root` (or any
    `<style>` block). Targets `--brand-primary` / `--brand-accent` /
    `--brand-text` by name.

`apply()` returns either a successful patched HTML + applied_ops list, or
`None` if no op could be applied (caller falls through to the LLM path).
This is fail-closed: silent partial application is worse than a fallback
because the user would see "regen succeeded" when nothing changed.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from bs4 import BeautifulSoup, NavigableString, Tag

logger = logging.getLogger(__name__)

# Heuristic: an inline-block animation span (per-letter / per-word) has a
# class containing one of these markers. Used by the text-patcher to avoid
# clobbering an `s3-char` reveal animation.
_ANIM_SPAN_CLASS_MARKERS = ("-char", "-letter", "char-", "letter-")

# Tag names that look like media holders for selector resolution.
_MEDIA_TAGS = ("video", "img", "image")


@dataclass
class AppliedOp:
    target: str
    selector: str
    before: str
    after: str
    ok: bool

    def to_dict(self) -> Dict[str, Any]:
        return {
            "target": self.target,
            "selector": self.selector,
            "before": self.before[:240],
            "after": self.after[:240],
            "ok": self.ok,
        }


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _approx_area(tag: Tag) -> int:
    """Approximate visible area of an element from inline style/attributes.

    Heuristic only — picks the larger of:
      - explicit width/height attributes
      - inline-style width/height (px or %, % treated as canvas-relative)
      - a fallback constant scaled by tag type (video > img > everything)

    Used to disambiguate "the image" when multiple images exist.
    """
    style = tag.get("style", "") or ""
    width = height = 0

    for attr in ("width", "height"):
        try:
            v = int((tag.get(attr) or "").strip("px% ") or 0)
            if attr == "width":
                width = max(width, v)
            else:
                height = max(height, v)
        except (TypeError, ValueError):
            pass

    m = re.search(r"width\s*:\s*(\d+(?:\.\d+)?)\s*(px|%|vw|vmin|vmax)?", style)
    if m:
        v = float(m.group(1))
        unit = m.group(2) or "px"
        if unit == "%":
            v *= 19.2  # treat % as fraction of 1920 canvas
        elif unit in ("vw", "vmin", "vmax"):
            v *= 19.2
        width = max(width, int(v))
    m = re.search(r"height\s*:\s*(\d+(?:\.\d+)?)\s*(px|%|vw|vh|vmin|vmax)?", style)
    if m:
        v = float(m.group(1))
        unit = m.group(2) or "px"
        if unit == "%":
            v *= 10.8
        elif unit in ("vh", "vmin", "vmax"):
            v *= 10.8
        height = max(height, int(v))

    if width and height:
        return width * height

    # Fallback: full-canvas elements (position:absolute width:100% height:100%) → max.
    if re.search(r"width\s*:\s*100\s*%", style) and re.search(r"height\s*:\s*100\s*%", style):
        return 1920 * 1080
    if "object-fit:cover" in style.replace(" ", "") or "object-fit: cover" in style:
        return 1920 * 1080  # cover almost always means background-tier

    name = (tag.name or "").lower()
    return {"video": 800000, "img": 400000, "image": 400000}.get(name, 100000)


def _find_by_id_or_hint(soup: BeautifulSoup, hint: str, allowed_tags: Tuple[str, ...]) -> Optional[Tag]:
    """Resolve a selector_hint to a Tag.

    Resolution order:
      1. exact `#id` match (hint starts with `#` or matches an id verbatim)
      2. id substring match (e.g. hint='headline' matches id='s3_headline')
      3. text content substring match (for text targets)
      4. largest-area element among allowed_tags (for media targets)

    Returns None if nothing matches.
    """
    if not hint:
        hint = ""
    hint_clean = hint.strip().lstrip("#").lower()

    # 1. exact id match
    if hint_clean:
        hit = soup.find(attrs={"id": hint.strip().lstrip("#")})
        if hit:
            return hit

    # 2. id substring match
    if hint_clean:
        for tag in soup.find_all(True):
            tid = (tag.get("id") or "").lower()
            if tid and hint_clean in tid:
                return tag

    # 3. media-only: largest matching element
    if any(t in allowed_tags for t in _MEDIA_TAGS):
        candidates = [t for t in soup.find_all(allowed_tags) if isinstance(t, Tag)]
        if candidates:
            return max(candidates, key=_approx_area)

    # 4. text-only: substring match on text content
    if "text" in allowed_tags or "*" in allowed_tags:
        # Iterate from most-specific elements (deepest, smallest) outward.
        candidates: List[Tag] = []
        for tag in soup.find_all(True):
            txt = tag.get_text(" ", strip=True).lower()
            if hint_clean and hint_clean in txt and len(txt) < 200:
                candidates.append(tag)
        if candidates:
            # Prefer shortest text (most specific match).
            return min(candidates, key=lambda t: len(t.get_text(" ", strip=True)))

    return None


def _has_anim_span_children(tag: Tag) -> bool:
    """True if the tag contains inline-block animation spans we shouldn't clobber."""
    for child in tag.find_all(True, recursive=False):
        cls = " ".join(child.get("class") or [])
        if any(marker in cls for marker in _ANIM_SPAN_CLASS_MARKERS):
            return True
    return False


def _set_text_preserving_attrs(tag: Tag, new_text: str) -> None:
    """Replace direct text children of `tag` while keeping nested tags intact.

    Strategy: replace ONLY the NavigableString children. Nested tags
    (e.g. an animation span, an icon) are left in place. If there are no
    NavigableString children, append the new text as the first child.
    """
    replaced = False
    for child in list(tag.children):
        if isinstance(child, NavigableString) and not isinstance(child, type(tag)):
            if str(child).strip():
                if not replaced:
                    child.replace_with(NavigableString(new_text))
                    replaced = True
                else:
                    child.replace_with(NavigableString(""))
    if not replaced:
        tag.insert(0, NavigableString(new_text))


def _normalize_hex(value: str) -> Optional[str]:
    """Coerce a color value to `#rrggbb` if possible. Returns None if unparseable."""
    v = value.strip().lower()
    if re.fullmatch(r"#[0-9a-f]{6}", v):
        return v
    if re.fullmatch(r"#[0-9a-f]{3}", v):
        # Expand #abc to #aabbcc
        return "#" + "".join(c * 2 for c in v[1:])
    # Common named colors → hex (limited set; LLM is asked to emit hex anyway).
    _NAMED = {
        "red": "#ef4444", "blue": "#2563eb", "green": "#10b981",
        "yellow": "#eab308", "orange": "#f97316", "purple": "#7c3aed",
        "pink": "#ec4899", "white": "#ffffff", "black": "#000000",
        "gray": "#6b7280", "grey": "#6b7280",
    }
    return _NAMED.get(v)


# ─────────────────────────────────────────────────────────────────────────────
# Op handlers
# ─────────────────────────────────────────────────────────────────────────────

def _apply_image_op(soup: BeautifulSoup, op: Dict[str, Any]) -> Optional[AppliedOp]:
    """Image / media_query op: rewrite `data-video-query` or `data-img-prompt`.

    Never writes `src` directly — the render-time cascade owns asset
    resolution; we just hand it a new search query and let it re-fetch.
    """
    hint = op.get("selector_hint", "")
    new_value = op.get("new_value", "")
    if not new_value:
        return None

    target = _find_by_id_or_hint(soup, hint, ("video", "img"))
    if not target:
        return None

    # Pick the attribute to update — video → data-video-query, img → data-img-prompt.
    # If neither attribute exists, set data-img-prompt as a safe default (the
    # cascade falls back to it).
    name = (target.name or "").lower()
    attr_name = "data-video-query" if name == "video" else "data-img-prompt"

    before = target.get(attr_name, "") or target.get("data-video-query", "") or target.get("data-img-prompt", "")
    target[attr_name] = new_value

    # Clear `src` so the cascade re-resolves. Leaving stale src means the
    # render harness keeps the OLD image until the new fetch lands AND can
    # ship the old image in cached renders.
    if target.has_attr("src"):
        target["src"] = "placeholder.png"

    selector = "#" + (target.get("id") or "") if target.get("id") else f"<{name}>"
    return AppliedOp(
        target=op["target"],
        selector=selector,
        before=str(before),
        after=new_value,
        ok=True,
    )


def _apply_text_op(soup: BeautifulSoup, op: Dict[str, Any]) -> Optional[AppliedOp]:
    """Text op: rewrite the text content of the matched element."""
    hint = op.get("selector_hint", "")
    new_text = op.get("new_value", "")
    if new_text is None:
        return None

    target = _find_by_id_or_hint(soup, hint, ("text", "*"))
    if not target:
        return None

    # Don't clobber an animation-span heavy element — those depend on
    # per-letter wrappers that the LLM regen path can recreate but we can't.
    # Fall through to the LLM in that case.
    if _has_anim_span_children(target):
        logger.info(
            f"[regen_dom_patcher] text op on '{target.get('id') or target.name}' "
            "has animation children — deferring to LLM"
        )
        return None

    before = target.get_text(" ", strip=True)
    _set_text_preserving_attrs(target, new_text)
    selector = "#" + (target.get("id") or "") if target.get("id") else f"<{target.name}>"
    return AppliedOp(
        target=op["target"],
        selector=selector,
        before=before,
        after=new_text,
        ok=True,
    )


_CSS_VAR_RE = re.compile(
    r"(--(?:brand-primary|brand-accent|brand-text|brand-text-secondary|"
    r"brand-bg|primary-color|accent-color|text-color))\s*:\s*([^;}\n]+)"
)


def _apply_color_op(html: str, op: Dict[str, Any]) -> Tuple[str, Optional[AppliedOp]]:
    """Color op: rewrite a CSS custom-property value in any `<style>` block.

    Operates on the raw HTML string (BeautifulSoup butchers `<style>` content
    indentation, and regex on the source is more faithful for CSS-in-style).
    """
    hint = (op.get("selector_hint") or "").lower()
    new_value = _normalize_hex(op.get("new_value") or "")
    if not new_value:
        return html, None

    # Pick which CSS variable to update based on the hint.
    var_pref = "--brand-primary"
    if "accent" in hint:
        var_pref = "--brand-accent"
    elif "text" in hint or "headline" in hint or "body" in hint:
        var_pref = "--brand-text"
    elif "background" in hint or "bg" in hint:
        var_pref = "--brand-bg"

    pattern = re.compile(rf"({re.escape(var_pref)})\s*:\s*([^;}}\n]+)")
    match = pattern.search(html)
    if not match:
        # Fall back to ANY known brand var.
        match = _CSS_VAR_RE.search(html)
        if not match:
            return html, None
        var_pref = match.group(1)

    before = match.group(2).strip()
    new_html = pattern.sub(rf"\1: {new_value}", html, count=1) if pattern.search(html) else _CSS_VAR_RE.sub(
        rf"\1: {new_value}", html, count=1
    )
    return new_html, AppliedOp(
        target=op["target"],
        selector=var_pref,
        before=before,
        after=new_value,
        ok=True,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Public entry point
# ─────────────────────────────────────────────────────────────────────────────

def apply(
    original_html: str,
    patch_ops: List[Dict[str, Any]],
) -> Optional[Tuple[str, List[Dict[str, Any]]]]:
    """Apply each patch_op. Returns (new_html, applied_ops_list) on any
    successful op; None if no op landed (caller falls through to LLM).
    """
    if not original_html or not patch_ops:
        return None

    # Color ops mutate raw HTML; image/text ops mutate the parsed soup.
    # Do color ops first (cheap regex), then soup ops, then serialize.
    current_html = original_html
    applied: List[AppliedOp] = []

    # Phase 1 — color ops on the raw string
    for op in patch_ops:
        if op.get("target") != "color":
            continue
        current_html, applied_op = _apply_color_op(current_html, op)
        if applied_op:
            applied.append(applied_op)

    # Phase 2 — image + text ops on parsed soup
    soup_ops = [op for op in patch_ops if op.get("target") in ("image", "media_query", "text")]
    if soup_ops:
        try:
            soup = BeautifulSoup(current_html, "html.parser")
        except Exception as e:
            logger.warning(f"[regen_dom_patcher] BeautifulSoup parse failed: {e}")
            # If we already applied a color op, return what we have. Otherwise
            # fall through to LLM.
            if applied:
                return current_html, [op.to_dict() for op in applied]
            return None

        for op in soup_ops:
            target = op.get("target")
            try:
                if target in ("image", "media_query"):
                    applied_op = _apply_image_op(soup, op)
                elif target == "text":
                    applied_op = _apply_text_op(soup, op)
                else:
                    applied_op = None
            except Exception as e:
                logger.warning(f"[regen_dom_patcher] op {target} threw: {e}")
                applied_op = None
            if applied_op:
                applied.append(applied_op)

        # Serialize back. BeautifulSoup's html.parser preserves most input
        # whitespace; some whitespace inside <script> / <style> CDATA can
        # shift, but no semantic change.
        current_html = str(soup)

    if not applied:
        return None
    return current_html, [op.to_dict() for op in applied]


def build_shot_summary_from_html(html: str, shot_type: Optional[str] = None) -> Dict[str, Any]:
    """Extract the compact shot summary the classifier needs from the HTML.

    Keeps the classifier prompt small — the full HTML is what made the
    original regen prompt bloated and copy-prone. Returns a dict suitable
    for `regen_intent_classifier.build_shot_summary` kwargs.
    """
    try:
        soup = BeautifulSoup(html or "", "html.parser")
    except Exception:
        return {"shot_type": shot_type, "text_blocks": [], "images": [], "color_vars": []}

    # Images / videos (with a search query if present).
    images: List[Dict[str, str]] = []
    for tag in soup.find_all(["img", "video"]):
        item = {
            "id": tag.get("id") or "",
            "kind": tag.name,
            "src": tag.get("src") or "",
            "query": tag.get("data-video-query") or tag.get("data-img-prompt") or "",
        }
        # Skip placeholder-only entries with no useful info.
        if any(item.values()):
            images.append(item)

    # Text blocks — id'd headings / paragraphs / divs with short text content.
    text_blocks: List[Dict[str, str]] = []
    seen_ids: set = set()
    for tag in soup.find_all(["h1", "h2", "h3", "h4", "p", "div", "span"]):
        tid = tag.get("id") or ""
        if not tid or tid in seen_ids:
            continue
        # Get text WITHOUT descendant tag text (so a wrapper div doesn't
        # subsume all its children's text).
        direct_text = " ".join(
            str(c).strip() for c in tag.children if isinstance(c, NavigableString) and str(c).strip()
        )
        if not direct_text:
            # If no direct text, use combined text but only for leaf-ish tags.
            kids = [c for c in tag.find_all(True, recursive=False)]
            if len(kids) > 3:
                continue
            direct_text = tag.get_text(" ", strip=True)
        if not direct_text or len(direct_text) > 200:
            continue
        text_blocks.append({"id": tid, "role": tag.name, "content": direct_text})
        seen_ids.add(tid)

    # Brand color vars — read from `:root { … }` first <style> block.
    color_vars: List[Dict[str, str]] = []
    for style in soup.find_all("style"):
        css = style.string or ""
        for m in _CSS_VAR_RE.finditer(css):
            var_name = m.group(1)
            if any(cv["var"] == var_name for cv in color_vars):
                continue
            color_vars.append({"var": var_name, "value": m.group(2).strip()})
        if color_vars:
            break  # one style block is enough — they shouldn't conflict

    return {
        "shot_type": shot_type,
        "text_blocks": text_blocks,
        "images": images,
        "color_vars": color_vars,
    }
