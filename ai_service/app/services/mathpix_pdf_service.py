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


async def is_completed(pdf_id: str) -> bool:
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(f"{_API_CONVERTER}{pdf_id}", headers=_headers())
        if resp.status_code != 200:
            return False
        return (resp.json().get("status") or "").lower() == "completed"


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
