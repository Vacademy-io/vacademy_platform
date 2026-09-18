"""
Compact, model-facing views of a catalogue (website) JSON.

A catalogue is the JSON the website builder edits and the learner app renders:

    {"globalSettings": {...}, "pages": [{"id", "route", "title", "seo", "components": [...]}]}

It can be megabytes (imported HTML sites), so nothing here ever hands the raw
blob back. Instead these helpers answer the questions an AI assistant is asked:

  * what is on this page, in order, and where does each block's DATA come from
    (which campaign a form feeds, which courses a strip shows);
  * where are the lead-capture surfaces and are they wired to a campaign;
  * what would the dashboard warn about before publishing.

Pure functions, no I/O — the tool executors fetch, these summarise. The publish
checks and component labels are ports of
``frontend-admin-dashboard/src/routes/manage-pages/-utils/{publish-checks,component-labels}.ts``;
change one, change the other.
"""
from __future__ import annotations

import re
from typing import Any, Dict, Iterator, List, Optional
from urllib.parse import quote

# ── labels (port of component-labels.ts) ────────────────────────────────
COMPONENT_LABELS: Dict[str, str] = {
    "header": "Header",
    "footer": "Footer",
    "heroSection": "Hero Section",
    "detailBlocks": "Program Blocks",
    "featureGrid": "Feature Grid",
    "courseCatalog": "Course Catalog",
    "bookCatalogue": "Book Catalogue",
    "productPageOffer": "Product Page Offer",
    "productCourseGrid": "Course Grid (full catalogue)",
    "mediaShowcase": "Media Showcase",
    "courseShowcase": "Course showcase",
    "statsHighlights": "Stats",
    "testimonialSection": "Testimonials",
    "cartComponent": "Cart",
    "buyRentSection": "Buy / Rent",
    "policyRenderer": "Policy",
    "courseDetails": "Course Details",
    "bookDetails": "Book Details",
    "faqSection": "FAQ",
    "videoEmbed": "Video Embed",
    "documentViewer": "Document Viewer",
    "ctaBanner": "CTA Banner",
    "pricingTable": "Pricing Table",
    "contactForm": "Contact Form",
    "leadForm": "Lead Form",
    "teamSection": "Team",
    "announcementFeed": "Announcements",
    "imageGallery": "Image Gallery",
    "columnLayout": "Column Layout",
    "htmlBlock": "Custom HTML",
    "htmlPage": "HTML Page",
    "newsletterSignup": "Newsletter Signup",
    "stepsProcess": "Steps / Process",
    "logoCloud": "Logo Cloud",
    "tabsAccordion": "Tabs / Accordion",
    "mapEmbed": "Map Embed",
    "countdownTimer": "Countdown Timer",
    "textBlock": "Text Block",
    "imageBlock": "Image Block",
    "buttonBlock": "Button",
    "sectionHeading": "Section Heading",
    "trustChip": "Trust Chip",
    "marquee": "Marquee",
    "spacer": "Spacer",
}

#: Blocks whose content comes from live institute data rather than authored props.
LIVE_DATA_TYPES = frozenset({
    "courseCatalog", "productCourseGrid", "courseShowcase", "productPageOffer",
    "courseDetails", "bookCatalogue", "bookDetails", "announcementFeed", "leadForm",
})

#: Blocks that capture a visitor's details.
CAPTURE_TYPES = frozenset({"leadForm", "contactForm", "newsletterSignup"})


def component_label(comp_type: Any) -> str:
    """Friendly name for a component type, with a camelCase fallback."""
    t = str(comp_type or "")
    if t in COMPONENT_LABELS:
        return COMPONENT_LABELS[t]
    spaced = re.sub(r"([A-Z])", r" \1", t).strip()
    return spaced[:1].upper() + spaced[1:] if spaced else "Block"


# ── tree helpers ─────────────────────────────────────────────────────────
_TAG_RE = re.compile(r"<[^>]*>")
_WS_RE = re.compile(r"\s+")


def strip_html(value: Any, cap: int = 160) -> str:
    if not isinstance(value, str):
        return ""
    text = _WS_RE.sub(" ", _TAG_RE.sub(" ", value).replace("&nbsp;", " ")).strip()
    return text if len(text) <= cap else text[: cap - 1] + "…"


def walk_components(components: Any) -> Iterator[Dict[str, Any]]:
    """Every component in document order, descending into columnLayout slots."""
    for c in components or []:
        if not isinstance(c, dict):
            continue
        yield c
        slots = (c.get("props") or {}).get("slots")
        if isinstance(slots, list):
            for slot in slots:
                if isinstance(slot, list):
                    yield from walk_components(slot)


def _collect_strings(node: Any, out: List[str], depth: int = 0) -> None:
    if depth > 6 or node is None:
        return
    if isinstance(node, str):
        out.append(node)
    elif isinstance(node, list):
        for v in node:
            _collect_strings(v, out, depth + 1)
    elif isinstance(node, dict):
        for v in node.values():
            _collect_strings(v, out, depth + 1)


def heading_of(comp: Dict[str, Any]) -> str:
    """The one line an admin would use to point at this block."""
    p = comp.get("props") or {}
    for key in ("title", "heading", "headerText", "headline", "text"):
        v = p.get(key)
        if isinstance(v, str) and v.strip():
            return strip_html(v, 120)
    left = p.get("left") if isinstance(p.get("left"), dict) else {}
    for key in ("title", "subheading"):
        v = left.get(key)
        if isinstance(v, str) and v.strip():
            return strip_html(v, 120)
    if isinstance(p.get("content"), str):
        return strip_html(p["content"], 120)
    if comp.get("type") == "header" and isinstance(p.get("title"), str):
        return strip_html(p["title"], 120)
    return ""


# ── capture surfaces & data bindings ─────────────────────────────────────
def _campaign_text(audience_id: Any, audience_name: Any, campaign_names: Optional[Dict[str, str]] = None) -> str:
    aid = str(audience_id or "").strip()
    if not aid:
        return "NO campaign selected"
    # Buttons and header links store only the id; the name comes from the
    # institute's campaign list when the caller supplies it.
    name = str(audience_name or "").strip() or str((campaign_names or {}).get(aid) or "").strip()
    return f'campaign "{name}" ({aid})' if name else f"campaign {aid}"


def capture_surfaces(comp: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Every place in ONE component that opens or embeds a lead-capture form.

    Returns ``{kind, path, label, audience_id, audience_name}`` per surface, where
    ``path`` is the prop path a write tool would set (e.g. ``props.audienceId``,
    ``props.left.buttons[0].audienceId``).
    """
    p = comp.get("props") or {}
    ctype = comp.get("type")
    out: List[Dict[str, Any]] = []

    if ctype in CAPTURE_TYPES:
        out.append({
            "kind": "form_section",
            "path": "props.audienceId",
            "label": component_label(ctype),
            "audience_id": str(p.get("audienceId") or "").strip(),
            "audience_name": str(p.get("audienceName") or "").strip(),
            # contactForm / newsletterSignup fall back to the auto "website leads"
            # list; a leadForm renders nothing without a campaign.
            "required": ctype == "leadForm",
        })

    # Header "Enquire now"-style links that open a popup form.
    for i, link in enumerate(p.get("authLinks") or []):
        if isinstance(link, dict) and str(link.get("audienceId") or "").strip():
            out.append({
                "kind": "header_link", "path": f"props.authLinks[{i}].audienceId",
                "label": str(link.get("label") or "Header link"),
                "audience_id": str(link.get("audienceId") or "").strip(),
                "audience_name": "", "required": True,
            })

    # Buttons with action=openForm: hero (props.left.buttons[]), ctaBanner /
    # mediaShowcase / buttonBlock (props.button), plus a bare props.action.
    left = p.get("left") if isinstance(p.get("left"), dict) else {}
    for i, b in enumerate(left.get("buttons") or []):
        if isinstance(b, dict) and b.get("action") == "openForm":
            out.append({
                "kind": "button", "path": f"props.left.buttons[{i}].audienceId",
                "label": str(b.get("text") or b.get("label") or "Button"),
                "audience_id": str(b.get("audienceId") or "").strip(),
                "audience_name": "", "required": True,
            })
    button = p.get("button") if isinstance(p.get("button"), dict) else None
    if button and button.get("action") == "openForm":
        out.append({
            "kind": "button", "path": "props.button.audienceId",
            "label": str(button.get("text") or "Button"),
            "audience_id": str(button.get("audienceId") or "").strip(),
            "audience_name": "", "required": True,
        })
    if p.get("action") == "openForm" and ctype not in CAPTURE_TYPES:
        out.append({
            "kind": "button", "path": "props.audienceId",
            "label": str(p.get("text") or p.get("label") or component_label(ctype)),
            "audience_id": str(p.get("audienceId") or "").strip(),
            "audience_name": "", "required": True,
        })
    return out


def data_binding(comp: Dict[str, Any], campaign_names: Optional[Dict[str, str]] = None) -> Optional[str]:
    """Plain-language 'where this block's data comes from', or None for authored blocks."""
    p = comp.get("props") or {}
    t = comp.get("type")
    if t in ("courseCatalog", "productCourseGrid"):
        filters = [f.get("label") or f.get("field") for f in (p.get("filtersConfig") or []) if isinstance(f, dict)]
        extra = f", filters: {', '.join(map(str, filters))}" if filters and p.get("showFilters", True) else ""
        return f"every course in the institute (live){extra}"
    if t == "courseShowcase":
        source = str(p.get("source") or "newest")
        limit = p.get("limit")
        detail = {
            "newest": "newest courses",
            "onSale": "courses on sale",
            "tag": f'courses tagged "{p.get("tag") or ""}"',
            "picked": f"{len(p.get('courseIds') or [])} hand-picked courses",
        }.get(source, source)
        return f"{detail} (live){f', limit {limit}' if limit else ''}"
    if t == "productPageOffer":
        code = str(p.get("productPageCode") or "").strip()
        name = str(p.get("productPageName") or "").strip()
        if not code:
            return "product page: NONE selected (section hidden from visitors)"
        cart = ", multi-course basket ON" if p.get("enableCart") else ""
        return f'courses from product page "{name or code}" (code {code}, live){cart}'
    if t == "courseDetails":
        return "the selected course's details (live)"
    if t in ("bookCatalogue", "bookDetails"):
        return "books for sale (live)"
    if t == "announcementFeed":
        return "latest announcements (live)"
    if t in CAPTURE_TYPES:
        surfaces = capture_surfaces(comp)
        s = surfaces[0] if surfaces else {}
        text = _campaign_text(s.get("audience_id"), s.get("audience_name"), campaign_names)
        if t == "leadForm":
            return f"embeds {text}; fields come from that campaign"
        if not s.get("audience_id"):
            return "submits to the auto 'Course Catalogue Leads' list (no campaign chosen)"
        return f"submits to {text}"
    buttons = [s for s in capture_surfaces(comp) if s["kind"] != "form_section"]
    if buttons:
        return "; ".join(
            f'"{b["label"]}" opens a form → {_campaign_text(b["audience_id"], b["audience_name"], campaign_names)}'
            for b in buttons
        )
    return None


# ── page & site summaries ────────────────────────────────────────────────
def summarize_component(comp: Dict[str, Any], include_copy: bool = False, copy_cap: int = 400,
                        campaign_names: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "id": comp.get("id"),
        "type": comp.get("type"),
        "label": component_label(comp.get("type")),
    }
    if comp.get("enabled") is False:
        out["enabled"] = False
    heading = heading_of(comp)
    if heading:
        out["heading"] = heading
    binding = data_binding(comp, campaign_names)
    if binding:
        out["data_binding"] = binding
    if comp.get("anchorId"):
        out["anchor"] = f"#{comp['anchorId']}"
    if include_copy:
        strings: List[str] = []
        _collect_strings(comp.get("props") or {}, strings)
        # Keep prose, drop ids/urls/colours/enums. Cap the total so a page with
        # a pasted brochure cannot flood the context.
        prose = [strip_html(s, copy_cap) for s in strings
                 if len(s) > 24 and not re.match(r"^(#|https?:|[a-z0-9-]+$)", s.strip(), re.I)]
        if prose:
            joined: List[str] = []
            budget = copy_cap * 3
            for s in prose:
                if budget <= 0:
                    joined.append("…")
                    break
                joined.append(s)
                budget -= len(s)
            out["copy"] = joined
    return out


def summarize_page(page: Dict[str, Any], include_copy: bool = False,
                   campaign_names: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    comps = [summarize_component(c, include_copy, campaign_names=campaign_names)
             for c in walk_components(page.get("components"))]
    seo = page.get("seo") or {}
    out: Dict[str, Any] = {
        "id": page.get("id"),
        "route": page.get("route"),
        "title": page.get("title"),
        "section_count": len(comps),
        "sections": comps,
    }
    if seo.get("metaTitle") or seo.get("metaDescription"):
        out["seo"] = {k: v for k, v in {"meta_title": seo.get("metaTitle"),
                                        "meta_description": seo.get("metaDescription")}.items() if v}
    if page.get("hideSiteChrome"):
        out["hide_site_chrome"] = True
    return out


def summarize_global_settings(gs: Dict[str, Any]) -> Dict[str, Any]:
    gs = gs if isinstance(gs, dict) else {}
    theme = gs.get("theme") or {}
    fonts = gs.get("fonts") or {}
    lead = gs.get("leadCollection") or {}
    out: Dict[str, Any] = {
        "mode": gs.get("mode"),
        "theme": {k: v for k, v in {
            "preset": theme.get("preset"),
            "primary_color": theme.get("primaryColor"),
            "border_radius": theme.get("borderRadius"),
            "heading_scale": theme.get("headingScale"),
            "atmosphere": theme.get("atmosphere"),
        }.items() if v},
        "fonts": {k: v for k, v in {"body": fonts.get("family"), "heading": fonts.get("headingFamily")}.items() if v}
        if fonts.get("enabled", True) else {},
        "audience": gs.get("audience"),
        "motion": (gs.get("motion") or {}).get("personality"),
        "site_wide_lead_popup": {
            "enabled": bool(lead.get("enabled")),
            "mandatory": bool(lead.get("mandatory")),
        } if lead else None,
        "payment_enabled": bool((gs.get("payment") or {}).get("enabled")),
        "course_finder_enabled": bool((gs.get("courseFinder") or {}).get("enabled")),
    }
    if isinstance(gs.get("brandProfile"), dict):
        out["brand_profile"] = gs["brandProfile"]
    return {k: v for k, v in out.items() if v not in (None, {}, "")}


def find_page(config: Dict[str, Any], route_or_id: Optional[str]) -> Optional[Dict[str, Any]]:
    """Page by route (leading slash optional, case-insensitive) or by id; first page when blank."""
    pages = [p for p in (config.get("pages") or []) if isinstance(p, dict)]
    if not pages:
        return None
    key = str(route_or_id or "").strip()
    if not key:
        return pages[0]
    norm = key.lstrip("/").lower()
    for p in pages:
        if str(p.get("route") or "").lstrip("/").lower() == norm or str(p.get("id") or "") == key:
            return p
    return None


def find_component(page: Dict[str, Any], component_id: str) -> Optional[Dict[str, Any]]:
    for c in walk_components(page.get("components")):
        if str(c.get("id") or "") == str(component_id):
            return c
    return None


def collect_capture_surfaces(config: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Every lead-capture surface across the site, with its page and section."""
    out: List[Dict[str, Any]] = []
    for page in config.get("pages") or []:
        if not isinstance(page, dict):
            continue
        for comp in walk_components(page.get("components")):
            for s in capture_surfaces(comp):
                out.append({
                    "page_route": page.get("route"),
                    "page_title": page.get("title"),
                    "section_id": comp.get("id"),
                    "section_type": comp.get("type"),
                    "section_label": component_label(comp.get("type")),
                    **s,
                })
    return out


# ── publish checks (port of publish-checks.ts) ───────────────────────────
PLACEHOLDER_PATTERNS = [re.compile(p, re.I) for p in (
    r"lorem ipsum",
    r"\byour (?:institute|company|school) name\b",
    r"\breplace (?:this|with)\b",
    r"\bplaceholder\b",
    r"\bexample\.com\b",
    r"\bnew program\b",
    r"\bsecond program\b",
    r"\bdetail (?:one|two)\b",
    r"\bwho can join\b",
)]

_EXTERNAL_LINK_RE = re.compile(r"^(https?:|mailto:|tel:|#)")
_BUILTIN_ROUTES = {"login", "signup", "get-started", "getstarted"}


def run_publish_checks(config: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    The dashboard's pre-publish pass. WARNS, never blocks — the admin stays in charge.

    Each issue: ``{severity: error|warning, title, fix, page_route?, page_id?, component_id?}``.
    Errors first, then warnings, stable within group.
    """
    issues: List[Dict[str, Any]] = []
    pages = [p for p in (config.get("pages") or []) if isinstance(p, dict)]
    routes = {str(p.get("route") or "").lstrip("/").lower() for p in pages}

    for page in pages:
        page_name = page.get("title") or page.get("route") or "Untitled page"
        ctx = {"page_id": page.get("id"), "page_route": page.get("route"), "page_name": page_name}

        if not str((page.get("seo") or {}).get("metaDescription") or "").strip():
            issues.append({
                "severity": "warning",
                "title": f"“{page_name}” has no meta description",
                "fix": "Add one under the page's SEO settings. It becomes the text under your link on Google and in WhatsApp previews.",
                **ctx,
            })

        for c in walk_components(page.get("components")):
            p = c.get("props") or {}
            cctx = {**ctx, "component_id": c.get("id")}
            # Capture surfaces wired to nothing: a bare action, the single
            # `button` (CTA banner, media showcase…) and each hero button.
            form_buttons: List[Dict[str, Any]] = [{"action": p.get("action"), "audienceId": p.get("audienceId")}]
            if isinstance(p.get("button"), dict):
                form_buttons.append(p["button"])
            left = p.get("left") if isinstance(p.get("left"), dict) else {}
            form_buttons.extend(b for b in (left.get("buttons") or []) if isinstance(b, dict))
            if any(b.get("action") == "openForm" and not str(b.get("audienceId") or "").strip() for b in form_buttons):
                issues.append({
                    "severity": "error",
                    "title": "A button opens a form but no campaign is selected",
                    "fix": "Pick a campaign for it, or change the button back to a link. Right now it does nothing when tapped.",
                    **cctx,
                })
            if c.get("type") == "leadForm" and not str(p.get("audienceId") or "").strip():
                issues.append({
                    "severity": "error",
                    "title": "A Lead Form section has no campaign selected",
                    "fix": "Choose a campaign so its fields render — the section is invisible to visitors until then.",
                    **cctx,
                })
            if c.get("type") == "productPageOffer" and not str(p.get("productPageCode") or "").strip():
                issues.append({
                    "severity": "error",
                    "title": "A course section has no product page selected",
                    "fix": "Pick a product page in its properties, or remove the section. It is hidden from visitors as-is.",
                    **cctx,
                })

            for link in list(p.get("navLinks") or []) + list(p.get("authLinks") or []):
                if not isinstance(link, dict):
                    continue
                raw = str(link.get("route") or "").lstrip("/").lower()
                if not raw or _EXTERNAL_LINK_RE.match(raw) or raw in _BUILTIN_ROUTES:
                    continue
                if str(link.get("audienceId") or "").strip():
                    continue
                if raw not in routes:
                    issues.append({
                        "severity": "warning",
                        "title": f"Menu link “{link.get('label') or raw}” points to a page that doesn’t exist",
                        "fix": f"Nothing on this site has the address “{raw}”. Fix the link or create that page.",
                        **cctx,
                    })

            strings: List[str] = []
            _collect_strings(p, strings)
            hit = next((s for s in strings if len(s) < 400 and any(r.search(s) for r in PLACEHOLDER_PATTERNS)), None)
            if hit:
                short = hit[:60] + ("…" if len(hit) > 60 else "")
                issues.append({
                    "severity": "warning",
                    "title": "Placeholder text is still on the page",
                    "fix": f"“{short}” looks like sample copy. Replace it with your own words.",
                    **cctx,
                })

    tracking = (config.get("globalSettings") or {}).get("tracking") or {}
    if not (tracking.get("ga4MeasurementId") or tracking.get("metaPixelId") or tracking.get("gtmId")):
        issues.append({
            "severity": "warning",
            "title": "No analytics connected",
            "fix": "Add a Google Analytics or Meta Pixel ID in Global Settings → Tracking to see where your enquiries come from.",
        })

    return sorted(issues, key=lambda i: 0 if i["severity"] == "error" else 1)


# ── URLs ─────────────────────────────────────────────────────────────────
def learner_site_url(tag_name: str, learner_portal_base_url: Optional[str], fallback_origin: str) -> Optional[str]:
    """Public URL of one catalogue site, mirroring the dashboard's getCatalogueSiteUrl.

    None when neither a portal base nor a fallback origin is given — the caller
    then tells the admin the institute has no learner domain rather than
    inventing a link to a host that serves another institute."""
    base = (learner_portal_base_url or "").strip() or (fallback_origin or "").strip()
    if not base:
        return None
    base = base.rstrip("/")
    if not base.startswith("http"):
        base = f"https://{base}"
    return f"{base}/{quote(tag_name, safe='')}"


def editor_url(admin_dashboard_url: str, tag_name: str, page_route: Optional[str] = None,
               section_id: Optional[str] = None) -> str:
    url = f"{admin_dashboard_url.rstrip('/')}/manage-pages/editor/{quote(tag_name, safe='')}"
    qs = []
    if page_route:
        qs.append(f"page={quote(str(page_route).lstrip('/'), safe='')}")
    if section_id:
        qs.append(f"section={quote(str(section_id), safe='')}")
    return url + (f"?{'&'.join(qs)}" if qs else "")


__all__ = [
    "COMPONENT_LABELS", "LIVE_DATA_TYPES", "CAPTURE_TYPES",
    "component_label", "strip_html", "walk_components", "heading_of",
    "capture_surfaces", "data_binding", "summarize_component", "summarize_page",
    "summarize_global_settings", "find_page", "find_component",
    "collect_capture_surfaces", "run_publish_checks", "learner_site_url", "editor_url",
]
