"""
Loaders shared by the website tools (``website``, ``website_edit``) and the lead
forms tool: which catalogues the pinned institute has, the config the editor
would show (draft over published), the real courses / product pages / campaigns
a page may link to, and the URLs an admin needs to look at the result.

Every call replays the caller's own JWT to admin-core, so nothing here can read
what the admin could not open in the dashboard. Kept free of tool-module
imports so the feature modules can import it in any order.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import text

from .assistant_tool_registry import ToolContext, _admin_core_json
from .catalogue_summary import editor_url, learner_site_url

logger = logging.getLogger(__name__)

#: Campaigns beyond this count are listed without lead counts.
_MAX_CAMPAIGNS_WITH_COUNTS = 15
_MAX_COURSES = 40
_MAX_CATALOGUE_BYTES = 3_000_000


def _err(code: str, **extra: Any) -> Dict[str, Any]:
    return {"error": code, **extra}


def _is_error(data: Any) -> bool:
    return isinstance(data, dict) and bool(data.get("error"))


def _settings():
    from ..config import get_settings
    return get_settings()


NO_PORTAL_DOMAIN_NOTE = (
    "This institute has no learner-portal domain configured, so its websites cannot be reached on "
    "the shared learner host (that host serves a different institute). An admin can set the "
    "institute's learner domain under white-label / domain settings; the site is then served at "
    "https://<that domain>/<site name>. Until then, preview it in the editor."
)


def learner_portal_base(ctx: ToolContext) -> Optional[str]:
    """
    The institute's learner-portal origin, or None when it has none.

    Mirrors admin-core's LearnerPortalUrlResolver without its final fallback:
    ``institutes.learner_portal_base_url`` first, else a LEARNER row in
    ``institute_domain_routing`` (wildcard subdomains and admin-* portals
    skipped). No fallback to the shared learner host on purpose — the learner
    app resolves the INSTITUTE from the domain, so a site of an institute
    without a domain is a 404 there, and a dead link is worse than none.
    """
    inst = ctx.principal.institute_id
    try:
        row = ctx.db.execute(
            text("SELECT learner_portal_base_url FROM institutes WHERE id = :id"), {"id": inst}
        ).first()
        column = (row[0] or "").strip() if row else ""
        if column:
            return column
    except Exception as exc:  # noqa: BLE001
        logger.warning("learner_portal_base_url lookup failed for %s: %s", inst, exc)
        return None
    try:
        rows = ctx.db.execute(
            text("SELECT domain, subdomain FROM institute_domain_routing WHERE institute_id = :id AND role = 'LEARNER'"),
            {"id": inst},
        ).fetchall()
    except Exception as exc:  # noqa: BLE001
        logger.warning("institute_domain_routing lookup failed for %s: %s", inst, exc)
        return None
    for domain, subdomain in rows or []:
        domain = str(domain or "").strip().lower()
        domain = domain.replace("https://", "").replace("http://", "").rstrip("/")
        sub = str(subdomain or "").strip().lower()
        if not domain or sub.startswith("admin"):
            continue
        return domain if (not sub or sub == "*") else f"{sub}.{domain}"
    return None


def site_url(ctx: ToolContext, tag_name: str) -> Optional[str]:
    """Public URL of a site, or None when the institute has no learner domain."""
    base = learner_portal_base(ctx)
    return learner_site_url(tag_name, base, "") if base else None


def site_editor_url(tag_name: str, page_route: Optional[str] = None, section_id: Optional[str] = None,
                    ctx: Optional[ToolContext] = None) -> str:
    """Editor deep link on the institute's OWN admin portal (white-label), else the platform's."""
    from ..mcp.institute_scope import admin_portal_base
    base = _settings().admin_dashboard_url
    if ctx is not None:
        base = admin_portal_base(ctx.db, ctx.principal.institute_id, base)
    return editor_url(base, tag_name, page_route, section_id)


async def list_catalogues(ctx: ToolContext) -> Any:
    """All catalogues mapped to the pinned institute (full rows, incl. catalogue_json)."""
    return await _admin_core_json(
        ctx, "GET", "/admin-core-service/v1/course-catalogue/institute/get-all",
        params={"instituteId": ctx.principal.institute_id}, timeout=30.0,
    )


async def resolve_tag(ctx: ToolContext, tag_name: Optional[str]) -> Tuple[Optional[str], Optional[Dict[str, Any]]]:
    """
    Turn an optional tag into a definite one: the given tag if the institute has
    it, else the institute's default site, else its only site. Returns
    ``(tag, None)`` or ``(None, error_dict)`` listing the options.
    """
    rows = await list_catalogues(ctx)
    if _is_error(rows) or not isinstance(rows, list):
        return None, _err("fetch_failed", message="Could not list this institute's websites.")
    names = [str(r.get("tag_name") or "") for r in rows if isinstance(r, dict)]
    wanted = str(tag_name or "").strip()
    if wanted:
        for n in names:
            if n.lower() == wanted.lower():
                return n, None
        return None, _err("unknown_site", message=f"No website named '{wanted}'.", available=names)
    default = next((r for r in rows if isinstance(r, dict) and r.get("is_default")), None)
    if default:
        return str(default.get("tag_name")), None
    if len(names) == 1:
        return names[0], None
    if not names:
        return None, _err("no_sites", message="This institute has no websites yet.")
    return None, _err("tag_required", message="Several websites exist — pass tag_name.", available=names)


async def get_draft(ctx: ToolContext, catalogue_id: str) -> Optional[Dict[str, Any]]:
    """The pending draft revision, or None (the endpoint answers 204 when there is none)."""
    data = await _admin_core_json(
        ctx, "GET", "/admin-core-service/v1/course-catalogue/revision/draft",
        params={"catalogueId": catalogue_id}, timeout=30.0,
    )
    if _is_error(data):
        return None
    return data if isinstance(data, dict) and data.get("id") else None


async def get_history(ctx: ToolContext, catalogue_id: str) -> List[Dict[str, Any]]:
    data = await _admin_core_json(
        ctx, "GET", "/admin-core-service/v1/course-catalogue/revision/history",
        params={"catalogueId": catalogue_id},
    )
    return [r for r in data if isinstance(r, dict)] if isinstance(data, list) else []


def _parse_config(raw: Any) -> Optional[Dict[str, Any]]:
    if isinstance(raw, dict):
        return raw
    if not isinstance(raw, str) or not raw.strip():
        return None
    if len(raw) > _MAX_CATALOGUE_BYTES:
        return None
    try:
        parsed = json.loads(raw)
    except ValueError:
        return None
    return parsed if isinstance(parsed, dict) else None


async def load_site(ctx: ToolContext, tag_name: Optional[str]) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
    """
    ``(site, None)`` or ``(None, error)``. ``site`` carries the catalogue row, the
    parsed config the EDITOR would show (draft if one exists, else published),
    and ``from_draft``.
    """
    tag, err = await resolve_tag(ctx, tag_name)
    if err:
        return None, err
    row = await _admin_core_json(
        ctx, "GET", "/admin-core-service/v1/course-catalogue/institute/get/by-tag",
        params={"instituteId": ctx.principal.institute_id, "tagName": tag}, timeout=30.0,
    )
    if _is_error(row) or not isinstance(row, dict):
        return None, _err("fetch_failed", message=f"Could not load website '{tag}'.")
    catalogue_id = str(row.get("id") or "")
    draft = await get_draft(ctx, catalogue_id) if catalogue_id else None
    raw = draft.get("catalogue_json") if draft else row.get("catalogue_json")
    config = _parse_config(raw)
    if config is None:
        return None, _err(
            "catalogue_unreadable",
            message=f"Website '{tag}' is too large or malformed to summarise here; open it in the dashboard.",
            editor_url=site_editor_url(tag, ctx=ctx),
        )
    return {
        "tag_name": tag,
        "catalogue_id": catalogue_id,
        "status": row.get("status"),
        "is_default": bool(row.get("is_default")),
        "config": config,
        "from_draft": draft is not None,
        "draft": {k: draft.get(k) for k in ("id", "revision_no", "source", "updated_at")} if draft else None,
    }, None


# ── context loaders ──────────────────────────────────────────────────────
async def load_courses(ctx: ToolContext, limit: int = _MAX_COURSES) -> List[Dict[str, Any]]:
    """Real courses as the learner catalogue sees them (same search the site renders)."""
    data = await _admin_core_json(
        ctx, "POST", "/admin-core-service/open/packages/v2/search",
        params={"instituteId": ctx.principal.institute_id, "page": 0, "size": limit, "sort": "createdAt,desc"},
        body={"status": [], "level_ids": [], "faculty_ids": [], "search_by_name": "", "tag": [],
              "min_percentage_completed": 0, "max_percentage_completed": 0},
        timeout=30.0,
    )
    items = data.get("content") if isinstance(data, dict) else data
    # The search returns one row per (course, level, session). The catalogue
    # shows courses, and the wizard's snapshot aggregates the same way: one
    # entry per course carrying every level/session it is offered in.
    by_id: Dict[str, Dict[str, Any]] = {}
    for c in items or []:
        if not isinstance(c, dict) or not c.get("id"):
            continue
        entry = by_id.setdefault(str(c["id"]), {
            "id": c.get("id"), "name": c.get("package_name"), "levels": [], "sessions": [],
            "package_session_ids": [], "price": None, "currency": c.get("currency"),
            "type": c.get("package_type") or c.get("type"),
        })
        level = str(c.get("level_name") or "")
        if level and level.lower() != "default" and level not in entry["levels"]:
            entry["levels"].append(level)
        session = str(c.get("session_name") or "")
        if session and session.lower() != "default" and session not in entry["sessions"]:
            entry["sessions"].append(session)
        if c.get("package_session_id"):
            entry["package_session_ids"].append(c["package_session_id"])
        price = c.get("min_plan_actual_price")
        if isinstance(price, (int, float)) and price > 0 and (entry["price"] is None or price < entry["price"]):
            entry["price"] = price
    out: List[Dict[str, Any]] = []
    for e in by_id.values():
        out.append({k: v for k, v in {
            "id": e["id"],
            "name": e["name"],
            "level": ", ".join(e["levels"]) or None,
            "session": ", ".join(e["sessions"]) or None,
            "batches": len(e["package_session_ids"]) if len(e["package_session_ids"]) > 1 else None,
            "package_session_ids": e["package_session_ids"][:8],
            "price": e["price"],
            "currency": e["currency"] if e["price"] else None,
            "type": e["type"],
        }.items() if v not in (None, "", 0, [])})
    return out[:limit]


async def load_product_pages(ctx: ToolContext) -> List[Dict[str, Any]]:
    data = await _admin_core_json(
        ctx, "GET", "/admin-core-service/v1/product-page/get-all",
        params={"instituteId": ctx.principal.institute_id},
    )
    out: List[Dict[str, Any]] = []
    for p in data if isinstance(data, list) else []:
        if not isinstance(p, dict):
            continue
        out.append({k: v for k, v in {
            "name": p.get("name"), "code": p.get("code"), "status": p.get("status"),
            "course_count": len(p.get("mappings") or []) or None, "short_url": p.get("short_url"),
        }.items() if v})
    return out


async def load_campaigns(ctx: ToolContext, status: Optional[str] = "ACTIVE", with_counts: bool = True) -> List[Dict[str, Any]]:
    """Lead campaigns (Audience Manager) with leads received / last lead for the first N."""
    body: Dict[str, Any] = {"institute_id": ctx.principal.institute_id}
    if status:
        body["status"] = status
    data = await _admin_core_json(
        ctx, "POST", "/admin-core-service/v1/audience/campaigns",
        params={"pageNo": 0, "pageSize": 50}, body=body, timeout=30.0,
    )
    rows = data.get("content") if isinstance(data, dict) else None
    out: List[Dict[str, Any]] = []
    for i, c in enumerate(rows or []):
        if not isinstance(c, dict):
            continue
        entry: Dict[str, Any] = {
            "id": c.get("id"),
            "name": c.get("campaign_name"),
            "status": c.get("status"),
            "type": c.get("campaign_type"),
            "objective": c.get("campaign_objective"),
            "field_count": len(c.get("institute_custom_fields") or []),
        }
        if with_counts and i < _MAX_CAMPAIGNS_WITH_COUNTS and c.get("id"):
            entry.update(await campaign_lead_stats(ctx, str(c["id"])))
        out.append(entry)
    return out


async def campaign_name_map(ctx: ToolContext) -> Dict[str, str]:
    """id → name for every campaign (any status), for labelling ids stored on pages."""
    return {str(c["id"]): str(c.get("name") or "") for c in await load_campaigns(ctx, status=None, with_counts=False) if c.get("id")}


async def get_campaign(ctx: ToolContext, audience_id: str) -> Optional[Dict[str, Any]]:
    """One campaign of the pinned institute with its form fields, or None."""
    audience_id = str(audience_id or "").strip()
    if not audience_id or "/" in audience_id:
        return None
    data = await _admin_core_json(
        ctx, "GET",
        f"/admin-core-service/open/v1/audience/campaign/{ctx.principal.institute_id}/{audience_id}",
    )
    if not isinstance(data, dict) or _is_error(data):
        return None
    # The open endpoint is institute-scoped by path, but be explicit: a campaign
    # of another institute is never described here.
    if str(data.get("institute_id") or ctx.principal.institute_id) != ctx.principal.institute_id:
        return None
    return data


async def campaign_lead_stats(ctx: ToolContext, audience_id: str, days: Optional[int] = None) -> Dict[str, Any]:
    """``{leads_received, last_lead_at}`` — the same query the editor's CampaignHealth strip runs."""
    body: Dict[str, Any] = {
        "audience_id": audience_id,
        "conversion_status_filter": "ALL",
        "sort_by": "SUBMITTED_AT",
        "sort_direction": "DESC",
        "page": 0,
        "size": 1,
    }
    if days:
        from datetime import datetime, timedelta, timezone
        since = datetime.now(timezone.utc) - timedelta(days=int(days))
        body["submitted_from_local"] = since.strftime("%Y-%m-%dT%H:%M:%S")
    data = await _admin_core_json(
        ctx, "POST", "/admin-core-service/v1/audience/leads",
        params={"pageNo": 0, "pageSize": 1}, body=body,
    )
    if not isinstance(data, dict) or _is_error(data):
        return {"leads_received": None}
    rows = data.get("content") or []
    first = rows[0] if rows and isinstance(rows[0], dict) else {}
    return {
        "leads_received": data.get("total_elements", data.get("totalElements")),
        "last_lead_at": first.get("submitted_at_local"),
    }


__all__ = [
    "NO_PORTAL_DOMAIN_NOTE",
    "learner_portal_base", "site_url", "site_editor_url", "list_catalogues", "resolve_tag",
    "get_draft", "get_history", "load_site", "load_courses", "load_product_pages",
    "load_campaigns", "campaign_lead_stats", "get_campaign", "campaign_name_map",
]


# If this module is imported before the registry has loaded the feature tools
# (a test importing it directly), finish that job now that the loaders exist.
# When the registry is what imported us, it is still initialising and has no
# ``_load_feature_tools`` yet — it will run its own pass once it finishes.
try:
    from .assistant_tool_registry import _load_feature_tools as _load_feature_tools_now
except ImportError:  # registry half-initialised: it loads the feature tools itself
    pass
else:
    _load_feature_tools_now()
