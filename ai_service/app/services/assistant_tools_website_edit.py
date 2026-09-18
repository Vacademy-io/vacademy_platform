"""
The ``website_edit`` tool — DRAFT-ONLY changes to the institute's websites for
the Assistant and the MCP server.

One tool with an ``action`` argument, its own settings toggle ("Website: edit
drafts", off by default), and one rule that makes it safe to hand to an AI app:
**nothing here reaches a visitor.** Every action loads the site the editor
would show (draft over published), applies the change, and saves it as a new
DRAFT revision (``source=AI_COPILOT`` / ``AI_WIZARD``, ``ai_run_id``). The admin
reviews it in the dashboard, where the publish checks run, and presses Publish
themselves — that is the confirmation step. ``discard_draft`` is the undo.

Actions
    estimate          credits a generation would cost + balance
    generate_page     wizard-equivalent: brief object → a composed page (new or existing site)
    generate_site     whole site into a NEW draft site
    edit_page         copilot: instruction → ops → applied
    edit_chrome       header / footer / theme / fonts / motion by instruction
    add_section       deterministic insert of one block (no LLM)
    set_theme         colours, fonts, radius, atmosphere, motion (no LLM)
    brand_kit         2–3 brand kits from notes / an existing website
    import_image      bring a public image into the media library
    generate_image    logo / hero / banner / photo options
    set_courses       which courses a course block shows
    link_lead_form    point a form / popup button at a lead campaign
    set_seo           meta title / description of a page
    discard_draft     drop the draft, back to what is published

The heavy lifting (composer, copilot, images, credits, sanitising) is the page
builder's own handlers, called in-process with the pinned principal; this
module only shapes arguments and persists results.
"""
from __future__ import annotations

import copy
import json
import logging
import re
import uuid
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException

from .assistant_tool_registry import ToolContext, ToolSpec, _admin_core_json
from .catalogue_summary import (
    capture_surfaces,
    component_label,
    find_component,
    find_page,
    run_publish_checks,
    summarize_component,
    summarize_global_settings,
)
from .website_data import (
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
    "estimate", "generate_page", "generate_site", "edit_page", "edit_chrome", "add_section",
    "set_theme", "brand_kit", "import_image", "generate_image", "set_courses", "link_lead_form",
    "set_seo", "discard_draft",
)

THEME_PRESETS = ("default", "ocean", "forest", "sunset", "midnight", "rose", "violet", "amber", "slate")
DESIGN_LANGUAGES = (
    "editorial-serif", "swiss-minimal", "bold-modern", "dark-tech",
    "warm-community", "corporate-trust", "directory-reference",
)
PAGE_TYPES = ("homepage", "courses", "course-landing", "about", "admissions", "contact")
IMAGE_KINDS = ("logo", "hero", "banner", "illustration", "photo", "image")
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

_CATALOG_PATH = Path(__file__).resolve().parent.parent / "data" / "catalogue_schema_catalog.json"

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
_BRIEF_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "description": (
        "What the admin told you in the interview (website action='brief_checklist'). Ask before "
        "guessing: identity and page_type are required; theme or design_language is required; the "
        "rest lifts the result."
    ),
    "properties": {
        "identity": {"type": "string", "description": "What the institute is, what it offers, what makes it different, its display name and tagline."},
        "proof_points": {"type": "array", "items": {"type": "string"}, "description": "Results, years, learner counts, toppers, records, notable faculty."},
        "audience": {"type": "string", "enum": ["children", "adults", "all"]},
        "tone": {"type": "string", "description": "e.g. warm, premium, bold, academic, playful."},
        "theme": {
            "type": "object",
            "description": "Colours and type. Omit a field to let the composer choose.",
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
                "motion": {"type": "string", "enum": list(MOTIONS)},
            },
        },
        "design_language": {"type": "string", "enum": list(DESIGN_LANGUAGES)},
        "images": {
            "type": "array",
            "description": "Logo and photos to place — media-library URLs from website(list_media) or import_image / generate_image results.",
            "items": {"type": "object", "properties": {
                "url": {"type": "string"},
                "kind": {"type": "string", "enum": ["logo", "photo", "banner"]},
                "caption": {"type": "string"},
            }, "required": ["url"]},
        },
        "inspiration_image_urls": {"type": "array", "items": {"type": "string"}, "description": "Screenshots of sites the admin admires (max 6)."},
        "reference_url": {"type": "string", "description": "A website whose LAYOUT to follow (colours stay ours)."},
        "source_url": {"type": "string", "description": "The admin's existing website, to take copy and structure from."},
        "contact": {"type": "object", "properties": {
            "phone": {"type": "string"}, "whatsapp": {"type": "string"}, "email": {"type": "string"},
            "address": {"type": "string"}, "socials": {"type": "array", "items": {"type": "string"}},
        }},
        "sections_wanted": {"type": "array", "items": {"type": "string"}, "description": "Sections the admin explicitly asked for, in order."},
        "language": {"type": "string", "description": "Language for the copy, when not English."},
        "notes": {"type": "string", "description": "Anything else from the interview."},
    },
    "required": ["identity"],
}

WEBSITE_EDIT_SCHEMA: Dict[str, Any] = {
    "type": "function",
    "function": {
        "name": WEBSITE_EDIT_TOOL_NAME,
        "description": (
            "Change the institute's websites. EVERY change is saved as a DRAFT the admin reviews and "
            "publishes in the dashboard — nothing goes live from here. Pick an `action`:\n"
            "- estimate (scope: page|site): credits a generation costs + balance. Call before generating.\n"
            "- generate_page (tag_name OR new_site_name, brief, page_type, route_slug?, use_real_courses?, "
            "course_ids?, auto_images?): compose a page from the interview brief. Run "
            "website(action='brief_checklist') first and ask the admin what is missing.\n"
            "- generate_site (new_site_name, brief, page_types?, use_real_courses?, auto_images?): a whole "
            "site into a NEW draft site.\n"
            "- edit_page (tag_name, page_route, instruction, section_id?): change a page by instruction "
            "('add a testimonials section after the courses', 'make the hero darker').\n"
            "- edit_chrome (tag_name, instruction): header, footer, theme, fonts, motion by instruction.\n"
            "- add_section (tag_name, page_route, section_type, after_section_id?, props?): insert one block "
            "with default content — no AI call, no credits.\n"
            "- set_theme (tag_name, theme): colours, fonts, radius, atmosphere, motion — no credits.\n"
            "- brand_kit (brand_notes?, website_url?, institute_name?): 2–3 brand kits to offer the admin; "
            "pass the chosen one to set_theme or brief.theme.\n"
            "- import_image (url, kind, caption?): copy a public https image into the media library so it "
            "can be placed. generate_image (prompt, kind, count?, aspect_ratio?): logo/hero/photo options.\n"
            "- set_courses (tag_name, page_route, section_id, source: all|showcase|product_page, mode?, "
            "course_ids?, limit?, product_page_code?): which courses a course block shows.\n"
            "- link_lead_form (tag_name, page_route, section_id, audience_id): send a form or popup button's "
            "enquiries to a lead campaign. Ids ONLY from website(action='context') / audience_forms.\n"
            "- set_seo (tag_name, page_route, meta_title?, meta_description?).\n"
            "- discard_draft (tag_name): throw the draft away — the undo for everything above.\n"
            "Every result carries editor_url: tell the admin to review and publish there."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "action": {"type": "string", "enum": list(WEBSITE_EDIT_ACTIONS)},
                "tag_name": {"type": "string", "description": "Existing site (from website list)."},
                "new_site_name": {"type": "string", "description": "generate_page / generate_site: name for a NEW site; becomes its URL path."},
                "page_route": {"type": "string"},
                "section_id": {"type": "string", "description": "A section id from website(get_page)."},
                "brief": _BRIEF_SCHEMA,
                "page_type": {"type": "string", "enum": list(PAGE_TYPES)},
                "page_types": {"type": "array", "items": {"type": "string", "enum": list(PAGE_TYPES)}},
                "route_slug": {"type": "string"},
                "use_real_courses": {"type": "boolean", "description": "Ground the copy in the institute's real courses (default true)."},
                "course_ids": {"type": "array", "items": {"type": "string"}},
                "auto_images": {"type": "boolean", "description": "Let the composer generate missing images (default true)."},
                "instruction": {"type": "string"},
                "section_type": {"type": "string", "description": "Block type, e.g. testimonialSection, faqSection, courseShowcase, leadForm."},
                "after_section_id": {"type": "string"},
                "props": {"type": "object", "description": "add_section: prop overrides for the new block."},
                "theme": _BRIEF_SCHEMA["properties"]["theme"],
                "brand_notes": {"type": "string", "description": "brand_kit: colours, vibe, fonts the admin described; logo description."},
                "website_url": {"type": "string", "description": "brand_kit: the institute's current website to read colours/fonts/logo from."},
                "institute_name": {"type": "string"},
                "url": {"type": "string", "description": "import_image: public https image URL."},
                "kind": {"type": "string", "enum": list(IMAGE_KINDS)},
                "caption": {"type": "string"},
                "prompt": {"type": "string", "description": "generate_image: what to draw."},
                "count": {"type": "integer", "description": "generate_image: 1–3 options."},
                "aspect_ratio": {"type": "string", "description": "generate_image: 16:9, 4:3, 1:1, 3:4, 9:16, 3:2, 2:3."},
                "source": {"type": "string", "enum": ["all", "showcase", "product_page"]},
                "mode": {"type": "string", "enum": ["newest", "onSale", "tag", "picked"], "description": "set_courses showcase mode."},
                "tag": {"type": "string", "description": "set_courses mode=tag: the course tag."},
                "limit": {"type": "integer"},
                "product_page_code": {"type": "string"},
                "audience_id": {"type": "string"},
                "meta_title": {"type": "string"},
                "meta_description": {"type": "string"},
                "scope": {"type": "string", "enum": ["page", "site"]},
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


def _builder_user(ctx: ToolContext) -> Any:
    """What the page-builder handlers read off ``current_user``: the pinned identity only."""
    return SimpleNamespace(institute_id=ctx.principal.institute_id, user_id=ctx.principal.user_id)


async def _call_builder(fn, body: Any, ctx: ToolContext) -> Tuple[Any, Optional[Dict[str, Any]]]:
    """Run a page-builder handler in-process; HTTP errors become tool errors."""
    try:
        return await fn(body, db=ctx.db, current_user=_builder_user(ctx)), None
    except HTTPException as exc:
        code = {402: "insufficient_credits", 400: "bad_request", 429: "rate_limited"}.get(exc.status_code, "builder_failed")
        detail = exc.detail if isinstance(exc.detail, str) else json.dumps(exc.detail, default=str)
        return None, _err(code, message=detail[:400])
    except Exception as exc:  # noqa: BLE001
        logger.exception("website_edit builder call failed: %s", exc)
        return None, _err("builder_failed", message="The page builder could not complete this request.")


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


# ── brief → composer text / theme patch ─────────────────────────────────
def brief_to_text(brief: Dict[str, Any], page_type: Optional[str] = None) -> str:
    """
    Flatten the interview object into the rich composer brief the wizard's
    intake produces: identity + proof + tone + colour/style direction + which
    photos exist + explicit sections. Dense, under ~350 words.
    """
    parts: List[str] = []
    identity = str(brief.get("identity") or "").strip()
    if identity:
        parts.append(identity)
    if page_type:
        parts.append(f"Page type: {page_type}.")
    proof = [str(p).strip() for p in brief.get("proof_points") or [] if str(p).strip()]
    if proof:
        parts.append("Proof points to feature: " + "; ".join(proof[:12]) + ".")
    if brief.get("audience"):
        parts.append(f"Audience: {brief['audience']}.")
    if brief.get("tone"):
        parts.append(f"Tone: {brief['tone']}.")
    theme = brief.get("theme") if isinstance(brief.get("theme"), dict) else {}
    style_bits = []
    if theme.get("primary_color"):
        style_bits.append(f"brand colour {theme['primary_color']}")
    if theme.get("preset"):
        style_bits.append(f"palette preset '{theme['preset']}'")
    if theme.get("mode"):
        style_bits.append(f"{theme['mode']} mode")
    fonts = theme.get("fonts") if isinstance(theme.get("fonts"), dict) else {}
    if fonts.get("body") or fonts.get("heading"):
        style_bits.append("fonts: " + " / ".join(f for f in (fonts.get("heading"), fonts.get("body")) if f))
    if style_bits:
        parts.append("Colour/style direction: " + ", ".join(style_bits) + ".")
    images = [i for i in brief.get("images") or [] if isinstance(i, dict) and i.get("url")]
    if images:
        kinds = {}
        for i in images:
            kinds[i.get("kind") or "photo"] = kinds.get(i.get("kind") or "photo", 0) + 1
        parts.append("Provided assets: " + ", ".join(f"{n} {k}{'s' if n > 1 else ''}" for k, n in kinds.items()) + " — place them; do not invent others for those roles.")
    contact = brief.get("contact") if isinstance(brief.get("contact"), dict) else {}
    contact_bits = [f"{k}: {v}" for k, v in contact.items() if v and k != "socials"]
    if contact.get("socials"):
        contact_bits.append("socials: " + ", ".join(map(str, contact["socials"])))
    if contact_bits:
        parts.append("Contact details (use verbatim): " + "; ".join(contact_bits) + ".")
    sections = [str(s).strip() for s in brief.get("sections_wanted") or [] if str(s).strip()]
    if sections:
        parts.append("Sections the admin asked for, in order: " + " → ".join(sections) + ".")
    if brief.get("language"):
        parts.append(f"Write the copy in {brief['language']}.")
    if brief.get("notes"):
        parts.append(str(brief["notes"]).strip())
    return "\n".join(parts)


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
    if isinstance(atmosphere, str) and atmosphere in ATMOSPHERES:
        t["atmosphere"] = {"canvas": atmosphere, "intensity": "medium"}
    elif isinstance(atmosphere, dict) and atmosphere.get("canvas") in ATMOSPHERES:
        t["atmosphere"] = {"canvas": atmosphere["canvas"], "intensity": atmosphere.get("intensity") or "medium"}
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
    if page_route:
        route = str(page_route).lstrip("/").lower()
        issues = [i for i in issues if not i.get("page_route") or str(i["page_route"]).lstrip("/").lower() == route]
    out: Dict[str, Any] = {
        "tag_name": site["tag_name"],
        "summary_of_change": summary,
        "saved_as": "draft",
        "draft_revision_no": (revision or {}).get("revision_no"),
        "editor_url": site_editor_url(site["tag_name"], page_route, section_id),
        "live_url": site_url(ctx, site["tag_name"]),
        "audit": {
            "errors": [{k: v for k, v in i.items() if k != "page_id"} for i in issues if i["severity"] == "error"][:8],
            "warnings": len([i for i in issues if i["severity"] == "warning"]),
        },
        "next": "Ask the admin to review the draft at editor_url and press Publish there; nothing is live yet.",
    }
    if page_route:
        out["page_route"] = page_route
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
async def _action_estimate(args: Dict[str, Any], ctx: ToolContext) -> Dict[str, Any]:
    from ..routers.page_builder import estimate_page_generation
    try:
        est = await estimate_page_generation(db=ctx.db, current_user=_builder_user(ctx))
    except HTTPException as exc:
        return _err("estimate_failed", message=str(exc.detail)[:200])
    scope = args.get("scope") or "page"
    pages = len(args.get("page_types") or []) or (3 if scope == "site" else 1)
    per_page = est.get("estimated_credits")
    out: Dict[str, Any] = {
        "scope": scope,
        "pages": pages,
        "credits_per_page": per_page,
        "current_balance": est.get("current_balance"),
    }
    try:
        total = float(per_page) * pages
        out["estimated_total"] = total
        balance = est.get("current_balance")
        out["sufficient"] = None if balance is None else float(balance) >= total
    except (TypeError, ValueError):
        pass
    out["note"] = "Generated images and copilot edits are metered separately per call."
    return out


async def _prepare_generation(args: Dict[str, Any], ctx: ToolContext, action: str):
    """Shared by generate_page / generate_site: brief text, snapshot, images, target."""
    brief = args.get("brief") if isinstance(args.get("brief"), dict) else None
    if not brief or not str(brief.get("identity") or "").strip():
        return None, _err("missing_argument", action=action, needs=["brief.identity"],
                          hint="Run website(action='brief_checklist') and interview the admin first.")
    theme = brief.get("theme") if isinstance(brief.get("theme"), dict) else {}
    design_language = brief.get("design_language")
    if design_language and design_language not in DESIGN_LANGUAGES:
        design_language = None

    site = None
    if args.get("tag_name"):
        site, err = await load_site(ctx, args["tag_name"])
        if err:
            return None, {**err, "action": action}
    elif not args.get("new_site_name"):
        # No site named: use the institute's default/only site if it has one,
        # otherwise the admin has to name the new site.
        tag, err = await resolve_tag(ctx, None)
        if tag:
            site, err = await load_site(ctx, tag)
        if site is None:
            return None, _err("missing_argument", action=action, needs=["tag_name or new_site_name"],
                              message=(err or {}).get("message"))

    courses = await load_courses(ctx) if args.get("use_real_courses", True) else []
    snapshot = _course_snapshot(courses, args.get("course_ids"))
    images = [{"url": i["url"], "caption": i.get("caption"), "kind": i.get("kind")}
              for i in brief.get("images") or [] if isinstance(i, dict) and i.get("url")]
    inspiration = [u for u in brief.get("inspiration_image_urls") or [] if isinstance(u, str)][:6]

    existing_gs = (site or {}).get("config", {}).get("globalSettings") if site else None
    # Keep an existing site's look unless the admin gave a theme; a new site
    # starts from the brief's theme (or lets the composer propose one).
    global_settings = None
    if site and existing_gs and not theme and not design_language:
        global_settings = existing_gs
    elif theme:
        global_settings = merge_global_settings(existing_gs or DEFAULT_GLOBAL_SETTINGS, theme_to_global_patch(theme))

    return {
        "brief": brief, "brief_text": brief_to_text(brief, args.get("page_type")),
        "site": site, "courses": snapshot, "images": images, "inspiration": inspiration,
        "design_language": design_language, "global_settings": global_settings,
        "institute_name": args.get("institute_name") or _institute_name(ctx),
        "reference_url": brief.get("reference_url"), "source_url": brief.get("source_url"),
        "theme_patch": theme_to_global_patch(theme) if theme else None,
    }, None


def _brand_profile(brief: Dict[str, Any]) -> Dict[str, Any]:
    """The interview facts worth keeping on the site for later edits."""
    keep = {k: brief.get(k) for k in ("identity", "proof_points", "audience", "tone", "contact", "language") if brief.get(k)}
    return keep


async def _action_generate_page(args: Dict[str, Any], ctx: ToolContext) -> Dict[str, Any]:
    from ..routers.page_builder import GeneratePageRequest, generate_page
    page_type = args.get("page_type") or "homepage"
    if page_type not in PAGE_TYPES:
        return _err("bad_request", action="generate_page", message=f"page_type must be one of {PAGE_TYPES}")
    prep, err = await _prepare_generation(args, ctx, "generate_page")
    if err:
        return err

    body = GeneratePageRequest(
        brief=prep["brief_text"],
        page_type=page_type,
        route_slug=args.get("route_slug") or None,
        institute_name=prep["institute_name"],
        images=prep["images"],
        inspiration_image_urls=prep["inspiration"],
        design_language=prep["design_language"],
        source_url=prep["source_url"],
        reference_url=prep["reference_url"],
        courses=prep["courses"],
        global_settings=prep["global_settings"],
        auto_images=bool(args.get("auto_images", True)),
    )
    resp, err = await _call_builder(generate_page, body, ctx)
    if err:
        return err

    site = prep["site"]
    if site is None:
        tag = _slugify(args["new_site_name"])
        config = {"version": "1.0", "globalSettings": copy.deepcopy(DEFAULT_GLOBAL_SETTINGS), "pages": []}
        if prep["theme_patch"]:
            config["globalSettings"] = merge_global_settings(config["globalSettings"], prep["theme_patch"])
        if resp.global_settings:
            config["globalSettings"] = merge_global_settings(config["globalSettings"], resp.global_settings)
        config["globalSettings"]["brandProfile"] = _brand_profile(prep["brief"])
        config["pages"].append(_generated_page_to_page(resp.page, config, page_type))
        if await create_site(ctx, tag, config) is None:
            return _err("create_failed", message=f"The page was composed but a site named '{tag}' could not be created (it may already exist).")
        site, err = await load_site(ctx, tag)
        if err:
            return err
        revision, err = await save_draft(ctx, site["catalogue_id"], config, "AI_WIZARD", resp.run_id)
        if err:
            return err
        return _result(ctx, site, config, revision,
                       f"Created site '{tag}' with a new {page_type} page ({len(config['pages'][0]['components'])} sections).",
                       config["pages"][0]["route"], warnings=resp.warnings[:6], created_site=True)

    config = copy.deepcopy(site["config"])
    if prep["theme_patch"]:
        config["globalSettings"] = merge_global_settings(config.get("globalSettings") or {}, prep["theme_patch"])
    elif resp.global_settings and not site["config"].get("globalSettings", {}).get("theme"):
        config["globalSettings"] = merge_global_settings(config.get("globalSettings") or {}, resp.global_settings)
    gs = config.setdefault("globalSettings", {})
    if not gs.get("brandProfile"):
        gs["brandProfile"] = _brand_profile(prep["brief"])
    page = _generated_page_to_page(resp.page, config, page_type)
    config.setdefault("pages", []).append(page)
    revision, err = await save_draft(ctx, site["catalogue_id"], config, "AI_WIZARD", resp.run_id)
    if err:
        return err
    return _result(ctx, site, config, revision,
                   f"Added a new {page_type} page '{page['route']}' with {len(page['components'])} sections.",
                   page["route"], warnings=resp.warnings[:6])


async def _action_generate_site(args: Dict[str, Any], ctx: ToolContext) -> Dict[str, Any]:
    from ..routers.page_builder import GenerateSiteRequest, generate_site
    if err := _require(args, "generate_site", "new_site_name"):
        return err
    page_types = [p for p in (args.get("page_types") or ["homepage", "about", "contact"]) if p in PAGE_TYPES] or ["homepage"]
    prep, err = await _prepare_generation({**args, "tag_name": None}, ctx, "generate_site")
    if err:
        return err
    body = GenerateSiteRequest(
        brief=prep["brief_text"],
        page_types=page_types,
        institute_name=prep["institute_name"],
        images=prep["images"],
        courses=prep["courses"],
        source_url=prep["source_url"],
        auto_images=bool(args.get("auto_images", True)),
        inspiration_image_urls=prep["inspiration"],
        reference_url=prep["reference_url"],
        design_language=prep["design_language"],
        global_settings=prep["global_settings"],
    )
    resp, err = await _call_builder(generate_site, body, ctx)
    if err:
        return err
    tag = _slugify(args["new_site_name"])
    config = {"version": "1.0", "globalSettings": copy.deepcopy(DEFAULT_GLOBAL_SETTINGS), "pages": []}
    if prep["theme_patch"]:
        config["globalSettings"] = merge_global_settings(config["globalSettings"], prep["theme_patch"])
    if resp.global_settings:
        config["globalSettings"] = merge_global_settings(config["globalSettings"], resp.global_settings)
    config["globalSettings"]["brandProfile"] = _brand_profile(prep["brief"])
    for sp in resp.pages:
        gen = sp.page if isinstance(sp.page, dict) else sp.page.model_dump()
        config["pages"].append(_generated_page_to_page(gen, config, sp.page_type))
    if await create_site(ctx, tag, config) is None:
        return _err("create_failed", message=f"The site was composed but '{tag}' could not be created (it may already exist).")
    site, err = await load_site(ctx, tag)
    if err:
        return err
    revision, err = await save_draft(ctx, site["catalogue_id"], config, "AI_WIZARD", None)
    if err:
        return err
    return _result(ctx, site, config, revision,
                   f"Created site '{tag}' with {len(config['pages'])} pages: " + ", ".join(p["route"] for p in config["pages"]) + ".",
                   None, warnings=resp.warnings[:6], created_site=True,
                   pages=[{"route": p["route"], "sections": len(p["components"])} for p in config["pages"]])


async def _action_edit_page(args: Dict[str, Any], ctx: ToolContext) -> Dict[str, Any]:
    from ..routers.page_builder import EditPageRequest, edit_page
    if err := _require(args, "edit_page", "instruction"):
        return err
    site, err = await _target_site(ctx, args, "edit_page")
    if err:
        return err
    page = find_page(site["config"], args.get("page_route"))
    if page is None:
        return _err("unknown_page", available=[p.get("route") for p in site["config"].get("pages") or []])
    gs = site["config"].get("globalSettings") or {}
    profile = gs.get("brandProfile") if isinstance(gs.get("brandProfile"), dict) else {}
    body = EditPageRequest(
        page={"id": page.get("id"), "components": page.get("components") or []},
        instruction=str(args["instruction"]),
        selected_component_id=args.get("section_id") or None,
        institute_name=_institute_name(ctx),
        images=[],
        terminology=None,
        history=[{"role": "user", "content": f"Brand profile: {json.dumps(profile, ensure_ascii=False)}"}] if profile else [],
        allow_chrome=False,
        auto_images=bool(args.get("auto_images", True)),
    )
    resp, err = await _call_builder(edit_page, body, ctx)
    if err:
        return err
    ops = [o for o in resp.ops if isinstance(o, dict)]
    if not ops:
        return {"tag_name": site["tag_name"], "summary_of_change": "No change made.", "reply": resp.reply, "saved_as": None}
    config = apply_ops(site["config"], page.get("id"), ops)
    revision, err = await save_draft(ctx, site["catalogue_id"], config, "AI_COPILOT", resp.run_id)
    if err:
        return err
    return _result(ctx, site, config, revision, resp.reply or "Applied the requested edits.", page.get("route"),
                   changes=describe_ops(ops), warnings=resp.warnings[:6])


async def _action_edit_chrome(args: Dict[str, Any], ctx: ToolContext) -> Dict[str, Any]:
    from ..routers.page_builder import SiteChromeRequest, edit_site_chrome
    if err := _require(args, "edit_chrome", "instruction"):
        return err
    site, err = await _target_site(ctx, args, "edit_chrome")
    if err:
        return err
    body = SiteChromeRequest(
        instruction=str(args["instruction"]),
        global_settings=site["config"].get("globalSettings") or {},
        pages=[{"id": p.get("id"), "route": p.get("route"), "title": p.get("title")}
               for p in site["config"].get("pages") or [] if isinstance(p, dict)],
        institute_name=_institute_name(ctx),
    )
    resp, err = await _call_builder(edit_site_chrome, body, ctx)
    if err:
        return err
    config = copy.deepcopy(site["config"])
    config["globalSettings"] = merge_global_settings(config.get("globalSettings") or {}, resp.global_settings or {})
    revision, err = await save_draft(ctx, site["catalogue_id"], config, "AI_COPILOT", resp.run_id)
    if err:
        return err
    return _result(ctx, site, config, revision, resp.reply or "Updated the site's header/footer/theme.",
                   settings=summarize_global_settings(config["globalSettings"]), warnings=resp.warnings[:6])


#: Blocks the editor offers that the composer's schema catalogue does not carry
#: (it lists what the AI may COMPOSE). Defaults mirror component-templates.ts.
_EXTRA_TEMPLATES: Dict[str, Dict[str, Any]] = {
    "courseShowcase": {"title": "New courses", "subtitle": "", "source": "newest", "tag": "", "courseIds": [],
                       "limit": 3, "layout": "row", "badgeText": "", "badgeTone": "hot"},
    "productCourseGrid": {"title": "", "columns": 3, "layout": "grid", "showPrice": True, "showBadge": True,
                          "showFilters": True},
    "trustChip": {"text": "Trusted by 10,000+ learners", "icon": "ShieldCheck", "align": "center"},
}


def _example_props(section_type: str) -> Optional[Dict[str, Any]]:
    try:
        catalog = json.loads(_CATALOG_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        catalog = {}
    for c in catalog.get("components") or []:
        if c.get("type") == section_type:
            return copy.deepcopy(c.get("exampleProps") or {})
    if section_type in _EXTRA_TEMPLATES:
        return copy.deepcopy(_EXTRA_TEMPLATES[section_type])
    return None


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


async def _action_brand_kit(args: Dict[str, Any], ctx: ToolContext) -> Dict[str, Any]:
    from ..routers.page_builder import BrandKitRequest, derive_brand_kit
    notes = [str(args.get("brand_notes") or "").strip()]
    warnings: List[str] = []
    scraped: Optional[Dict[str, Any]] = None
    website_url = str(args.get("website_url") or "").strip()
    if website_url:
        try:
            from .brand_kit_scrape_service import BrandKitScrapeService
            res = await BrandKitScrapeService().scrape_brand_kit(website_url, ctx.principal.institute_id)
            draft = res.draft
            palette = draft.palette
            scraped = {k: v for k, v in {
                "primary": palette.primary, "secondary": palette.secondary, "accent": palette.accent,
                "background": palette.background, "heading_font": draft.heading_font, "body_font": draft.body_font,
                "logo_url": res.preview.logo_url,
            }.items() if v}
            warnings.extend(res.warnings[:3])
            if scraped:
                notes.append("From the institute's current website: " + ", ".join(f"{k} {v}" for k, v in scraped.items() if k != "logo_url"))
        except Exception as exc:  # noqa: BLE001
            logger.warning("brand_kit scrape of %s failed: %s", website_url, exc)
            warnings.append("Could not read the website; kits are based on the notes only.")
    body = BrandKitRequest(
        institute_name=args.get("institute_name") or _institute_name(ctx),
        brief=str(args.get("brief") if isinstance(args.get("brief"), str) else (args.get("brief") or {}).get("identity") or "") or None,
        brand_notes=" ".join(n for n in notes if n) or None,
    )
    resp, err = await _call_builder(derive_brand_kit, body, ctx)
    if err:
        return err
    kits = []
    for k in resp.kits:
        kd = k.model_dump() if hasattr(k, "model_dump") else dict(k)
        kits.append({
            "label": kd.get("label"), "rationale": kd.get("rationale"),
            "theme": {
                "preset": kd.get("themePreset"), "primary_color": kd.get("primaryColor"),
                "fonts": {"body": kd.get("fontFamily"), "heading": kd.get("headingFontFamily")},
                "border_radius": kd.get("borderRadius"), "heading_scale": kd.get("headingScale"),
                "atmosphere": (kd.get("atmosphere") or {}).get("canvas"), "motion": kd.get("motion"),
            },
        })
    out: Dict[str, Any] = {"kits": kits, "next": "Offer these to the admin; pass the chosen `theme` to set_theme or as brief.theme."}
    if scraped:
        out["read_from_website"] = scraped
    if warnings:
        out["warnings"] = warnings
    return out


async def _action_import_image(args: Dict[str, Any], ctx: ToolContext) -> Dict[str, Any]:
    if err := _require(args, "import_image", "url"):
        return err
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
    return {"url": stored, "kind": kind, "caption": args.get("caption"), "bytes": len(resp.content),
            "next": "Use this url in brief.images or an edit instruction."}


async def _action_generate_image(args: Dict[str, Any], ctx: ToolContext) -> Dict[str, Any]:
    from ..routers.page_builder import GenerateImageRequest, generate_page_image
    if err := _require(args, "generate_image", "prompt"):
        return err
    count = max(1, min(int(args.get("count") or 1), 3))
    body = GenerateImageRequest(
        prompt=str(args["prompt"]),
        kind=args.get("kind") if args.get("kind") in IMAGE_KINDS else "image",
        aspect_ratio=args.get("aspect_ratio") or None,
        count=count,
    )
    resp, err = await _call_builder(generate_page_image, body, ctx)
    if err:
        return err
    return {"urls": list(resp.urls), "kind": body.kind,
            "next": "Show the admin the options; use the chosen url in brief.images or an edit instruction."}


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
    if not surfaces:
        # Not a capture block: make its primary button open the campaign's form,
        # the same choice the editor offers on hero / CTA buttons.
        button = props.get("button") if isinstance(props.get("button"), dict) else None
        if button is not None:
            button.update({"action": "openForm", "audienceId": audience_id})
            wired = f"its button '{button.get('text') or ''}'"
        else:
            return _err("not_a_form", message=f"Section {comp['id']} ({component_label(comp.get('type'))}) has no form or button to wire.")
    else:
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
            "editor_url": site_editor_url(site["tag_name"])}


_ACTIONS = {
    "estimate": _action_estimate,
    "generate_page": _action_generate_page,
    "generate_site": _action_generate_site,
    "edit_page": _action_edit_page,
    "edit_chrome": _action_edit_chrome,
    "add_section": _action_add_section,
    "set_theme": _action_set_theme,
    "brand_kit": _action_brand_kit,
    "import_image": _action_import_image,
    "generate_image": _action_generate_image,
    "set_courses": _action_set_courses,
    "link_lead_form": _action_link_lead_form,
    "set_seo": _action_set_seo,
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
    "WEBSITE_EDIT_SCHEMA", "execute_website_edit", "apply_ops", "describe_ops", "brief_to_text",
    "theme_to_global_patch", "merge_global_settings", "DEFAULT_GLOBAL_SETTINGS",
]
