"""Client for assessment_service internal endpoints.

The AI evaluation tool needs the assessment's questions + per-question marking
rubric, which live in assessment_service. media_service fetched them via an
internal HMAC-gated call (InternalClientUtils.makeHmacRequest, which simply
sends `clientName` + `Signature` headers — the secret key for the client). We
reproduce that exact scheme: clientName = settings.client_name (registered as an
internal client in assessment_service), Signature = settings.client_secret.

Endpoint: GET /assessment-service/internal/evaluation-tool/metadata/{assessmentId}
→ AiEvaluationMetadata JSON (camelCase): {assessmentName, assessmentId,
instruction, sections:[{id, name, cutoffMarks, questions:[{reachText:{id,type,
content}, explanationText, questionOrder, markingJson}]}]}.
"""
from __future__ import annotations

import logging
from typing import Any, Dict

import httpx

from ..config import get_settings

logger = logging.getLogger(__name__)

_METADATA_ROUTE = "/assessment-service/internal/evaluation-tool/metadata"


def _internal_headers() -> Dict[str, str]:
    settings = get_settings()
    if not settings.client_secret:
        # Fail with a clear, actionable message instead of letting the call hit
        # assessment_service and bounce back as an opaque 401→502.
        raise RuntimeError(
            "CLIENT_SECRET is not configured — ai_service cannot make the "
            "internal HMAC call to assessment_service. Set CLIENT_SECRET (the "
            "secret registered for client_name='%s') to use the evaluation tool."
            % settings.client_name
        )
    return {
        "clientName": settings.client_name,
        "Signature": settings.client_secret,
        "Content-Type": "application/json",
    }


async def get_evaluation_metadata(assessment_id: str) -> Dict[str, Any]:
    """Fetch AiEvaluationMetadata for an assessment. Returns the parsed dict.
    Raises RuntimeError on failure (caller fails the task)."""
    settings = get_settings()
    base = settings.assessment_service_base_url.rstrip("/")
    url = f"{base}{_METADATA_ROUTE}/{assessment_id}"
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, headers=_internal_headers())
            resp.raise_for_status()
            data = resp.json()
            if not isinstance(data, dict):
                raise RuntimeError(f"Unexpected metadata shape for assessmentId={assessment_id}")
            return data
    except httpx.HTTPError as exc:
        raise RuntimeError(
            f"Failed to fetch evaluation metadata for assessmentId={assessment_id}: {exc}"
        ) from exc
