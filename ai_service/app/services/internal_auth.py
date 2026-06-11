"""Resolve service-to-service auth headers for internal Spring endpoints.

Internal Spring endpoints are gated by `InternalAuthFilter`, which 401s any URI
containing "internal" unless it carries `clientName` + `Signature` headers that
validate against the TARGET service's `client_secret_key` table. The Java
callers (`InternalClientUtils`) send clientName = spring.application.name and
Signature = that client's secret, read from their OWN database.

ai_service connects to the `admin_core_service` database (same DB the Java
services use — that's how credits/billing read & write). That table already
holds the `admin_core_service` secret which the other services trust:
admin_core_service calls media_service successfully with it today. So instead of
provisioning a separate `ai_service` client row in every target DB, we reuse the
`admin_core_service` identity — read its secret from the shared DB and present
it. No env var, no DB write, works on redeploy.

Precedence:
  1. Explicit env (CLIENT_NAME + CLIENT_SECRET) — for deployments that register
     ai_service as its own internal client.
  2. Reuse admin_core_service: read its secret from the shared
     `client_secret_key` table and authenticate as `admin_core_service`.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Dict, Optional, Tuple

from sqlalchemy import text

from ..config import get_settings
from ..db import db_session

logger = logging.getLogger(__name__)

# Internal client identity every Spring service already trusts. ai_service shares
# this service's database, so its secret is readable here.
_SHARED_CLIENT_NAME = "admin_core_service"

# Cache the resolved (clientName, signature) for the process lifetime — the
# secret only changes on a manual rotation, and a redeploy clears the cache.
_cached: Optional[Tuple[str, str]] = None


def _read_secret_from_db(client_name: str) -> Optional[str]:
    """Read a client's secret from the shared client_secret_key table.

    Unqualified table name so it resolves under whatever schema ai_service is
    configured for (matching how admin_core_service's JPA finds the same row).
    """
    with db_session() as session:
        row = session.execute(
            text("SELECT secret_key FROM client_secret_key WHERE client_name = :cn"),
            {"cn": client_name},
        ).first()
    return row[0] if row and row[0] else None


def _resolve() -> Tuple[str, str]:
    global _cached
    if _cached is not None:
        return _cached

    settings = get_settings()

    # 1. Explicit env override — ai_service registered as its own client.
    if settings.client_secret:
        _cached = (settings.client_name, settings.client_secret)
        return _cached

    # 2. Reuse the admin_core_service identity from the shared DB.
    secret = _read_secret_from_db(_SHARED_CLIENT_NAME)
    if secret:
        logger.info(
            "internal_auth: authenticating to internal endpoints as shared "
            "client '%s' (secret read from shared DB)",
            _SHARED_CLIENT_NAME,
        )
        _cached = (_SHARED_CLIENT_NAME, secret)
        return _cached

    raise RuntimeError(
        "No internal client credentials available: CLIENT_SECRET is unset and no "
        "'%s' row exists in client_secret_key (shared admin_core_service DB). "
        "ai_service cannot authenticate to internal Spring endpoints."
        % _SHARED_CLIENT_NAME
    )


async def internal_auth_headers(extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
    """clientName/Signature headers for an internal Spring call.

    The credential resolution (which may hit the DB) runs off the event loop
    since the SQLAlchemy engine is synchronous.
    """
    client_name, signature = await asyncio.to_thread(_resolve)
    headers = {"clientName": client_name, "Signature": signature}
    if extra:
        headers.update(extra)
    return headers
