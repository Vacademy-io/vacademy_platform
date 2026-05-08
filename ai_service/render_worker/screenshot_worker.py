"""Single-shot screenshot worker for the vision-review path.

Loads the same harness as generate_video.py (via render_harness.py) and uses
Playwright to capture PNGs of one shot's HTML at N timestamps. The harness is
shared so what the vision reviewer sees equals what the production MP4 will
look like.

Used by main.py's POST /screenshot endpoint.
"""
from __future__ import annotations

import asyncio
import base64
import logging
import sys
from pathlib import Path
from typing import Dict, List, Optional

logger = logging.getLogger("render-worker.screenshot")

# render_harness.py lives next to generate_video.py in ai-video-gen-main/. The
# build script (build.sh) copies that directory into the worker's image.
_HARNESS_DIR = Path(__file__).parent / "ai-video-gen-main"
if str(_HARNESS_DIR) not in sys.path:
    sys.path.insert(0, str(_HARNESS_DIR))


class ScreenshotWorker:
    """Reusable Playwright browser for the vision-review screenshot path.

    Launches one Chromium instance lazily and reuses it across calls — Playwright
    cold-start is ~1s, so amortising it across reviews keeps p95 latency low.
    Each call gets a fresh context+page so harness state doesn't bleed between
    shots.
    """

    def __init__(self):
        self._playwright = None
        self._browser = None
        self._lock = asyncio.Lock()

    async def _ensure_browser(self):
        if self._browser is not None:
            return
        async with self._lock:
            if self._browser is not None:
                return
            from playwright.async_api import async_playwright
            self._playwright = await async_playwright().start()
            self._browser = await self._playwright.chromium.launch(
                args=["--no-sandbox", "--disable-dev-shm-usage"],
            )
            logger.info("ScreenshotWorker: Chromium launched")

    async def close(self):
        if self._browser is not None:
            try:
                await self._browser.close()
            except Exception:
                pass
            self._browser = None
        if self._playwright is not None:
            try:
                await self._playwright.stop()
            except Exception:
                pass
            self._playwright = None

    async def screenshot_shot(
        self,
        *,
        html: str,
        width: int,
        height: int,
        timestamps: List[float],
        background: str = "#0a0e27",
    ) -> List[Dict[str, object]]:
        """Render `html` in the harness, screenshot at each timestamp, return base64 PNGs.

        Returns: [{"t": float, "image_b64": str}] — one entry per requested timestamp,
        in the order requested.
        """
        if not html or not html.strip():
            raise ValueError("html is required")
        if width <= 0 or height <= 0:
            raise ValueError("width and height must be positive")
        if not timestamps:
            raise ValueError("at least one timestamp required")

        from render_harness import build_harness_html  # imported lazily after sys.path setup

        await self._ensure_browser()

        harness_html = build_harness_html(background)
        context = await self._browser.new_context(
            viewport={"width": width, "height": height},
            device_scale_factor=1,
        )
        page = await context.new_page()
        results: List[Dict[str, object]] = []
        try:
            # Load the harness as a data URL so there is no temp file. The harness
            # itself loads libraries from CDNs; domcontentloaded fires before those
            # finish, but we wait for the GSAP global to appear separately below.
            await page.set_content(harness_html, wait_until="domcontentloaded")

            # Wait until the harness libraries have loaded. GSAP is the most
            # important — without it, gsap.globalTimeline.totalTime() can't seek.
            try:
                await page.wait_for_function(
                    "() => typeof window.gsap === 'object' && window.gsap !== null",
                    timeout=10_000,
                )
            except Exception:
                logger.warning("ScreenshotWorker: gsap not present after 10s — proceeding anyway")

            # Inject the shot using the same dispatcher the renderer uses. inTime=0
            # means tween delays inside the shot HTML compose against globalTimeline=0,
            # which is exactly what we want for screenshot timestamps that are
            # shot-relative seconds.
            await page.evaluate(
                "async (entries) => { if (window.__updateSnippets) await window.__updateSnippets(entries); }",
                [{"id": "screenshot-shot", "html": html, "inTime": 0}],
            )

            # Wait for shadow-DOM stylesheets and document fonts — same sequence
            # the renderer runs after a segment change. Without these waits we
            # capture frames with fallback fonts, which makes the reviewer flag
            # legibility issues that won't appear in the final MP4.
            try:
                await page.evaluate(
                    """async () => {
                        const links = [];
                        document.querySelectorAll('[id^="snippet-"],[id^="segment-"],[id^="shot-"],[id="screenshot-shot"]').forEach(host => {
                            const root = host.shadowRoot;
                            if (!root) return;
                            root.querySelectorAll('link[rel="stylesheet"]').forEach(l => links.push(l));
                        });
                        document.head.querySelectorAll('link[rel="stylesheet"]').forEach(l => links.push(l));
                        const waits = links.map(l => {
                            try { if (l.sheet) return Promise.resolve(); } catch (e) {}
                            return new Promise(resolve => {
                                let done = false;
                                const finish = () => { if (!done) { done = true; resolve(); } };
                                l.addEventListener('load', finish, { once: true });
                                l.addEventListener('error', finish, { once: true });
                                setTimeout(finish, 3000);
                            });
                        });
                        await Promise.all(waits);
                    }"""
                )
            except Exception as exc:
                logger.debug(f"stylesheet wait failed (non-fatal): {exc}")
            try:
                await page.evaluate("() => document.fonts.ready")
            except Exception:
                pass

            # Per-timestamp: seek the global timeline + the anime.js registry, wait
            # one paint, then screenshot. Two RAFs match the renderer's seek pattern
            # (line ~2385 of generate_video.py).
            for t in timestamps:
                try:
                    await page.evaluate(
                        """(t) => {
                            try { if (window.gsap) gsap.globalTimeline.totalTime(t); } catch (e) {}
                            try { if (window._animeSeek) window._animeSeek(t); } catch (e) {}
                        }""",
                        t,
                    )
                    await page.evaluate(
                        "() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))"
                    )
                    png = await page.screenshot(type="png", full_page=False)
                    results.append({"t": float(t), "image_b64": base64.b64encode(png).decode("ascii")})
                except Exception as exc:
                    logger.warning(f"ScreenshotWorker: failed to capture t={t}: {exc}")
                    raise
        finally:
            try:
                await context.close()
            except Exception:
                pass

        return results


# Module-level singleton — reused across requests in main.py
_worker_singleton: Optional[ScreenshotWorker] = None


def get_screenshot_worker() -> ScreenshotWorker:
    global _worker_singleton
    if _worker_singleton is None:
        _worker_singleton = ScreenshotWorker()
    return _worker_singleton
