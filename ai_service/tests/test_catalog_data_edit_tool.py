"""
`catalog_data_edit`: additive writes to the institute's live catalogue data
(folder libraries, course tags, product pages, the store sync).

Pinned here, over a mocked admin-core: the tool is its own off-by-default,
MCP-only group; every action is a dry run unless dry_run=false; it never sends
a delete, rename, move, hide, activate or invite change (checked on the calls
it makes AND on its source); new folders are HIDDEN; tags are appended through
a full round trip of the stored course; product pages are DRAFT on each
course's DEFAULT invite and cheapest plan; the store sync never switches a
course off; every id is checked against the caller's institute first.
"""
import copy
import json
import re
import sys
from datetime import date, timedelta
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402
from app.mcp import adapter  # noqa: E402
from app.mcp.access import normalize_setting  # noqa: E402
from app.mcp.constants import MCP_ALLOWED_WRITE_TOOLS, MCP_EXPOSED_TOOLS  # noqa: E402
from app.schemas.auth import PinnedPrincipal  # noqa: E402
from app.services import assistant_tools_catalog_data_edit as tool  # noqa: E402
from app.services import assistant_tools_website_edit as edit_mod  # noqa: E402
from app.services import website_data  # noqa: E402
from app.services.assistant_tool_registry import (  # noqa: E402
    ASSISTANT_TOOLS,
    ToolContext,
    build_offered_tools,
    is_tool_allowed,
)

INST = "inst-1"
ASSET = "https://cdn.vacademy.test/inst-1/stream.png"


def principal(roles=("ADMIN",)):
    return PinnedPrincipal(user_id="user-1", institute_id=INST, roles=list(roles), permissions=[], is_root_user=False)


class _Db:
    def execute(self, *a, **k):
        return SimpleNamespace(first=lambda: None, fetchall=lambda: [])

    def rollback(self):
        pass


def ctx():
    return ToolContext(db=_Db(), principal=principal(), keys=(), bearer_token="jwt")


# ── a small admin-core ───────────────────────────────────────────────────
def _node(id_, title, slug=None, parent=None, node_type="FOLDER", status="ACTIVE", **extra):
    return {"id": id_, "parent_id": parent, "node_type": node_type, "title": title, "slug": slug,
            "status": status, **extra}


class Backend:
    def __init__(self):
        self.calls = []
        self.libraries = [{"id": "lib-1", "institute_id": INST, "name": "Knowledge Streams", "node_count": 3},
                          {"id": "lib-2", "institute_id": INST, "name": "Spare", "node_count": 0}]
        self.nodes = {
            "lib-1": [
                _node("n-1", "Shastra", "shastra", course_tag="shastra", subtitle="Scriptures"),
                _node("n-2", "Gita", "gita", parent="n-1"),
                _node("n-3", "Swasthya"),                      # no slug: its key is derived from the title
                _node("n-4", None, "forbvy", parent="n-1", node_type="PRODUCT_PAGE", product_page_id="pp-1"),
            ],
            "lib-2": [],
        }
        self.catalogues = [{"id": "cat-1", "tag_name": "main", "status": "ACTIVE",
                            "catalogue_json": json.dumps({"pages": [{"components": [{"type": "folderBrowser",
                                                                                     "props": {"libraryId": "lib-1"}}]}]})}]
        self.campaigns = {"aud-1": {"id": "aud-1", "institute_id": INST, "status": "ACTIVE"},
                          "aud-2": {"id": "aud-2", "institute_id": INST, "status": "PAUSED"}}
        self.pages = [{"id": "pp-1", "institute_id": INST, "name": "For BVY", "code": "forbvy", "status": "ACTIVE",
                       "mappings": [{"package_session_id": "ps-a", "status": "ACTIVE"}]}]
        self.course_updates = {}
        self._ids = 0

    def tree(self, lib_id):
        rows = copy.deepcopy(self.nodes[lib_id])
        by_parent = {}
        for n in rows:
            by_parent.setdefault(n.get("parent_id"), []).append(n)
        for n in rows:
            n["children"] = by_parent.get(n["id"], [])
        lib = next(l for l in self.libraries if l["id"] == lib_id)
        return {"library": lib, "roots": by_parent.get(None, [])}

    async def __call__(self, ctx_, method, path, params=None, body=None, timeout=None):
        self.calls.append({"method": method, "path": path, "params": dict(params or {}), "body": copy.deepcopy(body)})
        params = params or {}
        if params.get("instituteId") not in (None, INST):
            return {"error": "fetch_failed", "status": 403}
        if path.endswith("/folder-library/libraries"):
            return copy.deepcopy(self.libraries)
        if path.endswith("/folder-library/tree"):
            return self.tree(params["libraryId"])
        if path.endswith("/folder-library/library") and method == "POST":
            self._ids += 1
            lib = {"id": f"lib-new-{self._ids}", "institute_id": INST, "name": body["name"], "node_count": 0}
            self.libraries.append(lib)
            self.nodes[lib["id"]] = []
            return lib
        if path.endswith("/folder-library/node") and method == "POST":
            lib = params["libraryId"]
            if any(n.get("slug") == body.get("slug") for n in self.nodes[lib]):
                return {"error": "fetch_failed", "status": 400}
            self._ids += 1
            self.nodes[lib].append(_node(f"new-{self._ids}", body.get("title"), body.get("slug"),
                                         parent=body.get("parent_id"), status=body.get("status") or "ACTIVE",
                                         **{k: v for k, v in body.items() if k not in
                                            ("title", "slug", "parent_id", "status", "node_type")}))
            return self.tree(lib)
        if path.endswith("/folder-library/node") and method == "PUT":
            for lib, nodes in self.nodes.items():
                for n in nodes:
                    if n["id"] == params["nodeId"]:
                        n.update(body)
                        return self.tree(lib)
            return {"error": "fetch_failed", "status": 400}
        if path.endswith("/course-catalogue/institute/get-all"):
            return copy.deepcopy(self.catalogues)
        m = re.search(r"/open/v1/audience/campaign/([^/]+)/([^/]+)$", path)
        if m:
            c = self.campaigns.get(m.group(2))
            return copy.deepcopy(c) if c and m.group(1) == INST else {"error": "fetch_failed", "status": 404}
        m = re.search(r"/course/v1/update-course/([^/]+)$", path)
        if m and method == "PUT":
            self.course_updates[m.group(1)] = copy.deepcopy(body)
            COURSES[m.group(1)]["comma_separated_tags"] = ",".join(t.lower().strip() for t in body["tags"])
            return "Course updated successfully"
        if path.endswith("/product-page/get-all"):
            return copy.deepcopy(self.pages)
        if path.endswith("/product-page/create"):
            page = {"id": "pp-new", "institute_id": INST, "name": body["name"], "code": "abc123", "status": "DRAFT",
                    "mappings": body["mappings"]}
            self.pages.append(page)
            return page
        m = re.search(r"/product-page/([^/]+)/sync-catalogue$", path)
        if m:
            return {"id": m.group(1), "added": 1, "deactivated": 0, "added_package_session_ids": ["ps-b"],
                    "skipped": [{"package_session_id": "ps-c", "reason": "cpo_not_supported",
                                 "package_name": "Course C", "level_name": "default"}],
                    "warnings": []}
        return {"error": "fetch_failed", "status": 404}


#: Stored course rows (what the SQL read returns), this institute's only.
COURSES = {}

_BASE_COURSES = {
    "c-1": {"id": "c-1", "package_name": "Gita Natyam", "status": "ACTIVE", "thumbnail_file_id": "f-1",
            "is_course_published_to_catalaouge": True, "course_preview_image_media_id": "m-1",
            "course_banner_media_id": "m-2", "course_media_id": None, "why_learn": "<p>why</p>",
            "who_should_learn": "<p>who</p>", "about_the_course": "<p>about</p>",
            "comma_separated_tags": "english,shastra", "course_depth": 5, "course_html_description": "<p>d</p>"},
    "c-2": {"id": "c-2", "package_name": "Rajaswala", "status": "ACTIVE", "thumbnail_file_id": None,
            "is_course_published_to_catalaouge": False, "course_preview_image_media_id": None,
            "course_banner_media_id": None, "course_media_id": None, "why_learn": None, "who_should_learn": None,
            "about_the_course": None, "comma_separated_tags": None, "course_depth": None,
            "course_html_description": None},
    "c-3": {"id": "c-3", "package_name": "Mixed", "status": "ACTIVE", "thumbnail_file_id": None,
            "is_course_published_to_catalaouge": True, "course_preview_image_media_id": None,
            "course_banner_media_id": None, "course_media_id": None, "why_learn": None, "who_should_learn": None,
            "about_the_course": None, "comma_separated_tags": "English, Hindi", "course_depth": None,
            "course_html_description": None},
}

TODAY = date.today()


def _sell(ps, course, name, *, bridge, invite, tag="DEFAULT", plan="pl", price=100.0, po="po", ptype="ONE_TIME",
          status="ACTIVE", start=None, end=None, level="default"):
    return {"package_session_id": ps, "course_id": course, "course_name": name, "level_name": level,
            "session_name": "default", "bridge_id": bridge, "invite_id": invite, "invite_name": f"{invite} link",
            "invite_tag": tag, "invite_status": status, "invite_start": start, "invite_end": end,
            "invite_vendor": "RAZORPAY", "invite_currency": "INR", "payment_option_id": po, "payment_type": ptype,
            "plan_id": plan, "price": price, "plan_currency": "INR"}


SELLABLE = [
    # c-1: one batch; DEFAULT invite with two plans (cheapest wins) and a promo invite.
    _sell("ps-1", "c-1", "Gita Natyam", bridge="b-1", invite="inv-def", plan="pl-hi", price=500.0),
    _sell("ps-1", "c-1", "Gita Natyam", bridge="b-1", invite="inv-def", plan="pl-lo", price=300.0),
    _sell("ps-1", "c-1", "Gita Natyam", bridge="b-2", invite="inv-promo", tag="PROMO", plan="pl-p", price=1.0),
    # c-2: two batches (EN / HI).
    _sell("ps-2en", "c-2", "Rajaswala", bridge="b-3", invite="inv-2", plan="pl-2", level="English"),
    _sell("ps-2hi", "c-2", "Rajaswala", bridge="b-4", invite="inv-3", plan="pl-3", level="Hindi"),
]

CATALOGUE_SELLABLE = [
    _sell("ps-a", "c-9", "Already sold", bridge="b-a", invite="inv-a"),
    _sell("ps-b", "c-1", "Gita Natyam", bridge="b-1", invite="inv-def"),
    _sell("ps-c", "c-8", "Course C", bridge="b-c", invite="inv-c", ptype="CPO"),
    _sell("ps-d", "c-7", "Old", bridge="b-d", invite="inv-d", end=TODAY - timedelta(days=3)),
]


@pytest.fixture
def backend(monkeypatch):
    COURSES.clear()
    COURSES.update(copy.deepcopy(_BASE_COURSES))
    be = Backend()
    created = set()
    monkeypatch.setattr(website_data, "_admin_core_json", be)
    monkeypatch.setattr(tool, "_admin_core_json", be)
    monkeypatch.setattr(tool, "_admin_base", lambda ctx_: "https://admin.test")
    monkeypatch.setattr(edit_mod, "_is_institute_asset", lambda url: url.startswith("https://cdn.vacademy.test/"))
    monkeypatch.setattr(tool, "load_course_rows",
                        lambda ctx_, ids: {i: copy.deepcopy(COURSES[i]) for i in ids if i in COURSES})
    monkeypatch.setattr(tool, "load_sellable_rows",
                        lambda ctx_, ids=None: [r for r in SELLABLE if r["course_id"] in ids] if ids is not None
                        else list(CATALOGUE_SELLABLE))
    monkeypatch.setattr(tool, "created_by_tool", lambda ctx_, kind, rid: rid in created)

    def _record(ctx_, kind, rid):
        created.add(rid)
        return True
    monkeypatch.setattr(tool, "record_created", _record)
    be.created = created
    return be


async def run(args):
    return json.loads(await tool.execute_catalog_data_edit(args, ctx()))


def writes(be):
    return [c for c in be.calls if c["method"] != "GET"]


# ── registry / gating ────────────────────────────────────────────────────
def setting(enabled):
    return normalize_setting({"enabled": True, "allowed_roles": ["ADMIN"], "enabled_tools": list(enabled)})


def test_own_off_by_default_mcp_only_group():
    spec = ASSISTANT_TOOLS["catalog_data_edit"]
    assert spec.mode == "WRITE" and spec.key() == "website_data_edits" and spec.mcp_only
    assert not spec.default_enabled and not spec.default_roles
    assert not is_tool_allowed("catalog_data_edit", principal(), None)
    assert "catalog_data_edit" in MCP_EXPOSED_TOOLS and "catalog_data_edit" in MCP_ALLOWED_WRITE_TOOLS
    rationale = MCP_ALLOWED_WRITE_TOOLS["catalog_data_edit"]
    for words in ("additive only", "never deletes or renames", "HIDDEN", "appended", "DRAFT"):
        assert words in rationale
    # Existing connections (website view / edit / design import on) do not get it.
    for enabled in (["website_builder"], ["website_builder", "website_builder_edits", "design_import"]):
        assert "catalog_data_edit" not in [t.name for t in adapter.list_tools_for(principal(), setting(enabled))]
    tools = adapter.list_tools_for(principal(), setting(["website_builder", "website_data_edits"]))
    t = next(t for t in tools if t.name == "catalog_data_edit")
    assert t.annotations.read_only_hint is False
    assert set(t.input_schema["properties"]["action"]["enum"]) == set(tool.CATALOG_DATA_EDIT_ACTIONS)
    # Never offered to the in-product assistant, even when the group is on.
    offered = build_offered_tools(principal(), {"enabled_tools": ["website_data_edits"], "role_overrides": {}})
    assert "catalog_data_edit" not in json.dumps(offered)


def test_settings_catalogue_places_it_under_website_as_live_additive():
    entry = next(c for c in adapter.tool_catalog() if c["name"] == "catalog_data_edit")
    assert (entry["key"], entry["area"], entry["level"], entry["risk"]) == (
        "website_data_edits", "website", "edit", "live_additive")
    assert entry["label"] == "Website: set up course data" and entry["sub_label"]
    assert "hidden" in entry["summary"] and "DRAFT" in entry["summary"]


def test_no_activate_or_invite_actions():
    assert not {"activate_product_page", "update_invite", "delete", "rename"} & set(tool.CATALOG_DATA_EDIT_ACTIONS)


# ── no delete / rename path ──────────────────────────────────────────────
def test_source_has_no_delete_rename_move_or_activate_call():
    src = Path(tool.__file__).read_text()
    calls = re.findall(r'_admin_core_json\(\s*ctx,\s*"([A-Z]+)",\s*f?"([^"]+)"', src)
    assert calls, "the tool's admin-core calls are listed"
    allowed = {
        ("GET", "/admin-core-service/v1/folder-library/tree"),
        ("GET", "/admin-core-service/v1/product-page/get-all"),
        ("POST", "/admin-core-service/v1/folder-library/library"),
        ("POST", "/admin-core-service/v1/folder-library/node"),
        ("PUT", "/admin-core-service/v1/folder-library/node"),
        ("PUT", "/admin-core-service/course/v1/update-course/{course_id}"),
        ("POST", "/admin-core-service/v1/product-page/create"),
        ("POST", "/admin-core-service/v1/product-page/{page['id']}/sync-catalogue"),
    }
    assert set(calls) <= allowed, set(calls) - allowed
    for forbidden in ('"DELETE"', "/node/move", "/product-page/update", "/delete", "update-course-details",
                      "enroll-invite", '"deactivateMissing": "true"'):
        assert forbidden not in src
    # The one PUT on folders only ever changes the fields that differ, never the title / slug / status / parent.
    assert tool._KEPT_ON_MATCH == ("title",)


@pytest.mark.asyncio
async def test_every_applied_action_sends_only_additive_calls(backend):
    backend.created.add("lib-1")    # so existing folders may be edited
    await run({"action": "create_folder_library", "name": "Paths", "dry_run": False})
    await run({"action": "upsert_folder_nodes", "library_id": "lib-1", "dry_run": False, "nodes": [
        {"key": "shastra", "title": "Renamed?", "tagline": "Texts", "parent_key": "gita"},
        {"key": "kala", "title": "Kala", "course_tag": "Kala"},
    ]})
    await run({"action": "add_course_tags", "dry_run": False, "assignments": [{"course_id": "c-1", "add": ["format-video"]}]})
    await run({"action": "create_product_page", "name": "Path", "dry_run": False, "items": [{"course_id": "c-1"}]})
    await run({"action": "sync_store", "product_page_code": "forbvy", "dry_run": False})
    sent = {(c["method"], re.sub(r"/(c-1|pp-1)(/|$)", r"/{id}\2", c["path"])) for c in writes(backend)}
    assert sent == {
        ("POST", "/admin-core-service/v1/folder-library/library"),
        ("POST", "/admin-core-service/v1/folder-library/node"),
        ("PUT", "/admin-core-service/v1/folder-library/node"),
        ("PUT", "/admin-core-service/course/v1/update-course/{id}"),
        ("POST", "/admin-core-service/v1/product-page/create"),
        ("POST", "/admin-core-service/v1/product-page/{id}/sync-catalogue"),
    }, sent
    for call in writes(backend):
        assert call["method"] in ("POST", "PUT"), call
        assert not call["path"].endswith(("/library",)) or call["method"] == "POST", call
        assert "/node/move" not in call["path"] and "delete" not in call["path"].lower()
        if call["method"] == "PUT" and call["path"].endswith("/folder-library/node"):
            assert not {"title", "slug", "status", "parent_id", "node_type"} & set(call["body"]), call["body"]
            assert all(v not in ("", None) for v in call["body"].values()), "never clears a field"
        if call["path"].endswith("/sync-catalogue"):
            assert call["params"]["deactivateMissing"] == "false"
    shastra = next(n for n in backend.nodes["lib-1"] if n["id"] == "n-1")
    assert shastra["title"] == "Shastra" and shastra["parent_id"] is None and shastra["tagline"] == "Texts"


# ── dry runs ─────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_every_action_is_a_dry_run_by_default(backend):
    outs = [
        await run({"action": "create_folder_library", "name": "Paths"}),
        await run({"action": "upsert_folder_nodes", "library_id": "lib-2", "nodes": [{"key": "a", "title": "A"}]}),
        await run({"action": "add_course_tags", "assignments": [{"course_id": "c-1", "add": ["format-video"]}]}),
        await run({"action": "create_product_page", "name": "Path", "items": [{"course_id": "c-1"}]}),
        await run({"action": "sync_store", "product_page_code": "forbvy"}),
    ]
    assert all(o["dry_run"] is True and "Nothing was written" in o["next"] for o in outs), outs
    assert writes(backend) == []


# ── create_folder_library ────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_create_library_records_it_and_refuses_a_duplicate_name(backend):
    out = await run({"action": "create_folder_library", "name": "Learning Paths", "dry_run": False})
    assert out["library"]["id"] in backend.created
    again = await run({"action": "create_folder_library", "name": "learning paths", "dry_run": False})
    assert again["error"] == "library_exists" and again["library_id"] == out["library"]["id"]
    assert sum(1 for c in writes(backend) if c["path"].endswith("/library")) == 1


# ── upsert_folder_nodes ──────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_new_folders_are_hidden_slugged_and_parents_first(backend):
    out = await run({"action": "upsert_folder_nodes", "library_id": "lib-2", "dry_run": False, "nodes": [
        {"key": "Rishi Gyan", "title": "Rishi Gyan", "parent_key": "shastra2"},
        {"key": "shastra2", "title": "Shastra", "image_url": ASSET, "audience_id": "aud-1", "coming_soon": True,
         "accent_color": "#aa3300", "cta": "Explore", "subtitle": "", "tagline": None},
    ]})
    assert [c["key"] for c in out["created"]] == ["shastra2", "rishi-gyan"]
    posts = [c["body"] for c in writes(backend)]
    assert all(b["status"] == "HIDDEN" and b["node_type"] == "FOLDER" for b in posts)
    assert posts[0]["slug"] == "shastra2" and "parent_id" not in posts[0]
    assert posts[1]["slug"] == "rishi-gyan" and posts[1]["parent_id"] == out["created"][0]["id"]
    assert posts[0]["cta_label"] == "Explore" and posts[0]["image_url"] == ASSET
    assert "subtitle" not in posts[0] and "tagline" not in posts[0], "empty values are never sent"


@pytest.mark.asyncio
async def test_matched_folder_changes_only_what_differs_and_keeps_title_and_parent(backend):
    out = await run({"action": "upsert_folder_nodes", "library_id": "lib-2", "nodes": [{"key": "x", "title": "X"}]})
    assert out["create"][0]["status"] == "HIDDEN"
    backend.created.add("lib-1")
    plan = await run({"action": "upsert_folder_nodes", "library_id": "lib-1", "nodes": [
        {"key": "shastra", "title": "Shastra!", "subtitle": "Scriptures", "tagline": "Texts", "parent_key": "gita"},
        {"key": "swasthya", "course_tag": "swasthya"},       # derived key; course_tag differs from None
        {"key": "gita", "title": "Gita"},                     # nothing differs
    ]})
    upd = {u["key"]: u for u in plan["update"]}
    assert upd["shastra"]["changes"] == {"tagline": {"before": None, "after": "Texts"}}
    assert set(upd["shastra"]["kept"]) == {"title", "parent_key"} and "kept_note" in plan
    assert upd["swasthya"]["id"] == "n-3"
    assert [u["key"] for u in plan["unchanged"]] == ["gita"]
    assert plan["create"] == []


@pytest.mark.asyncio
async def test_existing_folders_of_a_live_library_are_left_alone(backend):
    out = await run({"action": "upsert_folder_nodes", "library_id": "lib-1", "dry_run": False, "nodes": [
        {"key": "shastra", "tagline": "Texts"},
        {"key": "kala", "title": "Kala"},
    ]})
    assert out["refused"][0]["key"] == "shastra" and "main" in out["refused"][0]["reason"]
    assert [c["key"] for c in out["created"]] == ["kala"], "a HIDDEN addition is still fine"
    assert not any(c["method"] == "PUT" for c in backend.calls)


@pytest.mark.asyncio
async def test_unreadable_site_list_fails_closed_for_edits(backend, monkeypatch):
    async def broken(ctx_):
        return {"error": "fetch_failed"}
    monkeypatch.setattr(tool, "list_catalogues", broken)
    out = await run({"action": "upsert_folder_nodes", "library_id": "lib-1", "nodes": [{"key": "shastra", "tagline": "T"}]})
    assert out["update"] == [] and out["refused"]


@pytest.mark.asyncio
@pytest.mark.parametrize("node, field", [
    ({"key": "a", "title": "A", "image_url": "https://evil.example/x.png"}, "image_url"),
    ({"key": "a", "title": "A", "audience_id": "aud-2"}, "audience_id"),      # paused campaign
    ({"key": "a", "title": "A", "audience_id": "aud-404"}, "audience_id"),    # not this institute's
    ({"key": "a", "title": "A", "accent_color": "red"}, "accent_color"),
    ({"key": "a", "title": "A", "link_url": "javascript:alert(1)"}, "link_url"),
    ({"key": "a", "title": "A", "parent_key": "nope"}, "parent_key"),
    ({"key": "a"}, "title"),
    ({"key": "forbvy", "title": "Clash"}, "key"),                             # a product-page leaf's slug
    ({"key": "a", "title": "A", "status": "ACTIVE"}, "status"),               # visibility is not an input
])
async def test_invalid_folder_is_reported_and_nothing_is_written(backend, node, field):
    out = await run({"action": "upsert_folder_nodes", "library_id": "lib-1", "dry_run": False, "nodes": [node]})
    assert out["error"] == "invalid_nodes" and field in out["errors"][0]["field"], out
    assert writes(backend) == []


@pytest.mark.asyncio
async def test_upsert_limits_and_scope(backend):
    many = [{"key": f"k{i}", "title": "T"} for i in range(tool.MAX_NODES + 1)]
    assert (await run({"action": "upsert_folder_nodes", "library_id": "lib-1", "nodes": many}))["error"] == "too_many_nodes"
    out = await run({"action": "upsert_folder_nodes", "library_id": "lib-other", "nodes": [{"key": "a", "title": "A"}]})
    assert out["error"] == "unknown_library" and {"id": "lib-1", "name": "Knowledge Streams"} in out["available"]
    dup = await run({"action": "upsert_folder_nodes", "library_id": "lib-2",
                     "nodes": [{"key": "a", "title": "A"}, {"key": "A", "title": "B"}]})
    assert dup["error"] == "invalid_nodes"
    cycle = await run({"action": "upsert_folder_nodes", "library_id": "lib-2", "nodes": [
        {"key": "a", "title": "A", "parent_key": "b"}, {"key": "b", "title": "B", "parent_key": "a"}]})
    assert cycle["error"] == "invalid_nodes" and "cycle" in cycle["errors"][0]["message"]


# ── add_course_tags ──────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_tags_are_appended_through_a_full_round_trip(backend):
    plan = await run({"action": "add_course_tags", "assignments": [
        {"course_id": "c-1", "add": ["Format eBook", "shastra", "for-students"]},
        {"course_id": "c-2", "add": ["for-womens-health"]},
    ]})
    c1 = next(c for c in plan["changes"] if c["course_id"] == "c-1")
    assert c1["before"] == ["english", "shastra"] and c1["add"] == ["format-ebook", "for-students"]
    assert c1["after"] == ["english", "shastra", "format-ebook", "for-students"]
    assert c1["normalised"] == {"Format eBook": "format-ebook"}
    out = await run({"action": "add_course_tags", "dry_run": False, "assignments": [
        {"course_id": "c-1", "add": ["Format eBook", "shastra", "for-students"]},
        {"course_id": "c-2", "add": ["for-womens-health"]},
    ]})
    body = backend.course_updates["c-1"]
    stored = _BASE_COURSES["c-1"]
    assert body == {
        "package_name": stored["package_name"], "thumbnail_file_id": "f-1", "is_course_published_to_catalaouge": True,
        "course_preview_image_media_id": "m-1", "course_banner_media_id": "m-2", "course_media_id": None,
        "why_learn_html": "<p>why</p>", "who_should_learn_html": "<p>who</p>", "about_the_course_html": "<p>about</p>",
        "tags": ["english", "shastra", "format-ebook", "for-students"], "course_depth": 5,
        "course_html_description_html": "<p>d</p>",
    }
    assert backend.course_updates["c-2"]["tags"] == ["for-womens-health"]
    assert backend.course_updates["c-2"]["is_course_published_to_catalaouge"] is False
    applied = {a["course_id"]: a for a in out["applied"]}
    assert applied["c-1"]["after"] == ["english", "shastra", "format-ebook", "for-students"]


@pytest.mark.asyncio
async def test_tags_already_there_and_capitalised_existing_tags(backend):
    out = await run({"action": "add_course_tags", "dry_run": False, "assignments": [
        {"course_id": "c-1", "add": ["English"]},
        {"course_id": "c-3", "add": ["format-live"]},
    ]})
    assert out["unchanged"][0]["course_id"] == "c-1"
    assert out["refused"][0]["course_id"] == "c-3" and "English" in out["refused"][0]["reason"]
    assert backend.course_updates == {}


@pytest.mark.asyncio
async def test_tag_assignments_are_validated_all_or_nothing(backend):
    out = await run({"action": "add_course_tags", "dry_run": False, "assignments": [
        {"course_id": "c-1", "add": ["ok"]}, {"course_id": "other-inst", "add": ["x"]}, {"course_id": "c-2", "add": ["हिन्दी"]},
    ]})
    assert out["error"] == "invalid_assignments" and len(out["errors"]) == 2
    assert backend.course_updates == {}
    too_many = [{"course_id": f"c{i}", "add": ["x"]} for i in range(tool.MAX_COURSES + 1)]
    assert (await run({"action": "add_course_tags", "assignments": too_many}))["error"] == "too_many_courses"


# ── create_product_page ──────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_product_page_is_a_draft_on_the_default_invite_and_cheapest_plan(backend):
    out = await run({"action": "create_product_page", "name": "Women's health path", "dry_run": False, "items": [
        {"course_id": "c-1"}, {"course_id": "c-2", "package_session_id": "ps-2hi"}]})
    create = next(c for c in writes(backend) if c["path"].endswith("/product-page/create"))
    assert create["params"] == {"instituteId": INST}
    assert create["body"]["status"] == "DRAFT"
    assert create["body"]["mappings"] == [
        {"ps_invite_payment_option_id": "b-1", "payment_plan_id": "pl-lo", "preselected": False, "display_order": 0},
        {"ps_invite_payment_option_id": "b-4", "payment_plan_id": "pl-3", "preselected": False, "display_order": 1},
    ]
    assert json.loads(create["body"]["settings_json"]) == tool.DEFAULT_PRODUCT_PAGE_SETTINGS
    assert out["product_page"]["status"] == "DRAFT" and out["product_page"]["code"] == "abc123"
    assert out["editor_url"].endswith("/manage-pages/product-pages/editor/pp-new")
    assert "activates" in out["next"]


@pytest.mark.asyncio
async def test_product_page_items_are_checked(backend):
    ambiguous = await run({"action": "create_product_page", "name": "P", "items": [{"course_id": "c-2"}]})
    assert ambiguous["error"] == "invalid_items" and "package_session_id" in ambiguous["errors"][0]["message"]
    assert len(ambiguous["errors"][0]["batches"]) == 2
    store = await run({"action": "create_product_page", "name": "Store", "role": "store", "items": [{"course_id": "c-2"}]})
    assert [s["package_session_id"] for s in store["steps"]] == ["ps-2en", "ps-2hi"]
    promo = await run({"action": "create_product_page", "name": "P", "items": [{"course_id": "c-1", "invite_id": "inv-promo"}]})
    assert promo["steps"][0]["invite_id"] == "inv-promo"
    foreign = await run({"action": "create_product_page", "name": "P", "items": [{"course_id": "c-1", "invite_id": "inv-x"}]})
    assert foreign["error"] == "invalid_items"
    unknown = await run({"action": "create_product_page", "name": "P", "items": [{"course_id": "zz"}]})
    assert unknown["error"] == "invalid_items"
    dup = await run({"action": "create_product_page", "name": "for bvy", "items": [{"course_id": "c-1"}]})
    assert dup["error"] == "product_page_exists" and dup["product_page"]["code"] == "forbvy"
    assert writes(backend) == []


def test_pick_mapping_follows_the_catalogue_sync_rules():
    pick = tool.pick_mapping
    assert pick([])[1] == "no_active_invite"
    assert pick([_sell("p", "c", "n", bridge="b", invite="i", tag="PROMO")])[1] == "non_default_invite"
    assert pick([_sell("p", "c", "n", bridge="b", invite="i", end=TODAY - timedelta(days=1))])[1] == "invite_expired"
    assert pick([_sell("p", "c", "n", bridge="b", invite="i", start=TODAY + timedelta(days=1))])[1] == "invite_not_started"
    assert pick([_sell("p", "c", "n", bridge="b", invite="i", status="INACTIVE")])[1] == "invite_inactive"
    assert pick([_sell("p", "c", "n", bridge="b", invite="i", ptype="CPO")])[1] == "cpo_not_supported"
    assert pick([_sell("p", "c", "n", bridge="b", invite="i", po=None)])[1] == "payment_option_inactive"
    assert pick([_sell("p", "c", "n", bridge="b", invite="i", plan=None, price=None)])[1] == "no_active_plan"
    # An open DEFAULT link beats a closed one.
    rows = [_sell("p", "c", "n", bridge="b1", invite="old", end=TODAY - timedelta(days=1), price=1.0),
            _sell("p", "c", "n", bridge="b2", invite="new", price=9.0)]
    assert pick(rows)[0]["bridge_id"] == "b2"


# ── sync_store ───────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_sync_store_preview_and_apply(backend):
    preview = await run({"action": "sync_store", "product_page_code": "forbvy"})
    assert [r["package_session_id"] for r in preview["would_add"]] == ["ps-b"]
    reasons = {r["package_session_id"]: r["reason"] for r in preview["would_skip"]}
    assert reasons == {"ps-c": "cpo_not_supported", "ps-d": "invite_expired"}
    assert preview["already_sold"] == 1
    out = await run({"action": "sync_store", "product_page_code": "forbvy", "dry_run": False})
    call = next(c for c in writes(backend) if c["path"].endswith("/sync-catalogue"))
    assert call["path"] == "/admin-core-service/v1/product-page/pp-1/sync-catalogue"
    assert call["params"] == {"instituteId": INST, "deactivateMissing": "false"}
    assert out["added"] == 1 and out["skipped"][0]["reason"] == "cpo_not_supported" and "CPO" in out["skipped"][0]["why"]
    assert "deactivated" not in out
    unknown = await run({"action": "sync_store", "product_page_code": "nope", "dry_run": False})
    assert unknown["error"] == "unknown_product_page" and unknown["available"][0]["code"] == "forbvy"


# ── the call surface ─────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_secrets_and_unknown_actions_are_refused(backend):
    out = await run({"action": "create_folder_library", "name": "x", "api_key": "sk-123"})
    assert out["error"] == "secret_not_accepted" and "sk-123" not in json.dumps(out)
    act = await run({"action": "activate_product_page", "product_page_code": "forbvy"})
    assert act["error"] == "unknown_action" and "admin clicks" in act["message"]
    assert writes(backend) == []


def test_slugify_matches_the_learner_folder_rule():
    from app.services.catalogue_course_rules import folder_slug
    for raw in ("Format eBook", "Rishi Gyan", "Shiksha & Kala", "Ā-yurveda"):
        assert tool.slugify(raw) == folder_slug({"title": raw})


def test_created_records_are_per_institute(monkeypatch):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    db = sessionmaker(bind=create_engine("sqlite://"))()
    monkeypatch.setattr(tool, "_schema_ready", False)
    mine = ToolContext(db=db, principal=principal(), keys=(), bearer_token="jwt")
    other = ToolContext(db=db, principal=PinnedPrincipal(user_id="u-2", institute_id="inst-2", roles=["ADMIN"],
                                                         permissions=[], is_root_user=False), keys=(), bearer_token="jwt")
    assert tool.created_by_tool(mine, "folder_library", "lib-9") is False
    assert tool.record_created(mine, "folder_library", "lib-9") is True
    assert tool.created_by_tool(mine, "folder_library", "lib-9") is True
    assert tool.created_by_tool(other, "folder_library", "lib-9") is False


def test_data_reads_point_at_the_tool_only_when_this_caller_has_it():
    from app.services.assistant_tools_website import _data_change_advice

    def gated(enabled):
        return ToolContext(db=_Db(), principal=principal(), keys=(), bearer_token="jwt",
                           gate_setting={"enabled_tools": enabled, "role_overrides": {}}, gate_checked=True)
    with_tool = _data_change_advice(gated(["website_builder", "website_data_edits"]))
    without = _data_change_advice(gated(["website_builder"]))
    assert "catalog_data_edit" in with_tool and "dry run first" in with_tool
    assert "catalog_data_edit" not in without and "admin task in the dashboard" in without
    assert "catalog_data_edit" not in _data_change_advice(ctx()), "an unchecked gate never advertises the tool"
