"""
Pexels API client for stock photo and video search.

Synchronous client (pipeline uses ThreadPoolExecutor, not async).
Supports round-robin API key rotation for rate limit management.

Usage:
    svc = PexelsService("key1,key2,key3")
    photo = svc.search_photos("ocean sunset", orientation="landscape")
    video = svc.search_videos("forest aerial drone", orientation="landscape")
"""

from __future__ import annotations

import json
import logging
import threading
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class PexelsService:
    """Synchronous Pexels API client with round-robin key rotation."""

    PHOTOS_URL = "https://api.pexels.com/v1/search"
    VIDEOS_URL = "https://api.pexels.com/videos/search"

    # Rotate to next key when remaining requests drop below this threshold
    _REMAINING_THRESHOLD = 10
    # HTTP timeout for Pexels API calls (seconds)
    _TIMEOUT = 15

    def __init__(self, api_keys_csv: str) -> None:
        self._keys: List[str] = [k.strip() for k in api_keys_csv.split(",") if k.strip()]
        self._key_index: int = 0
        self._lock = threading.Lock()
        # Track remaining quota per key index from X-Ratelimit-Remaining header
        self._key_remaining: Dict[int, int] = {}

    @property
    def is_available(self) -> bool:
        """True if at least one API key is configured."""
        return len(self._keys) > 0

    # ── Key Rotation ────────────────────────────────────────────────────

    def _get_key(self) -> str:
        """Thread-safe key selection. Rotates when current key's quota is low."""
        with self._lock:
            if not self._keys:
                raise RuntimeError("No Pexels API keys configured")

            # Check if current key is low on quota — rotate if so
            remaining = self._key_remaining.get(self._key_index)
            if remaining is not None and remaining < self._REMAINING_THRESHOLD and len(self._keys) > 1:
                self._key_index = (self._key_index + 1) % len(self._keys)
                logger.info(f"[Pexels] Rotated to key index {self._key_index} (previous key low: {remaining} remaining)")

            return self._keys[self._key_index]

    def _rotate_key(self) -> None:
        """Force-rotate to the next key (called on 429)."""
        with self._lock:
            if len(self._keys) > 1:
                old = self._key_index
                self._key_index = (self._key_index + 1) % len(self._keys)
                logger.info(f"[Pexels] Force-rotated key {old} → {self._key_index}")

    def _update_remaining(self, key_index: int, response: Any) -> None:
        """Update remaining quota from response headers."""
        try:
            remaining_str = response.headers.get("X-Ratelimit-Remaining", "")
            if remaining_str:
                self._key_remaining[key_index] = int(remaining_str)
        except (ValueError, AttributeError):
            pass

    # ── HTTP Helper ─────────────────────────────────────────────────────

    def _request(self, url: str, params: Dict[str, Any], max_retries: int = 2) -> Optional[Dict]:
        """Make authenticated GET request to Pexels API with retry on 429."""
        query_string = urllib.parse.urlencode(params)
        full_url = f"{url}?{query_string}"

        for attempt in range(max_retries):
            key_index = self._key_index  # snapshot for quota tracking
            api_key = self._get_key()

            req = urllib.request.Request(full_url)
            req.add_header("Authorization", api_key)
            req.add_header("User-Agent", "Vacademy-AI-Video/1.0")

            try:
                with urllib.request.urlopen(req, timeout=self._TIMEOUT) as response:
                    self._update_remaining(key_index, response)
                    data = json.loads(response.read().decode("utf-8"))
                    return data
            except urllib.error.HTTPError as e:
                if e.code == 429:
                    logger.warning(f"[Pexels] Rate limited (429) on key {key_index}, rotating...")
                    self._rotate_key()
                    if attempt < max_retries - 1:
                        continue  # retry with next key
                    logger.error(f"[Pexels] All retries exhausted (429)")
                    return None
                else:
                    logger.error(f"[Pexels] HTTP {e.code}: {e.reason}")
                    return None
            except (urllib.error.URLError, TimeoutError, OSError) as e:
                logger.error(f"[Pexels] Network error: {e}")
                return None
            except Exception as e:
                logger.error(f"[Pexels] Unexpected error: {e}")
                return None

        return None

    # ── Photo Search ────────────────────────────────────────────────────

    def search_photos(
        self,
        query: str,
        orientation: str = "landscape",
        per_page: int = 5,
    ) -> Optional[Dict[str, str]]:
        """
        Search Pexels photos. Returns the best match or None.

        Args:
            query: Search terms (e.g., "ocean waves sunset")
            orientation: "landscape" | "portrait" | "square"
            per_page: Number of results to fetch (1-80)

        Returns:
            {"url": "https://images.pexels.com/...", "photographer": "...", "alt": "..."}
            or None if no results / API error.
        """
        if not self.is_available:
            return None

        params = {
            "query": query,
            "orientation": orientation,
            "per_page": min(per_page, 80),
            "size": "large",
        }

        data = self._request(self.PHOTOS_URL, params)
        if not data:
            return None

        photos = data.get("photos", [])
        if not photos:
            logger.info(f"[Pexels] No photo results for: {query[:50]}")
            return None

        # Pick the first result (Pexels sorts by relevance)
        photo = photos[0]
        src = photo.get("src", {})

        # Prefer large2x (w=2000) for 1920px video frames, fall back to large (w=940)
        url = src.get("large2x") or src.get("large") or src.get("original")
        if not url:
            return None

        return {
            "url": url,
            "photographer": photo.get("photographer", ""),
            "photographer_url": photo.get("photographer_url", ""),
            "alt": photo.get("alt", query),
            "pexels_url": photo.get("url", ""),  # link back to Pexels page
        }

    # ── Video Search ────────────────────────────────────────────────────

    def search_videos(
        self,
        query: str,
        orientation: str = "landscape",
        per_page: int = 3,
        min_duration: int = 5,
    ) -> Optional[Dict[str, str]]:
        """
        Search Pexels videos. Returns the best HD match or None.

        Args:
            query: Search terms (e.g., "coral reef tropical fish")
            orientation: "landscape" | "portrait" | "square"
            per_page: Number of results to fetch
            min_duration: Minimum video duration in seconds

        Returns:
            {"url": "https://...mp4", "image": "poster_url", "photographer": "..."}
            or None if no results / API error.
        """
        if not self.is_available:
            return None

        params = {
            "query": query,
            "orientation": orientation,
            "per_page": min(per_page, 80),
            "size": "medium",
        }

        data = self._request(self.VIDEOS_URL, params)
        if not data:
            return None

        videos = data.get("videos", [])
        if not videos:
            logger.info(f"[Pexels] No video results for: {query[:50]}")
            return None

        # Find first video meeting duration requirement
        for video in videos:
            duration = video.get("duration", 0)
            if duration < min_duration:
                continue

            # Pick HD mp4 from video_files array
            video_files = video.get("video_files", [])
            hd_file = self._pick_video_file(video_files, preferred_quality="hd")
            if not hd_file:
                continue

            return {
                "url": hd_file["link"],
                "image": video.get("image", ""),  # poster/thumbnail
                "photographer": video.get("user", {}).get("name", ""),
                "photographer_url": video.get("user", {}).get("url", ""),
                "duration": duration,
                "pexels_url": video.get("url", ""),
            }

        logger.info(f"[Pexels] No suitable video (min {min_duration}s) for: {query[:50]}")
        return None

    @staticmethod
    def _pick_video_file(
        video_files: List[Dict], preferred_quality: str = "hd"
    ) -> Optional[Dict]:
        """Pick the best mp4 file from Pexels video_files array.

        Priority: hd mp4 > sd mp4 > any mp4
        """
        mp4_files = [f for f in video_files if f.get("file_type") == "video/mp4"]
        if not mp4_files:
            return None

        # Try preferred quality first
        for f in mp4_files:
            if f.get("quality") == preferred_quality:
                return f

        # Fall back to sd
        for f in mp4_files:
            if f.get("quality") == "sd":
                return f

        # Any mp4
        return mp4_files[0] if mp4_files else None
