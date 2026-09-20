"""Tell staff something finished — the dashboard bell (SYSTEM_ALERT).

notification_service's unified send endpoint under `/internal/` takes the same
clientName + Signature headers every Spring service uses, which
`internal_auth_headers()` already resolves for ai_service. The payload mirrors
assessment_service's `NotificationService.sendSystemAlertToUsers` so the alert
looks like every other one in the bell.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Iterable, Optional

import httpx

from ..config import get_settings
from .internal_auth import internal_auth_headers

logger = logging.getLogger(__name__)

_UNIFIED_SEND = "/notification-service/internal/v1/send"


async def system_alert(
    institute_id: str,
    user_ids: Iterable[str],
    title: str,
    body: str,
    *,
    source: str = "AI_PAPER_DIGITISE",
    source_id: Optional[str] = None,
    data: Optional[Dict[str, str]] = None,
) -> bool:
    """One bell entry per user. Best-effort: False (and a log line) on any failure."""
    recipients = [{"userId": uid} for uid in dict.fromkeys(u for u in user_ids if u)]
    if not recipients:
        return False
    options: Dict[str, Any] = {"pushTitle": title, "pushBody": body, "source": source, "sourceId": source_id}
    if data:
        options["pushData"] = data
    payload = {
        "instituteId": institute_id or "",
        "channel": "SYSTEM_ALERT",
        "recipients": recipients,
        "options": options,
    }
    url = f"{get_settings().notification_service_base_url}{_UNIFIED_SEND}"
    try:
        headers = await internal_auth_headers({"Content-Type": "application/json"})
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
        if resp.status_code >= 300:
            logger.warning("system_alert -> %s: %s", resp.status_code, resp.text[:200])
            return False
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("system_alert failed: %s", exc)
        return False
