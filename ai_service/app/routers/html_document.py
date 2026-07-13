"""
Router for the HTML Document slide type.

Unlike the legacy Yoopta/Tiptap document editors, an HTML document slide is a
piece of **pure, self-contained, creative HTML** — authored and edited entirely
by AI (an editor would constrain the animations / bespoke layouts the model can
produce). This endpoint takes a natural-language prompt (and, for edits, the
current HTML) and returns a complete standalone HTML document that the admin
preview and the learner both render inside a sandboxed iframe.
"""
from __future__ import annotations

import json
import logging
import os
import re
from decimal import Decimal
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..config import get_settings
from ..core.security import get_current_user
from ..db import db_dependency
from ..models.ai_token_usage import RequestType
from ..services.ai_billing import preflight_tool_credits, record_tool_billing

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/html-doc", tags=["html-document"])

# Creative HTML/CSS/JS is best on a strong frontend-capable model. Dedicated to
# this endpoint (NOT the shared llm_default_model); override via HTML_DOCUMENT_MODEL.
_DEFAULT_MODEL = "anthropic/claude-sonnet-5"
# HTML documents can be long (inline CSS + markup + a little JS).
_MAX_TOKENS = 32000
# Usage is charged as max(flat, actual_token_cost × markup). The markup deters
# misuse (very large PDFs / huge pages) — heavy generations pay above raw cost.
_USAGE_MARKUP = Decimal("2")

_FENCE_RE = re.compile(r"^\s*```(?:html)?\s*\n([\s\S]*?)\n?```\s*$")
_DOC_START_RE = re.compile(r"<!doctype html|<html", re.IGNORECASE)


# Content elements the admin can ask the page to include → concrete directives.
_CONTENT_TYPE_SPECS = {
    "notes": "STRUCTURED NOTES: clear teaching notes with headings, short explanations, concrete examples, and a 'Key Takeaways' summary.",
    "flashcards": "FLASHCARDS: an INTERACTIVE flashcard deck — cards the learner clicks/taps to flip (question → answer), built with inline JS/CSS (a 3D flip). Include the handful of most important cards.",
    "practical_examples": "PRACTICAL EXAMPLES: worked, real-world examples/applications showing the concept in action, step by step.",
    "interactive_games": "INTERACTIVE GAME: a small self-contained learning game (e.g. drag-and-drop matching, click-to-reveal, memory, or a timed challenge) in inline JS — track state and give feedback. Make it genuinely playable.",
    "quiz": "QUIZ: an INTERACTIVE multiple-choice quiz — the learner selects answers and gets instant feedback + a score (inline JS). 3-6 questions, each with a short explanation.",
    "assignment": "ASSIGNMENT: a clearly-scoped task section — objective, step-by-step instructions, the deliverable, and a simple rubric / success criteria (static content).",
}
# PDF grounding text is truncated so the prompt stays within budget.
_MAX_GROUNDING_CHARS = 12000


class BrandKit(BaseModel):
    primary_color: Optional[str] = Field(None, description="Institute accent color (hex).")
    logo_url: Optional[str] = Field(None, description="Institute logo URL to embed.")
    name: Optional[str] = Field(None, description="Institute name.")


class GenerateHtmlRequest(BaseModel):
    prompt: str = Field("", description="What the document should be / how to change it.")
    brand: Optional[BrandKit] = Field(None, description="Institute brand kit — inject for a consistent look.")
    current_html: Optional[str] = Field(
        None,
        description="Existing HTML — when present this is an EDIT: apply the prompt to this document.",
    )
    content_types: Optional[list[str]] = Field(
        None,
        description="Sections to include, in order: notes, flashcards, practical_examples, interactive_games, quiz, assignment.",
    )
    key_points: Optional[list[str]] = Field(None, description="Optional key points/topics the page MUST cover.")
    image_urls: Optional[list[str]] = Field(None, description="Uploaded image URLs to embed where relevant.")
    reference_file_ids: Optional[list[str]] = Field(
        None, description="Uploaded PDF file ids — grounded via MathPix (real text + figures reused)."
    )
    institute_id: Optional[str] = Field(None, description="Institute to charge (academy-credits).")
    user_id: Optional[str] = Field(None, description="Deprecated for attribution; actor comes from the JWT.")
    idempotency_key: Optional[str] = Field(None, description="Dedup key so a retry can't double-charge.")


class GenerateHtmlResponse(BaseModel):
    html: str
    model: str


def _role_from_user(user) -> str:
    if user is None:
        return "ADMIN"
    raw = getattr(user, "roles", None) or getattr(user, "authorities", None)
    if raw is None and isinstance(user, dict):
        raw = user.get("roles") or user.get("authorities")
    roles = {str(r).upper() for r in (raw or [])}
    if any("ADMIN" in r for r in roles):
        return "ADMIN"
    if any("TEACHER" in r for r in roles):
        return "TEACHER"
    return "ADMIN"


_SYSTEM_DIRECTIVE = (
    "You are a world-class front-end designer AND an instructional designer. "
    "You produce ONE complete, self-contained, visually striking HTML document "
    "for a learning platform — a mini web page that teaches its topic.\n\n"
    "HARD RULES:\n"
    "1. Output a SINGLE full HTML document: `<!DOCTYPE html>` … `<html>` … "
    "`<head>` with ALL CSS in one inline `<style>` … `<body>`. Nothing before or after.\n"
    "2. Everything is inline/self-contained: inline `<style>`, and any JS in an "
    "inline `<script>` at the end of `<body>`. No build step, no imports of local files.\n"
    "3. You MAY use tasteful motion — CSS `@keyframes`/transitions and small vanilla "
    "JS (counters, interactive diagrams, canvas/SVG). CRITICAL: the page is shown at its "
    "FULL height with NO internal scrolling (the parent app scrolls), so NEVER hide content "
    "behind scroll-triggered reveals — an IntersectionObserver or scroll listener that starts "
    "sections at opacity:0 and reveals them on scroll will leave them INVISIBLE here. All "
    "content must be visible on load; entrance animations must play automatically on load, not "
    "on scroll. Keep motion smooth and honor `prefers-reduced-motion`.\n"
    "4. Responsive (mobile → desktop), accessible (semantic tags, alt text, adequate "
    "contrast — dark text on light surfaces by default), and readable.\n"
    "5. Real, substantive content about the TOPIC — no lorem ipsum, no placeholder text. "
    "Use headings, sections, tables, callouts, diagrams as the content warrants.\n"
    "6. External resources: you MAY use Google Fonts via `<link>` and reputable CDN "
    "libraries via `<script src>` if they genuinely help (e.g. a charting or diagram lib). "
    "Never reference private/local URLs, analytics, or trackers. Prefer inline SVG for diagrams.\n"
    "7. The page renders inside a sandboxed iframe with a unique origin — do NOT rely on "
    "cookies, localStorage, or access to any parent window.\n"
    "8. RESULT REPORTING (do this whenever the page has a quiz, game, or any graded/"
    "completable activity): report the learner's outcome to the host so the platform records "
    "it. Using `window.parent.postMessage(msg, '*')`, send:\n"
    "   • progress as the learner advances: `{type:'vacademy:progress', percent:<0-100>}`\n"
    "   • exactly once when they finish (submit the quiz / win the game / complete the task): "
    "`{type:'vacademy:complete', score:<number>, maxScore:<number>, wrong:<number of wrong answers>, "
    "timesSec:[<seconds taken per question>]}`\n"
    "   Omit fields you don't have. It's a harmless no-op in preview — never wait for a response.\n"
    "9. Return ONLY the raw HTML. No markdown, no ``` fences, no commentary."
)


def _content_types_block(content_types: Optional[list[str]]) -> str:
    if not content_types:
        return ""
    specs = [
        f"  {i}. {_CONTENT_TYPE_SPECS[t]}"
        for i, t in enumerate((ct for ct in content_types if ct in _CONTENT_TYPE_SPECS), start=1)
    ]
    if not specs:
        return ""
    return (
        "\n\n**Include these sections, in this order** (design them into one cohesive page, "
        "not disconnected blocks — interactive parts use inline JS and must actually work):\n"
        + "\n".join(specs)
    )


def _key_points_block(key_points: Optional[list[str]]) -> str:
    pts = [p.strip() for p in (key_points or []) if p and p.strip()]
    if not pts:
        return ""
    return "\n\n**Must cover these points**:\n" + "\n".join(f"  - {p}" for p in pts)


def _images_block(image_urls: Optional[list[str]]) -> str:
    urls = [u.strip() for u in (image_urls or []) if u and u.strip()]
    if not urls:
        return ""
    listing = "\n".join(f"  - {u}" for u in urls)
    return (
        "\n\n**Uploaded images (embed the relevant ones VERBATIM using their exact URL)** — "
        "place them where they support the content, sized/styled via your CSS; never alter a URL:\n"
        + listing
    )


def _grounding_block(grounding_text: str, figures) -> str:
    block = ""
    if grounding_text and grounding_text.strip():
        text = grounding_text[:_MAX_GROUNDING_CHARS]
        truncated = " (truncated)" if len(grounding_text) > len(text) else ""
        block += (
            "\n\n**Source document (ground the content in this REAL material"
            f"{truncated}; be accurate to it, don't invent facts that contradict it)**:\n"
            f"{text}"
        )
    fig_lines = [
        f"  - {getattr(f, 'url', '')}"
        + (f" — {getattr(f, 'caption', '')}" if getattr(f, "caption", "") else "")
        for f in (figures or [])
        if getattr(f, "url", "")
    ]
    if fig_lines:
        block += (
            "\n\n**Real figures from the source document (PREFER these over generated images; "
            "embed the relevant ones VERBATIM by their exact URL)**:\n" + "\n".join(fig_lines)
        )
    return block


def _brand_block(brand: Optional[BrandKit]) -> str:
    if not brand:
        return ""
    lines = []
    if brand.primary_color and brand.primary_color.strip():
        lines.append(
            f"  - Primary/accent color: {brand.primary_color.strip()} — build a cohesive palette "
            "AROUND it (tints & shades for surfaces, accents, buttons, highlights). Use it "
            "prominently and consistently; keep text contrast accessible."
        )
    if brand.logo_url and brand.logo_url.strip():
        lines.append(
            f"  - Logo: embed `<img src=\"{brand.logo_url.strip()}\" alt=\"logo\">` (exact URL, verbatim) "
            "small and tasteful in the header/hero area."
        )
    if brand.name and brand.name.strip():
        lines.append(f"  - This page represents **{brand.name.strip()}** — keep the tone on-brand.")
    if not lines:
        return ""
    return (
        "\n\n**Brand identity (make the page visually match this institute's brand)**:\n"
        + "\n".join(lines)
    )


def _build_prompt(req: GenerateHtmlRequest, grounding_text: str = "", figures=None) -> str:
    materials = (
        _brand_block(req.brand)
        + _content_types_block(req.content_types)
        + _key_points_block(req.key_points)
        + _images_block(req.image_urls)
        + _grounding_block(grounding_text, figures)
    )
    instruction = req.prompt.strip() or (
        "Create a rich learning page covering the material and sections described below."
    )
    if req.current_html:
        return (
            f"{_SYSTEM_DIRECTIVE}\n\n"
            "TASK: EDIT the existing document below according to the instruction. "
            "Preserve everything that isn't part of the change; return the FULL updated document.\n\n"
            f"INSTRUCTION:\n{instruction}"
            f"{materials}\n\n"
            "CURRENT DOCUMENT:\n"
            f"{req.current_html}"
        )
    return (
        f"{_SYSTEM_DIRECTIVE}\n\n"
        "TASK: CREATE a new learning page.\n"
        f"REQUEST: {instruction}"
        f"{materials}"
    )


def _strip_fence(text: str) -> str:
    if not text:
        return text
    m = _FENCE_RE.match(text.strip())
    if m:
        return m.group(1).strip()
    # If the model prefixed prose, snap to the first real document start.
    start = _DOC_START_RE.search(text)
    return text[start.start():].strip() if start else text.strip()


async def _call_openrouter(prompt: str, api_key: str, base_url: str, model: str) -> tuple[str, dict]:
    async with httpx.AsyncClient(timeout=180.0) as client:
        resp = await client.post(
            base_url,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.7,
                "max_tokens": _MAX_TOKENS,
            },
        )
    if resp.status_code != 200:
        raise httpx.HTTPStatusError(
            f"OpenRouter {resp.status_code}: {resp.text[:500]}",
            request=resp.request,
            response=resp,
        )
    data = resp.json()
    choices = data.get("choices") or []
    if not choices:
        raise RuntimeError(f"OpenRouter returned no choices: {str(data)[:300]}")
    content = (choices[0].get("message") or {}).get("content") or ""
    if not content.strip():
        raise RuntimeError(f"OpenRouter returned empty content: {str(data)[:300]}")
    return content, (data.get("usage") or {})


async def _prepare(body: GenerateHtmlRequest, current_user, db: Session) -> dict:
    """Auth + validation + preflight credit gate + PDF grounding, then build the
    prompt. Raises HTTPException (401/400/402/503) BEFORE any streaming starts.
    Returns everything both the JSON and streaming endpoints need."""
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")

    actor_user_id = getattr(current_user, "user_id", None)
    if actor_user_id is None and isinstance(current_user, dict):
        actor_user_id = current_user.get("user_id")
    token_institute = getattr(current_user, "institute_id", None)
    if token_institute is None and isinstance(current_user, dict):
        token_institute = current_user.get("institute_id")
    institute_id = token_institute or body.institute_id
    actor_role = _role_from_user(current_user)

    settings = get_settings()
    openrouter_key: Optional[str] = getattr(settings, "openrouter_api_key", None)
    openrouter_url: str = getattr(
        settings, "llm_base_url", "https://openrouter.ai/api/v1/chat/completions"
    )
    model = os.getenv("HTML_DOCUMENT_MODEL") or _DEFAULT_MODEL
    if not openrouter_key:
        raise HTTPException(status_code=503, detail="No LLM provider configured. Set OPENROUTER_API_KEY.")

    has_input = bool(
        body.prompt.strip()
        or body.content_types
        or body.key_points
        or body.reference_file_ids
        or body.current_html
    )
    if not has_input:
        raise HTTPException(
            status_code=400,
            detail="Provide a prompt, select content sections, add key points, or attach a PDF.",
        )

    # Create vs edit are priced differently (a full create costs more than a
    # conversational edit that reuses the existing page).
    tool_key = "html_document_edit" if body.current_html else "html_document"

    # Pre-flight credit gate (academy-credits) — flat per generation. Only gates
    # when an institute is resolved; the charge is recorded after success.
    if institute_id:
        estimate = preflight_tool_credits(
            db, tool_key=tool_key, tool_params={}, institute_id=institute_id
        )
        if estimate.get("sufficient") is False:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=(
                    f"Insufficient credits: generating this page needs ~{estimate['estimated_credits']} "
                    f"credits but the balance is {estimate.get('current_balance')}."
                ),
            )

    # Ground in an uploaded PDF (real text + reusable figures) — reuses the same
    # MathPix ingestion the course flow uses. Bounded so a slow/failed
    # conversion never hangs; generation proceeds without it.
    grounding_text, figures, pdf_page_count = "", [], 0
    if body.reference_file_ids:
        try:
            from ..services.course_document_ingest import ingest_documents
            import asyncio

            ingest = await asyncio.wait_for(
                ingest_documents(body.reference_file_ids, rehost_figures=True), timeout=150
            )
            grounding_text, figures = ingest.grounding_text, ingest.figures
            # Per-page surcharge is billed on CREATE only — an edit re-grounding
            # the same PDF must not re-charge for its pages.
            if not body.current_html:
                pdf_page_count = ingest.page_count
        except Exception as e:  # noqa: BLE001
            logger.warning("[html-doc] PDF ingest skipped: %s", e)

    return {
        "prompt": _build_prompt(body, grounding_text, figures),
        "model": model,
        "openrouter_key": openrouter_key,
        "openrouter_url": openrouter_url,
        "institute_id": institute_id,
        "actor_user_id": actor_user_id,
        "actor_role": actor_role,
        "tool_key": tool_key,
        "pdf_page_count": pdf_page_count,
    }


def _bill(ctx: dict, body: GenerateHtmlRequest, usage: Optional[dict] = None) -> None:
    """Charge credits = max(flat, actual_token_cost × 2× markup), best-effort —
    the doc is already generated; a billing hiccup must never fail the request.
    Usage-based so heavy generations (big PDFs / large pages) pay above the flat
    floor. Idempotency key dedups retries."""
    usage = usage or {}
    try:
        record_tool_billing(
            tool_key=ctx["tool_key"],
            tool_params={"is_edit": bool(body.current_html)},
            request_type=RequestType.CONTENT,
            model=ctx["model"],
            prompt_tokens=int(usage.get("prompt_tokens") or 0),
            completion_tokens=int(usage.get("completion_tokens") or 0),
            institute_id=ctx["institute_id"],
            user_id=ctx["actor_user_id"],
            user_role=ctx["actor_role"] if ctx["actor_user_id"] else None,
            idempotency_key=body.idempotency_key,
            usage_markup=_USAGE_MARKUP,
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("[html-doc] billing skipped: %s", e)

    # Separate, transparent per-page surcharge for the grounding PDF (MathPix
    # conversion cost). Billed on create only (see _prepare).
    pages = int(ctx.get("pdf_page_count") or 0)
    if pages > 0:
        try:
            record_tool_billing(
                tool_key="html_document_pdf",
                tool_params={"num_pages": pages},
                request_type=RequestType.CONTENT,
                model=ctx["model"],
                institute_id=ctx["institute_id"],
                user_id=ctx["actor_user_id"],
                user_role=ctx["actor_role"] if ctx["actor_user_id"] else None,
                idempotency_key=(f"{body.idempotency_key}:pdf" if body.idempotency_key else None),
            )
        except Exception as e:  # noqa: BLE001
            logger.warning("[html-doc] pdf page billing skipped: %s", e)


@router.post("/v1/generate", response_model=GenerateHtmlResponse)
async def generate_html_document(
    body: GenerateHtmlRequest,
    db: Session = Depends(db_dependency),
    current_user=Depends(get_current_user),
) -> GenerateHtmlResponse:
    ctx = await _prepare(body, current_user, db)
    try:
        raw, usage = await _call_openrouter(
            ctx["prompt"], ctx["openrouter_key"], ctx["openrouter_url"], ctx["model"]
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("[html-doc] generation failed: %s", e)
        raise HTTPException(status_code=502, detail=f"HTML generation failed: {e}")

    html_out = _strip_fence(raw)
    if not html_out:
        raise HTTPException(status_code=502, detail="Model returned empty HTML.")
    _bill(ctx, body, usage)
    return GenerateHtmlResponse(html=html_out, model=ctx["model"])


def _sse(obj: dict) -> str:
    return f"data: {json.dumps(obj)}\n\n"


@router.post("/v1/generate/stream")
async def generate_html_document_stream(
    body: GenerateHtmlRequest,
    db: Session = Depends(db_dependency),
    current_user=Depends(get_current_user),
):
    """Server-Sent Events variant: streams the HTML as it is generated so the
    author watches the page build live (and can cancel by dropping the request).
    Auth / validation / preflight all run first so those surface as normal HTTP
    errors before the stream opens. Events: {delta}, {done, html, model}, {error}."""
    ctx = await _prepare(body, current_user, db)

    async def event_gen():
        collected: list[str] = []
        usage: dict = {}
        try:
            payload = {
                "model": ctx["model"],
                "messages": [{"role": "user", "content": ctx["prompt"]}],
                "temperature": 0.7,
                "max_tokens": _MAX_TOKENS,
                "stream": True,
                # Ask OpenRouter to emit a final usage chunk so we can bill on
                # actual tokens (× markup), not just the flat floor.
                "stream_options": {"include_usage": True},
            }
            headers = {
                "Authorization": f"Bearer {ctx['openrouter_key']}",
                "Content-Type": "application/json",
            }
            async with httpx.AsyncClient(timeout=180.0) as client:
                async with client.stream(
                    "POST", ctx["openrouter_url"], headers=headers, json=payload
                ) as resp:
                    if resp.status_code != 200:
                        detail = (await resp.aread()).decode(errors="ignore")[:300]
                        yield _sse({"error": f"OpenRouter {resp.status_code}: {detail}"})
                        return
                    async for line in resp.aiter_lines():
                        if not line or not line.startswith("data:"):
                            continue
                        chunk_str = line[len("data:"):].strip()
                        if chunk_str == "[DONE]":
                            break
                        try:
                            chunk = json.loads(chunk_str)
                        except Exception:  # noqa: BLE001
                            continue
                        if chunk.get("usage"):
                            usage = chunk["usage"]
                        choices = chunk.get("choices") or []
                        delta = (choices[0].get("delta") or {}).get("content") if choices else None
                        if delta:
                            collected.append(delta)
                            yield _sse({"delta": delta})

            html_out = _strip_fence("".join(collected))
            if not html_out:
                yield _sse({"error": "Model returned empty HTML."})
                return
            _bill(ctx, body, usage)
            yield _sse({"done": True, "html": html_out, "model": ctx["model"]})
        except Exception as e:  # noqa: BLE001
            logger.warning("[html-doc] stream failed: %s", e)
            yield _sse({"error": f"HTML generation failed: {e}"})

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
