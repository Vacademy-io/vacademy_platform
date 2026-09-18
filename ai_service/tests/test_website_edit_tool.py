"""
`website_edit`: draft-only, model-free changes to a website.

The connected LLM composes the page JSON; this tool validates it with the AI
builder's own sanitiser, audits it, and saves a DRAFT. So the tests pin down:
the pure pieces (theme → global settings, the ops port) behave like the
dashboard; every action writes nothing but a draft; no id the institute does
not own is ever placed; foreign image URLs and unknown block types are stripped
with a warning rather than saved; and the audit's findings come back to the
caller to fix.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402
from app.schemas.auth import PinnedPrincipal  # noqa: E402
from app.services import assistant_tools_website_edit as edit_mod  # noqa: E402
from app.services import website_data  # noqa: E402
from app.services.assistant_tool_registry import ASSISTANT_TOOLS, ToolContext, is_tool_allowed  # noqa: E402
from app.services.assistant_tools_website_edit import (  # noqa: E402
    apply_ops,
    describe_ops,
    merge_global_settings,
    theme_to_global_patch,
)

from test_website_tools import CATALOGUE_ROW, _FakeDb, fake_admin_core, sample_config  # noqa: E402


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
    out = await run({"action": "update_page", "tag_name": "main-site"})
    assert out["error"] == "missing_argument" and out["needs"] == ["ops"]
    out = await run({"action": "create_page", "tag_name": "main-site", "page": {"route": "x"}})
    assert out["error"] == "missing_argument" and out["needs"] == ["page.components"]


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
    from app.routers import page_builder as pb
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


def test_default_layout_seeds_header_and_footer_from_pages():
    from app.services.assistant_tools_website_edit import default_layout
    layout = default_layout("Acme Coaching", [{"route": "home", "title": "Home"}, {"route": "admissions"}],
                            {"phone": "+91 99", "email": "hi@acme.edu"})
    assert layout["header"]["props"]["title"] == "Acme Coaching"
    assert [n["route"] for n in layout["header"]["props"]["navigation"]] == ["home", "admissions"]
    assert layout["header"]["props"]["navigation"][1]["label"] == "Admissions"
    assert layout["footer"]["props"]["leftSection"]["text"] == "+91 99 · hi@acme.edu"
    assert layout["footer"]["props"]["bottomNote"] == "© Acme Coaching"


# ── composing: the connected LLM writes the JSON, we validate and persist ──
OUR_IMG = "https://vacademy-media.s3.amazonaws.com/page-builder/imports/photo-1.png"
FOREIGN_IMG = "https://images.unsplash.com/photo-123"


def authored_page():
    return {
        "route": "admissions", "title": "Admissions 2027",
        "seo": {"metaTitle": "Admissions 2027 — Acme", "metaDescription": "Join Acme's NEET batches."},
        "components": [
            {"id": "hero", "type": "heroSection", "enabled": True, "props": {
                "layout": "split", "left": {"title": "Admissions open for NEET 2027", "subheading": "Batches of 25, daily doubts",
                                            "buttons": [{"text": "Apply now", "action": "navigate", "target": "#form"}]},
                "right": {"image": FOREIGN_IMG, "alt": "campus"}}},
            {"id": "proof", "type": "statsHighlights", "enabled": True, "props": {
                "headerText": "Results", "stats": [{"label": "Selections", "value": "92%"}, {"label": "Years", "value": "14"}]}},
            {"id": "gallery", "type": "imageBlock", "enabled": True, "props": {"image": OUR_IMG, "alt": "our campus"}},
            {"id": "nope", "type": "megaWidget", "props": {"x": 1}},
            {"id": "form", "type": "leadForm", "enabled": True, "props": {"title": "Enquire", "audienceId": ""}},
        ],
    }


@pytest.mark.asyncio
async def test_create_page_validates_audits_and_saves_a_draft(backend):
    out = await run({"action": "create_page", "tag_name": "main-site", "page_type": "admissions", "page": authored_page()})
    assert out["saved_as"] == "draft" and out["page_route"] == "admissions"
    saved = backend.saved[-1]["config"]
    page = saved["pages"][-1]
    types = [c["type"] for c in page["components"]]
    assert "megaWidget" not in types and "heroSection" in types and "leadForm" in types
    hero = next(c for c in page["components"] if c["type"] == "heroSection")
    assert not hero["props"].get("right", {}).get("image")              # foreign URL stripped
    gallery = next(c for c in page["components"] if c["type"] == "imageBlock")
    assert gallery["props"]["image"] == OUR_IMG                         # our asset kept
    assert page["seo"] == {"metaTitle": "Admissions 2027 — Acme", "metaDescription": "Join Acme's NEET batches."}
    assert any("megaWidget" in w for w in out["warnings"])
    assert isinstance(out["design_issues"], list)
    assert any(e["title"] == "A Lead Form section has no campaign selected" for e in out["audit"]["errors"])
    assert saved["globalSettings"]["theme"]["preset"] == "ocean"        # existing theme untouched
    assert backend.saved[-1]["source"] == "AI_COPILOT"


@pytest.mark.asyncio
async def test_create_page_refuses_a_page_with_no_valid_sections(backend):
    out = await run({"action": "create_page", "tag_name": "main-site", "page": {"route": "x", "components": [{"id": "a", "type": "nope", "props": {}}]}})
    assert out["error"] == "invalid_page" and backend.saved == []
    # One valid section IS a page when authored (course-details templates are
    # a single hero) — the composer's two-section floor does not apply here.
    out = await run({"action": "create_page", "tag_name": "main-site", "page": {"route": "x", "components": [
        {"id": "a", "type": "textBlock", "props": {"content": "<p>hi</p>"}}]}})
    assert out["saved_as"] == "draft" and len(backend.saved[-1]["config"]["pages"][-1]["components"]) == 1


@pytest.mark.asyncio
async def test_create_page_makes_a_new_site_with_theme_and_layout(backend):
    out = await run({"action": "create_page", "new_site_name": "Acme Coaching!", "page_type": "homepage",
                     "page": authored_page(), "theme": {"preset": "forest", "primary_color": "#0F766E", "fonts": {"body": "Inter", "heading": "Fraunces"}}})
    assert out["created_site"] is True and out["tag_name"] == "acme-coaching"
    created = json.loads(backend.created[0]["catalogue_json"])
    assert backend.created[0]["status"] == "DRAFT"
    gs = created["globalSettings"]
    assert gs["theme"]["preset"] == "forest" and gs["theme"]["primaryColor"] == "#0F766E"
    assert gs["fonts"]["headingFamily"] == "Fraunces, serif"
    assert gs["layout"]["header"]["props"]["title"] == "Acme Coaching"
    assert gs["layout"]["header"]["props"]["navigation"][0]["route"] == "admissions"
    assert gs["payment"]["enabled"] is True                            # dashboard defaults kept


@pytest.mark.asyncio
async def test_create_site_saves_every_valid_page_and_custom_chrome(backend):
    home = {**authored_page(), "route": "home", "title": "Home"}
    about = {"route": "about", "title": "About", "components": [
        {"id": "about-heading", "type": "sectionHeading", "props": {"title": "Who we are", "lead": "Fourteen years of NEET coaching."}},
        {"id": "about-text", "type": "textBlock", "props": {"content": "<h2>Who we are</h2><p>Fourteen years of NEET coaching.</p>"}}]}
    broken = {"route": "broken", "components": [{"id": "z", "type": "nope", "props": {}}]}
    out = await run({"action": "create_site", "new_site_name": "fresh", "pages": [home, about, broken],
                     "header": {"id": "h", "type": "header", "props": {"title": "Acme", "navigation": [{"label": "Home", "route": "home"}]}},
                     "footer": {"id": "f", "type": "footer", "props": {"bottomNote": "© Acme"}}})
    assert out["created_site"] is True
    created = json.loads(backend.created[0]["catalogue_json"])
    assert [p["route"] for p in created["pages"]] == ["home", "about"]
    assert "broken" in out["design_issues"]
    assert created["globalSettings"]["layout"]["header"]["props"]["title"] == "Acme"
    assert created["globalSettings"]["layout"]["footer"]["props"]["bottomNote"] == "© Acme"


@pytest.mark.asyncio
async def test_update_page_applies_authored_ops_through_the_sanitiser(backend, monkeypatch):
    _with_draft(monkeypatch, sample_config())
    out = await run({"action": "update_page", "tag_name": "main-site", "page_route": "home", "ops": [
        {"op": "insert", "afterId": "c-hero", "note": "Added FAQs",
         "component": {"id": "faq", "type": "faqSection", "props": {"title": "FAQs", "faqs": [{"question": "Timings?", "answer": "7–9 am"}]}}},
        {"op": "update", "id": "c-hero", "propsPatch": {"left": {"title": "Crack NEET 2027 — June batch"}}, "note": "Sharper headline"},
        {"op": "insert", "afterId": None, "component": {"id": "bad", "type": "nope", "props": {}}},
        {"op": "remove", "id": "c-text", "note": "Dropped placeholder"},
    ]})
    assert out["saved_as"] == "draft"
    comps = backend.saved[-1]["config"]["pages"][0]["components"]
    ids = [c["id"] for c in comps]
    assert "faq" in ids and "c-text" not in ids and "bad" not in ids
    assert ids.index("faq") == ids.index("c-hero") + 1
    hero = next(c for c in comps if c["id"] == "c-hero")
    assert hero["props"]["left"]["title"] == "Crack NEET 2027 — June batch"
    assert "Added FAQs" in out["changes"] and "Dropped placeholder" in out["changes"]
    assert backend.saved[-1]["config"]["pages"][0]["title"] == "Home"


@pytest.mark.asyncio
async def test_update_page_with_only_invalid_ops_saves_nothing(backend):
    out = await run({"action": "update_page", "tag_name": "main-site", "page_route": "home",
                     "ops": [{"op": "insert", "afterId": None, "component": {"id": "bad", "type": "nope", "props": {}}}]})
    assert out["error"] == "no_valid_ops" and backend.saved == []


@pytest.mark.asyncio
async def test_set_layout_validates_header_and_footer(backend):
    out = await run({"action": "set_layout", "tag_name": "main-site",
                     "header": {"props": {"title": "Acme", "logo": FOREIGN_IMG, "navigation": [{"label": "Home", "route": "home"}]}},
                     "footer": {"props": {"bottomNote": "© Acme", "leftSection": {"title": "Acme", "text": "+91 99"}}}})
    assert out["summary_of_change"] == "Updated the site's header and footer."
    layout = backend.saved[-1]["config"]["globalSettings"]["layout"]
    assert layout["header"]["type"] == "header" and layout["header"]["props"]["title"] == "Acme"
    assert not layout["header"]["props"].get("logo")                          # foreign logo URL stripped
    assert layout["footer"]["props"]["bottomNote"] == "© Acme"
    out = await run({"action": "set_layout", "tag_name": "main-site"})
    assert out["error"] == "missing_argument"


def test_only_our_assets_are_allow_listed():
    from app.services.assistant_tools_website_edit import _asset_urls_in, _is_institute_asset
    assert _is_institute_asset(OUR_IMG) and not _is_institute_asset(FOREIGN_IMG) and not _is_institute_asset("not a url")
    assert _is_institute_asset("https://d1om4dxj9e7kkd.cloudfront.net/SYSTEM_FILES/x/logo.png")   # media library via CloudFront
    assert _asset_urls_in(authored_page(), set()) == {OUR_IMG}


@pytest.mark.asyncio
async def test_editor_only_blocks_are_accepted_when_authored(backend):
    page = {"route": "home", "components": [
        {"id": "strip", "type": "courseShowcase", "props": {"title": "Batches starting soon", "source": "newest", "limit": 3}},
        {"id": "trust", "type": "trustChip", "props": {"text": "14 years of results", "icon": "ShieldCheck"}},
    ]}
    out = await run({"action": "create_page", "tag_name": "main-site", "page": page})
    assert out["saved_as"] == "draft"
    assert [c["type"] for c in backend.saved[-1]["config"]["pages"][-1]["components"]] == ["courseShowcase", "trustChip"]
    assert not out["warnings"]


@pytest.mark.asyncio
async def test_authored_padding_and_site_settings_survive(backend):
    page = {"route": "home", "components": [
        {"id": "hero", "type": "heroSection", "props": {"left": {"title": "Hi"}, "backgroundColor": "#F8FAFC"},
         "style": {"paddingTop": "16px", "paddingBottom": "0px"}},
        {"id": "text", "type": "textBlock", "props": {"content": "<p><strong>Bold</strong> and <em>rich</em>.</p>"}},
    ]}
    out = await run({"action": "create_site", "new_site_name": "styled", "pages": [page],
                     "theme": {"atmosphere": "soft", "atmosphere_intensity": "subtle"},
                     "site_settings": {"sticky_header": True, "back_to_top": True, "compactness": "small",
                                       "seo": {"keywords": ["neet", "pune"], "organization": {"name": "Acme", "same_as": ["https://x.com/acme"], "logo": "https://evil.example/logo.png"}}}})
    assert out["created_site"] is True
    created = json.loads(backend.created[0]["catalogue_json"])
    hero = created["pages"][0]["components"][0]
    assert hero["style"]["paddingTop"] == "16px" and hero["style"]["paddingBottom"] == "0px"   # authored rhythm kept
    assert not any("vertical rhythm" in w for w in out["warnings"])
    assert "<strong>" in created["pages"][0]["components"][1]["props"]["content"]              # rich text kept (nh3)
    gs = created["globalSettings"]
    assert gs["theme"]["atmosphere"] == {"canvas": "soft", "intensity": "subtle"}
    assert gs["stickyHeader"] is True and gs["backToTop"] is True and gs["compactness"] == "small"
    assert gs["seo"] == {"keywords": ["neet", "pune"], "organization": {"name": "Acme", "sameAs": ["https://x.com/acme"]}}  # foreign logo dropped

    out = await run({"action": "set_site_settings", "tag_name": "main-site", "site_settings": {"back_to_top": False, "lead_popup": {"enabled": True}}})
    gs = backend.saved[-1]["config"]["globalSettings"]
    assert gs["backToTop"] is False and gs["leadCollection"]["enabled"] is True and gs["leadCollection"]["mandatory"] is False
