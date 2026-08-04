"""
AI Page Builder — composes catalogue pages as schema-bound JSON.

The admin page-builder's pages are pure JSON (typed components + a token-driven
style engine), so the composer never writes HTML/CSS: it emits a Page object
against the checked-in schema catalog (app/data/catalogue_schema_catalog.json,
regenerated from the editor's component templates via
scripts/export-catalogue-schema-catalog.mjs). Output is validated/sanitized
server-side — unknown component types are dropped and image URLs are
whitelisted to the assets the admin actually provided. htmlBlock is a governed
ESCAPE HATCH for bespoke sections: its html/css pass through a strict nh3
profile + CSS scrub here, and the renderers re-sanitize (DOMPurify) and render
it inside a contained shadow root (see catalogue-html.ts in both frontends).

Phase A scope: one page per run (wizard). Copilot ops come in Phase B.
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import re
import uuid
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx

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


# ─── Custom-HTML sections (htmlBlock escape hatch) ──────────────────────────
# Contract mirrored by catalogue-html.ts in both frontends (defense in depth):
# structural/text tags only, class-based styling via a separate scrubbed CSS
# blob, images only from vetted URLs, no scripts/iframes/svg/forms/media.

_CUSTOM_HTML_TAGS = {
    "a", "article", "aside", "b", "blockquote", "br", "button", "caption",
    "cite", "code", "dd", "div", "dl", "dt", "em", "figcaption", "figure",
    "footer", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "i", "img",
    "li", "mark", "nav", "ol", "p", "pre", "s", "section", "small", "span",
    "strong", "sub", "sup", "table", "tbody", "td", "tfoot", "th", "thead",
    "time", "tr", "u", "ul",
}
_CUSTOM_HTML_ATTRS = {
    "*": {"class", "id", "style", "title", "role", "aria-label", "aria-hidden"},
    # NOTE: no "rel" here — nh3 REJECTS an explicit rel allowance when
    # link_rel is set (it manages rel itself); allowing it raises ValueError,
    # which the fallback would turn into "every htmlBlock dropped".
    "a": {"href", "target"},
    "img": {"src", "alt", "width", "height", "loading"},
    "time": {"datetime"},
    "th": {"colspan", "rowspan", "scope"},
    "td": {"colspan", "rowspan"},
}
_MAX_CUSTOM_HTML = 30000
_MAX_CUSTOM_CSS = 20000
_MAX_HTML_BLOCKS_PER_PAGE = 3

_CSS_COMMENT_RE = re.compile(r"/\*.*?\*/", re.S)
_CSS_URL_RE = re.compile(r"url\s*\([^)]*\)", re.I)
_CSS_BANNED_RE = re.compile(r"@import\b|expression\s*\(|behavior\s*:|-moz-binding|javascript\s*:", re.I)
_IMG_SRC_RE = re.compile(r'(<img\b[^>]*?\bsrc=")([^"]*)(")', re.I)


def _scrub_css(css: str, warnings: List[str]) -> str:
    """Scrub a custom-CSS blob: no imports, no url() (assets belong in vetted
    <img> tags), no legacy script vectors, and no '</' so the blob can't break
    out of the <style> tag the renderers inject it into."""
    if len(css) > _MAX_CUSTOM_CSS:
        warnings.append("Custom CSS truncated to size cap")
        css = css[:_MAX_CUSTOM_CSS]
    css = _CSS_COMMENT_RE.sub("", css)
    if _CSS_URL_RE.search(css):
        warnings.append("Removed url() from custom CSS")
        css = _CSS_URL_RE.sub("none", css)
    css = _CSS_BANNED_RE.sub("", css)
    return css.replace("</", " ")


def _sanitize_custom_html(html: str, allowed_urls: set, warnings: List[str]) -> str:
    """nh3-clean an htmlBlock's markup with the custom-HTML profile, then
    enforce the image allowlist and scrub style attributes (same banned
    constructs as the CSS blob — inline styles pass through nh3 untouched)."""
    if len(html) > _MAX_CUSTOM_HTML:
        warnings.append("Custom HTML truncated to size cap")
        html = html[:_MAX_CUSTOM_HTML]
    try:
        import nh3
        cleaned = nh3.clean(
            html,
            tags=_CUSTOM_HTML_TAGS,
            attributes=_CUSTOM_HTML_ATTRS,
            url_schemes={"https", "mailto", "tel"},
            link_rel="noopener noreferrer",
        )
    except Exception:  # noqa: BLE001 — sanitizer unavailable: refuse the block
        warnings.append("HTML sanitizer unavailable — custom HTML dropped")
        return ""

    def _check_src(m: "re.Match[str]") -> str:
        url = m.group(2)
        if url and url not in allowed_urls:
            warnings.append("Stripped unknown image URL from custom HTML")
            return f'{m.group(1)}{m.group(3)}'
        return m.group(0)

    cleaned = _IMG_SRC_RE.sub(_check_src, cleaned)
    # Neutralize banned CSS constructs that may sit inside style="" attributes.
    return _CSS_BANNED_RE.sub("", _CSS_URL_RE.sub("none", cleaned))


def _load_catalog() -> Dict[str, Any]:
    with open(_CATALOG_PATH, "r", encoding="utf-8") as fh:
        return json.load(fh)


# ─── Image generation (logos / hero art / illustrations) ────────────────────

_IMAGE_MODEL = os.getenv("PAGE_IMAGE_MODEL") or "google/gemini-3.1-flash-image"
_IMAGE_API_URL = "https://openrouter.ai/api/v1/chat/completions"
_IMAGE_ASPECTS = {"16:9", "4:3", "1:1", "3:4", "9:16", "3:2", "2:3"}
_MAX_AUTO_IMAGES = 5  # cap auto-generated images per page (cost/latency bound)
# Value sentinel the composer uses in an image field to request generation.
_GEN_PREFIX = "gen:"


async def _openrouter_image(prompt: str, aspect: str) -> Optional[bytes]:
    """One image via OpenRouter (same call the course/doc image path uses).
    Returns raw PNG bytes or None."""
    from ..config import get_settings
    key = getattr(get_settings(), "openrouter_api_key", None)
    if not key:
        logger.warning("[page-image] no OpenRouter key")
        return None
    async with httpx.AsyncClient(timeout=90.0) as client:
        resp = await client.post(
            _IMAGE_API_URL,
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={
                "model": _IMAGE_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "modalities": ["image"],
                "image_config": {"aspect_ratio": aspect if aspect in _IMAGE_ASPECTS else "16:9"},
            },
        )
    if resp.status_code != 200:
        logger.error("[page-image] OpenRouter %s: %s", resp.status_code, resp.text[:200])
        return None
    for choice in resp.json().get("choices") or []:
        for image in (choice.get("message") or {}).get("images", []) or []:
            url = (image.get("image_url") or {}).get("url", "")
            if url:
                b64 = url.split(",", 1)[1] if "," in url else url
                try:
                    return base64.b64decode(b64)
                except Exception:  # noqa: BLE001
                    return None
    return None


def _upload_image(data: bytes, kind: str) -> Optional[str]:
    from ..services.s3_service import S3Service
    try:
        s3 = S3Service()
        key = f"page-builder/{kind}-{uuid.uuid4().hex}.png"
        return s3.upload_file_content(data, f"{kind}.png", s3_key=key, content_type="image/png")
    except Exception as e:  # noqa: BLE001
        logger.warning("[page-image] upload failed: %s", e)
        return None


def _bill_image(db, institute_id: Optional[str], user_id: Optional[str]) -> None:
    if not institute_id:
        return
    try:
        from ..services.token_usage_service import TokenUsageService
        from ..models.ai_token_usage import ApiProvider
        TokenUsageService(db).record_usage_and_deduct_credits(
            api_provider=ApiProvider.OPENAI,  # via OpenRouter
            prompt_tokens=0, completion_tokens=0, total_tokens=0,
            request_type=RequestType.IMAGE,
            institute_id=institute_id, user_id=user_id,
            model=_IMAGE_MODEL, metadata={"feature": "page_builder_image"},
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("[page-image] billing skipped: %s", e)


async def _generate_and_upload_image(
    prompt: str, aspect: str, kind: str, db, institute_id: Optional[str], user_id: Optional[str]
) -> Optional[str]:
    """Generate → upload → bill one image. Returns the public URL or None."""
    data = await _openrouter_image(prompt, aspect)
    if not data:
        return None
    url = _upload_image(data, kind)
    if url:
        _bill_image(db, institute_id, user_id)
    return url


# Scalar image keys the composer may fill with a "gen:<prompt>" sentinel.
_GEN_KEYS = {"image", "src", "logo", "avatar", "photo", "backgroundimage", "posterimage", "thumbnail"}
_GEN_ASPECT = {"logo": "1:1", "avatar": "1:1", "photo": "4:3", "backgroundimage": "16:9", "thumbnail": "4:3"}


async def _autogen_images(page: Any, db, institute_id: Optional[str], user_id: Optional[str]) -> set:
    """Walk the page for image fields set to 'gen:<prompt>', generate each
    (concurrently, capped), upload, and replace the value with the real URL
    (or '' on failure). Returns the set of generated URLs to allowlist."""
    refs: List[tuple] = []  # (container_dict, key, prompt, aspect, kind)

    def collect(node: Any) -> None:
        if isinstance(node, dict):
            for k, v in node.items():
                lk = k.lower()
                if lk in _GEN_KEYS and isinstance(v, str) and v.startswith(_GEN_PREFIX):
                    prompt = v[len(_GEN_PREFIX):].strip()
                    if prompt:
                        refs.append((node, k, prompt, _GEN_ASPECT.get(lk, "16:9"), lk))
                else:
                    collect(v)
        elif isinstance(node, list):
            for item in node:
                collect(item)

    collect(page)
    if not refs:
        return set()
    refs = refs[:_MAX_AUTO_IMAGES]
    generated: set = set()

    async def one(container: Dict[str, Any], key: str, prompt: str, aspect: str, kind: str) -> None:
        url = await _generate_and_upload_image(prompt, aspect, kind, db, institute_id, user_id)
        container[key] = url or ""
        if url:
            generated.add(url)

    await asyncio.gather(*[one(*r) for r in refs], return_exceptions=True)
    return generated


def _is_public_http_host(target: str) -> bool:
    """SSRF guard shared by site-import and image-inlining: only public
    http(s) hosts — blocks localhost / .local / private / link-local ranges."""
    try:
        import ipaddress
        import socket
        from urllib.parse import urlparse
        if not target.startswith(("http://", "https://")):
            return False
        host = (urlparse(target).hostname or "").lower()
        if not host or host == "localhost" or host.endswith(".local") or host.endswith(".internal"):
            return False
        for info in socket.getaddrinfo(host, None):
            ip = ipaddress.ip_address(info[4][0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
                return False
        return True
    except Exception:  # noqa: BLE001 — guard failure = treat as non-public
        return False


_MAX_INLINE_IMAGE_BYTES = 6_000_000


async def _inline_image_data_url(url: str) -> tuple[Optional[str], Optional[str]]:
    """Fetch an admin-uploaded image OURSELVES and inline it as a data: URL,
    so the LLM provider never has to fetch it — media-service links can be
    presigned/short-lived or served with non-image content types, which
    providers reject. SSRF-guarded. Returns (data_url, None) on success or
    (None, reason) on failure."""
    if not isinstance(url, str) or not _is_public_http_host(url):
        return None, "blocked non-public host"
    try:
        async with httpx.AsyncClient(timeout=12.0, follow_redirects=False) as client:
            resp = await client.get(url)
        if resp.status_code != 200:
            return None, f"http {resp.status_code}"
        if not resp.content or len(resp.content) > _MAX_INLINE_IMAGE_BYTES:
            return None, f"bad size {len(resp.content)}"
        ctype = (resp.headers.get("content-type") or "").split(";")[0].strip().lower()
        if not ctype.startswith("image/"):
            head = resp.content[:12]
            if head.startswith(b"\x89PNG"):
                ctype = "image/png"
            elif head.startswith(b"\xff\xd8"):
                ctype = "image/jpeg"
            elif head[:6] in (b"GIF87a", b"GIF89a"):
                ctype = "image/gif"
            elif head[:4] == b"RIFF" and resp.content[8:12] == b"WEBP":
                ctype = "image/webp"
            else:
                return None, f"not an image ({ctype or 'no content-type'})"
        return f"data:{ctype};base64,{base64.b64encode(resp.content).decode()}", None
    except Exception as e:  # noqa: BLE001
        logger.warning("[page-builder] image inline failed for %s: %s", url[:120], e)
        return None, f"fetch error: {type(e).__name__}"


async def _import_site(url: str) -> str:
    """Best-effort fetch of the institute's own site → a compact text corpus
    (title, headings, paragraphs) so the rebuilt page keeps their REAL copy.
    Returns '' on any failure — never blocks generation."""
    if not url or not url.strip():
        return ""
    target = url.strip()
    if not target.startswith(("http://", "https://")):
        target = "https://" + target
    # SSRF guard: only public http(s) hosts — block localhost / link-local /
    # private ranges / non-http schemes so this can't probe internal services.
    try:
        import ipaddress
        import socket
        from urllib.parse import urlparse
        host = (urlparse(target).hostname or "").lower()
        if not host or host in ("localhost",) or host.endswith(".local") or host.endswith(".internal"):
            return ""
        try:
            for info in socket.getaddrinfo(host, None):
                ip = ipaddress.ip_address(info[4][0])
                if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
                    logger.warning("[page-builder] site import blocked non-public host: %s", host)
                    return ""
        except socket.gaierror:
            return ""
    except Exception:  # noqa: BLE001 — never let the guard itself break generation
        return ""
    try:
        # No redirect-following: a public URL could 30x to an internal one,
        # sidestepping the DNS check above.
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=False) as client:
            resp = await client.get(target, headers={"User-Agent": "Mozilla/5.0 (compatible; VacademyBot/1.0)"})
        if resp.status_code != 200 or "text/html" not in resp.headers.get("content-type", ""):
            return ""
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(resp.text[:800_000], "html.parser")
        for tag in soup(["script", "style", "noscript", "svg", "iframe"]):
            tag.decompose()
        parts: List[str] = []
        title = (soup.title.string if soup.title else "") or ""
        if title.strip():
            parts.append(f"TITLE: {title.strip()[:200]}")
        for el in soup.find_all(["h1", "h2", "h3", "li", "p"]):
            txt = " ".join(el.get_text(" ", strip=True).split())
            if 3 <= len(txt) <= 400:
                tag = el.name.upper()
                parts.append(f"{tag}: {txt}" if tag.startswith("H") else txt)
            if len(parts) >= 120:
                break
        corpus = "\n".join(parts)
        return corpus[:6000]
    except Exception as e:  # noqa: BLE001
        logger.warning("[page-builder] site import failed: %s", e)
        return ""


async def _describe_attachments(
    image_urls: List[str], db, institute_id: Optional[str], user_id: Optional[str]
) -> str:
    """Vision pass over images the admin attached to a COPILOT instruction.

    The copilot's prompt previously listed attachments as bare URLs, so the
    model literally could not see them and answered "I couldn't see an actual
    section attached" when an admin pasted a screenshot of a section they
    wanted built (real field report). Images are inlined as data URLs because
    provider-side fetching of our media URLs is unreliable.

    Unlike _analyze_inspiration (mood only, never content), this transcribes
    UI screenshots — the admin is asking us to REBUILD what they attached, so
    the structure and copy are the point. Best-effort: returns '' on failure.
    """
    from ..services.chat_llm_client import ChatLLMClient
    from ..services.api_key_resolver import ApiKeyResolver

    urls = [u for u in image_urls if isinstance(u, str) and u.startswith("https://")][:3]
    if not urls:
        return ""
    inlined = await asyncio.gather(*(_inline_image_data_url(u) for u in urls))
    attachments = [{"type": "image", "url": d} for d, _ in inlined if d]
    if not attachments:
        # Fall back to the raw URLs — the provider may still fetch them.
        attachments = [{"type": "image", "url": u} for u in urls]

    client = ChatLLMClient(ApiKeyResolver(db))
    messages = [{
        "role": "user",
        "content": (
            "An education-institute admin attached these image(s) to a request to edit their "
            "website. For EACH image, first classify it as either A) a SCREENSHOT/MOCKUP of a web "
            "section or page, or B) a PHOTO / logo / graphic meant to be placed on the page.\n"
            "If A: describe the section precisely enough to rebuild it — layout (columns, order), "
            "every piece of visible TEXT verbatim (headings, subheadings, body, badges/chips, "
            "button labels, stats and their labels), and the visual treatment (card style, dark or "
            "light band, icon usage, alignment).\n"
            "If B: one line on what it depicts and where it would fit.\n"
            "Be concise but complete. No preamble."
        ),
        "attachments": attachments,
    }]
    try:
        resp = await client.chat_completion(
            messages, temperature=0.2, max_tokens=1400, institute_id=institute_id, user_id=user_id
        )
        return _clean_string((resp.get("content") or "").strip())
    except Exception as e:  # noqa: BLE001 — never block the edit on the vision pass
        logger.warning("[page-copilot] attachment vision pass failed: %s", e)
        return ""


async def _analyze_inspiration(image_urls: List[str], db, institute_id: Optional[str], user_id: Optional[str]) -> str:
    """Vision pass over inspiration screenshots → a short DESIGN brief (mood,
    palette direction, serif-vs-sans display, layout patterns). Structure/mood
    only — never content. Best-effort; returns '' on any failure."""
    from ..services.chat_llm_client import ChatLLMClient
    from ..services.api_key_resolver import ApiKeyResolver

    client = ChatLLMClient(ApiKeyResolver(db))
    messages = [{
        "role": "user",
        "content": (
            "These are screenshots of websites an education institute admires. Give a concise DESIGN "
            "BRIEF (NOT their content) to guide building a NEW page: overall mood (editorial / premium / "
            "playful / techy / minimal), color-palette direction, whether the display type reads serif or "
            "sans, and layout patterns (hero style, use of stat cards, marquee tickers, feature cards, "
            "testimonials). 4–6 short bullet points. Do NOT transcribe or suggest copying their text, "
            "logos, or images."
        ),
        "attachments": [{"type": "image", "url": u} for u in image_urls[:3]],
    }]
    resp = await client.chat_completion(
        messages, temperature=0.2, max_tokens=400, institute_id=institute_id, user_id=user_id
    )
    return _clean_string((resp.get("content") or "").strip())


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
    # Screenshots of sites the admin likes — analysed for LAYOUT/MOOD only
    # (never content), producing a design brief that steers the composer.
    inspiration_image_urls: List[str] = Field(default_factory=list)
    # The institute's OWN existing website — we extract its real copy so the
    # rebuilt page keeps their actual content ("rebuild my site").
    source_url: Optional[str] = None
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
    # Auto-generate a hero image + a few section visuals during composition.
    auto_images: bool = True


class GeneratePageResponse(BaseModel):
    page: Dict[str, Any]
    # A matching site theme (globalSettings) the composer chose for this page —
    # the wizard applies it so the page renders premium, not on the plain
    # default. None when the model omitted it.
    global_settings: Optional[Dict[str, Any]] = None
    run_id: str
    model: str
    warnings: List[str] = Field(default_factory=list)


# Font LABEL → CSS stack (globalSettings.fonts.family is stored as a stack).
_FONT_STACKS: Dict[str, str] = {
    "Inter": "Inter, sans-serif",
    "Roboto": "Roboto, sans-serif",
    "Open Sans": '"Open Sans", sans-serif',
    "Poppins": "Poppins, sans-serif",
    "Lato": "Lato, sans-serif",
    "Montserrat": "Montserrat, sans-serif",
    "Mulish": "Mulish, sans-serif",
    "Figtree": "Figtree, sans-serif",
    "Outfit": "Outfit, sans-serif",
    "Nunito": "Nunito, sans-serif",
    "Space Grotesk": '"Space Grotesk", sans-serif',
    "Playfair Display": '"Playfair Display", serif',
    "Fraunces": "Fraunces, serif",
    "Newsreader": "Newsreader, serif",
    "Lora": "Lora, serif",
    "DM Serif Display": '"DM Serif Display", serif',
}

# One compact, VALID exemplar page showing the premium vocabulary in-schema —
# few-shot so the model produces designed pages (eyebrow badges, stat chips,
# highlighted headings, glass cards, ornaments, marquee, atmosphere theme)
# instead of plain stacked sections on the default theme.
_PREMIUM_EXEMPLAR = json.dumps({
    "globalSettings": {
        "theme": {"preset": "forest", "atmosphere": {"canvas": "mesh", "intensity": "medium"}, "headingScale": "editorial", "borderRadius": "rounded"},
        "fonts": {"enabled": True, "family": "Inter, sans-serif", "headingFamily": "Playfair Display, serif"},
        "motion": {"personality": "calm"},
    },
    "page": {
        "title": "GATE & ISRO Coaching",
        "route": "home",
        "components": [
            {
                "id": "hero", "type": "heroSection", "enabled": True,
                "props": {
                    "layout": "split",
                    "eyebrow": {"text": "Trivandrum's premier engineering institute", "style": "badge"},
                    "left": {
                        "title": "Train for GATE, ISRO, PSC — and land your career",
                        "description": "<p>IIT & NIT alumni-led coaching across every engineering branch — from GATE and ISRO to Kerala PSC and campus placements.</p>",
                        "buttons": [
                            {"text": "Explore all programs", "action": "navigate", "target": "#courses", "variant": "primary"},
                            {"text": "View branches", "action": "navigate", "target": "#branches", "variant": "secondary"},
                        ],
                    },
                    "right": {"image": "gen:A warm, bright photograph of focused engineering students collaborating over laptops and circuit boards at a modern lab bench, natural window light, shallow depth of field"},
                    "statChips": [
                        {"value": "30K+", "label": "Students trained"},
                        {"value": "5K+", "label": "Placements / year"},
                        {"value": "85%", "label": "Selection rate"},
                    ],
                },
                "style": {"layout": {"width": "wide"}, "minHeight": "80vh", "contentAlign": "center"},
            },
            {
                "id": "ticker", "type": "logoCloud", "enabled": True,
                "props": {"layout": "marquee", "display": "label-pill", "marqueeSpeed": "slow", "logos": [
                    {"label": "GATE 2025 batches open"}, {"label": "ISRO / BARC post-GATE"}, {"label": "Kerala PSC technical coaching"},
                ]},
            },
            {
                "id": "why", "type": "sectionHeading", "enabled": True,
                "props": {"eyebrow": "Why choose us", "title": "Coaching that actually converts", "highlight": {"text": "converts", "style": "gradient"}, "lead": "Outcome-first programs built around real exam patterns.", "align": "center", "size": "lg"},
            },
            {
                "id": "features", "type": "featureGrid", "enabled": True,
                "props": {"columns": 3, "style": "glass", "align": "left", "features": [
                    {"iconName": "Trophy", "title": "Proven results", "description": "Consistent top ranks across GATE and PSC.", "chips": ["30K+ trained"]},
                    {"iconName": "UsersThree", "title": "Alumni mentors", "description": "Taught by IIT/NIT alumni who cleared these exams."},
                    {"iconName": "Target", "title": "Exam-pattern drills", "description": "Weekly mocks tuned to the latest paper pattern."},
                ]},
                "style": {"ornaments": [{"preset": "glow-orb", "x": "72%", "y": "-10%", "size": "420px", "opacity": 0.22, "blur": 40}]},
            },
            {"id": "courses", "type": "courseCatalog", "enabled": True, "props": {"title": "Explore our programs"}},
            {
                "id": "cta", "type": "ctaBanner", "enabled": True,
                # Must match CtaBannerRenderer's actual contract ({heading, subheading, button}).
                # It previously taught {headerText, description, buttonText, buttonAction}, none of
                # which the renderer reads — a model that copied the exemplar faithfully produced an
                # empty coloured band.
                "props": {"heading": "Ready to start?", "subheading": "Book a free demo class this week.",
                          "layout": "centered",
                          "button": {"enabled": True, "text": "Book a free demo", "action": "navigate",
                                     "target": "contact", "style": "white"}},
                "style": {"layout": {"width": "full"}, "backgroundLayers": [{"type": "linear", "from": "hsl(var(--primary-500))", "to": "hsl(var(--primary-400))", "angle": 120}]},
            },
        ],
    },
}, ensure_ascii=False)


# ─── Prompt ──────────────────────────────────────────────────────────────────

_PREMIUM_DOCTRINE = [
    "Design like a senior product designer for a premium education brand — NOT a generic template. "
    "Compare your output to award-winning cohort/coaching landing pages: confident, editorial, spacious.",
    "ALWAYS return globalSettings that suit the brand: pick a theme preset (not 'default' unless the brand is truly neutral), "
    "an atmosphere (soft/mesh/aurora give the page depth — flat looks cheap), an editorial headingScale for premium/story brands, "
    "and a FONT PAIRING. For an editorial/premium feel, set fonts.headingFamily to a SERIF display face (Playfair Display / "
    "Fraunces / DM Serif Display) and keep fonts.family a clean SANS body (Inter / Mulish / Outfit) — serif headlines over sans "
    "paragraphs is the single biggest 'premium' signal. For a modern/techy brand use Space Grotesk/Outfit headings on an Inter body. "
    "Motion: calm or balanced.",
    "On a LANDING page, OPEN with a rich heroSection: an eyebrow BADGE, a bold specific headline, 2 CTA buttons (primary+secondary), and 3 statChips "
    "for proof numbers. Put it on a section shell (style.layout.width 'wide') with minHeight '80vh' + contentAlign 'center' so it fills the fold. "
    "On a DIRECTORY/reference page the fold belongs to the CONTENT, not to a hero — see the ARCHETYPE section, which overrides this.",
    "Use a sectionHeading with a highlight (style 'gradient' or 'underline') on ONE key phrase before each dense section — this accent is what makes pages feel designed.",
    "For a DIVISIONS / two-pillars / plan-comparison / 'what you get' section, use featureGrid with style 'panel' (columns 2 or 3): each feature is a card with a "
    "tinted HEADER band (props: badge, iconName, title, description) over a body of `bullets`. Make ONE pillar stand out by setting its headerVariant 'solid' "
    "(brand-colored header, white text) while the others stay headerVariant 'tint' — this is the single most 'designed' section pattern. Do NOT use plain 'cards' "
    "for divisions/comparisons.",
    "Prefer rich components over plain ones: featureGrid with style 'glass'/'gradient-border'/'tinted' and chips, stepsProcess ALWAYS with variant 'timeline-cards' or "
    "'alternating' plus nodeStyle 'icon' (plain numbered steps look dated), logoCloud in 'marquee' layout as a ticker of announcements, testimonialSection with ratings, "
    "trustChip. NEVER use the plain 'banner' component for a hero.",
    "Feature/accordion icons: ALWAYS set iconName from the icon library (GraduationCap, Rocket, Target, UsersThree, Code, Brain, Trophy, Lightbulb, ShieldCheck, "
    "ChartLineUp, Clock, Star, BookOpen, Certificate, ChatsCircle, Wrench, Sparkle, Medal, Briefcase, Globe) — never rely on the emoji 'icon' field; emojis read cheap.",
    "Theme preset: commit to a COLOR that fits the brand's subject (ocean/midnight = tech & engineering, forest = growth & science, sunset/amber = energetic, "
    "rose/violet = creative, slate = corporate). Use 'default' ONLY when the institute's own brand color should shine through unchanged.",
    "Add tasteful depth: an ornaments glow-orb behind a feature section, a subtle backgroundLayers gradient on the CTA, atmosphere on the hero. Keep it restrained — one accent per section.",
    "Rhythm: AT MOST ONE hero; alternate section surface tints; end with a CTA (and contact if a contact page). "
    "Section count and whether a live courseCatalog belongs at all are decided by the ARCHETYPE and COMMERCE sections below — "
    "never add courseCatalog, cartComponent or any price/enrol element to a page whose brief says it is informational.",
    "Copy: concise, benefit-led, specific to THIS institute (use real course names + the provided stats/claims). Never lorem ipsum, never generic filler. Mirror the brief's language.",
    "htmlBlock — when a design genuinely cannot be expressed with the typed components (a bespoke bento grid, an unusual editorial "
    "layout, decorative hero art, or a DENSE INFORMATION TABLE such as a hairline-bordered spec grid or a label:value detail strip), "
    "use htmlBlock: props {html, css, prompt}. It is NOT a last resort for information-heavy reference pages — for those it is often the "
    "RIGHT choice, because the typed components are built for marketing sections and cannot render a bordered no-gap data table. "
    "ONE htmlBlock may contain MANY repeated blocks (e.g. every offering on a directory page), so prefer one well-built htmlBlock over "
    "several. Budget: AT MOST THREE htmlBlock components per page. Hard rules: (1) style ONLY via the css "
    "prop with class selectors — never <style> tags in the html; (2) ALL colors and fonts MUST come from the site theme variables — var(--primary-500), "
    "var(--primary-400), var(--primary-50), var(--catalogue-text-primary), var(--catalogue-text-secondary), var(--catalogue-bg), var(--catalogue-border), "
    "font-family: var(--catalogue-heading-font, inherit) for display text — NEVER literal hex colors, so re-theming still works; (3) MUST be responsive: "
    "include @media (max-width: 640px) rules; (4) no scripts, iframes, svg, forms or external assets — <img> only with PROVIDED image URLs; animation via "
    "CSS only (the section renders in a sandbox that strips everything else); (5) set props.prompt to a one-line brief of the section's intent so it can be "
    "regenerated later; (6) include generous padding (the section renders full-bleed with no outer spacing of its own). Prefer typed components whenever they fit.",
]


# ── Page archetypes ────────────────────────────────────────────────────────────
# The doctrine above describes a persuasive LANDING page. Applied to a reference
# page it produces the wrong artefact: an Edzumo admin who asked for "details of
# programs, no enroll flow just data" got an 80vh hero, three generic feature
# grids that collapsed 25 offerings into 3 buckets, and a live enrol grid. The
# archetype block below is appended per page_type and OVERRIDES the landing-page
# rhythm rules, so structure follows the admin's actual intent.
_ARCHETYPE_RULES: Dict[str, str] = {
    "homepage": (
        "LANDING. Persuasive arc: hero → proof → what you get → how it works → social proof → CTA. "
        "The hero owns the fold. 6–12 sections."
    ),
    "courses": (
        "DIRECTORY / REFERENCE. This page's job is to DOCUMENT what the institute offers — densely, "
        "scannably, in the order given. Rules:\n"
        "  (1) NO tall hero. Open with a compact page header (a sectionHeading, or a heroSection with NO "
        "minHeight) so real content is visible in the fold.\n"
        "  (2) ONE self-contained block PER offering. Do NOT merge several offerings into one card and "
        "do NOT summarise the list into 2–4 generic buckets — an admin who lists 25 offerings expects to "
        "find all 25 on the page, each by its REAL name. If there are more than 12, group them under "
        "sectionHeadings by theme, but every offering still gets its own titled block.\n"
        "  (3) Each block carries: a short uppercase eyebrow/tag, the offering's real name as the "
        "heading, a 1–2 sentence description, 4–6 concrete detail items (what is covered/included), and "
        "a strip of 3–4 label:value specs (eligibility, mode, duration, level…). Give exactly ONE block "
        "a visually distinct accent treatment if one offering is the flagship.\n"
        "  (4) USE `detailBlocks` for this — it exists for exactly this page. ONE detailBlocks component "
        "whose `blocks` array holds one entry per offering (tag, title, description, items[], specs[], "
        "optional note, optional anchor). Do NOT reach for sectionHeading+featureGrid here: featureGrid "
        "renders gapped marketing cards and has no spec strip. htmlBlock stays available only if a layout "
        "genuinely needs something detailBlocks cannot express.\n"
        "  (5) Coverage beats verbosity: if space is tight, shorten each block rather than dropping "
        "offerings. Never invent a detail you were not given — omit a spec you do not know rather than "
        "guessing eligibility, duration, fees or outcomes for a real programme.\n"
        "  (6) Testimonial, logoCloud and marquee sections are NOISE here — omit them. End with ONE CTA."
    ),
    "course-landing": (
        "SINGLE-OFFERING SALES PAGE. One offering only: hero → outcomes → curriculum/what's included → "
        "proof → pricing/enrol → FAQ → CTA. Depth over breadth."
    ),
    "about": (
        "STORY. Narrative order: who we are → origin → what we believe → the people → proof/milestones "
        "→ a soft CTA. Prose-led; prefer readable measure over dense grids."
    ),
    "admissions": (
        "PROCESS. Lead with a stepsProcess of the actual admission steps, then eligibility and dates as "
        "label:value detail, then required documents, then FAQ, then the apply CTA."
    ),
    "contact": (
        "CONTACT. Address/phone/email and a contactForm high on the page, a mapEmbed, hours, and a short "
        "FAQ. No hero taller than the content."
    ),
}

# Phrases an admin uses when they want a reference page with no commerce on it.
_INFO_ONLY_MARKERS = (
    "no enroll", "no enrol", "no enrollment", "no enrolment", "without enroll", "without enrol",
    "no signup", "no sign up", "no sign-up", "no registration",
    "just data", "only data", "just info", "just information", "information only", "informational",
    "details only", "just details", "no price", "no prices", "no pricing", "no fee", "no fees",
    "no payment", "no checkout", "no cart", "no buy", "not for sale", "no selling",
)


def _is_info_only(brief: str) -> bool:
    """True when the admin explicitly asked for an informational page.

    Drives the COMMERCE directive: the doctrine used to tell the composer to
    always place a live courseCatalog, so "no enroll flow just data" still came
    back with an enrol grid.
    """
    lowered = (brief or "").lower()
    return any(marker in lowered for marker in _INFO_ONLY_MARKERS)


# Platform defaults for the Naming Settings labels the admin FE sends. An entry
# whose value still equals its default is NOT a rename — the admin simply never
# touched it — so it must produce no instruction at all. Edzumo's payload was
# {"course": "Question Set", "learner": "Student", "level": "Level",
#  "session": "Session", "batch": "Batch"}: only TWO real renames, yet the old
# "use these words in all copy" line made the model dutifully work the untouched
# words into prose too ("Multi-Session programs, Batch-wise schedule").
_TERM_DEFAULTS: Dict[str, str] = {
    "course": "Course", "level": "Level", "session": "Session",
    "subject": "Subject", "module": "Module", "chapter": "Chapter",
    "slide": "Slide", "livesession": "Live Session", "batch": "Batch",
    "package": "Package", "populartag": "Popular Tag", "learner": "Learner",
    "teacher": "Teacher", "admin": "Admin", "evaluator": "Evaluator",
    "coursecreator": "Course Creator", "assessmentcreator": "Assessment Creator",
    "invite": "Invite", "audiencelist": "Audience List", "inventory": "Inventory",
    "suborg": "Sub-Org",
}

_TERMINOLOGY_RULES = (
    "\nHOW TO APPLY IT — a substitution is correct ONLY where the text names that entity type as a "
    "generic noun. Everywhere else, write normal natural English.\n"
    "1. UI LABELS (nav items, section headings, button text, filter labels, table headers, tabs): use "
    "the value EXACTLY as written above, in its given Title Case.\n"
    "2. RUNNING PROSE (any sentence, paragraph or description): write the term in LOWER CASE — "
    "\"browse our question sets\", \"built for students and graduates\". NEVER paste a Title Case label "
    "mid-sentence: \"engineering Students & graduates\" is WRONG, \"engineering students & graduates\" is "
    "right. Keep the given capitalisation only for acronyms (MBA, IIT, GATE).\n"
    "3. PLURALS: use only a plural form listed above. If none is listed, do NOT invent one — this "
    "institute may spell its plural differently. Rewrite instead: singular attributively (\"Question Set "
    "details\"), or a determiner (\"every Question Set\").\n"
    "4. NEVER rename a PROPER NOUN. Real course / program / exam / company names are reproduced "
    "verbatim. \"Placement-focused Question Sets for MakeMyTrip\" is WRONG — MakeMyTrip is the NAME of a "
    "program, so write \"MakeMyTrip placement program\" in the brief's own words. A heading or card title "
    "carrying a real offering's name is never rewritten, re-bucketed or re-labelled.\n"
    "5. Entities NOT listed above were never renamed, so you have NO instruction about them. Do not "
    "force words like \"Session\", \"Batch\" or \"Level\" into copy where a person writing about this "
    "institute would not use them. \"Multi-Session programs, Batch-wise schedule\" is robot copy.\n"
    "6. THE ADMIN'S BRIEF WINS. Mirror the words the admin used for their own offerings. This glossary "
    "only fixes what the PLATFORM's entities are CALLED in labels. If applying a term would make a "
    "phrase read awkwardly, do not apply it."
)

_TERMINOLOGY_INTAKE_NOTE = (
    "\n7. IN THIS INTERVIEW: use these labels when talking to the admin, and restate them verbatim in "
    "one short 'vocabulary' line of the brief so the composer receives them — but write the rest of the "
    "brief in the ADMIN'S OWN words, never in glossary words."
)


def _terminology_block(raw: Optional[Dict[str, str]], intake: bool = False) -> Optional[str]:
    """Render only the institute's RENAMED entity labels as instructions, or None.

    The values are Title-Case UI labels, not a prose vocabulary. The old
    instruction ("use these words in all copy") produced "Browse All Question
    Sets", "Placement-focused Question Sets for MakeMyTrip" and "engineering
    Students & graduates". Entries still at the platform default are dropped so
    the model gets no licence to force untouched words into copy.
    """
    lines: List[str] = []
    for key, value in (raw or {}).items():
        k = str(key).strip()
        lk = k.lower()
        if not isinstance(value, str) or lk.endswith("plural"):
            continue
        singular = value.strip()
        if not singular:
            continue
        default = _TERM_DEFAULTS.get(lk)
        if default and singular.casefold() == default.casefold():
            continue  # not a rename → no instruction
        plural = ""
        for cand_key in (f"{k}Plural", f"{k}_plural", f"{lk}plural", f"{lk}_plural"):
            cand = (raw or {}).get(cand_key)
            if isinstance(cand, str) and cand.strip():
                plural = cand.strip()
                break
        noun = default or lk
        if plural:
            lines.append(f'- what the platform calls a {noun} is called "{singular}" here (plural: "{plural}")')
        else:
            lines.append(
                f'- what the platform calls a {noun} is called "{singular}" here '
                f'(NO plural form was configured — see rule 3, do not invent one)'
            )
    if not lines:
        return None
    block = (
        "## INSTITUTE VOCABULARY (a LABEL glossary — NOT a list of words to force into the copy)\n"
        "This institute has renamed some of the platform's built-in entity labels:\n"
        + "\n".join(lines)
        + "\n"
        + _TERMINOLOGY_RULES
    )
    return block + _TERMINOLOGY_INTAKE_NOTE if intake else block


# Appended when the admin asked for an informational page. The doctrine used to
# say "place a live courseCatalog where offerings belong" unconditionally.
_NO_COMMERCE_RULE = (
    "## COMMERCE: OFF FOR THIS PAGE\n"
    "The admin explicitly asked for an informational page. Do NOT emit courseCatalog, bookCatalogue, "
    "cartComponent, productPageOffer, pricingTable, buyRentSection or any price, fee, discount, "
    "'Enrol now'/'Buy'/'Add to cart' element. Describe the offerings as information only. A single "
    "soft CTA at the end (talk to us / book a counselling call / contact) is welcome — a purchase path "
    "is not."
)


def _build_prompt(req: GeneratePageRequest, catalog: Dict[str, Any], inspiration_brief: str = "", site_corpus: str = "", fixed_global: Optional[Dict[str, Any]] = None) -> str:
    parts: List[str] = []
    parts.append(
        "You are the page composer for Vacademy's catalogue website builder. You produce ONE page as "
        "pure JSON against the component vocabulary below. Typed components are the default for every "
        "section; the htmlBlock escape hatch (see DESIGN RULES) exists for the rare bespoke section the "
        "vocabulary cannot express. Study the PREMIUM EXEMPLAR: match that level of polish and richness."
    )
    vocab = catalog["components"]
    if not req.allow_chrome:
        # The site provides global header/footer — keep them out of the
        # vocabulary so prompt and sanitizer agree.
        vocab = [c for c in vocab if c.get("type") not in ("header", "footer")]
    parts.append("## COMPONENT VOCABULARY (types with example props)\n" + json.dumps(vocab, ensure_ascii=False))
    parts.append("## STYLE VOCABULARY\n" + json.dumps(catalog["styleSchema"], ensure_ascii=False))
    parts.append("## DESIGN RULES\n- " + "\n- ".join(_PREMIUM_DOCTRINE))
    parts.append(
        "## PREMIUM EXEMPLAR (a page at the quality bar you must hit — study its globalSettings, hero, "
        "highlighted heading, glass feature cards, marquee ticker and CTA; do NOT copy its content)\n"
        + _PREMIUM_EXEMPLAR
    )

    if req.institute_name:
        parts.append(f"## INSTITUTE\nName: {req.institute_name}")
    term_block = _terminology_block(req.terminology)
    if term_block:
        parts.append(term_block)
    if req.courses:
        parts.append(
            "## REAL COURSES (reference these by name; use courseCatalog for the live grid)\n"
            + json.dumps([c.model_dump(exclude_none=True) for c in req.courses], ensure_ascii=False)
        )
    if req.images:
        parts.append(
            "## PROVIDED IMAGES (real URLs you may use — place them where their caption fits)\n"
            + json.dumps([i.model_dump(exclude_none=True) for i in req.images], ensure_ascii=False)
        )
    if req.auto_images:
        parts.append(
            "## IMAGE GENERATION\nYou may request AI-generated images: set an image field to "
            '"gen:<a vivid, specific photography/illustration prompt>" and it will be generated and '
            "filled in for you. Use it for the HERO right.image and 1–3 key section visuals (feature/"
            "media images). Do NOT gen: logos of real brands or people. Keep total gen: fields ≤ 4. "
            "Leave an image field empty ('') rather than gen: when a real provided image fits or none is needed."
        )
    if site_corpus:
        parts.append(
            "## EXISTING SITE CONTENT (the institute's OWN current website — REBUILD it in our system: "
            "keep their real facts, program names, numbers and about-us copy; improve the writing and "
            "structure, do NOT invent different facts)\n" + site_corpus
        )
    if inspiration_brief:
        parts.append(
            "## INSPIRATION (the admin shared screenshots of sites they admire — a design DIRECTION for "
            "layout/mood/theme ONLY, never copy their text or images)\n" + inspiration_brief
        )
    if req.direction:
        parts.append(f"## DESIGN DIRECTION\n{req.direction}")

    if fixed_global:
        parts.append(
            "## FIXED SITE THEME (this multi-page site already has a theme — reuse EXACTLY this "
            "globalSettings for a consistent look; do NOT propose a different one)\n"
            + json.dumps(fixed_global, ensure_ascii=False)
        )

    page_type = req.page_type or "homepage"
    parts.append(
        f"## TASK\nPage type: {page_type} — {_PAGE_TYPE_LABELS.get(page_type, 'a page of this site')}\n"
        f"Admin brief (mirror its language in the page copy):\n{req.brief.strip()}"
    )
    # The archetype OVERRIDES the landing-page rhythm rules in DESIGN RULES. Without
    # it every page_type came out shaped like a homepage.
    archetype_rule = _ARCHETYPE_RULES.get(page_type)
    if archetype_rule:
        parts.append(f"## PAGE ARCHETYPE — this governs the page's STRUCTURE\n{archetype_rule}")
    if _is_info_only(req.brief):
        parts.append(_NO_COMMERCE_RULE)
    parts.append(
        "## OUTPUT CONTRACT\nReturn ONLY a JSON object of this exact shape (no markdown, no commentary):\n"
        '{"globalSettings": {"theme": {"preset": "...", "atmosphere": {"canvas": "...", "intensity": "..."}, '
        '"headingScale": "...", "borderRadius": "..."}, "fonts": {"enabled": true, "family": "<sans body font '
        'label>", "headingFamily": "<serif/display heading font label — omit to reuse the body font>"}, '
        '"motion": {"personality": "..."}}, '
        '"page": {"id": "<kebab-id>", "title": "<short page title>", "route": "<kebab-slug>", '
        '"components": [{"id": "<kebab-id>", "type": "<type>", "enabled": true, "props": {…}, "style": {…}?}, …]}}\n'
        "6–12 components. Do NOT include header or footer components — the site provides global ones. "
        "globalSettings is REQUIRED — a plain default theme makes the page look cheap."
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
    if ctype == "htmlBlock":
        # Escape hatch: html/css get the dedicated custom-HTML pipeline INSTEAD
        # of the generic string cleaner (whose default nh3 profile would strip
        # the class attributes the section's CSS targets). Only the contract
        # keys survive — anything else the model added is dropped.
        html = props.get("html")
        if not isinstance(html, str) or not html.strip():
            warnings.append("Dropped htmlBlock with empty html")
            return None
        cleaned_html = _sanitize_custom_html(html, allowed_urls, warnings)
        if not cleaned_html.strip():
            warnings.append("Dropped htmlBlock — nothing survived sanitization")
            return None
        html_props: Dict[str, Any] = {"html": cleaned_html}
        if isinstance(props.get("css"), str) and props["css"].strip():
            html_props["css"] = _scrub_css(props["css"], warnings)
        if isinstance(props.get("prompt"), str) and props["prompt"].strip():
            html_props["prompt"] = _clean_string(props["prompt"])[:500]
        cleaned_block: Dict[str, Any] = {"id": cid, "type": ctype, "enabled": True, "props": html_props}
        if isinstance(comp.get("style"), dict) and comp["style"]:
            cleaned_block["style"] = clean_urls(comp["style"], allowed_urls, warnings)
        return cleaned_block
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
    # Surface color belongs on the STYLE layer when a section shell is used:
    # props.backgroundColor only paints the inner content column, so a shell
    # section would render as an inset card with page-color gutters. Copy it
    # up so the full-bleed canvas owns the color (field bug, Edzumo hero).
    style = cleaned.get("style")
    if isinstance(style, dict) and isinstance(style.get("layout"), dict):
        prop_bg = cleaned_props.get("backgroundColor")
        if (
            isinstance(prop_bg, str) and prop_bg
            and not any(style.get(k) for k in ("backgroundColor", "background", "backgroundImage", "backgroundLayers"))
        ):
            style["backgroundColor"] = prop_bg
    return cleaned


def _coerce_global_settings(raw: Any) -> Optional[Dict[str, Any]]:
    """Clamp the model's globalSettings to valid values (the theme presets,
    atmospheres, fonts, etc. the renderers actually support). Font label OR a
    known stack maps to a stack; anything else falls back to Inter."""
    if not isinstance(raw, dict):
        return None
    theme_in = raw.get("theme") if isinstance(raw.get("theme"), dict) else {}
    atm_in = theme_in.get("atmosphere") if isinstance(theme_in.get("atmosphere"), dict) else {}
    fonts_in = raw.get("fonts") if isinstance(raw.get("fonts"), dict) else {}
    motion_in = raw.get("motion") if isinstance(raw.get("motion"), dict) else {}

    _known_stacks = set(_FONT_STACKS.values())
    fam = fonts_in.get("family")
    font_stack = _FONT_STACKS.get(fam) or (fam if fam in _known_stacks else "Inter, sans-serif")
    # Optional separate heading font (serif display over sans body).
    head = fonts_in.get("headingFamily")
    head_stack = _FONT_STACKS.get(head) or (head if head in _known_stacks else None)

    fonts_out: Dict[str, Any] = {"enabled": True, "family": font_stack}
    if head_stack and head_stack != font_stack:
        fonts_out["headingFamily"] = head_stack

    return {
        "theme": {
            "preset": theme_in.get("preset") if theme_in.get("preset") in _THEME_PRESETS else "default",
            "atmosphere": {
                "canvas": atm_in.get("canvas") if atm_in.get("canvas") in _ATMOSPHERES else "soft",
                "intensity": atm_in.get("intensity") if atm_in.get("intensity") in _INTENSITIES else "subtle",
            },
            "headingScale": theme_in.get("headingScale") if theme_in.get("headingScale") in _HEADING_SCALES else "default",
            "borderRadius": theme_in.get("borderRadius") if theme_in.get("borderRadius") in _RADII else "rounded",
        },
        "fonts": fonts_out,
        "motion": {"personality": motion_in.get("personality") if motion_in.get("personality") in _MOTIONS else "calm"},
    }


def _sanitize_page(
    raw_json: str, req: GeneratePageRequest, catalog: Dict[str, Any], extra_allowed: Optional[set] = None
) -> tuple[Dict[str, Any], Optional[Dict[str, Any]], List[str]]:
    warnings: List[str] = []
    try:
        data = json.loads(raw_json)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"Model returned invalid JSON: {e}")

    global_settings = _coerce_global_settings(data.get("globalSettings")) if isinstance(data, dict) else None
    page = data.get("page") if isinstance(data, dict) else None
    if page is None and isinstance(data, dict) and "components" in data:
        page = data  # model returned the page object directly
    if not isinstance(page, dict) or not isinstance(page.get("components"), list):
        raise HTTPException(status_code=502, detail="Model output did not contain a page with components.")

    allowed_types = {c["type"] for c in catalog["components"]}
    # Provided images + any we auto-generated (already uploaded to our S3).
    allowed_urls = {i.url for i in req.images} | (extra_allowed or set())
    seen_ids: set = set()

    components: List[Dict[str, Any]] = []
    html_blocks = 0
    for comp in page["components"]:
        cleaned = sanitize_component(comp, allowed_types, req.allow_chrome, seen_ids, allowed_urls, warnings)
        if cleaned is None:
            continue
        if cleaned["type"] == "htmlBlock":
            html_blocks += 1
            if html_blocks > _MAX_HTML_BLOCKS_PER_PAGE:
                warnings.append(f"Dropped htmlBlock beyond the {_MAX_HTML_BLOCKS_PER_PAGE}-per-page cap")
                continue
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
    return result, global_settings, warnings


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


async def _compose_one_page(
    body: GeneratePageRequest, catalog: Dict[str, Any], db, institute_id: str, actor_user_id: Optional[str],
    fixed_global: Optional[Dict[str, Any]] = None,
) -> tuple[Dict[str, Any], Optional[Dict[str, Any]], List[str], str, str]:
    """Compose ONE page end-to-end: inspiration/site-import → prompt → LLM →
    auto-images → sanitize → bill. Returns (page, global_settings, warnings,
    model, run_id). Raises HTTPException(502) if the LLM call fails.
    When fixed_global is set, the theme is pinned (multi-page consistency)."""
    inspiration_brief = ""
    if body.inspiration_image_urls:
        try:
            inspiration_brief = await _analyze_inspiration(
                body.inspiration_image_urls, db, institute_id, actor_user_id
            )
        except Exception as e:  # noqa: BLE001
            logger.warning("[page-builder] inspiration analysis skipped: %s", e)

    site_corpus = ""
    if body.source_url:
        try:
            site_corpus = await _import_site(body.source_url)
        except Exception as e:  # noqa: BLE001
            logger.warning("[page-builder] site import skipped: %s", e)

    prompt = _build_prompt(body, catalog, inspiration_brief, site_corpus, fixed_global)
    run_id = uuid.uuid4().hex

    primary, fallbacks = resolve_models(
        db, "page_builder", preferred_model=body.preferred_model, hard_fallback=_DEFAULT_MODEL
    )
    try:
        raw_json, model_used, usage = await generate_json(prompt, [primary, *fallbacks], label="page-builder")
    except Exception as e:  # noqa: BLE001
        logger.warning("[page-builder] generation failed: %s", e)
        raise HTTPException(status_code=502, detail=f"Page generation failed: {e}")

    generated_urls: set = set()
    if body.auto_images:
        try:
            data = json.loads(raw_json)
            page_obj = data.get("page") if isinstance(data, dict) else None
            if isinstance(page_obj, dict):
                generated_urls = await _autogen_images(page_obj, db, institute_id, actor_user_id)
                raw_json = json.dumps(data)
        except Exception as e:  # noqa: BLE001
            logger.warning("[page-builder] auto-image pass skipped: %s", e)

    page, global_settings, warnings = _sanitize_page(raw_json, body, catalog, extra_allowed=generated_urls)
    if fixed_global is not None:
        global_settings = fixed_global  # pin the shared theme across the site

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

    return page, global_settings, warnings, model_used, run_id


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
    page, global_settings, warnings, model_used, run_id = await _compose_one_page(
        body, catalog, db, institute_id, actor_user_id
    )
    return GeneratePageResponse(
        page=page, global_settings=global_settings, run_id=run_id, model=model_used, warnings=warnings
    )


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
    # Allow the copilot to request generated images via gen:<prompt> sentinels.
    auto_images: bool = True
    preferred_model: Optional[str] = None


class EditPageResponse(BaseModel):
    ops: List[Dict[str, Any]]
    reply: str
    run_id: str
    model: str
    warnings: List[str] = Field(default_factory=list)


def _build_edit_prompt(req: EditPageRequest, catalog: Dict[str, Any], attachment_brief: str = "") -> str:
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

    term_block = _terminology_block(req.terminology)
    if term_block:
        parts.append(term_block)
    if req.images:
        parts.append(
            "## PROVIDED IMAGES (the ONLY image URLs you may use)\n"
            + json.dumps([i.model_dump(exclude_none=True) for i in req.images], ensure_ascii=False)
        )
    if attachment_brief:
        parts.append(
            "## WHAT THE ADMIN ATTACHED (read by a vision pass — you cannot see the raw image)\n"
            + attachment_brief
            + "\n\nHOW TO USE IT: if the attachment is a SCREENSHOT/MOCKUP of a section, BUILD that "
              "section with our components (match its structure, copy and treatment as closely as the "
              "vocabulary allows) and insert it where the instruction asks — never say you cannot see "
              "the image, and never place the screenshot itself as a page image. If it is a PHOTO/logo, "
              "place it using its URL from PROVIDED IMAGES.\n"
              "MAPPING HINTS for a transcribed card grid: a small category label above each card title "
              "is the card's `chips` (do NOT drop it — it is what makes the grid scannable); a per-card "
              "link like 'View details' is the card's `link` {text,url}; leave `icon`/`iconName` UNSET "
              "when the reference shows no icon (an unset icon renders nothing, which is correct — do "
              "not substitute a decorative emoji); a tinted header band above each card's body means "
              "featureGrid style 'panel' with headerVariant."
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
    if req.auto_images:
        parts.append(
            "## IMAGE GENERATION\nWhen the request needs a NEW image (replace a photo, add a hero visual, "
            "an illustration), set that image field to \"gen:<a vivid, specific photography/illustration "
            "prompt>\" inside your op and it will be generated and filled in. Max 2 gen: fields per edit. "
            "Never gen: real-brand logos or real people."
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


def _sanitize_ops(raw_json: str, req: EditPageRequest, catalog: Dict[str, Any], extra_allowed: Optional[set] = None) -> tuple[List[Dict[str, Any]], str, List[str]]:
    warnings: List[str] = []
    try:
        data = json.loads(raw_json)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"Model returned invalid JSON: {e}")
    if not isinstance(data, dict) or not isinstance(data.get("ops"), list):
        raise HTTPException(status_code=502, detail="Model output did not contain an ops list.")

    reply = str(data.get("reply") or "").strip()
    allowed_types = {c["type"] for c in catalog["components"]}
    allowed_urls = {i.url for i in req.images} | (extra_allowed or set())
    # Ids that exist on the page (top-level + slot children) — ops may only
    # reference these (inserts bring their own new id).
    existing_ids: set = set()
    type_by_id: Dict[str, str] = {}

    def collect(components: Any) -> None:
        for c in components if isinstance(components, list) else []:
            if isinstance(c, dict) and c.get("id"):
                existing_ids.add(c["id"])
                type_by_id[c["id"]] = str(c.get("type") or "")
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
                raw_patch = dict(op["propsPatch"])
                custom_html: Dict[str, Any] = {}
                if type_by_id.get(oid) == "htmlBlock":
                    # html/css take the custom-HTML pipeline, NOT the generic
                    # cleaner (whose default nh3 profile strips class attrs).
                    if isinstance(raw_patch.get("html"), str):
                        custom_html["html"] = _sanitize_custom_html(raw_patch.pop("html"), allowed_urls, warnings)
                    if isinstance(raw_patch.get("css"), str):
                        custom_html["css"] = _scrub_css(raw_patch.pop("css"), warnings)
                patch = clean_urls(raw_patch, allowed_urls, warnings)
                patch.update(custom_html)
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
    # Vision pass first: without it the model receives attachments as bare URLs
    # and cannot see them (field report: "I couldn't see an actual section
    # attached" when an admin pasted a screenshot of the section they wanted).
    attachment_brief = ""
    if body.images:
        try:
            attachment_brief = await _describe_attachments(
                [i.url for i in body.images], db, institute_id, actor_user_id
            )
        except Exception as e:  # noqa: BLE001
            logger.warning("[page-copilot] attachment description skipped: %s", e)
    prompt = _build_edit_prompt(body, catalog, attachment_brief)
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

    # Generate any gen:<prompt> images the copilot requested in its ops
    # (insert components / propsPatch) BEFORE sanitizing, so the fresh URLs
    # pass the image allowlist.
    generated_urls: set = set()
    if body.auto_images:
        try:
            data = json.loads(raw_json)
            if isinstance(data, dict) and isinstance(data.get("ops"), list):
                generated_urls = await _autogen_images(data["ops"], db, institute_id, actor_user_id)
                raw_json = json.dumps(data)
        except Exception as e:  # noqa: BLE001
            logger.warning("[page-copilot] auto-image pass skipped: %s", e)

    ops, reply, warnings = _sanitize_ops(raw_json, body, catalog, extra_allowed=generated_urls)

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
    fontFamily: str          # body
    headingFontFamily: str   # heading (may equal fontFamily = no separate heading font)
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
        headingFontFamily=raw.get("headingFontFamily") if raw.get("headingFontFamily") in _FONT_FAMILIES
        else (raw.get("fontFamily") if raw.get("fontFamily") in _FONT_FAMILIES else "Inter"),
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
        f"- fontFamily (body) and headingFontFamily (headings): {sorted(_FONT_FAMILIES)}\n"
        "Make the three genuinely different (e.g. one editorial-serif, one bold-modern, one calm-minimal). "
        "For editorial/premium options pair a SERIF headingFontFamily (Playfair Display / Fraunces / DM Serif "
        "Display) with a SANS fontFamily body — serif headings over sans body reads premium. Set "
        "headingFontFamily equal to fontFamily when no separate heading font is wanted. "
        "Pick presets/colors that suit the institute's subject and audience.\n\n"
        f"Institute: {body.institute_name or 'an education institute'}\n"
        f"Context: {(body.brief or '')[:600]}\n"
        f"Brand notes: {(body.brand_notes or 'none')[:300]}\n\n"
        'Return ONLY JSON: {"kits": [{"label": "...", "themePreset": "...", '
        '"atmosphere": {"canvas": "...", "intensity": "..."}, "headingScale": "...", '
        '"borderRadius": "...", "motion": "...", "fontFamily": "...", "headingFontFamily": "...", '
        '"rationale": "one sentence"}]}'
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


# ─── On-demand image / logo generation ──────────────────────────────────────

# kind → (prompt wrapper, default aspect). Logos get a clean, mark-focused brief.
_IMAGE_KIND_STYLE = {
    "logo": ("A clean, modern, minimal logo mark for {p}. Centered on a plain white background, "
             "flat vector style, simple geometric forms, high contrast, no photorealism, no extra text.", "1:1"),
    "hero": ("A polished, editorial hero photograph: {p}. Natural light, shallow depth of field, premium feel.", "16:9"),
    "banner": ("A wide banner image: {p}. Clean composition with room for text overlay.", "16:9"),
    "illustration": ("A modern flat vector illustration: {p}. Cohesive limited palette, friendly, professional.", "4:3"),
    "photo": ("A high-quality photograph: {p}. Natural, authentic, well-lit.", "4:3"),
    "image": ("{p}", "16:9"),
}


class GenerateImageRequest(BaseModel):
    prompt: str
    kind: str = "image"          # logo | hero | banner | illustration | photo | image
    aspect_ratio: Optional[str] = None
    count: int = 1               # 1–3 (logos often want a few options)


class GenerateImageResponse(BaseModel):
    urls: List[str]
    model: str


@router.post("/v1/image", response_model=GenerateImageResponse)
async def generate_page_image(
    body: GenerateImageRequest,
    db: Session = Depends(db_dependency),
    current_user=Depends(get_current_user),
) -> GenerateImageResponse:
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    if not body.prompt or not body.prompt.strip():
        raise HTTPException(status_code=400, detail="An image prompt is required.")
    institute_id = getattr(current_user, "institute_id", None)
    if not institute_id:
        raise HTTPException(status_code=400, detail="No institute context on this session.")
    actor_user_id = getattr(current_user, "user_id", None)

    wrapper, default_aspect = _IMAGE_KIND_STYLE.get(body.kind, _IMAGE_KIND_STYLE["image"])
    prompt = wrapper.format(p=body.prompt.strip())
    aspect = body.aspect_ratio if body.aspect_ratio in _IMAGE_ASPECTS else default_aspect
    n = max(1, min(3, body.count))

    results = await asyncio.gather(
        *[_generate_and_upload_image(prompt, aspect, body.kind, db, institute_id, actor_user_id) for _ in range(n)],
        return_exceptions=True,
    )
    urls = [r for r in results if isinstance(r, str) and r]
    if not urls:
        raise HTTPException(status_code=502, detail="Image generation failed — please try again.")
    return GenerateImageResponse(urls=urls, model=_IMAGE_MODEL)


# ─── Multi-page site (one brief → several coherent pages) ────────────────────

# Canonical page-type vocabulary — the SINGLE source for the intake validator
# and the whole-site generator.
#
# These two used to diverge: "courses" was valid for a site build but absent from
# the intake validator's allowlist, and "course-landing" was the reverse. Since
# the intake validator silently coerces anything unrecognised to "homepage", a
# request like "a page that has details of programs" was classified "courses",
# rejected, and rebuilt as a LANDING page — hero, feature grids and a live
# enrol grid instead of a dense directory. Keep this list authoritative.
_PAGE_TYPE_LABELS = {
    "homepage": "the main landing page",
    "courses": "a programs/offerings DIRECTORY page — one detailed block per offering",
    "course-landing": "a sales page for ONE offering",
    "about": "an about-us / our-story page",
    "admissions": "an admissions / how-to-enroll page",
    "contact": "a contact page (address, form, map)",
}
_SITE_PAGE_LABELS = _PAGE_TYPE_LABELS


class GenerateSiteRequest(BaseModel):
    brief: str
    page_types: List[str] = Field(default_factory=lambda: ["homepage", "about", "contact"])
    institute_name: Optional[str] = None
    images: List[PageImage] = Field(default_factory=list)
    courses: List[CourseSnapshotItem] = Field(default_factory=list)
    terminology: Optional[Dict[str, str]] = None
    source_url: Optional[str] = None
    auto_images: bool = True
    preferred_model: Optional[str] = None


class SitePageOut(BaseModel):
    page_type: str
    page: Dict[str, Any]


class GenerateSiteResponse(BaseModel):
    pages: List[SitePageOut]
    global_settings: Optional[Dict[str, Any]] = None
    model: str
    warnings: List[str] = Field(default_factory=list)


@router.post("/v1/site", response_model=GenerateSiteResponse)
async def generate_site(
    body: GenerateSiteRequest,
    db: Session = Depends(db_dependency),
    current_user=Depends(get_current_user),
) -> GenerateSiteResponse:
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    if not body.brief or not body.brief.strip():
        raise HTTPException(status_code=400, detail="A brief describing the site is required.")
    institute_id = getattr(current_user, "institute_id", None)
    if not institute_id:
        raise HTTPException(status_code=400, detail="No institute context on this session.")
    actor_user_id = getattr(current_user, "user_id", None)

    # De-dup, keep order, always lead with homepage, cap at 5 pages.
    seen: set = set()
    page_types: List[str] = []
    for pt in ["homepage", *body.page_types]:
        if pt not in seen and pt in _SITE_PAGE_LABELS:
            seen.add(pt)
            page_types.append(pt)
    page_types = page_types[:5]

    # Pre-flight for the whole run (N × the per-page flat cost).
    estimate = preflight_tool_credits(
        db, tool_key=_TOOL_KEY, tool_params={}, institute_id=institute_id
    )
    per_page = float(estimate.get("estimated_credits") or 0)
    balance = float(estimate.get("current_balance") or 0)
    if per_page * len(page_types) > balance:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                f"Insufficient credits: this {len(page_types)}-page site needs ~{per_page * len(page_types):.0f} "
                f"credits but the balance is {balance:.0f}."
            ),
        )

    catalog = _load_catalog()
    pages: List[SitePageOut] = []
    warnings: List[str] = []
    shared_global: Optional[Dict[str, Any]] = None
    model_used = _DEFAULT_MODEL

    for i, pt in enumerate(page_types):
        sub = GeneratePageRequest(
            brief=f"{body.brief.strip()}\n\nThis is {_SITE_PAGE_LABELS[pt]} of the site.",
            page_type=pt,
            institute_name=body.institute_name,
            images=body.images,
            # Only import the source site + real courses on the homepage — other
            # pages inherit the theme and brief (keeps cost/latency down).
            source_url=body.source_url if i == 0 else None,
            courses=body.courses if pt in ("homepage", "courses") else [],
            terminology=body.terminology,
            auto_images=body.auto_images,
            preferred_model=body.preferred_model,
        )
        try:
            page, gs, w, model_used, _ = await _compose_one_page(
                sub, catalog, db, institute_id, actor_user_id, fixed_global=shared_global
            )
        except HTTPException:
            if pages:
                break  # keep what we have if a later page fails
            raise
        if shared_global is None:
            shared_global = gs
        page["route"] = pt if pt != "homepage" else (page.get("route") or "home")
        pages.append(SitePageOut(page_type=pt, page=page))
        warnings.extend(w)

    if not pages:
        raise HTTPException(status_code=502, detail="Site generation produced no pages — please retry.")
    return GenerateSiteResponse(pages=pages, global_settings=shared_global, model=model_used, warnings=warnings)


# ─── Assistive intake (chat-style website interview) ────────────────────────
# The wizard's conversational mode: instead of one brief textarea, the
# assistant interviews the admin turn by turn — asking for facts, proof
# points, tone, and REQUESTING uploads (logo / photos / inspiration
# screenshots) when they would lift the result — then assembles a rich,
# composer-ready brief. Uploaded images ride along as vision attachments so
# the assistant can react to what it was given.

_INTAKE_TOOL_KEY = "page_intake"
_INTAKE_UPLOAD_KINDS = {"logo", "photo", "inspiration"}
_MAX_INTAKE_TURNS = 40


class IntakeTurn(BaseModel):
    role: str  # 'user' | 'assistant'
    content: str = ""
    # Images the admin uploaded WITH this turn (already on our S3).
    image_urls: List[str] = Field(default_factory=list)


class IntakeRequest(BaseModel):
    history: List[IntakeTurn]
    institute_name: Optional[str] = None
    courses: List[CourseSnapshotItem] = Field(default_factory=list)
    terminology: Optional[Dict[str, str]] = None
    preferred_model: Optional[str] = None


class IntakeResponse(BaseModel):
    reply: str
    chips: List[str] = Field(default_factory=list)
    # When set, the FE opens the matching uploader inline: logo|photo|inspiration
    request_upload: Optional[str] = None
    # How the assistant classified images in the admin's LATEST message —
    # the FE routes them into content images vs inspiration accordingly
    # (an unprompted website screenshot must land in inspiration, not on the page).
    received_image_kind: Optional[str] = None
    ready: bool = False
    # Composer-ready brief — final when ready=true, best-effort draft before.
    brief: Optional[str] = None
    page_type: Optional[str] = None
    whole_site: bool = False
    run_id: str
    model: str
    warnings: List[str] = Field(default_factory=list)


def _build_intake_prompt(req: IntakeRequest) -> str:
    parts: List[str] = []
    parts.append(
        "You are the website-creation assistant for Vacademy: you interview an education-institute "
        "admin (often non-technical) and gather everything needed to build them a world-class website. "
        "You do NOT build the page yourself — a separate composer will receive your final brief.\n"
        "STYLE: warm, plain language, ONE question per turn, never a form. Mirror the admin's language "
        "(Hindi in → Hindi out). Keep replies to 1–3 short sentences.\n"
        "WHAT TO LEARN (adapt order, skip what you already know): 1) what the site is for + what makes "
        "this institute different; 2) concrete PROOF (results, years, student counts, toppers, records — "
        "numbers make pages persuasive); 3) tone/style direction and any sites they admire — ask them to "
        "upload SCREENSHOTS of sites they like (request_upload='inspiration'); 4) their LOGO "
        "(request_upload='logo') and real photos of campus/classes/students (request_upload='photo') — "
        "real photos beat stock; 5) whether they want one homepage or a whole site (home+about+contact).\n"
        "UPLOAD REQUESTS: set request_upload to logo|photo|inspiration ONLY when that is what you are "
        "asking for this turn; the admin sees an upload button. If they upload, the images appear as "
        "attachments — react to them specifically (e.g. comment on the logo's colors) and use them to "
        "sharpen the design direction. Never demand uploads; offering to skip is fine. Whenever the "
        "admin's LATEST message includes an image, ALSO set received_image_kind: a screenshot of a "
        "website/app they want to look like = 'inspiration'; their brand mark = 'logo'; a real "
        "campus/class/people photo = 'photo'.\n"
        "PACE: aim to be ready within 5–8 of your turns. The admin can say 'just build it' at any time — "
        "then set ready=true immediately with the best brief you can.\n"
        "WHEN READY (ready=true): write `brief` as a RICH composer brief in the admin's language: "
        "identity + differentiators, every real number/proof point gathered, the section plan, tone, "
        "color/style direction (including anything learned from uploaded logo/inspiration), and which "
        "uploaded photos exist. Be specific — the composer only knows what the brief says. Keep the "
        "brief under 350 words — dense, no filler.\n"
        "ALWAYS return `brief` as your best current draft even before ready (the admin can jump ahead)."
    )
    if req.institute_name:
        parts.append(f"## INSTITUTE\nName: {req.institute_name}")
    if req.courses:
        parts.append(
            "## REAL COURSES (already known — do not ask for a course list again)\n"
            + json.dumps([c.model_dump(exclude_none=True) for c in req.courses], ensure_ascii=False)
        )
    term_block = _terminology_block(req.terminology, intake=True)
    if term_block:
        parts.append(term_block)
    parts.append(
        "## OUTPUT CONTRACT\nReturn ONLY a JSON object (no markdown fences):\n"
        '{"reply": "<your next message>", "chips": ["<2-4 short tap-to-answer suggestions>"], '
        '"request_upload": "logo"|"photo"|"inspiration"|null, '
        '"received_image_kind": "logo"|"photo"|"inspiration"|null, "ready": true|false, '
        '"brief": "<current composer brief draft>", '
        '"page_type": ' + "|".join(f'"{k}"' for k in _PAGE_TYPE_LABELS) + ', '
        '"whole_site": true|false}\n'
        "PAGE TYPE — pick the one that matches what the admin actually asked for; this decides the "
        "page's whole STRUCTURE, so getting it wrong produces the wrong page:\n"
        + "\n".join(f"  - {k}: {v}" for k, v in _PAGE_TYPE_LABELS.items())
        + "\nIf the admin asks to list/detail what they offer (\"details of my programs\", \"all our "
        "courses\", \"what we teach\"), that is `courses` — NOT `homepage`.\n"
        "If the admin says the page is informational only (\"just data\", \"no enrolment\", \"no "
        "prices\"), say so explicitly in `brief` — the composer omits all commerce when it reads that."
    )
    return "\n\n".join(parts)


def _parse_intake_json(raw: str) -> Dict[str, Any]:
    """Tolerant parse: strip code fences / leading prose around the JSON."""
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\s*|\s*```$", "", text)
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("no JSON object in intake reply")
    return json.loads(text[start:end + 1])


@router.post("/v1/intake", response_model=IntakeResponse)
async def intake_turn(
    body: IntakeRequest,
    db: Session = Depends(db_dependency),
    current_user=Depends(get_current_user),
) -> IntakeResponse:
    from ..services.chat_llm_client import ChatLLMClient
    from ..services.api_key_resolver import ApiKeyResolver

    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    institute_id = getattr(current_user, "institute_id", None)
    if not institute_id:
        raise HTTPException(status_code=400, detail="No institute context on this session.")
    actor_user_id = getattr(current_user, "user_id", None)
    if len(body.history) > _MAX_INTAKE_TURNS:
        raise HTTPException(status_code=400, detail="This conversation is too long — please generate or start over.")

    estimate = preflight_tool_credits(db, tool_key=_INTAKE_TOOL_KEY, tool_params={}, institute_id=institute_id)
    if estimate.get("sufficient") is False:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Insufficient credits (balance {estimate.get('current_balance')}).",
        )

    # Conversation → chat messages. Uploaded images are fetched by US and
    # inlined as data: URLs (capped: last 4 image-bearing references) — the
    # provider never fetches admin URLs itself.
    messages: List[Dict[str, Any]] = [{"role": "system", "content": _build_intake_prompt(body)}]
    pending_attach: List[tuple] = []  # (msg, urls)
    attach_budget = 4
    for turn in body.history[-16:]:
        role = "assistant" if turn.role == "assistant" else "user"
        msg: Dict[str, Any] = {"role": role, "content": (turn.content or "")[:4000]}
        if role == "user" and turn.image_urls and attach_budget > 0:
            urls = [u for u in turn.image_urls if isinstance(u, str) and u.startswith("https://")][:attach_budget]
            if urls:
                attach_budget -= len(urls)
                pending_attach.append((msg, urls))
        messages.append(msg)
    intake_warnings: List[str] = []
    if pending_attach:
        flat_urls = [u for _, urls in pending_attach for u in urls]
        inlined = await asyncio.gather(*(_inline_image_data_url(u) for u in flat_urls))
        pos = 0
        for msg, urls in pending_attach:
            chunk = inlined[pos:pos + len(urls)]
            pos += len(urls)
            atts = []
            for u, (data_url, err) in zip(urls, chunk):
                if data_url:
                    atts.append({"type": "image", "url": data_url})
                else:
                    # Fall back to the raw URL — the provider may still be able
                    # to fetch it; the no-attachment retry covers it if not.
                    intake_warnings.append(f"image inline failed ({err}) — passed URL through")
                    atts.append({"type": "image", "url": u})
            msg["attachments"] = atts
            msg["content"] = (str(msg["content"]) + f"\n[uploaded {len(atts)} image(s)]").strip()
    if len(messages) == 1:
        messages.append({"role": "user", "content": "Hi — I want to build a website for my institute."})
    # Vision turns pull chat models into prose mode ("Nice logo! …") — restate
    # the contract inside the final user message so every turn stays JSON.
    messages[-1]["content"] = (
        str(messages[-1].get("content") or "")
        + "\n\n(Reply with ONLY the JSON object per the OUTPUT CONTRACT — no text outside it.)"
    )

    primary, fallbacks = resolve_models(
        db, "page_builder", preferred_model=body.preferred_model, hard_fallback=_DEFAULT_MODEL
    )
    client = ChatLLMClient(ApiKeyResolver(db))
    run_id = uuid.uuid4().hex
    data: Optional[Dict[str, Any]] = None
    model_used = primary
    usage: Dict[str, Any] = {}
    last_err: Optional[Exception] = None
    async def _try(msgs: List[Dict[str, Any]]) -> Optional[tuple]:
        nonlocal last_err
        for model in [primary, *fallbacks][:2]:
            try:
                # NOTE: no assistant-prefill here — OpenRouter 400s on a
                # trailing assistant message for these models (live-tested).
                # max_tokens must fit reply+chips+the FULL draft brief the
                # model echoes each turn — 1200 truncated big-brief turns into
                # unparseable JSON (field bug).
                resp = await client.chat_completion(
                    msgs, temperature=0.5, max_tokens=3000,
                    institute_id=institute_id, user_id=actor_user_id, model=model,
                )
                content = resp.get("content") or ""
                try:
                    parsed = _parse_intake_json(content)
                except Exception:
                    # Contract break but a real reply — salvage the prose so
                    # the turn (and anything the model SAW) isn't lost.
                    text = re.sub(r"^```[a-zA-Z]*\s*|\s*```$", "", content.strip()).strip("{} \n")
                    if len(text) < 10:
                        raise
                    intake_warnings.append(f"{model} broke the JSON contract — salvaged prose reply")
                    parsed = {"reply": text[:1500]}
                return parsed, (resp.get("model") or model), (resp.get("usage") or {})
            except Exception as e:  # noqa: BLE001
                last_err = e
                # Surfaced in response warnings — pod logs are hard to reach
                # in the field and this class of failure is content-dependent.
                intake_warnings.append(f"attempt failed on {model}: {str(e)[:220]}")
                logger.warning("[page-intake] turn failed on %s: %s", model, e)
        return None

    out = await _try(messages)
    if out is None and any("attachments" in m for m in messages):
        # A dead/unfetchable image URL makes the provider reject the whole
        # call — degrade to text-only rather than failing the conversation.
        logger.warning("[page-intake] retrying without attachments: %s", last_err)
        stripped = [{k: v for k, v in m.items() if k != "attachments"} for m in messages]
        # Merge the note into the final user turn — a trailing extra user
        # message (consecutive same-role) is rejected by some providers.
        stripped[-1]["content"] = (
            "(note: my uploaded image could not be loaded — please continue without it)\n"
            + str(stripped[-1].get("content") or "")
        )
        out = await _try(stripped)
    if out is None:
        raise HTTPException(status_code=502, detail=f"Assistant turn failed: {last_err}")
    data, model_used, usage = out

    chips = [_clean_string(str(c))[:60] for c in data.get("chips") or [] if str(c).strip()][:4]
    req_upload = data.get("request_upload")
    if req_upload not in _INTAKE_UPLOAD_KINDS:
        req_upload = None
    recv_kind = data.get("received_image_kind")
    if recv_kind not in _INTAKE_UPLOAD_KINDS:
        recv_kind = None
    page_type = data.get("page_type")
    if page_type not in _PAGE_TYPE_LABELS:
        page_type = "homepage"

    try:
        record_tool_billing(
            tool_key=_INTAKE_TOOL_KEY,
            tool_params={},
            request_type=RequestType.CONTENT,
            model=model_used,
            prompt_tokens=int((usage or {}).get("prompt_tokens") or 0),
            completion_tokens=int((usage or {}).get("completion_tokens") or 0),
            institute_id=institute_id,
            user_id=actor_user_id,
            user_role=None,
            idempotency_key=f"{_INTAKE_TOOL_KEY}:{run_id}",
            usage_markup=_USAGE_MARKUP,
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("[page-intake] billing skipped: %s", e)

    return IntakeResponse(
        reply=_clean_string(str(data.get("reply") or "")).strip()[:2000] or "Tell me about your institute!",
        chips=chips,
        request_upload=req_upload,
        received_image_kind=recv_kind,
        ready=bool(data.get("ready")),
        brief=(_clean_string(str(data.get("brief"))) if data.get("brief") else None),
        page_type=page_type,
        whole_site=bool(data.get("whole_site")),
        run_id=run_id,
        model=model_used,
        warnings=intake_warnings,
    )


# ─── Site chrome (global settings) copilot ─────────────────────────────────────
#
# Global settings — the header, the footer, the theme — sat entirely outside AI
# reach: the copilot only emits component OPS, and these live on
# globalSettings.layout.*, not in any page's component tree. So the one screen
# where hand-entry is most tedious (a footer with four link columns; a nav that
# must mirror every page) had no assistance at all, and the AI panel just said
# "Select a page to start editing with AI".
#
# Deliberately NARROW write surface: header, footer, theme, fonts, motion.
# Tracking IDs, lead-collection wiring and the WhatsApp number are excluded on
# purpose — those are billing identifiers, campaign wiring and real contact
# details. An LLM has no business inventing any of them, and a wrong analytics
# ID fails silently for weeks.
_CHROME_TOOL_KEY = _EDIT_TOOL_KEY  # same cost class as one copilot edit

_CHROME_WRITABLE_KEYS = {"theme", "fonts", "motion"}


class SiteChromeRequest(BaseModel):
    instruction: str
    # Current globalSettings, sent verbatim so the model edits what is on screen.
    global_settings: Dict[str, Any] = Field(default_factory=dict)
    # [{route, title}] so nav/footer links can only point at pages that exist.
    pages: List[Dict[str, Any]] = Field(default_factory=list)
    institute_name: Optional[str] = None
    terminology: Optional[Dict[str, str]] = None
    history: List[ChatTurn] = Field(default_factory=list)
    preferred_model: Optional[str] = None


class SiteChromeResponse(BaseModel):
    global_settings: Dict[str, Any]
    reply: str
    run_id: str
    model: str
    warnings: List[str] = Field(default_factory=list)


def _build_chrome_prompt(req: SiteChromeRequest, catalog: Dict[str, Any]) -> str:
    parts: List[str] = []
    parts.append(
        "You are the site-chrome assistant for Vacademy's website builder. You edit a site's "
        "HEADER, FOOTER and THEME — the parts shared by every page — and return the updated "
        "settings as JSON. You never invent analytics IDs, phone numbers or campaign ids."
    )

    header_schema = next((c for c in catalog["components"] if c.get("type") == "header"), None)
    footer_schema = next((c for c in catalog["components"] if c.get("type") == "footer"), None)
    parts.append(
        "## HEADER / FOOTER SHAPE (exact prop names — anything else is ignored by the renderer)\n"
        + json.dumps({"header": header_schema, "footer": footer_schema}, ensure_ascii=False)
    )
    parts.append(
        "## HEADER RULES\n"
        "- `navigation`: [{label, route, openInSameTab}] — the main menu. `route` is a page route "
        "from the PAGES list below (use \"\" for home), an #anchor, or an absolute URL. NEVER invent "
        "a route: a menu item pointing at a page that does not exist is a dead link.\n"
        "- `authLinks`: [{label, route}] — the buttons on the RIGHT. Use route 'login' for Login and "
        "'signup' for Sign Up. An enquiry/registration button that opens a campaign form needs an "
        "audienceId the ADMIN must choose, so emit it with route '' and NO audienceId; the admin "
        "picks the campaign in the editor. Do not fabricate an audienceId.\n"
        "- Keep the existing logo and title unless the instruction says to change them."
    )
    parts.append(
        "## FOOTER RULES\n"
        "- `leftSection`: {title, text, socials[]} — the brand blurb.\n"
        "- `rightSection`: {title, links[{label, route}]} — a link column.\n"
        "- `bottomNote`: the copyright line.\n"
        "- Link routes obey the same rule as the header: existing pages, anchors or absolute URLs only.\n"
        "- Never invent an address, phone number or email. If the instruction does not supply one, "
        "leave it out rather than making it up."
    )
    parts.append(
        "## THEME\n" + json.dumps(catalog["globalSettingsSchema"], ensure_ascii=False)
    )
    if req.institute_name:
        parts.append(f"## INSTITUTE\nName: {req.institute_name}")
    term_block = _terminology_block(req.terminology)
    if term_block:
        parts.append(term_block)
    parts.append(
        "## PAGES THAT EXIST (label → route; link only to these)\n"
        + json.dumps(
            [{"title": p.get("title"), "route": p.get("route")} for p in (req.pages or [])],
            ensure_ascii=False,
        )
    )
    parts.append(
        "## CURRENT SETTINGS (edit these; preserve anything the instruction does not mention)\n"
        + json.dumps(req.global_settings or {}, ensure_ascii=False)[:12000]
    )
    if req.history:
        parts.append(
            "## CONVERSATION SO FAR\n"
            + "\n".join(f"{t.role}: {t.content}" for t in req.history[-6:])
        )
    parts.append(f"## INSTRUCTION\n{req.instruction.strip()}")
    parts.append(
        "## OUTPUT CONTRACT\nReturn ONLY this JSON object, no markdown:\n"
        '{"globalSettings": {"layout": {"header": {"props": {...}}, "footer": {"props": {...}}}, '
        '"theme": {...}, "fonts": {...}, "motion": {...}}, '
        '"reply": "<one or two sentences on what you changed, in plain language>"}\n'
        "Include ONLY the keys you actually changed. Omit layout entirely if you changed no chrome."
    )
    return "\n\n".join(parts)


def _merge_chrome(current: Dict[str, Any], proposed: Any, warnings: List[str]) -> Dict[str, Any]:
    """Merge the model's proposal onto the live settings through a narrow gate.

    Only header/footer props and theme/fonts/motion may change. Everything else
    on globalSettings — tracking, leadCollection, whatsapp, courseCatalogeType —
    is carried over from `current` untouched, so a hallucinated analytics id or
    an invented phone number can never reach the config.
    """
    merged = json.loads(json.dumps(current or {}))  # deep copy
    if not isinstance(proposed, dict):
        warnings.append("Model returned no usable settings")
        return merged

    # Theme / fonts / motion — reuse the existing clamp so only supported
    # presets, atmospheres and font stacks survive.
    theme_like = {k: v for k, v in proposed.items() if k in _CHROME_WRITABLE_KEYS}
    if theme_like:
        coerced = _coerce_global_settings(theme_like)
        if coerced:
            for k in _CHROME_WRITABLE_KEYS:
                if k in theme_like and k in coerced:
                    merged[k] = coerced[k]

    layout_in = proposed.get("layout")
    if isinstance(layout_in, dict):
        merged.setdefault("layout", {})
        for section in ("header", "footer"):
            section_in = layout_in.get(section)
            if not isinstance(section_in, dict):
                continue
            props_in = section_in.get("props")
            if not isinstance(props_in, dict):
                continue
            # Strings get the same hostile-content scrub as page props.
            cleaned = clean_urls(props_in, set(), warnings)
            existing = merged["layout"].get(section)
            if isinstance(existing, dict):
                merged["layout"][section] = {
                    **existing,
                    "props": {**(existing.get("props") or {}), **cleaned},
                }
            else:
                merged["layout"][section] = {"type": section, "enabled": True, "props": cleaned}
    return merged


@router.post("/v1/site-chrome", response_model=SiteChromeResponse)
async def edit_site_chrome(
    body: SiteChromeRequest,
    db: Session = Depends(db_dependency),
    current_user=Depends(get_current_user),
) -> SiteChromeResponse:
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    if not body.instruction or not body.instruction.strip():
        raise HTTPException(status_code=400, detail="Tell me what to change.")

    institute_id = getattr(current_user, "institute_id", None)
    if not institute_id:
        raise HTTPException(status_code=400, detail="No institute context on this session.")
    actor_user_id = getattr(current_user, "user_id", None)

    estimate = preflight_tool_credits(
        db, tool_key=_CHROME_TOOL_KEY, tool_params={}, institute_id=institute_id
    )
    if estimate.get("sufficient") is False:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                f"Insufficient credits: this change needs ~{estimate['estimated_credits']} "
                f"credits but the balance is {estimate.get('current_balance')}."
            ),
        )

    catalog = _load_catalog()
    prompt = _build_chrome_prompt(body, catalog)
    run_id = uuid.uuid4().hex
    primary, fallbacks = resolve_models(
        db, "page_builder", preferred_model=body.preferred_model, hard_fallback=_DEFAULT_MODEL
    )
    try:
        raw_json, model_used, usage = await generate_json(
            prompt, [primary, *fallbacks], label="site-chrome"
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("[site-chrome] failed: %s", e)
        raise HTTPException(status_code=502, detail=f"Could not apply that change: {e}")

    warnings: List[str] = []
    try:
        data = json.loads(raw_json)
    except Exception:
        data = {}
        warnings.append("Model output was not valid JSON")
    merged = _merge_chrome(body.global_settings, data.get("globalSettings"), warnings)
    reply = _clean_string(str(data.get("reply") or "Updated your site settings."))[:600]

    try:
        record_tool_billing(
            tool_key=_CHROME_TOOL_KEY,
            tool_params={},
            request_type=RequestType.CONTENT,
            model=model_used,
            prompt_tokens=int((usage or {}).get("prompt_tokens") or 0),
            completion_tokens=int((usage or {}).get("completion_tokens") or 0),
            institute_id=institute_id,
            user_id=actor_user_id,
            user_role=None,
            idempotency_key=f"{_CHROME_TOOL_KEY}:{run_id}",
            usage_markup=_USAGE_MARKUP,
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("[site-chrome] billing skipped: %s", e)

    return SiteChromeResponse(
        global_settings=merged,
        reply=reply,
        run_id=run_id,
        model=model_used,
        warnings=warnings,
    )
