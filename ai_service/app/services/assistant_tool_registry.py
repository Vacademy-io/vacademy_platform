"""
Vacademy Assistant — tool registry and the AND-gate authorization engine.

Every Assistant tool is authorized by TWO independent legs, and BOTH must pass
(deny-by-default):

  1. RBAC leg     — the tool's ``required_permission`` must be present in the
                    caller's per-institute permissions (read from the JWT
                    authorities map for the pinned institute). A tool with
                    ``required_permission = None`` has no RBAC leg (used for the
                    Phase-1 help tool, which every non-learner role may use).
  2. Settings leg — the tool must be enabled for the pinned institute (and the
                    caller's role) in the institute's ``ASSISTANT_TOOLS_SETTING``.
                    When an institute has not configured the setting yet, tools
                    flagged ``default_enabled`` are on; everything else is off.

This is enforced ENTIRELY in the agent because the backend performs no
per-institute RBAC and ai_service->Java internal calls run with full service
trust. The gate is evaluated twice: once to decide which tool schemas are even
offered to the LLM, and again at dispatch time right before execution (so a
hallucinated or forced call to a disallowed tool is refused, not run).

Identity (user_id / institute_id) for every tool call is taken from the pinned
principal — never from the model-supplied arguments.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from ..schemas.auth import PinnedPrincipal

logger = logging.getLogger(__name__)

#: The institute-settings JSON key the Assistant reads its per-tool toggles from.
ASSISTANT_TOOLS_SETTING_KEY = "ASSISTANT_TOOLS_SETTING"

#: context_type stamped on chat_sessions created through the Assistant surface,
#: so admin Assistant sessions are never confused with learner tutor sessions.
ASSISTANT_CONTEXT_TYPE = "admin_assistant"

#: The Phase-1 how-to corpus is PRODUCT-WIDE (the steps to create a course are the
#: same for every institute), so it is ingested ONCE under this sentinel institute
#: id and the help tool always reads it here instead of the caller's institute.
#: (Per-institute custom help can be unioned in later.)
HELP_KNOWLEDGE_INSTITUTE_ID = "__global_help__"


class _StaticKeyResolver:
    """Returns pre-resolved API keys without touching the DB (for embeddings)."""

    def __init__(self, keys: tuple):
        self._keys = keys

    def resolve_keys(self, institute_id=None, user_id=None, request_model=None):
        return self._keys


@dataclass
class ToolContext:
    """Runtime context handed to a tool executor. Built per call by the service."""
    db: Session
    principal: PinnedPrincipal
    keys: tuple  # pre-resolved (openrouter_key, gemini_key, model) for embeddings


# Executor signature: async (args: dict, ctx: ToolContext) -> str
ToolExecutor = Callable[[Dict[str, Any], ToolContext], Awaitable[str]]


@dataclass
class ToolSpec:
    """One Assistant tool: its LLM-facing schema, executor, and gating metadata."""
    name: str
    schema: Dict[str, Any]            # OpenAI function-calling schema (offered to the LLM)
    executor: ToolExecutor
    required_permission: Optional[str] = None  # RBAC leg; None = no permission required
    setting_key: Optional[str] = None          # Settings-leg key; defaults to ``name``
    default_enabled: bool = False              # on when institute has no ASSISTANT_TOOLS_SETTING
    phase: int = 1                             # roadmap phase (1=help, 2=read, 3=write)
    mode: str = "READ"                         # READ | WRITE

    def key(self) -> str:
        return self.setting_key or self.name


# ──────────────────────────────────────────────────────────────────────────
# Phase-1 tool: search_help_knowledge (role-scoped how-to retrieval over RAG)
# ──────────────────────────────────────────────────────────────────────────

_SEARCH_HELP_KNOWLEDGE_SCHEMA: Dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "search_help_knowledge",
        "description": (
            "Search Vacademy's how-to knowledge base for step-by-step instructions on "
            "how and where to perform a task in the admin portal (e.g. 'how do I create a "
            "course', 'where do I add a learner to a batch'). Use this for any "
            "how-to / where-to question before answering. Returns matching help articles "
            "with their steps and the in-app route to navigate to."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The user's how-to question, in natural language.",
                },
            },
            "required": ["query"],
        },
    },
}


async def _execute_search_help_knowledge(args: Dict[str, Any], ctx: ToolContext) -> str:
    """Role-scoped retrieval over the 'help_knowledge' corpus in pgvector."""
    query = str((args or {}).get("query") or "").strip()
    if not query:
        return json.dumps({"results": [], "note": "No query was provided."})

    # Imported here to avoid a heavy import at module load.
    from .embedding_service import EmbeddingService
    from .rag_service import RAGService

    try:
        embedding_service = EmbeddingService(_StaticKeyResolver(ctx.keys))
        rag = RAGService(ctx.db, embedding_service)
        rows = await rag.search(
            query=query,
            institute_id=HELP_KNOWLEDGE_INSTITUTE_ID,
            top_k=5,
            similarity_threshold=0.3,
            source_type="help_knowledge",
            roles=ctx.principal.roles or None,
        )
    except Exception as e:  # never leak internals to the model
        logger.warning("search_help_knowledge failed: %s", e)
        return json.dumps({"results": [], "note": "Help search is temporarily unavailable."})

    if not rows:
        return json.dumps({
            "results": [],
            "note": "No matching help article was found. Tell the user you don't have a "
                    "documented procedure for this and avoid inventing steps.",
        })

    results = []
    for r in rows:
        meta = r.get("metadata") or {}
        results.append({
            "task": meta.get("task"),
            "route_path": meta.get("route_path"),
            "steps": r.get("content_text"),
            "similarity": r.get("similarity_score"),
        })
    return json.dumps({"results": results})


# ──────────────────────────────────────────────────────────────────────────
# The registry. Phase-2 (read) and Phase-3 (write) tools register here later,
# each with its own required_permission + default_enabled=False.
# ──────────────────────────────────────────────────────────────────────────

ASSISTANT_TOOLS: Dict[str, ToolSpec] = {
    "search_help_knowledge": ToolSpec(
        name="search_help_knowledge",
        schema=_SEARCH_HELP_KNOWLEDGE_SCHEMA,
        executor=_execute_search_help_knowledge,
        required_permission=None,   # Phase-1 help is available to all non-learner roles
        default_enabled=True,       # on out-of-the-box until an institute configures the setting
        phase=1,
        mode="READ",
    ),
}


# ──────────────────────────────────────────────────────────────────────────
# Settings-leg: read ASSISTANT_TOOLS_SETTING from the shared admin_core DB.
# ──────────────────────────────────────────────────────────────────────────

def load_assistant_tools_setting(db: Session, institute_id: str) -> Optional[Dict[str, Any]]:
    """
    Read the institute's ASSISTANT_TOOLS_SETTING from the shared admin_core DB.

    Institute settings are stored as a single JSON STRING in
    ``institutes.setting_json`` (common_service Institute.java -> @Column
    name="setting_json", a String). Keys map to per-feature blobs via the
    generic settings strategy. Returns the parsed setting blob or None when the
    institute has not configured it — in which case the Settings leg falls back
    to ``default_enabled`` tools.

    Fails closed-to-default (returns None, never raises) so a settings read
    problem can never silently grant a tool.
    """
    try:
        row = db.execute(
            text("SELECT setting_json FROM institutes WHERE id = :id"),
            {"id": institute_id},
        ).first()
    except Exception as e:
        logger.warning("Could not read institutes.setting_json for %s: %s", institute_id, e)
        return None

    if not row or not row[0]:
        return None

    raw = row[0]
    try:
        settings_obj = json.loads(raw) if isinstance(raw, str) else raw
    except (ValueError, TypeError) as e:
        logger.warning("institutes.setting_json for %s is not valid JSON: %s", institute_id, e)
        return None

    if not isinstance(settings_obj, dict):
        return None

    node = settings_obj.get(ASSISTANT_TOOLS_SETTING_KEY)
    if node is None:
        return None
    # The generic settings strategy may wrap the payload as {key, name, data:{...}}.
    if isinstance(node, dict) and isinstance(node.get("data"), dict):
        return node["data"]
    return node if isinstance(node, dict) else None


def _effective_enabled_tools(setting: Optional[Dict[str, Any]], roles: Optional[List[str]]) -> set:
    """
    The set of tool keys enabled for the caller, given the institute setting and
    the caller's roles.

    - No setting configured -> the ``default_enabled`` tools.
    - Setting configured     -> the institute-level ``enabled_tools`` UNION the
      ``enabled_tools`` of each of the caller's roles in ``role_overrides``
      (union across multiple roles — the broadest of the caller's roles wins).
    """
    if not setting:
        return {spec.key() for spec in ASSISTANT_TOOLS.values() if spec.default_enabled}

    enabled = set(setting.get("enabled_tools") or [])
    overrides = setting.get("role_overrides") or {}
    if isinstance(overrides, dict):
        for role in roles or []:
            ro = overrides.get(role)
            if isinstance(ro, dict) and ro.get("enabled_tools") is not None:
                enabled |= set(ro.get("enabled_tools") or [])
    return enabled


# ──────────────────────────────────────────────────────────────────────────
# The AND-gate.
# ──────────────────────────────────────────────────────────────────────────

def is_tool_allowed(
    tool_name: str,
    principal: PinnedPrincipal,
    setting: Optional[Dict[str, Any]],
) -> bool:
    """True iff BOTH the RBAC leg and the Settings leg allow this tool. Deny-by-default."""
    spec = ASSISTANT_TOOLS.get(tool_name)
    if spec is None:
        return False  # unknown tool -> never allowed

    # RBAC leg
    if spec.required_permission is not None:
        if not (principal.is_root_user or spec.required_permission in (principal.permissions or [])):
            return False

    # Settings leg
    return spec.key() in _effective_enabled_tools(setting, principal.roles)


def build_offered_tools(
    principal: PinnedPrincipal,
    setting: Optional[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """The LLM-facing function schemas for exactly the tools this caller may use."""
    return [
        spec.schema
        for spec in ASSISTANT_TOOLS.values()
        if is_tool_allowed(spec.name, principal, setting)
    ]


async def execute_tool(
    tool_name: str,
    args: Optional[Dict[str, Any]],
    ctx: ToolContext,
    setting: Optional[Dict[str, Any]],
) -> str:
    """
    Dispatch a tool call after re-checking the AND-gate and forcing identity.

    Returns a string tool-result in ALL cases (including denial/errors) — the
    agent loop feeds tool output back to the LLM as a string, so raising here
    would bypass the graceful contract.
    """
    if not is_tool_allowed(tool_name, ctx.principal, setting):
        logger.warning(
            "Assistant denied tool '%s' for user=%s institute=%s (roles=%s)",
            tool_name, ctx.principal.user_id, ctx.principal.institute_id, ctx.principal.roles,
        )
        return json.dumps({
            "error": "tool_not_permitted",
            "tool": tool_name,
            "message": "You are not permitted to use this tool. Do not retry it.",
        })

    spec = ASSISTANT_TOOLS[tool_name]
    safe_args: Dict[str, Any] = dict(args or {})
    # Identity is ALWAYS taken from the pinned principal, never from the model.
    safe_args["user_id"] = ctx.principal.user_id
    safe_args["institute_id"] = ctx.principal.institute_id

    try:
        return await spec.executor(safe_args, ctx)
    except Exception as e:
        logger.exception("Assistant tool '%s' raised: %s", tool_name, e)
        return json.dumps({"error": "tool_failed", "tool": tool_name})


__all__ = [
    "ASSISTANT_TOOLS",
    "ASSISTANT_TOOLS_SETTING_KEY",
    "ASSISTANT_CONTEXT_TYPE",
    "ToolSpec",
    "ToolContext",
    "is_tool_allowed",
    "build_offered_tools",
    "execute_tool",
    "load_assistant_tools_setting",
]
