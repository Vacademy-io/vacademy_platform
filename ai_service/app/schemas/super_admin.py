"""
Super Admin schemas for platform-wide credit and AI usage views.
"""

from typing import List, Optional
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class InstituteCreditItem(BaseModel):
    institute_id: str
    total_credits: Decimal
    used_credits: Decimal
    current_balance: Decimal
    is_low_balance: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class AllInstitutesCreditsResponse(BaseModel):
    items: List[InstituteCreditItem]
    page: int
    page_size: int
    total: int
    total_pages: int


class UsageByTypeItem(BaseModel):
    request_type: str
    total_tokens: int
    total_cost: Decimal
    request_count: int


class UsageByDayItem(BaseModel):
    date: str
    total_tokens: int
    total_cost: Decimal
    request_count: int


class TopInstituteUsage(BaseModel):
    institute_id: str
    total_tokens: int
    total_cost: Decimal
    request_count: int


class PlatformUsageSummary(BaseModel):
    total_tokens: int
    total_cost: Decimal
    total_requests: int
    usage_by_type: List[UsageByTypeItem]
    usage_by_day: List[UsageByDayItem]
    top_institutes: List[TopInstituteUsage]
