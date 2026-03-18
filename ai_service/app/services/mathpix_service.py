"""
Mathpix OCR service for extracting LaTeX and text from images.
"""
from __future__ import annotations

import logging
import os
from typing import Dict, Any

import httpx

logger = logging.getLogger(__name__)

MATHPIX_API_URL = "https://api.mathpix.com/v3/text"


class MathpixService:
    """
    Service for extracting LaTeX math and text from images using the Mathpix API.
    """

    def __init__(self):
        self.app_id = os.getenv("MATHPIX_APP_ID", "")
        self.app_key = os.getenv("MATHPIX_APP_KEY", "")

    def _headers(self) -> Dict[str, str]:
        return {
            "app_id": self.app_id,
            "app_key": self.app_key,
            "Content-Type": "application/json",
        }

    def _base_options(self) -> Dict[str, Any]:
        return {
            "formats": ["latex_styled", "text"],
            "math_inline_delimiters": ["$", "$"],
            "math_display_delimiters": ["$$", "$$"],
        }

    async def ocr_image(self, image_url: str) -> Dict[str, str]:
        """
        Extract LaTeX and text from an image given its URL.

        Args:
            image_url: Public URL of the image to process.

        Returns:
            Dict with 'latex' and 'text' keys. On failure, includes 'error'.
        """
        body = {"src": image_url, **self._base_options()}
        return await self._call_api(body)

    async def ocr_image_base64(
        self, base64_data: str, mime_type: str = "image/png"
    ) -> Dict[str, str]:
        """
        Extract LaTeX and text from a base64-encoded image.

        Args:
            base64_data: Base64-encoded image data (without the data URI prefix).
            mime_type: MIME type of the image (default: image/png).

        Returns:
            Dict with 'latex' and 'text' keys. On failure, includes 'error'.
        """
        src = f"data:{mime_type};base64,{base64_data}"
        body = {"src": src, **self._base_options()}
        return await self._call_api(body)

    async def _call_api(self, body: Dict[str, Any]) -> Dict[str, str]:
        """
        Internal helper that sends the request to Mathpix and parses the response.
        """
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    MATHPIX_API_URL,
                    headers=self._headers(),
                    json=body,
                )
                response.raise_for_status()
                data = response.json()

                return {
                    "latex": data.get("latex_styled", ""),
                    "text": data.get("text", ""),
                }
        except Exception as e:
            logger.error(f"Mathpix OCR request failed: {e}")
            return {"error": str(e), "latex": "", "text": ""}
