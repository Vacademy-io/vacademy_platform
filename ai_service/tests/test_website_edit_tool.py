"""
`website_edit`: draft-only changes to a website.

Two things matter here. The pure pieces (brief → composer text, theme → global
settings, the copilot ops port) must behave exactly like the dashboard, and the
actions must (a) never write anything but a DRAFT revision, (b) never place an
id the institute does not own, and (c) turn the page builder's failures
(credits, bad input) into recoverable tool errors.
"""
import json
import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402
from fastapi import HTTPException  # noqa: E402

from app.routers import page_builder as pb  # noqa: E402
from app.schemas.auth import PinnedPrincipal  # noqa: E402
from app.services import assistant_tools_website_edit as edit_mod  # noqa: E402
from app.services import website_data  # noqa: E402
from app.services.assistant_tool_registry import ASSISTANT_TOOLS, ToolContext, is_tool_allowed  # noqa: E402
from app.services.assistant_tools_website_edit import (  # noqa: E402
    apply_ops,
    brief_to_text,
    describe_ops,
    merge_global_settings,
    theme_to_global_patch,
)

from test_website_tools import CAMPAIGN, CATALOGUE_ROW, _FakeDb, fake_admin_core, sample_config  # noqa: E402


def principal(roles=("ADMIN",)):
    return PinnedPrincipal(user_id="user-1", institute_id="inst-1", roles=list(roles), permissions=[], is_root_user=False)


def ctx(roles=("ADMIN",)):
    return ToolContext(db=_FakeDb(), principal=principal(roles), keys=(), bearer_token="jwt")


class _Recorder:
    """Captures the draft saves / site creates the actions make."""
    def __init__(self):
        self.saved = []
        self.created = []
        self.discarded = 0


@pytest.fixture
def backend(monkeypatch):
    calls = []
    rec = _Recorder()
    base = fake_admin_core(calls)

    async def _call(ctx_, method, path, params=None, body=None, timeout=None):
        if path.endswith("/revision/save-draft"):
            rec.saved.append({"catalogue_id": params["catalogueId"], **body, "config": json.loads(body["catalogue_json"])})
            return {"id": f"rev-{len(rec.saved)}", "revision_no": 10 + len(rec.saved), "status": "DRAFT"}
        if path.endswith("/course-catalogue/create"):
            rec.created.append(body["catalogues"][0])
            return {"ok": True}
        if path.endswith("/revision/discard-draft"):
            rec.discarded += 1
            return {"error": "fetch_failed", "status": 204}
        if path.endswith("/course-catalogue/institute/get-all") and rec.created:
            # A freshly created site becomes loadable.
            rows = [CATALOGUE_ROW] + [
                {"id": f"cat-new-{i}", "tag_name": c["tag_name"], "status": "DRAFT", "is_default": False,
                 "catalogue_json": c["catalogue_json"]} for i, c in enumerate(rec.created)
            ]
            return rows
        if path.endswith("/course-catalogue/institute/get/by-tag") and rec.created:
            for i, c in enumerate(rec.created):
                if c["tag_name"] == params["tagName"]:
                    return {"id": f"cat-new-{i}", "tag_name": c["tag_name"], "status": "DRAFT",
                            "is_default": False, "catalogue_json": c["catalogue_json"]}
        return await base(ctx_, method, path, params=params, body=body, timeout=timeout)

    monkeypatch.setattr(website_data, "_admin_core_json", _call)
    monkeypatch.setattr(edit_mod, "_admin_core_json", _call)
    return rec


def _with_draft(monkeypatch, config):
    """Make the site load with a pending draft carrying `config`."""
    async def _draft(ctx_, catalogue_id):
        return {"id": "rev-d", "revision_no": 7, "source": "MANUAL", "catalogue_json": json.dumps(config)}
    monkeypatch.setattr(website_data, "get_draft", _draft)


async def run(args, c=None):
    return json.loads(await edit_mod.execute_website_edit(args, c or ctx()))


# ── registry / gating ────────────────────────────────────────────────────
def test_write_tool_is_off_by_default_for_everyone():
    spec = ASSISTANT_TOOLS["website_edit"]
    assert spec.mode == "WRITE" and spec.key() == "website_builder_edits"
    assert not is_tool_allowed("website_edit", principal(("ADMIN",)), None)
    assert is_tool_allowed("website_edit", principal(("ADMIN",)), {"enabled_tools": ["website_builder_edits"], "role_overrides": {}})


# ── pure pieces ──────────────────────────────────────────────────────────
def test_brief_to_text_is_dense_and_complete():
    text = brief_to_text({
        "identity": "Acme Coaching, Pune's NEET specialists.",
        "proof_points": ["92% selection rate", "14 years"],
        "audience": "adults", "tone": "premium",
        "theme": {"primary_color": "#1D4ED8", "mode": "dark", "fonts": {"body": "Inter", "heading": "Fraunces"}},
        "images": [{"url": "https://cdn/x.png", "kind": "logo"}, {"url": "https://cdn/y.jpg"}],
        "contact": {"phone": "+91 99", "socials": ["instagram.com/acme"]},
        "sections_wanted": ["hero", "courses", "testimonials"],
        "language": "Hindi",
    }, page_type="homepage")
    for needle in ("Acme Coaching", "Page type: homepage", "92% selection rate", "Audience: adults", "Tone: premium",
                   "brand colour #1D4ED8", "dark mode", "Fraunces / Inter", "1 logo", "1 photo",
                   "phone: +91 99", "instagram.com/acme", "hero → courses → testimonials", "Hindi"):
        assert needle in text, needle


def test_theme_to_global_patch_mirrors_brand_kit_mapping():
    patch = theme_to_global_patch({
        "preset": "ocean", "primary_color": "#1d4ed8", "mode": "dark",
        "fonts": {"body": "Poppins", "heading": "Playfair Display"},
        "border_radius": "pill", "heading_scale": "display", "atmosphere": "aurora", "motion": "dynamic",
    })
    assert patch["theme"] == {"preset": "ocean", "primaryColor": "#1D4ED8", "borderRadius": "pill",
                              "headingScale": "display", "atmosphere": {"canvas": "aurora", "intensity": "medium"}}
    assert patch["mode"] == "dark"
    assert patch["motion"] == {"personality": "dynamic"}
    assert patch["fonts"] == {"enabled": True, "family": "Poppins, sans-serif", "headingFamily": '"Playfair Display", serif'}


def test_theme_patch_accepts_brand_kit_field_names_and_drops_junk():
    patch = theme_to_global_patch({"themePreset": "rose", "primaryColor": "not-a-hex", "fontFamily": "Inter",
                                   "headingFontFamily": "Inter", "borderRadius": "weird", "motion": "calm"})
    # No exact colour with a new preset clears any stale override.
    assert patch["theme"] == {"preset": "rose", "primaryColor": None}
    assert patch["fonts"] == {"enabled": True, "family": "Inter, sans-serif"}   # same heading font not stored
    assert patch["motion"] == {"personality": "calm"}
    assert theme_to_global_patch({"nonsense": 1}) == {}


def test_merge_global_settings_clears_none_inside_objects():
    gs = merge_global_settings({"theme": {"preset": "default", "primaryColor": "#000000"}, "mode": "light"},
                               {"theme": {"preset": "rose", "primaryColor": None}})
    assert gs == {"theme": {"preset": "rose"}, "mode": "light"}


def test_apply_ops_matches_the_dashboard():
    cfg = sample_config()
    ops = [
        {"op": "insert", "component": {"id": "c-new", "type": "faqSection", "props": {}}, "afterId": "c-hero", "note": "Added FAQs"},
        {"op": "update", "id": "c-contact", "propsPatch": {"heading": "Talk to us", "audienceId": None}},
        {"op": "remove", "id": "c-text"},
        {"op": "move", "id": "c-lead", "afterId": None},
        {"op": "updateGlobalSettings", "patch": {"theme": {"preset": "rose"}, "mode": "dark"}},
    ]
    out = apply_ops(cfg, "p-home", ops)
    home = [c["id"] for c in out["pages"][0]["components"]]
    assert home == ["c-lead", "c-header", "c-hero", "c-new", "c-courses", "c-offer"]
    assert out["globalSettings"]["theme"] == {"preset": "rose", "primaryColor": "#1D4ED8", "borderRadius": "rounded"}
    assert out["globalSettings"]["mode"] == "dark"
    # update/remove reach slot children on the SAME page only; the contact form lives on 'about'.
    about = apply_ops(cfg, "p-about", [{"op": "update", "id": "c-contact", "propsPatch": {"heading": "Talk to us", "audienceId": None}}])
    contact = about["pages"][1]["components"][0]["props"]["slots"][0][0]
    assert contact["props"]["heading"] == "Talk to us" and "audienceId" not in contact["props"]
    assert cfg["pages"][0]["components"][0]["id"] == "c-header"   # input untouched
    assert describe_ops(ops)[0] == "Added FAQs" and "Removed section c-text" in describe_ops(ops)


# ── actions ──────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_missing_arguments_are_named():
    out = await run({"action": "edit_page"})
    assert out["error"] == "missing_argument" and out["needs"] == ["instruction"]
    out = await run({"action": "generate_page", "tag_name": "main-site", "brief": {"tone": "warm"}})
    assert out["error"] == "missing_argument" and out["needs"] == ["brief.identity"]


@pytest.mark.asyncio
async def test_set_theme_saves_a_draft_only(backend):
    out = await run({"action": "set_theme", "tag_name": "main-site", "theme": {"preset": "rose", "primary_color": "#FF0055"}})
    assert out["saved_as"] == "draft" and out["draft_revision_no"] == 11
    assert backend.saved[0]["source"] == "AI_COPILOT"
    assert backend.saved[0]["config"]["globalSettings"]["theme"]["primaryColor"] == "#FF0055"
    assert out["settings"]["theme"]["preset"] == "rose"
    assert "manage-pages/editor/main-site" in out["editor_url"]
    assert not [c for c in backend.saved if c.get("publish")]


@pytest.mark.asyncio
async def test_set_seo_and_add_section(backend):
    out = await run({"action": "set_seo", "tag_name": "main-site", "page_route": "about", "meta_description": "About Acme"})
    assert backend.saved[-1]["config"]["pages"][1]["seo"]["metaDescription"] == "About Acme"
    assert not any("About" in e["title"] for e in out["audit"]["errors"])

    out = await run({"action": "add_section", "tag_name": "main-site", "page_route": "home",
                     "section_type": "leadForm", "after_section_id": "c-hero", "props": {"title": "Book a seat", "audienceId": "evil"}})
    comps = backend.saved[-1]["config"]["pages"][0]["components"]
    assert comps[2]["type"] == "leadForm" and comps[2]["props"]["title"] == "Book a seat"
    assert comps[2]["props"]["audienceId"] == ""            # wiring never comes from props/example
    assert out["section"]["label"] == "Lead Form" and out["editor_url"].endswith(f"section={comps[2]['id']}")
    assert any(e["title"] == "A Lead Form section has no campaign selected" for e in out["audit"]["errors"])

    out = await run({"action": "add_section", "tag_name": "main-site", "section_type": "notAThing"})
    assert out["error"] == "unknown_section_type"


@pytest.mark.asyncio
async def test_link_lead_form_validates_and_wires_every_surface(backend):
    out = await run({"action": "link_lead_form", "tag_name": "main-site", "page_route": "home", "section_id": "c-hero", "audience_id": "camp-1"})
    hero = backend.saved[-1]["config"]["pages"][0]["components"][1]
    assert hero["props"]["left"]["buttons"][0]["audienceId"] == "camp-1"
    assert "Admissions 2027" in out["summary_of_change"]
    assert not any("no campaign" in e["title"] for e in out["audit"]["errors"])

    out = await run({"action": "link_lead_form", "tag_name": "main-site", "page_route": "about", "section_id": "c-contact", "audience_id": "camp-1"})
    contact = backend.saved[-1]["config"]["pages"][1]["components"][0]["props"]["slots"][0][0]
    assert contact["props"]["audienceId"] == "camp-1" and contact["props"]["audienceName"] == "Admissions 2027"

    out = await run({"action": "link_lead_form", "tag_name": "main-site", "page_route": "home", "section_id": "c-hero", "audience_id": "camp-x"})
    assert out["error"] == "unknown_campaign"
    out = await run({"action": "link_lead_form", "tag_name": "main-site", "page_route": "home", "section_id": "c-text", "audience_id": "camp-1"})
    assert out["error"] == "not_a_form"


@pytest.mark.asyncio
async def test_set_courses_checks_ownership(backend):
    out = await run({"action": "set_courses", "tag_name": "main-site", "page_route": "home", "section_id": "c-courses",
                     "source": "showcase", "mode": "picked", "course_ids": ["course-1", "course-9"]})
    assert out["error"] == "unknown_course" and out["ids"] == ["course-9"]
    out = await run({"action": "set_courses", "tag_name": "main-site", "page_route": "home", "section_id": "c-courses",
                     "source": "showcase", "mode": "picked", "course_ids": ["course-1"], "limit": 4})
    props = backend.saved[-1]["config"]["pages"][0]["components"][2]["props"]
    assert props["source"] == "picked" and props["courseIds"] == ["course-1"] and props["limit"] == 4
    out = await run({"action": "set_courses", "tag_name": "main-site", "page_route": "home", "section_id": "c-offer",
                     "source": "product_page", "product_page_code": "neet27"})
    props = backend.saved[-1]["config"]["pages"][0]["components"][3]["props"]
    assert props["productPageCode"] == "NEET27" and props["productPageName"] == "NEET Batches"
    assert not any("product page" in e["title"] for e in out["audit"]["errors"])
    out = await run({"action": "set_courses", "tag_name": "main-site", "page_route": "home", "section_id": "c-offer",
                     "source": "product_page", "product_page_code": "nope"})
    assert out["error"] == "unknown_product_page"


@pytest.mark.asyncio
async def test_generate_page_into_existing_site_keeps_its_theme(backend, monkeypatch):
    seen = {}

    async def fake_generate(body, db=None, current_user=None):
        seen["body"] = body
        seen["user"] = current_user
        return pb.GeneratePageResponse(
            page={"id": "gen-1", "route": "admissions", "title": "Admissions",
                  "components": [{"id": "g-hero", "type": "heroSection", "props": {"left": {"title": "Join us"}}}]},
            global_settings={"theme": {"preset": "midnight"}}, run_id="run-1", model="m", warnings=["w1"],
        )
    monkeypatch.setattr(pb, "generate_page", fake_generate)

    out = await run({"action": "generate_page", "tag_name": "main-site", "page_type": "admissions",
                     "brief": {"identity": "Acme Coaching", "proof_points": ["14 years"]}, "course_ids": ["course-1"]})
    body = seen["body"]
    assert seen["user"].institute_id == "inst-1" and seen["user"].user_id == "user-1"
    assert body.page_type == "admissions" and "14 years" in body.brief and body.institute_name == "Acme Coaching"
    assert [c.name for c in body.courses] == ["NEET 2027"]                 # only the picked course
    assert body.global_settings["theme"]["preset"] == "ocean"               # existing look pinned
    saved = backend.saved[-1]
    assert saved["source"] == "AI_WIZARD" and saved["ai_run_id"] == "run-1"
    routes = [p["route"] for p in saved["config"]["pages"]]
    assert routes == ["home", "about", "admissions"]
    assert saved["config"]["globalSettings"]["theme"]["preset"] == "ocean"  # composer's proposal ignored
    assert saved["config"]["globalSettings"]["brandProfile"]["identity"] == "Acme Coaching"
    assert out["page_route"] == "admissions" and out["warnings"] == ["w1"] and out["saved_as"] == "draft"


@pytest.mark.asyncio
async def test_generate_page_creates_a_new_site_with_the_brief_theme(backend, monkeypatch):
    async def fake_generate(body, db=None, current_user=None):
        assert body.global_settings["theme"]["primaryColor"] == "#FF0055"
        return pb.GeneratePageResponse(page={"id": "gen-1", "route": "homepage", "components": []},
                                       global_settings={"fonts": {"enabled": True, "family": "Lora, serif"}}, run_id="r", model="m")
    monkeypatch.setattr(pb, "generate_page", fake_generate)
    out = await run({"action": "generate_page", "new_site_name": "Acme Coaching!", "page_type": "homepage",
                     "brief": {"identity": "Acme", "theme": {"primary_color": "#FF0055", "preset": "rose"}}})
    assert out["created_site"] is True and out["tag_name"] == "acme-coaching"
    created = json.loads(backend.created[0]["catalogue_json"])
    assert backend.created[0]["status"] == "DRAFT"
    assert created["globalSettings"]["theme"]["primaryColor"] == "#FF0055"
    assert created["globalSettings"]["fonts"]["family"] == "Lora, serif"
    assert created["globalSettings"]["payment"]["enabled"] is True          # dashboard defaults kept
    assert backend.saved[-1]["catalogue_id"] == "cat-new-0"


@pytest.mark.asyncio
async def test_builder_errors_become_tool_errors(backend, monkeypatch):
    async def broke(body, db=None, current_user=None):
        raise HTTPException(status_code=402, detail="Insufficient credits (balance 3).")
    monkeypatch.setattr(pb, "generate_page", broke)
    out = await run({"action": "generate_page", "tag_name": "main-site", "brief": {"identity": "x"}})
    assert out["error"] == "insufficient_credits" and "balance 3" in out["message"]
    assert backend.saved == []


@pytest.mark.asyncio
async def test_edit_page_applies_ops_to_the_draft(backend, monkeypatch):
    draft = sample_config()
    draft["pages"][0]["title"] = "Home (draft)"
    _with_draft(monkeypatch, draft)

    async def fake_edit(body, db=None, current_user=None):
        assert body.page["id"] == "p-home" and body.selected_component_id == "c-hero"
        return pb.EditPageResponse(
            ops=[{"op": "update", "id": "c-hero", "propsPatch": {"left": {"title": "Crack NEET 2027 — batch starts June"}}, "note": "Sharpened the headline"},
                 {"op": "remove", "id": "c-text", "note": "Removed placeholder text"}],
            reply="Done: sharper headline, placeholder removed.", run_id="run-e", model="m",
        )
    monkeypatch.setattr(pb, "edit_page", fake_edit)
    out = await run({"action": "edit_page", "tag_name": "main-site", "page_route": "home", "section_id": "c-hero", "instruction": "punchier hero"})
    saved = backend.saved[-1]
    assert saved["source"] == "AI_COPILOT" and saved["ai_run_id"] == "run-e"
    assert saved["config"]["pages"][0]["title"] == "Home (draft)"            # built on the draft, not published
    ids = [c["id"] for c in saved["config"]["pages"][0]["components"]]
    assert "c-text" not in ids
    assert out["changes"] == ["Sharpened the headline", "Removed placeholder text"]
    assert out["summary_of_change"].startswith("Done")


@pytest.mark.asyncio
async def test_edit_page_with_no_ops_saves_nothing(backend, monkeypatch):
    async def fake_edit(body, db=None, current_user=None):
        return pb.EditPageResponse(ops=[], reply="Nothing to change.", run_id="r", model="m")
    monkeypatch.setattr(pb, "edit_page", fake_edit)
    out = await run({"action": "edit_page", "tag_name": "main-site", "instruction": "keep it"})
    assert out["saved_as"] is None and backend.saved == []


@pytest.mark.asyncio
async def test_edit_chrome_merges_returned_settings(backend, monkeypatch):
    async def fake_chrome(body, db=None, current_user=None):
        assert [p["route"] for p in body.pages] == ["home", "about"]
        return pb.SiteChromeResponse(global_settings={"theme": {"preset": "forest"}, "motion": {"personality": "calm"}},
                                     reply="Greener, calmer.", run_id="r", model="m")
    monkeypatch.setattr(pb, "edit_site_chrome", fake_chrome)
    out = await run({"action": "edit_chrome", "tag_name": "main-site", "instruction": "make it green and calm"})
    gs = backend.saved[-1]["config"]["globalSettings"]
    assert gs["theme"]["preset"] == "forest" and gs["theme"]["primaryColor"] == "#1D4ED8" and gs["motion"] == {"personality": "calm"}
    assert out["settings"]["theme"]["preset"] == "forest"


@pytest.mark.asyncio
async def test_discard_draft(backend, monkeypatch):
    out = await run({"action": "discard_draft", "tag_name": "main-site"})
    assert out["saved_as"] is None and backend.discarded == 0
    _with_draft(monkeypatch, sample_config())
    out = await run({"action": "discard_draft", "tag_name": "main-site"})
    assert backend.discarded == 1 and "back to its published" in out["summary_of_change"]


@pytest.mark.asyncio
async def test_import_image_refuses_non_https_and_non_images(backend, monkeypatch):
    out = await run({"action": "import_image", "url": "http://example.com/a.png"})
    assert out["error"] == "bad_request"
    monkeypatch.setattr(pb, "_is_public_http_host", lambda u: True)

    class _Resp:
        status_code = 200
        content = b"hello"
        headers = {"content-type": "text/html"}

    class _Client:
        def __init__(self, *a, **k): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def get(self, url, headers=None): return _Resp()
    import httpx
    monkeypatch.setattr(httpx, "AsyncClient", _Client)
    out = await run({"action": "import_image", "url": "https://example.com/a.png"})
    assert out["error"] == "not_an_image"


@pytest.mark.asyncio
async def test_generate_image_and_estimate(backend, monkeypatch):
    async def fake_image(body, db=None, current_user=None):
        assert body.kind == "logo" and body.count == 3
        return pb.GenerateImageResponse(urls=["https://cdn/1.png", "https://cdn/2.png"], model="m")
    monkeypatch.setattr(pb, "generate_page_image", fake_image)
    out = await run({"action": "generate_image", "prompt": "minimal owl logo", "kind": "logo", "count": 9})
    assert out["urls"] == ["https://cdn/1.png", "https://cdn/2.png"]

    async def fake_estimate(db=None, current_user=None):
        return {"estimated_credits": 12.5, "current_balance": 20.0, "sufficient": True}
    monkeypatch.setattr(pb, "estimate_page_generation", fake_estimate)
    out = await run({"action": "estimate", "scope": "site"})
    assert out["pages"] == 3 and out["estimated_total"] == 37.5 and out["sufficient"] is False
