"""
Skill Registry — discovers and loads motion primitive skills from skills/.

Each skill is a single Python file at `skills/<category>/<skill_id>/skill.py`
that exports:
  - METADATA: dict — id, version, category, title, description, use_when,
                    compatible_shot_types, requires_tier, requires_plugins,
                    requires_canvas, example_params
  - PARAMS_SCHEMA: dict — loose JSON-Schema (required + properties.type)
  - render(params, ctx) -> dict — returns {"html", "css", "js", "plugins"}

The registry scans the skills/ directory once at first access, validates each
skill, caches the result, and exposes filtered catalog views for the Director.

Adding a new skill = drop a folder. No pipeline changes. No registry edits.
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


def _skills_root() -> Path:
    return Path(__file__).parent / "skills"


def _load_skill_module(skill_dir: Path) -> Optional[Dict[str, Any]]:
    """Load a skill module. Returns metadata dict or None on failure."""
    skill_py = skill_dir / "skill.py"
    if not skill_py.exists():
        return None
    rel = skill_dir.relative_to(_skills_root())
    mod_name = "_skills_" + "_".join(rel.parts)
    spec = importlib.util.spec_from_file_location(mod_name, skill_py)
    if spec is None or spec.loader is None:
        return None
    module = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(module)
    except Exception as e:
        print(f"[skill_registry] failed to load {skill_dir.name}: {e}")
        return None

    meta = getattr(module, "METADATA", None)
    schema = getattr(module, "PARAMS_SCHEMA", None)
    render = getattr(module, "render", None)
    # Optional: a static (no-animation, no-LLM-needed) fallback the composer
    # invokes when render() raises or params fail validation. Lets the shot
    # ship a still version of the visual instead of a `<!-- skill X: ... -->`
    # placeholder comment that produces a visible gap.
    static_fallback = getattr(module, "static_fallback", None)
    if not isinstance(meta, dict) or not callable(render):
        print(f"[skill_registry] {skill_dir.name} missing METADATA or render()")
        return None
    if not meta.get("id"):
        print(f"[skill_registry] {skill_dir.name} missing id in METADATA")
        return None

    return {
        "id": meta["id"],
        "version": meta.get("version", "1.0.0"),
        "category": meta.get("category", "uncategorized"),
        "title": meta.get("title", meta["id"]),
        "description": meta.get("description", ""),
        "use_when": meta.get("use_when", ""),
        "compatible_shot_types": meta.get("compatible_shot_types", ["*"]),
        "requires_tier": meta.get("requires_tier", "free"),
        "requires_plugins": meta.get("requires_plugins", []),
        "requires_canvas": meta.get("requires_canvas", "any"),
        "params_schema": schema or {},
        "render": render,
        "static_fallback": static_fallback if callable(static_fallback) else None,
        "example_params": meta.get("example_params", {}),
    }


def _discover_skills() -> Dict[str, Dict[str, Any]]:
    """Walk skills/ directory and load every skill.py file found."""
    root = _skills_root()
    if not root.exists():
        return {}
    registry: Dict[str, Dict[str, Any]] = {}
    for skill_py in root.rglob("skill.py"):
        entry = _load_skill_module(skill_py.parent)
        if not entry:
            continue
        key = entry["id"]
        if key in registry:
            print(f"[skill_registry] duplicate id '{key}' — keeping first")
            continue
        registry[key] = entry
    return registry


def get_registry() -> Dict[str, Dict[str, Any]]:
    """Lazy-load the registry once per process."""
    global _REGISTRY_CACHE
    if _REGISTRY_CACHE is None:
        _REGISTRY_CACHE = _discover_skills()
        if _REGISTRY_CACHE:
            print(
                f"[skill_registry] loaded {len(_REGISTRY_CACHE)} skills: "
                f"{sorted(_REGISTRY_CACHE.keys())}"
            )
        else:
            print("[skill_registry] no skills found")
    return _REGISTRY_CACHE


def build_catalog_for_shot(
    shot_type: str,
    tier: str,
    canvas: str = "any",
) -> str:
    """Produce the Director-facing catalog (markdown) filtered for this shot.

    Filters by:
    - shot type compatibility
    - minimum tier
    - canvas orientation (portrait/landscape/any)

    Returns an empty string if no skills match.
    """
    tier_level = _TIER_ORDER.get(tier, 0)
    reg = get_registry()

    eligible: List[Dict[str, Any]] = []
    for skill in reg.values():
        req_tier = skill.get("requires_tier", "free")
        if _TIER_ORDER.get(req_tier, 0) > tier_level:
            continue
        compat = skill.get("compatible_shot_types", ["*"])
        if "*" not in compat and shot_type not in compat:
            continue
        rc = skill.get("requires_canvas", "any")
        if rc != "any" and rc != canvas:
            continue
        eligible.append(skill)

    if not eligible:
        return ""

    lines: List[str] = [
        "",
        "## 🧩 SKILL CATALOG — reusable motion primitives",
        "",
        "You have access to pre-built, tested motion primitives. Drop a `<skill>` tag "
        "anywhere in your HTML and the pipeline will replace it with validated, "
        "production-quality HTML + CSS + GSAP code. Treat these as a VOCABULARY to "
        "compose around your own direction — not a substitute for it. Reach for a skill "
        "when it genuinely serves the beat; otherwise author the motion yourself. Mix "
        "multiple skills with custom HTML freely — but never let a drop-in skill flatten "
        "a shot into a generic widget when the idea deserves a bespoke composition.",
        "",
        "**Syntax**: `<skill data-skill-id=\"<id>\" data-params='<json>'></skill>`",
        "",
        "- Params MUST be valid JSON inside single quotes.",
        "- The pipeline auto-imports any GSAP plugins the skill needs.",
        "- The skill's rendered code has deterministic IDs — safe to place multiple per shot.",
        "",
        "### Available skills for this shot:",
        "",
    ]

    for s in eligible:
        ex_params = s.get("example_params") or {}
        lines.append(f"**`{s['id']}`** — {s['title']}")
        if s.get("description"):
            lines.append(f"  {s['description']}")
        if s.get("use_when"):
            lines.append(f"  *Use when*: {s['use_when']}")
        if ex_params:
            ex_json = json.dumps(ex_params, ensure_ascii=False)
            lines.append(
                f"  *Example*: `<skill data-skill-id=\"{s['id']}\" "
                f"data-params='{ex_json}'></skill>`"
            )
        lines.append("")

    return "\n".join(lines)


def validate_params(skill_id: str, params: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """Loose schema check — required keys present, top-level types match.

    Returns (is_valid, list_of_issue_strings).
    """
    reg = get_registry()
    skill = reg.get(skill_id)
    if not skill:
        return False, [f"unknown skill '{skill_id}'"]
    schema = skill.get("params_schema", {}) or {}
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
    return True  # unknown expected type → pass
