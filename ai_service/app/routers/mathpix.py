"""
API router for Mathpix OCR endpoints.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..services.mathpix_service import MathpixService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mathpix", tags=["mathpix-ocr"])


class OcrImageRequest(BaseModel):
    image_url: str


class OcrBase64Request(BaseModel):
    base64_data: str
    mime_type: str = "image/png"


class OcrResponse(BaseModel):
    latex: str = ""
    text: str = ""
    error: Optional[str] = None


@router.post(
    "/ocr",
    response_model=OcrResponse,
    summary="Extract LaTeX from an image URL",
    description="Calls Mathpix API to extract LaTeX and text from a publicly accessible image URL.",
)
async def ocr_image(request: OcrImageRequest) -> OcrResponse:
    """
    Extract LaTeX math and text from an image URL using Mathpix OCR.
    """
    try:
        service = MathpixService()
        result = await service.ocr_image(request.image_url)
        return OcrResponse(**result)
    except Exception as e:
        logger.error(f"OCR image endpoint failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/ocr-base64",
    response_model=OcrResponse,
    summary="Extract LaTeX from a base64-encoded image",
    description="Calls Mathpix API to extract LaTeX and text from base64-encoded image data.",
)
async def ocr_image_base64(request: OcrBase64Request) -> OcrResponse:
    """
    Extract LaTeX math and text from a base64-encoded image using Mathpix OCR.
    """
    try:
        service = MathpixService()
        result = await service.ocr_image_base64(request.base64_data, request.mime_type)
        return OcrResponse(**result)
    except Exception as e:
        logger.error(f"OCR base64 endpoint failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
