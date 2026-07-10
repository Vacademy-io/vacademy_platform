"""Ingest uploaded reference PDFs for AI course creation.

Turns a media fileId into (a) grounding text — so the generated course reflects
the actual document — and (b) a manifest of the document's real figures (S3 URLs
+ captions) — so those figures can be embedded verbatim into slides/videos
instead of being AI-hallucinated.

Reuses the WS7 MathPix pipeline (pdf_questions_service): fileId → MathPix → HTML
with figures already externalized to S3 URLs and tables as HTML. Results are
cached per pdfId in file_conversion, and this module additionally dedupes by the
source fileId so re-ingesting the same upload (outline pass, then content pass)
never pays for a second conversion. Everything is best-effort: a failure returns
an empty result and the course still generates (just without grounding/figures).
"""
from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from uuid import uuid4

import httpx
from bs4 import BeautifulSoup

from ..db import db_session
from ..models.file_conversion import FileConversionRepository
from . import pdf_questions_service
from .s3_service import S3Service

logger = logging.getLogger(__name__)

# Caps keep prompt cost bounded. Outline gets a large budget (whole chapter,
# one call); per-slide generation gets a smaller excerpt (many calls).
MAX_GROUNDING_CHARS_OUTLINE = 60_000
MAX_GROUNDING_CHARS_SLIDE = 12_000
MAX_FIGURES = 40
# Only reuse an in-flight conversion's pdfId if its row is fresh; an older
# INIT row is treated as a dead job and re-submitted (no terminal FAILED status
# is written, so age is the signal).
STALE_INGEST_MINUTES = 30
_REHOST_CONCURRENCY = 4
_CAPTION_RE = re.compile(r"(fig(?:ure)?|table|chart|diagram|graph|plate)\b", re.IGNORECASE)
_EXT_BY_CONTENT_TYPE = {
    "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg",
    "image/gif": "gif", "image/webp": "webp", "image/svg+xml": "svg",
}


@dataclass
class DocumentFigure:
    fig_id: str          # stable id we assign, e.g. "fig1"
    url: str             # real S3 image URL (embeddable verbatim)
    caption: str         # best-effort caption / alt text


@dataclass
class IngestResult:
    grounding_text: str = ""
    figures: List[DocumentFigure] = field(default_factory=list)

    @property
    def has_content(self) -> bool:
        return bool(self.grounding_text.strip() or self.figures)


def _html_to_text(html: str) -> str:
    soup = BeautifulSoup(html or "", "html.parser")
    # Preserve tables in a readable-ish form; drop scripts/styles.
    for tag in soup(["script", "style"]):
        tag.decompose()
    text = soup.get_text(separator="\n")
    # Collapse runs of blank lines.
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def _caption_for(img) -> str:
    """Best-effort caption for a figure: alt attr, else the nearest surrounding
    text that looks like a caption (Figure/Table ...), else empty."""
    alt = (img.get("alt") or "").strip()
    if alt:
        return alt[:200]
    # Walk a few siblings/parents looking for caption-like text.
    candidates = []
    for sib in list(img.next_siblings)[:3] + list(img.previous_siblings)[:3]:
        text = getattr(sib, "get_text", lambda **_: str(sib))(strip=True) if sib else ""
        if text:
            candidates.append(text)
    parent = img.parent
    if parent is not None:
        candidates.append(parent.get_text(" ", strip=True))
    for text in candidates:
        if text and _CAPTION_RE.search(text):
            return text[:200]
    return ""


def _parse_figures(html: str) -> List[DocumentFigure]:
    soup = BeautifulSoup(html or "", "html.parser")
    figures: List[DocumentFigure] = []
    seen: set = set()
    for img in soup.find_all("img"):
        src = (img.get("src") or "").strip()
        # Only real, hostable images (MathPix externalizes figures to https S3
        # URLs). Skip anything still inline/base64 or a relative placeholder.
        if not src.lower().startswith(("http://", "https://")):
            continue
        if src in seen:
            continue
        seen.add(src)
        figures.append(
            DocumentFigure(
                fig_id=f"fig{len(figures) + 1}",
                url=src,
                caption=_caption_for(img),
            )
        )
        if len(figures) >= MAX_FIGURES:
            break
    return figures


async def _rehost_figure(url: str) -> str:
    """Download a source figure and re-host it in our own bucket, so a saved
    slide doesn't rot when the third-party (e.g. MathPix CDN) purges it. Falls
    back to the original URL on any failure (best-effort)."""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.content
        content_type = (resp.headers.get("content-type") or "").split(";")[0].strip().lower()
        ext = _EXT_BY_CONTENT_TYPE.get(content_type)
        if not ext:
            tail = url.rsplit(".", 1)[-1].split("?")[0].lower() if "." in url else ""
            ext = tail if tail in _EXT_BY_CONTENT_TYPE.values() else "jpg"
        key = f"ai-course-docs/figures/{uuid4()}.{ext}"
        return await asyncio.to_thread(
            S3Service().upload_file_content, data, f"figure.{ext}", key, content_type or "image/jpeg"
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Figure re-host failed for %s: %s", url[:80], exc)
        return url


async def _ingest_one(file_id: str) -> Optional[str]:
    """Return the cached/converted HTML for one media fileId, or None.

    Dedupe ladder (cheapest first): reuse a completed conversion → re-poll a
    FRESH in-flight one by its vendor pdfId → submit fresh. This keeps a second
    pass (content step, or a retried outline) from paying for another MathPix
    job, without getting stuck re-polling a long-dead pdfId."""
    if not file_id:
        return None
    try:
        def _lookup() -> tuple:
            with db_session() as db:
                repo = FileConversionRepository(db)
                done = repo.find_success_by_source_file_id(file_id)
                if done:
                    return (done.html_text, None)
                latest = repo.find_latest_by_source_file_id(file_id)
                if latest and latest.vendor_file_id and latest.created_at:
                    created = latest.created_at
                    if created.tzinfo is None:
                        created = created.replace(tzinfo=timezone.utc)
                    if datetime.now(timezone.utc) - created < timedelta(minutes=STALE_INGEST_MINUTES):
                        return (None, latest.vendor_file_id)
                return (None, None)  # no fresh in-flight job → submit fresh

        cached_html, existing_pdf_id = await asyncio.to_thread(_lookup)
        if cached_html:
            return cached_html

        pdf_id = existing_pdf_id or await pdf_questions_service.start_from_file_id(file_id)
        return await pdf_questions_service.fetch_or_convert_html(pdf_id, allow_poll=True)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Course document ingest failed for fileId=%s: %s", file_id, exc)
        return None


async def ingest_documents(
    file_ids: Optional[List[str]], rehost_figures: bool = True
) -> IngestResult:
    """Ingest reference PDFs into grounding text + a figure manifest.

    Best-effort and order-preserving; a per-file failure is skipped. Figure ids
    are assigned globally across all documents so they stay unique in a prompt.

    rehost_figures: download each figure and re-host it in our own bucket so
    saved slides don't rot when the source CDN purges it. The outline pass only
    needs the grounding text, so it passes False to skip this cost.
    """
    result = IngestResult()
    if not file_ids:
        return result

    texts: List[str] = []
    for file_id in file_ids:
        html = await _ingest_one(file_id)
        if not html:
            continue
        texts.append(_html_to_text(html))
        for fig in _parse_figures(html):
            fig.fig_id = f"fig{len(result.figures) + 1}"
            result.figures.append(fig)
            if len(result.figures) >= MAX_FIGURES:
                break

    result.grounding_text = "\n\n---\n\n".join(t for t in texts if t)

    if rehost_figures and result.figures:
        sem = asyncio.Semaphore(_REHOST_CONCURRENCY)

        async def _rehost(fig: DocumentFigure) -> None:
            async with sem:
                fig.url = await _rehost_figure(fig.url)

        await asyncio.gather(*[_rehost(f) for f in result.figures])

    return result


def figures_manifest_text(figures: List[DocumentFigure]) -> str:
    """Compact, prompt-friendly listing of available real figures."""
    if not figures:
        return ""
    lines = [
        f'- id="{f.fig_id}" url="{f.url}"' + (f' — {f.caption}' if f.caption else "")
        for f in figures
    ]
    return "\n".join(lines)


__all__ = [
    "DocumentFigure",
    "IngestResult",
    "ingest_documents",
    "figures_manifest_text",
    "MAX_GROUNDING_CHARS_OUTLINE",
    "MAX_GROUNDING_CHARS_SLIDE",
]
