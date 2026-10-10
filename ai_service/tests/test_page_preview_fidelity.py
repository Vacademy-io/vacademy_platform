"""
page_preview fidelity mode: any width, a language, section boxes, a click
first, and tall pages as tiles — against a fake Playwright, so no browser and
no network. A call without the new options must take the original path
untouched.
"""
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import cv2  # noqa: E402
import numpy as np  # noqa: E402
import pytest  # noqa: E402

from app.services import page_preview  # noqa: E402


def site(i18n=None):
    gs = {"theme": {"primaryColor": "#883000"}}
    if i18n is not None:
        gs["i18n"] = i18n
    return {"globalSettings": gs, "pages": [
        {"id": "home", "route": "home", "components": [{"id": "home-catalog", "type": "courseCatalog"}]},
        {"id": "courses", "route": "courses", "components": [{"id": "courses-catalog", "type": "courseCatalog"}]},
    ]}


# ── a fake Playwright ────────────────────────────────────────────────────
class FakeLocator:
    def __init__(self, page, text, exact):
        self.page, self.text, self.exact = page, text, exact

    async def count(self):
        return 1 if (self.text in self.page.clickable if self.exact else any(self.text in t for t in self.page.clickable)) else 0

    def nth(self, i):
        return self

    async def is_visible(self):
        return True

    async def click(self, timeout=None):
        self.page.clicks.append(self.text)
        if self.text == "Courses":                      # a nav button that navigates away
            self.page.url = "https://sites.acme.edu/main-site/courses"


class FakePage:
    def __init__(self, recorder, height=5000):
        self.rec, self.height = recorder, height
        self.url = ""
        self.clickable = {"Knowledge Streams", "Courses"}
        self.clicks = recorder.setdefault("clicks", [])

    async def goto(self, url, wait_until=None, timeout=None):
        self.url = url
        self.rec["url"] = url

    async def wait_for_timeout(self, ms):
        pass

    async def evaluate(self, script, arg=None):
        if script == page_preview._SECTIONS_JS:
            self.rec["section_text"] = arg
            return [{"id": "header-1", "top": 0, "height": 64, "text": "Courses" if arg else None},
                    {"id": "courses-catalog", "top": 64, "height": 3000}, {"id": "footer-1", "top": 3064, "height": 700}]
        if script == page_preview._BOX_JS:
            return {"top": 3064, "height": 700} if arg == "footer-1" else None
        if "postMessage(JSON.parse(msg)" in script:
            self.rec.setdefault("posted", []).append(json.loads(arg))
            return None
        if "PREVIEW_INTERACT" in script:
            self.rec["interact"] = True
            return None
        if "scrollHeight" in script:
            return self.height
        if "scrollTo(0, y)" in script:
            self.rec.setdefault("scrolled", []).append(arg)
        return None

    def get_by_text(self, text, exact=False):
        return FakeLocator(self, text, exact)

    async def screenshot(self, **kw):
        self.rec["screenshot"] = kw
        h = kw["clip"]["height"]
        img = np.full((h, kw["clip"]["width"], 3), 230, dtype=np.uint8)
        img[3064:] = 20                                   # a dark footer
        return cv2.imencode(".jpg", img)[1].tobytes()


class FakeBrowser:
    def __init__(self, rec):
        self.rec = rec

    async def new_context(self, **kw):
        self.rec["context"] = kw
        rec = self.rec

        class Ctx:
            async def new_page(self_inner):
                return FakePage(rec, rec.get("page_height", 5000))
        return Ctx()

    async def close(self):
        self.rec["closed"] = True


def fake_playwright(rec):
    class Chromium:
        async def launch(self, **kw):
            return FakeBrowser(rec)

    class PW:
        chromium = Chromium()

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

    return lambda: PW()


def run_fidelity(rec, **kw):
    opts = page_preview._fidelity_options(kw.pop("width", None), kw.pop("lang", None), kw.pop("click_text", None),
                                         kw.pop("max_height", None))
    defaults = {"sections": True, "section_text": False, "full_image": False}
    return asyncio.run(page_preview._render_fidelity(
        fake_playwright(rec), "sites.acme.edu", "main-site", kw.pop("route", "courses"), kw.pop("config", site()),
        kw.pop("section_id", None), **{**defaults, **kw}, **opts))


# ── routing between the original path and fidelity mode ─────────────────
@pytest.fixture
def routes(monkeypatch):
    seen = []

    async def legacy(*a):
        seen.append(("legacy", a))
        return {"png_base64": "A", "width": 1280, "height": 800}

    async def fidelity(*a, **kw):
        seen.append(("fidelity", a, kw))
        return {"png_base64": "B", "width": kw["width"], "height": 900, "tiles": []}

    monkeypatch.setattr(page_preview, "_render", legacy)
    monkeypatch.setattr(page_preview, "_render_fidelity", fidelity)
    return seen


def test_a_call_without_new_options_takes_the_original_path(routes):
    out = asyncio.run(page_preview.render_preview(base_url="b", tag_name="t", page_route="home", config=site()))
    assert out == {"png_base64": "A", "width": 1280, "height": 800}
    assert routes[0][0] == "legacy" and routes[0][1][1:] == ("b", "t", "home", site(), None, "desktop")


def test_new_options_take_fidelity_mode_with_defaults(routes):
    asyncio.run(page_preview.render_preview(base_url="b", tag_name="t", page_route="home", config=site(), sections=True))
    kind, _args, kw = routes[0]
    assert kind == "fidelity" and kw["width"] == 1440 and kw["max_height"] == 16_000 and kw["sections"] is True
    asyncio.run(page_preview.render_preview(base_url="b", tag_name="t", page_route="home", config=site(),
                                            width=390, lang="hi", max_height=99_999))
    assert routes[1][2]["width"] == 390 and routes[1][2]["lang"] == "hi" and routes[1][2]["max_height"] == 16_000


@pytest.mark.parametrize("kw, word", [({"width": 200}, "width"), ({"width": 4000}, "width"), ({"width": "wide"}, "width"),
                                      ({"lang": "hi'><script>"}, "lang"), ({"click_text": "x" * 81}, "click_text")])
def test_bad_options_are_refused_before_a_browser_starts(routes, kw, word):
    out = asyncio.run(page_preview.render_preview(base_url="b", tag_name="t", page_route="home", config=site(), **kw))
    assert out["error"] == "bad_request" and word in out["message"] and not routes


def test_at_most_two_browsers_run_at_once(monkeypatch):
    live, peak = [0], [0]

    async def slow(*a, **kw):
        live[0] += 1
        peak[0] = max(peak[0], live[0])
        await asyncio.sleep(0.02)
        live[0] -= 1
        return {"png_base64": "A", "width": 1, "height": 1}

    monkeypatch.setattr(page_preview, "_render", slow)
    monkeypatch.setattr(page_preview, "_render_fidelity", slow)
    monkeypatch.setattr(page_preview, "BROWSER_SLOTS", asyncio.Semaphore(2))

    async def many():
        return await asyncio.gather(*[
            page_preview.render_preview(base_url="b", tag_name="t", page_route="home", config=site(),
                                        **({"width": 1440} if i % 2 else {}))
            for i in range(6)])
    assert len(asyncio.run(many())) == 6 and peak[0] == 2


# ── what is posted ───────────────────────────────────────────────────────
def test_the_message_carries_the_real_route_like_the_editor():
    msg = page_preview.fidelity_message(site(), "courses", None)
    assert msg["type"] == "CATALOGUE_CONFIG_UPDATE" and msg["previewPath"] == "courses"
    assert msg["payload"]["pages"][0]["id"] == "home" and msg["payload"]["pages"][0]["components"][0]["id"] == "courses-catalog"
    assert page_preview.fidelity_message(site(), "home", None)["previewPath"] == ""
    assert page_preview.preview_path_of("/homepage/") == "" and page_preview.preview_path_of("/learning-paths/") == "learning-paths"


def test_a_language_switches_languages_on_without_touching_the_input():
    cfg = site({"enabled": False, "defaultLocale": "en", "locales": [{"code": "en"}, {"code": "hi"}]})
    msg = page_preview.fidelity_message(cfg, "home", "hi")
    assert msg["payload"]["globalSettings"]["i18n"]["enabled"] is True
    assert cfg["globalSettings"]["i18n"]["enabled"] is False
    assert page_preview.fidelity_message(cfg, "home", None)["payload"]["globalSettings"]["i18n"]["enabled"] is False
    assert page_preview._fidelity_url("sites.acme.edu", "main site", "hi") == "https://sites.acme.edu/main%20site?preview=true&lang=hi"


# ── the fidelity render (fake browser) ──────────────────────────────────
def test_a_tall_page_comes_back_as_tiles_with_section_boxes():
    rec = {}
    out = run_fidelity(rec, lang="hi")
    assert rec["context"]["viewport"] == {"width": 1440, "height": 900} and rec["context"]["is_mobile"] is False
    assert rec["url"].endswith("?preview=true&lang=hi")
    assert {m["previewPath"] for m in rec["posted"]} == {"courses"}
    assert rec["screenshot"]["full_page"] is True and rec["screenshot"]["clip"] == {"x": 0, "y": 0, "width": 1440, "height": 5000}
    assert [(t["top"], t["height"]) for t in out["tiles"]] == [(0, 1800), (1800, 1800), (3600, 1400)]
    assert out["png_base64"] == out["tiles"][0]["png_base64"] and out["height"] == 5000 and out["truncated"] is False
    assert [s["id"] for s in out["sections"]] == ["header-1", "courses-catalog", "footer-1"]
    assert rec["scrolled"][0] == 0 and rec["closed"] is True and "full_jpeg" not in out


def test_height_is_capped_and_reported_as_truncated():
    rec = {"page_height": 20_000}
    out = run_fidelity(rec, max_height=6000)
    assert rec["screenshot"]["clip"]["height"] == 6000 and out["truncated"] is True and out["page_height"] == 20_000


def test_mobile_width_emulates_a_phone():
    rec = {}
    run_fidelity(rec, width=390)
    assert rec["context"]["viewport"] == {"width": 390, "height": 844} and rec["context"]["is_mobile"] is True


def test_a_section_is_cropped_from_the_full_capture():
    rec = {}
    out = run_fidelity(rec, section_id="footer-1", full_image=True)
    assert out["height"] == 700 and len(out["tiles"]) == 1 and out["truncated"] is False
    crop = cv2.imdecode(np.frombuffer(out["full_jpeg"], np.uint8), cv2.IMREAD_COLOR)
    assert crop.shape[:2] == (700, 1440) and crop.mean() < 40          # the dark footer
    assert run_fidelity({}, section_id="nope")["error"] == "section_not_rendered"


def test_click_text_switches_browse_mode_on_and_clicks():
    rec = {}
    out = run_fidelity(rec, click_text="Knowledge  Streams", section_text=True)
    assert rec["interact"] is True and rec["clicks"] == ["Knowledge Streams"] and out["clicked"] is True
    assert rec["section_text"] is True and out["sections"][0]["text"] == "Courses"
    assert run_fidelity({}, click_text="Nowhere")["clicked"] is False


def test_a_click_that_leaves_the_page_is_an_error_not_a_wrong_screenshot():
    out = run_fidelity({}, click_text="Courses")
    assert out["error"] == "click_navigated"
