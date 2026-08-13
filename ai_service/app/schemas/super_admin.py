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
    # Resolved from institutes.name; null when the id has no institute row
    # (deleted tenant, or usage logged against a non-institute id).
    institute_name: Optional[str] = None
    total_tokens: int
    total_cost: Decimal
    request_count: int
    # Credits burnt by this institute in the same window (net of refunds).
    credits_used: Decimal = Decimal("0")


class PlatformUsageSummary(BaseModel):
    total_tokens: int
    total_cost: Decimal
    total_requests: int
    # Credits consumed platform-wide in the window, net of refunds.
    total_credits_used: Decimal = Decimal("0")
    # "hour" when the window is <= 48h, else "day" — tells the client how to
    # format `usage_by_day[].date` (ISO instant vs YYYY-MM-DD).
    bucket: str = "day"
    window_hours: int = 720
    usage_by_type: List[UsageByTypeItem]
    usage_by_day: List[UsageByDayItem]
    top_institutes: List[TopInstituteUsage]


# ============================================================================
# Live credit burn (last 1h / last 24h)
# ============================================================================


class CreditWindowTotals(BaseModel):
    hours: int
    since: datetime
    credits_used: Decimal
    request_count: int
    institute_count: int


class CreditWindowInstitute(BaseModel):
    institute_id: str
    institute_name: Optional[str] = None
    credits_1h: Decimal
    requests_1h: int
    credits_24h: Decimal
    requests_24h: int


class CreditWindowTypeItem(BaseModel):
    request_type: str
    credits_1h: Decimal
    requests_1h: int
    credits_24h: Decimal
    requests_24h: int


class CreditUsageLiveResponse(BaseModel):
    """
    Platform-wide credit burn over the last hour and the last day.

    Both windows come from one pass over credit_transactions, so the rows in
    `top_institutes` / `by_request_type` carry BOTH windows' numbers and are
    ranked by the 24h figure. Credits are net of refunds
    (USAGE_DEDUCTION minus REFUND); admin grants/deductions are excluded.
    """

    generated_at: datetime
    last_1h: CreditWindowTotals
    last_24h: CreditWindowTotals
    top_institutes: List[CreditWindowInstitute]
    by_request_type: List[CreditWindowTypeItem]
