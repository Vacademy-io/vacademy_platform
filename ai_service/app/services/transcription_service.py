"""
HTTP client for the transcription endpoint on the render worker server.

Mirrors the pattern from render_service.py / index_service.py — submits
transcribe jobs and polls for completion. Reuses the same RENDER_SERVER_URL
and RENDER_KEY since the transcriber runs on the same server.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

import httpx

logger = logging.getLogger(__name__)


class TranscriptionService:
    """Client for the /transcribe-jobs endpoints on the render worker."""

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
        source_url: str,
        language: Optional[str] = None,
        model_size: str = "base",
        word_timestamps: bool = True,
        output_formats: Optional[list[str]] = None,
        callback_url: Optional[str] = None,
        task: str = "transcribe",
    ) -> str:
        """Submit a transcription job to the render worker. Returns job_id.

        task: 'transcribe' (source language), 'translate' (English), or 'both'.

        Raises:
            RuntimeError: if submission fails or server is at capacity.
        """
        payload: dict = {
            "source_url": source_url,
            "model_size": model_size,
            "word_timestamps": word_timestamps,
            "task": task,
        }
        if language is not None:
            payload["language"] = language
        if output_formats is not None:
            payload["output_formats"] = output_formats
        if callback_url is not None:
            payload["callback_url"] = callback_url

        try:
            with httpx.Client(timeout=self._timeout) as client:
                resp = client.post(
                    f"{self.base_url}/transcribe-jobs",
                    json=payload,
                    headers=self._headers(),
                )
                if resp.status_code == 429:
                    raise RuntimeError("Transcription server at capacity (429)")
                resp.raise_for_status()
                data = resp.json()
                job_id = data.get("job_id")
                if not job_id:
                    raise RuntimeError(f"No job_id in response: {data}")
                logger.info(f"Transcription job submitted: {job_id}")
                return job_id
        except httpx.HTTPStatusError as e:
            raise RuntimeError(
                f"Transcription server returned {e.response.status_code}: {e.response.text}"
            ) from e
        except httpx.HTTPError as e:
            raise RuntimeError(f"Transcription job submission failed: {e}") from e

    def check_status(self, job_id: str) -> Dict[str, Any]:
        """Poll the status of a transcription job.

        Returns a dict with: status, progress, output_urls, duration_seconds,
        detected_language, language_probability, segment_count, word_count, error.
        """
        try:
            with httpx.Client(timeout=self._timeout) as client:
                resp = client.get(
                    f"{self.base_url}/transcribe-jobs/{job_id}",
                    headers=self._headers(),
                )
                resp.raise_for_status()
                return resp.json()
        except Exception as e:
            logger.warning(f"Transcription status check failed for {job_id}: {e}")
            return {"status": "unknown", "error": str(e)}
