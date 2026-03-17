"""
AI Models Schemas - Pydantic models for the centralized model registry.

These schemas define the API contracts for:
- Listing available AI models
- Getting model details
- Getting use case defaults
- Managing models (admin only)
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field


class ModelTierEnum(str, Enum):
    """Model pricing tiers."""
    FREE = "free"
    STANDARD = "standard"
    PREMIUM = "premium"
    ULTRA = "ultra"


class ModelCategoryEnum(str, Enum):
    """Model categories by use case."""
    GENERAL = "general"
    CODING = "coding"
    VISION = "vision"
    EMBEDDING = "embedding"
    IMAGE = "image"
    TTS = "tts"
    REASONING = "reasoning"


class UseCaseEnum(str, Enum):
    """AI use cases for model selection."""
    CONTENT = "content"
    OUTLINE = "outline"
    VIDEO = "video"
    IMAGE = "image"
    EVALUATION = "evaluation"
    EMBEDDING = "embedding"
    COPILOT = "copilot"
    AGENT = "agent"
    ANALYTICS = "analytics"
    TTS = "tts"


# ============================================================================
# Model Response Schemas
# ============================================================================

class AIModelResponse(BaseModel):
    """Complete AI model information."""
    model_id: str
    name: str
    provider: str
    category: str
    tier: str
    
    # Capabilities
    max_tokens: Optional[int] = None
    context_window: Optional[int] = None
    supports_streaming: bool = True
    supports_images: bool = False
    supports_function_calling: bool = False
    supports_json_mode: bool = False
    
    # Pricing (per 1M tokens, USD)
    input_price_per_1m: Optional[Decimal] = None
    output_price_per_1m: Optional[Decimal] = None
    
    # Credit system
    credit_multiplier: Decimal = Decimal("1.0")
    is_free: bool = False
    
    # Recommendations
    recommended_for: Optional[List[str]] = None
    quality_score: int = 3
    speed_score: int = 3
    
    # Status
    is_active: bool = True
    is_default: bool = False
    is_default_free: bool = False
    
    # Metadata
    description: Optional[str] = None

    class Config:
        from_attributes = True


class AIModelSummary(BaseModel):
    """Condensed model info for lists."""
    model_id: str
    name: str
    provider: str
    tier: str
    is_free: bool
    quality_score: int
    speed_score: int
    description: Optional[str] = None


class ModelsListResponse(BaseModel):
    """List of AI models."""
    models: List[AIModelResponse]
    total: int
    free_count: int
    paid_count: int


class ModelsForUseCaseResponse(BaseModel):
    """Models recommended for a specific use case."""
    use_case: str
    default_model: AIModelSummary
    fallback_model: Optional[AIModelSummary] = None
    free_tier_model: Optional[AIModelSummary] = None
    recommended_models: List[AIModelSummary]
    all_compatible_models: List[AIModelSummary]


class FreeModelsResponse(BaseModel):
    """List of currently active free models."""
    models: List[AIModelSummary]
    count: int
    last_updated: datetime


# ============================================================================
# Use Case Defaults
# ============================================================================

class UseCaseDefaultResponse(BaseModel):
    """Default models for a use case."""
    use_case: str
    default_model_id: str
    fallback_model_id: Optional[str] = None
    free_tier_model_id: Optional[str] = None
    description: Optional[str] = None


class AllUseCaseDefaultsResponse(BaseModel):
    """All use case defaults."""
    defaults: List[UseCaseDefaultResponse]


# ============================================================================
# Admin Schemas (for managing models)
# ============================================================================

class CreateModelRequest(BaseModel):
    """Request to add a new model."""
    model_id: str = Field(..., description="Unique model identifier (e.g., 'google/gemini-2.5-flash')")
    name: str
    provider: str
    category: str = "general"
    tier: str = "standard"
    
    max_tokens: Optional[int] = None
    context_window: Optional[int] = None
    supports_streaming: bool = True
    supports_images: bool = False
    
    input_price_per_1m: Optional[Decimal] = None
    output_price_per_1m: Optional[Decimal] = None
    credit_multiplier: Decimal = Decimal("1.0")
    
    is_free: bool = False
    recommended_for: Optional[List[str]] = None
    quality_score: int = 3
    speed_score: int = 3
    description: Optional[str] = None
    display_order: int = 100


class UpdateModelRequest(BaseModel):
    """Request to update an existing model."""
    name: Optional[str] = None
    tier: Optional[str] = None
    is_free: Optional[bool] = None
    is_active: Optional[bool] = None
    input_price_per_1m: Optional[Decimal] = None
    output_price_per_1m: Optional[Decimal] = None
    credit_multiplier: Optional[Decimal] = None
    quality_score: Optional[int] = None
    speed_score: Optional[int] = None
    recommended_for: Optional[List[str]] = None
    description: Optional[str] = None
    display_order: Optional[int] = None


class UpdateFreeTierRequest(BaseModel):
    """Request to update free tier models."""
    model_ids: List[str] = Field(..., description="List of model IDs to mark as free")
    

class UpdateUseCaseDefaultRequest(BaseModel):
    """Request to update use case defaults."""
    default_model_id: Optional[str] = None
    fallback_model_id: Optional[str] = None
    free_tier_model_id: Optional[str] = None


# ============================================================================
# Provider Stats
# ============================================================================

class ProviderStats(BaseModel):
    """Stats for a model provider."""
    provider: str
    total_models: int
    free_models: int
    paid_models: int


class ProvidersListResponse(BaseModel):
    """List of providers with stats."""
    providers: List[ProviderStats]
    total_providers: int


class TierStats(BaseModel):
    """Stats for a model tier."""
    tier: str
    count: int
    avg_input_price: Optional[Decimal] = None
    avg_output_price: Optional[Decimal] = None


class TiersListResponse(BaseModel):
    """List of tiers with stats."""
    tiers: List[TierStats]
