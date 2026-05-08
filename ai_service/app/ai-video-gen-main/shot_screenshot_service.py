"""HTTP client for the render worker's POST /screenshot endpoint.

Used from the per-shot vision-review path in automation_pipeline._shot_task.
Synchronous (httpx.Client) because _shot_task itself is sync — the pipeline
runs N shots in parallel via a thread pool, and an async client would force
a layer of asyncio-bridging on every call.
"""
from __future__ import annotations

import base64
import logging
import os
from dataclasses import dataclass
from typing import List, Optional

import httpx

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ScreenshotFrame:
    t: float
    image_bytes: bytes  # decoded PNG bytes — direct input to a multimodal LLM


class ScreenshotClientError(RuntimeError):
    """Raised on any failure to obtain screenshots — caller should treat as
    a soft failure and skip vision review for that shot (ship the original)."""


class ShotScreenshotClient:
    """Single-shot screenshot client against the render worker's /screenshot.

    Construction reads RENDER_SERVER_URL / RENDER_SERVER_KEY from env to match
    the existing render_service.RenderService configuration surface. If the URL
    is unset, `is_configured` is False and the vision-review path will skip
    cleanly.
    """

    def __init__(
        self,
        *,
        base_url: Optional[str] = None,
        render_key: Optional[str] = None,
        timeout_s: float = 30.0,
    ):
        self.base_url = (base_url or os.getenv("RENDER_SERVER_URL", "")).rstrip("/")
        self.render_key = render_key if render_key is not None else os.getenv("RENDER_SERVER_KEY", "")
        self._timeout = timeout_s

    @property
    def is_configured(self) -> bool:
        return bool(self.base_url)

    def _headers(self) -> dict:
        h = {"Content-Type": "application/json"}
        if self.render_key:
            h["X-Render-Key"] = self.render_key
        return h

    def take_shot_screenshots(
        self,
        *,
        html: str,
        width: int,
        height: int,
        timestamps: List[float],
        background: str = "#0a0e27",
    ) -> List[ScreenshotFrame]:
        """Call /screenshot on the render worker and return decoded PNGs.

        Returns frames in the order requested. Raises ScreenshotClientError on
        any transport / 4xx / 5xx / decode failure — the caller is expected
        to log + ship the shot without vision review on error.
        """
        if not self.is_configured:
            raise ScreenshotClientError("RENDER_SERVER_URL not configured")
        if not html or not html.strip():
            raise ScreenshotClientError("html is required")
        if not timestamps:
            raise ScreenshotClientError("at least one timestamp required")

        payload = {
            "html": html,
            "width": int(width),
            "height": int(height),
            "timestamps": [float(t) for t in timestamps],
            "background": background,
        }

        try:
            with httpx.Client(timeout=self._timeout) as client:
                resp = client.post(
                    f"{self.base_url}/screenshot",
                    json=payload,
                    headers=self._headers(),
                )
                resp.raise_for_status()
                data = resp.json()
        except httpx.HTTPStatusError as exc:
            raise ScreenshotClientError(
                f"render worker /screenshot returned {exc.response.status_code}: "
                f"{exc.response.text[:300]}"
            ) from exc
        except httpx.HTTPError as exc:
            raise ScreenshotClientError(f"render worker /screenshot transport error: {exc}") from exc
        except Exception as exc:
            raise ScreenshotClientError(f"render worker /screenshot unexpected error: {exc}") from exc

        screenshots = data.get("screenshots") or []
        if not screenshots:
            raise ScreenshotClientError("render worker returned empty screenshots[]")

        frames: List[ScreenshotFrame] = []
        for entry in screenshots:
            try:
                t = float(entry["t"])
                img = base64.b64decode(entry["image_b64"])
            except (KeyError, ValueError, TypeError) as exc:
                raise ScreenshotClientError(f"malformed screenshot entry: {exc}") from exc
            # Sanity-check the PNG header so we fail fast on garbled responses
            # rather than wasting a vision-LLM call on undecodable bytes.
            if not img.startswith(b"\x89PNG\r\n\x1a\n"):
                raise ScreenshotClientError("response did not contain valid PNG bytes")
            frames.append(ScreenshotFrame(t=t, image_bytes=img))

        return frames
