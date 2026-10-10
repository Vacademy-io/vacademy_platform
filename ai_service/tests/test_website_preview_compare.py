"""
website(action='preview') in fidelity mode and website(action='compare'),
against a faked admin-core serving the Brahm Varchas site and a faked render.

Pins: a plain preview call is unchanged; a language must be one of the site's;
compare reads only images this platform stores (never a caller's URL); and the
MCP result carries every tile and the side-by-side as images.
"""
import asyncio
import base64
import json
import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import cv2  # noqa: E402
import numpy as np  # noqa: E402
import pytest  # noqa: E402

from app.schemas.auth import PinnedPrincipal  # noqa: E402
from app.services import assistant_tools_website as website_mod  # noqa: E402
from app.services import page_preview, website_data  # noqa: E402
from app.services.assistant_tool_registry import ToolContext  # noqa: E402

FIXTURE = (Path(__file__).resolve().parents[2] / "frontend-admin-dashboard/src/routes/manage-pages/-components"
           / "__fixtures__/brahm-varchas-site.json")
BUCKET, CDN = "vacademy-media", "https://cdn.example.net"


def bv_site():
    if not FIXTURE.exists():
        pytest.skip("Brahm Varchas fixture not in this checkout")
    return json.loads(FIXTURE.read_text())


class _FakeDb:
    def execute(self, stmt, params=None):
        if "learner_portal_base_url" in str(stmt):
            return SimpleNamespace(first=lambda: ("learn.brahmvarchas.in",))
        return SimpleNamespace(first=lambda: None, fetchall=lambda: [])


def ctx():
    principal = PinnedPrincipal(user_id="user-1", institute_id="inst-1", roles=["ADMIN"], permissions=[], is_root_user=False)
    return ToolContext(db=_FakeDb(), principal=principal, keys=(), bearer_token="jwt")


@pytest.fixture
def bv(monkeypatch):
    config = bv_site()
    row = {"id": "cat-bv", "tag_name": "bv", "status": "ACTIVE", "is_default": True,
           "catalogue_json": json.dumps(config), "updated_at": "2026-10-09T10:00:00"}

    async def admin_core(ctx_, method, path, params=None, body=None, timeout=None):
        if path.endswith("/course-catalogue/institute/get-all"):
            return [row]
        if path.endswith("/course-catalogue/institute/get/by-tag"):
            return row
        if path.endswith("/revision/draft"):
            return {"error": "fetch_failed", "status": 204}
        if path.endswith("/revision/history"):
            return []
        raise AssertionError(f"unexpected call {method} {path}")

    monkeypatch.setattr(website_data, "_admin_core_json", admin_core)
    monkeypatch.setattr(website_mod, "_admin_core_json", admin_core)
    monkeypatch.setattr(website_data, "_settings", lambda: SimpleNamespace(
        learner_dashboard_url="https://learner.example", aws_bucket_name=BUCKET, aws_s3_public_bucket=None,
        cdn_public_base_url=CDN, media_server_base_url="https://media.example.net", admin_dashboard_url="https://admin"))
    monkeypatch.setattr(website_mod, "_settings", website_data._settings)
    return config


def call(args):
    return json.loads(asyncio.run(website_mod.execute_website(args, ctx())))


def jpeg(img):
    return cv2.imencode(".jpg", img)[1].tobytes()


def b64(s):
    return base64.b64encode(s.encode()).decode()


# ── preview ──────────────────────────────────────────────────────────────
def test_a_plain_preview_call_is_unchanged(bv, monkeypatch):
    seen = {}

    async def render(**kw):
        seen.update(kw)
        return {"png_base64": "AAAA", "width": 1280, "height": 3000}
    monkeypatch.setattr(page_preview, "render_preview", render)
    out = call({"action": "preview", "page_route": "courses"})
    assert set(seen) == {"base_url", "tag_name", "page_route", "config", "section_id", "viewport"}
    assert seen["viewport"] == "desktop" and seen["base_url"] == "learn.brahmvarchas.in"
    assert set(out) == {"action", "tag_name", "page_route", "showing", "image_png_base64", "width", "height", "note"}


def test_fidelity_preview_returns_tiles_sections_and_language(bv, monkeypatch):
    seen = {}

    async def render(**kw):
        seen.update(kw)
        return {"png_base64": "T0", "width": 1440, "height": 4300, "page_height": 4300, "truncated": False,
                "tiles": [{"png_base64": b64(f"t{i}"), "top": i * 1800, "height": 1800} for i in range(3)],
                "sections": [{"id": "header-1", "top": 0, "height": 64}, {"id": "courses-catalog", "top": 64, "height": 3000},
                             {"id": "courses-not-sure", "top": 3064, "height": 240}, {"id": "footer-1", "top": 3304, "height": 996}]}
    monkeypatch.setattr(page_preview, "render_preview", render)
    out = call({"action": "preview", "page_route": "courses", "width": 1440, "lang": "hi"})
    assert seen["width"] == 1440 and seen["lang"] == "hi" and seen["sections"] is True
    assert out["mode"] == "fidelity" and out["lang"] == "hi"
    assert out["image_png_base64"] == b64("t0") and out["images_base64"] == [b64("t1"), b64("t2")]
    assert [(s["id"], s["type"]) for s in out["sections"]] == [
        ("header-1", "header"), ("courses-catalog", "courseCatalog"), ("courses-not-sure", "ctaBanner"), ("footer-1", "footer")]


def test_fidelity_alone_means_1440_with_sections(bv, monkeypatch):
    seen = {}

    async def render(**kw):
        seen.update(kw)
        return {"png_base64": "x", "width": 1440, "height": 900, "tiles": [{"png_base64": "x", "top": 0, "height": 900}]}
    monkeypatch.setattr(page_preview, "render_preview", render)
    call({"action": "preview", "fidelity": True, "sections": False})
    assert seen["width"] == 1440 and seen["sections"] is False


def test_a_page_built_from_a_design_previews_in_fidelity_mode(bv, monkeypatch):
    bv["pages"][1]["meta"] = {"designSource": {"kind": "figma", "fileKey": "abc", "nodeId": "1:36"}}
    row = json.dumps(bv)

    async def admin_core(ctx_, method, path, params=None, body=None, timeout=None):
        if path.endswith("/revision/draft"):
            return {"error": "fetch_failed", "status": 204}
        if path.endswith("/revision/history"):
            return []
        return [{"id": "c", "tag_name": "bv", "status": "ACTIVE", "is_default": True, "catalogue_json": row}] \
            if path.endswith("get-all") else {"id": "c", "tag_name": "bv", "status": "ACTIVE", "catalogue_json": row}
    monkeypatch.setattr(website_data, "_admin_core_json", admin_core)
    seen = {}

    async def render(**kw):
        seen.update(kw)
        return {"png_base64": "x", "width": 1440, "height": 900, "tiles": []}
    monkeypatch.setattr(page_preview, "render_preview", render)
    assert call({"action": "preview", "page_route": "courses"})["mode"] == "fidelity"
    assert seen["width"] == 1440


def test_a_language_the_site_does_not_have_is_refused(bv, monkeypatch):
    async def render(**kw):
        raise AssertionError("no render for a bad language")
    monkeypatch.setattr(page_preview, "render_preview", render)
    out = call({"action": "preview", "lang": "ta"})
    assert out["error"] == "unknown_language" and out["available"] == ["en", "hi"]


# ── compare ──────────────────────────────────────────────────────────────
def _design_and_render():
    """A design of four bands and a render of the same page whose CTA band lost its second button."""
    def page(with_second):
        img = np.full((1600, 1440, 3), 250, dtype=np.uint8)
        img[:64] = 255
        img[64:1100] = (232, 246, 253)
        cv2.putText(img, "All courses", (160, 200), cv2.FONT_HERSHEY_SIMPLEX, 2, (20, 20, 20), 3)
        img[1100:1300] = (8, 18, 26)
        cv2.rectangle(img, (900, 1170), (1080, 1230), (60, 110, 90), -1)
        if with_second:
            cv2.rectangle(img, (1100, 1170), (1280, 1230), (230, 230, 230), 2)
        img[1300:] = (215, 234, 245)
        return img
    return page(True), page(False)


def _fake_render(rendered, seen):
    async def render(**kw):
        seen.update(kw)
        return {"png_base64": "x", "width": 1440, "height": 1600, "page_height": 1600, "truncated": False, "tiles": [],
                "full_jpeg": jpeg(rendered),
                "sections": [{"id": "header-1", "top": 0, "height": 64, "text": "Courses"},
                             {"id": "courses-catalog", "top": 64, "height": 1036, "text": "All courses"},
                             {"id": "courses-not-sure", "top": 1100, "height": 200,
                              "text": "Not sure which course is right for you?\nFind your path"},
                             {"id": "footer-1", "top": 1300, "height": 300, "text": "Brahm Varchas"}]}
    return render


def test_compare_reads_our_stored_image_and_returns_section_hints(bv, monkeypatch):
    design, rendered = _design_and_render()
    del bv["pages"][1]["components"][1]["props"]["secondaryButton"]
    row = json.dumps(bv)

    async def admin_core(ctx_, method, path, params=None, body=None, timeout=None):
        if path.endswith("/revision/draft"):
            return {"error": "fetch_failed", "status": 204}
        if path.endswith("/revision/history"):
            return []
        return [{"id": "c", "tag_name": "bv", "status": "ACTIVE", "is_default": True, "catalogue_json": row}] \
            if path.endswith("get-all") else {"id": "c", "tag_name": "bv", "status": "ACTIVE", "catalogue_json": row}
    monkeypatch.setattr(website_data, "_admin_core_json", admin_core)
    reads = []

    def read_s3(bucket, key, cap):
        reads.append((bucket, key))
        return cv2.imencode(".png", design)[1].tobytes()
    monkeypatch.setattr(website_mod, "_read_s3_object", read_s3)
    seen = {}
    monkeypatch.setattr(page_preview, "render_preview", _fake_render(rendered, seen))
    out = call({"action": "compare", "page_route": "courses", "lang": "en", "reference": {
        "asset_url": f"{CDN}/page-builder/imports/photo-1.png", "frame_width": 1440,
        "sections": [{"name": "Header", "id": "1:37", "top": 0, "height": 64},
                     {"name": "Hero + Main", "id": "1:69", "top": 64, "height": 1036},
                     {"name": "Help band", "id": "1:435", "top": 1100, "height": 200,
                      "texts": ["Not sure which course is right for you?", "Find your path", "Talk to us"]},
                     {"name": "Footer", "id": "1:444", "top": 1300, "height": 300}]}})
    assert reads == [(BUCKET, "page-builder/imports/photo-1.png")]
    assert seen["width"] == 1440 and seen["sections"] is True and seen["section_text"] and seen["full_image"]
    assert out["overall"]["sections_paired"] == 4 and out["missing_sections"] == []
    cta = next(s for s in out["sections"] if s["section_id"] == "courses-not-sure")
    assert cta["figma_nodes"] == ["1:435"] and cta["missing_text"] == ["Talk to us"]
    assert cta["hints"][0]["prop_path"] == "props.secondaryButton"
    assert base64.b64decode(out["image_png_base64"])[:2] == b"\xff\xd8"


def test_compare_never_fetches_an_address_it_was_handed(bv, monkeypatch):
    import httpx

    class Boom:
        def __init__(self, *a, **kw):
            raise AssertionError("no network for a caller's URL")
    monkeypatch.setattr(httpx, "AsyncClient", Boom)
    monkeypatch.setattr(website_mod, "_read_s3_object", lambda *a: (_ for _ in ()).throw(AssertionError("no S3")))
    for url in ("http://169.254.169.254/latest/meta-data", "https://evil.example/figma.png",
                "https://other-bucket.s3.amazonaws.com/x.png", f"{CDN}.evil.com/x.png"):
        out = call({"action": "compare", "reference": {"asset_url": url}})
        assert out["error"] == "reference_not_allowed", url
    out = call({"action": "compare", "reference": {"url": "https://www.figma.com/design/abc"}})
    assert out["error"] == "bad_request" and "never fetched" in out["message"]


def test_compare_asset_ids_must_be_the_callers_own_uploads(bv, monkeypatch):
    async def media(ctx_, kind, limit):
        return [{"file_id": "f-1", "url": f"{CDN}/media/f-1.png"}]
    monkeypatch.setattr(website_mod, "_load_media", media)
    monkeypatch.setattr(website_mod, "_read_s3_object", lambda b, k, c: b"not an image")
    assert call({"action": "compare", "reference": {"asset_id": "f-2"}})["error"] == "unknown_asset"
    out = call({"action": "compare", "reference": {"tiles": [{"asset_id": "f-1"}]}})
    assert out["error"] == "bad_image" and "reference image" in out["message"]


def test_compare_refuses_what_it_cannot_do_yet(bv):
    assert call({"action": "compare"})["error"] == "missing_argument"
    assert call({"action": "compare", "reference": {"import_id": "imp-1", "frame_id": "1:36"}})["error"] == "reference_unavailable"
    assert call({"action": "compare", "reference": {"tiles": [{"asset_url": "x"}] * 13}})["error"] == "bad_request"
    assert call({"action": "compare", "reference": {"asset_url": "x", "sections": "all"}})["error"] == "bad_request"


def test_compare_tiles_are_stitched_top_to_bottom(bv, monkeypatch):
    design, rendered = _design_and_render()
    halves = {"a.png": design[:800], "b.png": design[800:]}
    monkeypatch.setattr(website_mod, "_read_s3_object",
                        lambda bucket, key, cap: cv2.imencode(".png", halves[key.rsplit("/", 1)[-1]])[1].tobytes())
    monkeypatch.setattr(page_preview, "render_preview", _fake_render(design, {}))
    out = call({"action": "compare", "page_route": "courses",
                "reference": {"tiles": [{"asset_url": f"{CDN}/x/a.png"}, {"asset_url": f"{CDN}/x/b.png"}]}})
    assert out["overall"]["passes"] is True and out["design_sections_from"] == "bands"


# ── the MCP result ───────────────────────────────────────────────────────
def test_mcp_result_sends_every_tile_as_an_image(monkeypatch):
    from app.mcp import adapter

    async def fake_execute(name, args, ctx_, gate):
        return json.dumps({"action": "preview", "image_png_base64": "AAA", "images_base64": ["BBB", "CCC"], "width": 1440})
    monkeypatch.setattr(adapter, "execute_tool", fake_execute)
    principal = PinnedPrincipal(user_id="u", institute_id="i", roles=["ADMIN"], permissions=[], is_root_user=False)
    res = asyncio.run(adapter.call_tool(name="website", arguments={"action": "preview"}, principal=principal,
                                        platform_token=None, db=None, mcp_setting={"enabled": True}))
    kinds = [c.type for c in res.content]
    assert kinds == ["image", "image", "image", "text"]
    assert [c.data for c in res.content[:3]] == ["AAA", "BBB", "CCC"]
    assert "images_base64" not in res.content[3].text and "image_png_base64" not in res.content[3].text
