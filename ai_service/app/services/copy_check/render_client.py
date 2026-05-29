"""HTTP client for render_worker's /pdf-ocr-jobs endpoint.

Mirrors the structure of services/render_service.py::RenderService — same
X-Render-Key auth, same submit + poll pattern. Kept separate so we don't
mix video render concerns with PDF OCR concerns.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Callable, Optional

import httpx

logger = logging.getLogger(__name__)


class OcrCancelled(Exception):
    """Raised by submit_and_wait when the caller's cancellation_check fires."""


class CopyCheckRenderClient:
    def __init__(self, base_url: str, render_key: str = ""):
        self.base_url = base_url.rstrip("/")
        self.render_key = render_key

    @property
    def is_configured(self) -> bool:
        return bool(self.base_url)

    def _headers(self) -> dict[str, str]:
        h = {"Content-Type": "application/json"}
        if self.render_key:
            h["X-Render-Key"] = self.render_key
        return h

    async def submit(self, pdf_url: str, callback_url: Optional[str] = None, dpi: int = 200) -> str:
        payload: dict[str, Any] = {"pdf_url": pdf_url, "dpi": dpi}
        if callback_url:
            payload["callback_url"] = callback_url
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{self.base_url}/pdf-ocr-jobs",
                json=payload,
                headers=self._headers(),
            )
            resp.raise_for_status()
            return resp.json()["job_id"]

    async def get_status(self, job_id: str) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{self.base_url}/pdf-ocr-jobs/{job_id}",
                headers=self._headers(),
            )
            resp.raise_for_status()
            return resp.json()

    async def submit_and_wait(
        self,
        pdf_url: str,
        dpi: int = 200,
        poll_interval: float = 3.0,
        timeout: float = 300.0,
        cancellation_check: Optional[Callable[[], bool]] = None,
    ) -> dict[str, Any]:
        """Submit a job and poll until completion. Returns the layout_map.

        `cancellation_check`: optional callable consulted every poll iteration.
        When it returns True, raise OcrCancelled — the orchestrator catches
        this so a stop request mid-OCR aborts in ≤poll_interval seconds
        instead of waiting for the full OCR job to complete (#19).
        """
        job_id = await self.submit(pdf_url, dpi=dpi)
        deadline = asyncio.get_event_loop().time() + timeout
        while True:
            if cancellation_check is not None and cancellation_check():
                raise OcrCancelled(f"render_worker job {job_id} cancelled by caller")
            status = await self.get_status(job_id)
            if status["status"] == "completed":
                if not status.get("layout_map"):
                    raise RuntimeError(f"render_worker job {job_id} completed with no layout_map")
                return status["layout_map"]
            if status["status"] == "failed":
                raise RuntimeError(f"render_worker job {job_id} failed: {status.get('error')}")
            if asyncio.get_event_loop().time() > deadline:
                raise TimeoutError(f"render_worker job {job_id} did not complete within {timeout}s")
            await asyncio.sleep(poll_interval)
