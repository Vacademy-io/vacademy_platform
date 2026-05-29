"""
Media search + generation service for the AI video editor's media picker.

Wraps the pipeline's internal Pexels / Pixabay clients (stock photo + video
search) and the Gemini image-generation service behind a small, editor-facing
surface. Stock providers are imported lazily from the hyphenated
`ai-video-gen-main` package the same way `reels_broll_service` does.

Three capabilities:
  - search_images / search_videos: normalized result lists for the picker grid.
  - rehost_remote_url: copy a chosen remote (stock/AI) asset into our S3 so the
    editor's URL allowlist and the render worker can fetch it reliably.
  - generate_image: text-to-image via Gemini, uploaded to our S3.

All results are normalized to a single item shape:
  {url, thumb, photographer, photographer_url, alt, source, source_url,
   width, height, duration?}
"""
from __future__ import annotations

import logging
import sys
import urllib.request
import urllib.error
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

from ..config import get_settings
from .s3_service import S3Service

logger = logging.getLogger(__name__)

_PROVIDER_DIR = Path(__file__).resolve().parent.parent / "ai-video-gen-main"

# Max bytes we'll re-host from a remote provider (guards against huge files).
_MAX_REHOST_BYTES = 40 * 1024 * 1024  # 40 MB

_ALLOWED_REHOST_PREFIXES = ("image/", "video/")


def _orientation_dims(orientation: str) -> Tuple[int, int]:
    o = (orientation or "landscape").lower()
    if o == "portrait":
        return 720, 1280
    if o == "square":
        return 1024, 1024
    return 1280, 720


def _ext_for_content_type(ct: str) -> str:
    ct = (ct or "").lower()
    if "png" in ct:
        return "png"
    if "webp" in ct:
        return "webp"
    if "gif" in ct:
        return "gif"
    if "mp4" in ct:
        return "mp4"
    if "webm" in ct:
        return "webm"
    if "quicktime" in ct or "mov" in ct:
        return "mov"
    return "jpg"


class MediaSearchService:
    """Editor-facing stock search + image generation. Stateless except for the
    lazily-cached provider singletons (key-rotation state is meaningful)."""

    _pexels = None
    _pexels_resolved = False
    _pixabay = None
    _pixabay_resolved = False

    # ── Provider lazy import ────────────────────────────────────────────
    @classmethod
    def _get_pexels(cls):
        if cls._pexels is not None:
            return cls._pexels
        if cls._pexels_resolved:
            return None
        cls._pexels_resolved = True
        keys = (get_settings().pexels_api_keys or "").strip()
        if not keys:
            return None
        if str(_PROVIDER_DIR) not in sys.path:
            sys.path.insert(0, str(_PROVIDER_DIR))
        try:
            from pexels_service import PexelsService  # type: ignore
        except ImportError as e:
            logger.warning("[MediaSearch] cannot import PexelsService: %s", e)
            return None
        inst = PexelsService(keys)
        cls._pexels = inst if inst.is_available else None
        return cls._pexels

    @classmethod
    def _get_pixabay(cls):
        if cls._pixabay is not None:
            return cls._pixabay
        if cls._pixabay_resolved:
            return None
        cls._pixabay_resolved = True
        keys = (get_settings().pixabay_api_keys or "").strip()
        if not keys:
            return None
        if str(_PROVIDER_DIR) not in sys.path:
            sys.path.insert(0, str(_PROVIDER_DIR))
        try:
            from pixabay_service import PixabayService  # type: ignore
        except ImportError as e:
            logger.warning("[MediaSearch] cannot import PixabayService: %s", e)
            return None
        inst = PixabayService(keys)
        cls._pixabay = inst if inst.is_available else None
        return cls._pixabay

    # ── Normalization ───────────────────────────────────────────────────
    @staticmethod
    def _norm_photo(raw: Dict[str, Any], source: str) -> Dict[str, Any]:
        return {
            "url": raw.get("url", ""),
            "thumb": raw.get("thumb") or raw.get("url", ""),
            "photographer": raw.get("photographer", ""),
            "photographer_url": raw.get("photographer_url", ""),
            "alt": raw.get("alt", ""),
            "source": source,
            "source_url": raw.get("source_url", ""),
            "width": raw.get("width"),
            "height": raw.get("height"),
            "kind": "image",
        }

    @staticmethod
    def _norm_video(raw: Dict[str, Any], source: str) -> Dict[str, Any]:
        return {
            "url": raw.get("url", ""),
            "thumb": raw.get("image") or "",
            "photographer": raw.get("photographer", ""),
            "photographer_url": raw.get("photographer_url", ""),
            "alt": raw.get("alt", ""),
            "source": source,
            "source_url": raw.get("pexels_url", ""),
            "width": raw.get("width"),
            "height": raw.get("height"),
            "duration": raw.get("duration"),
            "kind": "video",
        }

    @staticmethod
    def _dedup(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        seen: set = set()
        out: List[Dict[str, Any]] = []
        for it in items:
            key = it.get("url") or it.get("source_url")
            if not key or key in seen:
                continue
            seen.add(key)
            out.append(it)
        return out

    @staticmethod
    def _interleave(a: List[Dict[str, Any]], b: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []
        for i in range(max(len(a), len(b))):
            if i < len(a):
                out.append(a[i])
            if i < len(b):
                out.append(b[i])
        return out

    # ── Search ──────────────────────────────────────────────────────────
    def search_images(
        self, query: str, provider: str = "auto", orientation: str = "landscape", per_page: int = 24
    ) -> Tuple[List[Dict[str, Any]], str]:
        provider = (provider or "auto").lower()
        results: List[Dict[str, Any]] = []
        used = provider
        if provider in ("pexels", "auto"):
            px = self._get_pexels()
            if px:
                results += [
                    self._norm_photo(r, "pexels")
                    for r in px.search_photos_many(query, orientation, per_page)
                ]
        if provider in ("pixabay", "auto"):
            pb = self._get_pixabay()
            if pb:
                pix = [
                    self._norm_photo(r, "pixabay")
                    for r in pb.search_photos_many(query, orientation, per_page)
                ]
                if provider == "auto":
                    results = self._interleave(results, pix)
                else:
                    results = pix
        if provider == "auto":
            used = "auto"
        return self._dedup(results)[:per_page], used

    def search_videos(
        self, query: str, provider: str = "auto", orientation: str = "landscape", per_page: int = 24
    ) -> Tuple[List[Dict[str, Any]], str]:
        provider = (provider or "auto").lower()
        results: List[Dict[str, Any]] = []
        if provider in ("pexels", "auto"):
            px = self._get_pexels()
            if px:
                results += [
                    self._norm_video(r, "pexels")
                    for r in px.search_video_candidates(query, orientation, per_page)
                ]
        if provider in ("pixabay", "auto"):
            pb = self._get_pixabay()
            if pb:
                pix = [
                    self._norm_video(r, "pixabay")
                    for r in pb.search_video_candidates(query, orientation, per_page)
                ]
                results = self._interleave(results, pix) if provider == "auto" else pix
        return self._dedup(results)[:per_page], (provider if provider != "auto" else "auto")

    # ── Re-host a chosen remote asset into our S3 ────────────────────────
    def rehost_remote_url(self, url: str, kind: str = "image") -> str:
        if not url or not url.lower().startswith(("http://", "https://")):
            raise ValueError("rehost requires an http(s) URL")
        req = urllib.request.Request(url, headers={"User-Agent": "Vacademy-AI-Video/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                content_type = resp.headers.get("Content-Type", "") or ""
                clen = resp.headers.get("Content-Length")
                if clen and int(clen) > _MAX_REHOST_BYTES:
                    raise ValueError("remote asset too large to re-host")
                data = resp.read(_MAX_REHOST_BYTES + 1)
        except urllib.error.URLError as e:
            raise RuntimeError(f"failed to fetch remote asset: {e}") from e
        if len(data) > _MAX_REHOST_BYTES:
            raise ValueError("remote asset too large to re-host")
        if content_type and not content_type.lower().startswith(_ALLOWED_REHOST_PREFIXES):
            # Some CDNs send octet-stream; fall back to the requested kind.
            content_type = "image/jpeg" if kind == "image" else "video/mp4"
        ext = _ext_for_content_type(content_type)
        s3_key = f"video-editor/media/{uuid4()}.{ext}"
        return S3Service().upload_file_content(
            content=data, filename=f"asset.{ext}", s3_key=s3_key, content_type=content_type,
        )

    # ── AI image generation (Gemini) ─────────────────────────────────────
    async def generate_image(self, prompt: str, orientation: str = "landscape") -> str:
        from .image_service import ImageGenerationService

        settings = get_settings()
        gemini_key = settings.gemini_api_key
        width, height = _orientation_dims(orientation)
        svc = ImageGenerationService(gemini_api_key=gemini_key)
        image_bytes, _usage = await svc._call_image_generation_llm(
            prompt, width, height, gemini_key=gemini_key
        )
        if not image_bytes:
            raise RuntimeError("image generation returned no data")
        s3_key = f"video-editor/media/ai/{uuid4()}.jpg"
        return S3Service().upload_file_content(
            content=image_bytes, filename="ai-image.jpg", s3_key=s3_key, content_type="image/jpeg",
        )
