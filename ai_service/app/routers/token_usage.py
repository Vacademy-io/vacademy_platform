"""
Router for token usage viewing endpoints.
"""
from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from ..db import db_dependency
from ..services.token_usage_service import TokenUsageService
from ..schemas.token_usage import (
    TokenUsageListResponse,
    TokenUsageRecord,
    TokenUsageSummaryResponse,
    TokenUsageSummary,
    DailyUsageResponse,
    DailyUsageRecord,
    ActivityLogResponse,
    UserActivityLogResponse,
    UserActivitySummary,
)
from ..models.ai_token_usage import RequestType


router = APIRouter(prefix="/token-usage", tags=["token-usage"])


@router.get(
    "/v1/institute/{institute_id}",
    response_model=TokenUsageListResponse,
    summary="Get token usage records for an institute",
)
async def get_institute_token_usage(
    institute_id: str,
    start_date: Optional[str] = Query(default=None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(default=None, description="End date (YYYY-MM-DD)"),
    db: Session = Depends(db_dependency),
) -> TokenUsageListResponse:
    """
    Get all token usage records for an institute.
    
    Can be filtered by date range.
    """
    start_dt = None
    end_dt = None
    
    if start_date:
        try:
            # Parse YYYY-MM-DD format and set to start of day
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD")
    
    if end_date:
        try:
            # Parse YYYY-MM-DD format and set to end of day
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
            # Set to end of day (23:59:59)
            end_dt = end_dt.replace(hour=23, minute=59, second=59)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD")
    
    service = TokenUsageService(db)
    records = service.get_institute_usage(institute_id, start_dt, end_dt)
    
    return TokenUsageListResponse(
        records=[TokenUsageRecord(**record.to_dict()) for record in records],
        total=len(records),
    )


@router.get(
    "/v1/user/{user_id}",
    response_model=TokenUsageListResponse,
    summary="Get token usage records for a user",
)
async def get_user_token_usage(
    user_id: str,
    start_date: Optional[str] = Query(default=None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(default=None, description="End date (YYYY-MM-DD)"),
    db: Session = Depends(db_dependency),
) -> TokenUsageListResponse:
    """
    Get all token usage records for a user.
    
    Can be filtered by date range.
    """
    start_dt = None
    end_dt = None
    
    if start_date:
        try:
            # Parse YYYY-MM-DD format and set to start of day
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD")
    
    if end_date:
        try:
            # Parse YYYY-MM-DD format and set to end of day
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
            # Set to end of day (23:59:59)
            end_dt = end_dt.replace(hour=23, minute=59, second=59)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD")
    
    service = TokenUsageService(db)
    records = service.get_user_usage(user_id, start_dt, end_dt)
    
    return TokenUsageListResponse(
        records=[TokenUsageRecord(**record.to_dict()) for record in records],
        total=len(records),
    )


@router.get(
    "/v1/institute/{institute_id}/summary",
    response_model=TokenUsageSummaryResponse,
    summary="Get aggregated token usage summary for an institute",
)
async def get_institute_token_summary(
    institute_id: str,
    start_date: Optional[str] = Query(default=None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(default=None, description="End date (YYYY-MM-DD)"),
    group_by_provider: bool = Query(default=True, description="Group results by API provider"),
    group_by_type: bool = Query(default=True, description="Group results by request type"),
    db: Session = Depends(db_dependency),
) -> TokenUsageSummaryResponse:
    """
    Get aggregated token usage summary for an institute.
    
    Includes totals and optional grouping by provider and request type.
    """
    start_dt = None
    end_dt = None
    
    if start_date:
        try:
            # Parse YYYY-MM-DD format and set to start of day
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD")
    
    if end_date:
        try:
            # Parse YYYY-MM-DD format and set to end of day
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
            # Set to end of day (23:59:59)
            end_dt = end_dt.replace(hour=23, minute=59, second=59)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD")
    
    service = TokenUsageService(db)
    summary = service.get_usage_summary(
        institute_id=institute_id,
        start_date=start_dt,
        end_date=end_dt,
        group_by_provider=group_by_provider,
        group_by_type=group_by_type,
    )
    
    return TokenUsageSummaryResponse(
        summary=TokenUsageSummary(**summary),
        start_date=start_date,
        end_date=end_date,
    )


@router.get(
    "/v1/user/{user_id}/summary",
    response_model=TokenUsageSummaryResponse,
    summary="Get aggregated token usage summary for a user",
)
async def get_user_token_summary(
    user_id: str,
    start_date: Optional[str] = Query(default=None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(default=None, description="End date (YYYY-MM-DD)"),
    group_by_provider: bool = Query(default=True, description="Group results by API provider"),
    group_by_type: bool = Query(default=True, description="Group results by request type"),
    db: Session = Depends(db_dependency),
) -> TokenUsageSummaryResponse:
    """
    Get aggregated token usage summary for a user.
    
    Includes totals and optional grouping by provider and request type.
    """
    start_dt = None
    end_dt = None
    
    if start_date:
        try:
            # Parse YYYY-MM-DD format and set to start of day
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD")
    
    if end_date:
        try:
            # Parse YYYY-MM-DD format and set to end of day
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
            # Set to end of day (23:59:59)
            end_dt = end_dt.replace(hour=23, minute=59, second=59)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD")
    
    service = TokenUsageService(db)
    summary = service.get_usage_summary(
        user_id=user_id,
        start_date=start_dt,
        end_date=end_dt,
        group_by_provider=group_by_provider,
        group_by_type=group_by_type,
    )
    
    return TokenUsageSummaryResponse(
        summary=TokenUsageSummary(**summary),
        start_date=start_date,
        end_date=end_date,
    )


@router.get(
    "/v1/institute/{institute_id}/daily",
    response_model=DailyUsageResponse,
    summary="Get daily token usage for an institute",
)
async def get_institute_daily_usage(
    institute_id: str,
    days: int = Query(default=30, ge=1, le=365, description="Number of days to look back"),
    db: Session = Depends(db_dependency),
) -> DailyUsageResponse:
    """
    Get daily token usage breakdown for an institute.
    
    Returns usage aggregated by day for the last N days.
    """
    service = TokenUsageService(db)
    daily_usage = service.get_daily_usage(institute_id=institute_id, days=days)
    
    return DailyUsageResponse(
        daily_usage=[DailyUsageRecord(**record) for record in daily_usage],
        days=days,
    )


@router.get(
    "/v1/user/{user_id}/daily",
    response_model=DailyUsageResponse,
    summary="Get daily token usage for a user",
)
async def get_user_daily_usage(
    user_id: str,
    days: int = Query(default=30, ge=1, le=365, description="Number of days to look back"),
    db: Session = Depends(db_dependency),
) -> DailyUsageResponse:
    """
    Get daily token usage breakdown for a user.
    
    Returns usage aggregated by day for the last N days.
    """
    service = TokenUsageService(db)
    daily_usage = service.get_daily_usage(user_id=user_id, days=days)
    
    return DailyUsageResponse(
        daily_usage=[DailyUsageRecord(**record) for record in daily_usage],
        days=days,
    )


@router.get(
    "/v1/institute/{institute_id}/activity-log",
    response_model=ActivityLogResponse,
    summary="Get paginated activity log for an institute",
)
async def get_institute_activity_log(
    institute_id: str,
    page: int = Query(default=1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(default=20, ge=1, le=100, description="Number of records per page"),
    start_date: Optional[str] = Query(default=None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(default=None, description="End date (YYYY-MM-DD)"),
    request_type: Optional[str] = Query(default=None, description="Filter by request type (outline, image, content, video)"),
    db: Session = Depends(db_dependency),
) -> ActivityLogResponse:
    """
    Get paginated activity log for an institute showing all operations with token usage and pricing.
    
    Returns:
        Paginated list of activity records with token usage and pricing information
    """
    start_dt = None
    end_dt = None
    
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD")
    
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
            end_dt = end_dt.replace(hour=23, minute=59, second=59)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD")
    
    request_type_enum = None
    if request_type:
        try:
            request_type_enum = RequestType(request_type.lower())
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid request_type. Must be one of: {', '.join([rt.value for rt in RequestType])}"
            )
    
    service = TokenUsageService(db)
    records, total_count = service.get_institute_activity_log(
        institute_id=institute_id,
        page=page,
        page_size=page_size,
        start_date=start_dt,
        end_date=end_dt,
        request_type=request_type_enum,
    )
    
    total_pages = (total_count + page_size - 1) // page_size if total_count > 0 else 0
    
    return ActivityLogResponse(
        records=[TokenUsageRecord(**record.to_dict()) for record in records],
        page=page,
        page_size=page_size,
        total_count=total_count,
        total_pages=total_pages,
    )


@router.get(
    "/v1/institute/{institute_id}/activity-log/by-user",
    response_model=UserActivityLogResponse,
    summary="Get paginated activity log for an institute grouped by user",
)
async def get_institute_activity_log_by_user(
    institute_id: str,
    page: int = Query(default=1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(default=20, ge=1, le=100, description="Number of records per page"),
    start_date: Optional[str] = Query(default=None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(default=None, description="End date (YYYY-MM-DD)"),
    request_type: Optional[str] = Query(default=None, description="Filter by request type (outline, image, content, video)"),
    db: Session = Depends(db_dependency),
) -> UserActivityLogResponse:
    """
    Get paginated activity log for an institute grouped by user ID.
    
    Shows aggregated statistics per user:
    - Total operations count
    - Total tokens used (input, output, total)
    - Total price spent
    - Last activity timestamp
    
    This is useful for frontend dashboards showing user-wise usage within an institute.
    
    Returns:
        Paginated list of user activity summaries with aggregated stats
    """
    start_dt = None
    end_dt = None
    
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD")
    
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
            end_dt = end_dt.replace(hour=23, minute=59, second=59)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD")
    
    request_type_enum = None
    if request_type:
        try:
            request_type_enum = RequestType(request_type.lower())
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid request_type. Must be one of: {', '.join([rt.value for rt in RequestType])}"
            )
    
    service = TokenUsageService(db)
    user_activities, total_count = service.get_institute_activity_log_by_user(
        institute_id=institute_id,
        page=page,
        page_size=page_size,
        start_date=start_dt,
        end_date=end_dt,
        request_type=request_type_enum,
    )
    
    total_pages = (total_count + page_size - 1) // page_size if total_count > 0 else 0
    
    return UserActivityLogResponse(
        user_activities=[UserActivitySummary(**activity) for activity in user_activities],
        page=page,
        page_size=page_size,
        total_count=total_count,
        total_pages=total_pages,
    )


__all__ = ["router"]


