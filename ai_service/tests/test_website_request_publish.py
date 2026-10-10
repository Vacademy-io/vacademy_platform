"""
website_edit(action='request_publish'): the hand-over check, never a publish.

It reads the draft and the live site, runs the dashboard's publish checks, the
data audit and the review (fidelity mode for pages built from a design), and
returns ready + blockers, a structural diff against live, admin-core's
stale-draft verdict and the editor link. The tests pin down: it only ever GETs
(no save, publish or discard); a stale draft is "not ready" with the server's
revision numbers; a clean draft is "ready" with the editor link; a faithful
Brahm Varchas page is judged in its design's mode; and nothing about the
existing actions or ``load_site`` changes for callers that do not ask.
"""
import copy
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402

from app.mcp.constants import MCP_ALLOWED_WRITE_TOOLS  # noqa: E402
from app.mcp.server import SERVER_INSTRUCTIONS  # noqa: E402
from app.services import assistant_tools_website as website_mod  # noqa: E402
from app.services import assistant_tools_website_edit as edit_mod  # noqa: E402
from app.services import course_builder_data  # noqa: E402
from app.services import website_data  # noqa: E402
from app.services.assistant_tools_website_edit import diff_site_configs  # noqa: E402

import test_website_data_audit as data_audit_tests  # noqa: E402
from test_website_tools import CATALOGUE_ROW, fake_admin_core, sample_config  # noqa: E402
from test_website_edit_tool import ctx  # noqa: E402

FIXTURE = (Path(__file__).resolve().parents[2] / "frontend-admin-dashboard" / "src" / "routes" / "manage-pages"
           / "-components" / "__fixtures__" / "brahm-varchas-site.json")

#: POST endpoints that only search (the course list, campaigns, leads).
_POST_READS = ("/open/packages/v2/search", "/v1/audience/campaigns", "/v1/audience/leads")

CLEAN_AUDIT = {"summary": {"error": 0, "warning": 0, "info": 0, "courses_checked": 3}, "issues": [],
               "truncated": None, "library": None}


def bv_site():
    if not FIXTURE.exists():
        pytest.skip("Brahm Varchas site fixture not present")
    return json.loads(FIXTURE.read_text())


def with_design(config):
    """Every page built from a Figma frame (what create_page(design_source=…) records)."""
    out = copy.deepcopy(config)
    for p in out["pages"]:
        p["meta"] = {"designSource": {"kind": "figma", "nodeId": "1:2"}}
    return out


class Backend:
    """admin-core for one site: `live` is the published JSON, `draft` the open draft (or None)."""

    def __init__(self, monkeypatch, live, draft=None, stale=False, base=None):
        self.calls = []
        self.live, self.draft, self.stale = live, draft, stale
        self.base = base or fake_admin_core([])
        monkeypatch.setattr(website_data, "_admin_core_json", self._call)
        monkeypatch.setattr(edit_mod, "_admin_core_json", self._call)
        monkeypatch.setattr(website_mod, "_admin_core_json", self._call)

    def row(self):
        return {**CATALOGUE_ROW, "catalogue_json": json.dumps(self.live)}

    async def _call(self, ctx_, method, path, params=None, body=None, timeout=None):
        self.calls.append((method, path))
        if path.endswith("/course-catalogue/institute/get-all"):
            return [self.row()]
        if path.endswith("/course-catalogue/institute/get/by-tag"):
            return self.row()
        if path.endswith("/revision/draft"):
            if self.draft is None:
                return {"error": "fetch_failed", "status": 204}
            draft = {"id": "rev-d", "revision_no": 12, "source": "AI_COPILOT", "catalogue_json": json.dumps(self.draft),
                     "created_at": "2026-10-01T00:00:00", "updated_at": "2026-10-09T00:00:00",
                     "live_revision_no": 11, "live_updated_at": "2026-09-30T00:00:00",
                     "live_changed_since_draft": False}
            if self.stale:
                draft.update({"live_changed_since_draft": True, "live_revision_no": 14,
                              "live_updated_at": "2026-10-08T12:00:00"})
            return draft
        return await self.base(ctx_, method, path, params=params, body=body, timeout=timeout)

    def assert_read_only(self):
        assert self.calls, "the action should have read the site"
        # Reads only: GETs, plus the POST search endpoints the data inventory reads through.
        writes = [(m, p) for m, p in self.calls if m != "GET" and not p.endswith(_POST_READS)]
        assert writes == [], writes
        assert not [p for _, p in self.calls if "publish" in p or "save-draft" in p or "discard" in p
                    or p.endswith(("/course-catalogue/update", "/course-catalogue/create", "/save-setting"))]


def clean_data_audit(monkeypatch):
    async def _audit(ctx_, config, library_id=None):
        return CLEAN_AUDIT
    monkeypatch.setattr(website_mod, "site_data_audit", _audit)


async def run(args):
    return json.loads(await edit_mod.execute_website_edit({"action": "request_publish", **args}, ctx()))


# ── registry / wording ───────────────────────────────────────────────────
def test_action_is_listed_and_described_as_never_publishing():
    props = edit_mod.WEBSITE_EDIT_SCHEMA["function"]["parameters"]["properties"]
    assert "request_publish" in props["action"]["enum"]
    desc = edit_mod.WEBSITE_EDIT_SCHEMA["function"]["description"]
    assert "request_publish" in desc and "NEVER publishes" in desc
    assert "request_publish only reads" in MCP_ALLOWED_WRITE_TOOLS["website_edit"]
    assert "request_publish" in SERVER_INSTRUCTIONS and "never say the site is live" in SERVER_INSTRUCTIONS


# ── stale draft ──────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_a_stale_draft_is_not_ready_with_the_servers_revision_numbers(monkeypatch):
    live = sample_config()
    draft = copy.deepcopy(live)
    draft["pages"][0]["title"] = "Old draft home"
    be = Backend(monkeypatch, live, draft, stale=True)
    out = await run({"tag_name": "main-site"})
    assert out["action"] == "request_publish"
    assert out["ready"] is False and out["verdict"] == "not_ready"
    [blocker] = out["blockers"]
    assert blocker["code"] == "stale_draft" and "v12" in blocker["message"] and "v14" in blocker["message"]
    assert "undo" in blocker["message"]
    assert out["stale_draft"]["draft_revision_no"] == 12 and out["stale_draft"]["live_revision_no"] == 14
    assert out["live_revision_no"] == 14 and out["draft_revision_no"] == 12
    # The diff is of the stale draft itself (load_site shows the live site for reads), labelled as mixed.
    assert out["diff_vs_live"]["pages"]["changed"][0]["page_fields"] == ["title"]
    assert "undo" in out["diff_vs_live"]["note"]
    assert out["checks"].startswith("skipped")
    assert "manage-pages/editor/main-site" in out["editor_url"]
    assert "never publishes" in out["note"]
    be.assert_read_only()


# ── nothing to publish ───────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_without_a_draft_there_is_nothing_to_publish(monkeypatch):
    be = Backend(monkeypatch, sample_config())
    out = await run({"tag_name": "main-site"})
    assert out["ready"] is False and out["verdict"] == "nothing_to_publish"
    assert [b["code"] for b in out["blockers"]] == ["no_draft"]
    assert "manage-pages/editor/main-site" in out["editor_url"]
    be.assert_read_only()


@pytest.mark.asyncio
async def test_a_draft_equal_to_live_changes_nothing(monkeypatch):
    live = sample_config()
    # Same tree, different key order / formatting: admin-core's sameJson says equal, so do we.
    draft = json.loads(json.dumps(live, sort_keys=True))
    be = Backend(monkeypatch, live, draft)
    out = await run({"tag_name": "main-site"})
    assert out["verdict"] == "nothing_to_publish" and [b["code"] for b in out["blockers"]] == ["no_changes"]
    assert out["diff_vs_live"]["changed"] is False
    be.assert_read_only()


@pytest.mark.asyncio
async def test_unknown_site_is_an_error(monkeypatch):
    Backend(monkeypatch, sample_config())
    out = await run({"tag_name": "not-ours"})
    assert out["error"] and out["action"] == "request_publish"


# ── a fresh draft ────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_a_draft_with_problems_lists_its_blockers_and_the_diff(monkeypatch):
    live = sample_config()
    draft = copy.deepcopy(live)
    draft["pages"][0]["components"][1]["props"]["left"]["title"] = "Crack NEET 2028"
    draft["pages"][0]["components"].insert(2, {"id": "c-faq", "type": "faqSection", "enabled": True, "props": {}})
    be = Backend(monkeypatch, live, draft)
    clean_data_audit(monkeypatch)
    out = await run({"tag_name": "main-site"})
    assert out["ready"] is False and out["verdict"] == "not_ready"
    codes = [b["code"] for b in out["blockers"]]
    # The sample site's hero button and product-page offer are unwired: the dashboard's own checks fail.
    assert "publish_check_errors" in codes
    assert out["checks"]["publish_checks"]["error_count"] >= 2
    assert all("page_id" not in e for e in out["checks"]["publish_checks"]["errors"])
    # Standard pages are reviewed as before (no design → standard mode, score bar 85).
    assert "review_failed" in codes and out["checks"]["review"]["failing"]
    assert all("mode" not in p for p in out["checks"]["review"]["pages"].values())
    home = out["diff_vs_live"]["pages"]["changed"][0]
    assert home["route"] == "home"
    assert [(s["id"], s["type"]) for s in home["sections"]["added"]] == [("c-faq", "faqSection")]
    assert [s["id"] for s in home["sections"]["changed"]] == ["c-hero"]
    assert any("Page 'home'" in line for line in out["diff_vs_live"]["summary"])
    assert out["draft_revision_no"] == 12 and out["live_revision_no"] == 11
    assert "never publishes" in out["note"]
    be.assert_read_only()


@pytest.mark.asyncio
async def test_a_clean_design_draft_is_ready_with_the_editor_link(monkeypatch):
    live = with_design(bv_site())
    draft = copy.deepcopy(live)
    draft["pages"][0]["seo"] = {**(draft["pages"][0].get("seo") or {}), "metaDescription": "Brahm Varchas courses"}
    draft["globalSettings"]["theme"]["contentMaxWidth"] = 1200
    be = Backend(monkeypatch, live, draft)
    clean_data_audit(monkeypatch)
    out = await run({"tag_name": "main-site"})
    assert out["ready"] is True and out["verdict"] == "ready" and out["blockers"] == []
    assert "manage-pages/editor/main-site" in out["editor_url"]
    # Each page is reviewed in the mode it was built in: the design wins over the landing rules.
    assert {p["mode"] for p in out["checks"]["review"]["pages"].values()} == {"fidelity"}
    assert all(p["passes"] for p in out["checks"]["review"]["pages"].values())
    diff = out["diff_vs_live"]
    assert diff["pages"]["changed"] == [{"route": draft["pages"][0]["route"], "page_fields": ["seo"]}]
    assert "theme.contentMaxWidth" in diff["settings"]
    assert out["next"].startswith("Ready")
    be.assert_read_only()


@pytest.mark.asyncio
async def test_the_same_faithful_site_without_its_design_fails_standard_review(monkeypatch):
    """Without design_source the BV home page is judged as a landing page (the plan's 48/100)."""
    live = bv_site()
    draft = copy.deepcopy(live)
    draft["pages"][0]["seo"] = {"metaDescription": "changed"}
    Backend(monkeypatch, live, draft)
    clean_data_audit(monkeypatch)
    out = await run({"tag_name": "main-site"})
    assert out["ready"] is False and "review_failed" in [b["code"] for b in out["blockers"]]


@pytest.mark.asyncio
async def test_data_errors_block_and_come_with_their_links(monkeypatch):
    """The real data audit runs (the data-audit tests' institute: a paid course on an unconfigured gateway)."""
    live = copy.deepcopy(data_audit_tests.SITE)
    draft = copy.deepcopy(live)
    draft["pages"][0]["title"] = "Courses"
    calls = []
    be = Backend(monkeypatch, live, draft, base=data_audit_tests.fake_admin_core(calls))

    async def vendors(ctx_, strict=False):
        return [{"vendor": "RAZORPAY", "vendor_id": "rzp"}]
    monkeypatch.setattr(course_builder_data, "payment_vendors", vendors)
    out = json.loads(await edit_mod.execute_website_edit(
        {"action": "request_publish", "tag_name": "main-site"},
        data_audit_tests.ctx()))
    blockers = {b["code"]: b for b in out["blockers"]}
    assert "data_errors" in blockers and blockers["data_errors"]["count"] >= 1
    errors = out["checks"]["data_audit"]["errors"]
    assert any(e["check"] == "invite_vendor_unconfigured" for e in errors)
    be.assert_read_only()


@pytest.mark.asyncio
async def test_a_failed_data_audit_is_a_warning_not_a_clean_bill(monkeypatch):
    live = with_design(bv_site())
    draft = copy.deepcopy(live)
    draft["pages"][0]["title"] = "Brahm Varchas — home"
    Backend(monkeypatch, live, draft)

    async def boom(ctx_, config, library_id=None):
        raise RuntimeError("inventory down")
    monkeypatch.setattr(website_mod, "site_data_audit", boom)
    out = await run({"tag_name": "main-site"})
    assert out["checks"]["data_audit"] == {"error": "unavailable"}
    assert "data_audit_unavailable" in [w["code"] for w in out["warnings"]]


@pytest.mark.asyncio
async def test_a_server_that_does_not_report_staleness_gets_a_warning(monkeypatch):
    live = with_design(bv_site())
    draft = copy.deepcopy(live)
    draft["pages"][0]["title"] = "Brahm Varchas — home"
    be = Backend(monkeypatch, live, draft)
    clean_data_audit(monkeypatch)
    out = await run({"tag_name": "main-site"})
    assert out["live_changed_since_draft"] is False
    assert "stale_check_unavailable" not in [w["code"] for w in out["warnings"]]

    real = be._call

    async def older_server(ctx_, method, path, params=None, body=None, timeout=None):
        data = await real(ctx_, method, path, params=params, body=body, timeout=timeout)
        if path.endswith("/revision/draft"):
            data = {k: v for k, v in data.items() if not k.startswith("live_")}
        return data
    monkeypatch.setattr(website_data, "_admin_core_json", older_server)
    out = await run({"tag_name": "main-site"})
    assert out["live_changed_since_draft"] is None and "live_revision_no" not in out
    assert "stale_check_unavailable" in [w["code"] for w in out["warnings"]]


# ── load_site stays as it was for everyone else ──────────────────────────
@pytest.mark.asyncio
async def test_load_site_without_with_live_is_unchanged(monkeypatch):
    live = sample_config()
    draft = copy.deepcopy(live)
    draft["pages"][0]["title"] = "Draft"
    Backend(monkeypatch, live, draft)
    site, err = await website_data.load_site(ctx(), "main-site")
    assert err is None and set(site) == {"tag_name", "catalogue_id", "status", "is_default", "config",
                                         "from_draft", "draft"}
    site, _ = await website_data.load_site(ctx(), "main-site", with_live=True)
    assert site["live_config"]["pages"][0]["title"] == "Home"
    assert site["draft_config"]["pages"][0]["title"] == "Draft"
    assert site["revisions"]["live_revision_no"] == 11


# ── the diff itself ──────────────────────────────────────────────────────
def test_diff_reports_pages_sections_settings_layout_and_translations():
    live = sample_config()
    live["globalSettings"]["layout"] = {"header": {"id": "h", "type": "header", "props": {"title": "A"}},
                                        "footer": {"id": "f", "type": "footer", "props": {}}}
    live["globalSettings"]["i18n"] = {"enabled": True, "strings": {"hi": {"Home": "होम", "About": "परिचय"}}}
    draft = copy.deepcopy(live)
    home = draft["pages"][0]["components"]
    home.remove(next(c for c in home if c["id"] == "c-text"))
    home.reverse()                                                             # every remaining section moves
    draft["pages"][1]["route"] = "about-us"                                    # same page id, renamed
    draft["pages"].append({"id": "p-new", "route": "admissions", "components": []})
    draft["globalSettings"]["theme"]["palette"] = {"primary": "#112233"}
    draft["globalSettings"]["mode"] = "dark"
    draft["globalSettings"]["layout"]["header"]["props"]["title"] = "B"
    del draft["globalSettings"]["layout"]["footer"]
    draft["globalSettings"]["i18n"]["strings"]["hi"] = {"Home": "मुखपृष्ठ", "Courses": "पाठ्यक्रम"}
    d = diff_site_configs(live, draft)
    assert d["changed"] is True
    assert d["pages"]["added"] == ["admissions"]
    changed = {p["route"]: p for p in d["pages"]["changed"]}
    assert changed["home"]["sections"]["removed"][0]["id"] == "c-text"
    assert changed["home"]["sections"]["reordered"] is True
    assert changed["about-us"]["renamed_from"] == "about" and "sections" not in changed["about-us"]
    assert d["settings"] == ["mode", "theme.palette"]
    assert d["layout"] == {"footer": "removed", "header": "changed"}
    assert d["translations"] == {"hi": {"added": 1, "removed": 1, "changed": 1}}
    assert "pages_reordered" not in d and "reordered" not in d["pages"]
    assert any(line.startswith("New page(s)") for line in d["summary"])


def test_diff_spots_page_reorder_and_removal_and_unreadable_live():
    live = sample_config()
    draft = copy.deepcopy(live)
    draft["pages"].reverse()
    d = diff_site_configs(live, draft)
    assert d["pages"]["reordered"] is True and "Page order changed." in d["summary"]
    draft = copy.deepcopy(live)
    draft["pages"].pop()
    assert diff_site_configs(live, draft)["pages"]["removed"] == ["about"]
    d = diff_site_configs(None, live)
    assert d["live_unreadable"] is True and d["pages"]["added"] == ["home", "about"]
    assert diff_site_configs(live, copy.deepcopy(live)) == {"changed": False,
                                                            "summary": ["The draft is the same as the live site."]}
