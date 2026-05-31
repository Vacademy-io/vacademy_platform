"""Client for resolving media_service file IDs to URLs.

media_service permanently owns file storage (S3). Migrated file-dependent
features (lecture feedback, question-from-pdf/audio/image) upload via the
existing FE flow → a media fileId, then ask media_service for a presigned URL
to hand to the transcription / MathPix pipelines.

Endpoint: GET /media-service/internal/get-url/id?fileId=&expiryDays= → URL (plain
string body). It's an internal endpoint (network/gateway gated), no user auth.
"""
from __future__ import annotations

import logging
from typing import Optional

import httpx

from ..config import get_settings

logger = logging.getLogger(__name__)

DEFAULT_EXPIRY_DAYS = 7


async def get_file_url(file_id: str, expiry_days: int = DEFAULT_EXPIRY_DAYS) -> str:
    """Resolve a media fileId to a presigned URL. Raises RuntimeError on failure."""
    settings = get_settings()
    base = settings.media_server_base_url.rstrip("/")
    url = f"{base}/media-service/internal/get-url/id"
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, params={"fileId": file_id, "expiryDays": expiry_days})
            resp.raise_for_status()
            file_url: Optional[str] = resp.text
            if not file_url:
                raise RuntimeError(f"Empty URL for fileId={file_id}")
            return file_url.strip().strip('"')
    except httpx.HTTPError as exc:
        raise RuntimeError(f"Failed to resolve fileId={file_id} via media_service: {exc}") from exc
