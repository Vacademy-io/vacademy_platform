"""Client for resolving media_service file IDs to URLs.

media_service permanently owns file storage (S3). Migrated file-dependent
features (lecture feedback, question-from-pdf/audio/image) upload via the
existing FE flow → a media fileId, then ask media_service for a presigned URL
to hand to the transcription / MathPix pipelines.

Endpoint: GET /media-service/internal/get-url/id?fileId=&expiryDays= → URL (plain
string body). media_service gates every URI containing "internal" with
InternalAuthFilter, which requires the same client-auth headers the Java callers
send via InternalClientUtils.makeHmacRequest: clientName = settings.client_name
(registered as an internal client in media_service), Signature = the client's
secret. Without them the call bounces back as a 401. Same scheme as
assessment_client._internal_headers().
"""
from __future__ import annotations

import logging
from typing import Dict, Optional

import httpx

from ..config import get_settings

logger = logging.getLogger(__name__)

DEFAULT_EXPIRY_DAYS = 7


def _internal_headers() -> Dict[str, str]:
    settings = get_settings()
    if not settings.client_secret:
        # Fail with a clear, actionable message instead of letting the call hit
        # media_service and bounce back as an opaque 401.
        raise RuntimeError(
            "CLIENT_SECRET is not configured — ai_service cannot make the "
            "internal client-auth call to media_service. Set CLIENT_SECRET (the "
            "secret registered for client_name='%s') to resolve media file IDs."
            % settings.client_name
        )
    return {
        "clientName": settings.client_name,
        "Signature": settings.client_secret,
    }


async def get_file_url(file_id: str, expiry_days: int = DEFAULT_EXPIRY_DAYS) -> str:
    """Resolve a media fileId to a presigned URL. Raises RuntimeError on failure."""
    settings = get_settings()
    base = settings.media_server_base_url.rstrip("/")
    url = f"{base}/media-service/internal/get-url/id"
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                url,
                params={"fileId": file_id, "expiryDays": expiry_days},
                headers=_internal_headers(),
            )
            resp.raise_for_status()
            file_url: Optional[str] = resp.text
            if not file_url:
                raise RuntimeError(f"Empty URL for fileId={file_id}")
            return file_url.strip().strip('"')
    except httpx.HTTPError as exc:
        raise RuntimeError(f"Failed to resolve fileId={file_id} via media_service: {exc}") from exc
