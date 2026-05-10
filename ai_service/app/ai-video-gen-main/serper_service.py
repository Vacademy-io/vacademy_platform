"""
Serper API client for Google Image / Video / Web search.

Used by the video pipeline to find real photos and B-roll of named entities
(people, places, events, products) — the kind of subjects where stock libraries
(Pexels/Pixabay) come up empty because the entity is too specific. Examples:

    "Donald Trump 2026 oval office"     → real news photo
    "Strait of Hormuz aerial naval"     → Google image of the actual location
    "Iran flag map"                     → wire-service news image

Synchronous client (pipeline uses ThreadPoolExecutor, not async).
Supports round-robin API key rotation for rate limit management.
Per-run-dir disk cache keeps re-renders free.

Video search filters out platforms whose embeds the renderer can't frame-seek
(YouTube, Vimeo, TikTok, Instagram, Facebook). Only direct-CDN mp4s pass
through. In practice this means Serper Videos is rarely useful for B-roll —
Pexels/Pixabay remain the primary video providers — and its main value is
image search.

Usage:
    svc = SerperService("key1,key2,key3")
    img = svc.search_images("Donald Trump 2026 oval office", orientation="landscape")
    vid = svc.search_videos("Strait of Hormuz tanker")
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


# Hosts whose video URLs are NOT directly playable in the headless renderer.
# The renderer at generate_video.py paused-seeks each <video> element by
# setting currentTime + waiting for "seeked"; iframe-embedded players
# (YouTube IFrame Player, Vimeo Player, TikTok / Instagram / Facebook
# embeds) don't expose that API and frame-seek snaps to keyframes (~1-2s
# granularity), producing stuttering output. Filter them out at fetch time.
_VIDEO_BLOCKLIST_HOSTS = (
    "youtube.com",
    "youtu.be",
    "m.youtube.com",
    "vimeo.com",
    "player.vimeo.com",
    "tiktok.com",
    "vm.tiktok.com",
    "instagram.com",
    "www.instagram.com",
    "facebook.com",
    "www.facebook.com",
    "fb.watch",
)

# Direct CDN mp4 extensions — accept these even if host is unfamiliar.
_VIDEO_DIRECT_EXTS = (".mp4", ".mov", ".webm", ".m4v")


class SerperService:
    """Synchronous Serper API client with round-robin key rotation + disk cache."""

    IMAGES_URL = "https://google.serper.dev/images"
    VIDEOS_URL = "https://google.serper.dev/videos"
    SEARCH_URL = "https://google.serper.dev/search"

    _TIMEOUT = 15

    def __init__(self, api_keys_csv: str, cache_root: Optional[Path] = None) -> None:
        self._keys: List[str] = [k.strip() for k in api_keys_csv.split(",") if k.strip()]
        self._key_index: int = 0
        self._lock = threading.Lock()
        # In-memory LRU-ish cache (just a dict, capped) for the current process.
        self._mem_cache: Dict[str, Dict[str, Any]] = {}
        self._mem_cache_max = 256
        # Optional per-run disk cache. Set via set_run_dir() so re-renders of
        # the same video don't re-bill Serper queries.
        self._cache_dir: Optional[Path] = None
        if cache_root is not None:
            self.set_run_dir(cache_root)
        # Per-render usage counters. Reset by reset_usage() at render start.
        self._image_query_count = 0
        self._video_query_count = 0
        self._web_query_count = 0
        self._cache_hit_count = 0

    @property
    def is_available(self) -> bool:
        """True if at least one API key is configured."""
        return len(self._keys) > 0

    def set_run_dir(self, run_dir: Path) -> None:
        """Configure per-run disk cache directory. Safe to call repeatedly."""
        try:
            self._cache_dir = Path(run_dir) / "_serper_cache"
            self._cache_dir.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            logger.warning(f"[Serper] Failed to set cache dir: {e}")
            self._cache_dir = None

    def reset_usage(self) -> None:
        """Reset per-render usage counters."""
        self._image_query_count = 0
        self._video_query_count = 0
        self._web_query_count = 0
        self._cache_hit_count = 0

    def get_usage(self) -> Dict[str, int]:
        """Return current per-render usage counters."""
        return {
            "image_queries": self._image_query_count,
            "video_queries": self._video_query_count,
            "web_queries": self._web_query_count,
            "cache_hits": self._cache_hit_count,
        }

    # ── Key Rotation ────────────────────────────────────────────────────

    def _get_key(self) -> str:
        with self._lock:
            if not self._keys:
                raise RuntimeError("No Serper API keys configured")
            return self._keys[self._key_index]

    def _rotate_key(self) -> None:
        with self._lock:
            if len(self._keys) > 1:
                old = self._key_index
                self._key_index = (self._key_index + 1) % len(self._keys)
                logger.info(f"[Serper] Force-rotated key {old} → {self._key_index}")

    # ── Cache ───────────────────────────────────────────────────────────

    def _cache_key(self, endpoint: str, payload: Dict[str, Any]) -> str:
        # Stable JSON serialization for the cache key
        canon = json.dumps(payload, sort_keys=True, ensure_ascii=False)
        h = hashlib.sha256(f"{endpoint}|{canon}".encode("utf-8")).hexdigest()
        return h

    def _cache_get(self, key: str) -> Optional[Dict[str, Any]]:
        # Memory first
        hit = self._mem_cache.get(key)
        if hit is not None:
            self._cache_hit_count += 1
            return hit
        # Disk
        if self._cache_dir is not None:
            path = self._cache_dir / f"{key}.json"
            if path.exists():
                try:
                    data = json.loads(path.read_text(encoding="utf-8"))
                    self._mem_cache[key] = data
                    self._cache_hit_count += 1
                    return data
                except Exception as e:
                    logger.warning(f"[Serper] Cache read failed for {key}: {e}")
        return None

    def _cache_put(self, key: str, data: Dict[str, Any]) -> None:
        # Cap the in-memory cache crudely
        if len(self._mem_cache) >= self._mem_cache_max:
            # drop one arbitrary entry
            try:
                self._mem_cache.pop(next(iter(self._mem_cache)))
            except StopIteration:
                pass
        self._mem_cache[key] = data
        if self._cache_dir is not None:
            try:
                (self._cache_dir / f"{key}.json").write_text(
                    json.dumps(data, ensure_ascii=False), encoding="utf-8"
                )
            except Exception as e:
                logger.warning(f"[Serper] Cache write failed for {key}: {e}")

    # ── HTTP ────────────────────────────────────────────────────────────

    def _request(self, url: str, payload: Dict[str, Any], max_retries: int = 2) -> Optional[Dict[str, Any]]:
        cache_key = self._cache_key(url, payload)
        cached = self._cache_get(cache_key)
        if cached is not None:
            return cached

        body = json.dumps(payload).encode("utf-8")

        last_error: Optional[str] = None
        for attempt in range(max_retries):
            api_key = self._get_key()
            req = urllib.request.Request(url, data=body, method="POST")
            req.add_header("X-API-KEY", api_key)
            req.add_header("Content-Type", "application/json")
            req.add_header("User-Agent", "Vacademy-AI-Video/1.0")

            try:
                with urllib.request.urlopen(req, timeout=self._TIMEOUT) as response:
                    data = json.loads(response.read().decode("utf-8"))
                    self._cache_put(cache_key, data)
                    return data
            except urllib.error.HTTPError as e:
                if e.code in (429, 401, 403) and attempt < max_retries - 1:
                    logger.warning(f"[Serper] HTTP {e.code} on key {self._key_index}, rotating...")
                    self._rotate_key()
                    time.sleep(0.4)
                    continue
                last_error = f"HTTP {e.code}: {e.reason}"
                logger.error(f"[Serper] {last_error}")
                return None
            except (urllib.error.URLError, TimeoutError, OSError) as e:
                last_error = f"network: {e}"
                logger.error(f"[Serper] Network error: {e}")
                if attempt < max_retries - 1:
                    time.sleep(0.4)
                    continue
                return None
            except Exception as e:
                logger.error(f"[Serper] Unexpected error: {e}")
                return None

        logger.error(f"[Serper] All retries exhausted: {last_error}")
        return None

    # ── Image Search ────────────────────────────────────────────────────

    def search_images(
        self,
        query: str,
        gl: str = "us",
        hl: str = "en",
        num: int = 10,
        orientation: Optional[str] = None,
        tbs: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Search Google Images via Serper. Returns up to `num` normalized results.

        Args:
            query: search terms (e.g., "Donald Trump 2026 oval office")
            gl: country code (e.g. "us", "in")
            hl: language code (e.g. "en", "hi")
            num: number of results (1–100)
            orientation: "landscape" | "portrait" | "square" — translated to
                Google's `tbs=ic:specific,isz:m,iar:w` style filter; may not
                always be honored. Pass None to skip.
            tbs: extra Google search filter string (e.g. "qdr:m" for past month).

        Returns: list of {url, source, title, link, position, width, height,
                          thumbnail_url, host}. Empty list on error / no results.
        """
        if not self.is_available:
            return []

        payload: Dict[str, Any] = {"q": query, "gl": gl, "hl": hl, "num": min(max(num, 1), 100)}

        # Translate orientation to Google's `iar` (image aspect ratio) filter.
        # Combined with any caller-supplied tbs.
        iar_map = {"landscape": "w", "portrait": "t", "square": "s"}
        iar = iar_map.get((orientation or "").lower())
        tbs_parts = []
        if iar:
            tbs_parts.append(f"iar:{iar}")
        if tbs:
            tbs_parts.append(tbs)
        if tbs_parts:
            payload["tbs"] = ",".join(tbs_parts)

        self._image_query_count += 1
        data = self._request(self.IMAGES_URL, payload)
        if not data:
            return []

        items = data.get("images") or []
        results: List[Dict[str, Any]] = []
        for it in items:
            url = it.get("imageUrl") or ""
            if not url:
                continue
            link = it.get("link") or ""
            host = ""
            try:
                host = urlparse(link).netloc.lower()
            except Exception:
                pass
            results.append({
                "url": url,
                "source": it.get("source") or "",
                "title": it.get("title") or "",
                "link": link,
                "position": it.get("position"),
                "width": it.get("imageWidth"),
                "height": it.get("imageHeight"),
                "thumbnail_url": it.get("thumbnailUrl") or "",
                "host": host,
            })
        return results

    def best_image(
        self,
        query: str,
        gl: str = "us",
        hl: str = "en",
        orientation: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Convenience: return just the top image result, or None."""
        results = self.search_images(query, gl=gl, hl=hl, num=10, orientation=orientation)
        return results[0] if results else None

    # ── Video Search ────────────────────────────────────────────────────

    def search_videos(
        self,
        query: str,
        gl: str = "us",
        hl: str = "en",
        num: int = 10,
        tbs: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Search Google Videos via Serper. Filters out non-frame-seekable platforms.

        See _VIDEO_BLOCKLIST_HOSTS — YouTube, Vimeo, TikTok, Instagram,
        Facebook results are dropped because the renderer's paused-seek path
        can't drive their iframe players. Only results with a direct CDN mp4
        URL (mp4/mov/webm/m4v extension on `videoUrl`) survive.

        Returns: list of {url, source, title, link, duration, position,
                          thumbnail_url, host, channel}. Empty list on error.
        """
        if not self.is_available:
            return []

        payload: Dict[str, Any] = {"q": query, "gl": gl, "hl": hl, "num": min(max(num, 1), 100)}
        if tbs:
            payload["tbs"] = tbs

        self._video_query_count += 1
        data = self._request(self.VIDEOS_URL, payload)
        if not data:
            return []

        items = data.get("videos") or []
        results: List[Dict[str, Any]] = []
        for it in items:
            link = it.get("link") or ""
            host = ""
            try:
                host = urlparse(link).netloc.lower()
            except Exception:
                pass
            # Strip the embedding-blocked hosts.
            if any(host == b or host.endswith("." + b) for b in _VIDEO_BLOCKLIST_HOSTS):
                continue
            # Prefer a direct mp4 url if Serper returns one, else fall through
            # to `link` and let the caller decide. We accept only direct CDN
            # extensions on the playable URL.
            video_url = it.get("videoUrl") or it.get("link") or ""
            if not video_url:
                continue
            url_lower = video_url.lower().split("?")[0]
            if not url_lower.endswith(_VIDEO_DIRECT_EXTS):
                # Non-direct (most Google Videos results are page links to
                # publisher sites, not raw mp4s). Skip — caller falls back to
                # Pexels/Pixabay.
                continue
            results.append({
                "url": video_url,
                "source": it.get("source") or "",
                "title": it.get("title") or "",
                "link": link,
                "duration": it.get("duration") or "",
                "position": it.get("position"),
                "thumbnail_url": it.get("imageUrl") or "",
                "host": host,
                "channel": it.get("channel") or "",
            })
        return results

    def best_video(
        self,
        query: str,
        gl: str = "us",
        hl: str = "en",
    ) -> Optional[Dict[str, Any]]:
        """Convenience: return just the top playable video result, or None."""
        results = self.search_videos(query, gl=gl, hl=hl, num=10)
        return results[0] if results else None

    # ── Web Search ──────────────────────────────────────────────────────

    def search_web(self, query: str, gl: str = "us", hl: str = "en", num: int = 10) -> Dict[str, Any]:
        """Plain Google Web search. Returns {organic, knowledge_graph, ...}.

        Lower-priority than the Perplexity-backed web_search_service.py for
        synthesis; useful when the pipeline wants raw URLs/titles rather than
        a synthesized answer.
        """
        if not self.is_available:
            return {}
        payload = {"q": query, "gl": gl, "hl": hl, "num": min(max(num, 1), 100)}
        self._web_query_count += 1
        data = self._request(self.SEARCH_URL, payload)
        return data or {}


__all__ = ["SerperService"]
