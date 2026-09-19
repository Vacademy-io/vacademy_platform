"""
Screenshot a DRAFT page as the learner site renders it.

The learner app has a preview mode for the editor's live panel:
``<learner host>/<tag>?preview=true`` announces ``PREVIEW_READY`` and then
accepts the full catalogue config over ``postMessage`` (``CATALOGUE_CONFIG_UPDATE``)
instead of fetching it. That is exactly what a headless browser needs: load the
page, post the draft, wait for it to paint, screenshot. No new frontend route,
and the render is the real one — same components, same style engine.

Shared with the reference-site capture in ``routers/page_builder.py`` in spirit
(Playwright, blocked third-party hosts, bounded timeouts); kept separate because
this one injects our own data and never follows the page's links.
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
from typing import Any, Dict, Optional
from urllib.parse import quote

logger = logging.getLogger(__name__)

VIEWPORTS = {"desktop": {"width": 1280, "height": 800}, "mobile": {"width": 390, "height": 844}}
_NAV_TIMEOUT_MS = 25_000
_TOTAL_TIMEOUT_S = 60
_SETTLE_MS = 1_800
_MAX_FULL_HEIGHT = 6_000
_JPEG_QUALITY = 72
_PREVIEW_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 VacademyPreview"


async def render_preview(*, base_url: str, tag_name: str, page_route: str, config: Dict[str, Any],
                         section_id: Optional[str] = None, viewport: str = "desktop") -> Dict[str, Any]:
    """``{png_base64, width, height}`` (JPEG bytes despite the name, for size) or ``{error, message}``."""
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        return {"error": "preview_unavailable", "message": "Screenshots need Playwright on the server."}
    try:
        return await asyncio.wait_for(
            _render(async_playwright, base_url, tag_name, page_route, config, section_id, viewport), _TOTAL_TIMEOUT_S
        )
    except asyncio.TimeoutError:
        return {"error": "preview_timeout", "message": "The page did not render within 60s."}
    except Exception as exc:  # noqa: BLE001
        logger.warning("preview render failed for %s/%s: %s", tag_name, page_route, exc)
        return {"error": "preview_failed", "message": "The page could not be rendered."}


def _as_root_page(config: Dict[str, Any], page_route: str) -> Dict[str, Any]:
    wanted = str(page_route or "").strip("/").lower()
    pages = [p for p in config.get("pages") or [] if isinstance(p, dict)]
    target = next((p for p in pages if str(p.get("route") or "").strip("/").lower() == wanted), pages[0] if pages else None)
    if target is None:
        return config
    root = {**target, "id": "home", "route": "homepage"}
    others = [{**p, "id": p.get("id") if p.get("id") != "home" else f"{p.get('id')}-x",
               "route": p.get("route") if str(p.get("route") or "") != "homepage" else "homepage-x"}
              for p in pages if p is not target]
    return {**config, "pages": [root, *others]}


async def _render(async_playwright: Any, base_url: str, tag_name: str, page_route: str, config: Dict[str, Any],
                  section_id: Optional[str], viewport: str) -> Dict[str, Any]:
    vp = VIEWPORTS.get(viewport) or VIEWPORTS["desktop"]
    # Only the root catalogue page listens for preview config, and it renders
    # the page whose route is "homepage" (or id "home"). We post the config, so
    # we simply present the wanted page AS that root page — any page previews
    # through the one route that supports it, and section ids are untouched.
    payload = json.dumps({"type": "CATALOGUE_CONFIG_UPDATE", "payload": _as_root_page(config, page_route)})
    url = f"{base_url.rstrip('/')}/{quote(tag_name, safe='')}?preview=true"

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True, args=["--disable-dev-shm-usage"])
        try:
            context = await browser.new_context(viewport=vp, user_agent=_PREVIEW_UA, locale="en-US",
                                                device_scale_factor=1, is_mobile=viewport == "mobile")
            page = await context.new_page()
            # The preview handler is registered on mount and posts PREVIEW_READY to
            # its parent; standalone, parent === window, so we just post the config
            # ourselves once the app is up — and again after a beat, in case the
            # first arrived before the page component mounted.
            await page.goto(url, wait_until="domcontentloaded", timeout=_NAV_TIMEOUT_MS)
            for delay in (800, 1500):
                await page.wait_for_timeout(delay)
                await page.evaluate("msg => window.postMessage(JSON.parse(msg), '*')", payload)
            await page.wait_for_timeout(_SETTLE_MS)
            try:
                await page.evaluate("document.fonts && document.fonts.ready")
            except Exception:  # noqa: BLE001
                pass

            if section_id:
                el = await page.query_selector(f'[data-cid="{section_id}"], [data-component-id="{section_id}"]')
                if el is None:
                    return {"error": "section_not_rendered", "message": "That section is not on the rendered page."}
                await el.scroll_into_view_if_needed()
                await page.wait_for_timeout(400)
                data = await el.screenshot(type="jpeg", quality=_JPEG_QUALITY)
                box = await el.bounding_box() or {}
                return {"png_base64": base64.b64encode(data).decode(), "width": int(box.get("width") or vp["width"]),
                        "height": int(box.get("height") or 0)}

            # Size the viewport to the page (capped) and shoot it top-down; a
            # full_page capture with a clip can come back scrolled.
            height = int(await page.evaluate("Math.min(document.documentElement.scrollHeight, %d)" % _MAX_FULL_HEIGHT))
            height = max(height, vp["height"])
            await page.set_viewport_size({"width": vp["width"], "height": height})
            await page.evaluate("window.scrollTo(0, 0)")
            await page.wait_for_timeout(600)
            data = await page.screenshot(type="jpeg", quality=_JPEG_QUALITY, full_page=False)
            return {"png_base64": base64.b64encode(data).decode(), "width": vp["width"], "height": height}
        finally:
            await browser.close()


__all__ = ["render_preview", "VIEWPORTS", "_as_root_page"]
