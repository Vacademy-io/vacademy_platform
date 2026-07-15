"""
AI Page Builder — composes catalogue pages as schema-bound JSON.

The admin page-builder's pages are pure JSON (typed components + a token-driven
style engine), so the composer never writes HTML/CSS: it emits a Page object
against the checked-in schema catalog (app/data/catalogue_schema_catalog.json,
regenerated from the editor's component templates via
scripts/export-catalogue-schema-catalog.mjs). Output is validated/sanitized
server-side — unknown component types are dropped, htmlBlock is forbidden, and
image URLs are whitelisted to the assets the admin actually provided.

Phase A scope: one page per run (wizard). Copilot ops come in Phase B.
"""
from __future__ import annotations

import json
import logging
import os
import re
import uuid
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..core.security import get_current_user
from ..db import db_dependency
from ..models.ai_token_usage import RequestType
from ..services.ai_billing import preflight_tool_credits, record_tool_billing
from ..services.llm_json import generate_json
from ..services.model_selection import resolve_models

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/page-builder", tags=["page-builder"])

# Page composition wants a strong instruction-following model; override via env.
_DEFAULT_MODEL = os.getenv("PAGE_BUILDER_MODEL") or "anthropic/claude-sonnet-5"
_USAGE_MARKUP = Decimal("2")
_TOOL_KEY = "page_generate"

_CATALOG_PATH = Path(__file__).resolve().parent.parent / "data" / "catalogue_schema_catalog.json"

_SLUG_RE = re.compile(r"[^a-z0-9-]+")

# Prop keys whose string values are image/media URLs — anything not in the
# provided-asset allowlist is stripped so the model can never hotlink or
# hallucinate an image URL.
_IMAGE_KEYS = {
    "image", "src", "logo", "avatar", "photo", "backgroundimage", "posterimage",
    "thumbnail", "icontype_image", "imageurl",
}
_IMAGE_LIST_KEYS = {"avatars", "imagecollage", "images"}

# Hostile URL schemes — browsers strip embedded control chars/whitespace before
# parsing a scheme, so "java\tscript:" still fires; normalize first.
_HOSTILE_SCHEME_RE = re.compile(r"^(javascript|data|vbscript)\s*:", re.IGNORECASE)
_CTRL_WS_RE = re.compile(r"[\x00-\x20]")


def _strip_hostile(value: str) -> str:
    normalized = _CTRL_WS_RE.sub("", value)
    return "" if _HOSTILE_SCHEME_RE.match(normalized) else value


_RICH_TEXT_RE = re.compile(r"<[a-zA-Z/!]")


def _sanitize_html(value: str) -> str:
    """Rich-text props are rendered via dangerouslySetInnerHTML on both the
    admin canvas and the published learner page — scrub any markup-bearing
    string through an HTML sanitizer (nh3/ammonia defaults: no scripts,
    no event handlers, no hostile URLs)."""
    if not _RICH_TEXT_RE.search(value):
        return value
    try:
        import nh3
        return nh3.clean(value)
    except Exception:  # noqa: BLE001 — sanitizer unavailable: strip all tags
        return re.sub(r"<[^>]*>", "", value)


def _load_catalog() -> Dict[str, Any]:
    with open(_CATALOG_PATH, "r", encoding="utf-8") as fh:
        return json.load(fh)


# ─── Request / response models ──────────────────────────────────────────────

class PageImage(BaseModel):
    url: str
    caption: Optional[str] = None
    kind: Optional[str] = None  # logo | photo | banner


class CourseSnapshotItem(BaseModel):
    name: str
    price: Optional[str] = None
    level: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None


class GeneratePageRequest(BaseModel):
    brief: str = Field(..., description="The admin's natural-language description of the page")
    page_type: Optional[str] = Field(None, description="homepage | course-landing | about | admissions | contact")
    route_slug: Optional[str] = None
    institute_name: Optional[str] = None
    images: List[PageImage] = Field(default_factory=list)
    # Compact snapshot of real courses, passed by the admin FE so copy and
    # data-bound components reference real offerings (no new cross-service call).
    courses: List[CourseSnapshotItem] = Field(default_factory=list)
    # Institute Naming Settings overrides, e.g. {"course": "Program"}
    terminology: Optional[Dict[str, str]] = None
    # A distinct design angle for "try another direction" re-runs.
    direction: Optional[str] = None
    preferred_model: Optional[str] = None
    # Header/footer are site chrome; the composer may only emit them when the
    # caller explicitly opts in (Phase B copilot).
    allow_chrome: bool = False


class GeneratePageResponse(BaseModel):
    page: Dict[str, Any]
    run_id: str
    model: str
    warnings: List[str] = Field(default_factory=list)


# ─── Prompt ──────────────────────────────────────────────────────────────────

def _build_prompt(req: GeneratePageRequest, catalog: Dict[str, Any]) -> str:
    parts: List[str] = []
    parts.append(
        "You are the page composer for Vacademy's catalogue website builder. "
        "You produce ONE page as pure JSON against the component vocabulary below. "
        "You never write HTML or CSS — only the JSON schema. Your pages must look "
        "designed by a senior product designer: clear hierarchy, generous rhythm, "
        "specific benefit-led copy (never lorem ipsum, never generic filler)."
    )
    vocab = catalog["components"]
    if not req.allow_chrome:
        # The site provides global header/footer — keep them out of the
        # vocabulary so prompt and sanitizer agree.
        vocab = [c for c in vocab if c.get("type") not in ("header", "footer")]
    parts.append("## COMPONENT VOCABULARY (types with example props)\n" + json.dumps(vocab, ensure_ascii=False))
    parts.append("## STYLE VOCABULARY\n" + json.dumps(catalog["styleSchema"], ensure_ascii=False))
    parts.append("## RULES\n- " + "\n- ".join(catalog["doctrine"]))

    if req.institute_name:
        parts.append(f"## INSTITUTE\nName: {req.institute_name}")
    if req.terminology:
        parts.append(
            "## TERMINOLOGY (use these words in all copy)\n"
            + json.dumps(req.terminology, ensure_ascii=False)
        )
    if req.courses:
        parts.append(
            "## REAL COURSES (reference these by name; use courseCatalog for the live grid)\n"
            + json.dumps([c.model_dump(exclude_none=True) for c in req.courses], ensure_ascii=False)
        )
    if req.images:
        parts.append(
            "## PROVIDED IMAGES (the ONLY image URLs you may use — place them where their caption fits; "
            "leave image fields empty if nothing fits)\n"
            + json.dumps([i.model_dump(exclude_none=True) for i in req.images], ensure_ascii=False)
        )
    if req.direction:
        parts.append(f"## DESIGN DIRECTION\n{req.direction}")

    page_type = req.page_type or "homepage"
    parts.append(
        f"## TASK\nPage type: {page_type}\nAdmin brief (mirror its language in the page copy):\n{req.brief.strip()}"
    )
    parts.append(
        "## OUTPUT CONTRACT\nReturn ONLY a JSON object of this exact shape (no markdown, no commentary):\n"
        '{"page": {"id": "<kebab-id>", "title": "<short page title>", "route": "<kebab-slug>", '
        '"components": [{"id": "<kebab-id>", "type": "<type>", "enabled": true, "props": {…}, "style": {…}?}, …]}}\n'
        "6–12 components. Do NOT include header or footer components — the site provides global ones."
    )
    return "\n\n".join(parts)


# ─── Validation / sanitization ───────────────────────────────────────────────

def _clean_string(value: str) -> str:
    return _sanitize_html(_strip_hostile(value))


def clean_urls(node: Any, allowed_urls: set, warnings: List[str]) -> Any:
    """Deep-scrub any props/style subtree: image keys become allowlist-keep,
    every string loses hostile URL schemes + embedded markup. Shared by the
    generate (whole page) and edit (patches/inserts) paths."""
    if isinstance(node, dict):
        out: Dict[str, Any] = {}
        for k, v in node.items():
            lk = k.lower()
            # Image keys: pure allowlist-keep — empty, or exactly a provided
            # URL; everything else (data:, //host, HTTP, hallucinated) stripped.
            if lk in _IMAGE_KEYS and isinstance(v, str):
                if v and v not in allowed_urls:
                    warnings.append(f"Stripped unknown image URL from '{k}'")
                    out[k] = ""
                else:
                    out[k] = v
            elif lk in _IMAGE_LIST_KEYS and isinstance(v, list):
                kept = [u for u in v if not (isinstance(u, str) and u and u not in allowed_urls)]
                if len(kept) != len(v):
                    warnings.append(f"Stripped unknown image URL(s) from '{k}'")
                out[k] = clean_urls(kept, allowed_urls, warnings)
            # mediaShowcase media[]: image items must use provided URLs; video
            # items (YouTube/Vimeo links) pass through untouched.
            elif lk == "media" and isinstance(v, list):
                cleaned_items = []
                for item in v:
                    if (
                        isinstance(item, dict)
                        and str(item.get("type", "")).lower() == "image"
                        and isinstance(item.get("url"), str)
                        and item["url"]
                        and item["url"] not in allowed_urls
                    ):
                        warnings.append("Stripped unknown image URL from 'media'")
                        item = {**item, "url": ""}
                    cleaned_items.append(clean_urls(item, allowed_urls, warnings))
                out[k] = cleaned_items
            # style.backgroundLayers[]: image layers must use provided URLs
            elif lk == "backgroundlayers" and isinstance(v, list):
                kept_layers = []
                for layer in v:
                    if (
                        isinstance(layer, dict)
                        and layer.get("type") == "image"
                        and isinstance(layer.get("url"), str)
                        and layer["url"]
                        and layer["url"] not in allowed_urls
                    ):
                        warnings.append("Dropped background image layer with unknown URL")
                        continue
                    kept_layers.append(clean_urls(layer, allowed_urls, warnings))
                out[k] = kept_layers
            else:
                out[k] = clean_urls(v, allowed_urls, warnings)
        return out
    if isinstance(node, list):
        return [clean_urls(v, allowed_urls, warnings) for v in node]
    if isinstance(node, str):
        # Every string: kill hostile schemes (javascript:/data:/vbscript:) and
        # sanitize embedded markup (rich-text props reach dangerouslySetInnerHTML).
        return _clean_string(node)
    return node


def sanitize_component(
    comp: Any, allowed_types: set, allow_chrome: bool, seen_ids: set, allowed_urls: set, warnings: List[str]
) -> Optional[Dict[str, Any]]:
    """Validate + scrub one component; returns None (with a warning) when the
    type is forbidden/unknown or props are missing. Recurses columnLayout slots."""
    if not isinstance(comp, dict):
        return None
    ctype = comp.get("type")
    if ctype == "htmlBlock":
        warnings.append("Dropped forbidden htmlBlock component")
        return None
    if ctype in ("header", "footer") and not allow_chrome:
        warnings.append(f"Dropped {ctype} (site provides global chrome)")
        return None
    if ctype not in allowed_types:
        warnings.append(f"Dropped unknown component type '{ctype}'")
        return None
    props = comp.get("props")
    if not isinstance(props, dict):
        warnings.append(f"Dropped '{ctype}' with missing props")
        return None
    cid = str(comp.get("id") or f"{ctype}-{uuid.uuid4().hex[:6]}")
    cid = _SLUG_RE.sub("-", cid.lower()).strip("-") or f"{ctype}-{uuid.uuid4().hex[:6]}".lower()
    while cid in seen_ids:
        cid = f"{cid}-{uuid.uuid4().hex[:4]}"
    seen_ids.add(cid)
    cleaned_props = clean_urls(props, allowed_urls, warnings)
    # columnLayout nests component arrays in props.slots — recurse so the type
    # filter / htmlBlock ban can't be smuggled past via slots.
    slots = cleaned_props.get("slots")
    if isinstance(slots, list):
        cleaned_props["slots"] = [
            [c for c in (sanitize_component(ch, allowed_types, allow_chrome, seen_ids, allowed_urls, warnings) for ch in slot) if c is not None]
            if isinstance(slot, list) else []
            for slot in slots
        ]
    cleaned: Dict[str, Any] = {
        "id": cid,
        "type": ctype,
        "enabled": True,
        "props": cleaned_props,
    }
    if isinstance(comp.get("style"), dict) and comp["style"]:
        cleaned["style"] = clean_urls(comp["style"], allowed_urls, warnings)
    return cleaned


def _sanitize_page(raw_json: str, req: GeneratePageRequest, catalog: Dict[str, Any]) -> tuple[Dict[str, Any], List[str]]:
    warnings: List[str] = []
    try:
        data = json.loads(raw_json)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"Model returned invalid JSON: {e}")

    page = data.get("page") if isinstance(data, dict) else None
    if page is None and isinstance(data, dict) and "components" in data:
        page = data  # model returned the page object directly
    if not isinstance(page, dict) or not isinstance(page.get("components"), list):
        raise HTTPException(status_code=502, detail="Model output did not contain a page with components.")

    allowed_types = {c["type"] for c in catalog["components"]}
    allowed_urls = {i.url for i in req.images}
    seen_ids: set = set()

    components: List[Dict[str, Any]] = []
    for comp in page["components"]:
        cleaned = sanitize_component(comp, allowed_types, req.allow_chrome, seen_ids, allowed_urls, warnings)
        if cleaned is not None:
            components.append(cleaned)

    if len(components) < 2:
        raise HTTPException(status_code=502, detail="Generation produced too few usable sections — please retry.")

    slug_source = req.route_slug or page.get("route") or req.page_type or "ai-page"
    route = _SLUG_RE.sub("-", str(slug_source).lower()).strip("-") or "ai-page"

    result = {
        "id": f"page-{uuid.uuid4().hex[:8]}",
        "title": page.get("title") or page.get("name"),
        "route": route,
        "components": components,
    }
    return result, warnings


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/v1/estimate")
async def estimate_page_generation(
    db: Session = Depends(db_dependency),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    """Credit cost preview + balance check for the wizard's confirm step.
    Institute comes ONLY from the authenticated principal — a caller must
    never be able to read another institute's balance by naming it."""
    institute_id = getattr(current_user, "institute_id", None)
    if not institute_id:
        raise HTTPException(status_code=400, detail="No institute context on this session.")
    return preflight_tool_credits(db, tool_key=_TOOL_KEY, tool_params={}, institute_id=institute_id)


@router.post("/v1/generate", response_model=GeneratePageResponse)
async def generate_page(
    body: GeneratePageRequest,
    db: Session = Depends(db_dependency),
    current_user=Depends(get_current_user),
) -> GeneratePageResponse:
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    if not body.brief or not body.brief.strip():
        raise HTTPException(status_code=400, detail="A brief describing the page is required.")

    # Institute comes ONLY from the authenticated principal — never from the
    # body, so a caller can't bill (or probe) another institute's credits.
    institute_id = getattr(current_user, "institute_id", None)
    if not institute_id:
        raise HTTPException(status_code=400, detail="No institute context on this session.")
    actor_user_id = getattr(current_user, "user_id", None)

    # Pre-flight credit gate — flat per run; charged only after success.
    estimate = preflight_tool_credits(db, tool_key=_TOOL_KEY, tool_params={}, institute_id=institute_id)
    if estimate.get("sufficient") is False:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                f"Insufficient credits: generating this page needs ~{estimate['estimated_credits']} "
                f"credits but the balance is {estimate.get('current_balance')}."
            ),
        )

    catalog = _load_catalog()
    prompt = _build_prompt(body, catalog)
    # Billing id is minted server-side — a caller-supplied id could replay the
    # idempotency key and make repeat generations free.
    run_id = uuid.uuid4().hex

    primary, fallbacks = resolve_models(
        db, "page_builder", preferred_model=body.preferred_model, hard_fallback=_DEFAULT_MODEL
    )
    try:
        raw_json, model_used, usage = await generate_json(
            prompt, [primary, *fallbacks], label="page-builder"
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("[page-builder] generation failed: %s", e)
        raise HTTPException(status_code=502, detail=f"Page generation failed: {e}")

    page, warnings = _sanitize_page(raw_json, body, catalog)

    # Best-effort post-paid billing; idempotency key dedups retried runs.
    try:
        record_tool_billing(
            tool_key=_TOOL_KEY,
            tool_params={"page_type": body.page_type or "homepage"},
            request_type=RequestType.CONTENT,
            model=model_used,
            prompt_tokens=int((usage or {}).get("prompt_tokens") or 0),
            completion_tokens=int((usage or {}).get("completion_tokens") or 0),
            institute_id=institute_id,
            user_id=actor_user_id,
            user_role=None,
            idempotency_key=f"{_TOOL_KEY}:{run_id}",
            usage_markup=_USAGE_MARKUP,
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("[page-builder] billing skipped: %s", e)

    return GeneratePageResponse(page=page, run_id=run_id, model=model_used, warnings=warnings)


# ─── Copilot (conversational edit) ──────────────────────────────────────────

_EDIT_TOOL_KEY = "page_edit"
_ALLOWED_GLOBAL_KEYS = {"theme", "motion", "fonts"}


class ChatTurn(BaseModel):
    role: str  # 'user' | 'assistant'
    content: str


class EditPageRequest(BaseModel):
    # Current page the admin is editing (id + components). Sent verbatim so the
    # model edits what's on screen, not a stale copy.
    page: Dict[str, Any]
    instruction: str
    selected_component_id: Optional[str] = None
    institute_name: Optional[str] = None
    images: List[PageImage] = Field(default_factory=list)
    terminology: Optional[Dict[str, str]] = None
    # Prior turns for context (kept short by the FE).
    history: List[ChatTurn] = Field(default_factory=list)
    allow_chrome: bool = False
    preferred_model: Optional[str] = None


class EditPageResponse(BaseModel):
    ops: List[Dict[str, Any]]
    reply: str
    run_id: str
    model: str
    warnings: List[str] = Field(default_factory=list)


def _build_edit_prompt(req: EditPageRequest, catalog: Dict[str, Any]) -> str:
    parts: List[str] = []
    parts.append(
        "You are the copilot for Vacademy's catalogue website builder. The admin has an existing "
        "page (JSON, typed components) and asks for a change in plain language. You respond with a "
        "SMALL LIST OF OPERATIONS that transform the page — never a whole new page. Keep edits "
        "surgical: touch only what the request implies."
    )
    vocab = catalog["components"]
    if not req.allow_chrome:
        vocab = [c for c in vocab if c.get("type") not in ("header", "footer")]
    parts.append("## COMPONENT VOCABULARY (types with example props)\n" + json.dumps(vocab, ensure_ascii=False))
    parts.append("## STYLE VOCABULARY\n" + json.dumps(catalog["styleSchema"], ensure_ascii=False))

    if req.terminology:
        parts.append("## TERMINOLOGY (use these words in copy)\n" + json.dumps(req.terminology, ensure_ascii=False))
    if req.images:
        parts.append(
            "## PROVIDED IMAGES (the ONLY image URLs you may use)\n"
            + json.dumps([i.model_dump(exclude_none=True) for i in req.images], ensure_ascii=False)
        )
    if req.history:
        convo = "\n".join(f"{t.role}: {t.content}" for t in req.history[-6:])
        parts.append("## RECENT CONVERSATION\n" + convo)

    parts.append("## CURRENT PAGE\n" + json.dumps(req.page, ensure_ascii=False))
    if req.selected_component_id:
        parts.append(
            f"## FOCUS\nThe admin has selected component id '{req.selected_component_id}'. "
            "If the request is about 'this'/'the selected' section, scope your ops to it."
        )
    parts.append("## REQUEST\n" + req.instruction.strip())
    parts.append(
        "## OUTPUT CONTRACT\nReturn ONLY JSON of this shape (no markdown, no commentary):\n"
        '{"reply": "<one friendly sentence summarizing what you changed>", "ops": [\n'
        '  {"op": "insert", "component": {"id":"<kebab>","type":"<type>","enabled":true,"props":{…},"style":{…}?}, "afterId": "<existing-id or null to prepend>", "note": "<plain-language>"},\n'
        '  {"op": "update", "id": "<existing-id>", "propsPatch": {…}?, "stylePatch": {…}?, "note": "<plain-language>"},\n'
        '  {"op": "remove", "id": "<existing-id>", "note": "<plain-language>"},\n'
        '  {"op": "move", "id": "<existing-id>", "afterId": "<existing-id or null>", "note": "<plain-language>"},\n'
        '  {"op": "updateGlobalSettings", "patch": {"theme"|"motion"|"fonts": …}, "note": "<plain-language>"}\n'
        "]}\n"
        "propsPatch/stylePatch are SHALLOW-merged into the component's existing props/style — send only "
        "the keys that change. Reference only ids that exist in CURRENT PAGE (except insert's new id). "
        "If the request cannot be satisfied with the vocabulary, return an empty ops list and explain in reply."
    )
    return "\n\n".join(parts)


def _sanitize_ops(raw_json: str, req: EditPageRequest, catalog: Dict[str, Any]) -> tuple[List[Dict[str, Any]], str, List[str]]:
    warnings: List[str] = []
    try:
        data = json.loads(raw_json)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"Model returned invalid JSON: {e}")
    if not isinstance(data, dict) or not isinstance(data.get("ops"), list):
        raise HTTPException(status_code=502, detail="Model output did not contain an ops list.")

    reply = str(data.get("reply") or "").strip()
    allowed_types = {c["type"] for c in catalog["components"]}
    allowed_urls = {i.url for i in req.images}
    # Ids that exist on the page (top-level + slot children) — ops may only
    # reference these (inserts bring their own new id).
    existing_ids: set = set()

    def collect(components: Any) -> None:
        for c in components if isinstance(components, list) else []:
            if isinstance(c, dict) and c.get("id"):
                existing_ids.add(c["id"])
                slots = (c.get("props") or {}).get("slots")
                if isinstance(slots, list):
                    for slot in slots:
                        collect(slot)

    collect(req.page.get("components"))

    clean_ops: List[Dict[str, Any]] = []
    seen_ids = set(existing_ids)
    for op in data["ops"]:
        if not isinstance(op, dict):
            continue
        kind = op.get("op")
        note = _clean_string(str(op.get("note") or ""))
        if kind == "insert":
            comp = sanitize_component(op.get("component"), allowed_types, req.allow_chrome, seen_ids, allowed_urls, warnings)
            if comp is None:
                continue
            after = op.get("afterId")
            if after is not None and after not in existing_ids:
                warnings.append("insert.afterId not on page — appended to end")
                after = None
            clean_ops.append({"op": "insert", "component": comp, "afterId": after, "note": note})
        elif kind == "update":
            oid = op.get("id")
            if oid not in existing_ids:
                warnings.append(f"update skipped — unknown id '{oid}'")
                continue
            entry: Dict[str, Any] = {"op": "update", "id": oid, "note": note}
            if isinstance(op.get("propsPatch"), dict):
                patch = clean_urls(op["propsPatch"], allowed_urls, warnings)
                # A propsPatch may set columnLayout slots — type-filter nested
                # components so htmlBlock/unknown types can't be smuggled in via
                # an update (the insert path already recurses slots).
                slots = patch.get("slots")
                if isinstance(slots, list):
                    patch["slots"] = [
                        [c for c in (sanitize_component(ch, allowed_types, req.allow_chrome, seen_ids, allowed_urls, warnings) for ch in slot) if c is not None]
                        if isinstance(slot, list) else []
                        for slot in slots
                    ]
                entry["propsPatch"] = patch
            if isinstance(op.get("stylePatch"), dict):
                entry["stylePatch"] = clean_urls(op["stylePatch"], allowed_urls, warnings)
            if "propsPatch" not in entry and "stylePatch" not in entry:
                continue
            clean_ops.append(entry)
        elif kind == "remove":
            oid = op.get("id")
            if oid not in existing_ids:
                warnings.append(f"remove skipped — unknown id '{oid}'")
                continue
            clean_ops.append({"op": "remove", "id": oid, "note": note})
        elif kind == "move":
            oid = op.get("id")
            if oid not in existing_ids:
                warnings.append(f"move skipped — unknown id '{oid}'")
                continue
            after = op.get("afterId")
            if after is not None and after not in existing_ids:
                after = None
            clean_ops.append({"op": "move", "id": oid, "afterId": after, "note": note})
        elif kind == "updateGlobalSettings":
            patch = op.get("patch")
            if not isinstance(patch, dict):
                continue
            # Only theme/motion/fonts may be touched conversationally.
            safe = {k: clean_urls(v, allowed_urls, warnings) for k, v in patch.items() if k in _ALLOWED_GLOBAL_KEYS}
            if not safe:
                warnings.append("updateGlobalSettings skipped — no allowed keys")
                continue
            clean_ops.append({"op": "updateGlobalSettings", "patch": safe, "note": note})
        else:
            warnings.append(f"Dropped unknown op '{kind}'")

    return clean_ops, reply, warnings


@router.post("/v1/edit", response_model=EditPageResponse)
async def edit_page(
    body: EditPageRequest,
    db: Session = Depends(db_dependency),
    current_user=Depends(get_current_user),
) -> EditPageResponse:
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    if not body.instruction or not body.instruction.strip():
        raise HTTPException(status_code=400, detail="An instruction is required.")
    if not isinstance(body.page, dict) or not isinstance(body.page.get("components"), list):
        raise HTTPException(status_code=400, detail="A current page with components is required.")

    institute_id = getattr(current_user, "institute_id", None)
    if not institute_id:
        raise HTTPException(status_code=400, detail="No institute context on this session.")
    actor_user_id = getattr(current_user, "user_id", None)

    estimate = preflight_tool_credits(db, tool_key=_EDIT_TOOL_KEY, tool_params={}, institute_id=institute_id)
    if estimate.get("sufficient") is False:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                f"Insufficient credits: this edit needs ~{estimate['estimated_credits']} "
                f"credits but the balance is {estimate.get('current_balance')}."
            ),
        )

    catalog = _load_catalog()
    prompt = _build_edit_prompt(body, catalog)
    run_id = uuid.uuid4().hex

    primary, fallbacks = resolve_models(
        db, "page_builder", preferred_model=body.preferred_model, hard_fallback=_DEFAULT_MODEL
    )
    try:
        raw_json, model_used, usage = await generate_json(
            prompt, [primary, *fallbacks], label="page-copilot"
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("[page-copilot] edit failed: %s", e)
        raise HTTPException(status_code=502, detail=f"Edit failed: {e}")

    ops, reply, warnings = _sanitize_ops(raw_json, body, catalog)

    try:
        record_tool_billing(
            tool_key=_EDIT_TOOL_KEY,
            tool_params={"op_count": len(ops)},
            request_type=RequestType.CONTENT,
            model=model_used,
            prompt_tokens=int((usage or {}).get("prompt_tokens") or 0),
            completion_tokens=int((usage or {}).get("completion_tokens") or 0),
            institute_id=institute_id,
            user_id=actor_user_id,
            user_role=None,
            idempotency_key=f"{_EDIT_TOOL_KEY}:{run_id}",
            usage_markup=_USAGE_MARKUP,
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("[page-copilot] billing skipped: %s", e)

    return EditPageResponse(ops=ops, reply=reply, run_id=run_id, model=model_used, warnings=warnings)


# ─── Brand kit (theme proposals) ────────────────────────────────────────────

_BRAND_TOOL_KEY = "page_brand_kit"
_THEME_PRESETS = {"default", "ocean", "forest", "sunset", "midnight", "rose", "violet", "amber", "slate"}
_FONT_FAMILIES = {
    "Inter", "Roboto", "Open Sans", "Poppins", "Lato", "Montserrat", "Mulish", "Figtree",
    "Outfit", "Nunito", "Space Grotesk", "Playfair Display", "Fraunces", "Newsreader",
    "Lora", "DM Serif Display",
}
_ATMOSPHERES = {"flat", "soft", "mesh", "aurora"}
_INTENSITIES = {"subtle", "medium", "bold"}
_HEADING_SCALES = {"default", "editorial", "compact"}
_RADII = {"sharp", "rounded", "pill"}
_MOTIONS = {"none", "calm", "balanced", "dynamic"}


class BrandKitRequest(BaseModel):
    institute_name: Optional[str] = None
    brief: Optional[str] = None
    # A short description of the brand vibe or existing colors (from the admin
    # or a future scrape) — free text.
    brand_notes: Optional[str] = None
    preferred_model: Optional[str] = None


class BrandKit(BaseModel):
    label: str
    themePreset: str
    atmosphere: Dict[str, str]
    headingScale: str
    borderRadius: str
    motion: str
    fontFamily: str
    rationale: str


class BrandKitResponse(BaseModel):
    kits: List[BrandKit]
    run_id: str
    model: str


def _coerce_kit(raw: Any) -> Optional[BrandKit]:
    if not isinstance(raw, dict):
        return None
    preset = raw.get("themePreset") if raw.get("themePreset") in _THEME_PRESETS else "default"
    atm = raw.get("atmosphere") if isinstance(raw.get("atmosphere"), dict) else {}
    canvas = atm.get("canvas") if atm.get("canvas") in _ATMOSPHERES else "soft"
    intensity = atm.get("intensity") if atm.get("intensity") in _INTENSITIES else "subtle"
    return BrandKit(
        label=_clean_string(str(raw.get("label") or "Brand theme"))[:40],
        themePreset=preset,
        atmosphere={"canvas": canvas, "intensity": intensity},
        headingScale=raw.get("headingScale") if raw.get("headingScale") in _HEADING_SCALES else "default",
        borderRadius=raw.get("borderRadius") if raw.get("borderRadius") in _RADII else "rounded",
        motion=raw.get("motion") if raw.get("motion") in _MOTIONS else "calm",
        fontFamily=raw.get("fontFamily") if raw.get("fontFamily") in _FONT_FAMILIES else "Inter",
        rationale=_clean_string(str(raw.get("rationale") or ""))[:240],
    )


@router.post("/v1/brand-kit", response_model=BrandKitResponse)
async def derive_brand_kit(
    body: BrandKitRequest,
    db: Session = Depends(db_dependency),
    current_user=Depends(get_current_user),
) -> BrandKitResponse:
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    institute_id = getattr(current_user, "institute_id", None)
    if not institute_id:
        raise HTTPException(status_code=400, detail="No institute context on this session.")
    actor_user_id = getattr(current_user, "user_id", None)

    estimate = preflight_tool_credits(db, tool_key=_BRAND_TOOL_KEY, tool_params={}, institute_id=institute_id)
    if estimate.get("sufficient") is False:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                f"Insufficient credits: this needs ~{estimate['estimated_credits']} "
                f"credits but the balance is {estimate.get('current_balance')}."
            ),
        )

    prompt = (
        "You are a brand designer for education websites. Propose EXACTLY 3 distinct, tasteful theme "
        "options for the institute below, choosing ONLY from these allowed values:\n"
        f"- themePreset: {sorted(_THEME_PRESETS)}\n"
        f"- atmosphere.canvas: {sorted(_ATMOSPHERES)}; atmosphere.intensity: {sorted(_INTENSITIES)}\n"
        f"- headingScale: {sorted(_HEADING_SCALES)}; borderRadius: {sorted(_RADII)}; motion: {sorted(_MOTIONS)}\n"
        f"- fontFamily: {sorted(_FONT_FAMILIES)}\n"
        "Make the three genuinely different (e.g. one editorial-serif, one bold-modern, one calm-minimal). "
        "Pick presets/colors that suit the institute's subject and audience.\n\n"
        f"Institute: {body.institute_name or 'an education institute'}\n"
        f"Context: {(body.brief or '')[:600]}\n"
        f"Brand notes: {(body.brand_notes or 'none')[:300]}\n\n"
        'Return ONLY JSON: {"kits": [{"label": "...", "themePreset": "...", '
        '"atmosphere": {"canvas": "...", "intensity": "..."}, "headingScale": "...", '
        '"borderRadius": "...", "motion": "...", "fontFamily": "...", "rationale": "one sentence"}]}'
    )
    run_id = uuid.uuid4().hex
    primary, fallbacks = resolve_models(
        db, "page_builder", preferred_model=body.preferred_model, hard_fallback=_DEFAULT_MODEL
    )
    try:
        raw_json, model_used, usage = await generate_json(prompt, [primary, *fallbacks], label="brand-kit")
    except Exception as e:  # noqa: BLE001
        logger.warning("[brand-kit] failed: %s", e)
        raise HTTPException(status_code=502, detail=f"Brand kit generation failed: {e}")

    try:
        data = json.loads(raw_json)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"Model returned invalid JSON: {e}")
    kits = [k for k in (_coerce_kit(x) for x in (data.get("kits") or [])) if k is not None][:3]
    if not kits:
        raise HTTPException(status_code=502, detail="No usable brand kits — please retry.")

    try:
        record_tool_billing(
            tool_key=_BRAND_TOOL_KEY,
            tool_params={},
            request_type=RequestType.CONTENT,
            model=model_used,
            prompt_tokens=int((usage or {}).get("prompt_tokens") or 0),
            completion_tokens=int((usage or {}).get("completion_tokens") or 0),
            institute_id=institute_id,
            user_id=actor_user_id,
            user_role=None,
            idempotency_key=f"{_BRAND_TOOL_KEY}:{run_id}",
            usage_markup=_USAGE_MARKUP,
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("[brand-kit] billing skipped: %s", e)

    return BrandKitResponse(kits=kits, run_id=run_id, model=model_used)
