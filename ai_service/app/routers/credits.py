"""
Credit Router - API endpoints for credit management.

Endpoints for managing institute credits:
- Balance management (view, grant)
- Pre-flight credit checks
- Credit deduction
- Transaction history
- Usage analytics
- Alert management
- Pricing configuration
"""

import logging
from typing import Optional, List
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..db import db_dependency
from ..core.security import get_current_user
from ..services.credit_service import CreditService
from ..schemas.credits import (
    CreditBalanceResponse,
    CreditGrantRequest,
    CreditGrantResponse,
    CreditCheckRequest,
    CreditCheckResponse,
    CreditDeductRequest,
    CreditDeductResponse,
    TransactionHistoryRequest,
    TransactionHistoryResponse,
    UsageAnalyticsResponse,
    UsageForecastResponse,
    AllPricingResponse,
    AlertsListResponse,
    AcknowledgeAlertRequest,
)


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/credits/v1", tags=["Credits"])


# ============================================================================
# Helper Functions
# ============================================================================

def get_credit_service(db: Session = Depends(db_dependency)) -> CreditService:
    """Dependency to get credit service instance."""
    return CreditService(db)


def check_root_admin(user: Optional[dict]) -> bool:
    """Check if user is a ROOT_ADMIN."""
    if not user:
        return False
    roles = user.get("roles", [])
    # Check both comma separated string and list formats
    if isinstance(roles, str):
        roles = [r.strip() for r in roles.split(",")]
    return "ROOT_ADMIN" in roles


# ============================================================================
# Balance Endpoints
# ============================================================================

@router.get(
    "/institutes/{institute_id}/balance",
    response_model=CreditBalanceResponse,
    summary="Get institute credit balance",
    description="Get the current credit balance for an institute.",
)
def get_balance(
    institute_id: str,
    service: CreditService = Depends(get_credit_service),
    current_user: Optional[dict] = Depends(get_current_user),
):
    """Get current credit balance for an institute."""
    balance = service.get_balance(institute_id)
    
    if not balance:
        # Create initial credits for this institute
        balance = service.create_initial_credits(institute_id)
    
    return balance


@router.post(
    "/institutes/{institute_id}/grant",
    response_model=CreditGrantResponse,
    summary="Grant credits to institute (ROOT_ADMIN only)",
    description="Grant credits to an institute. Only ROOT_ADMIN can perform this action.",
)
def grant_credits(
    institute_id: str,
    request: CreditGrantRequest,
    service: CreditService = Depends(get_credit_service),
    current_user: Optional[dict] = Depends(get_current_user),
):
    """Grant credits to an institute (admin action)."""
    if not check_root_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only ROOT_ADMIN can grant credits",
        )
    
    user_id = current_user.get("user_id", "system") if current_user else "system"
    return service.grant_credits(institute_id, request, granted_by=user_id)


# ============================================================================
# Credit Check Endpoint (Internal - for pre-flight checks)
# ============================================================================

@router.post(
    "/check",
    response_model=CreditCheckResponse,
    summary="Check if institute has sufficient credits",
    description="Pre-flight credit check before AI operations.",
)
def check_credits(
    request: CreditCheckRequest,
    service: CreditService = Depends(get_credit_service),
):
    """
    Check if an institute has sufficient credits for an operation.
    
    This is called before making AI API calls to prevent work on 
    requests that will fail due to insufficient credits.
    """
    return service.check_credits(request)


@router.post(
    "/deduct",
    response_model=CreditDeductResponse,
    summary="Deduct credits after AI operation",
    description="Deduct credits after an AI operation completes.",
)
def deduct_credits(
    request: CreditDeductRequest,
    service: CreditService = Depends(get_credit_service),
):
    """
    Deduct credits after an AI operation.
    
    This is called after the AI operation completes with actual token counts.
    """
    return service.deduct_credits(request)


# ============================================================================
# Transaction History
# ============================================================================

@router.get(
    "/institutes/{institute_id}/transactions",
    response_model=TransactionHistoryResponse,
    summary="Get credit transaction history",
)
def get_transactions(
    institute_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    transaction_types: Optional[List[str]] = Query(None),
    service: CreditService = Depends(get_credit_service),
    current_user: Optional[dict] = Depends(get_current_user),
):
    """Get paginated transaction history for an institute."""
    request = TransactionHistoryRequest(
        page=page,
        page_size=page_size,
        transaction_types=transaction_types,
    )
    return service.get_transaction_history(institute_id, request)


# ============================================================================
# Usage Analytics
# ============================================================================

@router.get(
    "/institutes/{institute_id}/usage",
    response_model=UsageAnalyticsResponse,
    summary="Get usage analytics",
)
def get_usage_analytics(
    institute_id: str,
    days: int = Query(30, ge=1, le=365),
    service: CreditService = Depends(get_credit_service),
    current_user: Optional[dict] = Depends(get_current_user),
):
    """Get usage analytics for an institute."""
    return service.get_usage_analytics(institute_id, days)


@router.get(
    "/institutes/{institute_id}/forecast",
    response_model=UsageForecastResponse,
    summary="Get usage forecast",
)
def get_usage_forecast(
    institute_id: str,
    service: CreditService = Depends(get_credit_service),
    current_user: Optional[dict] = Depends(get_current_user),
):
    """Get usage forecast for an institute."""
    return service.get_usage_forecast(institute_id)


# ============================================================================
# Pricing Configuration
# ============================================================================

@router.get(
    "/pricing",
    response_model=AllPricingResponse,
    summary="Get all pricing configurations",
)
def get_pricing(
    service: CreditService = Depends(get_credit_service),
):
    """Get all pricing configurations."""
    return service.get_all_pricing()


# ============================================================================
# Alert Management
# ============================================================================

@router.get(
    "/alerts",
    response_model=AlertsListResponse,
    summary="Get pending credit alerts (ROOT_ADMIN only)",
)
def get_alerts(
    limit: int = Query(100, ge=1, le=500),
    service: CreditService = Depends(get_credit_service),
    current_user: Optional[dict] = Depends(get_current_user),
):
    """Get pending credit alerts (ROOT_ADMIN only)."""
    if not check_root_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only ROOT_ADMIN can view alerts",
        )
    
    return service.get_pending_alerts(limit)


@router.post(
    "/alerts/{alert_id}/acknowledge",
    summary="Acknowledge a credit alert (ROOT_ADMIN only)",
)
def acknowledge_alert(
    alert_id: str,
    request: AcknowledgeAlertRequest,
    service: CreditService = Depends(get_credit_service),
    current_user: Optional[dict] = Depends(get_current_user),
):
    """Acknowledge a credit alert."""
    if not check_root_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only ROOT_ADMIN can acknowledge alerts",
        )
    
    success = service.acknowledge_alert(alert_id, request.acknowledged_by)
    return {"success": success, "message": "Alert acknowledged"}


# ============================================================================
# Institute Initialization
# ============================================================================

@router.post(
    "/institutes/{institute_id}/initialize",
    response_model=CreditBalanceResponse,
    summary="Initialize credits for new institute",
)
def initialize_credits(
    institute_id: str,
    service: CreditService = Depends(get_credit_service),
):
    """
    Initialize credits for a new institute.
    Called when an institute is created to give them initial credits (200).
    """
    balance = service.get_balance(institute_id)
    if balance:
        return balance
    
    return service.create_initial_credits(institute_id)
