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
                "props": {"headerText": "Ready to start?", "description": "Book a free demo class this week.", "buttonText": "Book a free demo", "buttonAction": "openLeadCollection"},
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
    "OPEN with a rich heroSection: an eyebrow BADGE, a bold specific headline, 2 CTA buttons (primary+secondary), and 3 statChips "
    "for proof numbers. Put it on a section shell (style.layout.width 'wide') with minHeight '80vh' + contentAlign 'center' so it fills the fold.",
    "Use a sectionHeading with a highlight (style 'gradient' or 'underline') on ONE key phrase before each dense section — this accent is what makes pages feel designed.",
    "Prefer rich components over plain ones: featureGrid with style 'glass'/'gradient-border'/'tinted' and chips, stepsProcess ALWAYS with variant 'timeline-cards' or "
    "'alternating' plus nodeStyle 'icon' (plain numbered steps look dated), logoCloud in 'marquee' layout as a ticker of announcements, testimonialSection with ratings, "
    "trustChip. NEVER use the plain 'banner' component for a hero.",
    "Feature/accordion icons: ALWAYS set iconName from the icon library (GraduationCap, Rocket, Target, UsersThree, Code, Brain, Trophy, Lightbulb, ShieldCheck, "
    "ChartLineUp, Clock, Star, BookOpen, Certificate, ChatsCircle, Wrench, Sparkle, Medal, Briefcase, Globe) — never rely on the emoji 'icon' field; emojis read cheap.",
    "Theme preset: commit to a COLOR that fits the brand's subject (ocean/midnight = tech & engineering, forest = growth & science, sunset/amber = energetic, "
    "rose/violet = creative, slate = corporate). Use 'default' ONLY when the institute's own brand color should shine through unchanged.",
    "Add tasteful depth: an ornaments glow-orb behind a feature section, a subtle backgroundLayers gradient on the CTA, atmosphere on the hero. Keep it restrained — one accent per section.",
    "Rhythm: exactly ONE hero; alternate section surface tints; place a live courseCatalog where offerings belong; end with a CTA (and contact if a contact page). 6–12 sections.",
    "Copy: concise, benefit-led, specific to THIS institute (use real course names + the provided stats/claims). Never lorem ipsum, never generic filler. Mirror the brief's language.",
    "ESCAPE HATCH — htmlBlock: when a design idea genuinely cannot be expressed with the typed components (a bespoke bento grid, an unusual editorial "
    "layout, decorative hero art), you may use AT MOST TWO htmlBlock components per page: props {html, css, prompt}. Hard rules: (1) style ONLY via the css "
    "prop with class selectors — never <style> tags in the html; (2) ALL colors and fonts MUST come from the site theme variables — var(--primary-500), "
    "var(--primary-400), var(--primary-50), var(--catalogue-text-primary), var(--catalogue-text-secondary), var(--catalogue-bg), var(--catalogue-border), "
    "font-family: var(--catalogue-heading-font, inherit) for display text — NEVER literal hex colors, so re-theming still works; (3) MUST be responsive: "
    "include @media (max-width: 640px) rules; (4) no scripts, iframes, svg, forms or external assets — <img> only with PROVIDED image URLs; animation via "
    "CSS only (the section renders in a sandbox that strips everything else); (5) set props.prompt to a one-line brief of the section's intent so it can be "
    "regenerated later; (6) include generous padding (the section renders full-bleed with no outer spacing of its own). Prefer typed components whenever they fit.",
]


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
        f"## TASK\nPage type: {page_type}\nAdmin brief (mirror its language in the page copy):\n{req.brief.strip()}"
    )
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

_SITE_PAGE_LABELS = {
    "homepage": "the main landing page",
    "about": "an about-us / our-story page",
    "contact": "a contact page (address, form, map)",
    "admissions": "an admissions / how-to-enroll page",
    "courses": "a programs overview page",
}


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
