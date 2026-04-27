"""
HTTP client for the dedicated render worker server.

Submits render jobs and polls for completion. Pattern mirrors avatar_service.py.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

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
        show_branding: bool = True,
        audio_delay: float = 0.0,
        width: int = 1920,
        height: int = 1080,
        fps: Optional[int] = None,
        caption_position: Optional[str] = None,
        caption_text_color: Optional[str] = None,
        caption_bg_color: Optional[str] = None,
        caption_bg_opacity: Optional[int] = None,
        caption_font_size: Optional[int] = None,
        source_video_url: Optional[str] = None,
        source_video_urls: Optional[list] = None,
    ) -> str:
        """
        Submit a render job to the worker. Returns the job_id.

        Raises:
            RuntimeError: If submission fails
        """
        payload: dict = {
            "video_id": video_id,
            "timeline_url": timeline_url,
            "audio_url": audio_url,
            "words_url": words_url,
            "branding_meta_url": branding_meta_url,
            "avatar_video_url": avatar_video_url,
            "callback_url": callback_url,
            "show_captions": show_captions,
            "show_branding": show_branding,
            "audio_delay": audio_delay,
            "width": width,
            "height": height,
        }
        # Pass optional render settings — only include when provided
        if fps is not None:
            payload["fps"] = fps
        if caption_position is not None:
            payload["caption_position"] = caption_position
        if caption_text_color is not None:
            payload["caption_text_color"] = caption_text_color
        if caption_bg_color is not None:
            payload["caption_bg_color"] = caption_bg_color
        if caption_bg_opacity is not None:
            payload["caption_bg_opacity"] = caption_bg_opacity
        if caption_font_size is not None:
            payload["caption_font_size"] = caption_font_size
        if source_video_urls is not None:
            payload["source_video_urls"] = source_video_urls
        elif source_video_url is not None:
            payload["source_video_urls"] = [source_video_url]

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

    # ------------------------------------------------------------------
    # Audio operations — sentence-level slicing & splicing.
    # Both endpoints are synchronous on the worker side; a typical request
    # finishes in seconds. Use a longer timeout than the default 30s
    # because cold workers cold-start ffmpeg + boto3.
    # ------------------------------------------------------------------

    _AUDIO_OP_TIMEOUT = 300

    def slice_audio(
        self,
        audio_url: str,
        cuts: List[Dict[str, Any]],
        output_prefix: str,
        bucket: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Cut `audio_url` into N MP3 clips and upload each under
        `output_prefix`. Returns a list of `{id, audio_url, duration}`.

        Args:
            cuts: list of `{id: str, start: float, end: float}` dicts.
                  `id` becomes the filename (e.g. "sent-0" → "{prefix}sent-0.mp3").

        Raises RuntimeError on transport / worker failure.
        """
        payload = {
            "audio_url": audio_url,
            "cuts": cuts,
            "output_prefix": output_prefix,
        }
        if bucket is not None:
            payload["bucket"] = bucket
        try:
            with httpx.Client(timeout=self._AUDIO_OP_TIMEOUT) as client:
                resp = client.post(
                    f"{self.base_url}/audio/slice",
                    json=payload,
                    headers=self._headers(),
                )
                resp.raise_for_status()
                return resp.json().get("clips", [])
        except httpx.HTTPStatusError as e:
            raise RuntimeError(
                f"Render server slice_audio returned {e.response.status_code}: {e.response.text}"
            )
        except Exception as e:
            raise RuntimeError(f"Failed to call slice_audio: {e}")

    def splice_audio(
        self,
        base_audio_url: str,
        new_clip_url: str,
        replace_start: float,
        replace_end: float,
        output_key: str,
        bucket: Optional[str] = None,
        crossfade_ms: int = 150,
    ) -> Dict[str, Any]:
        """Replace `[replace_start, replace_end)` of `base_audio_url` with
        `new_clip_url`, crossfading both joins. Uploads to `output_key`.

        Returns `{output_url, new_duration, duration_delta}`. The delta is
        what callers ripple downstream timestamps by.

        Raises RuntimeError on transport / worker failure.
        """
        payload: dict = {
            "base_audio_url": base_audio_url,
            "replacement": {
                "new_clip_url": new_clip_url,
                "replace_start": replace_start,
                "replace_end": replace_end,
                "crossfade_ms": crossfade_ms,
            },
            "output_key": output_key,
        }
        if bucket is not None:
            payload["bucket"] = bucket
        try:
            with httpx.Client(timeout=self._AUDIO_OP_TIMEOUT) as client:
                resp = client.post(
                    f"{self.base_url}/audio/splice",
                    json=payload,
                    headers=self._headers(),
                )
                resp.raise_for_status()
                return resp.json()
        except httpx.HTTPStatusError as e:
            raise RuntimeError(
                f"Render server splice_audio returned {e.response.status_code}: {e.response.text}"
            )
        except Exception as e:
            raise RuntimeError(f"Failed to call splice_audio: {e}")
