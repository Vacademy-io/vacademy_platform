"""
Credit Service - Core business logic for credit management.

This service handles:
- Credit balance management
- Credit calculations based on pricing
- Credit deduction and grants
- Usage analytics
- Alert generation
"""

import logging
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List, Dict
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..schemas.credits import (
    CreditBalanceResponse,
    CreditGrantRequest,
    CreditGrantResponse,
    CreditCheckRequest,
    CreditCheckResponse,
    CreditDeductRequest,
    CreditDeductResponse,
    CreditTransactionResponse,
    InternalGrantFromPaymentRequest,
    InternalRefundFromPaymentRequest,
    InternalGrantOrRefundResponse,
    TransactionHistoryRequest,
    TransactionHistoryResponse,
    UsageAnalyticsResponse,
    UsageBreakdownItem,
    UsageByDayItem,
    UsageForecastResponse,
    PricingConfigResponse,
    ModelPricingResponse,
    AllPricingResponse,
    CreditAlertResponse,
    AlertsListResponse,
    TransactionType,
    AlertType,
    ModelTier,
)

logger = logging.getLogger(__name__)

# ============================================================================
# Constants
# ============================================================================

INITIAL_CREDITS = Decimal("100")
DEFAULT_LOW_BALANCE_THRESHOLD = Decimal("10")

# Legacy fallback constant. Live calculations route through
# `CreditRateService.get_effective_ratio()` (DB-driven via V252's
# `credit_rate_config` table). This value matches the seeded row
# (usd_to_credits=100, margin_pct=50 → effective=150) and is the
# same number the codebase shipped with before V252.
USD_TO_CREDIT_RATIO = Decimal("150")

# Default model tier multipliers (used as fallback)
MODEL_TIER_MULTIPLIERS = {
    ModelTier.STANDARD: Decimal("1.0"),
    ModelTier.PREMIUM: Decimal("2.0"),
    ModelTier.ULTRA: Decimal("4.0"),
}

# Model pattern to tier mapping (in-code fallback)
MODEL_TIER_MAPPING = {
    "google/gemini-2.0-flash": ModelTier.STANDARD,
    "google/gemini-2.5-flash": ModelTier.STANDARD,
    "google/gemini-2.5-pro": ModelTier.PREMIUM,
    "deepseek": ModelTier.STANDARD,
    "gpt-3.5": ModelTier.STANDARD,
    "gpt-4-turbo": ModelTier.PREMIUM,
    "gpt-4o": ModelTier.ULTRA,
    "claude-3-haiku": ModelTier.STANDARD,
    "claude-3-sonnet": ModelTier.PREMIUM,
    "claude-3-opus": ModelTier.ULTRA,
}

# Default pricing (fallback if DB not configured) — $1 = 100 credits scale
DEFAULT_PRICING = {
    "content": {"base_cost": Decimal("0.05"), "token_rate": Decimal("0.00001"), "min_charge": Decimal("0.05"), "unit": "tokens"},
    "agent": {"base_cost": Decimal("0.05"), "token_rate": Decimal("0.00001"), "min_charge": Decimal("0.05"), "unit": "tokens"},
    "copilot": {"base_cost": Decimal("0.05"), "token_rate": Decimal("0.00001"), "min_charge": Decimal("0.05"), "unit": "tokens"},
    "analytics": {"base_cost": Decimal("0.05"), "token_rate": Decimal("0.00001"), "min_charge": Decimal("0.05"), "unit": "tokens"},
    "outline": {"base_cost": Decimal("0.05"), "token_rate": Decimal("0.00001"), "min_charge": Decimal("0.05"), "unit": "tokens"},
    "evaluation": {"base_cost": Decimal("0.10"), "token_rate": Decimal("0.000015"), "min_charge": Decimal("0.10"), "unit": "tokens"},
    "embedding": {"base_cost": Decimal("0.01"), "token_rate": Decimal("0.000002"), "min_charge": Decimal("0.01"), "unit": "tokens"},
    "image": {"base_cost": Decimal("0.30"), "token_rate": Decimal("0"), "min_charge": Decimal("0.30"), "unit": "none"},
    # Video pricing reads actual model USD via the real-cost path in
    # calculate_credits (line 854-865) when the per-shot HTML LLM call lands
    # in deduct_credits with prompt_tokens + completion_tokens > 0 — the
    # token_rate / base_cost below are FALLBACK numbers only.
    # Real per-video cost since the May 2026 audit shipped is dominated by:
    #   • Per-shot HTML LLM calls (8-12 shots × ~30K input + ~10K output)
    #   • Post-render regens (bbox-lint ~30%, second-beat ~15%, brand-asset
    #     ~10% on intro/outro) — each adds one extra LLM call
    #   • Vision review (8 calls × ~$0.014/shot at Gemini 2.5 Pro)
    #   • Vision review now also pays for a prior-shot reference thumbnail
    #     (~+$0.001/call) on every non-first shot
    # Typical ultra video: ~290 credits; super_ultra: ~360 credits.
    # See AI_CREDITS_PRICING.md for the customer-facing breakdown.
    "video": {"base_cost": Decimal("0.05"), "token_rate": Decimal("0.00001"), "min_charge": Decimal("0.05"), "unit": "tokens"},
    # Reels-from-long-video /preview gate. One Haiku-class LLM call per
    # picked candidate (~2k tokens round-trip — 1.5k prompt + 0.5k completion).
    # Same rates as `content` but bucketed separately so audit can tell
    # apart "user is exploring scan results" vs "user is generating outlines".
    "reels_preview": {"base_cost": Decimal("0.05"), "token_rate": Decimal("0.00001"), "min_charge": Decimal("0.05"), "unit": "tokens"},
    "tts": {"base_cost": Decimal("0.02"), "token_rate": Decimal("0.00001"), "min_charge": Decimal("0.02"), "unit": "characters"},
    "tts_premium": {"base_cost": Decimal("0.04"), "token_rate": Decimal("0.00002"), "min_charge": Decimal("0.04"), "unit": "characters"},
    "stock": {"base_cost": Decimal("0.10"), "token_rate": Decimal("0"), "min_charge": Decimal("0.10"), "unit": "none"},
    # Avatar video — billed per second of generated talking-head footage.
    # Real cost path: seconds × ai_models.video_price_per_second × USD_TO_CREDIT_RATIO.
    # Fallback: base_cost + (seconds × token_rate × multiplier) when the model
    # row is missing video_price_per_second. token_rate ≈ 8 credits/sec covers
    # both Kling ($0.0562/s × 150 ≈ 8.4) and Fabric ($0.08/s × 150 = 12) on the
    # conservative-low side; the real-cost path picks the actual rate.
    "avatar_video": {"base_cost": Decimal("0.05"), "token_rate": Decimal("8"), "min_charge": Decimal("0.05"), "unit": "seconds"},
    # AI video shots (fal.ai Veo, AI_VIDEO_HERO + inline <aivideo>).
    # Pricing is non-uniform (audio on/off × duration) and lives in
    # fal_veo_client._PRICE_PER_SECOND_USD; the orchestrator computes
    # the exact USD cost per call and deducts via `precomputed_credits`,
    # bypassing calculate_credits. This entry exists so usage analytics
    # group "ai_video" deductions correctly (by_request_type breakdown).
    "ai_video": {"base_cost": Decimal("0"), "token_rate": Decimal("0"), "min_charge": Decimal("0"), "unit": "none"},
    # Metered AI tools (academy-credits Phase 2). The real charge is parametric
    # (see ToolCostEstimator / ai_tool_pricing) and passed via precomputed_credits;
    # these token-based rows only price the *overage* leg max(parametric, actual)
    # and keep usage analytics bucketed instead of falling back to `content`.
    "assessment": {"base_cost": Decimal("0.05"), "token_rate": Decimal("0.00001"), "min_charge": Decimal("0.05"), "unit": "tokens"},
    "notes": {"base_cost": Decimal("0.05"), "token_rate": Decimal("0.00001"), "min_charge": Decimal("0.05"), "unit": "tokens"},
    "lecture": {"base_cost": Decimal("0.05"), "token_rate": Decimal("0.00001"), "min_charge": Decimal("0.05"), "unit": "tokens"},
    # Transcription cost is purely per-audio-minute (parametric); no LLM token
    # leg, so the fallback math contributes nothing — charge is always precomputed.
    "transcription": {"base_cost": Decimal("0"), "token_rate": Decimal("0"), "min_charge": Decimal("0"), "unit": "none"},
}


class CreditService:
    """Service for managing institute credits."""

    def __init__(self, db: Session):
        self.db = db

    # ========================================================================
    # Balance Management
    # ========================================================================

    def get_balance(self, institute_id: str) -> Optional[CreditBalanceResponse]:
        """Get current credit balance for an institute."""
        query = text("""
            SELECT id, institute_id, total_credits, used_credits, current_balance,
                   low_balance_threshold, created_at, updated_at
            FROM institute_credits
            WHERE institute_id = :institute_id
        """)
        result = self.db.execute(query, {"institute_id": institute_id})
        row = result.fetchone()
        
        if not row:
            return None
        
        return CreditBalanceResponse(
            institute_id=row.institute_id,
            total_credits=row.total_credits,
            used_credits=row.used_credits,
            current_balance=row.current_balance,
            low_balance_threshold=row.low_balance_threshold,
            is_low_balance=row.current_balance < row.low_balance_threshold,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    def create_initial_credits(self, institute_id: str) -> CreditBalanceResponse:
        """Create initial credit balance for a new institute."""
        now = datetime.utcnow()
        credits_id = str(uuid4())
        transaction_id = str(uuid4())
        
        # Create credits record
        insert_credits = text("""
            INSERT INTO institute_credits (id, institute_id, total_credits, used_credits, current_balance, 
                                           low_balance_threshold, created_at, updated_at)
            VALUES (:id, :institute_id, :total, 0, :balance, :threshold, :now, :now)
            ON CONFLICT (institute_id) DO NOTHING
        """)
        self.db.execute(insert_credits, {
            "id": credits_id,
            "institute_id": institute_id,
            "total": INITIAL_CREDITS,
            "balance": INITIAL_CREDITS,
            "threshold": DEFAULT_LOW_BALANCE_THRESHOLD,
            "now": now,
        })
        
        # Create initial grant transaction
        insert_txn = text("""
            INSERT INTO credit_transactions (id, institute_id, transaction_type, amount, balance_after,
                                             description, created_at)
            VALUES (:id, :institute_id, :type, :amount, :balance, :desc, :now)
        """)
        self.db.execute(insert_txn, {
            "id": transaction_id,
            "institute_id": institute_id,
            "type": TransactionType.INITIAL_GRANT.value,
            "amount": INITIAL_CREDITS,
            "balance": INITIAL_CREDITS,
            "desc": "Initial signup bonus",
            "now": now,
        })
        
        self.db.commit()
        
        logger.info(f"Created initial credits for institute {institute_id}")
        return self.get_balance(institute_id)

    def ensure_credits_exist(self, institute_id: str) -> CreditBalanceResponse:
        """Ensure credits record exists for institute, creating if needed."""
        balance = self.get_balance(institute_id)
        if not balance:
            balance = self.create_initial_credits(institute_id)
        return balance

    # ========================================================================
    # Credit Grants (Admin)
    # ========================================================================

    def grant_credits(
        self, 
        institute_id: str, 
        request: CreditGrantRequest,
        granted_by: str
    ) -> CreditGrantResponse:
        """Grant credits to an institute (admin action)."""
        # Ensure credits record exists
        self.ensure_credits_exist(institute_id)
        
        now = datetime.utcnow()
        transaction_id = str(uuid4())
        
        # Update balance
        update_query = text("""
            UPDATE institute_credits
            SET total_credits = total_credits + :amount,
                current_balance = current_balance + :amount,
                updated_at = :now
            WHERE institute_id = :institute_id
            RETURNING current_balance
        """)
        result = self.db.execute(update_query, {
            "amount": request.amount,
            "now": now,
            "institute_id": institute_id,
        })
        row = result.fetchone()
        new_balance = row.current_balance if row else Decimal("0")
        
        # Record transaction
        insert_txn = text("""
            INSERT INTO credit_transactions (id, institute_id, transaction_type, amount, balance_after,
                                             description, granted_by, user_id, user_role, created_at)
            VALUES (:id, :institute_id, :type, :amount, :balance, :desc, :granted_by, :user_id, :user_role, :now)
        """)
        self.db.execute(insert_txn, {
            "id": transaction_id,
            "institute_id": institute_id,
            "type": TransactionType.ADMIN_GRANT.value,
            "amount": request.amount,
            "balance": new_balance,
            "desc": request.description or "Admin credit grant",
            "user_id": granted_by,
            "user_role": "ADMIN",
            "granted_by": granted_by,
            "now": now,
        })
        
        self.db.commit()
        
        logger.info(f"Granted {request.amount} credits to institute {institute_id} by {granted_by}")
        
        return CreditGrantResponse(
            success=True,
            institute_id=institute_id,
            amount_granted=request.amount,
            new_balance=new_balance,
            transaction_id=transaction_id,
            message=f"Successfully granted {request.amount} credits",
        )

    # ========================================================================
    # Admin Credit Deduction
    # ========================================================================

    def admin_deduct_credits(
        self,
        institute_id: str,
        request: CreditGrantRequest,
        deducted_by: str
    ) -> CreditGrantResponse:
        """Deduct credits from an institute (admin action)."""
        self.ensure_credits_exist(institute_id)

        # Check current balance
        balance = self.get_balance(institute_id)
        if balance and balance.current_balance < request.amount:
            return CreditGrantResponse(
                success=False,
                institute_id=institute_id,
                amount_granted=Decimal("0"),
                new_balance=balance.current_balance if balance else Decimal("0"),
                transaction_id="",
                message=f"Insufficient balance. Current: {balance.current_balance}, Requested: {request.amount}",
            )

        now = datetime.utcnow()
        transaction_id = str(uuid4())

        # Update balance
        update_query = text("""
            UPDATE institute_credits
            SET used_credits = used_credits + :amount,
                current_balance = current_balance - :amount,
                updated_at = :now
            WHERE institute_id = :institute_id
            RETURNING current_balance
        """)
        result = self.db.execute(update_query, {
            "amount": request.amount,
            "now": now,
            "institute_id": institute_id,
        })
        row = result.fetchone()
        new_balance = row.current_balance if row else Decimal("0")

        # Record transaction
        insert_txn = text("""
            INSERT INTO credit_transactions (id, institute_id, transaction_type, amount, balance_after,
                                             description, granted_by, user_id, user_role, created_at)
            VALUES (:id, :institute_id, :type, :amount, :balance, :desc, :granted_by, :user_id, :user_role, :now)
        """)
        self.db.execute(insert_txn, {
            "id": transaction_id,
            "institute_id": institute_id,
            "type": TransactionType.ADMIN_DEDUCTION.value,
            "amount": -request.amount,
            "balance": new_balance,
            "desc": request.description or "Admin credit deduction",
            "granted_by": deducted_by,
            "user_id": deducted_by,
            "user_role": "ADMIN",
            "now": now,
        })

        self.db.commit()

        # Check and create alerts if needed. (Bugfix: _check_and_create_alerts
        # requires a threshold arg — the prior 2-arg call raised TypeError on
        # every admin deduction after the commit.)
        threshold = balance.low_balance_threshold if balance else DEFAULT_LOW_BALANCE_THRESHOLD
        self._check_and_create_alerts(institute_id, new_balance, threshold)

        logger.info(f"Deducted {request.amount} credits from institute {institute_id} by {deducted_by}")

        return CreditGrantResponse(
            success=True,
            institute_id=institute_id,
            amount_granted=request.amount,
            new_balance=new_balance,
            transaction_id=transaction_id,
            message=f"Successfully deducted {request.amount} credits",
        )

    # ========================================================================
    # Internal: Credit Pack Purchase Fulfillment (called from webhook)
    # ========================================================================

    def grant_from_purchase(
        self,
        request: InternalGrantFromPaymentRequest,
    ) -> InternalGrantOrRefundResponse:
        """
        Grant credits to fulfill a successful Razorpay credit-pack purchase.

        Idempotent on `external_reference_id` (the Razorpay payment_id):
        the V243 partial UNIQUE index on credit_transactions.external_reference_id
        absorbs duplicate webhook deliveries. On collision the entire transaction
        rolls back (UPDATE included) and we return already_processed=True.

        Order of operations matters: UPDATE first, then INSERT. If INSERT fails
        on the unique constraint, db.rollback() reverses the UPDATE too.
        """
        self.ensure_credits_exist(request.institute_id)

        now = datetime.utcnow()
        transaction_id = str(uuid4())

        try:
            # 1. Atomic balance update
            update_result = self.db.execute(
                text("""
                    UPDATE institute_credits
                    SET total_credits = total_credits + :amount,
                        current_balance = current_balance + :amount,
                        updated_at = :now
                    WHERE institute_id = :institute_id
                    RETURNING current_balance
                """),
                {
                    "amount": request.amount,
                    "now": now,
                    "institute_id": request.institute_id,
                },
            )
            row = update_result.fetchone()
            new_balance = row.current_balance if row else Decimal("0")

            # 2. Insert ledger row — fails on dup external_reference_id
            self.db.execute(
                text("""
                    INSERT INTO credit_transactions
                        (id, institute_id, transaction_type, amount, balance_after,
                         description, reference_id, external_reference_id,
                         granted_by, user_id, user_role, created_at)
                    VALUES
                        (:id, :institute_id, :type, :amount, :balance,
                         :desc, :ref_id, :ext_ref, :granted_by, :user_id, :user_role, :now)
                """),
                {
                    "id": transaction_id,
                    "institute_id": request.institute_id,
                    "type": TransactionType.PURCHASE.value,
                    "amount": request.amount,
                    "balance": new_balance,
                    "desc": request.description
                    or f"Credit pack purchase ({request.pack_code or 'unknown'})",
                    "ref_id": str(request.platform_payment_id)
                    if request.platform_payment_id
                    else None,
                    "ext_ref": request.external_reference_id,
                    "granted_by": "platform_billing",
                    "user_id": getattr(request, "buyer_user_id", None),
                    "user_role": "ADMIN" if getattr(request, "buyer_user_id", None) else None,
                    "now": now,
                },
            )
            self.db.commit()
        except IntegrityError:
            # Concurrent or retried webhook beat us. Roll back the UPDATE too.
            self.db.rollback()
            existing = self.db.execute(
                text(
                    "SELECT id FROM credit_transactions "
                    "WHERE external_reference_id = :ext_ref"
                ),
                {"ext_ref": request.external_reference_id},
            ).fetchone()
            balance = self.get_balance(request.institute_id)
            logger.info(
                "grant_from_purchase: duplicate ext_ref=%s for institute=%s — already processed",
                request.external_reference_id,
                request.institute_id,
            )
            return InternalGrantOrRefundResponse(
                success=True,
                institute_id=request.institute_id,
                new_balance=balance.current_balance if balance else Decimal("0"),
                transaction_id=str(existing.id) if existing else None,
                already_processed=True,
                message="Already processed (duplicate webhook)",
            )

        logger.info(
            "Granted %s credits to institute %s from payment ext_ref=%s pack=%s",
            request.amount,
            request.institute_id,
            request.external_reference_id,
            request.pack_code,
        )
        return InternalGrantOrRefundResponse(
            success=True,
            institute_id=request.institute_id,
            new_balance=new_balance,
            transaction_id=transaction_id,
            already_processed=False,
            message=f"Granted {request.amount} credits from payment",
        )

    def refund_from_purchase(
        self,
        request: InternalRefundFromPaymentRequest,
    ) -> InternalGrantOrRefundResponse:
        """
        Reverse a previously-granted purchase (partial or full refund).

        Idempotent on the Razorpay refund_id (passed as external_reference_id).
        Note: refund_id is distinct from the original payment_id, so the unique
        constraint won't collide with the PURCHASE row even when both are stored
        in external_reference_id.

        The balance may go negative if the institute has already consumed the
        purchased credits — this is intentional (logged for ops review). Refunds
        flip total_credits down too (REFUND is the inverse of PURCHASE), unlike
        ADMIN_DEDUCTION which only moves used_credits.
        """
        self.ensure_credits_exist(request.institute_id)

        now = datetime.utcnow()
        transaction_id = str(uuid4())

        try:
            update_result = self.db.execute(
                text("""
                    UPDATE institute_credits
                    SET total_credits = total_credits - :amount,
                        current_balance = current_balance - :amount,
                        updated_at = :now
                    WHERE institute_id = :institute_id
                    RETURNING current_balance
                """),
                {
                    "amount": request.amount,
                    "now": now,
                    "institute_id": request.institute_id,
                },
            )
            row = update_result.fetchone()
            new_balance = row.current_balance if row else Decimal("0")

            self.db.execute(
                text("""
                    INSERT INTO credit_transactions
                        (id, institute_id, transaction_type, amount, balance_after,
                         description, reference_id, external_reference_id,
                         granted_by, user_id, user_role, created_at)
                    VALUES
                        (:id, :institute_id, :type, :amount, :balance,
                         :desc, :ref_id, :ext_ref, :granted_by, :user_id, :user_role, :now)
                """),
                {
                    "id": transaction_id,
                    "institute_id": request.institute_id,
                    "type": TransactionType.REFUND.value,
                    "amount": -request.amount,
                    "balance": new_balance,
                    "desc": request.description
                    or f"Refund for payment ({request.pack_code or 'unknown'})",
                    "ref_id": str(request.platform_payment_id)
                    if request.platform_payment_id
                    else None,
                    "ext_ref": request.external_reference_id,
                    "granted_by": "platform_billing",
                    "user_id": getattr(request, "buyer_user_id", None),
                    "user_role": "ADMIN" if getattr(request, "buyer_user_id", None) else None,
                    "now": now,
                },
            )
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            existing = self.db.execute(
                text(
                    "SELECT id FROM credit_transactions "
                    "WHERE external_reference_id = :ext_ref"
                ),
                {"ext_ref": request.external_reference_id},
            ).fetchone()
            balance = self.get_balance(request.institute_id)
            logger.info(
                "refund_from_purchase: duplicate ext_ref=%s for institute=%s — already processed",
                request.external_reference_id,
                request.institute_id,
            )
            return InternalGrantOrRefundResponse(
                success=True,
                institute_id=request.institute_id,
                new_balance=balance.current_balance if balance else Decimal("0"),
                transaction_id=str(existing.id) if existing else None,
                already_processed=True,
                message="Already processed (duplicate webhook)",
            )

        if new_balance < 0:
            logger.warning(
                "Refund pushed institute %s balance negative: %s "
                "(refund=%s ext_ref=%s) — ops review required",
                request.institute_id,
                new_balance,
                request.amount,
                request.external_reference_id,
            )

        logger.info(
            "Refunded %s credits from institute %s for payment ext_ref=%s",
            request.amount,
            request.institute_id,
            request.external_reference_id,
        )
        return InternalGrantOrRefundResponse(
            success=True,
            institute_id=request.institute_id,
            new_balance=new_balance,
            transaction_id=transaction_id,
            already_processed=False,
            message=f"Refunded {request.amount} credits",
        )

    # ========================================================================
    # Credit Check (Pre-flight)
    # ========================================================================

    # Tier-aware pre-flight estimates for the video pipeline (recalibrated
    # 2026-05-15 against live stage data). Original floors (300/380 for
    # ultra/super_ultra) were calibrated against the worst-case Gemini 3.1 Pro
    # pricing — but production ultra runs use Gemini 3 Flash, which deducts
    # ~7-15 credits for a typical 60s video (observed: 7.22 cr on a 10-shot
    # Labour Link run, 56s narration, 313K tokens). Those original floors
    # would have blocked users with 50-200 credits who could complete an
    # ultra run 5-10× over — paternalistic and wrong.
    #
    # The floor's job is to catch truly-bankrupt institutes and provide a
    # ~30% headroom over typical cost, NOT to reserve the worst-case maximum.
    # Mid-run depletion is handled by refund-on-failure (TokenUsageService.
    # refund_video_credits), and per-stage deduction tracks reality via
    # actual OpenRouter token counts. Institutes choosing the more expensive
    # Pro model for HTML gen will spend more — they should have a sufficient
    # balance, but we don't punish the Flash majority for that minority case.
    #
    # `partial_run_factor` scales the floor for resume/retry endpoints (where
    # checkpoints mean only a fraction of the work remains).
    _VIDEO_TIER_FLOOR_CREDITS: Dict[str, Decimal] = {
        "free":        Decimal("5"),
        "standard":    Decimal("10"),
        "premium":     Decimal("20"),
        "ultra":       Decimal("30"),
        "super_ultra": Decimal("50"),
    }

    def check_video_tier_credits(
        self,
        institute_id: str,
        quality_tier: str,
        ai_video_enabled: bool = False,
        partial_run_factor: float = 1.0,
    ) -> CreditCheckResponse:
        """Tier-aware pre-flight credit check for the video pipeline.

        Returns a CreditCheckResponse with `estimated_cost` set to the per-tier
        typical+headroom floor (NOT actual cost — actual cost lands in
        credit_transactions stage-by-stage via TokenUsageService).

        Caller raises HTTP 402 when `has_sufficient_credits` is False.

        - `quality_tier`: one of free/standard/premium/ultra/super_ultra.
          Unknown tier falls back to the "standard" floor (defensive).
        - `ai_video_enabled`: when True, adds the worst-case Veo cap
          (currently 225 credits at $1.50 cap × 150-credit ratio) so a user
          with marginal balance can't enable Veo and then circuit-break
          mid-run. Subsumes the previous standalone Veo-aware pre-flight.
        - `partial_run_factor`: 1.0 for fresh generation; 0.5 for resume/retry
          where most shots are already cached. Lets the same gate apply at
          all three router entry points without over-rejecting partial runs.
        """
        balance = self.get_balance(institute_id)
        if not balance:
            balance = self.create_initial_credits(institute_id)
        current = balance.current_balance

        tier_key = (quality_tier or "standard").strip().lower()
        floor = self._VIDEO_TIER_FLOOR_CREDITS.get(
            tier_key, self._VIDEO_TIER_FLOOR_CREDITS["standard"]
        )
        # partial_run_factor scales by the fraction of work remaining.
        try:
            factor = Decimal(str(max(0.1, min(1.0, float(partial_run_factor)))))
        except (TypeError, ValueError):
            factor = Decimal("1.0")
        estimated_cost = (floor * factor).quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP
        )

        # AI video (Veo) adds worst-case cap on top, regardless of partial-run
        # factor — even on resume, the Veo cap is the same hard ceiling.
        veo_cap_credits = Decimal("0")
        if ai_video_enabled:
            try:
                from .ai_video_constants import AI_VIDEO_PER_VIDEO_COST_CAP_USD
                ratio = self._effective_usd_to_credit_ratio()
                veo_cap_credits = (
                    Decimal(str(AI_VIDEO_PER_VIDEO_COST_CAP_USD)) * ratio
                ).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
                estimated_cost = (estimated_cost + veo_cap_credits).quantize(
                    Decimal("0.0001"), rounding=ROUND_HALF_UP
                )
            except Exception as exc:
                # Defensive: if the Veo cap import fails, fall back to a
                # hardcoded 225-credit guard so we still gate something.
                logger.warning(f"check_video_tier_credits: Veo cap lookup failed ({exc}); using 225-credit fallback")
                veo_cap_credits = Decimal("225")
                estimated_cost = (estimated_cost + veo_cap_credits).quantize(
                    Decimal("0.0001"), rounding=ROUND_HALF_UP
                )

        has_sufficient = current >= estimated_cost
        balance_after = current - estimated_cost

        if has_sufficient:
            message = (
                f"Sufficient credits for {tier_key} tier"
                f"{' + AI video' if ai_video_enabled else ''}. "
                f"Estimated floor: {estimated_cost} credits."
            )
        else:
            short_by = estimated_cost - current
            message = (
                f"Insufficient credits for {tier_key} tier"
                f"{' + AI video (worst-case Veo cap included)' if ai_video_enabled else ''}. "
                f"Need at least {estimated_cost} credits (you have {current}, short by {short_by}). "
                f"Real cost is tracked per-stage via TokenUsageService — this is the upfront floor "
                f"to keep your run from circuit-breaking mid-render."
            )

        return CreditCheckResponse(
            has_sufficient_credits=has_sufficient,
            current_balance=current,
            estimated_cost=estimated_cost,
            balance_after=balance_after,
            message=message,
        )

    def check_credits(self, request: CreditCheckRequest) -> CreditCheckResponse:
        """Check if institute has sufficient credits for an operation."""
        # Get current balance
        balance = self.get_balance(request.institute_id)
        
        if not balance:
            # Institute has no credits record - create one (they get initial credits)
            balance = self.create_initial_credits(request.institute_id)
        
        # Calculate estimated cost
        estimated_cost = self.calculate_credits(
            request_type=request.request_type,
            model=request.model,
            prompt_tokens=request.estimated_tokens or 0,
            completion_tokens=0,
            character_count=request.character_count or 0,
        )
        
        has_sufficient = balance.current_balance >= estimated_cost
        balance_after = balance.current_balance - estimated_cost
        
        if has_sufficient:
            message = f"Sufficient credits available. Estimated cost: {estimated_cost}"
        else:
            message = f"Insufficient credits. Need {estimated_cost}, have {balance.current_balance}"
        
        return CreditCheckResponse(
            has_sufficient_credits=has_sufficient,
            current_balance=balance.current_balance,
            estimated_cost=estimated_cost,
            balance_after=balance_after,
            message=message,
        )

    # ========================================================================
    # Credit Deduction
    # ========================================================================

    def deduct_credits(self, request: CreditDeductRequest) -> CreditDeductResponse:
        """Deduct credits after an AI operation."""
        # Idempotency short-circuit: if a transaction with this dedup key already
        # exists, this is a duplicate (e.g. transcription callback + watchdog both
        # firing) — return a no-op success instead of double-charging.
        idem_key = getattr(request, "idempotency_key", None)
        if idem_key:
            existing = self.db.execute(
                text(
                    "SELECT balance_after FROM credit_transactions "
                    "WHERE external_reference_id = :k LIMIT 1"
                ),
                {"k": idem_key},
            ).fetchone()
            if existing:
                logger.info(f"Idempotent deduct no-op for key {idem_key}")
                return CreditDeductResponse(
                    success=True,
                    credits_deducted=Decimal("0"),
                    new_balance=existing.balance_after,
                    transaction_id="",
                    message="Already processed (idempotent no-op)",
                )

        # Calculate actual credits — bypassed when `precomputed_credits` is set
        # (Veo path: pricing lives in fal_veo_client.py rather than ai_models).
        precomputed = getattr(request, "precomputed_credits", None)
        if precomputed is not None and precomputed > 0:
            credits_to_deduct = Decimal(str(precomputed)).quantize(
                Decimal("0.0001"), rounding=ROUND_HALF_UP
            )
        else:
            credits_to_deduct = self.calculate_credits(
                request_type=request.request_type,
                model=request.model,
                prompt_tokens=request.prompt_tokens,
                completion_tokens=request.completion_tokens,
                character_count=request.character_count,
                seconds=getattr(request, "seconds", 0) or 0,
            )
        
        now = datetime.utcnow()
        transaction_id = str(uuid4())
        
        # Ensure credits exist
        self.ensure_credits_exist(request.institute_id)
        
        # Update balance atomically. Normally guarded against going negative;
        # post-paid tool charges (allow_negative) drop the guard so a charge for
        # already-delivered work is never silently lost when a concurrent spend
        # slipped the balance below the pre-flight estimate.
        allow_negative = getattr(request, "allow_negative", False)
        guard = "" if allow_negative else "AND current_balance >= :amount"
        update_query = text(f"""
            UPDATE institute_credits
            SET used_credits = used_credits + :amount,
                current_balance = current_balance - :amount,
                updated_at = :now
            WHERE institute_id = :institute_id {guard}
            RETURNING current_balance, low_balance_threshold
        """)
        result = self.db.execute(update_query, {
            "amount": credits_to_deduct,
            "now": now,
            "institute_id": request.institute_id,
        })
        row = result.fetchone()
        if not row:
            # Insufficient balance (guarded path only) — log loudly. allow_negative
            # callers never reach here (the row always matches when the institute
            # row exists, which ensure_credits_exist guaranteed above).
            logger.error(
                f"[credits] DROPPED CHARGE: insufficient balance for institute "
                f"{request.institute_id}, tried to deduct {credits_to_deduct} "
                f"({request.request_type}). Work may have been delivered unbilled."
            )
            return CreditDeductResponse(
                success=False,
                credits_deducted=Decimal("0"),
                new_balance=Decimal("0"),
                transaction_id="",
                message=f"Insufficient credits. Need {credits_to_deduct} credits.",
            )
        new_balance = row.current_balance
        threshold = row.low_balance_threshold if row else DEFAULT_LOW_BALANCE_THRESHOLD
        
        # Record transaction. external_reference_id carries the optional
        # idempotency key — the V243 partial UNIQUE index makes a concurrent
        # duplicate INSERT fail rather than double-charge.
        insert_txn = text("""
            INSERT INTO credit_transactions (id, institute_id, transaction_type, amount, balance_after,
                                             description, reference_id, request_type, model_name, batch_id,
                                             external_reference_id, user_id, user_role, subject_user_id, created_at)
            VALUES (:id, :institute_id, :type, :amount, :balance, :desc, :ref_id, :req_type, :model, :batch_id,
                    :ext_ref, :user_id, :user_role, :subject_user_id, :now)
        """)

        # Handle reference_id conversion
        ref_id = None
        if request.usage_log_id:
            try:
                ref_id = request.usage_log_id
            except Exception:
                pass

        desc_override = getattr(request, "description", None)
        try:
            self.db.execute(insert_txn, {
                "id": transaction_id,
                "institute_id": request.institute_id,
                "type": TransactionType.USAGE_DEDUCTION.value,
                "amount": -credits_to_deduct,  # Negative for deductions
                "balance": new_balance,
                "desc": desc_override or f"{request.request_type} using {request.model}",
                "ref_id": ref_id,
                "req_type": request.request_type,
                "model": request.model,
                "batch_id": request.batch_id,
                "ext_ref": idem_key,
                "user_id": getattr(request, "user_id", None),
                "user_role": getattr(request, "user_role", None),
                "subject_user_id": getattr(request, "subject_user_id", None),
                "now": now,
            })
        except IntegrityError:
            # Lost the race on the idempotency key — another concurrent call
            # already recorded this charge. Roll back our balance decrement
            # (same uncommitted transaction) and return the no-op result.
            self.db.rollback()
            logger.info(f"Idempotent deduct race resolved for key {idem_key}")
            bal = self.get_balance(request.institute_id)
            return CreditDeductResponse(
                success=True,
                credits_deducted=Decimal("0"),
                new_balance=bal.current_balance if bal else Decimal("0"),
                transaction_id="",
                message="Already processed (idempotent no-op)",
            )
        
        # Update ai_token_usage with credits used
        if request.usage_log_id:
            try:
                update_usage = text("""
                    UPDATE ai_token_usage SET credits_used = :credits WHERE id = :id
                """)
                self.db.execute(update_usage, {
                    "credits": credits_to_deduct,
                    "id": request.usage_log_id,
                })
            except Exception as e:
                logger.warning(f"Failed to update ai_token_usage: {e}")
        
        # Check for alerts
        self._check_and_create_alerts(request.institute_id, new_balance, threshold)
        
        self.db.commit()
        
        logger.info(f"Deducted {credits_to_deduct} credits from institute {request.institute_id}")
        
        return CreditDeductResponse(
            success=True,
            credits_deducted=credits_to_deduct,
            new_balance=new_balance,
            transaction_id=transaction_id,
            message=f"Deducted {credits_to_deduct} credits",
        )

    # ========================================================================
    # Credit Refund
    # ========================================================================

    def refund_credits(
        self,
        institute_id: str,
        amount: Decimal,
        description: str,
        batch_id: Optional[str] = None,
    ) -> CreditDeductResponse:
        """
        Refund credits back to an institute's balance.
        Used when an operation fails after partial credit deduction (e.g., video pipeline failure).
        """
        if amount <= Decimal("0"):
            return CreditDeductResponse(
                success=False,
                credits_deducted=Decimal("0"),
                new_balance=Decimal("0"),
                transaction_id="",
                message="Nothing to refund",
            )

        now = datetime.utcnow()
        transaction_id = str(uuid4())

        self.ensure_credits_exist(institute_id)

        update_query = text("""
            UPDATE institute_credits
            SET used_credits = used_credits - :amount,
                current_balance = current_balance + :amount,
                updated_at = :now
            WHERE institute_id = :institute_id
            RETURNING current_balance
        """)
        result = self.db.execute(update_query, {
            "amount": amount,
            "now": now,
            "institute_id": institute_id,
        })
        row = result.fetchone()
        new_balance = row.current_balance if row else Decimal("0")

        insert_txn = text("""
            INSERT INTO credit_transactions
                (id, institute_id, transaction_type, amount, balance_after, description, batch_id, created_at)
            VALUES
                (:id, :institute_id, :type, :amount, :balance, :desc, :batch_id, :now)
        """)
        self.db.execute(insert_txn, {
            "id": transaction_id,
            "institute_id": institute_id,
            "type": TransactionType.REFUND.value,
            "amount": amount,  # Positive for refunds
            "balance": new_balance,
            "desc": description,
            "batch_id": batch_id,
            "now": now,
        })

        self.db.commit()
        logger.info(f"Refunded {amount} credits to institute {institute_id}: {description}")

        return CreditDeductResponse(
            success=True,
            credits_deducted=amount,
            new_balance=new_balance,
            transaction_id=transaction_id,
            message=f"Refunded {amount} credits",
        )

    # ========================================================================
    # Credit Calculation
    # ========================================================================

    def _effective_usd_to_credit_ratio(self) -> Decimal:
        """Current USD→credits multiplier from `credit_rate_config` (DB-driven).

        Defers to `CreditRateService`, which caches the active row for 60s.
        Falls back to the legacy `USD_TO_CREDIT_RATIO` constant only if the
        table is missing or empty (pre-V252 environments).
        """
        try:
            from .credit_rate_service import CreditRateService
            return CreditRateService(self.db).get_effective_ratio()
        except Exception as exc:
            logger.warning(
                "Failed to resolve effective USD→credit ratio (%s); using legacy fallback",
                exc,
            )
            return USD_TO_CREDIT_RATIO

    def calculate_credits(
        self,
        request_type: str,
        model: Optional[str] = None,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        character_count: int = 0,
        seconds: int = 0,
    ) -> Decimal:
        """
        Calculate credits for an AI operation.

        Primary formula (when model USD pricing available):
            max(min_charge, base_cost + actual_usd_cost × effective_ratio)
        where `effective_ratio = usd_to_credits × (1 + margin_pct/100)` from
        `credit_rate_config` (seed: 100 × 1.5 = 150).

        Fallback formula (unknown models / flat-rate types):
            max(min_charge, base_cost + units × token_rate × model_multiplier)
        """
        # Get pricing config from DB or defaults
        pricing = self._get_pricing(request_type)

        # --- Real-cost path: use actual model USD pricing from ai_models table ---
        if model and pricing["unit"] == "tokens" and (prompt_tokens > 0 or completion_tokens > 0):
            model_usd_pricing = self._get_model_usd_pricing(model)
            if model_usd_pricing:
                input_price_per_1m, output_price_per_1m = model_usd_pricing
                actual_usd = (
                    (Decimal(str(prompt_tokens)) * input_price_per_1m / Decimal("1000000"))
                    + (Decimal(str(completion_tokens)) * output_price_per_1m / Decimal("1000000"))
                )
                ratio = self._effective_usd_to_credit_ratio()
                calculated = pricing["base_cost"] + (actual_usd * ratio)
                result = max(pricing["min_charge"], calculated)
                return result.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

        # --- Real-cost path for per-second video models (avatar / future synthesis) ---
        if model and pricing["unit"] == "seconds" and seconds > 0:
            per_sec = self._get_model_video_per_second(model)
            if per_sec is not None:
                actual_usd = Decimal(str(seconds)) * per_sec
                ratio = self._effective_usd_to_credit_ratio()
                calculated = pricing["base_cost"] + (actual_usd * ratio)
                result = max(pricing["min_charge"], calculated)
                return result.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

        # --- Fallback path: existing formula for unknown models / flat-rate / characters ---
        multiplier = self._get_model_multiplier(model)

        if pricing["unit"] == "tokens":
            units = (prompt_tokens + completion_tokens) / 1000
        elif pricing["unit"] == "characters":
            units = character_count / 1000
        elif pricing["unit"] == "seconds":
            units = seconds  # token_rate is "credits per second" in this branch
        else:  # "none" - flat rate
            units = 0

        calculated = pricing["base_cost"] + (Decimal(str(units)) * pricing["token_rate"] * multiplier)
        result = max(pricing["min_charge"], calculated)
        return result.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

    def _get_pricing(self, request_type: str) -> dict:
        """Get pricing configuration for a request type."""
        try:
            query = text("""
                SELECT base_cost, token_rate, minimum_charge, unit_type
                FROM credit_pricing
                WHERE request_type = :request_type AND is_active = TRUE
            """)
            result = self.db.execute(query, {"request_type": request_type})
            row = result.fetchone()
            
            if row:
                return {
                    "base_cost": row.base_cost,
                    "token_rate": row.token_rate,
                    "min_charge": row.minimum_charge,
                    "unit": row.unit_type,
                }
        except Exception as e:
            logger.warning(f"Failed to get pricing from DB: {e}")
        
        # Fallback to defaults
        return DEFAULT_PRICING.get(request_type, DEFAULT_PRICING["content"])

    def _get_model_usd_pricing(self, model: str) -> Optional[tuple]:
        """
        Get actual USD pricing (input_price_per_1m, output_price_per_1m) from ai_models table.
        Returns None if model not found — caller should fall back to token_rate formula.
        """
        try:
            query = text("""
                SELECT input_price_per_1m, output_price_per_1m, is_free
                FROM ai_models
                WHERE model_id = :model_id AND is_active = TRUE
                LIMIT 1
            """)
            result = self.db.execute(query, {"model_id": model})
            row = result.fetchone()
            if row and row.input_price_per_1m is not None and row.output_price_per_1m is not None:
                if row.is_free:
                    # Free model → zero token cost (base_cost still applies via caller)
                    return (Decimal("0"), Decimal("0"))
                return (Decimal(str(row.input_price_per_1m)), Decimal(str(row.output_price_per_1m)))
        except Exception as e:
            logger.warning(f"Failed to get model USD pricing from ai_models: {e}")
        return None

    def _get_model_video_per_second(self, model: str) -> Optional[Decimal]:
        """Per-second USD price for video models (avatar synthesis, future video gen).

        Reads `ai_models.video_price_per_second` (added in V224). Returns None
        when the model row is missing or the price is unset — caller falls
        back to the token_rate formula.
        """
        try:
            query = text(
                "SELECT video_price_per_second FROM ai_models "
                "WHERE model_id = :model_id AND is_active = TRUE LIMIT 1"
            )
            row = self.db.execute(query, {"model_id": model}).fetchone()
            if row and row.video_price_per_second is not None:
                return Decimal(str(row.video_price_per_second))
        except Exception as e:
            logger.warning(f"Failed to get video per-second pricing from ai_models: {e}")
        return None

    def _get_model_multiplier(self, model: Optional[str]) -> Decimal:
        """Get pricing multiplier for a model."""
        if not model:
            return Decimal("1.0")

        # Try model_pricing table first (pattern-based)
        try:
            query = text("""
                SELECT multiplier
                FROM model_pricing
                WHERE :model LIKE REPLACE(model_pattern, '%', '%%') || '%' AND is_active = TRUE
                ORDER BY LENGTH(model_pattern) DESC
                LIMIT 1
            """)
            result = self.db.execute(query, {"model": model})
            row = result.fetchone()

            if row:
                return row.multiplier
        except Exception as e:
            logger.warning(f"Failed to get model multiplier from model_pricing: {e}")

        # Try ai_models table (DB-backed model registry)
        try:
            query = text("""
                SELECT credit_multiplier, is_free
                FROM ai_models
                WHERE model_id = :model_id AND is_active = TRUE
                LIMIT 1
            """)
            result = self.db.execute(query, {"model_id": model})
            row = result.fetchone()

            if row:
                if row.is_free:
                    return Decimal("0")
                return Decimal(str(row.credit_multiplier)) if row.credit_multiplier else Decimal("1.0")
        except Exception as e:
            logger.warning(f"Failed to get model multiplier from ai_models: {e}")

        # Fallback to in-code mapping
        model_lower = model.lower()
        for pattern, tier in MODEL_TIER_MAPPING.items():
            if pattern in model_lower:
                return MODEL_TIER_MULTIPLIERS[tier]

        # Default to standard tier
        return Decimal("1.0")

    # ========================================================================
    # Alert Management
    # ========================================================================

    def _check_and_create_alerts(
        self, 
        institute_id: str, 
        current_balance: Decimal, 
        threshold: Decimal
    ) -> None:
        """Check and create alerts if needed."""
        alert_type = None
        
        if current_balance <= 0:
            alert_type = AlertType.ZERO_BALANCE
        elif current_balance < threshold:
            alert_type = AlertType.LOW_BALANCE
        
        if not alert_type:
            return
        
        # Check if we already have an unacknowledged alert of this type
        try:
            check_query = text("""
                SELECT id FROM credit_alerts
                WHERE institute_id = :institute_id 
                AND alert_type = :alert_type 
                AND acknowledged = FALSE
                LIMIT 1
            """)
            result = self.db.execute(check_query, {
                "institute_id": institute_id,
                "alert_type": alert_type.value,
            })
            existing = result.fetchone()
            
            if existing:
                return  # Don't create duplicate alerts
            
            # Create new alert
            insert_alert = text("""
                INSERT INTO credit_alerts (id, institute_id, alert_type, threshold_value, current_balance, created_at)
                VALUES (:id, :institute_id, :alert_type, :threshold, :balance, :now)
            """)
            self.db.execute(insert_alert, {
                "id": str(uuid4()),
                "institute_id": institute_id,
                "alert_type": alert_type.value,
                "threshold": threshold,
                "balance": current_balance,
                "now": datetime.utcnow(),
            })
            
            logger.warning(f"Credit alert created for institute {institute_id}: {alert_type.value}")
            
            # TODO: Send email/push notification for low balance alert
            
        except Exception as e:
            logger.error(f"Failed to create credit alert: {e}")

    def get_pending_alerts(self, limit: int = 100) -> AlertsListResponse:
        """Get all pending (unacknowledged) alerts."""
        query = text("""
            SELECT id, institute_id, alert_type, threshold_value, current_balance,
                   acknowledged, acknowledged_by, acknowledged_at, created_at
            FROM credit_alerts
            WHERE acknowledged = FALSE
            ORDER BY created_at DESC
            LIMIT :limit
        """)
        result = self.db.execute(query, {"limit": limit})
        rows = result.fetchall()
        
        alerts = [
            CreditAlertResponse(
                id=str(row.id),
                institute_id=row.institute_id,
                alert_type=row.alert_type,
                threshold_value=row.threshold_value,
                current_balance=row.current_balance,
                acknowledged=row.acknowledged,
                acknowledged_by=row.acknowledged_by,
                acknowledged_at=row.acknowledged_at,
                created_at=row.created_at,
            )
            for row in rows
        ]
        
        return AlertsListResponse(alerts=alerts, total_count=len(alerts))

    def acknowledge_alert(self, alert_id: str, acknowledged_by: str) -> bool:
        """Acknowledge an alert."""
        update_query = text("""
            UPDATE credit_alerts
            SET acknowledged = TRUE, acknowledged_by = :by, acknowledged_at = :now
            WHERE id = :id
        """)
        self.db.execute(update_query, {
            "id": alert_id,
            "by": acknowledged_by,
            "now": datetime.utcnow(),
        })
        self.db.commit()
        return True

    # ========================================================================
    # Per-user usage (Phase 3 attribution read side)
    # ========================================================================

    def get_usage_by_user(self, institute_id: str, days: int = 30) -> dict:
        """Per-user credit consumption for an institute (admin + learner).

        Net of refunds via SUM(USAGE_DEDUCTION) - SUM(REFUND) so the legacy
        mixed REFUND sign convention can't skew the totals. Uses
        COALESCE(subject_user_id, user_id) so credits spent ON a learner
        (e.g. evaluating their paper, where the actor is the teacher) attribute
        to the learner. Only rows written since V323 carry user_id.
        """
        since = datetime.utcnow() - timedelta(days=days)
        query = text("""
            SELECT COALESCE(subject_user_id, user_id) AS uid,
                   (array_agg(user_role ORDER BY created_at DESC)
                        FILTER (WHERE user_role IS NOT NULL))[1] AS user_role,
                   COUNT(*) FILTER (WHERE transaction_type = 'USAGE_DEDUCTION') AS request_count,
                   COALESCE(SUM(
                       CASE WHEN transaction_type = 'USAGE_DEDUCTION' THEN ABS(amount)
                            WHEN transaction_type = 'REFUND' THEN -ABS(amount)
                            ELSE 0 END), 0) AS net_credits
            FROM credit_transactions
            WHERE institute_id = :institute_id
              AND COALESCE(subject_user_id, user_id) IS NOT NULL
              AND created_at >= :since
            GROUP BY COALESCE(subject_user_id, user_id)
            ORDER BY net_credits DESC
        """)
        rows = self.db.execute(query, {"institute_id": institute_id, "since": since}).fetchall()
        by_user = [
            {
                "user_id": row.uid,
                "user_role": row.user_role,
                "request_count": int(row.request_count or 0),
                "total_credits": float(row.net_credits or 0),
            }
            for row in rows
        ]
        return {"institute_id": institute_id, "period_days": days, "by_user": by_user}

    # ========================================================================
    # Transaction History
    # ========================================================================

    def get_transaction_history(
        self, 
        institute_id: str, 
        request: TransactionHistoryRequest
    ) -> TransactionHistoryResponse:
        """Get paginated transaction history for an institute."""
        offset = (request.page - 1) * request.page_size
        
        # Get total count
        count_query = text("""
            SELECT COUNT(*) FROM credit_transactions
            WHERE institute_id = :institute_id
        """)
        count_result = self.db.execute(count_query, {"institute_id": institute_id})
        total_count = count_result.scalar() or 0
        
        # Get page of transactions
        select_query = text("""
            SELECT id, institute_id, transaction_type, amount, balance_after,
                   description, request_type, model_name, granted_by,
                   user_id, user_role, subject_user_id, created_at
            FROM credit_transactions
            WHERE institute_id = :institute_id
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
        """)

        result = self.db.execute(select_query, {
            "institute_id": institute_id,
            "limit": request.page_size,
            "offset": offset,
        })
        rows = result.fetchall()

        transactions = [
            CreditTransactionResponse(
                id=str(row.id),
                institute_id=row.institute_id,
                transaction_type=row.transaction_type,
                amount=row.amount,
                balance_after=row.balance_after,
                description=row.description,
                request_type=row.request_type,
                model_name=row.model_name,
                granted_by=row.granted_by,
                user_id=getattr(row, "user_id", None),
                user_role=getattr(row, "user_role", None),
                subject_user_id=getattr(row, "subject_user_id", None),
                created_at=row.created_at,
            )
            for row in rows
        ]
        
        total_pages = (total_count + request.page_size - 1) // request.page_size if total_count > 0 else 0
        
        return TransactionHistoryResponse(
            transactions=transactions,
            total_count=total_count,
            page=request.page,
            page_size=request.page_size,
            total_pages=total_pages,
        )

    # ========================================================================
    # Usage Analytics
    # ========================================================================

    def get_usage_analytics(
        self, 
        institute_id: str, 
        days: int = 30
    ) -> UsageAnalyticsResponse:
        """Get usage analytics for an institute."""
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Get usage by request type
        by_type_query = text("""
            SELECT request_type, COUNT(*) as total_requests, 
                   COALESCE(SUM(ABS(amount)), 0) as total_credits
            FROM credit_transactions
            WHERE institute_id = :institute_id
            AND transaction_type = 'USAGE_DEDUCTION'
            AND created_at >= :start_date AND created_at <= :end_date
            GROUP BY request_type
            ORDER BY total_credits DESC
        """)
        type_result = self.db.execute(by_type_query, {
            "institute_id": institute_id,
            "start_date": start_date,
            "end_date": end_date,
        })
        type_rows = type_result.fetchall()
        
        total_credits = sum(row.total_credits for row in type_rows) or Decimal("1")
        by_request_type = [
            UsageBreakdownItem(
                request_type=row.request_type or "unknown",
                total_requests=row.total_requests,
                total_credits=row.total_credits,
                percentage=(row.total_credits / total_credits * 100).quantize(Decimal("0.01")) if total_credits else Decimal("0"),
            )
            for row in type_rows
        ]
        
        # Get usage by day
        by_day_query = text("""
            SELECT DATE(created_at) as date, COUNT(*) as total_requests,
                   COALESCE(SUM(ABS(amount)), 0) as total_credits
            FROM credit_transactions
            WHERE institute_id = :institute_id
            AND transaction_type = 'USAGE_DEDUCTION'
            AND created_at >= :start_date AND created_at <= :end_date
            GROUP BY DATE(created_at)
            ORDER BY date
        """)
        day_result = self.db.execute(by_day_query, {
            "institute_id": institute_id,
            "start_date": start_date,
            "end_date": end_date,
        })
        day_rows = day_result.fetchall()
        
        by_day = [
            UsageByDayItem(
                date=str(row.date),
                total_requests=row.total_requests,
                total_credits=row.total_credits,
            )
            for row in day_rows
        ]
        
        # Get top models
        models_query = text("""
            SELECT model_name, COUNT(*) as count, COALESCE(SUM(ABS(amount)), 0) as total_credits
            FROM credit_transactions
            WHERE institute_id = :institute_id
            AND transaction_type = 'USAGE_DEDUCTION'
            AND created_at >= :start_date AND created_at <= :end_date
            AND model_name IS NOT NULL
            GROUP BY model_name
            ORDER BY total_credits DESC
            LIMIT 5
        """)
        models_result = self.db.execute(models_query, {
            "institute_id": institute_id,
            "start_date": start_date,
            "end_date": end_date,
        })
        models_rows = models_result.fetchall()
        
        top_models = [
            {"model": row.model_name, "requests": row.count, "credits": float(row.total_credits)}
            for row in models_rows
        ]
        
        total_requests = sum(row.total_requests for row in type_rows)
        
        return UsageAnalyticsResponse(
            institute_id=institute_id,
            period_start=start_date,
            period_end=end_date,
            total_requests=total_requests,
            total_credits_used=total_credits if total_credits != Decimal("1") else Decimal("0"),
            by_request_type=by_request_type,
            by_day=by_day,
            top_models=top_models,
        )

    def get_usage_forecast(self, institute_id: str) -> UsageForecastResponse:
        """Get usage forecast and projected credit burndown."""
        balance = self.get_balance(institute_id)
        if not balance:
            return UsageForecastResponse(
                institute_id=institute_id,
                current_balance=Decimal("0"),
                average_daily_usage=Decimal("0"),
                estimated_days_remaining=None,
                projected_zero_date=None,
                recommendation="No credit data available",
            )
        
        # Calculate average daily usage over last 30 days
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        usage_query = text("""
            SELECT COALESCE(SUM(ABS(amount)), 0) as total_usage,
                   COUNT(DISTINCT DATE(created_at)) as days_with_usage
            FROM credit_transactions
            WHERE institute_id = :institute_id
            AND transaction_type = 'USAGE_DEDUCTION'
            AND created_at >= :start_date
        """)
        result = self.db.execute(usage_query, {
            "institute_id": institute_id,
            "start_date": thirty_days_ago,
        })
        row = result.fetchone()
        
        total_usage = row.total_usage or Decimal("0")
        days_with_usage = row.days_with_usage or 1
        
        # Calculate average
        avg_daily = (total_usage / Decimal(str(max(days_with_usage, 1)))).quantize(Decimal("0.01"))
        
        # Project when credits will run out
        if avg_daily > 0:
            days_remaining = int(balance.current_balance / avg_daily)
            projected_date = (datetime.utcnow() + timedelta(days=days_remaining)).strftime("%Y-%m-%d")
        else:
            days_remaining = None
            projected_date = None
        
        # Generate recommendation
        if balance.current_balance <= 0:
            recommendation = "⚠️ Credits exhausted. Please add more credits to continue using AI features."
        elif days_remaining and days_remaining <= 7:
            recommendation = f"⚠️ Low credits! Estimated to run out in {days_remaining} days. Consider adding more credits."
        elif days_remaining and days_remaining <= 14:
            recommendation = f"Credits running low. Estimated {days_remaining} days remaining at current usage."
        else:
            recommendation = "Credit balance is healthy."
        
        return UsageForecastResponse(
            institute_id=institute_id,
            current_balance=balance.current_balance,
            average_daily_usage=avg_daily,
            estimated_days_remaining=days_remaining,
            projected_zero_date=projected_date,
            recommendation=recommendation,
        )

    # ========================================================================
    # Pricing Management
    # ========================================================================

    def get_all_pricing(self) -> AllPricingResponse:
        """Get all pricing configurations."""
        # Get request type pricing
        try:
            pricing_query = text("""
                SELECT request_type, base_cost, token_rate, minimum_charge, unit_type, description, is_active
                FROM credit_pricing
                ORDER BY request_type
            """)
            pricing_result = self.db.execute(pricing_query)
            pricing_rows = pricing_result.fetchall()
            
            request_types = [
                PricingConfigResponse(
                    request_type=row.request_type,
                    base_cost=row.base_cost,
                    token_rate=row.token_rate,
                    minimum_charge=row.minimum_charge,
                    unit_type=row.unit_type,
                    description=row.description,
                    is_active=row.is_active,
                )
                for row in pricing_rows
            ]
        except Exception as e:
            logger.warning(f"Failed to get pricing from DB: {e}")
            request_types = []
        
        # Get model tier pricing
        try:
            model_query = text("""
                SELECT model_pattern, tier, multiplier, description, is_active
                FROM model_pricing
                ORDER BY tier, model_pattern
            """)
            model_result = self.db.execute(model_query)
            model_rows = model_result.fetchall()
            
            model_tiers = [
                ModelPricingResponse(
                    model_pattern=row.model_pattern,
                    tier=row.tier,
                    multiplier=row.multiplier,
                    description=row.description,
                    is_active=row.is_active,
                )
                for row in model_rows
            ]
        except Exception as e:
            logger.warning(f"Failed to get model pricing from DB: {e}")
            model_tiers = []
        
        return AllPricingResponse(
            request_types=request_types,
            model_tiers=model_tiers,
        )
