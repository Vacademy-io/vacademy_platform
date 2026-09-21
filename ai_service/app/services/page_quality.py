"""
Opinionated quality review of a composed page: is it BEAUTIFUL, not just valid?

The builder's ``page_audit`` catches what is broken (contrast, empty page, a
split hero with no image). This layer adds taste — the things a designer
flags on a first pass — and turns everything into one score the connected
model can iterate against: fix the ``fix`` items, then the ``warn`` items,
until the score clears the bar.

Pure functions over the page JSON. Every rule states the fix in the words an
``update_page`` op needs, because the reader is a model that will act on it.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from .catalogue_summary import CAPTURE_TYPES, heading_of, strip_html, walk_components

#: Sections that count as "proof" / "conversion" on a landing page.
PROOF_TYPES = frozenset({"statsHighlights", "testimonialSection", "logoCloud", "trustChip"})
CONVERSION_TYPES = frozenset({"ctaBanner", "leadForm", "contactForm", "newsletterSignup", "pricingTable",
                              "courseCatalog", "courseShowcase", "productCourseGrid", "productPageOffer"})
BAND_TYPES = frozenset({"heroSection", "ctaBanner", "statsHighlights", "logoCloud", "marquee", "trustChip", "spacer"})

_PLACEHOLDER_RE = re.compile(
    r"lorem ipsum|\byour (?:institute|company|school) name\b|\bplaceholder\b|\bexample\.com\b|\bcoming soon\b|"
    r"\bwelcome to our platform\b|\bmy platform\b|\bdescription here\b|\bwrite your content here\b|\bnew program\b", re.I)
_HEX_RE = re.compile(r"^#([0-9a-fA-F]{6})$")

SCORE_BAR = 85


def _issue(code: str, kind: str, message: str, fix: str, component_id: Optional[str] = None, weight: int = 5) -> Dict[str, Any]:
    out = {"code": code, "kind": kind, "severity": "error" if kind == "fix" else "warning", "message": message, "fix": fix, "weight": weight}
    if component_id:
        out["component_id"] = component_id
    return out


def _strings_of(node: Any, out: List[str], depth: int = 0) -> None:
    if depth > 6 or node is None:
        return
    if isinstance(node, str):
        out.append(node)
    elif isinstance(node, list):
        for v in node:
            _strings_of(v, out, depth + 1)
    elif isinstance(node, dict):
        for v in node.values():
            _strings_of(v, out, depth + 1)


def _words(text: Any) -> int:
    return len(strip_html(text, 100000).split()) if isinstance(text, str) else 0


def _hero_of(components: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    return next((c for c in components if c.get("type") == "heroSection"), None)


def _bg_of(comp: Dict[str, Any]) -> str:
    style = comp.get("style") if isinstance(comp.get("style"), dict) else {}
    p = comp.get("props") or {}
    if isinstance(style.get("backgroundLayers"), list) and style["backgroundLayers"]:
        return "gradient"
    return str(style.get("backgroundColor") or p.get("backgroundColor") or "").strip().upper()


def _accent_colours(page: Dict[str, Any], global_settings: Optional[Dict[str, Any]]) -> set:
    theme = ((global_settings or {}).get("theme") or {})
    primary = str(theme.get("primaryColor") or "").upper()
    colours: set = set()
    for c in walk_components(page.get("components")):
        for src in (c.get("style") or {}, c.get("props") or {}):
            for key in ("backgroundColor", "textColor", "accentColor", "color"):
                v = src.get(key) if isinstance(src, dict) else None
                if isinstance(v, str) and _HEX_RE.match(v.strip()):
                    hexv = v.strip().upper()
                    if hexv in ("#FFFFFF", "#000000", primary) or _is_neutral(hexv):
                        continue
                    colours.add(hexv)
    return colours


def _is_neutral(hexv: str) -> bool:
    m = _HEX_RE.match(hexv)
    if not m:
        return False
    r, g, b = (int(m.group(1)[i:i + 2], 16) for i in (0, 2, 4))
    return max(r, g, b) - min(r, g, b) < 24   # greys / near-whites / near-blacks


def review_page(page: Dict[str, Any], global_settings: Optional[Dict[str, Any]] = None,
                page_type: str = "homepage") -> Dict[str, Any]:
    """
    ``{score, bar, issues, summary}`` for one page. Score starts at 100 and
    loses each issue's weight; ``fix`` items weigh more than ``warn`` items.
    """
    comps = [c for c in walk_components(page.get("components"))]
    top = [c for c in (page.get("components") or []) if isinstance(c, dict)]
    types = [c.get("type") for c in comps]
    issues: List[Dict[str, Any]] = []
    is_html = any(t == "htmlPage" for t in types)
    landing = page_type in ("homepage", "course-landing", "admissions")

    if not comps:
        return {"score": 0, "bar": SCORE_BAR, "issues": [_issue("empty", "fix", "The page has no sections.", "Compose the page.", weight=100)], "summary": "empty"}
    if is_html:
        html = str((comps[0].get("props") or {}).get("html") or "")
        if len(strip_html(html, 10**7)) < 200:
            issues.append(_issue("html-thin", "warn", "The HTML page has very little text.", "Add real content — headings, paragraphs, a call to action.", comps[0].get("id"), 15))
        return _finish(issues, "html page")

    # ── structure ────────────────────────────────────────────────────────
    n = len(top)
    if landing and n < 5:
        issues.append(_issue("too-few-sections", "fix", f"Only {n} sections — a landing page needs 6–12 (hero → proof → what you get → how it works → social proof → CTA).",
                             "Insert the missing sections with update_page ops.", weight=15))
    elif n > 14:
        issues.append(_issue("too-many-sections", "warn", f"{n} sections — long pages lose readers.", "Merge or remove the weakest sections.", weight=5))

    hero = _hero_of(comps)
    if landing and hero is None:
        issues.append(_issue("no-hero", "fix", "No hero section — nothing owns the fold.", "Insert a heroSection at position 1 with a headline, one-line subheading and one or two buttons.", weight=15))
    if hero is not None and top and top[0] is not hero and top[0].get("type") not in ("sectionHeading",):
        issues.append(_issue("hero-not-first", "warn", "The hero is not the first section.", "Move the heroSection to the top (op move, afterId null).", hero.get("id"), 6))

    if landing and not any(t in PROOF_TYPES for t in types):
        issues.append(_issue("no-proof", "fix", "No proof section (stats, testimonials, logos).", "Insert a statsHighlights with 3–4 real numbers, or a testimonialSection, after the hero.", weight=10))
    if landing and not any(t in CONVERSION_TYPES for t in types):
        issues.append(_issue("no-conversion", "fix", "Nothing for the visitor to do — no CTA, form or course list.", "Insert a ctaBanner near the end and a leadForm, or a course block.", weight=12))
    if landing and hero is not None and top and top[-1].get("type") not in ("ctaBanner", "leadForm", "contactForm", "footer"):
        issues.append(_issue("weak-ending", "warn", f"The page ends on a {top[-1].get('type')} — pages should close with a call to action.", "Move a ctaBanner or leadForm to the end.", top[-1].get("id"), 5))

    # ── rhythm ───────────────────────────────────────────────────────────
    for a, b in zip(top, top[1:]):
        if a.get("type") == b.get("type") and a.get("type") not in ("sectionHeading", "spacer", "textBlock"):
            issues.append(_issue("adjacent-twins", "warn", f"Two {a.get('type')} sections back to back.", "Vary the section type, or merge them.", b.get("id"), 5))
        if _bg_of(a) and _bg_of(a) == _bg_of(b) and a.get("type") in BAND_TYPES and b.get("type") in BAND_TYPES:
            issues.append(_issue("same-band", "warn", "Two coloured bands with the same colour in a row.", "Give one of them a different background or none.", b.get("id"), 4))
    banded = sum(1 for c in top if _bg_of(c))
    if n >= 5 and banded == 0:
        issues.append(_issue("flat-page", "warn", "Every section sits on the same white background — the page reads as a template.",
                             "Give the hero, the proof strip and the closing CTA a style.backgroundColor or backgroundLayers; keep the rest plain.", weight=10))
    if n >= 5 and banded >= n - 1:
        issues.append(_issue("all-bands", "warn", "Almost every section is a coloured band.", "Let 40–60% of sections sit on the plain page background.", weight=6))
    styled = sum(1 for c in top if isinstance(c.get("style"), dict) and c["style"])
    if n >= 5 and styled == 0:
        issues.append(_issue("unstyled", "warn", "No section carries a style — spacing, widths and atmosphere are all defaults.",
                             "Set style.layout.width and paddings on key sections; add an ornament or divider to the hero or CTA (see style_schema).", weight=8))

    # ── hero quality ─────────────────────────────────────────────────────
    if hero is not None:
        p = hero.get("props") or {}
        left = p.get("left") if isinstance(p.get("left"), dict) else {}
        title = left.get("title") or p.get("title") or ""
        sub = left.get("subheading") or left.get("description") or ""
        if _words(title) > 10:
            issues.append(_issue("hero-headline-long", "warn", f"Hero headline is {_words(title)} words.", "Cut it to ≤ 10 words; move detail into the subheading.", hero.get("id"), 6))
        if not title:
            issues.append(_issue("hero-no-headline", "fix", "The hero has no headline.", "Set props.left.title.", hero.get("id"), 10))
        if _words(sub) > 45:
            issues.append(_issue("hero-sub-long", "warn", "Hero subheading is a paragraph.", "Cut to ≤ 30 words.", hero.get("id"), 4))
        buttons = [b for b in (left.get("buttons") or []) if isinstance(b, dict)]
        if not buttons and not (isinstance(left.get("button"), dict) or isinstance(p.get("button"), dict)):
            issues.append(_issue("hero-no-cta", "fix", "The hero has no button.", "Add props.left.buttons: one primary (enquire / apply) and optionally one secondary (see courses).", hero.get("id"), 8))
        if len(buttons) > 2:
            issues.append(_issue("hero-too-many-ctas", "warn", f"{len(buttons)} hero buttons.", "Keep one primary and one secondary.", hero.get("id"), 4))
        right = p.get("right") if isinstance(p.get("right"), dict) else {}
        has_image = bool(str(right.get("image") or "").startswith("http")) or bool(str((p.get("backgroundImage") or "")).startswith("http"))
        if not has_image and p.get("layout") == "split":
            issues.append(_issue("hero-split-no-image", "fix", "Split hero with no image leaves half the fold empty.", "Set props.layout to 'centered' (or place an institute photo in props.right.image).", hero.get("id"), 8))
        if not has_image and page_type == "homepage":
            issues.append(_issue("hero-no-image", "warn", "The hero has no photo.", "If the institute has a campus/class photo (list_media / import_image), put it in props.right.image with layout 'split'.", hero.get("id"), 5))
        if not p.get("eyebrow") and landing:
            issues.append(_issue("hero-no-eyebrow", "warn", "No eyebrow above the headline.", "Add props.eyebrow {text: a short badge like 'Admissions open 2027', style: 'badge'}.", hero.get("id"), 3))

    # ── content quality ──────────────────────────────────────────────────
    for c in comps:
        p = c.get("props") or {}
        t = c.get("type")
        if t in ("sectionHeading", "spacer", "htmlPage", "header", "footer") or t in CAPTURE_TYPES:
            pass
        elif t not in ("courseCatalog", "productCourseGrid", "productPageOffer", "courseShowcase", "imageBlock", "buttonBlock", "mapEmbed", "videoEmbed", "documentViewer", "announcementFeed", "marquee", "trustChip") and not heading_of(c):
            issues.append(_issue("no-heading", "warn", f"{t} has no heading.", "Give it a short heading so the page scans.", c.get("id"), 3))
        for key in ("features", "stats", "steps"):
            items = p.get(key)
            if isinstance(items, list) and items:
                if key == "features" and len(items) not in (3, 4, 6):
                    issues.append(_issue("grid-count", "warn", f"{len(items)} feature cards — grids read best with 3, 4 or 6.", "Add or drop a card.", c.get("id"), 3))
                if key == "stats":
                    weak = [s for s in items if isinstance(s, dict) and not re.search(r"\d", str(s.get("value") or ""))]
                    if weak:
                        issues.append(_issue("stats-no-numbers", "fix", "A stats strip without numbers is decoration.", "Use real figures from the interview (years, selections, learners).", c.get("id"), 6))
        blob: List[str] = []
        _strings_of(p, blob)
        if _PLACEHOLDER_RE.search(" ".join(blob)):
            issues.append(_issue("placeholder-copy", "fix", "Template or placeholder copy is still on the page.", "Replace it with the institute's own words.", c.get("id"), 8))
        if t == "textBlock" and _words(p.get("content")) > 220:
            issues.append(_issue("wall-of-text", "warn", "A very long text block.", "Split into a sectionHeading + featureGrid/detailBlocks, or cut it.", c.get("id"), 4))
        if t == "testimonialSection":
            quotes = [q for q in (p.get("testimonials") or []) if isinstance(q, dict)]
            if not quotes:
                issues.append(_issue("empty-testimonials", "fix", "Testimonials section with no quotes.", "Add 2–3 real quotes with names, or remove the section.", c.get("id"), 8))

    # ── palette ──────────────────────────────────────────────────────────
    accents = _accent_colours(page, global_settings)
    if len(accents) >= 3:
        issues.append(_issue("too-many-colours", "warn", f"{len(accents)} accent colours besides the theme's primary on one page.", "Use the theme's primary plus at most one or two tints.", weight=6))

    return _finish(issues, f"{n} sections, {banded} bands, {styled} styled")


def _finish(issues: List[Dict[str, Any]], summary: str) -> Dict[str, Any]:
    score = max(0, 100 - sum(i["weight"] for i in issues))
    issues.sort(key=lambda i: (0 if i["kind"] == "fix" else 1, -i["weight"]))
    return {
        "score": score,
        "bar": SCORE_BAR,
        "passes": score >= SCORE_BAR and not any(i["kind"] == "fix" for i in issues),
        "issues": issues,
        "summary": summary,
    }


def review_with_audit(page: Dict[str, Any], global_settings: Optional[Dict[str, Any]], page_type: str) -> Dict[str, Any]:
    """Beauty review merged with the builder's defect audit (deduplicated by code)."""
    out = review_page(page, global_settings, page_type)
    try:
        from .page_audit import audit_page
        seen = {i["code"] for i in out["issues"]}
        for i in audit_page(page, global_settings, page_type=page_type or "homepage"):
            code = str(i.get("code") or "")
            if code in seen:
                continue
            kind = "fix" if i.get("kind") == "fix" else "warn"
            out["issues"].append(_issue(code, kind, str(i.get("message") or ""), str(i.get("hint") or ""), i.get("component_id"), 8 if kind == "fix" else 4))
    except Exception:  # noqa: BLE001 — the beauty review stands on its own
        pass
    return _finish(out["issues"], out["summary"])


__all__ = ["review_page", "review_with_audit", "SCORE_BAR"]
