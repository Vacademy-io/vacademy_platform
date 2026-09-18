"""Constants for the Vacademy MCP server."""
from __future__ import annotations

from typing import Any, Dict, Tuple

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

#: The ONLY registry tools this server exposes. Everything else in
#: ASSISTANT_TOOLS stays invisible and uncallable over MCP regardless of any
#: institute setting.
#:
#: Each feature is ONE tool with an ``action`` argument (see
#: docs/ai-page-builder/WEBSITE_BUILDER_MCP_PLAN.md §4), so the institute's
#: settings tab has one toggle per feature to manage per role.
MCP_EXPOSED_TOOLS: Tuple[str, ...] = (
    "get_institute_overview",
    "website",              # READ:  sites, pages, courses/campaigns to link, analytics, audit
    "website_edit",         # WRITE: draft-only — every change lands as a draft the admin publishes
    "audience_forms",       # READ:  lead campaigns, their form fields, recent leads
    "audience_forms_edit",  # WRITE: additive only — create a campaign, add fields, send a test lead
)

#: WRITE tools this server may expose, with the property that makes each safe
#: without a confirm card (MCP has none). A write tool is allowed here only
#: when nothing it does can destroy or publish anything: it writes DRAFTS the
#: admin publishes from the dashboard, or it only ADDS records. Live edits that
#: change or remove existing data (learner edits, announcements) stay off.
MCP_ALLOWED_WRITE_TOOLS: Dict[str, str] = {
    "website_edit": "draft-only: every action saves a draft revision; discard_draft undoes it",
    "audience_forms_edit": "additive: creates campaigns / adds fields / sends a test lead; never removes",
}

#: Friendly labels for the settings groups the exposed tools belong to. Serves
#: the settings UI so the FE never hardcodes a catalogue that can drift.
MCP_TOOL_GROUP_LABELS: Dict[str, str] = {
    "institute_overview": "Institute stats",
    "website_builder": "Website: view",
    "website_builder_edits": "Website: edit drafts",
    "audience_forms": "Lead forms: view",
    "audience_forms_edits": "Lead forms: edit",
}

#: One plain sentence per group for the settings page. The registry's tool
#: descriptions are written for the model (argument lists, rules) and read as
#: a wall of text next to a toggle.
MCP_TOOL_GROUP_SUMMARIES: Dict[str, str] = {
    "institute_overview": "Outstanding fees, classes live now and active learner counts.",
    "website_builder": (
        "See the institute's websites: pages and what each section shows, traffic, lead-capture "
        "health, pre-publish checks, and the interview an AI runs before building a site."
    ),
    "website_builder_edits": (
        "Build and change websites by conversation — generate pages, edit sections, set colours and "
        "fonts, wire forms to lead campaigns. Every change is saved as a draft; nothing goes live "
        "until you publish it in Manage Pages."
    ),
    "audience_forms": (
        "See lead campaigns: their form fields, where they are used on the websites, and leads received."
    ),
    "audience_forms_edits": (
        "Create lead campaigns, add fields to their forms and send test leads. Never removes anything."
    ),
}

#: Roles that must NEVER reach this server, even if an admin lists them. The MCP
#: surface is staff-only by product decision.
LEARNER_ROLES = frozenset({"STUDENT", "LEARNER", "PARENT"})

#: Roles offered by default when an institute first enables the server.
DEFAULT_ALLOWED_ROLES = ("ADMIN",)

#: The single OAuth scope this resource server understands.
MCP_SCOPE_READ = "vacademy.read"

#: Name given to the OAuth client every institute gets automatically.
AUTO_CLIENT_NAME = "Vacademy"

#: Client ids of the auto-provisioned client start with this; manually created
#: ones use ``vcm-``. The prefix is how the primary client is told apart, so it
#: can be shown first and protected from deletion.
AUTO_CLIENT_ID_PREFIX = "vacademy-"


def is_auto_client(client_id: Any) -> bool:
    """True for the institute's auto-provisioned (primary) client id."""
    return isinstance(client_id, str) and client_id.startswith(AUTO_CLIENT_ID_PREFIX)


#: Callback URLs the auto-provisioned client accepts out of the box.
#:
#: Most AI apps never need this client at all — Claude, ChatGPT and Cursor all
#: register themselves via Dynamic Client Registration (RFC 7591) and bring their
#: own callback. This list exists for apps that ask an admin to paste a client id
#: instead, and it is pre-seeded with the callbacks of the apps we know so that
#: an admin does not have to hunt for a URL. Anything not covered can be added
#: from the settings page.
#:
#: OAuth 2.1 requires exact-match redirect validation, which is why these are
#: literal URLs and not patterns.
AUTO_CLIENT_REDIRECT_URIS = (
    "https://claude.ai/api/mcp/auth_callback",
    "https://claude.com/api/mcp/auth_callback",
    "https://chatgpt.com/connector_platform_oauth_redirect",
    "https://cursor.com/connector/callback",
)

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
    "MCP_ALLOWED_WRITE_TOOLS",
    "MCP_TOOL_GROUP_LABELS",
    "MCP_TOOL_GROUP_SUMMARIES",
    "LEARNER_ROLES",
    "DEFAULT_ALLOWED_ROLES",
    "MCP_SCOPE_READ",
    "AUTO_CLIENT_NAME",
    "AUTO_CLIENT_ID_PREFIX",
    "is_auto_client",
    "AUTO_CLIENT_REDIRECT_URIS",
    "DENY_DISABLED",
    "DENY_LEARNER",
    "DENY_ROLE",
    "DENIAL_MESSAGES",
]
