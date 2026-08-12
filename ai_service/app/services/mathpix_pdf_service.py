"""MathPix PDF→HTML service — port of media_service NewDocConverterService.

Submits a PDF URL to MathPix, polls for completion, fetches the Markdown, and
converts it to HTML (via md_to_html). Used by the migrated PDF question /
chat-with-pdf / evaluation flows.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Optional

import httpx

from ..config import get_settings
from .md_to_html import convert_markdown_to_html

logger = logging.getLogger(__name__)

_API_CONVERTER = "https://api.mathpix.com/v3/converter/"
_API_PDF = "https://api.mathpix.com/v3/pdf/"

# Matches media_service application.properties ai.pdf.max-tries / delay-ms.
_POLL_MAX_TRIES = 20
_POLL_DELAY_SECONDS = 20


def _headers() -> dict:
    s = get_settings()
    return {"app_id": s.mathpix_app_id, "app_key": s.mathpix_app_key}


async def submit(url: str) -> Optional[str]:
    """POST a PDF URL to MathPix; returns the pdf_id."""
    body = {"url": url, "conversion_formats": {"md": True}}
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(_API_PDF, json=body, headers={**_headers(), "Content-Type": "application/json"})
        resp.raise_for_status()
        return resp.json().get("pdf_id")


async def submit_bytes(pdf_bytes: bytes, filename: str = "page.pdf") -> Optional[str]:
    """POST raw PDF bytes to MathPix (multipart); returns the pdf_id.

    Used by knowledge-base ingestion, which OCRs scanned pages ONE AT A TIME so
    every extracted line keeps its real page number. MathPix's markdown output
    for a multi-page PDF carries no page delimiters, so a whole-book submission
    would return one undifferentiated blob — and page attribution is what makes
    citations ("page 214"), the low-confidence review gate, and figure↔page
    matching possible at all.

    This costs nothing extra: MathPix bills per page processed, so N single-page
    jobs and one N-page job are the same price. It trades more HTTP round-trips
    for exact attribution plus per-page failure isolation (one unreadable page no
    longer fails the whole book).

    Avoids the URL path so a private page never needs a public S3 object first.
    """
    files = {"file": (filename, pdf_bytes, "application/pdf")}
    data = {"options_json": '{"conversion_formats": {"md": true}}'}
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(_API_PDF, files=files, data=data, headers=_headers())
        resp.raise_for_status()
        return resp.json().get("pdf_id")


async def poll_for_markdown(
    pdf_id: str,
    max_tries: int = 30,
    delay_seconds: float = 2.0,
) -> Optional[str]:
    """Poll until conversion completes, then return raw Markdown (not HTML).

    Defaults are tuned for SINGLE-PAGE jobs (fast, so poll often) rather than the
    whole-book cadence of poll_for_html (20 × 20s = 400s). Returns None on
    timeout instead of raising, so one slow page degrades to "needs review"
    rather than failing the entire ingest.
    """
    for _ in range(max_tries):
        if await is_completed(pdf_id):
            md = await fetch_markdown(pdf_id)
            if md is not None:
                return md
        await asyncio.sleep(delay_seconds)
    logger.warning("MathPix conversion timed out for pdf_id=%s", pdf_id)
    return None


async def is_completed(pdf_id: str) -> bool:
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(f"{_API_CONVERTER}{pdf_id}", headers=_headers())
        if resp.status_code != 200:
            return False
        return (resp.json().get("status") or "").lower() == "completed"


async def get_num_pages(pdf_id: str) -> Optional[int]:
    """Best-effort page count for a converted PDF (MathPix status → num_pages).
    Used for the per-page billing surcharge. Returns None if unavailable."""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(f"{_API_PDF}{pdf_id}", headers=_headers())
            if resp.status_code != 200:
                return None
            n = resp.json().get("num_pages")
            return int(n) if n is not None else None
    except Exception as e:  # noqa: BLE001
        logger.warning("MathPix num_pages fetch failed for pdf_id=%s: %s", pdf_id, e)
        return None


async def fetch_markdown(pdf_id: str) -> Optional[str]:
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(f"{_API_PDF}{pdf_id}.md", headers=_headers())
        if resp.status_code == 200 and resp.text:
            return resp.text
        return None


async def get_converted_html(pdf_id: str) -> Optional[str]:
    """Fetch the Markdown for a completed pdf_id and convert to HTML."""
    md = await fetch_markdown(pdf_id)
    if md is None:
        return None
    return convert_markdown_to_html(md)


async def poll_for_html(pdf_id: str) -> str:
    """Poll until MathPix conversion completes, then return the HTML.
    Raises RuntimeError on timeout."""
    for attempt in range(_POLL_MAX_TRIES):
        if await is_completed(pdf_id):
            html = await get_converted_html(pdf_id)
            if html:
                return html
        await asyncio.sleep(_POLL_DELAY_SECONDS)
    raise RuntimeError(f"MathPix conversion timed out for pdf_id={pdf_id}")
