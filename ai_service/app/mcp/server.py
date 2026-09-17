"""
The MCP server itself: protocol handlers plus the ASGI app that is mounted into
the existing FastAPI application.

Every ``tools/list`` and ``tools/call`` re-derives the whole authorization chain
from scratch:

    MCP access token  → grant row (user + institute + stored platform token)
                      → PinnedPrincipal (re-verified against auth_service)
                      → institute MCP settings  → may this principal connect?
                      → per-tool gate           → may it use THIS tool?

Nothing is cached on the token, so disabling the server, removing a role, or
untoggling a tool takes effect on the caller's very next request.

Stateless HTTP: the service runs multiple replicas behind an ingress with no
session affinity, so each request must stand alone.
"""
from __future__ import annotations

import logging
from typing import Optional, Tuple

from fastapi import HTTPException, status
from mcp.server.auth.middleware.auth_context import get_access_token
from mcp.server.auth.settings import AuthSettings, ClientRegistrationOptions, RevocationOptions
from mcp.server.lowlevel.server import Server
from mcp.server.transport_security import TransportSecuritySettings
from mcp.types import (
    CallToolRequestParams,
    CallToolResult,
    ListToolsResult,
    PaginatedRequestParams,
    TextContent,
)
from pydantic import AnyHttpUrl
from sqlalchemy.orm import Session
from starlette.applications import Starlette

from ..config import Settings
from ..db import db_session
from ..schemas.auth import PinnedPrincipal
from . import adapter
from .access import check_mcp_access, load_mcp_setting
from .constants import DENIAL_MESSAGES, MCP_SCOPE_READ
from .crypto import TokenCipher
from .oauth_provider import VacademyAccessToken, VacademyOAuthProvider
from .principal import build_pinned_principal, refresh_platform_token
from .repository import McpOAuthRepository

logger = logging.getLogger(__name__)

SERVER_NAME = "vacademy"
SERVER_INSTRUCTIONS = (
    "Read-only access to a Vacademy institute's operational data. Every call is "
    "scoped to the institute and staff member who authorized this connection; "
    "institute and user identity are taken from that authorization, never from "
    "tool arguments."
)


class McpAuthError(Exception):
    """A request that must not reach the tool layer."""

    def __init__(self, reason: str, message: str):
        super().__init__(message)
        self.reason = reason
        self.message = message


async def _resolve_platform_token(
    token: VacademyAccessToken,
    repo: McpOAuthRepository,
    settings: Settings,
) -> str:
    """
    A usable platform JWT for this grant, refreshing it if the stored one died.

    Platform access tokens outlive a 1h MCP access token but not a 30-day
    refresh token, so long-lived connections eventually need this.
    """
    if token.platform_access_token:
        return token.platform_access_token

    refreshed = await refresh_platform_token(token.platform_refresh_token, settings)
    if not refreshed:
        raise McpAuthError(
            "session_expired",
            "This connection's Vacademy session has expired. Reconnect the Vacademy "
            "MCP server to sign in again.",
        )
    repo.update_platform_access_token(token.token_hash, refreshed)
    return refreshed


async def _authorize(db: Session, settings: Settings) -> Tuple[PinnedPrincipal, dict, VacademyAccessToken, str]:
    """
    Full per-request authorization. Raises McpAuthError when the caller is out.

    Returns (principal, institute MCP settings, access token, platform JWT).
    """
    token = get_access_token()
    if token is None or not isinstance(token, VacademyAccessToken):
        raise McpAuthError("unauthorized", "This request is not authenticated.")

    repo = McpOAuthRepository(db, TokenCipher(settings.resolve_mcp_encryption_key()))
    platform_token = await _resolve_platform_token(token, repo, settings)

    try:
        principal = await build_pinned_principal(platform_token, token.institute_id, settings)
    except HTTPException as exc:
        # 401 means the stored platform JWT no longer verifies — expected on a
        # long-lived connection, since the platform token and the MCP refresh
        # token have the same 30-day life. Refresh once and retry before giving
        # up, so the user is not asked to reconnect mid-conversation.
        principal = None
        if exc.status_code == status.HTTP_401_UNAUTHORIZED:
            refreshed = await refresh_platform_token(token.platform_refresh_token, settings)
            if refreshed:
                repo.update_platform_access_token(token.token_hash, refreshed)
                platform_token = refreshed
                try:
                    principal = await build_pinned_principal(
                        platform_token, token.institute_id, settings
                    )
                except HTTPException as retry_exc:
                    exc = retry_exc

        if principal is None:
            # Still rejected: either the session is truly gone, or the user lost
            # access to the institute they authorized (403). Both need a re-auth.
            raise McpAuthError(
                "session_invalid",
                f"Vacademy rejected this connection's session ({exc.detail}). Reconnect to continue.",
            )

    setting = load_mcp_setting(db, principal.institute_id)
    denial = check_mcp_access(principal, setting)
    if denial:
        raise McpAuthError(denial, DENIAL_MESSAGES.get(denial, "Access denied."))

    return principal, setting, token, platform_token


async def _on_list_tools(ctx, params: Optional[PaginatedRequestParams]) -> ListToolsResult:
    settings_obj = _settings()
    with db_session() as db:
        try:
            principal, setting, _token, _jwt = await _authorize(db, settings_obj)
        except McpAuthError as exc:
            # An empty catalogue is the honest answer to "what can I do here?"
            # when the answer is nothing; the reason surfaces on the first call.
            logger.info("MCP tools/list denied: %s", exc.reason)
            return ListToolsResult(tools=[])

        return ListToolsResult(tools=adapter.list_tools_for(principal, setting))


async def _on_call_tool(ctx, params: CallToolRequestParams) -> CallToolResult:
    settings_obj = _settings()
    with db_session() as db:
        try:
            principal, setting, token, platform_token = await _authorize(db, settings_obj)
        except McpAuthError as exc:
            return CallToolResult(
                content=[TextContent(type="text", text=exc.message)],
                is_error=True,
            )

        repo = McpOAuthRepository(db, TokenCipher(settings_obj.resolve_mcp_encryption_key()))
        client = repo.get_client(token.client_id)

        return await adapter.call_tool(
            name=params.name,
            arguments=params.arguments,
            principal=principal,
            platform_token=platform_token,
            db=db,
            mcp_setting=setting,
            repo=repo,
            client_id=token.client_id,
            client_name=(client or {}).get("client_name"),
        )


def _settings() -> Settings:
    from ..config import get_settings

    return get_settings()


def build_mcp_server() -> Server:
    return Server(
        SERVER_NAME,
        version="1.0.0",
        title="Vacademy",
        instructions=SERVER_INSTRUCTIONS,
        on_list_tools=_on_list_tools,
        on_call_tool=_on_call_tool,
    )


def build_mcp_asgi_app(settings: Settings, server: Server) -> Starlette:
    """
    The Streamable HTTP app, mounted at ``{api_base_path}/mcp``.

    ``streamable_http_path="/"`` puts the MCP endpoint at the mount root, so the
    OAuth routes land next to it: /authorize, /token, /register, /revoke and
    /.well-known/oauth-authorization-server.
    """
    provider = VacademyOAuthProvider(settings, TokenCipher(settings.resolve_mcp_encryption_key()))
    issuer = AnyHttpUrl(settings.mcp_issuer_url)

    return server.streamable_http_app(
        streamable_http_path="/",
        # Stateless: no server-side session to pin a client to one replica.
        stateless_http=True,
        json_response=True,
        auth=AuthSettings(
            issuer_url=issuer,
            resource_server_url=issuer,
            client_registration_options=ClientRegistrationOptions(
                enabled=True,
                valid_scopes=[MCP_SCOPE_READ],
                default_scopes=[MCP_SCOPE_READ],
            ),
            revocation_options=RevocationOptions(enabled=True),
            required_scopes=[MCP_SCOPE_READ],
            # Tokens carry the resource they were issued for; reject any that
            # were minted for something else (RFC 8707).
            validate_token_resource=True,
        ),
        auth_server_provider=provider,
        token_verifier=provider,
        # We sit behind an ingress that terminates TLS and sets its own Host;
        # DNS-rebinding checks here would reject legitimate traffic.
        transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
    )



class McpExactPathAdapter:
    """
    Serves the mounted MCP app at the mount path itself, with no redirect.

    A Starlette ``Mount("/ai-service/mcp")`` only matches paths that continue
    past the prefix, so a bare ``POST /ai-service/mcp`` matches nothing and the
    router answers 307 → ``/ai-service/mcp/``. That bare URL is exactly what
    users paste into their AI client, and a redirect on every call is at best a
    wasted round trip — at worst a client that does not follow redirects, or
    drops the Authorization header across one, cannot connect at all.

    Registering this next to the mount, as a Route on the exact path, rewrites
    the path to "/" and hands the request straight to the MCP endpoint. The
    trailing-slash form keeps working through the mount, unchanged.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        await self.app({**scope, "path": "/", "raw_path": b"/"}, receive, send)


__all__ = [
    "McpExactPathAdapter",
    "SERVER_NAME",
    "McpAuthError",
    "build_mcp_asgi_app",
    "build_mcp_server",
]
