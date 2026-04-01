"""
HTTP client for the dedicated render worker server.

Submits render jobs and polls for completion. Pattern mirrors avatar_service.py.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

import httpx

logger = logging.getLogger(__name__)


class RenderService:
    """Client for the remote render worker (Hetzner CPX32)."""

    def __init__(self, render_server_url: str, render_key: str = ""):
        self.base_url = render_server_url.rstrip("/")
        self.render_key = render_key
        self._timeout = 30

    @property
    def is_configured(self) -> bool:
        return bool(self.base_url)

    def _headers(self) -> dict:
        h = {"Content-Type": "application/json"}
        if self.render_key:
            h["X-Render-Key"] = self.render_key
        return h

    def submit(
        self,
        video_id: str,
        timeline_url: str,
        audio_url: str,
        words_url: Optional[str] = None,
        branding_meta_url: Optional[str] = None,
        avatar_video_url: Optional[str] = None,
        callback_url: Optional[str] = None,
        show_captions: bool = True,
        audio_delay: float = 0.0,
    ) -> str:
        """
        Submit a render job to the worker. Returns the job_id.

        Raises:
            RuntimeError: If submission fails
        """
        payload = {
            "video_id": video_id,
            "timeline_url": timeline_url,
            "audio_url": audio_url,
            "words_url": words_url,
            "branding_meta_url": branding_meta_url,
            "avatar_video_url": avatar_video_url,
            "callback_url": callback_url,
            "show_captions": show_captions,
            "audio_delay": audio_delay,
        }

        try:
            with httpx.Client(timeout=self._timeout) as client:
                resp = client.post(
                    f"{self.base_url}/jobs",
                    json=payload,
                    headers=self._headers(),
                )
                resp.raise_for_status()
                data = resp.json()
                job_id = data["job_id"]
                logger.info(f"[RenderService] Submitted job {job_id} for video {video_id}")
                return job_id
        except httpx.HTTPStatusError as e:
            raise RuntimeError(
                f"Render server returned {e.response.status_code}: {e.response.text}"
            )
        except Exception as e:
            raise RuntimeError(f"Failed to submit render job: {e}")

    def check_status(self, job_id: str) -> Dict[str, Any]:
        """
        Check render job status. Returns dict with:
        - status: queued | running | completed | failed
        - progress: 0-100 (optional)
        - video_url: S3 URL (when completed)
        - error: error message (when failed)
        """
        try:
            with httpx.Client(timeout=self._timeout) as client:
                resp = client.get(
                    f"{self.base_url}/jobs/{job_id}",
                    headers=self._headers(),
                )
                resp.raise_for_status()
                return resp.json()
        except Exception as e:
            logger.warning(f"[RenderService] Status check failed for {job_id}: {e}")
            return {"status": "unknown", "error": str(e)}

    def health_check(self) -> bool:
        """Check if the render server is healthy."""
        try:
            with httpx.Client(timeout=5) as client:
                resp = client.get(f"{self.base_url}/health")
                return resp.status_code == 200
        except Exception:
            return False
