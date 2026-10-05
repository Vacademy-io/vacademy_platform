"""Shared token-usage logging + credit deduction for migrated AI features.

Wraps TokenUsageService.record_usage_and_deduct_credits on a fresh DB session so
it works equally from sync request handlers and background workers. Best-effort:
a billing failure never propagates — the generation has already happened.
"""
from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy.orm import Session

from ..db import db_session
from ..models.ai_token_usage import ApiProvider, RequestType
from .token_usage_service import TokenUsageService

logger = logging.getLogger(__name__)


def provider_for_model(model: str) -> ApiProvider:
    """OpenRouter exposes both; attribute by model family (matches the
    convention in content_generation_service / course_outline_service)."""
    return ApiProvider.GEMINI if "gemini" in (model or "").lower() else ApiProvider.OPENAI


def record_llm_billing(
    *,
    request_type: RequestType,
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    total_tokens: int,
    institute_id: Optional[str] = None,
    user_id: Optional[str] = None,
    request_id: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> None:
    """Log usage + deduct institute credits. Swallows all errors."""
    try:
        with db_session() as db:
            TokenUsageService(db).record_usage_and_deduct_credits(
                api_provider=provider_for_model(model),
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                request_type=request_type,
                institute_id=institute_id,
                user_id=user_id,
                model=model,
                request_id=request_id,
                metadata=metadata,
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning("LLM billing failed (request_type=%s, request_id=%s): %s", request_type, request_id, exc)


# ============================================================================
# Academy-credits parametric tool billing (Phase 2)
#
# Charge for a metered AI tool = max(parametric_estimate, actual_token_cost):
#   - parametric: predictable, what the admin previewed (ToolCostEstimator)
#   - actual: real token cost via CreditService.calculate_credits (overage only)
# The user is never charged below the previewed number; huge inputs add overage.
#
# Fixed-price rows (params.fixed_price / no_token_overage, always the partner
# API key copy_check_evaluation_api) charge exactly the parametric quote. The
# parametric part is priced at the institute's rate (override → global →
# default, spec 10.3), or at `rate_snapshot` when the caller quoted one at
# enqueue.
# ============================================================================

def _charge_description(rt_str: str, model: str, tool_key: str, rate_source: Optional[str]) -> str:
    """credit_transactions.description: the old "<request_type> using <model>"
    plus the tool and the price it used, for reconciliation (spec 10.3/10.5)."""
    desc = f"{rt_str} using {model} [{tool_key}; rate {rate_source or 'default'}]"
    return desc[:500]


def charge_tool(
    db: Session,
    *,
    tool_key: str,
    tool_params: dict,
    request_type: RequestType,
    model: str,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    institute_id: Optional[str] = None,
    user_id: Optional[str] = None,
    user_role: Optional[str] = None,
    subject_user_id: Optional[str] = None,
    request_id: Optional[str] = None,
    idempotency_key: Optional[str] = None,
    usage_markup: Decimal = Decimal("1"),
    provider_cost_usd: Optional[float] = None,
    seconds: Optional[int] = None,
    character_count: Optional[int] = None,
    rate_snapshot: Optional[dict] = None,
) -> Decimal:
    """Deduct max(parametric, actual × usage_markup) for a metered tool, or
    exactly the parametric quote when the resolved row is fixed-price.

    The parametric part is priced for `institute_id` (its override, else the
    global rate) unless `rate_snapshot` - the rate quoted at enqueue - is given
    for this tool_key, which then wins (spec 10.3).

    `provider_cost_usd` is what the vendor charged us for this call (voice,
    speech-to-text, OCR, image); it lands in ai_token_usage.total_price so
    margins can be read from our own rows.

    usage_markup (default 1×) marks up ONLY the actual token cost — used to
    make heavy-usage tools (e.g. HTML document generation with big PDFs / large
    pages) charge above raw cost. The parametric floor is unchanged.

    Records an ai_token_usage row + a credit_transactions deduction. Returns the
    amount charged. Raises on hard DB errors (callers wrap as best-effort).
    """
    from .credit_service import CreditService
    from .tool_cost_estimator import ToolCostEstimator

    rt_str = request_type.value if hasattr(request_type, "value") else str(request_type)

    actual = Decimal("0")
    if prompt_tokens or completion_tokens:
        actual = CreditService(db).calculate_credits(
            request_type=rt_str,
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
        ) * usage_markup

    estimate = ToolCostEstimator(db).estimate(
        tool_key, tool_params, institute_id=institute_id, rate_snapshot=rate_snapshot,
    )
    parametric = Decimal(str(estimate["estimated_credits"]))
    fixed_price = bool(estimate.get("fixed_price"))
    charge = parametric if fixed_price else max(parametric, actual)
    description = _charge_description(rt_str, model, tool_key, estimate.get("rate_source"))

    if fixed_price and charge <= 0:
        # Nothing to charge at a fixed price (e.g. zero pages). Record the
        # usage only: a zero precomputed amount would make deduct_credits fall
        # back to the token price, which a fixed price must never charge.
        TokenUsageService(db).record_usage(
            api_provider=provider_for_model(model),
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
            request_type=request_type,
            institute_id=institute_id,
            user_id=user_id,
            model=model,
            request_id=request_id,
            total_price=provider_cost_usd,
            character_count=character_count,
        )
        return Decimal("0")

    TokenUsageService(db).record_usage_and_deduct_credits(
        api_provider=provider_for_model(model),
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=prompt_tokens + completion_tokens,
        request_type=request_type,
        institute_id=institute_id,
        user_id=user_id,
        model=model,
        request_id=request_id,
        precomputed_credits=charge,
        idempotency_key=idempotency_key,
        user_role=user_role,
        subject_user_id=subject_user_id,
        total_price=provider_cost_usd,
        seconds=seconds,
        character_count=character_count,
        # Post-paid: the work was already delivered, so never silently drop the
        # charge if a concurrent spend slipped the balance below the estimate.
        allow_negative=True,
        description=description,
    )
    return charge


def record_tool_billing(
    *,
    tool_key: str,
    tool_params: dict,
    request_type: RequestType,
    model: str,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    institute_id: Optional[str] = None,
    user_id: Optional[str] = None,
    user_role: Optional[str] = None,
    subject_user_id: Optional[str] = None,
    request_id: Optional[str] = None,
    idempotency_key: Optional[str] = None,
    usage_markup: Decimal = Decimal("1"),
    provider_cost_usd: Optional[float] = None,
    seconds: Optional[int] = None,
    character_count: Optional[int] = None,
    rate_snapshot: Optional[dict] = None,
) -> None:
    """Best-effort tool charge on a fresh session. Swallows all errors — the
    work has already happened, so a billing failure must not fail the response.
    (Copy-check charges keyed on a process id are re-checked by the nightly
    billing reconciliation, services/copy_check/billing_reconciliation.py.)"""
    if not institute_id:
        return
    try:
        with db_session() as db:
            charge_tool(
                db,
                tool_key=tool_key,
                tool_params=tool_params,
                request_type=request_type,
                model=model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                institute_id=institute_id,
                user_id=user_id,
                user_role=user_role,
                subject_user_id=subject_user_id,
                request_id=request_id,
                idempotency_key=idempotency_key,
                usage_markup=usage_markup,
                provider_cost_usd=provider_cost_usd,
                seconds=seconds,
                character_count=character_count,
                rate_snapshot=rate_snapshot,
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Tool billing failed (tool=%s, request_id=%s): %s", tool_key, request_id, exc)


def preflight_tool_credits(
    db: Session,
    *,
    tool_key: str,
    tool_params: dict,
    institute_id: Optional[str],
) -> dict:
    """Estimate the parametric cost + check affordability for a 402 pre-flight.

    Returns the estimate dict (with current_balance/balance_after/sufficient).
    `sufficient` is None when balance is unknown (no institute) — callers should
    treat None as "allow" so a missing balance never hard-blocks.
    """
    from .tool_cost_estimator import ToolCostEstimator

    return ToolCostEstimator(db).estimate_with_balance(tool_key, tool_params, institute_id)
