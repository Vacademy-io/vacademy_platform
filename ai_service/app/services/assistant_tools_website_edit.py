"""
The ``website_edit`` tool — DRAFT-ONLY changes to the institute's websites for
the Assistant and the MCP server.

One tool with an ``action`` argument, its own settings toggle ("Website: edit
drafts", off by default), and two rules that make it safe and cheap to hand to
an AI app:

* **nothing here reaches a visitor** — every action saves a DRAFT revision the
  admin reviews and publishes in Manage Pages (``discard_draft`` is the undo);
* **no model runs inside** — the connected LLM composes the page JSON itself
  (it holds the whole interview; see ``website(action="schema")`` for the
  contract), and this tool only validates, audits and persists. No credits.

Actions
    create_page       a page the caller composed → sanitised, audited, saved as a draft
    create_site       several pages + theme + header/footer → a NEW draft site
    update_page       insert / update / remove / move ops on an existing page
    set_layout        the site's header and footer
    add_section       one block with default content (no composition needed)
    set_theme         colours, fonts, radius, atmosphere, motion
    set_courses       which courses a course block shows
    link_lead_form    point a form / popup button at a lead campaign
    set_seo           meta title / description of a page
    import_image      bring a public https image into the media library
    discard_draft     drop the draft, back to what is published

Validation is the AI website builder's own (``sanitize_component``,
``_sanitize_page``, ``_sanitize_ops``, ``page_audit``) — the deterministic half
of that feature, without its composer.
"""
from __future__ import annotations

import copy
import json
import logging
import re
import uuid
from typing import Any, Dict, List, Optional, Tuple


from .assistant_tool_registry import ToolContext, ToolSpec, _admin_core_json
from .catalogue_summary import (
    capture_surfaces,
    component_label,
    find_component,
    find_page,
    run_publish_checks,
    strip_html,
    summarize_component,
    summarize_global_settings,
    summarize_page,
)
from .website_data import (
    NO_PORTAL_DOMAIN_NOTE,
    _err,
    _is_error,
    get_campaign,
    load_courses,
    load_product_pages,
    load_site,
    resolve_tag,
    site_editor_url,
    site_url,
)

logger = logging.getLogger(__name__)

WEBSITE_EDIT_TOOL_NAME = "website_edit"
WEBSITE_EDIT_GROUP_KEY = "website_builder_edits"

WEBSITE_EDIT_ACTIONS = (
    "create_page", "create_site", "add_html_page", "update_page", "set_layout", "add_section", "set_theme",
    "set_site_settings", "set_courses", "link_lead_form", "set_seo", "import_image", "discard_draft",
)

THEME_PRESETS = ("default", "ocean", "forest", "sunset", "midnight", "rose", "violet", "amber", "slate")
DESIGN_LANGUAGES = (
    "editorial-serif", "swiss-minimal", "bold-modern", "dark-tech",
    "warm-community", "corporate-trust", "directory-reference",
)
PAGE_TYPES = ("homepage", "courses", "course-landing", "about", "admissions", "contact")
IMAGE_KINDS = ("logo", "photo", "banner", "inspiration")
BORDER_RADII = ("sharp", "rounded", "pill")
HEADING_SCALES = ("compact", "default", "large", "display")
ATMOSPHERES = ("flat", "soft", "mesh", "aurora")
MOTIONS = ("none", "calm", "balanced", "dynamic")

#: Font label → CSS stack (mirror of catalogue-fonts.ts). Unknown labels fall
#: back to a sans stack rather than an invalid font-family.
FONT_STACKS: Dict[str, str] = {
    "Inter": "Inter, sans-serif", "Roboto": "Roboto, sans-serif", "Open Sans": '"Open Sans", sans-serif',
    "Poppins": "Poppins, sans-serif", "Lato": "Lato, sans-serif", "Montserrat": "Montserrat, sans-serif",
    "Mulish": "Mulish, sans-serif", "Figtree": "Figtree, sans-serif", "Outfit": "Outfit, sans-serif",
    "Nunito": "Nunito, sans-serif", "Space Grotesk": '"Space Grotesk", sans-serif', "Rubik": "Rubik, sans-serif",
    "Quicksand": "Quicksand, sans-serif", "Baloo 2": '"Baloo 2", sans-serif',
    "Playfair Display": '"Playfair Display", serif', "Fraunces": "Fraunces, serif",
    "Newsreader": "Newsreader, serif", "Lora": "Lora, serif",
}

_HEX_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
_SLUG_RE = re.compile(r"[^a-z0-9-]+")
_MAX_OPS = 40
_MAX_IMPORT_BYTES = 6_000_000
_IMAGE_TYPES = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg"}

#: A fresh site's global settings — the dashboard's default template, minus the
#: sample header/footer (the composer supplies those when a theme is proposed).
DEFAULT_GLOBAL_SETTINGS: Dict[str, Any] = {
    "courseCatalogeType": {"enabled": False, "value": "Course"},
    "mode": "light",
    "theme": {"preset": "default", "borderRadius": "rounded"},
    "fonts": {"enabled": True, "family": "Inter, sans-serif"},
    "compactness": "medium",
    "audience": "all",
    "leadCollection": {
        "enabled": False, "mandatory": False, "inviteLink": None,
        "formStyle": {"type": "single", "showProgress": False, "progressType": "bar", "transition": "slide"},
        "fields": [],
    },
    "enrquiry": {"enabled": True, "requirePayment": False},
    "payment": {"enabled": True, "provider": "razorpay", "fields": ["fullName", "email", "phone"]},
}


# ──────────────────────────────────────────────────────────────────────────
# Schema
# ──────────────────────────────────────────────────────────────────────────
_THEME_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "description": "Colours and type. Omit a field to leave it unchanged.",
    "properties": {
        "preset": {"type": "string", "enum": list(THEME_PRESETS)},
        "primary_color": {"type": "string", "description": "Brand hex, e.g. #1D4ED8."},
        "mode": {"type": "string", "enum": ["light", "dark"]},
        "fonts": {"type": "object", "properties": {
            "body": {"type": "string", "description": "Font name from the choices, e.g. Poppins."},
            "heading": {"type": "string"},
        }},
        "border_radius": {"type": "string", "enum": list(BORDER_RADII)},
        "heading_scale": {"type": "string", "enum": list(HEADING_SCALES)},
        "atmosphere": {"type": "string", "enum": list(ATMOSPHERES)},
        "atmosphere_intensity": {"type": "string", "enum": ["subtle", "medium", "bold"]},
        "motion": {"type": "string", "enum": list(MOTIONS)},
    },
}

_SITE_SETTINGS_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "description": "Site-wide behaviour and search settings (globalSettings), apart from the theme.",
    "properties": {
        "sticky_header": {"type": "boolean"},
        "back_to_top": {"type": "boolean"},
        "compactness": {"type": "string", "enum": ["small", "medium", "large"], "description": "Section density."},
        "audience": {"type": "string", "enum": ["children", "adults", "all"]},
        "lead_popup": {"type": "object", "description": "Site-wide lead-capture popup.", "properties": {
            "enabled": {"type": "boolean"}, "mandatory": {"type": "boolean"}}},
        "seo": {"type": "object", "description": "Site-level SEO (page titles/descriptions live on each page).", "properties": {
            "keywords": {"type": "array", "items": {"type": "string"}},
            "google_site_verification": {"type": "string"},
            "organization": {"type": "object", "properties": {
                "name": {"type": "string"}, "legal_name": {"type": "string"}, "description": {"type": "string"},
                "founder": {"type": "string"}, "founding_date": {"type": "string"}, "email": {"type": "string"},
                "telephone": {"type": "string"}, "address": {"type": "string"}, "logo": {"type": "string"},
                "same_as": {"type": "array", "items": {"type": "string"}}}},
        }},
    },
}

_COMPONENT_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "description": "One section, per website(action='schema'): {id (kebab-case, unique), type, enabled: true, props, style?}.",
    "properties": {
        "id": {"type": "string"}, "type": {"type": "string"}, "enabled": {"type": "boolean"},
        "props": {"type": "object"}, "style": {"type": "object"}, "anchorId": {"type": "string"},
    },
    "required": ["id", "type", "props"],
}

_PAGE_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "description": "A page you composed. Get the component contract from website(action='schema') first.",
    "properties": {
        "route": {"type": "string", "description": "URL path segment, e.g. 'home', 'admissions'."},
        "title": {"type": "string"},
        "seo": {"type": "object", "properties": {"metaTitle": {"type": "string"}, "metaDescription": {"type": "string"}}},
        "components": {"type": "array", "items": _COMPONENT_SCHEMA},
    },
    "required": ["route", "components"],
}

_OP_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "description": (
        "One edit: {op:'insert', component, afterId|null} · {op:'update', id, propsPatch?, stylePatch?} · "
        "{op:'remove', id} · {op:'move', id, afterId|null}. Add a short `note` saying what it does."
    ),
    "properties": {
        "op": {"type": "string", "enum": ["insert", "update", "remove", "move"]},
        "id": {"type": "string"}, "afterId": {"type": ["string", "null"]},
        "component": _COMPONENT_SCHEMA, "propsPatch": {"type": "object"}, "stylePatch": {"type": "object"},
        "note": {"type": "string"},
    },
    "required": ["op"],
}

WEBSITE_EDIT_SCHEMA: Dict[str, Any] = {
    "type": "function",
    "function": {
        "name": WEBSITE_EDIT_TOOL_NAME,
        "description": (
            "Change the institute's websites. EVERY change is saved as a DRAFT the admin reviews and "
            "publishes in the dashboard — nothing goes live from here, and nothing here calls a model: "
            "YOU compose the content. Before composing, run website(action='brief_checklist') and "
            "website(action='schema'). Pick an `action`:\n"
            "- create_page (tag_name OR new_site_name, page, page_type?, theme?): validate, audit and save "
            "a page you composed. Returns issues to fix (resubmit with update_page) and the editor_url.\n"
            "- create_site (new_site_name, pages, theme?, site_settings?, header?, footer?): a whole NEW draft site.\n"
            "- add_html_page (tag_name OR new_site_name, route, html, css?, title?, seo?, hide_site_chrome?, "
            "replace_existing?): a STATIC page you write as HTML + CSS (a full document or just the body) — "
            "for pages the block types cannot express, or when the admin hands you HTML. Scripts are removed; "
            "<style> moves into css; images must be institute media; links become site hooks. See "
            "website(action='schema').html_page_contract.\n"
            "- update_page (tag_name, page_route, ops): insert / update / remove / move sections you author.\n"
            "- set_layout (tag_name, header?, footer?): the site's header and footer components.\n"
            "- add_section (tag_name, page_route, section_type, after_section_id?, props?): insert one block "
            "with default content.\n"
            "- set_theme (tag_name, theme): colours, fonts, radius, atmosphere, motion.\n"
            "- set_site_settings (tag_name, site_settings): sticky header, back-to-top, density, audience, "
            "site-wide lead popup, site-level SEO (keywords, organization).\n"
            "- set_courses (tag_name, page_route, section_id, source: all|showcase|product_page, mode?, "
            "course_ids?, limit?, product_page_code?): which courses a course block shows.\n"
            "- link_lead_form (tag_name, page_route, section_id, audience_id): send a form or popup button's "
            "enquiries to a lead campaign. Ids ONLY from website(action='context') / audience_forms.\n"
            "- set_seo (tag_name, page_route, meta_title?, meta_description?).\n"
            "- import_image (url, kind, caption?): copy a public https image into the media library so it "
            "can be placed. Images on pages must come from list_media or import_image — never invent URLs.\n"
            "- discard_draft (tag_name): throw the draft away — the undo for everything above.\n"
            "Every result carries editor_url: tell the admin to review and publish there."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "action": {"type": "string", "enum": list(WEBSITE_EDIT_ACTIONS)},
                "tag_name": {"type": "string", "description": "Existing site (from website list)."},
                "new_site_name": {"type": "string", "description": "create_page / create_site: name for a NEW site; becomes its URL path."},
                "page_route": {"type": "string"},
                "section_id": {"type": "string", "description": "A section id from website(get_page)."},
                "page": _PAGE_SCHEMA,
                "pages": {"type": "array", "items": _PAGE_SCHEMA, "description": "create_site: the pages, in navigation order."},
                "page_type": {"type": "string", "enum": list(PAGE_TYPES), "description": "create_page: which archetype the page follows (drives the audit)."},
                "ops": {"type": "array", "items": _OP_SCHEMA},
                "header": _COMPONENT_SCHEMA,
                "footer": _COMPONENT_SCHEMA,
                "route": {"type": "string", "description": "add_html_page: URL path segment for the new page."},
                "title": {"type": "string", "description": "add_html_page: page title (defaults to the HTML <title>/<h1>)."},
                "html": {"type": "string", "description": "add_html_page: the page's HTML — a full document or the body markup. Max 200 KB."},
                "css": {"type": "string", "description": "add_html_page: extra stylesheet (in addition to any <style> in html). Max 150 KB."},
                "seo": {"type": "object", "properties": {"metaTitle": {"type": "string"}, "metaDescription": {"type": "string"}}},
                "hide_site_chrome": {"type": "boolean", "description": "add_html_page: hide the site header/footer on this page (default true — a pasted page usually brings its own)."},
                "replace_existing": {"type": "boolean", "description": "add_html_page: overwrite a page that already has this route (only if it is an HTML page)."},
                "theme": _THEME_SCHEMA,
                "site_settings": _SITE_SETTINGS_SCHEMA,
                "section_type": {"type": "string", "description": "Block type, e.g. testimonialSection, faqSection, courseShowcase, leadForm."},
                "after_section_id": {"type": "string"},
                "props": {"type": "object", "description": "add_section: prop overrides for the new block."},
                "url": {"type": "string", "description": "import_image: public https image URL."},
                "urls": {"type": "array", "items": {"type": "string"}, "description": "import_image: several public https image URLs at once (max 8)."},
                "kind": {"type": "string", "enum": list(IMAGE_KINDS)},
                "caption": {"type": "string"},
                "source": {"type": "string", "enum": ["all", "showcase", "product_page"]},
                "mode": {"type": "string", "enum": ["newest", "onSale", "tag", "picked"], "description": "set_courses showcase mode."},
                "tag": {"type": "string", "description": "set_courses mode=tag: the course tag."},
                "limit": {"type": "integer"},
                "product_page_code": {"type": "string"},
                "audience_id": {"type": "string"},
                "meta_title": {"type": "string"},
                "meta_description": {"type": "string"},
            },
            "required": ["action"],
        },
    },
}


# ──────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────
def _require(args: Dict[str, Any], action: str, *names: str) -> Optional[Dict[str, Any]]:
    missing = [n for n in names if args.get(n) in (None, "", [], {})]
    if missing:
        return _err("missing_argument", action=action, needs=missing)
    return None


def _slugify(name: str) -> str:
    slug = _SLUG_RE.sub("-", str(name or "").strip().lower()).strip("-")
    return slug[:60] or "site"


def _new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def _institute_name(ctx: ToolContext) -> Optional[str]:
    from sqlalchemy import text
    try:
        row = ctx.db.execute(text("SELECT name FROM institutes WHERE id = :id"), {"id": ctx.principal.institute_id}).first()
        return row[0] if row and row[0] else None
    except Exception:  # noqa: BLE001
        return None


def _course_snapshot(courses: List[Dict[str, Any]], only_ids: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    wanted = set(only_ids or [])
    out = []
    for c in courses:
        if wanted and c.get("id") not in wanted and not wanted.intersection(c.get("package_session_ids") or []):
            continue
        out.append({k: v for k, v in {
            "name": c.get("name"),
            "price": f"{c.get('currency') or ''} {c.get('price')}".strip() if c.get("price") else None,
            "level": c.get("level"),
            "tags": [c["session"]] if c.get("session") else None,
        }.items() if v})
    return out[:40]


def theme_to_global_patch(theme: Dict[str, Any]) -> Dict[str, Any]:
    """
    A ``theme`` argument (or a brand kit) → the ``globalSettings`` patch the
    renderers consume. Port of the dashboard's ``brandKitToGlobalPatch`` plus the
    direct fields an admin names in conversation. Unknown values are dropped,
    never written.
    """
    theme = theme if isinstance(theme, dict) else {}
    # Accept a brand kit's own field names too.
    preset = theme.get("preset") or theme.get("themePreset")
    primary = theme.get("primary_color") or theme.get("primaryColor")
    radius = theme.get("border_radius") or theme.get("borderRadius")
    scale = theme.get("heading_scale") or theme.get("headingScale")
    atmosphere = theme.get("atmosphere")
    motion = theme.get("motion")
    fonts_in = theme.get("fonts") if isinstance(theme.get("fonts"), dict) else {}
    body_font = fonts_in.get("body") or theme.get("fontFamily")
    heading_font = fonts_in.get("heading") or theme.get("headingFontFamily")

    patch: Dict[str, Any] = {}
    t: Dict[str, Any] = {}
    if preset in THEME_PRESETS:
        t["preset"] = preset
    if isinstance(primary, str) and _HEX_RE.match(primary):
        t["primaryColor"] = primary.upper()
    elif preset:
        # A new palette without an exact colour must clear a stale override,
        # otherwise the preset never visibly takes effect (same rule as the
        # dashboard's brandKitToGlobalPatch).
        t["primaryColor"] = None
    if radius in BORDER_RADII:
        t["borderRadius"] = radius
    if scale in HEADING_SCALES:
        t["headingScale"] = scale
    intensity = theme.get("atmosphere_intensity")
    intensity = intensity if intensity in ("subtle", "medium", "bold") else None
    if isinstance(atmosphere, str) and atmosphere in ATMOSPHERES:
        t["atmosphere"] = {"canvas": atmosphere, "intensity": intensity or "medium"}
    elif isinstance(atmosphere, dict) and atmosphere.get("canvas") in ATMOSPHERES:
        t["atmosphere"] = {"canvas": atmosphere["canvas"], "intensity": intensity or atmosphere.get("intensity") or "medium"}
    if t:
        patch["theme"] = t
    if theme.get("mode") in ("light", "dark"):
        patch["mode"] = theme["mode"]
    if motion in MOTIONS:
        patch["motion"] = {"personality": motion}
    if body_font or heading_font:
        body_stack = _font_stack(body_font) or "Inter, sans-serif"
        fonts: Dict[str, Any] = {"enabled": True, "family": body_stack}
        head_stack = _font_stack(heading_font)
        if head_stack and head_stack != body_stack:
            fonts["headingFamily"] = head_stack
        patch["fonts"] = fonts
    return patch


def _font_stack(label: Any) -> Optional[str]:
    if not isinstance(label, str) or not label.strip():
        return None
    name = label.strip()
    if name in FONT_STACKS:
        return FONT_STACKS[name]
    # Already a CSS stack, or a label in different casing.
    for k, v in FONT_STACKS.items():
        if k.lower() == name.lower() or v == name:
            return v
    return None


_SEO_ORG_KEYS = {"name": "name", "legal_name": "legalName", "description": "description", "founder": "founder",
                 "founding_date": "foundingDate", "email": "email", "telephone": "telephone", "address": "address",
                 "logo": "logo", "same_as": "sameAs"}


def site_settings_to_global_patch(settings_in: Dict[str, Any]) -> Dict[str, Any]:
    """``site_settings`` argument → globalSettings patch (only recognised values; nothing invented)."""
    si = settings_in if isinstance(settings_in, dict) else {}
    patch: Dict[str, Any] = {}
    if isinstance(si.get("sticky_header"), bool):
        patch["stickyHeader"] = si["sticky_header"]
    if isinstance(si.get("back_to_top"), bool):
        patch["backToTop"] = si["back_to_top"]
    if si.get("compactness") in ("small", "medium", "large"):
        patch["compactness"] = si["compactness"]
    if si.get("audience") in ("children", "adults", "all"):
        patch["audience"] = si["audience"]
    popup = si.get("lead_popup")
    if isinstance(popup, dict):
        lc = {k: bool(popup[k]) for k in ("enabled", "mandatory") if isinstance(popup.get(k), bool)}
        if lc:
            patch["leadCollection"] = lc
    seo = si.get("seo")
    if isinstance(seo, dict):
        out: Dict[str, Any] = {}
        if isinstance(seo.get("keywords"), list):
            out["keywords"] = [str(k)[:60] for k in seo["keywords"] if isinstance(k, str)][:30]
        if isinstance(seo.get("google_site_verification"), str):
            out["googleSiteVerification"] = seo["google_site_verification"][:200]
        org = seo.get("organization")
        if isinstance(org, dict):
            o = {_SEO_ORG_KEYS[k]: v for k, v in org.items() if k in _SEO_ORG_KEYS and v not in (None, "")}
            if "sameAs" in o and not isinstance(o["sameAs"], list):
                o.pop("sameAs")
            if "logo" in o and not _is_institute_asset(o["logo"]):
                o.pop("logo")
            if o:
                out["organization"] = o
        if out:
            patch["seo"] = out
    return patch


def merge_global_settings(gs: Dict[str, Any], patch: Dict[str, Any]) -> Dict[str, Any]:
    """One level of object merge (theme/fonts/motion), like the editor's updateGlobalSettings + applyOps."""
    out = copy.deepcopy(gs) if isinstance(gs, dict) else {}
    for k, v in patch.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            merged = {**out[k], **v}
            out[k] = {kk: vv for kk, vv in merged.items() if vv is not None}
        elif v is None:
            out.pop(k, None)
        else:
            out[k] = v
    return out


# ── copilot ops (port of applyOps in ai-page-service.ts) ────────────────
def _merge_patch(base: Any, patch: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(base or {})
    for k, v in patch.items():
        if v is None:
            out.pop(k, None)
        else:
            out[k] = v
    return out


def _patch_by_id(components: List[Any], target: str, fn) -> Tuple[List[Any], bool]:
    hit = False
    out: List[Any] = []
    for c in components:
        if isinstance(c, dict) and c.get("id") == target:
            hit = True
            res = fn(c)
            if res is not None:
                out.append(res)
            continue
        slots = (c.get("props") or {}).get("slots") if isinstance(c, dict) else None
        if isinstance(slots, list):
            slot_hit = False
            new_slots = []
            for slot in slots:
                if isinstance(slot, list):
                    r, h = _patch_by_id(slot, target, fn)
                    slot_hit = slot_hit or h
                    new_slots.append(r)
                else:
                    new_slots.append(slot)
            if slot_hit:
                hit = True
                out.append({**c, "props": {**(c.get("props") or {}), "slots": new_slots}})
                continue
        out.append(c)
    return out, hit


def apply_ops(config: Dict[str, Any], page_id: str, ops: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Pure: returns a new config with the copilot's ops applied to one page."""
    clone = copy.deepcopy(config)
    page = next((p for p in clone.get("pages") or [] if isinstance(p, dict) and p.get("id") == page_id), None)
    if page is None:
        return clone
    comps: List[Any] = page.setdefault("components", [])
    for op in ops[:_MAX_OPS]:
        kind = op.get("op")
        if kind == "insert" and isinstance(op.get("component"), dict):
            comp = op["component"]
            after = op.get("afterId")
            if after is None:
                comps.insert(0, comp)
            else:
                idx = next((i for i, c in enumerate(comps) if isinstance(c, dict) and c.get("id") == after), -1)
                comps.insert(idx + 1 if idx >= 0 else len(comps), comp)
        elif kind == "update" and op.get("id"):
            def _upd(c, op=op):
                return {
                    **c,
                    "props": _merge_patch(c.get("props"), op["propsPatch"]) if isinstance(op.get("propsPatch"), dict) else c.get("props"),
                    "style": _merge_patch(c.get("style"), op["stylePatch"]) if isinstance(op.get("stylePatch"), dict) else c.get("style"),
                }
            comps, _ = _patch_by_id(comps, op["id"], _upd)
        elif kind == "remove" and op.get("id"):
            comps, _ = _patch_by_id(comps, op["id"], lambda c: None)
        elif kind == "move" and op.get("id"):
            idx = next((i for i, c in enumerate(comps) if isinstance(c, dict) and c.get("id") == op["id"]), -1)
            if idx == -1:
                continue
            moved = comps.pop(idx)
            after = op.get("afterId")
            if after is None:
                comps.insert(0, moved)
            else:
                a = next((i for i, c in enumerate(comps) if isinstance(c, dict) and c.get("id") == after), -1)
                comps.insert(a + 1 if a >= 0 else len(comps), moved)
        elif kind == "updateGlobalSettings" and isinstance(op.get("patch"), dict):
            gs = clone.setdefault("globalSettings", {})
            for k, v in op["patch"].items():
                gs[k] = {**(gs.get(k) or {}), **v} if isinstance(v, dict) and isinstance(gs.get(k), dict) else v
        page["components"] = comps
    page["components"] = comps
    return clone


def describe_ops(ops: List[Dict[str, Any]]) -> List[str]:
    """The diff card's plain-language lines."""
    lines = []
    for op in ops[:_MAX_OPS]:
        note = op.get("note")
        kind = op.get("op")
        if kind == "insert":
            comp = op.get("component") or {}
            lines.append(note or f"Added a {component_label(comp.get('type'))} section")
        elif kind == "update":
            lines.append(note or f"Updated section {op.get('id')}")
        elif kind == "remove":
            lines.append(note or f"Removed section {op.get('id')}")
        elif kind == "move":
            lines.append(note or f"Moved section {op.get('id')}")
        elif kind == "updateGlobalSettings":
            lines.append(note or "Updated site settings")
    return lines


# ── persistence ──────────────────────────────────────────────────────────
async def save_draft(ctx: ToolContext, catalogue_id: str, config: Dict[str, Any], source: str,
                     ai_run_id: Optional[str]) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
    data = await _admin_core_json(
        ctx, "POST", "/admin-core-service/v1/course-catalogue/revision/save-draft",
        params={"catalogueId": catalogue_id},
        body={"catalogue_json": json.dumps(config, ensure_ascii=False), "source": source, "ai_run_id": ai_run_id},
        timeout=60.0,
    )
    if _is_error(data) or not isinstance(data, dict):
        return None, _err("save_failed", message="The draft could not be saved.")
    return data, None


async def create_site(ctx: ToolContext, tag_name: str, config: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    data = await _admin_core_json(
        ctx, "POST", "/admin-core-service/v1/course-catalogue/create",
        params={"instituteId": ctx.principal.institute_id},
        body={"catalogues": [{
            "catalogue_json": json.dumps(config, ensure_ascii=False),
            "tag_name": tag_name, "status": "DRAFT", "source": "INTERNAL", "is_default": False,
        }]},
        timeout=60.0,
    )
    return None if _is_error(data) else (data if isinstance(data, dict) else {"ok": True})


def _result(ctx: ToolContext, site: Dict[str, Any], config: Dict[str, Any], revision: Optional[Dict[str, Any]],
            summary: str, page_route: Optional[str] = None, section_id: Optional[str] = None, **extra: Any) -> Dict[str, Any]:
    issues = run_publish_checks(config)
    quality = None
    if page_route:
        route = str(page_route).lstrip("/").lower()
        issues = [i for i in issues if not i.get("page_route") or str(i["page_route"]).lstrip("/").lower() == route]
        target = find_page(config, page_route)
        if target is not None and not any(c.get("type") == "htmlPage" for c in target.get("components") or []):
            from .page_quality import review_page
            r = review_page(target, config.get("globalSettings"), extra.pop("page_type", None) or "homepage")
            quality = {"score": r["score"], "bar": r["bar"], "passes": r["passes"],
                       "top_issues": [{k: v for k, v in i.items() if k != "weight"} for i in r["issues"][:6]]}
    live_url = site_url(ctx, site["tag_name"])
    out: Dict[str, Any] = {
        "tag_name": site["tag_name"],
        "summary_of_change": summary,
        "saved_as": "draft",
        "draft_revision_no": (revision or {}).get("revision_no"),
        "editor_url": site_editor_url(site["tag_name"], page_route, section_id, ctx=ctx),
        "live_url": live_url,
        "audit": {
            "errors": [{k: v for k, v in i.items() if k != "page_id"} for i in issues if i["severity"] == "error"][:8],
            "warnings": len([i for i in issues if i["severity"] == "warning"]),
        },
        "next": "Ask the admin to review the draft at editor_url and press Publish there; nothing is live yet.",
    }
    if page_route:
        out["page_route"] = page_route
    if quality is not None:
        out["quality"] = quality
    if live_url is None:
        out["live_url_note"] = NO_PORTAL_DOMAIN_NOTE
    out.update(extra)
    return out


def _unique_route(config: Dict[str, Any], wanted: str) -> str:
    routes = {str(p.get("route") or "") for p in config.get("pages") or [] if isinstance(p, dict)}
    route = wanted or "ai-page"
    n = 2
    while route in routes:
        route = f"{wanted}-{n}"
        n += 1
    return route


def _generated_page_to_page(gen: Dict[str, Any], config: Dict[str, Any], fallback_route: str) -> Dict[str, Any]:
    route = _unique_route(config, str(gen.get("route") or fallback_route))
    return {
        "id": gen.get("id") or _new_id("page"),
        "route": route,
        "title": gen.get("title") or None,
        "seo": gen.get("seo") or {},
        "components": gen.get("components") or [],
    }


async def _target_site(ctx: ToolContext, args: Dict[str, Any], action: str):
    """The site to change: an existing one, or None + error."""
    site, err = await load_site(ctx, args.get("tag_name"))
    if err:
        return None, {**err, "action": action}
    return site, None


# ──────────────────────────────────────────────────────────────────────────
# Actions
# ──────────────────────────────────────────────────────────────────────────

def default_layout(institute_name: Optional[str], pages: List[Dict[str, Any]],
                   contact: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Header + footer for a NEW site, as the dashboard's default template seeds
    them (CreateCatalogueDialog → defaultTemplate.globalSettings.layout), so a
    site built by conversation has navigation and a footer from the start.
    """
    title = (institute_name or "").strip() or "My Platform"
    nav = [{"label": (p.get("title") or str(p.get("route") or "").replace("-", " ").title() or "Home")[:24],
            "route": p.get("route"), "openInSameTab": True} for p in pages[:6] if p.get("route")]
    contact = contact if isinstance(contact, dict) else {}
    footer_lines = [v for v in (contact.get("phone"), contact.get("email"), contact.get("address")) if v]
    return {
        "header": {
            "id": "header-1", "type": "header", "enabled": True,
            "props": {"logo": "", "title": title, "navigation": nav,
                      "authLinks": [{"label": "Login", "route": "login"}]},
        },
        "footer": {
            "id": "footer-1", "type": "footer", "enabled": True,
            "props": {
                "layout": "two-column",
                "leftSection": {"title": title, "text": " · ".join(footer_lines) or f"Welcome to {title}.", "socials": []},
                "rightSection": {"title": "Links", "links": [{"label": n["label"], "route": n["route"]} for n in nav]},
                "bottomNote": f"© {title}",
            },
        },
    }


def _example_props(section_type: str) -> Optional[Dict[str, Any]]:
    for c in _catalog().get("components") or []:
        if c.get("type") == section_type:
            return copy.deepcopy(c.get("exampleProps") or {})
    return None


# ── validation on top of the AI builder's own sanitisers ─────────────────
#: Blocks the editor offers that the composer's schema catalogue does not carry
#: (it lists what the AI may COMPOSE). Defaults mirror component-templates.ts;
#: `capabilities` is what website(action="schema") shows for them.
_EXTRA_COMPONENTS: List[Dict[str, Any]] = [
    {"type": "courseShowcase",
     "capabilities": "A strip of a FEW live courses: source newest | onSale | tag (with `tag`) | picked (with `courseIds`), "
                     "`limit` 1–12, layout row | grid. Prefer this over courseCatalog on a landing page; wire it later with "
                     "website_edit(set_courses).",
     "exampleProps": {"title": "New courses", "subtitle": "", "source": "newest", "tag": "", "courseIds": [],
                      "limit": 3, "layout": "row", "badgeText": "", "badgeTone": "hot"}},
    {"type": "productCourseGrid",
     "capabilities": "Every course in the institute as a plain grid (live data), with optional filters/search.",
     "exampleProps": {"title": "", "columns": 3, "layout": "grid", "showPrice": True, "showBadge": True, "showFilters": True}},
    {"type": "trustChip",
     "capabilities": "One line of reassurance — a certification, a count, a guarantee — with an icon name.",
     "exampleProps": {"text": "Trusted by 10,000+ learners", "icon": "ShieldCheck", "align": "center"}},
    {"type": "htmlPage",
     "capabilities": "A whole page authored as HTML + CSS, rendered in a shadow root with the site's theme tokens. "
                     "Use website_edit(add_html_page) rather than placing this in create_page; see html_page_contract.",
     "exampleProps": {"html": "", "css": ""}},
]


def authoring_catalog() -> Dict[str, Any]:
    """The composer's catalogue plus the editor-only blocks: what an authored page may contain."""
    from ..routers.page_builder import _load_catalog
    base = _load_catalog()
    known = {c.get("type") for c in base.get("components") or []}
    return {**base, "components": list(base.get("components") or []) + [c for c in _EXTRA_COMPONENTS if c["type"] not in known]}


_catalog = authoring_catalog


def _is_institute_asset(url: Any) -> bool:
    """Only media we host may be placed: our S3 bucket / CDN, or the media service."""
    if not isinstance(url, str) or not url.startswith("http"):
        return False
    from urllib.parse import urlparse
    from ..config import get_settings
    from .s3_url_utils import extract_s3_key
    st = get_settings()
    bucket = st.aws_bucket_name or getattr(st, "aws_s3_public_bucket", None)
    if bucket and extract_s3_key(url, bucket, st.cdn_public_base_url):
        return True
    host = (urlparse(url).hostname or "").lower()
    allowed_hosts = {h for h in ((urlparse(st.cdn_public_base_url or "").hostname or ""),
                                 (urlparse(st.media_server_base_url or "").hostname or "")) if h}
    # The media library serves through CloudFront in front of our buckets.
    return host in allowed_hosts or host.endswith(".amazonaws.com") or host.endswith(".cloudfront.net")


_IMAGE_PROP_KEYS = {"image", "src", "logo", "avatar", "photo", "backgroundimage", "posterimage", "thumbnail", "url", "ogimage"}


def _asset_urls_in(node: Any, out: set) -> set:
    """Every image-ish URL in a tree that is one of OUR assets (the allow-list for the sanitiser)."""
    if isinstance(node, dict):
        for k, v in node.items():
            if isinstance(v, str) and k.lower() in _IMAGE_PROP_KEYS and _is_institute_asset(v):
                out.add(v)
            else:
                _asset_urls_in(v, out)
    elif isinstance(node, list):
        for v in node:
            _asset_urls_in(v, out)
    return out


def finish_hero(page: Dict[str, Any], media: Optional[List[Dict[str, Any]]] = None) -> List[str]:
    """
    Deterministic polish the composer used to do: a split hero with no image
    either gets the first hero-worthy institute photo or falls back to a
    centered layout — never an empty half-fold. Returns notes.
    """
    notes: List[str] = []
    hero = next((c for c in page.get("components") or [] if isinstance(c, dict) and c.get("type") == "heroSection"), None)
    if hero is None:
        return notes
    p = hero.setdefault("props", {})
    right = p.get("right") if isinstance(p.get("right"), dict) else {}
    has_image = str(right.get("image") or "").startswith("http") or str(p.get("backgroundImage") or "").startswith("http")
    if has_image:
        return notes
    photo = next((m for m in media or [] if m.get("hero_worthy") and m.get("url") and m.get("kind_guess") != "logo"), None)
    if photo:
        p["right"] = {**right, "image": photo["url"], "alt": right.get("alt") or photo.get("name") or "campus"}
        if p.get("layout") not in ("split", "fullwidth"):
            p["layout"] = "split"
        notes.append(f"Placed the institute photo '{photo.get('name')}' in the hero.")
    elif p.get("layout") == "split":
        p["layout"] = "centered"
        notes.append("Hero had no image: switched to a centered layout so the fold is not half empty.")
    return notes


def _sanitize_authored_page(page: Dict[str, Any], page_type: str, global_settings: Optional[Dict[str, Any]]):
    """
    Run a caller-composed page through the builder's sanitiser and audit.

    Returns ``(clean_page, issues, warnings)`` or ``(None, issues, warnings)``
    when nothing usable survived. Unknown types, hostile HTML/CSS and foreign
    image URLs are stripped with a warning each; the audit says what a visitor
    would notice.
    """
    from ..routers.page_builder import (
        _MAX_HTML_BLOCKS_PER_PAGE, coerce_hex_color, resolve_dead_anchors, sanitize_component,
    )
    from ..services.page_audit import audit_page
    if not isinstance(page, dict) or not isinstance(page.get("components"), list):
        return None, [{"severity": "error", "code": "invalid_page", "message": "A page is {route, components:[…]}."}], []
    allowed = _asset_urls_in(page, set())
    allowed_types = {c["type"] for c in _catalog().get("components") or []}
    warnings: List[str] = []
    seen_ids: set = set()
    components: List[Dict[str, Any]] = []
    html_blocks = 0
    # The builder's per-component pass, minus its composer-only page rules: an
    # authored page may have ONE section (course-details templates do), and its
    # explicit paddings are intentional, not a model's over-tight rhythm.
    for original in page["components"]:
        if isinstance(original, dict) and original.get("type") == "htmlPage":
            props = original.get("props") if isinstance(original.get("props"), dict) else {}
            html_page, report = build_html_page(str(page.get("route") or "page"), props.get("html") or "", props.get("css"), None, None)
            if html_page is None:
                warnings.append("Dropped an htmlPage with no renderable HTML")
                continue
            comp = html_page["components"][0]
            comp["id"] = original.get("id") or comp["id"]
            if report.get("scripts_removed") or report.get("images_removed"):
                warnings.append(f"htmlPage '{comp['id']}': removed {report.get('scripts_removed', 0)} script(s), {report.get('images_removed', 0)} foreign image(s)")
            components.append(comp)
            continue
        cleaned = sanitize_component(original, allowed_types, False, seen_ids, allowed, warnings)
        if cleaned is None:
            continue
        if cleaned["type"] == "htmlBlock":
            html_blocks += 1
            if html_blocks > _MAX_HTML_BLOCKS_PER_PAGE:
                warnings.append(f"Dropped htmlBlock beyond the {_MAX_HTML_BLOCKS_PER_PAGE}-per-page cap")
                continue
        _restore_explicit_padding(original, cleaned, warnings)
        components.append(cleaned)
    if not components:
        return None, [{"severity": "error", "code": "empty_page",
                       "message": "No section survived validation — check the warnings and the schema."}], warnings
    resolve_dead_anchors(components, warnings)
    clean: Dict[str, Any] = {"id": page.get("id") or _new_id("page"), "components": components}
    page_bg = coerce_hex_color(page.get("backgroundColor"))
    if page_bg:
        clean["backgroundColor"] = page_bg
    if page.get("hideSiteChrome") is True:
        clean["hideSiteChrome"] = True
    clean["route"] = str(page.get("route") or clean.get("route") or "").strip("/ ") or "page"
    clean["title"] = page.get("title") or clean.get("title")
    seo = page.get("seo") if isinstance(page.get("seo"), dict) else {}
    clean["seo"] = {k: str(seo[k])[:170] for k in ("metaTitle", "metaDescription", "ogImage") if seo.get(k)}
    issues = [{"severity": "error" if i.get("kind") == "fix" else "warning", "code": i.get("code"),
               "message": i.get("message"), "fix": i.get("hint"), "component_id": i.get("component_id")}
              for i in audit_page(clean, global_settings, page_type=page_type or "homepage")]
    return clean, [i for i in issues if i["message"]], warnings


_PAD_KEYS = ("paddingTop", "paddingBottom")
_PAD_NOTE = "keeps the section's own vertical rhythm"


def _restore_explicit_padding(original: Any, cleaned: Dict[str, Any], warnings: List[str]) -> None:
    """The composer's small-padding rule does not apply to authored pages: put back what the author set."""
    style = original.get("style") if isinstance(original, dict) and isinstance(original.get("style"), dict) else {}
    restored = False
    for key in _PAD_KEYS:
        val = style.get(key)
        if isinstance(val, str) and re.fullmatch(r"\s*\d+(?:\.\d+)?px\s*", val) and key not in (cleaned.get("style") or {}):
            cleaned.setdefault("style", {})[key] = val.strip()
            restored = True
    if restored:
        warnings[:] = [w for w in warnings if _PAD_NOTE not in w or f"'{cleaned.get('type')}'" not in w]


# ── HTML pages (the builder's page-level contract: html_page_import) ────
HTML_PAGE_CONTRACT = (
    "An HTML page is ONE htmlPage section holding `html` (body markup; a full document is accepted — "
    "<head>, <script> and <link rel=stylesheet> are removed, <style> blocks move into `css`) and `css`. "
    "It renders in a shadow root: write self-contained CSS (`:root`/`body` selectors become the page "
    "host); the site's fonts/colours are NOT inherited, so set them. No JavaScript at all — nothing "
    "interactive except these hooks, which the site binds at runtime:\n"
    "  <a data-vacademy=\"route\" data-route=\"admissions\">  → another page of this site\n"
    "  <a data-vacademy=\"scroll\" data-target=\"faq\">        → scroll to id=faq\n"
    "  <a data-vacademy=\"lead-form\" data-audience=\"\">        → opens the enquiry form; leave data-audience "
    "empty and wire it with link_lead_form, or set an id from website(context)\n"
    "  <a data-vacademy=\"enrol\" data-course=\"<course id>\"> → enrol in a course\n"
    "  <a href=\"https://…\">                                → external link (http:// is upgraded)\n"
    "Plain relative links (about.html, /contact) are rewritten to route hooks automatically. Images: only "
    "institute media URLs (list_media / import_image); any other <img src> or CSS url() is removed. "
    "Forms/inputs are removed (no backend) — use the lead-form hook. Limits: 200 KB html, 150 KB css. "
    "hide_site_chrome defaults to true (your HTML usually brings its own nav/footer)."
)

_HTML_TITLE_RE = re.compile(r"<title\b[^>]*>(.*?)</title\s*>", re.I | re.S)
_HTML_H1_RE = re.compile(r"<h1\b[^>]*>(.*?)</h1\s*>", re.I | re.S)
_HTML_HEADING_RE = re.compile(r"<h[12]\b[^>]*>(.*?)</h[12]\s*>", re.I | re.S)
_HTML_LEAD_HOOK_RE = re.compile(r'data-vacademy=["\']lead-form["\']', re.I)


def _strip_foreign_images(html: str, report: Dict[str, Any]) -> str:
    """<img src> outside the institute's media → removed (structurally, via bs4)."""
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        return html
    soup = BeautifulSoup(html, "html.parser")
    removed = 0
    for img in soup.find_all("img"):
        src = (img.get("src") or "").strip()
        if src and not _is_institute_asset(src):
            del img["src"]
            removed += 1
    for tag in soup.find_all(style=True):
        style = str(tag.get("style") or "")
        cleaned = _CSS_URL_LOCAL_RE.sub(lambda m: m.group(0) if _is_institute_asset(m.group(1)) else "none", style)
        if cleaned != style:
            tag["style"] = cleaned
            removed += 1
    if removed:
        report["images_removed"] = removed
    return str(soup)


_CSS_URL_LOCAL_RE = re.compile(r"url\(\s*['\"]?([^'\")]+)['\"]?\s*\)", re.I)


def _scrub_css_urls(css: str, report: Dict[str, Any]) -> str:
    def _one(m):
        return m.group(0) if _is_institute_asset(m.group(1)) else "none"
    out = _CSS_URL_LOCAL_RE.sub(_one, css or "")
    dropped = len(_CSS_URL_LOCAL_RE.findall(css or "")) - len([u for u in _CSS_URL_LOCAL_RE.findall(out) if u != "none"])
    if dropped:
        report["css_urls_dropped"] = report.get("css_urls_dropped", 0) + dropped
    return out


def build_html_page(route: str, html: str, css: Optional[str], title: Optional[str], seo: Optional[Dict[str, Any]],
                    hide_site_chrome: bool = True) -> Tuple[Optional[Dict[str, Any]], Dict[str, Any]]:
    """
    Author-supplied HTML/CSS → an htmlPage page, through the builder's page-level
    contract (scripts out, styles split, links → hooks, allowlist) plus this
    tool's asset rule (institute media only). Returns ``(page, report)``.
    """
    from .html_page_import import import_html_page, sanitize_page_html
    raw = str(html or "")
    title_m = _HTML_TITLE_RE.search(raw)
    body, split_css, report = import_html_page(raw)
    body = _strip_foreign_images(body, report)
    clean, used_nh3 = sanitize_page_html(body)
    if not used_nh3:
        report["sanitizer"] = "fallback"
    all_css = "\n".join(part for part in (split_css, str(css or "").strip()) if part)
    all_css = _scrub_css_urls(all_css, report)
    if not clean.strip():
        return None, report
    h1 = _HTML_H1_RE.search(clean)
    page_title = (title or "").strip() or (title_m and strip_html(title_m.group(1), 80)) or (h1 and strip_html(h1.group(1), 80)) or None
    seo = seo if isinstance(seo, dict) else {}
    page = {
        "id": _new_id("page"),
        "route": route,
        "title": page_title,
        "seo": {k: str(seo[k])[:170] for k in ("metaTitle", "metaDescription", "ogImage") if seo.get(k)},
        "hideSiteChrome": bool(hide_site_chrome),
        "components": [{"id": _new_id("htmlpage"), "type": "htmlPage", "enabled": True,
                        "props": {"html": clean, "css": all_css}}],
    }
    report["html_bytes"] = len(clean)
    report["css_bytes"] = len(all_css)
    report["lead_form_hooks"] = len(_HTML_LEAD_HOOK_RE.findall(clean))
    report["headings"] = [strip_html(h, 80) for h in _HTML_HEADING_RE.findall(clean)[:6]]
    return page, {k: v for k, v in report.items() if v not in (0, [], {}, None, False)}


async def _action_add_html_page(args: Dict[str, Any], ctx: ToolContext) -> Dict[str, Any]:
    if err := _require(args, "add_html_page", "route", "html"):
        return err
    route = _slugify(args["route"])
    site = None
    if args.get("tag_name"):
        site, err = await load_site(ctx, args["tag_name"])
        if err:
            return {**err, "action": "add_html_page"}
    elif not args.get("new_site_name"):
        tag, err = await resolve_tag(ctx, None)
        if tag:
            site, err = await load_site(ctx, tag)
        if site is None:
            return _err("missing_argument", action="add_html_page", needs=["tag_name or new_site_name"],
                        message=(err or {}).get("message"))
    page, report = build_html_page(route, args["html"], args.get("css"), args.get("title"), args.get("seo"),
                                   args.get("hide_site_chrome", True) is not False)
    if page is None:
        return _err("invalid_html", message="Nothing renderable survived the HTML allowlist.", report=report)

    config = copy.deepcopy(site["config"]) if site else _new_site_config(None)
    existing = find_page(config, route)
    if existing is not None:
        is_html = any(c.get("type") == "htmlPage" for c in existing.get("components") or [])
        if args.get("replace_existing") and is_html:
            page["id"] = existing.get("id") or page["id"]
            config["pages"] = [page if p is existing else p for p in config["pages"]]
            summary = f"Replaced HTML page '{route}'."
        else:
            page["route"] = _unique_route(config, route)
            config.setdefault("pages", []).append(page)
            summary = f"Added HTML page '{page['route']}' (route '{route}' was taken)."
    else:
        config.setdefault("pages", []).append(page)
        summary = f"Added HTML page '{route}'."

    created = False
    if site is None:
        tag = _slugify(args["new_site_name"])
        config["globalSettings"]["layout"] = default_layout(_institute_name(ctx), config["pages"])
        if await create_site(ctx, tag, config) is None:
            return _err("create_failed", message=f"A site named '{tag}' could not be created (it may already exist).")
        site, err = await load_site(ctx, tag)
        if err:
            return err
        created = True
        summary = f"Created site '{tag}' with HTML page '{page['route']}'."
    revision, err = await save_draft(ctx, site["catalogue_id"], config, "AI_COPILOT", None)
    if err:
        return err
    return _result(ctx, site, config, revision, summary, page["route"], page["components"][0]["id"],
                   created_site=created, import_report=report,
                   next=("Wire enquiry buttons with link_lead_form(section_id=<this section>) if data-audience was left empty; "
                         "images outside institute media were removed — use list_media / import_image."))


def _sanitize_authored_component(comp: Dict[str, Any], allow_chrome: bool, warnings: List[str]) -> Optional[Dict[str, Any]]:
    from ..routers.page_builder import sanitize_component
    allowed_types = {c["type"] for c in _catalog().get("components") or []} | {"header", "footer"}
    return sanitize_component(comp, allowed_types, allow_chrome, set(), _asset_urls_in(comp, set()), warnings)


def _sanitize_authored_ops(ops: List[Dict[str, Any]], page: Dict[str, Any]):
    """The builder's op sanitiser, fed the caller's ops instead of a model's."""
    from ..routers.page_builder import EditPageRequest, PageImage, _sanitize_ops
    allowed = _asset_urls_in(ops, set())
    req = EditPageRequest(page={"id": page.get("id"), "components": page.get("components") or []},
                          instruction="-", images=[PageImage(url=u) for u in sorted(allowed)])
    clean, _reply, warnings = _sanitize_ops(json.dumps({"ops": ops, "reply": ""}), req, _catalog())
    return clean, warnings


def _page_issues(config: Dict[str, Any], route: str) -> List[Dict[str, Any]]:
    """Publish checks for one page (the dashboard's), without ids the model cannot use."""
    r = str(route).lstrip("/").lower()
    return [{k: v for k, v in i.items() if k != "page_id"} for i in run_publish_checks(config)
            if not i.get("page_route") or str(i["page_route"]).lstrip("/").lower() == r]


def _new_site_config(theme: Optional[Dict[str, Any]], site_settings: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    config = {"version": "1.0", "globalSettings": copy.deepcopy(DEFAULT_GLOBAL_SETTINGS), "pages": []}
    if theme:
        config["globalSettings"] = merge_global_settings(config["globalSettings"], theme_to_global_patch(theme))
    if site_settings:
        config["globalSettings"] = merge_global_settings(config["globalSettings"], site_settings_to_global_patch(site_settings))
    return config


async def _action_create_page(args: Dict[str, Any], ctx: ToolContext) -> Dict[str, Any]:
    page = args.get("page")
    if not isinstance(page, dict) or not isinstance(page.get("components"), list):
        return _err("missing_argument", action="create_page", needs=["page.components"],
                    hint="Compose the page per website(action='schema') first.")
    page_type = args.get("page_type") if args.get("page_type") in PAGE_TYPES else "homepage"
    theme = args.get("theme") if isinstance(args.get("theme"), dict) else None

    site = None
    if args.get("tag_name"):
        site, err = await load_site(ctx, args["tag_name"])
        if err:
            return {**err, "action": "create_page"}
    elif not args.get("new_site_name"):
        tag, err = await resolve_tag(ctx, None)
        if tag:
            site, err = await load_site(ctx, tag)
        if site is None:
            return _err("missing_argument", action="create_page", needs=["tag_name or new_site_name"],
                        message=(err or {}).get("message"))

    site_settings = args.get("site_settings") if isinstance(args.get("site_settings"), dict) else None
    config = copy.deepcopy(site["config"]) if site else _new_site_config(theme, site_settings)
    if site and theme:
        config["globalSettings"] = merge_global_settings(config.get("globalSettings") or {}, theme_to_global_patch(theme))
    if site and site_settings:
        config["globalSettings"] = merge_global_settings(config.get("globalSettings") or {}, site_settings_to_global_patch(site_settings))
    clean, issues, warnings = _sanitize_authored_page(page, page_type, config.get("globalSettings"))
    if clean is None:
        return _err("invalid_page", issues=issues, warnings=warnings[:12])
    from .assistant_tools_website import _load_media
    try:
        media = await _load_media(ctx, "any", 12)
    except Exception:  # noqa: BLE001
        media = []
    warnings.extend(finish_hero(clean, media))
    clean["id"] = clean.get("id") or _new_id("page")
    clean["route"] = _unique_route(config, clean["route"])
    config.setdefault("pages", []).append(clean)

    if site is None:
        tag = _slugify(args["new_site_name"])
        config["globalSettings"]["layout"] = default_layout(_institute_name(ctx), config["pages"])
        if await create_site(ctx, tag, config) is None:
            return _err("create_failed", message=f"A site named '{tag}' could not be created (it may already exist).")
        site, err = await load_site(ctx, tag)
        if err:
            return err
        created = True
    else:
        created = False
    revision, err = await save_draft(ctx, site["catalogue_id"], config, "AI_COPILOT", None)
    if err:
        return err
    return _result(ctx, site, config, revision,
                   (f"Created site '{site['tag_name']}' with " if created else "Added ") +
                   f"page '{clean['route']}' ({len(clean['components'])} sections).",
                   clean["route"], created_site=created, page=summarize_page(clean), page_type=page_type,
                   design_issues=issues[:20], warnings=warnings[:12],
                   next="Fix the issues with update_page (ops), wire forms/courses with link_lead_form / set_courses, then ask the admin to review at editor_url.")


async def _action_create_site(args: Dict[str, Any], ctx: ToolContext) -> Dict[str, Any]:
    if err := _require(args, "create_site", "new_site_name", "pages"):
        return err
    pages_in = [p for p in args.get("pages") or [] if isinstance(p, dict)]
    if not pages_in:
        return _err("missing_argument", action="create_site", needs=["pages"])
    theme = args.get("theme") if isinstance(args.get("theme"), dict) else None
    config = _new_site_config(theme, args.get("site_settings") if isinstance(args.get("site_settings"), dict) else None)
    all_issues: Dict[str, Any] = {}
    all_warnings: List[str] = []
    for p in pages_in:
        clean, issues, warnings = _sanitize_authored_page(p, "homepage" if not config["pages"] else "about", config["globalSettings"])
        all_warnings.extend(warnings)
        if clean is None:
            all_issues[str(p.get("route") or "?")] = issues
            continue
        clean["id"] = clean.get("id") or _new_id("page")
        clean["route"] = _unique_route(config, clean["route"])
        config["pages"].append(clean)
        if issues:
            all_issues[clean["route"]] = issues[:12]
    if not config["pages"]:
        return _err("invalid_page", issues=all_issues, warnings=all_warnings[:12])

    warnings: List[str] = []
    layout = default_layout(_institute_name(ctx), config["pages"])
    for key in ("header", "footer"):
        if isinstance(args.get(key), dict):
            cleaned = _sanitize_authored_component(args[key], True, warnings)
            if cleaned and cleaned.get("type") == key:
                layout[key] = cleaned
    config["globalSettings"]["layout"] = layout

    tag = _slugify(args["new_site_name"])
    if await create_site(ctx, tag, config) is None:
        return _err("create_failed", message=f"A site named '{tag}' could not be created (it may already exist).")
    site, err = await load_site(ctx, tag)
    if err:
        return err
    revision, err = await save_draft(ctx, site["catalogue_id"], config, "AI_COPILOT", None)
    if err:
        return err
    return _result(ctx, site, config, revision,
                   f"Created site '{tag}' with {len(config['pages'])} pages: " + ", ".join(p["route"] for p in config["pages"]) + ".",
                   None, created_site=True,
                   pages=[{"route": p["route"], "sections": len(p["components"])} for p in config["pages"]],
                   design_issues=all_issues, warnings=(all_warnings + warnings)[:16])


async def _action_update_page(args: Dict[str, Any], ctx: ToolContext) -> Dict[str, Any]:
    ops = args.get("ops")
    if not isinstance(ops, list) or not ops:
        return _err("missing_argument", action="update_page", needs=["ops"])
    site, err = await _target_site(ctx, args, "update_page")
    if err:
        return err
    page = find_page(site["config"], args.get("page_route"))
    if page is None:
        return _err("unknown_page", available=[p.get("route") for p in site["config"].get("pages") or []])
    clean_ops, warnings = _sanitize_authored_ops([o for o in ops if isinstance(o, dict)][:_MAX_OPS], page)
    if not clean_ops:
        return _err("no_valid_ops", message="None of the ops could be applied.", warnings=warnings[:12])
    config = apply_ops(site["config"], page.get("id"), clean_ops)
    new_page = find_page(config, page.get("route")) or page
    from ..services.page_audit import audit_page
    issues = [{"severity": "error" if i.get("kind") == "fix" else "warning", "code": i.get("code"),
               "message": i.get("message"), "fix": i.get("hint"), "component_id": i.get("component_id")}
              for i in audit_page(new_page, config.get("globalSettings"))]
    revision, err = await save_draft(ctx, site["catalogue_id"], config, "AI_COPILOT", None)
    if err:
        return err
    return _result(ctx, site, config, revision, f"Applied {len(clean_ops)} change(s) to '{page.get('route')}'.",
                   page.get("route"), changes=describe_ops(clean_ops), page=summarize_page(new_page),
                   design_issues=issues[:20], warnings=warnings[:12])


async def _action_set_layout(args: Dict[str, Any], ctx: ToolContext) -> Dict[str, Any]:
    if not (isinstance(args.get("header"), dict) or isinstance(args.get("footer"), dict)):
        return _err("missing_argument", action="set_layout", needs=["header or footer"])
    site, err = await _target_site(ctx, args, "set_layout")
    if err:
        return err
    config = copy.deepcopy(site["config"])
    layout = dict((config.get("globalSettings") or {}).get("layout") or {})
    warnings: List[str] = []
    changed = []
    for key in ("header", "footer"):
        if isinstance(args.get(key), dict):
            comp = {**args[key], "type": key, "id": args[key].get("id") or f"{key}-1", "enabled": args[key].get("enabled", True)}
            cleaned = _sanitize_authored_component(comp, True, warnings)
            if cleaned:
                layout[key] = cleaned
                changed.append(key)
    if not changed:
        return _err("invalid_component", message="Neither header nor footer survived validation.", warnings=warnings[:12])
    config.setdefault("globalSettings", {})["layout"] = layout
    revision, err = await save_draft(ctx, site["catalogue_id"], config, "AI_COPILOT", None)
    if err:
        return err
    return _result(ctx, site, config, revision, f"Updated the site's {' and '.join(changed)}.",
                   layout={k: summarize_component(v) for k, v in layout.items() if isinstance(v, dict)}, warnings=warnings[:12])


async def _action_add_section(args: Dict[str, Any], ctx: ToolContext) -> Dict[str, Any]:
    if err := _require(args, "add_section", "section_type"):
        return err
    section_type = str(args["section_type"])
    props = _example_props(section_type)
    if props is None:
        return _err("unknown_section_type", message=f"'{section_type}' is not a block type.",
                    hint="Use a type from the component catalogue, e.g. testimonialSection, faqSection, courseShowcase, leadForm.")
    site, err = await _target_site(ctx, args, "add_section")
    if err:
        return err
    config = copy.deepcopy(site["config"])
    page = find_page(config, args.get("page_route"))
    if page is None:
        return _err("unknown_page", available=[p.get("route") for p in config.get("pages") or []])
    # Wiring never comes from example props — a form pointing at a sample id
    # would look wired and be broken.
    for k in ("audienceId", "audienceName", "productPageCode", "productPageName"):
        if k in props:
            props[k] = ""
    overrides = args.get("props") if isinstance(args.get("props"), dict) else {}
    props.update({k: v for k, v in overrides.items() if k not in ("audienceId", "productPageCode")})
    comp = {"id": _new_id(section_type), "type": section_type, "enabled": True, "props": props}
    comps = page.setdefault("components", [])
    after = args.get("after_section_id")
    idx = next((i for i, c in enumerate(comps) if isinstance(c, dict) and c.get("id") == after), -1) if after else -1
    comps.insert(idx + 1 if idx >= 0 else len(comps), comp)
    revision, err = await save_draft(ctx, site["catalogue_id"], config, "AI_COPILOT", None)
    if err:
        return err
    return _result(ctx, site, config, revision,
                   f"Added a {component_label(section_type)} section to '{page.get('route')}'.",
                   page.get("route"), comp["id"], section=summarize_component(comp),
                   hint="Use link_lead_form / set_courses to wire it, or edit_page to rewrite its content.")


async def _action_set_theme(args: Dict[str, Any], ctx: ToolContext) -> Dict[str, Any]:
    if err := _require(args, "set_theme", "theme"):
        return err
    patch = theme_to_global_patch(args["theme"])
    if not patch:
        return _err("bad_request", message="Nothing in `theme` was a recognised setting.",
                    accepted={"preset": THEME_PRESETS, "primary_color": "#rrggbb", "mode": ["light", "dark"],
                              "fonts": list(FONT_STACKS), "border_radius": BORDER_RADII,
                              "heading_scale": HEADING_SCALES, "atmosphere": ATMOSPHERES, "motion": MOTIONS})
    site, err = await _target_site(ctx, args, "set_theme")
    if err:
        return err
    config = copy.deepcopy(site["config"])
    config["globalSettings"] = merge_global_settings(config.get("globalSettings") or {}, patch)
    revision, err = await save_draft(ctx, site["catalogue_id"], config, "AI_COPILOT", None)
    if err:
        return err
    return _result(ctx, site, config, revision, "Updated the site's theme.",
                   settings=summarize_global_settings(config["globalSettings"]))


async def _action_set_site_settings(args: Dict[str, Any], ctx: ToolContext) -> Dict[str, Any]:
    if err := _require(args, "set_site_settings", "site_settings"):
        return err
    patch = site_settings_to_global_patch(args["site_settings"])
    if not patch:
        return _err("bad_request", message="Nothing in `site_settings` was a recognised setting.")
    site, err = await _target_site(ctx, args, "set_site_settings")
    if err:
        return err
    config = copy.deepcopy(site["config"])
    config["globalSettings"] = merge_global_settings(config.get("globalSettings") or {}, patch)
    revision, err = await save_draft(ctx, site["catalogue_id"], config, "AI_COPILOT", None)
    if err:
        return err
    return _result(ctx, site, config, revision, "Updated site settings: " + ", ".join(patch.keys()) + ".",
                   settings=summarize_global_settings(config["globalSettings"]))


async def _action_import_image(args: Dict[str, Any], ctx: ToolContext) -> Dict[str, Any]:
    urls = [u for u in (args.get("urls") or []) if isinstance(u, str) and u.strip()][:8]
    if urls:
        results = []
        for u in urls:
            results.append(await _import_one_image({**args, "url": u}, ctx))
        return {"imported": [r for r in results if not r.get("error")], "failed": [r for r in results if r.get("error")],
                "next": "Use the returned urls in the page (hero right.image, imageBlock, gallery)."}
    if err := _require(args, "import_image", "url"):
        return err
    return await _import_one_image(args, ctx)


async def _import_one_image(args: Dict[str, Any], ctx: ToolContext) -> Dict[str, Any]:
    url = str(args["url"]).strip()
    if not url.lower().startswith("https://"):
        return _err("bad_request", message="Only https image URLs can be imported.")
    from ..routers.page_builder import _is_public_http_host
    if not _is_public_http_host(url):
        return _err("bad_request", message="That address is not a public website.")
    import httpx
    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True, max_redirects=3) as client:
            resp = await client.get(url, headers={"User-Agent": "VacademyImageImport/1.0"})
    except Exception as exc:  # noqa: BLE001
        logger.warning("import_image fetch failed for %s: %s", url, exc)
        return _err("fetch_failed", message="The image could not be downloaded.")
    if resp.status_code != 200 or not resp.content:
        return _err("fetch_failed", message=f"The image could not be downloaded (HTTP {resp.status_code}).")
    if len(resp.content) > _MAX_IMPORT_BYTES:
        return _err("too_large", message="Images over 6 MB cannot be imported.")
    ctype = (resp.headers.get("content-type") or "").split(";")[0].strip().lower()
    ext = _IMAGE_TYPES.get(ctype)
    if not ext:
        return _err("not_an_image", message=f"Unsupported content type '{ctype or 'unknown'}'.")
    kind = args.get("kind") if args.get("kind") in IMAGE_KINDS else "photo"
    try:
        from .s3_service import S3Service
        key = f"page-builder/imports/{kind}-{uuid.uuid4().hex}.{ext}"
        stored = S3Service().upload_file_content(resp.content, f"{kind}.{ext}", s3_key=key, content_type=ctype)
    except Exception as exc:  # noqa: BLE001
        logger.warning("import_image upload failed: %s", exc)
        stored = None
    if not stored:
        return _err("upload_failed", message="The image was downloaded but could not be stored.")
    return {"url": stored, "source": url, "kind": kind, "caption": args.get("caption"), "bytes": len(resp.content),
            "next": "Use this url in the page JSON (hero right.image, imageBlock, gallery) or set_layout (header logo)."}


async def _action_set_courses(args: Dict[str, Any], ctx: ToolContext) -> Dict[str, Any]:
    if err := _require(args, "set_courses", "section_id", "source"):
        return err
    site, err = await _target_site(ctx, args, "set_courses")
    if err:
        return err
    config = copy.deepcopy(site["config"])
    page = find_page(config, args.get("page_route"))
    if page is None:
        return _err("unknown_page", available=[p.get("route") for p in config.get("pages") or []])
    comp = find_component(page, str(args["section_id"]))
    if comp is None:
        return _err("unknown_section", message="No section with that id on this page.")
    source = args["source"]
    props = comp.setdefault("props", {})
    if source == "all":
        comp["type"] = "courseCatalog" if comp.get("type") not in ("courseCatalog", "productCourseGrid") else comp["type"]
        props.setdefault("showFilters", True)
        summary = "shows every course in the institute (live)"
    elif source == "showcase":
        mode = args.get("mode") or "newest"
        if mode not in ("newest", "onSale", "tag", "picked"):
            return _err("bad_request", message="mode must be newest, onSale, tag or picked.")
        ids = [str(i) for i in args.get("course_ids") or []]
        if mode == "picked":
            if not ids:
                return _err("missing_argument", needs=["course_ids"])
            all_courses = await load_courses(ctx, limit=200)
            known = {c.get("id") for c in all_courses}
            for c in all_courses:
                known.update(c.get("package_session_ids") or [])
            bad = [i for i in ids if i not in known]
            if bad:
                return _err("unknown_course", message="These course ids are not this institute's.", ids=bad,
                            hint="Take ids from website(action='context').")
        if mode == "tag" and not args.get("tag"):
            return _err("missing_argument", needs=["tag"])
        comp["type"] = "courseShowcase"
        props.update({"source": mode, "courseIds": ids if mode == "picked" else [], "tag": args.get("tag") or "",
                      "limit": max(1, min(int(args.get("limit") or 3), 12))})
        summary = f"shows {mode} courses (limit {props['limit']})"
    else:  # product_page
        code = str(args.get("product_page_code") or "").strip()
        if not code:
            return _err("missing_argument", needs=["product_page_code"])
        pages = await load_product_pages(ctx)
        match = next((p for p in pages if str(p.get("code") or "").lower() == code.lower()), None)
        if match is None:
            return _err("unknown_product_page", message="No product page with that code for this institute.",
                        available=[p.get("code") for p in pages][:20])
        comp["type"] = "productPageOffer"
        props.update({"productPageCode": match["code"], "productPageName": match.get("name") or ""})
        summary = f"shows courses from product page '{match.get('name') or match['code']}'"
    revision, err = await save_draft(ctx, site["catalogue_id"], config, "AI_COPILOT", None)
    if err:
        return err
    return _result(ctx, site, config, revision, f"Section {comp['id']} now {summary}.",
                   page.get("route"), comp["id"], section=summarize_component(comp))


async def _action_link_lead_form(args: Dict[str, Any], ctx: ToolContext) -> Dict[str, Any]:
    if err := _require(args, "link_lead_form", "section_id", "audience_id"):
        return err
    audience_id = str(args["audience_id"]).strip()
    campaign = await get_campaign(ctx, audience_id)
    if campaign is None:
        return _err("unknown_campaign", message="No such lead campaign for this institute.",
                    hint="Take ids from website(action='context') or audience_forms(action='list').")
    if str(campaign.get("status") or "ACTIVE").upper() != "ACTIVE":
        return _err("campaign_inactive", message=f"Campaign '{campaign.get('campaign_name')}' is {campaign.get('status')}; only ACTIVE campaigns receive leads.")
    site, err = await _target_site(ctx, args, "link_lead_form")
    if err:
        return err
    config = copy.deepcopy(site["config"])
    page = find_page(config, args.get("page_route"))
    if page is None:
        return _err("unknown_page", available=[p.get("route") for p in config.get("pages") or []])
    comp = find_component(page, str(args["section_id"]))
    if comp is None:
        return _err("unknown_section", message="No section with that id on this page.")
    surfaces = capture_surfaces(comp)
    name = str(campaign.get("campaign_name") or "")
    props = comp.setdefault("props", {})
    if comp.get("type") == "htmlPage":
        html, n = _wire_html_lead_hooks(str(props.get("html") or ""), audience_id)
        if not n:
            return _err("not_a_form", message="This HTML page has no lead-form hook (<a data-vacademy=\"lead-form\">) to wire.")
        props["html"] = html
        wired = f"{n} lead-form hook(s)"
        surfaces = None
    elif not surfaces:
        # Not a capture block: make its primary button open the campaign's form,
        # the same choice the editor offers on hero / CTA buttons.
        button = props.get("button") if isinstance(props.get("button"), dict) else None
        if button is not None:
            button.update({"action": "openForm", "audienceId": audience_id})
            wired = f"its button '{button.get('text') or ''}'"
        else:
            return _err("not_a_form", message=f"Section {comp['id']} ({component_label(comp.get('type'))}) has no form or button to wire.")
    elif surfaces:
        wired_labels = []
        for s in surfaces:
            _set_path(comp, s["path"], audience_id)
            if s["kind"] == "form_section":
                props["audienceName"] = name
            wired_labels.append(s["label"])
        wired = ", ".join(wired_labels)
    revision, err = await save_draft(ctx, site["catalogue_id"], config, "AI_COPILOT", None)
    if err:
        return err
    return _result(ctx, site, config, revision,
                   f"{component_label(comp.get('type'))} on '{page.get('route')}': {wired} now sends enquiries to campaign '{name}'.",
                   page.get("route"), comp["id"], campaign={"id": audience_id, "name": name})


def _wire_html_lead_hooks(html: str, audience_id: str) -> Tuple[str, int]:
    """Set data-audience on every lead-form hook in an HTML page. Structural (bs4), never regex-rewritten."""
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        return html, 0
    soup = BeautifulSoup(html, "html.parser")
    n = 0
    for el in soup.find_all(attrs={"data-vacademy": "lead-form"}):
        el["data-audience"] = audience_id
        n += 1
    return (str(soup) if n else html), n


def _set_path(comp: Dict[str, Any], path: str, value: Any) -> None:
    """Set ``props.left.buttons[0].audienceId``-style paths produced by capture_surfaces."""
    node: Any = comp
    parts = re.findall(r"([A-Za-z_]+)|\[(\d+)\]", path)
    keys = [k or int(i) for k, i in parts]
    for k in keys[:-1]:
        node = node[k] if isinstance(k, int) else node.setdefault(k, {})
    last = keys[-1]
    if isinstance(last, int):
        node[last] = value
    else:
        node[last] = value


async def _action_set_seo(args: Dict[str, Any], ctx: ToolContext) -> Dict[str, Any]:
    if not (args.get("meta_title") or args.get("meta_description")):
        return _err("missing_argument", action="set_seo", needs=["meta_title or meta_description"])
    site, err = await _target_site(ctx, args, "set_seo")
    if err:
        return err
    config = copy.deepcopy(site["config"])
    page = find_page(config, args.get("page_route"))
    if page is None:
        return _err("unknown_page", available=[p.get("route") for p in config.get("pages") or []])
    seo = page.setdefault("seo", {}) if isinstance(page.get("seo"), dict) else {}
    page["seo"] = seo
    if args.get("meta_title"):
        seo["metaTitle"] = str(args["meta_title"])[:70]
    if args.get("meta_description"):
        seo["metaDescription"] = str(args["meta_description"])[:170]
    revision, err = await save_draft(ctx, site["catalogue_id"], config, "AI_COPILOT", None)
    if err:
        return err
    return _result(ctx, site, config, revision, f"Updated SEO for '{page.get('route')}'.", page.get("route"),
                   seo={"meta_title": seo.get("metaTitle"), "meta_description": seo.get("metaDescription")})


async def _action_discard_draft(args: Dict[str, Any], ctx: ToolContext) -> Dict[str, Any]:
    site, err = await _target_site(ctx, args, "discard_draft")
    if err:
        return err
    if not site["from_draft"]:
        return {"tag_name": site["tag_name"], "summary_of_change": "There was no draft to discard.", "saved_as": None}
    data = await _admin_core_json(
        ctx, "POST", "/admin-core-service/v1/course-catalogue/revision/discard-draft",
        params={"catalogueId": site["catalogue_id"]},
    )
    if _is_error(data) and data.get("status") not in (200, 204):
        return _err("discard_failed", message="The draft could not be discarded.")
    return {"tag_name": site["tag_name"], "summary_of_change": "Draft discarded; the site is back to its published version.",
            "editor_url": site_editor_url(site["tag_name"], ctx=ctx)}


_ACTIONS = {
    "create_page": _action_create_page,
    "create_site": _action_create_site,
    "update_page": _action_update_page,
    "set_layout": _action_set_layout,
    "add_section": _action_add_section,
    "set_theme": _action_set_theme,
    "set_site_settings": _action_set_site_settings,
    "add_html_page": _action_add_html_page,
    "set_courses": _action_set_courses,
    "link_lead_form": _action_link_lead_form,
    "set_seo": _action_set_seo,
    "import_image": _action_import_image,
    "discard_draft": _action_discard_draft,
}


async def execute_website_edit(args: Dict[str, Any], ctx: ToolContext) -> str:
    action = str((args or {}).get("action") or "").strip()
    handler = _ACTIONS.get(action)
    if handler is None:
        return json.dumps(_err("unknown_action", action=action, available=list(WEBSITE_EDIT_ACTIONS)))
    result = await handler(args or {}, ctx)
    if isinstance(result, dict) and "action" not in result:
        result = {"action": action, **result}
    return json.dumps(result, ensure_ascii=False, default=str)


WEBSITE_EDIT_TOOLS: Dict[str, ToolSpec] = {
    WEBSITE_EDIT_TOOL_NAME: ToolSpec(
        name=WEBSITE_EDIT_TOOL_NAME,
        schema=WEBSITE_EDIT_SCHEMA,
        executor=execute_website_edit,
        required_permission=None,
        setting_key=WEBSITE_EDIT_GROUP_KEY,
        # Writes are never default-on: an admin opts a role in from settings.
        default_enabled=False,
        default_roles=None,
        phase=3,
        mode="WRITE",
    ),
}


def _register() -> None:
    from .assistant_tool_registry import ASSISTANT_TOOLS, GROUP_LABELS
    ASSISTANT_TOOLS.update(WEBSITE_EDIT_TOOLS)
    GROUP_LABELS.update({WEBSITE_EDIT_GROUP_KEY: "Website: edit drafts"})


_register()

__all__ = [
    "WEBSITE_EDIT_TOOLS", "WEBSITE_EDIT_TOOL_NAME", "WEBSITE_EDIT_GROUP_KEY", "WEBSITE_EDIT_ACTIONS",
    "WEBSITE_EDIT_SCHEMA", "execute_website_edit", "apply_ops", "describe_ops",
    "theme_to_global_patch", "site_settings_to_global_patch", "merge_global_settings", "DEFAULT_GLOBAL_SETTINGS",
    "default_layout", "authoring_catalog", "build_html_page", "HTML_PAGE_CONTRACT", "finish_hero",
]
