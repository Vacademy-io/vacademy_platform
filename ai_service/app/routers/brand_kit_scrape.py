"""
Admin-only endpoint that returns a draft Brand Kit synthesised from a public
website URL. Persistence stays on admin_core_service (POST /brand-kits) — this
service only produces the editable draft the UI prefills into the existing
BrandKitDrawer.

Final URL when mounted: POST {api_base_path}/admin/vimotion/v1/brand-kits/scrape
                        e.g. /ai-service/admin/vimotion/v1/brand-kits/scrape
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException

from ..core.security import get_current_user
from ..schemas.auth import CustomUserDetails
from ..schemas.brand_kit_scrape import BrandKitScrapeRequest, BrandKitScrapeResponse
from ..services.brand_kit_scrape_service import BrandKitScrapeService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/vimotion/v1/brand-kits", tags=["Vimotion Brand Kits"])


@router.post(
    "/scrape",
    response_model=BrandKitScrapeResponse,
    summary="Build a draft brand kit from a public website URL",
)
async def scrape_brand_kit(
    request: BrandKitScrapeRequest,
    user: CustomUserDetails = Depends(get_current_user),
):
    institute_id = user.institute_id
    if not institute_id:
        raise HTTPException(
            status_code=400,
            detail="Institute context required (clientId header).",
        )
    service = BrandKitScrapeService()
    return await service.scrape_brand_kit(str(request.url), institute_id)
