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
from typing import Optional, List
from uuid import uuid4

from sqlalchemy import text
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

INITIAL_CREDITS = Decimal("200")
DEFAULT_LOW_BALANCE_THRESHOLD = Decimal("50")

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

# Default pricing (fallback if DB not configured)
DEFAULT_PRICING = {
    "content": {"base_cost": Decimal("0.5"), "token_rate": Decimal("0.0001"), "min_charge": Decimal("0.5"), "unit": "tokens"},
    "agent": {"base_cost": Decimal("0.5"), "token_rate": Decimal("0.0001"), "min_charge": Decimal("0.5"), "unit": "tokens"},
    "copilot": {"base_cost": Decimal("0.5"), "token_rate": Decimal("0.0001"), "min_charge": Decimal("0.5"), "unit": "tokens"},
    "analytics": {"base_cost": Decimal("0.5"), "token_rate": Decimal("0.0001"), "min_charge": Decimal("0.5"), "unit": "tokens"},
    "outline": {"base_cost": Decimal("0.5"), "token_rate": Decimal("0.0001"), "min_charge": Decimal("0.5"), "unit": "tokens"},
    "evaluation": {"base_cost": Decimal("1.0"), "token_rate": Decimal("0.00015"), "min_charge": Decimal("1.0"), "unit": "tokens"},
    "embedding": {"base_cost": Decimal("0.1"), "token_rate": Decimal("0.00002"), "min_charge": Decimal("0.1"), "unit": "tokens"},
    "image": {"base_cost": Decimal("3.0"), "token_rate": Decimal("0"), "min_charge": Decimal("3.0"), "unit": "none"},
    "video": {"base_cost": Decimal("5.0"), "token_rate": Decimal("0"), "min_charge": Decimal("5.0"), "unit": "none"},
    "tts": {"base_cost": Decimal("0.2"), "token_rate": Decimal("0.0001"), "min_charge": Decimal("0.2"), "unit": "characters"},
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
                                             description, granted_by, created_at)
            VALUES (:id, :institute_id, :type, :amount, :balance, :desc, :granted_by, :now)
        """)
        self.db.execute(insert_txn, {
            "id": transaction_id,
            "institute_id": institute_id,
            "type": TransactionType.ADMIN_GRANT.value,
            "amount": request.amount,
            "balance": new_balance,
            "desc": request.description or "Admin credit grant",
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
    # Credit Check (Pre-flight)
    # ========================================================================

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
        # Calculate actual credits
        credits_to_deduct = self.calculate_credits(
            request_type=request.request_type,
            model=request.model,
            prompt_tokens=request.prompt_tokens,
            completion_tokens=request.completion_tokens,
            character_count=request.character_count,
        )
        
        now = datetime.utcnow()
        transaction_id = str(uuid4())
        
        # Ensure credits exist
        self.ensure_credits_exist(request.institute_id)
        
        # Update balance
        update_query = text("""
            UPDATE institute_credits
            SET used_credits = used_credits + :amount,
                current_balance = current_balance - :amount,
                updated_at = :now
            WHERE institute_id = :institute_id
            RETURNING current_balance, low_balance_threshold
        """)
        result = self.db.execute(update_query, {
            "amount": credits_to_deduct,
            "now": now,
            "institute_id": request.institute_id,
        })
        row = result.fetchone()
        new_balance = row.current_balance if row else Decimal("0")
        threshold = row.low_balance_threshold if row else DEFAULT_LOW_BALANCE_THRESHOLD
        
        # Record transaction
        insert_txn = text("""
            INSERT INTO credit_transactions (id, institute_id, transaction_type, amount, balance_after,
                                             description, reference_id, request_type, model_name, created_at)
            VALUES (:id, :institute_id, :type, :amount, :balance, :desc, :ref_id, :req_type, :model, :now)
        """)
        
        # Handle reference_id conversion
        ref_id = None
        if request.usage_log_id:
            try:
                ref_id = request.usage_log_id
            except Exception:
                pass
        
        self.db.execute(insert_txn, {
            "id": transaction_id,
            "institute_id": request.institute_id,
            "type": TransactionType.USAGE_DEDUCTION.value,
            "amount": -credits_to_deduct,  # Negative for deductions
            "balance": new_balance,
            "desc": f"{request.request_type} using {request.model}",
            "ref_id": ref_id,
            "req_type": request.request_type,
            "model": request.model,
            "now": now,
        })
        
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
    # Credit Calculation
    # ========================================================================

    def calculate_credits(
        self,
        request_type: str,
        model: Optional[str] = None,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        character_count: int = 0,
    ) -> Decimal:
        """
        Calculate credits for an AI operation.
        
        Formula: max(minimum_charge, base_cost + (units × token_rate × model_multiplier))
        """
        # Get pricing from DB or use defaults
        pricing = self._get_pricing(request_type)
        
        # Get model multiplier
        multiplier = self._get_model_multiplier(model)
        
        # Calculate units based on unit type
        if pricing["unit"] == "tokens":
            units = (prompt_tokens + completion_tokens) / 1000
        elif pricing["unit"] == "characters":
            units = character_count / 1000
        else:  # "none" - flat rate
            units = 0
        
        # Apply formula
        calculated = pricing["base_cost"] + (Decimal(str(units)) * pricing["token_rate"] * multiplier)
        
        # Enforce minimum
        result = max(pricing["min_charge"], calculated)
        
        # Round to 4 decimal places
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

    def _get_model_multiplier(self, model: Optional[str]) -> Decimal:
        """Get pricing multiplier for a model."""
        if not model:
            return Decimal("1.0")
        
        # Try to get from DB first
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
            logger.warning(f"Failed to get model multiplier from DB: {e}")
        
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
            WHERE id = :id::uuid
        """)
        self.db.execute(update_query, {
            "id": alert_id,
            "by": acknowledged_by,
            "now": datetime.utcnow(),
        })
        self.db.commit()
        return True

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
                   description, request_type, model_name, granted_by, created_at
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
