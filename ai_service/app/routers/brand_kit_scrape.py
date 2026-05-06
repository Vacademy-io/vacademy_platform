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

from fastapi import APIRouter, Depends, Query

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
    instituteId: str = Query(..., description="Institute ID — used for S3 path scoping."),
    user: CustomUserDetails = Depends(get_current_user),  # auth side-effect — verifies JWT
):
    # `instituteId` matches the existing VimotionBrandKitController query param
    # name on admin-core-service. The institute is supplied explicitly because
    # authenticatedAxiosInstance does not propagate the `clientId` header that
    # get_current_user would otherwise use to set user.institute_id.
    logger.info(f"[BrandKitScrape] user={user.username!r} institute={instituteId!r}")
    service = BrandKitScrapeService()
    return await service.scrape_brand_kit(str(request.url), instituteId)
