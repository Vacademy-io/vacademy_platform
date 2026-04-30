"""
Shot Template Registry — discovers and loads shot templates from shot_templates/.

Templates are full shot compositions (entire HTML+CSS+JS for one shot). Unlike
skills (which are reusable motion primitives the LLM can drop into any shot via
`<skill>` tags), a template is invoked by setting `template_id` on a shot in
the Director plan. The pipeline then **skips the per-shot LLM call** entirely
and renders the template deterministically.

Each template is a single Python file at
`shot_templates/<template_id>/template.py` that exports:
  - METADATA: dict — id, version, title, description, use_when,
                    compatible_shot_types, requires_tier, requires_canvas,
                    example_params
  - PARAMS_SCHEMA: dict — loose JSON-Schema (required + properties.type)
  - render(shot, ctx) -> dict — returns {"html", "css", "js", "audio_events"}

Why templates exist:
  - Reference-grade videos repeat a small vocabulary of compositions
    (split-screen comparison, 3-up grid, pull-quote, hero stat).
  - Letting the per-shot LLM design these from scratch causes drift —
    proportions, hierarchy, and rhythm vary shot to shot.
  - Templates enforce composition; the Director still picks WHICH template
    when one fits and otherwise leaves `template_id` null for freeform.

Adding a new template = drop a folder. No pipeline changes. No registry edits.
"""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple

_REGISTRY_CACHE: Optional[Dict[str, Dict[str, Any]]] = None

_TIER_ORDER = {
    "free": 0,
    "standard": 1,
    "premium": 2,
    "ultra": 3,
    "super_ultra": 4,
}


def _templates_root() -> Path:
    return Path(__file__).parent / "shot_templates"


def _load_template_module(template_dir: Path) -> Optional[Dict[str, Any]]:
    """Load a template module. Returns metadata dict or None on failure."""
    template_py = template_dir / "template.py"
    if not template_py.exists():
        return None
    rel = template_dir.relative_to(_templates_root())
    mod_name = "_shot_templates_" + "_".join(rel.parts)
    spec = importlib.util.spec_from_file_location(mod_name, template_py)
    if spec is None or spec.loader is None:
        return None
    module = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(module)
    except Exception as e:
        print(f"[shot_template_registry] failed to load {template_dir.name}: {e}")
        return None

    meta = getattr(module, "METADATA", None)
    schema = getattr(module, "PARAMS_SCHEMA", None)
    render = getattr(module, "render", None)
    if not isinstance(meta, dict) or not callable(render):
        print(f"[shot_template_registry] {template_dir.name} missing METADATA or render()")
        return None
    if not meta.get("id"):
        print(f"[shot_template_registry] {template_dir.name} missing id in METADATA")
        return None

    return {
        "id": meta["id"],
        "version": meta.get("version", "1.0.0"),
        "title": meta.get("title", meta["id"]),
        "description": meta.get("description", ""),
        "use_when": meta.get("use_when", ""),
        "compatible_shot_types": meta.get("compatible_shot_types", ["*"]),
        "requires_tier": meta.get("requires_tier", "premium"),
        "requires_canvas": meta.get("requires_canvas", "any"),
        "params_schema": schema or {},
        "render": render,
        "example_params": meta.get("example_params", {}),
    }


def _discover_templates() -> Dict[str, Dict[str, Any]]:
    """Walk shot_templates/ directory and load every template.py file found."""
    root = _templates_root()
    if not root.exists():
        return {}
    registry: Dict[str, Dict[str, Any]] = {}
    for template_py in root.rglob("template.py"):
        entry = _load_template_module(template_py.parent)
        if not entry:
            continue
        key = entry["id"]
        if key in registry:
            print(f"[shot_template_registry] duplicate id '{key}' — keeping first")
            continue
        registry[key] = entry
    return registry


def get_registry() -> Dict[str, Dict[str, Any]]:
    """Lazy-load the registry once per process."""
    global _REGISTRY_CACHE
    if _REGISTRY_CACHE is None:
        _REGISTRY_CACHE = _discover_templates()
        if _REGISTRY_CACHE:
            print(
                f"[shot_template_registry] loaded {len(_REGISTRY_CACHE)} templates: "
                f"{sorted(_REGISTRY_CACHE.keys())}"
            )
        else:
            print("[shot_template_registry] no templates found")
    return _REGISTRY_CACHE


def build_catalog_for_director(tier: str, canvas: str = "any") -> str:
    """Produce the Director-facing catalog (markdown) of all eligible templates.

    Filters by tier and canvas. Used in DIRECTOR_SYSTEM_PROMPT extension so the
    Director knows which `template_id` values it can emit.
    """
    tier_level = _TIER_ORDER.get(tier, 0)
    reg = get_registry()

    eligible: List[Dict[str, Any]] = []
    for tmpl in reg.values():
        req_tier = tmpl.get("requires_tier", "premium")
        if _TIER_ORDER.get(req_tier, 0) > tier_level:
            continue
        rc = tmpl.get("requires_canvas", "any")
        if rc != "any" and rc != canvas:
            continue
        eligible.append(tmpl)

    if not eligible:
        return ""

    lines: List[str] = [
        "",
        "## 📐 SHOT TEMPLATE CATALOG — pre-built composition layouts",
        "",
        "When a shot's content cleanly fits one of these compositions, set "
        "`template_id` on the shot dict to that template's ID and provide "
        "`template_params` with the required fields. The pipeline will render "
        "the shot deterministically — no per-shot LLM call. This kills "
        "composition drift and keeps the video visually coherent.",
        "",
        "**When to use a template**: the content is a clean fit for the "
        "template's structure (e.g. comparing two things → `split_comparison`; "
        "three reasons → `three_up_grid`; a pull quote → `quote_callout`). "
        "When content is too freeform, leave `template_id` null and let the "
        "shot LLM design it.",
        "",
        "### Available templates:",
        "",
    ]

    for t in eligible:
        compat = t.get("compatible_shot_types", ["*"])
        compat_str = "any" if "*" in compat else ", ".join(compat)
        ex_params = t.get("example_params") or {}
        lines.append(f"**`{t['id']}`** — {t['title']}")
        if t.get("description"):
            lines.append(f"  {t['description']}")
        if t.get("use_when"):
            lines.append(f"  *Use when*: {t['use_when']}")
        lines.append(f"  *Compatible shot types*: {compat_str}")
        if ex_params:
            ex_json = json.dumps(ex_params, ensure_ascii=False)
            lines.append(f"  *Example params*: `{ex_json}`")
        lines.append("")

    return "\n".join(lines)


def validate_params(template_id: str, params: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """Loose schema check — required keys present, top-level types match.

    Returns (is_valid, list_of_issue_strings).
    """
    reg = get_registry()
    tmpl = reg.get(template_id)
    if not tmpl:
        return False, [f"unknown template '{template_id}'"]
    schema = tmpl.get("params_schema", {}) or {}
    issues: List[str] = []

    for key in schema.get("required", []):
        if key not in params:
            issues.append(f"missing required param '{key}'")

    props = schema.get("properties", {}) or {}
    for key, val in params.items():
        if key not in props:
            continue
        expected = props[key].get("type")
        if expected and not _type_matches(val, expected):
            issues.append(f"param '{key}' expected {expected}, got {type(val).__name__}")

    return len(issues) == 0, issues


def _type_matches(value: Any, expected: str) -> bool:
    if expected == "string":
        return isinstance(value, str)
    if expected == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if expected == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if expected == "boolean":
        return isinstance(value, bool)
    if expected == "array":
        return isinstance(value, list)
    if expected == "object":
        return isinstance(value, dict)
    return True
