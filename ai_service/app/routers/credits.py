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
from ..dependencies import require_internal_service_token
from ..services.credit_service import CreditService
from ..services.credit_rate_service import CreditRateService
from ..schemas.credits import (
    CreditBalanceResponse,
    CreditGrantRequest,
    CreditGrantResponse,
    CreditCheckRequest,
    CreditCheckResponse,
    CreditDeductRequest,
    CreditDeductResponse,
    CreditRateConfigResponse,
    CreditRateConfigUpdateRequest,
    InternalGrantFromPaymentRequest,
    InternalRefundFromPaymentRequest,
    InternalGrantOrRefundResponse,
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


def check_root_admin(user) -> bool:
    """Check if user is a root admin (super admin)."""
    if not user:
        return False
    # Primary check: is_root_user boolean flag (matches Java User.isRootUser)
    if hasattr(user, "is_root_user") and user.is_root_user:
        return True
    # Fallback: check roles list
    roles = getattr(user, "roles", []) if not isinstance(user, dict) else user.get("roles", [])
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
# Admin Credit Deduction Endpoint (ROOT_ADMIN only)
# ============================================================================

@router.post(
    "/institutes/{institute_id}/deduct-admin",
    response_model=CreditGrantResponse,
    summary="Deduct credits from institute (ROOT_ADMIN only)",
    description="Admin deduction of credits from an institute. Only ROOT_ADMIN can perform this action.",
)
def admin_deduct_credits(
    institute_id: str,
    request: CreditGrantRequest,
    service: CreditService = Depends(get_credit_service),
    current_user: Optional[dict] = Depends(get_current_user),
):
    """Deduct credits from an institute (admin action)."""
    if not check_root_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only ROOT_ADMIN can deduct credits",
        )

    user_id = current_user.get("user_id", "system") if current_user else "system"
    return service.admin_deduct_credits(institute_id, request, deducted_by=user_id)


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


# ============================================================================
# Cost Estimation
# ============================================================================

@router.get(
    "/estimate",
    summary="Estimate credit cost before an operation",
)
def estimate_cost(
    request_type: str = Query(..., description="Type: content, video, outline, image, tts, evaluation, etc."),
    model: Optional[str] = Query(default=None, description="Model ID (e.g. google/gemini-2.5-flash)"),
    estimated_tokens: int = Query(default=1000, description="Estimated total tokens (prompt + completion)"),
    character_count: int = Query(default=0, description="Character count (for TTS)"),
    institute_id: Optional[str] = Query(default=None, description="Institute ID (to include current balance)"),
    service: CreditService = Depends(get_credit_service),
):
    """
    Estimate the credit cost of an AI operation before executing it.
    Returns a cost breakdown so the frontend can show "This will cost ~X credits".
    """
    estimated_cost = service.calculate_credits(
        request_type=request_type,
        model=model,
        prompt_tokens=estimated_tokens,
        completion_tokens=0,
        character_count=character_count,
    )

    result = {
        "request_type": request_type,
        "model": model,
        "estimated_tokens": estimated_tokens,
        "estimated_cost": float(estimated_cost),
    }

    if institute_id:
        balance = service.get_balance(institute_id)
        if balance:
            result["current_balance"] = float(balance.current_balance)
            result["balance_after"] = float(balance.current_balance - estimated_cost)
            result["has_sufficient_credits"] = balance.current_balance >= estimated_cost

    return result


# ============================================================================
# Rate Config (V252 — DB-driven USD↔credits ratio + margin)
#
# Read endpoint is public so the FE can render rate footnotes / convert
# USD-denominated upper bounds (e.g. AI video cost cap) into credits.
# Write endpoint is gated to ROOT_ADMIN — changing the ratio reprices
# every future deduction across all institutes.
# ============================================================================


def get_rate_service(
    db: Session = Depends(db_dependency),
) -> CreditRateService:
    return CreditRateService(db)


def _rate_response(svc: CreditRateService) -> CreditRateConfigResponse:
    usd_to_credits, margin_pct = svc.get_current_rate()
    effective = svc.get_effective_ratio()
    return CreditRateConfigResponse(
        usd_to_credits=usd_to_credits,
        margin_pct=margin_pct,
        effective_ratio=effective,
    )


@router.get(
    "/rate-config",
    response_model=CreditRateConfigResponse,
    summary="Get current credit↔USD rate + margin",
    description=(
        "Returns the active row from `credit_rate_config`. The frontend uses "
        "this to convert USD upper-bounds (e.g. AI video cost cap) into the "
        "credit equivalent shown to users."
    ),
)
def get_rate_config(
    svc: CreditRateService = Depends(get_rate_service),
):
    return _rate_response(svc)


@router.post(
    "/admin/rate-config",
    response_model=CreditRateConfigResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Append a new credit↔USD rate (ROOT_ADMIN)",
    description=(
        "Inserts a new rate row with `effective_from = now`. Historical "
        "credit_transactions are NOT repriced — `amount` and `balance_after` "
        "are already credit-denominated snapshots."
    ),
)
def create_rate_config(
    request: CreditRateConfigUpdateRequest,
    svc: CreditRateService = Depends(get_rate_service),
    current_user: Optional[dict] = Depends(get_current_user),
):
    if not check_root_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only ROOT_ADMIN can change the credit rate.",
        )

    created_by = None
    if current_user:
        created_by = (
            getattr(current_user, "user_id", None)
            or getattr(current_user, "id", None)
            or (current_user.get("user_id") or current_user.get("id") if isinstance(current_user, dict) else None)
        )

    svc.insert_new_rate(
        usd_to_credits=request.usd_to_credits,
        margin_pct=request.margin_pct,
        notes=request.notes,
        created_by=created_by,
    )
    return _rate_response(svc)


# ============================================================================
# Internal Endpoints (service-to-service, X-Internal-Service-Token gated)
#
# Called by admin_core_service from the Razorpay webhook handler after a
# credit-pack purchase succeeds (or is refunded). NOT exposed to end users —
# auth is via shared secret, not user JWT.
#
# Idempotency: both endpoints dedup on `external_reference_id` (Razorpay
# payment_id for grants, refund_id for refunds) via a partial UNIQUE index
# on credit_transactions.external_reference_id (V243).
# ============================================================================

@router.post(
    "/internal/grant-from-payment",
    response_model=InternalGrantOrRefundResponse,
    summary="Grant credits as fulfillment of a paid order (internal)",
    description=(
        "Service-to-service endpoint called by admin_core_service after a "
        "Razorpay credit-pack payment is captured. Idempotent on Razorpay "
        "payment_id. Requires X-Internal-Service-Token header."
    ),
)
def grant_from_payment(
    request: InternalGrantFromPaymentRequest,
    service: CreditService = Depends(get_credit_service),
    _: None = Depends(require_internal_service_token),
):
    return service.grant_from_purchase(request)


@router.post(
    "/internal/refund-from-payment",
    response_model=InternalGrantOrRefundResponse,
    summary="Reverse a previously-granted purchase (internal)",
    description=(
        "Service-to-service endpoint called by admin_core_service when "
        "Razorpay sends a refund.processed webhook. Idempotent on Razorpay "
        "refund_id. Balance is allowed to go negative (logged for ops)."
    ),
)
def refund_from_payment(
    request: InternalRefundFromPaymentRequest,
    service: CreditService = Depends(get_credit_service),
    _: None = Depends(require_internal_service_token),
):
    return service.refund_from_purchase(request)
