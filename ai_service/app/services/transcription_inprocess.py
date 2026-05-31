"""In-process transcription helper for migrated features (lecture feedback,
audio questions).

Wraps the existing TranscriptionService (render-worker client) so migrated flows
running INSIDE ai_service can transcribe an audio/video URL without an
institute-key HTTP round-trip: submit a job, poll to completion, download the
plain-text transcript, and return it with the useful metadata.
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Any, Dict, Optional

import httpx

from ..config import get_settings
from .transcription_service import TranscriptionService

logger = logging.getLogger(__name__)

_POLL_INTERVAL_SECONDS = 15
_POLL_TIMEOUT_SECONDS = 20 * 60  # 20 minutes (lectures can be 1-2h of audio)


@dataclass
class TranscriptResult:
    text: str
    duration_seconds: Optional[float]
    word_count: Optional[int]
    detected_language: Optional[str]
    status: Dict[str, Any]  # full terminal status payload (metadata for prompts)


def _pick_txt_url(status: Dict[str, Any]) -> Optional[str]:
    for key in ("output_urls", "output_urls_source"):
        urls = status.get(key)
        if isinstance(urls, dict) and urls.get("txt"):
            return urls["txt"]
    return None


async def transcribe(
    source_url: str,
    *,
    language: Optional[str] = None,
    model_size: str = "small",
) -> TranscriptResult:
    """Submit `source_url` for transcription, poll to completion, return the
    transcript text + metadata. Raises RuntimeError on failure/timeout/misconfig.
    """
    settings = get_settings()
    if not settings.render_server_url:
        raise RuntimeError("Transcription unavailable: RENDER_SERVER_URL not configured")

    service = TranscriptionService(settings.render_server_url, settings.render_server_key)
    job_id = await asyncio.to_thread(
        service.submit, source_url, language, model_size, True, ["txt", "json"], None, "transcribe"
    )

    waited = 0
    while waited < _POLL_TIMEOUT_SECONDS:
        status = await asyncio.to_thread(service.check_status, job_id)
        state = (status.get("status") or "").lower()
        if state == "completed":
            txt_url = _pick_txt_url(status)
            text = await _download_text(txt_url) if txt_url else ""
            return TranscriptResult(
                text=text,
                duration_seconds=status.get("duration_seconds"),
                word_count=status.get("word_count"),
                detected_language=status.get("detected_language"),
                status=status,
            )
        if state == "failed":
            raise RuntimeError(f"Transcription failed: {status.get('error')}")
        if state == "unknown":
            raise RuntimeError(f"Transcription job {job_id} unknown: {status.get('error')}")
        await asyncio.sleep(_POLL_INTERVAL_SECONDS)
        waited += _POLL_INTERVAL_SECONDS

    raise RuntimeError(f"Transcription timed out after {_POLL_TIMEOUT_SECONDS}s (job {job_id})")


async def _download_text(url: str) -> str:
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.text
