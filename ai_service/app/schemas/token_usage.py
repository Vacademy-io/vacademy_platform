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


__all__ = [
    "TokenUsageRecord",
    "TokenUsageSummary",
    "DailyUsageRecord",
    "TokenUsageListResponse",
    "TokenUsageSummaryResponse",
    "DailyUsageResponse",
]




