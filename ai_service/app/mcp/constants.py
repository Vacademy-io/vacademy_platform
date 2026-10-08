"""Constants for the Vacademy MCP server."""
from __future__ import annotations

from typing import Dict, Tuple

#: Institute-settings key holding the MCP server configuration. Written by the
#: admin dashboard through the generic settings endpoint, read here.
#:
#: Payload shape (deliberately the SAME shape the Assistant tool gate consumes,
#: so ``is_tool_allowed``/``execute_tool`` can be reused verbatim):
#:
#:     {
#:       "enabled": false,
#:       "allowed_roles": ["ADMIN"],
#:       "enabled_tools": ["institute_overview"],
#:       "role_overrides": {"TEACHER": {"enabled_tools": ["institute_overview"]}}
#:     }
MCP_SERVER_SETTING_KEY = "MCP_SERVER_SETTING"

#: Deep link the denial messages point admins at.
MCP_SETTINGS_PATH = "/settings?selectedTab=mcpServer"

#: The ONLY registry tools this server exposes. Phase 1 ships one general,
#: read-only, institute-scoped tool. Everything else in ASSISTANT_TOOLS stays
#: invisible and uncallable over MCP regardless of any institute setting.
MCP_EXPOSED_TOOLS: Tuple[str, ...] = ("get_institute_overview",)

#: Friendly labels for the settings groups the exposed tools belong to. Serves
#: the settings UI so the FE never hardcodes a catalogue that can drift.
MCP_TOOL_GROUP_LABELS: Dict[str, str] = {
    "institute_overview": "Institute stats",
}

#: Roles that must NEVER reach this server, even if an admin lists them. The MCP
#: surface is staff-only by product decision.
LEARNER_ROLES = frozenset({"STUDENT", "LEARNER", "PARENT"})

#: Roles offered by default when an institute first enables the server.
DEFAULT_ALLOWED_ROLES = ("ADMIN",)

#: The single OAuth scope this resource server understands.
MCP_SCOPE_READ = "vacademy.read"

#: Denial reasons surfaced to clients (and rendered by the consent page).
DENY_DISABLED = "mcp_disabled"
DENY_LEARNER = "learner_not_allowed"
DENY_ROLE = "role_not_allowed"

DENIAL_MESSAGES = {
    DENY_DISABLED: (
        "The MCP server is not enabled for this institute. An admin can turn it on "
        f"under MCP settings ({MCP_SETTINGS_PATH})."
    ),
    DENY_LEARNER: "The MCP server is available to institute staff only.",
    DENY_ROLE: (
        "This user's role is not allowed to connect to the MCP server. An admin can "
        f"grant the role under MCP settings ({MCP_SETTINGS_PATH})."
    ),
}


__all__ = [
    "MCP_SERVER_SETTING_KEY",
    "MCP_SETTINGS_PATH",
    "MCP_EXPOSED_TOOLS",
    "MCP_TOOL_GROUP_LABELS",
    "LEARNER_ROLES",
    "DEFAULT_ALLOWED_ROLES",
    "MCP_SCOPE_READ",
    "DENY_DISABLED",
    "DENY_LEARNER",
    "DENY_ROLE",
    "DENIAL_MESSAGES",
]
