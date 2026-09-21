"""
The registry -> MCP bridge: what the server exposes, and to whom.

The point of these tests is containment. The Assistant registry holds 21 tools,
including writes; the MCP surface must expose exactly the allow-listed read tools
and nothing else, however the institute's settings are configured.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402

from app.mcp import adapter  # noqa: E402
from app.mcp.access import normalize_setting  # noqa: E402
from app.mcp.constants import MCP_ALLOWED_WRITE_TOOLS, MCP_EXPOSED_TOOLS  # noqa: E402
from app.schemas.auth import PinnedPrincipal  # noqa: E402
from app.services.assistant_tool_registry import ASSISTANT_TOOLS  # noqa: E402


def principal(roles=("ADMIN",), is_root=False):
    return PinnedPrincipal(
        user_id="user-1",
        institute_id="inst-1",
        roles=list(roles),
        permissions=[],
        is_root_user=is_root,
    )


def setting(enabled_tools, role_overrides=None):
    return normalize_setting(
        {
            "enabled": True,
            "allowed_roles": ["ADMIN", "TEACHER"],
            "enabled_tools": list(enabled_tools),
            "role_overrides": role_overrides or {},
        }
    )


# ── the exposed set ──────────────────────────────────────────────────────
def test_exposed_set_is_the_documented_one():
    # One tool per feature (with an `action` argument), so the settings tab has
    # one toggle per feature. Adding here means adding a label + docs too.
    assert MCP_EXPOSED_TOOLS == (
        "whoami", "get_institute_overview", "website", "website_edit", "audience_forms", "audience_forms_edit",
        "workflows", "workflows_edit", "blog", "blog_edit",
    )


def test_every_exposed_name_exists_in_the_registry():
    """Guards against a registry rename silently emptying the MCP surface."""
    assert [s.name for s in adapter.exposed_specs()] == list(MCP_EXPOSED_TOOLS)


def test_exposed_write_tools_are_on_the_allow_list():
    """MCP has no confirm card: a write tool is exposed only when it is draft-only or additive."""
    for spec in adapter.exposed_specs():
        if spec.mode == "WRITE":
            assert spec.name in MCP_ALLOWED_WRITE_TOOLS, spec.name
            assert not spec.default_enabled and not spec.default_roles, "writes are never default-on"


def test_live_write_tools_are_not_exposed():
    """The Assistant's confirm-card writes (learner edits, announcements) stay off MCP."""
    write_tools = {name for name, spec in ASSISTANT_TOOLS.items() if spec.mode == "WRITE"}
    live_writes = write_tools - set(MCP_ALLOWED_WRITE_TOOLS)
    assert live_writes, "registry should contain live write tools for this test to mean anything"
    assert not live_writes & set(MCP_EXPOSED_TOOLS)


def test_draft_write_tool_is_off_unless_its_group_is_enabled():
    assert "website_edit" not in [t.name for t in adapter.list_tools_for(principal(), setting(["website_builder"]))]
    assert "website_edit" in [t.name for t in adapter.list_tools_for(principal(), setting(["website_builder_edits"]))]
    # Unconfigured institute: the write tool is off even for admins.
    assert "website_edit" not in [t.name for t in adapter.list_tools_for(principal(), normalize_setting({"enabled": True}))]


def test_workflow_draft_tool_is_off_unless_its_group_is_enabled():
    """The automations write tool follows the same rule: its own group, never the read group."""
    assert "workflows_edit" not in [t.name for t in adapter.list_tools_for(principal(), setting(["workflows"]))]
    assert gated(adapter.list_tools_for(principal(), setting(["workflows"]))) == ["workflows"]
    assert "workflows_edit" in [t.name for t in adapter.list_tools_for(principal(), setting(["workflows_edits"]))]
    tool = next(t for t in adapter.list_tools_for(principal(), setting(["workflows_edits"])) if t.name == "workflows_edit")
    assert tool.annotations.read_only_hint is False
    assert set(tool.input_schema["properties"]["action"]["enum"]) == {"validate", "create_draft", "update_draft", "discard_draft"}


# ── schema translation ───────────────────────────────────────────────────
def gated(tools):
    """Tool names minus the always-on identity tool, which every caller gets."""
    return [t.name for t in tools if t.name != "whoami"]


def test_tools_translate_to_valid_mcp_tools():
    tools = adapter.list_tools_for(principal(), setting(["institute_overview"]))
    assert gated(tools) == ["get_institute_overview"]

    tool = next(t for t in tools if t.name == "get_institute_overview")
    assert tool.description
    assert tool.input_schema["type"] == "object"
    assert "sections" in tool.input_schema["properties"]
    assert tool.annotations.read_only_hint is True
    assert tool.annotations.destructive_hint is False


def test_catalog_describes_each_exposed_tool_for_the_settings_ui():
    catalog = adapter.tool_catalog()
    assert [c["name"] for c in catalog] == list(MCP_EXPOSED_TOOLS)
    entry = next(c for c in catalog if c["name"] == "get_institute_overview")
    assert entry["key"] == "institute_overview"
    assert entry["label"] == "Institute stats"
    assert entry["mode"] == "READ"
    assert entry["description"]
    assert entry["always_on"] is False
    # The identity tool is listed so the settings page can SHOW it, flagged as not a toggle.
    assert next(c for c in catalog if c["name"] == "whoami")["always_on"] is True


# ── the per-tool gate ────────────────────────────────────────────────────
def test_tool_is_hidden_when_the_institute_has_not_enabled_it():
    assert gated(adapter.list_tools_for(principal(), setting([]))) == []


def test_whoami_is_always_offered_to_anyone_who_may_connect():
    """Identity only — no toggle can switch it off, in any configuration."""
    for conf in (setting([]), setting([], {"TEACHER": {"enabled_tools": []}}), normalize_setting(None)):
        assert [t.name for t in adapter.list_tools_for(principal(), conf)] == ["whoami"]


def test_tool_is_hidden_for_a_role_without_an_override():
    """Institute-level tools apply to everyone; overrides only ADD for a role."""
    conf = setting([], {"TEACHER": {"enabled_tools": ["institute_overview"]}})
    assert gated(adapter.list_tools_for(principal(["ADMIN"]), conf)) == []
    assert gated(adapter.list_tools_for(principal(["TEACHER"]), conf)) == ["get_institute_overview"]


def test_role_override_grants_on_top_of_institute_level_tools():
    conf = setting(["institute_overview"], {"TEACHER": {"enabled_tools": []}})
    assert gated(adapter.list_tools_for(principal(["TEACHER"]), conf)) == ["get_institute_overview"]


def test_unconfigured_setting_exposes_nothing():
    """
    The registry treats a falsy setting as 'use Assistant defaults'. MCP must not
    inherit that: an institute that never configured tools exposes none.
    """
    assert gated(adapter.list_tools_for(principal(), normalize_setting(None))) == []


# ── call containment ─────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_calling_an_unexposed_registry_tool_is_refused():
    """Even a real registry tool must be unreachable unless it is allow-listed."""
    result = await adapter.call_tool(
        name="send_announcement",
        arguments={},
        principal=principal(),
        platform_token="jwt",
        db=None,
        mcp_setting=setting(["institute_overview", "announcements"]),
    )
    assert result.is_error is True
    assert "tool_not_available" in result.content[0].text


@pytest.mark.asyncio
async def test_calling_an_unknown_tool_is_refused():
    result = await adapter.call_tool(
        name="definitely_not_a_tool",
        arguments={},
        principal=principal(),
        platform_token="jwt",
        db=None,
        mcp_setting=setting(["institute_overview"]),
    )
    assert result.is_error is True


@pytest.mark.asyncio
async def test_disabled_tool_call_is_denied_by_the_registry_gate():
    """An exposed-but-untoggled tool is refused at dispatch, not just hidden."""
    result = await adapter.call_tool(
        name="get_institute_overview",
        arguments={"sections": ["enrollment_counts"]},
        principal=principal(),
        platform_token="jwt",
        db=None,
        mcp_setting=setting([]),
    )
    assert result.is_error is True
    assert "tool_not_permitted" in result.content[0].text
