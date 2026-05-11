"""
Service for auto-capturing website content from URLs found in user prompts.

When a user prompt contains URLs (e.g., "see https://vacademy.io and create
a video about it"), this service uses Playwright to visit each page, take
section screenshots + extract top inline images and metadata, then uploads
the captures to S3 in a shape that plugs into the existing reference_files
pipeline (ReferenceFileService → Gemini Vision descriptions → script LLM
+ Director context).

Failure mode is non-fatal: every I/O is wrapped, errors are logged as
warnings, and the pipeline continues with whatever was captured (or nothing).
"""
from __future__ import annotations

import asyncio
import logging
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse
from uuid import uuid4

import httpx

logger = logging.getLogger(__name__)

# Tunables
_MAX_URLS_DEFAULT = 2
_MAX_INLINE_IMAGES_PER_URL = 3
_SCREENSHOTS_PER_URL = 3
_PAGE_TEXT_CHARS = 1500
# Navigation budgets. Two-tiered: domcontentloaded gets us body+text fast on
# the vast majority of sites; the load fallback is for pages with critical
# resources that block content. We don't use `networkidle` because ad-heavy
# news sites (BBC, ddnews.gov.in, etc.) almost never reach 500ms of zero
# in-flight requests — a previous 12s networkidle budget caused outright
# capture failure on ddnews.gov.in even though the article was fully visible
# at ~8s. With this strategy we proceed with whatever loaded even if both
# nav waits timeout, since a partial-load screenshot still gives the director
# something to work with.
_NAV_TIMEOUT_DOMCONTENT_MS = 30_000
_NAV_TIMEOUT_LOAD_MS = 15_000
# Wait after navigation for late-rendering JS / images. News sites with
# carousel hero images or lazy-loaded gallery thumbs need this to be ≥1s.
_POST_NAV_SETTLE_MS = 1_500
_HTTP_TIMEOUT_S = 10.0
_MIN_IMAGE_DIM_PX = 100
_VIEWPORT = {"width": 1440, "height": 900}
_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
)

# URL detection — captures http(s) URLs without trailing punctuation noise
_URL_REGEX = re.compile(r'https?://[^\s<>"\'`)]+')

# Image filename hints that almost always mean icon/logo/sprite (skip)
_ICON_URL_HINTS = ("favicon", "sprite", "icon-", "/icons/", "logo-mini")


def extract_urls(text: Optional[str], max_urls: int = _MAX_URLS_DEFAULT) -> List[str]:
    """Extract up to max_urls unique URLs from free-form text."""
    if not text:
        return []
    found = _URL_REGEX.findall(text)
    seen: set = set()
    out: List[str] = []
    for raw in found:
        u = raw.rstrip('.,;:!?)')
        if u in seen:
            continue
        seen.add(u)
        out.append(u)
        if len(out) >= max_urls:
            break
    return out


class WebContentCaptureService:
    """Capture screenshots + inline images + page text for URLs in a prompt."""

    def __init__(self, s3_service: Any):
        self._s3 = s3_service

    async def capture_urls(
        self,
        urls: List[str],
        work_dir: Path,
    ) -> Tuple[List[Dict[str, str]], str]:
        """
        Capture content for each URL.

        Returns:
            (extra_reference_files, extra_text_context)
            - extra_reference_files: list shaped like ReferenceFileItem
              ({url, name, type='image'}) — append to reference_files before
              ReferenceFileService.process()
            - extra_text_context: combined per-URL text blocks (title,
              og:description, meta description, page text excerpt).
        """
        if not urls:
            return [], ""

        capture_dir = work_dir / "web_capture"
        capture_dir.mkdir(parents=True, exist_ok=True)

        all_files: List[Dict[str, str]] = []
        all_text_parts: List[str] = []

        # Single Playwright context shared across URLs
        try:
            from playwright.async_api import async_playwright
        except ImportError:
            logger.warning("[WebCapture] Playwright not installed — skipping URL capture")
            return [], ""

        try:
            async with async_playwright() as pw:
                browser = await pw.chromium.launch(headless=True, args=["--disable-dev-shm-usage"])
                try:
                    for url in urls:
                        try:
                            files, text_block = await self._capture_one(
                                browser=browser,
                                url=url,
                                out_dir=capture_dir,
                            )
                            all_files.extend(files)
                            if text_block:
                                all_text_parts.append(text_block)
                        except Exception as e:
                            logger.warning(f"[WebCapture] URL {url} capture failed: {e}")
                finally:
                    await browser.close()
        except Exception as e:
            logger.warning(f"[WebCapture] Browser launch failed: {e}")

        text_context = "\n\n".join(all_text_parts)
        logger.info(
            f"[WebCapture] Captured {len(all_files)} files, "
            f"{len(text_context)} chars text from {len(urls)} URL(s)"
        )
        return all_files, text_context

    # ------------------------------------------------------------------
    # Internal: capture a single URL
    # ------------------------------------------------------------------

    async def _capture_one(
        self,
        browser: Any,
        url: str,
        out_dir: Path,
    ) -> Tuple[List[Dict[str, str]], str]:
        """Capture screenshots, top inline images, and metadata for one URL."""
        host = urlparse(url).netloc or "site"
        slug = re.sub(r"[^a-z0-9]+", "-", host.lower()).strip("-") or "site"
        run_id = uuid4().hex[:8]

        context = await browser.new_context(
            viewport=_VIEWPORT,
            user_agent=_USER_AGENT,
        )
        page = await context.new_page()

        try:
            # Two-tiered navigation strategy. domcontentloaded almost always
            # succeeds — DOM is parsed before ads/analytics finish loading. If
            # even that times out (very slow connection / blocked network), we
            # don't bail: the page may have rendered enough content to scrape.
            # Capturing a partial page beats failing outright; the director
            # gets a screenshot + whatever text is visible.
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=_NAV_TIMEOUT_DOMCONTENT_MS)
            except Exception as _e1:
                logger.warning(
                    f"[WebCapture] domcontentloaded timeout for {url}: {_e1} — "
                    "trying 'load' wait next"
                )
                try:
                    await page.goto(url, wait_until="load", timeout=_NAV_TIMEOUT_LOAD_MS)
                except Exception as _e2:
                    # Both waits failed. Don't return — Playwright still has
                    # whatever DOM rendered; we'll scrape it on a best-effort
                    # basis and return partial results.
                    logger.warning(
                        f"[WebCapture] load timeout for {url}: {_e2} — "
                        "proceeding with partial page state"
                    )

            # Late-render settle: news sites often defer hero images and
            # carousel thumbs. 1.5s is the sweet spot — long enough to catch
            # these, short enough not to inflate cold-cache renders.
            try:
                await page.wait_for_timeout(_POST_NAV_SETTLE_MS)
            except Exception:
                pass

            # ── Metadata + page text ──
            meta = await self._extract_metadata(page)
            text_block = self._format_text_block(url, meta)

            # ── Screenshots: above-fold, mid, footer ──
            screenshots = await self._take_screenshots(page, out_dir, slug, run_id)

            # ── Top inline images ──
            inline_paths = await self._download_inline_images(
                meta.get("images", []), out_dir, slug, run_id
            )

            # ── Upload everything to S3 in parallel-ish ──
            files: List[Dict[str, str]] = []
            local_files = screenshots + inline_paths
            for idx, local_path in enumerate(local_files):
                try:
                    s3_url = await asyncio.to_thread(
                        self._s3.upload_file,
                        local_path,
                        f"ai-videos/web-capture/{run_id}/{local_path.name}",
                        None,
                    )
                    files.append({
                        "url": s3_url,
                        "name": local_path.name,
                        "type": "image",
                    })
                except Exception as e:
                    logger.warning(f"[WebCapture] S3 upload failed for {local_path.name}: {e}")

            return files, text_block

        finally:
            try:
                await page.close()
            except Exception:
                pass
            try:
                await context.close()
            except Exception:
                pass

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _extract_metadata(self, page: Any) -> Dict[str, Any]:
        """Pull title, og/meta tags, page text, and ranked image URLs from DOM."""
        try:
            return await page.evaluate(
                """() => {
                    const meta = (sel) => {
                        const el = document.querySelector(sel);
                        return el ? (el.getAttribute('content') || '') : '';
                    };
                    // Rank visible <img> by area, return absolute URLs
                    const images = Array.from(document.querySelectorAll('img'))
                        .map(img => {
                            const r = img.getBoundingClientRect();
                            const w = img.naturalWidth || r.width || 0;
                            const h = img.naturalHeight || r.height || 0;
                            return {
                                src: img.currentSrc || img.src || '',
                                w: w,
                                h: h,
                                area: w * h,
                                alt: (img.alt || '').slice(0, 120),
                            };
                        })
                        .filter(x => x.src && x.src.startsWith('http'))
                        .sort((a, b) => b.area - a.area);
                    const text = (document.body && document.body.innerText) || '';
                    return {
                        title: document.title || '',
                        og_description: meta('meta[property="og:description"]'),
                        og_image: meta('meta[property="og:image"]'),
                        meta_description: meta('meta[name="description"]'),
                        text: text,
                        images: images,
                    };
                }"""
            )
        except Exception as e:
            logger.warning(f"[WebCapture] Metadata eval failed: {e}")
            return {}

    def _format_text_block(self, url: str, meta: Dict[str, Any]) -> str:
        if not meta:
            return ""
        title = (meta.get("title") or "").strip()
        og_desc = (meta.get("og_description") or "").strip()
        meta_desc = (meta.get("meta_description") or "").strip()
        text = (meta.get("text") or "").strip()
        if len(text) > _PAGE_TEXT_CHARS:
            text = text[:_PAGE_TEXT_CHARS] + "…"

        lines = [f"--- Captured from {url} ---"]
        if title:
            lines.append(f"Title: {title}")
        if og_desc:
            lines.append(f"Description: {og_desc}")
        elif meta_desc:
            lines.append(f"Description: {meta_desc}")
        if text:
            lines.append(f"Page text:\n{text}")
        return "\n".join(lines)

    async def _take_screenshots(
        self,
        page: Any,
        out_dir: Path,
        slug: str,
        run_id: str,
    ) -> List[Path]:
        """Take above-fold, mid, and footer screenshots."""
        results: List[Path] = []
        positions: List[Tuple[str, str]] = [
            ("above-fold", "0"),
            ("mid", "Math.max(0, document.body.scrollHeight * 0.4 - window.innerHeight/2)"),
            ("footer", "Math.max(0, document.body.scrollHeight - window.innerHeight)"),
        ]
        for label, scroll_expr in positions[:_SCREENSHOTS_PER_URL]:
            try:
                await page.evaluate(f"window.scrollTo(0, {scroll_expr});")
                # Let lazy-loaded images render
                await page.wait_for_timeout(450)
                path = out_dir / f"{slug}-{run_id}-{label}.png"
                await page.screenshot(path=str(path), full_page=False)
                results.append(path)
            except Exception as e:
                logger.warning(f"[WebCapture] Screenshot '{label}' failed: {e}")
        return results

    async def _download_inline_images(
        self,
        ranked_images: List[Dict[str, Any]],
        out_dir: Path,
        slug: str,
        run_id: str,
    ) -> List[Path]:
        """Download top N ranked inline images, skipping icons and tiny assets."""
        if not ranked_images:
            return []

        picked: List[Dict[str, Any]] = []
        seen_src: set = set()
        for img in ranked_images:
            src = img.get("src", "")
            if not src or src in seen_src:
                continue
            if any(hint in src.lower() for hint in _ICON_URL_HINTS):
                continue
            w = img.get("w") or 0
            h = img.get("h") or 0
            if w and h and (w < _MIN_IMAGE_DIM_PX or h < _MIN_IMAGE_DIM_PX):
                continue
            seen_src.add(src)
            picked.append(img)
            if len(picked) >= _MAX_INLINE_IMAGES_PER_URL:
                break

        if not picked:
            return []

        results: List[Path] = []
        try:
            async with httpx.AsyncClient(
                timeout=_HTTP_TIMEOUT_S,
                follow_redirects=True,
                headers={"User-Agent": _USER_AGENT},
            ) as client:
                for idx, img in enumerate(picked):
                    src = img["src"]
                    try:
                        resp = await client.get(src)
                        if resp.status_code != 200 or not resp.content:
                            continue
                        ext = _guess_image_ext(src, resp.headers.get("content-type", ""))
                        path = out_dir / f"{slug}-{run_id}-img{idx}{ext}"
                        path.write_bytes(resp.content)
                        results.append(path)
                    except Exception as e:
                        logger.warning(f"[WebCapture] Inline image fetch failed for {src}: {e}")
        except Exception as e:
            logger.warning(f"[WebCapture] httpx client failed: {e}")
        return results


def _guess_image_ext(url: str, content_type: str) -> str:
    ct = (content_type or "").lower()
    if "png" in ct:
        return ".png"
    if "webp" in ct:
        return ".webp"
    if "gif" in ct:
        return ".gif"
    if "svg" in ct:
        return ".svg"
    if "jpeg" in ct or "jpg" in ct:
        return ".jpg"
    # Fallback to URL suffix
    suffix = Path(urlparse(url).path).suffix.lower()
    if suffix in (".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"):
        return ".jpg" if suffix == ".jpeg" else suffix
    return ".jpg"
