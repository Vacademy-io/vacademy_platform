"""
Credit Schemas for request/response validation.

These Pydantic models define the API contracts for the credit system.
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Optional, List, Dict, Any
from uuid import UUID

from pydantic import BaseModel, Field


class TransactionType(str, Enum):
    """Types of credit transactions."""
    INITIAL_GRANT = "INITIAL_GRANT"
    ADMIN_GRANT = "ADMIN_GRANT"
    USAGE_DEDUCTION = "USAGE_DEDUCTION"
    REFUND = "REFUND"
    MONTHLY_ALLOCATION = "MONTHLY_ALLOCATION"
    PURCHASE = "PURCHASE"
    PROMOTIONAL = "PROMOTIONAL"


class AlertType(str, Enum):
    """Types of credit alerts."""
    LOW_BALANCE = "LOW_BALANCE"
    ZERO_BALANCE = "ZERO_BALANCE"
    NEGATIVE_BALANCE = "NEGATIVE_BALANCE"


class ModelTier(str, Enum):
    """Model tier for pricing multipliers."""
    STANDARD = "standard"
    PREMIUM = "premium"
    ULTRA = "ultra"


# ============================================================================
# Credit Balance Schemas
# ============================================================================

class CreditBalanceResponse(BaseModel):
    """Response for getting institute credit balance."""
    institute_id: str
    total_credits: Decimal
    used_credits: Decimal
    current_balance: Decimal
    low_balance_threshold: Decimal
    is_low_balance: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CreditGrantRequest(BaseModel):
    """Request to grant credits to an institute."""
    amount: Decimal = Field(..., gt=0, description="Amount of credits to grant (must be positive)")
    description: Optional[str] = Field(None, description="Reason for granting credits")


class CreditGrantResponse(BaseModel):
    """Response after granting credits."""
    success: bool
    institute_id: str
    amount_granted: Decimal
    new_balance: Decimal
    transaction_id: str
    message: str


# ============================================================================
# Credit Check Schemas (Pre-flight)
# ============================================================================

class CreditCheckRequest(BaseModel):
    """Request to check if institute has sufficient credits."""
    institute_id: str
    request_type: str  # content, image, embedding, etc.
    model: Optional[str] = None  # Model name for tier multiplier
    estimated_tokens: Optional[int] = 0  # Estimated prompt + completion tokens
    character_count: Optional[int] = 0  # For TTS


class CreditCheckResponse(BaseModel):
    """Response for credit check."""
    has_sufficient_credits: bool
    current_balance: Decimal
    estimated_cost: Decimal
    balance_after: Decimal
    message: str


# ============================================================================
# Credit Deduction Schemas
# ============================================================================

class CreditDeductRequest(BaseModel):
    """Request to deduct credits after AI operation."""
    institute_id: str
    request_type: str
    model: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    character_count: int = 0  # For TTS
    usage_log_id: Optional[str] = None  # Link to ai_token_usage record


class CreditDeductResponse(BaseModel):
    """Response after credit deduction."""
    success: bool
    credits_deducted: Decimal
    new_balance: Decimal
    transaction_id: Optional[str] = None
    message: str


# ============================================================================
# Transaction Schemas
# ============================================================================

class CreditTransactionResponse(BaseModel):
    """A single credit transaction."""
    id: str
    institute_id: str
    transaction_type: str
    amount: Decimal
    balance_after: Decimal
    description: Optional[str]
    request_type: Optional[str]
    model_name: Optional[str]
    granted_by: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class TransactionHistoryRequest(BaseModel):
    """Request for transaction history."""
    page: int = Field(1, ge=1)
    page_size: int = Field(50, ge=1, le=200)
    transaction_types: Optional[List[str]] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class TransactionHistoryResponse(BaseModel):
    """Response with paginated transaction history."""
    transactions: List[CreditTransactionResponse]
    total_count: int
    page: int
    page_size: int
    total_pages: int


# ============================================================================
# Usage Analytics Schemas
# ============================================================================

class UsageBreakdownItem(BaseModel):
    """Usage breakdown for a single category."""
    request_type: str
    total_requests: int
    total_credits: Decimal
    percentage: Decimal


class UsageByDayItem(BaseModel):
    """Daily usage summary."""
    date: str
    total_requests: int
    total_credits: Decimal


class UsageAnalyticsResponse(BaseModel):
    """Comprehensive usage analytics."""
    institute_id: str
    period_start: datetime
    period_end: datetime
    total_requests: int
    total_credits_used: Decimal
    by_request_type: List[UsageBreakdownItem]
    by_day: List[UsageByDayItem]
    top_models: List[Dict[str, Any]]


class UsageForecastResponse(BaseModel):
    """Credit usage forecast."""
    institute_id: str
    current_balance: Decimal
    average_daily_usage: Decimal
    estimated_days_remaining: Optional[int]
    projected_zero_date: Optional[str]
    recommendation: str


# ============================================================================
# Pricing Schemas
# ============================================================================

class PricingConfigResponse(BaseModel):
    """Pricing configuration for a request type."""
    request_type: str
    base_cost: Decimal
    token_rate: Decimal
    minimum_charge: Decimal
    unit_type: str
    description: Optional[str]
    is_active: bool

    class Config:
        from_attributes = True


class PricingUpdateRequest(BaseModel):
    """Request to update pricing for a request type."""
    base_cost: Optional[Decimal] = None
    token_rate: Optional[Decimal] = None
    minimum_charge: Optional[Decimal] = None
    is_active: Optional[bool] = None


class ModelPricingResponse(BaseModel):
    """Model tier pricing configuration."""
    model_pattern: str
    tier: str
    multiplier: Decimal
    description: Optional[str]
    is_active: bool

    class Config:
        from_attributes = True


class AllPricingResponse(BaseModel):
    """All pricing configurations."""
    request_types: List[PricingConfigResponse]
    model_tiers: List[ModelPricingResponse]


# ============================================================================
# Alert Schemas
# ============================================================================

class CreditAlertResponse(BaseModel):
    """A credit alert."""
    id: str
    institute_id: str
    alert_type: str
    threshold_value: Optional[Decimal]
    current_balance: Optional[Decimal]
    acknowledged: bool
    acknowledged_by: Optional[str]
    acknowledged_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class AlertsListResponse(BaseModel):
    """List of pending alerts."""
    alerts: List[CreditAlertResponse]
    total_count: int


class AcknowledgeAlertRequest(BaseModel):
    """Request to acknowledge an alert."""
    acknowledged_by: str
