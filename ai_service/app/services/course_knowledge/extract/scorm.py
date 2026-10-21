"""SCORM packages: the HTML pages the package ships, free (spec §6.5).

The package root is the launch URL minus its launch_path (dirname of the
launch URL when the path does not match). imsmanifest.xml there lists the
resources; the launch page goes first. Only .html / .htm files under the
same https scheme, host and path prefix are fetched, with no redirects (so a
manifest cannot point the server at another host), capped at 40 files, 5 MB
in total and 10 s per fetch. A package that draws its text with scripts
yields almost nothing: under 200 characters is EMPTY.
"""
from __future__ import annotations

import asyncio
import logging
import posixpath
import re
from typing import List, Optional
from urllib.parse import unquote, urljoin, urlsplit

from ...tutor.slide_source import html_to_text
from . import cache
from .documents import fetch_https, within_prefix
from .types import Extraction, Segment, SlideRef

logger = logging.getLogger(__name__)

MAX_FILES = 40
MAX_TOTAL_BYTES = 5 * 1024 * 1024
MAX_MANIFEST_BYTES = 1024 * 1024
FETCH_TIMEOUT = 10.0
MIN_TEXT_CHARS = 200
SCRIPTED_NOTE = "Interactive package draws its text with scripts: only the title is used"

_HREF_RE = re.compile(r"<(?:[\w-]+:)?(?:resource|file)\b[^>]*?\bhref\s*=\s*[\"']([^\"']+)[\"']", re.IGNORECASE)


def package_root(launch_url: str, launch_path: Optional[str]) -> Optional[str]:
    url = (launch_url or "").strip()
    if urlsplit(url).scheme != "https":
        return None
    path = (launch_path or "").strip().lstrip("/")
    clean = url.split("?", 1)[0].split("#", 1)[0]
    if path and clean.endswith("/" + path):
        root = clean[: -len(path)]
    else:
        root = clean.rsplit("/", 1)[0] + "/"
    return root if root.endswith("/") else root + "/"


def manifest_hrefs(xml: str) -> List[str]:
    return [h.strip() for h in _HREF_RE.findall(xml or "") if h.strip()]


def allowed_pages(root: str, hrefs: List[str], launch_path: Optional[str]) -> List[str]:
    """Absolute https URLs of the package's HTML pages, launch page first, deduped."""
    ordered = ([launch_path] if launch_path else []) + hrefs
    out: List[str] = []
    seen = set()
    for href in ordered:
        href = (href or "").strip()
        if not href:
            continue
        absolute = urljoin(root, href).split("#", 1)[0]
        path = urlsplit(absolute).path.lower()
        if not (path.endswith(".html") or path.endswith(".htm")):
            continue
        if not within_prefix(absolute, root):
            continue
        if absolute in seen:
            continue
        seen.add(absolute)
        out.append(absolute)
    return out


async def extract_scorm(ref: SlideRef) -> Extraction:
    key = ref.pointer_key or ""
    hit = await asyncio.to_thread(cache.get, "scorm", key)
    if hit is not None:
        if hit.segments:
            return Extraction(ref.slide_id, "scorm", segments=hit.segments, status="READY")
        return Extraction(ref.slide_id, "scorm", status="EMPTY", note=SCRIPTED_NOTE)

    launch_url = str(ref.extras.get("launch_url") or "")
    launch_path = ref.extras.get("launch_path")
    root = package_root(launch_url, launch_path)
    if root is None:
        return Extraction(ref.slide_id, "scorm", status="UNSUPPORTED", note="The package is not on a secure (https) link")

    hrefs: List[str] = []
    raw = await fetch_https(root + "imsmanifest.xml", max_bytes=MAX_MANIFEST_BYTES, timeout=FETCH_TIMEOUT,
                            allow_prefix=root)
    if raw:
        hrefs = manifest_hrefs(raw.decode("utf-8", errors="replace"))
    if not launch_path:
        # The launch file itself, relative to the root, when the manifest is silent.
        rel = launch_url.split("?", 1)[0][len(root):] if launch_url.startswith(root) else ""
        launch_path = rel or None
    pages = allowed_pages(root, hrefs, launch_path)[:MAX_FILES]

    segs: List[Segment] = []
    total = fetched = 0
    for idx, url in enumerate(pages, start=1):
        if total >= MAX_TOTAL_BYTES:
            break
        try:
            data = await fetch_https(url, max_bytes=MAX_TOTAL_BYTES - total, timeout=FETCH_TIMEOUT, allow_prefix=root)
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001 - one broken page must not drop the package
            logger.info("SCORM page %s skipped: %s", url, exc)
            continue
        if not data:
            continue
        fetched += 1
        total += len(data)
        body = html_to_text(data.decode("utf-8", errors="replace"))
        if body:
            name = unquote(posixpath.basename(urlsplit(url).path)) or f"page {idx}"
            segs.append(Segment(text=body, anchor="page", page=idx, label=name))

    if sum(len(s.text) for s in segs) < MIN_TEXT_CHARS:
        if fetched:
            # Only a package that was actually read is remembered as empty; a
            # failed fetch is tried again next time.
            await asyncio.to_thread(cache.put, "scorm", key, "FREE", [], {"pages": len(pages), "bytes": total})
        return Extraction(ref.slide_id, "scorm", status="EMPTY", note=SCRIPTED_NOTE)
    await asyncio.to_thread(cache.put, "scorm", key, "FREE", segs, {"pages": len(pages), "bytes": total})
    return Extraction(ref.slide_id, "scorm", segments=segs, status="READY")


__all__ = ["extract_scorm", "package_root", "manifest_hrefs", "allowed_pages", "SCRIPTED_NOTE"]
