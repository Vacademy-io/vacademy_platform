"""
Schemas for token usage endpoints.
"""
from __future__ import annotations

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


class TokenUsageRecord(BaseModel):
    """Single token usage record."""
    id: str
    institute_id: Optional[str] = None
    user_id: Optional[str] = None
    api_provider: str
    model: Optional[str] = None
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    input_token_price: Optional[float] = None
    output_token_price: Optional[float] = None
    total_price: Optional[float] = None
    request_type: str
    request_id: Optional[str] = None
    request_metadata: Optional[str] = None
    created_at: str


class TokenUsageSummary(BaseModel):
    """Aggregated token usage summary."""
    total_prompt_tokens: int
    total_completion_tokens: int
    total_tokens: int
    request_count: int
    by_provider: Optional[Dict[str, Dict[str, int]]] = None
    by_type: Optional[Dict[str, Dict[str, int]]] = None


class DailyUsageRecord(BaseModel):
    """Daily usage record."""
    date: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    request_count: int


class TokenUsageListResponse(BaseModel):
    """Response for list of token usage records."""
    records: List[TokenUsageRecord]
    total: int


class TokenUsageSummaryResponse(BaseModel):
    """Response for token usage summary."""
    summary: TokenUsageSummary
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class DailyUsageResponse(BaseModel):
    """Response for daily usage."""
    daily_usage: List[DailyUsageRecord]
    days: int


class ValidationResponse(BaseModel):
    """Response for entity validation."""
    entity_type: str
    entity_id: str
    exists: bool


class ActivityLogResponse(BaseModel):
    """Paginated response for activity log."""
    records: List[TokenUsageRecord]
    page: int
    page_size: int
    total_count: int
    total_pages: int


class UserActivitySummary(BaseModel):
    """User activity summary within an institute."""
    user_id: Optional[str] = None
    operation_count: int
    total_prompt_tokens: int
    total_completion_tokens: int
    total_tokens: int
    total_price: Optional[float] = None
    last_activity: Optional[str] = None


class UserActivityLogResponse(BaseModel):
    """Paginated response for activity log grouped by user."""
    user_activities: List[UserActivitySummary]
    page: int
    page_size: int
    total_count: int
    total_pages: int


__all__ = [
    "TokenUsageRecord",
    "TokenUsageSummary",
    "DailyUsageRecord",
    "TokenUsageListResponse",
    "TokenUsageSummaryResponse",
    "DailyUsageResponse",
    "ValidationResponse",
    "ActivityLogResponse",
]




