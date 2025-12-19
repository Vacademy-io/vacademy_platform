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
        self._videos_url = "https://www.googleapis.com/youtube/v3/videos"

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
                        "videoEmbeddable": "true",  # Only return embeddable videos
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

                # Verify the video is actually available and accessible
                is_available = await self._verify_video_availability(video_id)
                if not is_available:
                    logger.warning(f"YouTube video {video_id} is not available or accessible. Skipping.")
                    return None

                logger.info(f"Found YouTube video: {video_id} for query: {query}")
                return video_id

        except httpx.HTTPStatusError as e:
            logger.error(f"YouTube API error for query '{query}': {e.response.status_code} - {e.response.text}")
            return None
        except Exception as e:
            logger.error(f"Error searching YouTube for query '{query}': {str(e)}")
            return None

    async def _verify_video_availability(self, video_id: str) -> bool:
        """
        Verify that a YouTube video is available, public, and embeddable.
        
        Args:
            video_id: YouTube video ID to verify
            
        Returns:
            True if video is available and accessible, False otherwise
        """
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    self._videos_url,
                    params={
                        "part": "status,contentDetails",
                        "id": video_id,
                        "key": self._api_key
                    }
                )
                response.raise_for_status()
                data = response.json()
                
                items = data.get("items", [])
                if not items:
                    logger.warning(f"Video {video_id} not found in videos.list API")
                    return False
                
                video_data = items[0]
                status = video_data.get("status", {})
                content_details = video_data.get("contentDetails", {})
                
                # Check if video is public
                privacy_status = status.get("privacyStatus")
                if privacy_status != "public":
                    logger.warning(f"Video {video_id} is not public (status: {privacy_status})")
                    return False
                
                # Check if video is embeddable
                embeddable = status.get("embeddable", False)
                if not embeddable:
                    logger.warning(f"Video {video_id} is not embeddable")
                    return False
                
                # Check if video is not blocked in any region (contentDetails.regionRestriction)
                region_restriction = content_details.get("regionRestriction")
                if region_restriction:
                    blocked = region_restriction.get("blocked", [])
                    if blocked:
                        logger.warning(f"Video {video_id} is blocked in regions: {blocked}")
                        # Still return True if only blocked in some regions (might be accessible in others)
                        # You can make this stricter if needed
                
                # Check upload status
                upload_status = status.get("uploadStatus")
                if upload_status not in ["processed", "uploaded"]:
                    logger.warning(f"Video {video_id} upload status is not ready: {upload_status}")
                    return False
                
                logger.debug(f"Video {video_id} verified as available and embeddable")
                return True
            
        except httpx.HTTPStatusError as e:
            logger.error(f"Error verifying video {video_id}: {e.response.status_code} - {e.response.text}")
            return False
        except Exception as e:
            logger.error(f"Exception verifying video {video_id}: {str(e)}")
            return False

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


