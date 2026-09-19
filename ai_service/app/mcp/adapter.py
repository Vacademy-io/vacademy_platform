"""
Bridge between the Vacademy Assistant tool registry and MCP.

The registry is the single source of truth for what a tool is and does — schema,
executor, settings group. This module only:

  * narrows the registry to ``MCP_EXPOSED_TOOLS`` (Phase 1: one tool), so a tool
    becoming available to the Assistant does not silently appear over MCP;
  * translates an OpenAI function-calling schema into an MCP ``Tool``;
  * runs calls through the registry's own ``execute_tool``, which re-checks the
    per-tool gate and overwrites identity arguments with the pinned principal;
  * audits every call.

Per-tool enablement is evaluated against the institute's MCP settings — NOT the
Assistant's — so an institute can expose a tool to its AI clients without
enabling it in the in-product Assistant, and vice versa.
"""
from __future__ import annotations

import json
import logging
import time
from typing import Any, Dict, List, Optional, Tuple

from mcp.types import CallToolResult, ImageContent, TextContent, Tool, ToolAnnotations
from sqlalchemy.orm import Session

from ..schemas.auth import PinnedPrincipal
from ..services.assistant_tool_registry import (
    ASSISTANT_TOOLS,
    ToolContext,
    ToolSpec,
    execute_tool,
    is_tool_allowed,
)
from .access import setting_for_tool_gate
from .constants import MCP_EXPOSED_TOOLS, MCP_TOOL_GROUP_LABELS, MCP_TOOL_GROUP_SUMMARIES
from .repository import McpOAuthRepository

logger = logging.getLogger(__name__)


def exposed_specs() -> List[ToolSpec]:
    """The registry specs this server is willing to surface, in a stable order."""
    specs = []
    for name in MCP_EXPOSED_TOOLS:
        spec = ASSISTANT_TOOLS.get(name)
        if spec is None:
            # A rename in the registry must be loud, not silently narrowing.
            logger.error("MCP_EXPOSED_TOOLS names '%s', which is not in ASSISTANT_TOOLS.", name)
            continue
        specs.append(spec)
    return specs


def tool_catalog() -> List[Dict[str, Any]]:
    """
    The catalogue the settings UI renders toggles from.

    Served from the backend so the dashboard never carries a second copy of the
    tool list that can drift from the registry.
    """
    catalog: List[Dict[str, Any]] = []
    for spec in exposed_specs():
        fn = spec.schema.get("function", {})
        key = spec.key()
        description = fn.get("description", "")
        # Action-style tools carry their verbs in an `action` enum; surface them
        # so an admin can see what a toggle actually allows.
        action_prop = ((fn.get("parameters") or {}).get("properties") or {}).get("action") or {}
        actions = [a for a in action_prop.get("enum") or [] if isinstance(a, str)]
        catalog.append(
            {
                "name": spec.name,
                "key": key,
                "label": MCP_TOOL_GROUP_LABELS.get(key, key.replace("_", " ").title()),
                "description": description,
                "summary": MCP_TOOL_GROUP_SUMMARIES.get(key, description),
                "actions": actions,
                "mode": spec.mode,
                # Not a toggle: on for everyone who may connect (identity only).
                "always_on": bool(spec.always_allowed),
            }
        )
    return catalog


def _to_mcp_tool(spec: ToolSpec) -> Tool:
    fn = spec.schema.get("function", {})
    parameters = fn.get("parameters") or {"type": "object", "properties": {}}
    read_only = spec.mode == "READ"
    return Tool(
        name=spec.name,
        description=fn.get("description", ""),
        input_schema=parameters,
        annotations=ToolAnnotations(
            read_only_hint=read_only,
            destructive_hint=not read_only,
            idempotent_hint=read_only,
            # Institute data changes outside this server's control.
            open_world_hint=True,
        ),
    )


def list_tools_for(principal: PinnedPrincipal, mcp_setting: Dict[str, Any]) -> List[Tool]:
    """Exposed tools this caller is entitled to, per the institute's MCP settings."""
    gate_setting = setting_for_tool_gate(mcp_setting, principal)
    return [
        _to_mcp_tool(spec)
        for spec in exposed_specs()
        if is_tool_allowed(spec.name, principal, gate_setting)
    ]


def _summarize(payload: Any) -> Tuple[bool, Optional[str]]:
    """(ok, error_code) for the audit row, from a tool's JSON result."""
    if isinstance(payload, dict) and payload.get("error"):
        return False, str(payload["error"])[:64]
    return True, None


async def call_tool(
    *,
    name: str,
    arguments: Optional[Dict[str, Any]],
    principal: PinnedPrincipal,
    platform_token: Optional[str],
    db: Session,
    mcp_setting: Dict[str, Any],
    repo: Optional[McpOAuthRepository] = None,
    client_id: Optional[str] = None,
    client_name: Optional[str] = None,
) -> CallToolResult:
    """
    Execute one exposed tool and shape the result for MCP.

    Tool failures are returned as ``is_error`` results rather than raised: the
    model can read the message and recover (or tell the user what to enable),
    which a protocol-level error would not allow.
    """
    if name not in MCP_EXPOSED_TOOLS:
        return CallToolResult(
            content=[
                TextContent(
                    type="text",
                    text=json.dumps(
                        {
                            "error": "tool_not_available",
                            "tool": name,
                            "message": "This tool is not available over the Vacademy MCP server.",
                        }
                    ),
                )
            ],
            is_error=True,
        )

    gate_setting = setting_for_tool_gate(mcp_setting, principal)
    ctx = ToolContext(
        db=db,
        principal=principal,
        keys=(),  # embeddings-only; none of the exposed tools need API keys
        bearer_token=platform_token,
    )

    started = time.monotonic()
    raw = await execute_tool(name, arguments or {}, ctx, gate_setting)
    duration_ms = int((time.monotonic() - started) * 1000)

    try:
        payload = json.loads(raw)
    except (ValueError, TypeError):
        payload = {"result": raw}

    ok, error_code = _summarize(payload)

    if repo is not None:
        repo.log_tool_call(
            user_id=principal.user_id,
            institute_id=principal.institute_id,
            client_id=client_id,
            client_name=client_name,
            tool_name=name,
            args=arguments or {},
            ok=ok,
            error_code=error_code,
            duration_ms=duration_ms,
        )

    # A tool may hand back a rendered image (website preview): send it as image
    # content so the model can SEE it, with the rest of the result as text.
    if isinstance(payload, dict) and isinstance(payload.get("image_png_base64"), str):
        image = payload.pop("image_png_base64")
        return CallToolResult(
            content=[
                ImageContent(type="image", data=image, mime_type="image/jpeg"),
                TextContent(type="text", text=json.dumps(payload, ensure_ascii=False, default=str)),
            ],
            is_error=not ok,
        )

    return CallToolResult(
        content=[TextContent(type="text", text=raw)],
        is_error=not ok,
    )


__all__ = ["call_tool", "exposed_specs", "list_tools_for", "tool_catalog"]
