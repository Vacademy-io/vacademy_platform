"""Client for resolving media_service file IDs to URLs.

media_service permanently owns file storage (S3). Migrated file-dependent
features (lecture feedback, question-from-pdf/audio/image) upload via the
existing FE flow → a media fileId, then ask media_service for a presigned URL
to hand to the transcription / MathPix pipelines.

Endpoint: GET /media-service/internal/get-url/id?fileId=&expiryDays= → URL (plain
string body). media_service gates every URI containing "internal" with
InternalAuthFilter, which requires the same client-auth headers the Java callers
send via InternalClientUtils.makeHmacRequest: clientName + Signature. We resolve
those via internal_auth.internal_auth_headers() — which reuses the trusted
admin_core_service credentials from the shared DB. Without them the call bounces
back as a 401.
"""
from __future__ import annotations

import logging
from typing import Optional

import httpx

from ..config import get_settings
from .internal_auth import internal_auth_headers

logger = logging.getLogger(__name__)

DEFAULT_EXPIRY_DAYS = 7


async def _resolve(path: str, file_id: str, expiry_days: int) -> str:
    settings = get_settings()
    base = settings.media_server_base_url.rstrip("/")
    url = f"{base}{path}"
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                url,
                params={"fileId": file_id, "expiryDays": expiry_days},
                headers=await internal_auth_headers(),
            )
            resp.raise_for_status()
            file_url: Optional[str] = resp.text
            if not file_url:
                raise RuntimeError(f"Empty URL for fileId={file_id}")
            return file_url.strip().strip('"')
    except httpx.HTTPError as exc:
        raise RuntimeError(f"Failed to resolve fileId={file_id} via media_service: {exc}") from exc


async def get_file_url(file_id: str, expiry_days: int = DEFAULT_EXPIRY_DAYS) -> str:
    """Resolve a media fileId to a presigned URL (PRIVATE bucket). Raises on failure."""
    return await _resolve("/media-service/internal/get-url/id", file_id, expiry_days)


async def get_public_file_url(file_id: str, expiry_days: int = DEFAULT_EXPIRY_DAYS) -> str:
    """Resolve a media fileId to a downloadable URL for a file in the PUBLIC bucket.

    Call recordings are uploaded via media_service uploadFileV2 → the PUBLIC bucket
    (same as the lead-profile "Play recording" playback, which resolves them through
    this route). The private get-url/id route 404s for those files, which is why a
    transcription job handed a private URL fails with "HTTP Error 404: Not Found".
    """
    return await _resolve("/media-service/internal/public-url", file_id, expiry_days)
