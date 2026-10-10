"""
design_import end to end through the registry gate, with a real (SQLite)
ai_task table for the 24 h uploads: client payloads only (figma_url is refused),
no credentials accepted, chunked uploads under one import_id, institute
scoping, expiry, size caps, and save_draft going through website_edit's own
create_site / create_page — only for callers who hold website_edit.
"""
import json
import sys
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import pytest  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

from app.models.ai_task import AiTask  # noqa: E402
from app.schemas.auth import PinnedPrincipal  # noqa: E402
from app.services import assistant_tools_design_import as di  # noqa: E402
from app.services import assistant_tools_website_edit as edit_mod  # noqa: E402
from app.services.assistant_tool_registry import ToolContext, execute_tool  # noqa: E402

from test_figma_design_import import design_code, design_xml  # noqa: E402

VIEW = {"enabled_tools": ["website_builder"]}
EDIT = {"enabled_tools": ["website_builder", "website_builder_edits"]}


@pytest.fixture
def db(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'ai.db'}", connect_args={"check_same_thread": False})
    AiTask.metadata.create_all(engine, tables=[AiTask.__table__])
    session = sessionmaker(bind=engine, expire_on_commit=False)()
    yield session
    session.close()


def ctx(db, institute="inst-1"):
    p = PinnedPrincipal(user_id="user-1", institute_id=institute, roles=["ADMIN"], permissions=[], is_root_user=False)
    return ToolContext(db=db, principal=p, keys=(), bearer_token="jwt")


async def call(db, args, setting=VIEW, institute="inst-1"):
    return json.loads(await execute_tool("design_import", args, ctx(db, institute), setting))


def payload(**kw):
    return {"action": "plan", "source": "client", "metadata_xml": design_xml(),
            "design_code": [{"node_id": "9:1", "code": design_code()}], **kw}


# ── source and credentials ───────────────────────────────────────────────
@pytest.mark.asyncio
async def test_figma_url_is_not_supported_and_says_what_to_do(db):
    out = await call(db, {"action": "plan", "source": "figma_url", "url": "https://www.figma.com/design/AbCdEfGhIjKl/x"})
    assert out["error"] == "figma_url_not_supported"
    assert "get_metadata" in out["message"] and "source='client'" in out["message"]
    assert db.query(AiTask).count() == 0


@pytest.mark.asyncio
@pytest.mark.parametrize("key", ["figma_token", "access_token", "api_key", "Authorization", "pat"])
async def test_credentials_are_refused_and_never_echoed(db, key):
    out = await call(db, {**payload(), key: "figd_SECRET123"})
    assert out["error"] == "secret_not_accepted"
    assert "figd_SECRET123" not in json.dumps(out)
    assert db.query(AiTask).count() == 0


@pytest.mark.asyncio
async def test_the_tool_needs_the_website_view_group(db):
    out = await call(db, payload(), setting={"enabled_tools": ["website_builder_edits"]})
    assert out["error"] == "tool_not_permitted"


# ── plan + storage ───────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_plan_stores_the_upload_for_this_institute_and_returns_the_plan(db):
    out = await call(db, payload(url="https://www.figma.com/design/AbCdEfGhIjKl/Site?node-id=9-1&t=SHARE"))
    assert len(out["import_id"]) == 32 and out["expires_at"]
    assert out["tokens"]["palette"]["primary"] == "#8A2E00"
    assert [s["component"] for s in out["sections"]] == ["courseCatalog", "ctaBanner", "stepsProcess"]
    assert all("props_draft" not in s for s in out["sections"])        # the draft carries them once
    assert out["site_json_draft"]["pages"][0]["components"]
    assert out["design_url"] == "https://www.figma.com/design/AbCdEfGhIjKl/Site?node-id=9-1"   # share token dropped
    assert "DESIGN DATA" in out["rules"]
    row = db.get(AiTask, out["import_id"])
    assert row.task_type == "DESIGN_IMPORT" and row.institute_id == "inst-1"


@pytest.mark.asyncio
async def test_chunked_upload_plans_from_every_part(db):
    first = await call(db, {"action": "plan", "source": "client", "metadata_xml": design_xml(), "upload_only": True})
    assert "tokens" not in first and first["received"]["metadata_xml_documents"] == 1
    out = await call(db, {"action": "plan", "source": "client", "import_id": first["import_id"],
                          "design_code": [{"node_id": "9:1", "code": design_code()}]})
    assert out["import_id"] == first["import_id"]
    assert out["received"] == {**out["received"], "metadata_xml_documents": 1, "design_code_entries": 1}
    assert out["tokens"]["palette"]["text"] == "#1B1B1B"        # colours from part 2, sections from part 1
    assert out["sections"]


@pytest.mark.asyncio
async def test_another_institute_cannot_read_an_import(db):
    out = await call(db, payload())
    other = await call(db, {"action": "plan", "source": "client", "import_id": out["import_id"]}, institute="inst-2")
    assert other["error"] == "import_not_found"
    saved = await call(db, {"action": "save_draft", "import_id": out["import_id"], "new_site_name": "x"},
                       setting=EDIT, institute="inst-2")
    assert saved["error"] == "import_not_found"


@pytest.mark.asyncio
async def test_imports_expire_after_24_hours(db):
    out = await call(db, payload())
    row = db.get(AiTask, out["import_id"])
    row.created_at = row.created_at - timedelta(hours=25)
    db.commit()
    again = await call(db, {"action": "plan", "source": "client", "import_id": out["import_id"]})
    assert again["error"] == "import_not_found"
    assert db.get(AiTask, out["import_id"]) is None


@pytest.mark.asyncio
async def test_each_institute_keeps_a_bounded_number_of_imports(db, monkeypatch):
    monkeypatch.setattr(di, "MAX_IMPORTS_PER_INSTITUTE", 3)
    ids = [(await call(db, payload()))["import_id"] for _ in range(5)]
    left = {r.id for r in db.query(AiTask).all()}
    assert left == set(ids[-3:])


@pytest.mark.asyncio
async def test_size_caps(db, monkeypatch):
    monkeypatch.setattr(di, "MAX_CALL_BYTES", 1000)
    out = await call(db, payload())
    assert out["error"] == "too_large" and "import_id" in out["message"]
    monkeypatch.setattr(di, "MAX_CALL_BYTES", 2 * 1024 * 1024)
    monkeypatch.setattr(di, "MAX_CODE_ENTRIES", 1)
    first = await call(db, payload())
    more = await call(db, {"action": "plan", "source": "client", "import_id": first["import_id"],
                           "design_code": [{"node_id": "9:1", "code": "<div/>"}]})
    assert more["error"] == "too_large"


@pytest.mark.asyncio
@pytest.mark.parametrize("bad,err", [
    ({"metadata_xml": 5}, "bad_request"),
    ({"design_code": [{"node_id": "javascript:1", "code": "x"}]}, "bad_request"),
    ({"frame_ids": ["../etc"]}, "bad_request"),
    ({"import_id": "not-an-id"}, "bad_request"),
    ({"metadata_xml": '<!DOCTYPE a [<!ENTITY b "c">]><frame id="1:1" name="&b;"/>'}, "bad_xml"),
])
async def test_bad_arguments(db, bad, err):
    args = payload(**bad)
    if "metadata_xml" in bad and "DOCTYPE" not in str(bad["metadata_xml"]):
        args.pop("design_code")
    out = await call(db, args)
    assert out["error"] == err


@pytest.mark.asyncio
async def test_nothing_to_plan_without_a_payload(db):
    out = await call(db, {"action": "plan", "source": "client"})
    assert out["error"] == "missing_argument"


# ── save_draft ───────────────────────────────────────────────────────────
@pytest.fixture
def writes(monkeypatch):
    rec = {"sites": [], "pages": []}

    async def _site(args, ctx):
        rec["sites"].append(args)
        return {"editor_url": "https://dash/x", "created_site": True}

    async def _page(args, ctx):
        rec["pages"].append(args)
        return {"editor_url": "https://dash/x"}

    monkeypatch.setattr(edit_mod, "_action_create_site", _site)
    monkeypatch.setattr(edit_mod, "_action_create_page", _page)
    return rec


@pytest.mark.asyncio
async def test_save_draft_needs_website_edit(db, writes):
    out = await call(db, payload())
    saved = await call(db, {"action": "save_draft", "import_id": out["import_id"], "new_site_name": "acme"}, setting=VIEW)
    assert saved["error"] == "tool_not_permitted" and "Website: edit drafts" in saved["message"]
    assert writes["sites"] == [] and writes["pages"] == []


@pytest.mark.asyncio
async def test_save_draft_creates_a_new_draft_site_with_the_design_source(db, writes):
    out = await call(db, payload(url="https://www.figma.com/design/AbCdEfGhIjKl/Site?node-id=9-1"))
    saved = await call(db, {"action": "save_draft", "import_id": out["import_id"], "new_site_name": "Acme"},
                       setting=EDIT)
    assert "error" not in saved, saved
    (site,) = writes["sites"]
    assert site["new_site_name"] == "Acme"
    page = site["pages"][0]
    assert page["design_source"] == {"kind": "figma", "node_id": "9:1", "frame": "Courses – desktop",
                                     "url": "https://www.figma.com/design/AbCdEfGhIjKl/Site?node-id=9-1"}
    assert site["theme"]["palette"]["primary"] == "#8A2E00" and site["theme"]["content_max_width"] == 1152
    assert site["header"]["type"] == "header" and site["footer"]["type"] == "footer"
    assert saved["settings_calls"] is not None and saved["data_needs"]
    assert "<" not in json.dumps(site, ensure_ascii=False).replace("<p>", "").replace("</p>", "")


@pytest.mark.asyncio
async def test_save_draft_into_an_existing_site_adds_pages_and_leaves_its_chrome_and_theme(db, writes):
    out = await call(db, payload())
    corrected = {"pages": [{"route": "courses", "title": "Courses", "components": [
        {"id": "c", "type": "courseCatalog", "enabled": True, "props": {"hero": {"enabled": True}}}]}]}
    saved = await call(db, {"action": "save_draft", "import_id": out["import_id"], "tag_name": "main-site",
                            "site_json": corrected}, setting=EDIT)
    assert "error" not in saved
    (page,) = writes["pages"]
    assert page["tag_name"] == "main-site" and page["page_type"] == "catalog"
    assert page["page"]["components"][0]["props"] == {"hero": {"enabled": True}}     # the caller's JSON wins
    assert page["design_source"]["node_id"] == "9:1"
    assert "theme" not in page                                                         # apply_theme defaults off
    assert "chrome_not_applied" in saved


@pytest.mark.asyncio
async def test_save_draft_argument_checks(db, writes):
    out = await call(db, payload())
    both = await call(db, {"action": "save_draft", "import_id": out["import_id"], "new_site_name": "a", "tag_name": "b"},
                      setting=EDIT)
    assert both["error"] == "missing_argument"
    none = await call(db, {"action": "save_draft", "import_id": out["import_id"], "new_site_name": "a",
                           "pages": ["nope"]}, setting=EDIT)
    assert none["error"] == "nothing_to_save"
    assert writes["sites"] == []


@pytest.mark.asyncio
async def test_a_failed_save_is_reported(db, monkeypatch):
    async def _fail(args, ctx):
        return {"error": "create_failed", "message": "exists"}
    monkeypatch.setattr(edit_mod, "_action_create_site", _fail)
    out = await call(db, payload())
    saved = await call(db, {"action": "save_draft", "import_id": out["import_id"], "new_site_name": "a"}, setting=EDIT)
    assert saved["error"] == "create_failed"


# ── side effects elsewhere ───────────────────────────────────────────────
def test_uploads_stay_out_of_the_ai_task_history(db):
    from app.repositories.ai_task_repository import AiTaskRepository
    db.add(AiTask(id="a" * 32, task_type="DESIGN_IMPORT", status="COMPLETED", institute_id="inst-1", result_json="{}"))
    db.add(AiTask(id="b" * 32, task_type="LECTURE_PLANNER", status="COMPLETED", institute_id="inst-1"))
    db.commit()
    repo = AiTaskRepository(db)
    assert [t.id for t in repo.list_by_institute("inst-1")] == ["b" * 32]
    assert [t.id for t in repo.list_parentless("inst-1")] == ["b" * 32]


def test_design_payloads_are_digested_in_the_mcp_audit_log():
    from app.mcp import repository as repo_mod
    logged = json.loads(repo_mod._audit_args_json({"action": "plan", "metadata_xml": "<x/>" * 10,
                                                   "design_code": [{"code": "abc"}]}))
    assert logged["action"] == "plan"
    assert set(logged["metadata_xml"]) == {"bytes", "sha256"} and set(logged["design_code"]) == {"bytes", "sha256"}
