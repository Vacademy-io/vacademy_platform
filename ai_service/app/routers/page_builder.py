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

    def clean_string(value: str) -> str:
        return _sanitize_html(_strip_hostile(value))

    def clean_urls(node: Any) -> Any:
        if isinstance(node, dict):
            out = {}
            for k, v in node.items():
                lk = k.lower()
                # Image keys: pure allowlist-keep — empty, or exactly a
                # provided URL; everything else (data:, //host, HTTP,
                # hallucinated links) is stripped.
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
                    out[k] = clean_urls(kept)
                # mediaShowcase media[]: image items must use provided URLs;
                # video items (YouTube/Vimeo links) pass through untouched.
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
                        cleaned_items.append(clean_urls(item))
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
                        kept_layers.append(clean_urls(layer))
                    out[k] = kept_layers
                else:
                    out[k] = clean_urls(v)
            return out
        if isinstance(node, list):
            return [clean_urls(v) for v in node]
        if isinstance(node, str):
            # Every string: kill hostile schemes (javascript:/data:/vbscript:)
            # and sanitize any embedded markup (rich-text props end up in
            # dangerouslySetInnerHTML on the rendered page).
            return clean_string(node)
        return node

    seen_ids: set = set()

    def sanitize_component(comp: Any) -> Optional[Dict[str, Any]]:
        if not isinstance(comp, dict):
            return None
        ctype = comp.get("type")
        if ctype == "htmlBlock":
            warnings.append("Dropped forbidden htmlBlock component")
            return None
        if ctype in ("header", "footer") and not req.allow_chrome:
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
        cleaned_props = clean_urls(props)
        # columnLayout nests component arrays in props.slots — recurse so the
        # type filter / htmlBlock ban can't be smuggled past via slots.
        slots = cleaned_props.get("slots")
        if isinstance(slots, list):
            cleaned_props["slots"] = [
                [c for c in (sanitize_component(ch) for ch in slot) if c is not None]
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
            cleaned["style"] = clean_urls(comp["style"])
        return cleaned

    components: List[Dict[str, Any]] = []
    for comp in page["components"]:
        cleaned = sanitize_component(comp)
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
