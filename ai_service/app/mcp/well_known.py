"""
OAuth discovery documents, served from the ROOT of the host.

An MCP client that gets a 401 from ``/ai-service/mcp`` follows this trail:

    GET /.well-known/oauth-protected-resource/ai-service/mcp   (RFC 9728)
        -> names the authorization server
    GET /.well-known/oauth-authorization-server/ai-service/mcp (RFC 8414)
        -> names /authorize, /token, /register

Both live at the root of the domain by spec (the resource path is appended to
the well-known prefix, not the other way round), which is why the ingress needs
a ``/.well-known`` route pointing at this service.

The SDK builds the documents; this module only places them at the paths the spec
requires, plus the bare ``/.well-known/oauth-authorization-server`` that older
clients probe.
"""
from __future__ import annotations

import logging
from typing import List

from mcp.server.auth.handlers.metadata import MetadataHandler
from mcp.server.auth.routes import (
    build_metadata,
    cors_middleware,
    create_protected_resource_routes,
)
from mcp.server.auth.settings import ClientRegistrationOptions, RevocationOptions
from pydantic import AnyHttpUrl
from starlette.routing import Route

from ..config import Settings
from .constants import MCP_SCOPE_READ

logger = logging.getLogger(__name__)


def build_discovery_routes(settings: Settings) -> List[Route]:
    """Protected-resource + authorization-server metadata routes."""
    issuer = AnyHttpUrl(settings.mcp_issuer_url)

    routes: List[Route] = list(
        create_protected_resource_routes(
            resource_url=issuer,
            authorization_servers=[issuer],
            scopes_supported=[MCP_SCOPE_READ],
            resource_name="Vacademy",
        )
    )

    metadata = build_metadata(
        issuer_url=issuer,
        service_documentation_url=None,
        client_registration_options=ClientRegistrationOptions(
            enabled=True,
            valid_scopes=[MCP_SCOPE_READ],
            default_scopes=[MCP_SCOPE_READ],
        ),
        revocation_options=RevocationOptions(enabled=True),
    )
    handler = cors_middleware(MetadataHandler(metadata).handle, ["GET", "OPTIONS"])

    # RFC 8414 §3.1 puts the issuer's path AFTER the well-known segment. The bare
    # path is kept as a fallback for clients that probe the origin instead.
    issuer_path = (issuer.path or "").rstrip("/")
    for path in {f"/.well-known/oauth-authorization-server{issuer_path}",
                 "/.well-known/oauth-authorization-server"}:
        routes.append(Route(path, endpoint=handler, methods=["GET", "OPTIONS"]))

    logger.info("MCP discovery routes: %s", [r.path for r in routes])
    return routes


__all__ = ["build_discovery_routes"]
