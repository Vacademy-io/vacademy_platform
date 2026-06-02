"""
Studio tool registry + tier matrix.

Each "tool" is an LLM-callable primitive the wizard's plan step can emit as an
operation. A tool declares:
  * `name`           — the registry key the LLM uses in `{tool, params}`
  * `step`           — which wizard step it belongs to
  * `min_tier`       — lowest quality tier that may use it
  * `validate(params, ctx)` — coerce + validate the LLM's params; return a
                       cleaned dict or raise ToolValidationError to drop it

The tier matrix is enforced server-side BEFORE the LLM prompt is built
(`tools_for_step`) so the model never sees a tool the user can't access — and
again at validation time as defense-in-depth.

P2 ships the Arrangement step's two tools (`pick_segments`, `arrange_sequence`).
Later phases register their tools by importing their modules here.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional

# Tier ordering for min-tier comparisons.
_TIER_RANK = {
    "free": 0,
    "standard": 1,
    "premium": 2,
    "ultra": 3,
    "super_ultra": 4,
}


def tier_rank(tier: Optional[str]) -> int:
    return _TIER_RANK.get((tier or "free").lower(), 0)


class ToolValidationError(ValueError):
    """Raised by a tool's validate() when params are unusable. The plan
    service drops the offending operation and keeps the rest."""


@dataclass(frozen=True)
class ToolSpec:
    """A plan-time tool.

    Two flavors, distinguished by `detect`:
      * LLM-emitted (detect is None) — the LLM proposes `{tool, params}`; we
        run `validate(params, ctx)` to coerce/reject. e.g. pick_segments.
      * Deterministic (detect set) — no LLM; the plan service calls
        `detect(ctx) -> list[operation dicts]` directly from indexed data.
        e.g. detect_silences, detect_fillers. `validate` still runs when such
        an operation arrives in a confirmed plan (defense-in-depth) and
        usually just passes the params through.
    """
    name: str
    step: str  # arrangement | cuts | overlays | audio
    min_tier: str
    summary: str  # one-line, shown to the LLM in the catalog
    params_doc: str  # JSON-shape-as-prose for the LLM
    validate: Callable[[Dict[str, Any], Dict[str, Any]], Dict[str, Any]]
    detect: Optional[Callable[[Dict[str, Any]], List[Dict[str, Any]]]] = None

    @property
    def is_deterministic(self) -> bool:
        return self.detect is not None


_REGISTRY: Dict[str, ToolSpec] = {}


def register_tool(spec: ToolSpec) -> None:
    if spec.name in _REGISTRY:
        raise ValueError(f"duplicate studio tool registration: {spec.name}")
    _REGISTRY[spec.name] = spec


def get_tool(name: str) -> Optional[ToolSpec]:
    return _REGISTRY.get(name)


def all_tools() -> List[ToolSpec]:
    return list(_REGISTRY.values())


def tools_for_step(
    step: str,
    tier: str,
    *,
    tools_enabled: Optional[List[str]] = None,
    tools_disabled: Optional[List[str]] = None,
) -> List[ToolSpec]:
    """Tools available for a step, filtered by tier + the user's per-step
    enable/disable constraints (WizardPlanRequest)."""
    enabled_set = set(tools_enabled or [])
    disabled_set = set(tools_disabled or [])
    user_rank = tier_rank(tier)
    out: List[ToolSpec] = []
    for spec in _REGISTRY.values():
        if spec.step != step:
            continue
        if tier_rank(spec.min_tier) > user_rank:
            continue
        if spec.name in disabled_set:
            continue
        if enabled_set and spec.name not in enabled_set:
            continue
        out.append(spec)
    return out


def build_tool_catalog_prompt(specs: List[ToolSpec]) -> str:
    """Render the tool catalog as prose for the LLM system/user prompt."""
    lines: List[str] = []
    for spec in specs:
        lines.append(f'- "{spec.name}": {spec.summary}')
        lines.append(f"    params: {spec.params_doc}")
    return "\n".join(lines)


# Register P2 tools at import time. Each module calls register_tool() at
# module scope; importing here guarantees the registry is populated whenever
# the registry package is imported (mirrors reels' register_all_stages()).
from . import pick_segments as _pick_segments  # noqa: E402,F401
from . import arrange_sequence as _arrange_sequence  # noqa: E402,F401
from . import detect_silences as _detect_silences  # noqa: E402,F401
from . import detect_fillers as _detect_fillers  # noqa: E402,F401
