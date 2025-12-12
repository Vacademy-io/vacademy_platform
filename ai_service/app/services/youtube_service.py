from __future__ import annotations

import logging
from typing import Optional
import httpx

from ..config import get_settings

logger = logging.getLogger(__name__)


class YouTubeService:
    """
    Service for searching YouTube videos using YouTube Data API v3.
    Matches the pattern from media-service YoutubeApiClient.
    """

    def __init__(self, api_key: Optional[str] = None) -> None:
        settings = get_settings()
        self._api_key = api_key or settings.youtube_api_key
        self._base_url = "https://www.googleapis.com/youtube/v3/search"

    async def search_video(self, query: str) -> Optional[str]:
        """
        Search YouTube for a video using the query string.
        Returns the video ID of the first result, or None if not found.
        
        Args:
            query: Search query (typically the slide title or keyword)
            
        Returns:
            Video ID string (e.g., "dQw4w9WgXcQ") or None if search fails
        """
        if not self._api_key:
            logger.warning("YouTube API key not configured. Cannot search for videos.")
            return None

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    self._base_url,
                    params={
                        "part": "snippet",
                        "q": query,
                        "type": "video",
                        "key": self._api_key,
                        "maxResults": 1
                    }
                )
                response.raise_for_status()
                data = response.json()

                # Extract video ID from response
                items = data.get("items", [])
                if not items:
                    logger.warning(f"No YouTube videos found for query: {query}")
                    return None

                video_id = items[0].get("id", {}).get("videoId")
                if not video_id:
                    logger.warning(f"No video ID found in YouTube response for query: {query}")
                    return None

                logger.info(f"Found YouTube video: {video_id} for query: {query}")
                return video_id

        except httpx.HTTPStatusError as e:
            logger.error(f"YouTube API error for query '{query}': {e.response.status_code} - {e.response.text}")
            return None
        except Exception as e:
            logger.error(f"Error searching YouTube for query '{query}': {str(e)}")
            return None

    def format_youtube_response(self, video_id: str, title: str, description: Optional[str] = None) -> dict:
        """
        Format YouTube video response as JSON matching media-service format.
        
        Args:
            video_id: YouTube video ID
            title: Video title
            description: Optional video description
            
        Returns:
            Dictionary with YouTube video details
        """
        return {
            "videoId": video_id,
            "title": title,
            "url": f"https://www.youtube.com/watch?v={video_id}",
            "embedUrl": f"https://www.youtube.com/embed/{video_id}",
            "description": description or ""
        }


__all__ = ["YouTubeService"]

