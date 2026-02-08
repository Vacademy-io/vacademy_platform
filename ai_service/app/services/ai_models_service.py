"""
AI Models Service - Business logic for the centralized model registry.

This service handles:
- Retrieving models from the database
- Filtering by tier, provider, use case
- Managing default models per use case
- Updating model pricing and free tier status
"""

import logging
from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.schemas.ai_models import (
    AIModelResponse,
    AIModelSummary,
    ModelsListResponse,
    ModelsForUseCaseResponse,
    FreeModelsResponse,
    UseCaseDefaultResponse,
    AllUseCaseDefaultsResponse,
    CreateModelRequest,
    UpdateModelRequest,
    UpdateFreeTierRequest,
    UpdateUseCaseDefaultRequest,
    ProviderStats,
    ProvidersListResponse,
    TierStats,
    TiersListResponse,
)

logger = logging.getLogger(__name__)


class AIModelsService:
    """Service for managing the AI models registry."""

    def __init__(self, db: Session):
        self.db = db

    # ========================================================================
    # Model Retrieval
    # ========================================================================

    def get_all_models(
        self,
        tier: Optional[str] = None,
        provider: Optional[str] = None,
        category: Optional[str] = None,
        is_free: Optional[bool] = None,
        use_case: Optional[str] = None,
        active_only: bool = True,
    ) -> ModelsListResponse:
        """Get all models with optional filtering."""
        conditions = []
        params = {}
        
        if active_only:
            conditions.append("is_active = TRUE")
        
        if tier:
            conditions.append("tier = :tier")
            params["tier"] = tier
        
        if provider:
            conditions.append("LOWER(provider) = LOWER(:provider)")
            params["provider"] = provider
        
        if category:
            conditions.append("category = :category")
            params["category"] = category
        
        if is_free is not None:
            conditions.append("is_free = :is_free")
            params["is_free"] = is_free
        
        if use_case:
            conditions.append(":use_case = ANY(recommended_for)")
            params["use_case"] = use_case
        
        where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
        
        query = text(f"""
            SELECT model_id, name, provider, category, tier,
                   max_tokens, context_window, supports_streaming, supports_images,
                   supports_function_calling, supports_json_mode,
                   input_price_per_1m, output_price_per_1m, credit_multiplier,
                   is_free, recommended_for, quality_score, speed_score,
                   is_active, is_default, is_default_free, description
            FROM ai_models
            {where_clause}
            ORDER BY display_order, name
        """)
        
        result = self.db.execute(query, params)
        rows = result.fetchall()
        
        models = []
        free_count = 0
        paid_count = 0
        
        for row in rows:
            model = AIModelResponse(
                model_id=row.model_id,
                name=row.name,
                provider=row.provider,
                category=row.category,
                tier=row.tier,
                max_tokens=row.max_tokens,
                context_window=row.context_window,
                supports_streaming=row.supports_streaming,
                supports_images=row.supports_images,
                supports_function_calling=row.supports_function_calling,
                supports_json_mode=row.supports_json_mode,
                input_price_per_1m=row.input_price_per_1m,
                output_price_per_1m=row.output_price_per_1m,
                credit_multiplier=row.credit_multiplier,
                is_free=row.is_free,
                recommended_for=row.recommended_for,
                quality_score=row.quality_score,
                speed_score=row.speed_score,
                is_active=row.is_active,
                is_default=row.is_default,
                is_default_free=row.is_default_free,
                description=row.description,
            )
            models.append(model)
            
            if row.is_free:
                free_count += 1
            else:
                paid_count += 1
        
        return ModelsListResponse(
            models=models,
            total=len(models),
            free_count=free_count,
            paid_count=paid_count,
        )

    def get_model_by_id(self, model_id: str) -> Optional[AIModelResponse]:
        """Get a specific model by ID."""
        query = text("""
            SELECT model_id, name, provider, category, tier,
                   max_tokens, context_window, supports_streaming, supports_images,
                   supports_function_calling, supports_json_mode,
                   input_price_per_1m, output_price_per_1m, credit_multiplier,
                   is_free, recommended_for, quality_score, speed_score,
                   is_active, is_default, is_default_free, description
            FROM ai_models
            WHERE model_id = :model_id
        """)
        
        result = self.db.execute(query, {"model_id": model_id})
        row = result.fetchone()
        
        if not row:
            return None
        
        return AIModelResponse(
            model_id=row.model_id,
            name=row.name,
            provider=row.provider,
            category=row.category,
            tier=row.tier,
            max_tokens=row.max_tokens,
            context_window=row.context_window,
            supports_streaming=row.supports_streaming,
            supports_images=row.supports_images,
            supports_function_calling=row.supports_function_calling,
            supports_json_mode=row.supports_json_mode,
            input_price_per_1m=row.input_price_per_1m,
            output_price_per_1m=row.output_price_per_1m,
            credit_multiplier=row.credit_multiplier,
            is_free=row.is_free,
            recommended_for=row.recommended_for,
            quality_score=row.quality_score,
            speed_score=row.speed_score,
            is_active=row.is_active,
            is_default=row.is_default,
            is_default_free=row.is_default_free,
            description=row.description,
        )

    def get_free_models(self) -> FreeModelsResponse:
        """Get all currently active free models."""
        query = text("""
            SELECT model_id, name, provider, tier, is_free, 
                   quality_score, speed_score, description
            FROM ai_models
            WHERE is_free = TRUE AND is_active = TRUE
            ORDER BY display_order, quality_score DESC
        """)
        
        result = self.db.execute(query)
        rows = result.fetchall()
        
        models = [
            AIModelSummary(
                model_id=row.model_id,
                name=row.name,
                provider=row.provider,
                tier=row.tier,
                is_free=row.is_free,
                quality_score=row.quality_score,
                speed_score=row.speed_score,
                description=row.description,
            )
            for row in rows
        ]
        
        return FreeModelsResponse(
            models=models,
            count=len(models),
            last_updated=datetime.utcnow(),
        )

    # ========================================================================
    # Use Case Defaults
    # ========================================================================

    def get_models_for_use_case(self, use_case: str) -> ModelsForUseCaseResponse:
        """Get models recommended for a specific use case."""
        # Get use case defaults
        defaults_query = text("""
            SELECT default_model_id, fallback_model_id, free_tier_model_id, description
            FROM ai_model_defaults
            WHERE use_case = :use_case
        """)
        defaults_result = self.db.execute(defaults_query, {"use_case": use_case})
        defaults_row = defaults_result.fetchone()
        
        # Get recommended models
        rec_query = text("""
            SELECT model_id, name, provider, tier, is_free, 
                   quality_score, speed_score, description
            FROM ai_models
            WHERE :use_case = ANY(recommended_for) AND is_active = TRUE
            ORDER BY quality_score DESC, speed_score DESC
        """)
        rec_result = self.db.execute(rec_query, {"use_case": use_case})
        rec_rows = rec_result.fetchall()
        
        recommended_models = [
            AIModelSummary(
                model_id=row.model_id,
                name=row.name,
                provider=row.provider,
                tier=row.tier,
                is_free=row.is_free,
                quality_score=row.quality_score,
                speed_score=row.speed_score,
                description=row.description,
            )
            for row in rec_rows
        ]
        
        # Get all active models (for "all compatible")
        all_models = self.get_all_models(active_only=True)
        all_compatible = [
            AIModelSummary(
                model_id=m.model_id,
                name=m.name,
                provider=m.provider,
                tier=m.tier,
                is_free=m.is_free,
                quality_score=m.quality_score,
                speed_score=m.speed_score,
                description=m.description,
            )
            for m in all_models.models
        ]
        
        # Get specific model details
        default_model = None
        fallback_model = None
        free_tier_model = None
        
        if defaults_row:
            if defaults_row.default_model_id:
                default_model = self._get_model_summary(defaults_row.default_model_id)
            if defaults_row.fallback_model_id:
                fallback_model = self._get_model_summary(defaults_row.fallback_model_id)
            if defaults_row.free_tier_model_id:
                free_tier_model = self._get_model_summary(defaults_row.free_tier_model_id)
        
        # If no defaults, use first recommended
        if not default_model and recommended_models:
            default_model = recommended_models[0]
        
        return ModelsForUseCaseResponse(
            use_case=use_case,
            default_model=default_model,
            fallback_model=fallback_model,
            free_tier_model=free_tier_model,
            recommended_models=recommended_models,
            all_compatible_models=all_compatible,
        )

    def _get_model_summary(self, model_id: str) -> Optional[AIModelSummary]:
        """Get a model summary by ID."""
        query = text("""
            SELECT model_id, name, provider, tier, is_free, 
                   quality_score, speed_score, description
            FROM ai_models
            WHERE model_id = :model_id
        """)
        result = self.db.execute(query, {"model_id": model_id})
        row = result.fetchone()
        
        if not row:
            return None
        
        return AIModelSummary(
            model_id=row.model_id,
            name=row.name,
            provider=row.provider,
            tier=row.tier,
            is_free=row.is_free,
            quality_score=row.quality_score,
            speed_score=row.speed_score,
            description=row.description,
        )

    def get_all_use_case_defaults(self) -> AllUseCaseDefaultsResponse:
        """Get defaults for all use cases."""
        query = text("""
            SELECT use_case, default_model_id, fallback_model_id, 
                   free_tier_model_id, description
            FROM ai_model_defaults
            ORDER BY use_case
        """)
        
        result = self.db.execute(query)
        rows = result.fetchall()
        
        defaults = [
            UseCaseDefaultResponse(
                use_case=row.use_case,
                default_model_id=row.default_model_id,
                fallback_model_id=row.fallback_model_id,
                free_tier_model_id=row.free_tier_model_id,
                description=row.description,
            )
            for row in rows
        ]
        
        return AllUseCaseDefaultsResponse(defaults=defaults)

    # ========================================================================
    # Provider/Tier Stats
    # ========================================================================

    def get_providers(self) -> ProvidersListResponse:
        """Get list of providers with model counts."""
        query = text("""
            SELECT provider, 
                   COUNT(*) as total,
                   SUM(CASE WHEN is_free THEN 1 ELSE 0 END) as free_count,
                   SUM(CASE WHEN NOT is_free THEN 1 ELSE 0 END) as paid_count
            FROM ai_models
            WHERE is_active = TRUE
            GROUP BY provider
            ORDER BY total DESC
        """)
        
        result = self.db.execute(query)
        rows = result.fetchall()
        
        providers = [
            ProviderStats(
                provider=row.provider,
                total_models=row.total,
                free_models=row.free_count,
                paid_models=row.paid_count,
            )
            for row in rows
        ]
        
        return ProvidersListResponse(
            providers=providers,
            total_providers=len(providers),
        )

    def get_tiers(self) -> TiersListResponse:
        """Get list of tiers with stats."""
        query = text("""
            SELECT tier, 
                   COUNT(*) as count,
                   AVG(input_price_per_1m) as avg_input,
                   AVG(output_price_per_1m) as avg_output
            FROM ai_models
            WHERE is_active = TRUE
            GROUP BY tier
            ORDER BY 
                CASE tier 
                    WHEN 'free' THEN 1 
                    WHEN 'standard' THEN 2 
                    WHEN 'premium' THEN 3 
                    WHEN 'ultra' THEN 4 
                    ELSE 5 
                END
        """)
        
        result = self.db.execute(query)
        rows = result.fetchall()
        
        tiers = [
            TierStats(
                tier=row.tier,
                count=row.count,
                avg_input_price=row.avg_input,
                avg_output_price=row.avg_output,
            )
            for row in rows
        ]
        
        return TiersListResponse(tiers=tiers)

    # ========================================================================
    # Admin Functions
    # ========================================================================

    def create_model(self, request: CreateModelRequest) -> AIModelResponse:
        """Create a new model in the registry."""
        model_id = str(uuid4())
        now = datetime.utcnow()
        
        insert_query = text("""
            INSERT INTO ai_models (
                id, model_id, name, provider, category, tier,
                max_tokens, context_window, supports_streaming, supports_images,
                input_price_per_1m, output_price_per_1m, credit_multiplier,
                is_free, recommended_for, quality_score, speed_score,
                description, display_order, created_at, updated_at
            ) VALUES (
                :id, :model_id, :name, :provider, :category, :tier,
                :max_tokens, :context_window, :supports_streaming, :supports_images,
                :input_price_per_1m, :output_price_per_1m, :credit_multiplier,
                :is_free, :recommended_for, :quality_score, :speed_score,
                :description, :display_order, :now, :now
            )
        """)
        
        self.db.execute(insert_query, {
            "id": model_id,
            "model_id": request.model_id,
            "name": request.name,
            "provider": request.provider,
            "category": request.category,
            "tier": request.tier,
            "max_tokens": request.max_tokens,
            "context_window": request.context_window,
            "supports_streaming": request.supports_streaming,
            "supports_images": request.supports_images,
            "input_price_per_1m": request.input_price_per_1m,
            "output_price_per_1m": request.output_price_per_1m,
            "credit_multiplier": request.credit_multiplier,
            "is_free": request.is_free,
            "recommended_for": request.recommended_for,
            "quality_score": request.quality_score,
            "speed_score": request.speed_score,
            "description": request.description,
            "display_order": request.display_order,
            "now": now,
        })
        
        self.db.commit()
        
        logger.info(f"Created new model: {request.model_id}")
        return self.get_model_by_id(request.model_id)

    def update_model(self, model_id: str, request: UpdateModelRequest) -> Optional[AIModelResponse]:
        """Update an existing model."""
        updates = []
        params = {"model_id": model_id, "now": datetime.utcnow()}
        
        if request.name is not None:
            updates.append("name = :name")
            params["name"] = request.name
        if request.tier is not None:
            updates.append("tier = :tier")
            params["tier"] = request.tier
        if request.is_free is not None:
            updates.append("is_free = :is_free")
            params["is_free"] = request.is_free
        if request.is_active is not None:
            updates.append("is_active = :is_active")
            params["is_active"] = request.is_active
        if request.input_price_per_1m is not None:
            updates.append("input_price_per_1m = :input_price")
            params["input_price"] = request.input_price_per_1m
        if request.output_price_per_1m is not None:
            updates.append("output_price_per_1m = :output_price")
            params["output_price"] = request.output_price_per_1m
        if request.credit_multiplier is not None:
            updates.append("credit_multiplier = :multiplier")
            params["multiplier"] = request.credit_multiplier
        if request.quality_score is not None:
            updates.append("quality_score = :quality")
            params["quality"] = request.quality_score
        if request.speed_score is not None:
            updates.append("speed_score = :speed")
            params["speed"] = request.speed_score
        if request.recommended_for is not None:
            updates.append("recommended_for = :recommended")
            params["recommended"] = request.recommended_for
        if request.description is not None:
            updates.append("description = :description")
            params["description"] = request.description
        if request.display_order is not None:
            updates.append("display_order = :order")
            params["order"] = request.display_order
        
        if not updates:
            return self.get_model_by_id(model_id)
        
        updates.append("updated_at = :now")
        
        update_query = text(f"""
            UPDATE ai_models
            SET {", ".join(updates)}
            WHERE model_id = :model_id
        """)
        
        self.db.execute(update_query, params)
        self.db.commit()
        
        logger.info(f"Updated model: {model_id}")
        return self.get_model_by_id(model_id)

    def update_free_tier(self, request: UpdateFreeTierRequest) -> FreeModelsResponse:
        """Update which models are in the free tier."""
        now = datetime.utcnow()
        
        # First, remove free status from all models
        reset_query = text("""
            UPDATE ai_models
            SET is_free = FALSE, tier = 'standard', updated_at = :now
            WHERE is_free = TRUE
        """)
        self.db.execute(reset_query, {"now": now})
        
        # Then, mark the specified models as free
        for model_id in request.model_ids:
            update_query = text("""
                UPDATE ai_models
                SET is_free = TRUE, tier = 'free', updated_at = :now
                WHERE model_id = :model_id
            """)
            self.db.execute(update_query, {"model_id": model_id, "now": now})
        
        self.db.commit()
        
        logger.info(f"Updated free tier models: {request.model_ids}")
        return self.get_free_models()

    def update_use_case_default(
        self, 
        use_case: str, 
        request: UpdateUseCaseDefaultRequest
    ) -> UseCaseDefaultResponse:
        """Update defaults for a use case."""
        updates = []
        params = {"use_case": use_case, "now": datetime.utcnow()}
        
        if request.default_model_id is not None:
            updates.append("default_model_id = :default")
            params["default"] = request.default_model_id
        if request.fallback_model_id is not None:
            updates.append("fallback_model_id = :fallback")
            params["fallback"] = request.fallback_model_id
        if request.free_tier_model_id is not None:
            updates.append("free_tier_model_id = :free")
            params["free"] = request.free_tier_model_id
        
        if updates:
            updates.append("updated_at = :now")
            update_query = text(f"""
                UPDATE ai_model_defaults
                SET {", ".join(updates)}
                WHERE use_case = :use_case
            """)
            self.db.execute(update_query, params)
            self.db.commit()
        
        # Fetch updated record
        query = text("""
            SELECT use_case, default_model_id, fallback_model_id, 
                   free_tier_model_id, description
            FROM ai_model_defaults
            WHERE use_case = :use_case
        """)
        result = self.db.execute(query, {"use_case": use_case})
        row = result.fetchone()
        
        return UseCaseDefaultResponse(
            use_case=row.use_case,
            default_model_id=row.default_model_id,
            fallback_model_id=row.fallback_model_id,
            free_tier_model_id=row.free_tier_model_id,
            description=row.description,
        )

    # ========================================================================
    # Helper for Credit System Integration
    # ========================================================================

    def get_credit_multiplier(self, model_id: str) -> Decimal:
        """Get the credit multiplier for a model (for credit calculations)."""
        query = text("""
            SELECT credit_multiplier, is_free
            FROM ai_models
            WHERE model_id = :model_id AND is_active = TRUE
        """)
        
        result = self.db.execute(query, {"model_id": model_id})
        row = result.fetchone()
        
        if row:
            if row.is_free:
                return Decimal("0")  # Free models have 0 multiplier
            return row.credit_multiplier
        
        # Default to standard tier if not found
        return Decimal("1.0")
