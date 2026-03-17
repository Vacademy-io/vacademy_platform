"""
AI Models Registry - Database-backed model registry.

This module provides the single source of truth for AI models.
Models are fetched from the `ai_models` database table.

Fallback: If database is unavailable, uses cached/hardcoded defaults.
"""

from typing import Dict, List, Optional
from enum import Enum
import logging
from decimal import Decimal
from functools import lru_cache
from datetime import datetime

logger = logging.getLogger(__name__)


class ModelCategory(str, Enum):
    """Model categories."""
    FREE = "free"
    PAID = "paid"
    GENERAL = "general"
    CODING = "coding"
    VISION = "vision"
    EMBEDDING = "embedding"
    IMAGE = "image"
    TTS = "tts"


class ModelTier(str, Enum):
    """Model pricing tiers."""
    FREE = "free"
    STANDARD = "standard"
    PREMIUM = "premium"
    ULTRA = "ultra"


class ModelInfo:
    """Information about an AI model."""
    
    def __init__(
        self,
        id: str,
        name: str,
        provider: str,
        category: str = "general",
        tier: str = "standard",
        description: str = "",
        max_tokens: Optional[int] = None,
        context_window: Optional[int] = None,
        supports_streaming: bool = True,
        supports_images: bool = False,
        supports_function_calling: bool = False,
        supports_json_mode: bool = False,
        input_price_per_1m: Optional[float] = None,
        output_price_per_1m: Optional[float] = None,
        credit_multiplier: float = 1.0,
        is_free: bool = False,
        recommended_for: Optional[List[str]] = None,
        quality_score: int = 3,
        speed_score: int = 3,
        is_active: bool = True,
        is_default: bool = False,
        is_default_free: bool = False,
    ):
        self.id = id
        self.name = name
        self.provider = provider
        self.category = category
        self.tier = tier
        self.description = description
        self.max_tokens = max_tokens
        self.context_window = context_window
        self.supports_streaming = supports_streaming
        self.supports_images = supports_images
        self.supports_function_calling = supports_function_calling
        self.supports_json_mode = supports_json_mode
        self.input_price_per_1m = input_price_per_1m
        self.output_price_per_1m = output_price_per_1m
        self.credit_multiplier = credit_multiplier
        self.is_free = is_free
        self.recommended_for = recommended_for or []
        self.quality_score = quality_score
        self.speed_score = speed_score
        self.is_active = is_active
        self.is_default = is_default
        self.is_default_free = is_default_free
    
    def get_input_token_price(self) -> Optional[float]:
        """Get price per input token (converts from per 1M to per token)."""
        if self.input_price_per_1m is None:
            return None
        return self.input_price_per_1m / 1_000_000
    
    def get_output_token_price(self) -> Optional[float]:
        """Get price per output token (converts from per 1M to per token)."""
        if self.output_price_per_1m is None:
            return None
        return self.output_price_per_1m / 1_000_000
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for API responses."""
        return {
            "id": self.id,
            "name": self.name,
            "provider": self.provider,
            "category": self.category,
            "tier": self.tier,
            "description": self.description,
            "max_tokens": self.max_tokens,
            "context_window": self.context_window,
            "supports_streaming": self.supports_streaming,
            "supports_images": self.supports_images,
            "supports_function_calling": self.supports_function_calling,
            "supports_json_mode": self.supports_json_mode,
            "input_price_per_1m": self.input_price_per_1m,
            "output_price_per_1m": self.output_price_per_1m,
            "credit_multiplier": self.credit_multiplier,
            "is_free": self.is_free,
            "input_token_price": self.get_input_token_price(),
            "output_token_price": self.get_output_token_price(),
            "quality_score": self.quality_score,
            "speed_score": self.speed_score,
        }


# ============================================================================
# Database Access Functions
# ============================================================================

def _get_models_from_db() -> List[ModelInfo]:
    """Fetch all models from the database."""
    try:
        from ..db import db_session
        from sqlalchemy import text
        
        with db_session() as session:
            query = text("""
                SELECT model_id, name, provider, category, tier,
                       max_tokens, context_window, supports_streaming, supports_images,
                       supports_function_calling, supports_json_mode,
                       input_price_per_1m, output_price_per_1m, credit_multiplier,
                       is_free, recommended_for, quality_score, speed_score,
                       is_active, is_default, is_default_free, description
                FROM ai_models
                WHERE is_active = TRUE
                ORDER BY display_order, name
            """)
            result = session.execute(query)
            rows = result.fetchall()
            
            models = []
            for row in rows:
                model = ModelInfo(
                    id=row.model_id,
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
                    input_price_per_1m=float(row.input_price_per_1m) if row.input_price_per_1m else None,
                    output_price_per_1m=float(row.output_price_per_1m) if row.output_price_per_1m else None,
                    credit_multiplier=float(row.credit_multiplier) if row.credit_multiplier else 1.0,
                    is_free=row.is_free,
                    recommended_for=row.recommended_for or [],
                    quality_score=row.quality_score,
                    speed_score=row.speed_score,
                    is_active=row.is_active,
                    is_default=row.is_default,
                    is_default_free=row.is_default_free,
                    description=row.description or "",
                )
                models.append(model)
            
            logger.info(f"Loaded {len(models)} models from database")
            return models
            
    except Exception as e:
        logger.warning(f"Failed to load models from database: {e}. Using fallback.")
        return []


def _get_use_case_defaults_from_db() -> Dict[str, Dict[str, str]]:
    """Fetch use case defaults from the database."""
    try:
        from ..db import db_session
        from sqlalchemy import text
        
        with db_session() as session:
            query = text("""
                SELECT use_case, default_model_id, fallback_model_id, free_tier_model_id
                FROM ai_model_defaults
            """)
            result = session.execute(query)
            rows = result.fetchall()
            
            defaults = {}
            for row in rows:
                defaults[row.use_case] = {
                    "default": row.default_model_id,
                    "fallback": row.fallback_model_id,
                    "free": row.free_tier_model_id,
                }
            
            return defaults
            
    except Exception as e:
        logger.warning(f"Failed to load use case defaults from database: {e}")
        return {}


# ============================================================================
# Cached Model Registry
# ============================================================================

# Cache for models (refreshed periodically or on demand)
_models_cache: Optional[List[ModelInfo]] = None
_models_cache_time: Optional[datetime] = None
_CACHE_TTL_SECONDS = 300  # 5 minutes


def _is_cache_valid() -> bool:
    """Check if the cache is still valid."""
    if _models_cache is None or _models_cache_time is None:
        return False
    return (datetime.utcnow() - _models_cache_time).total_seconds() < _CACHE_TTL_SECONDS


def refresh_models_cache() -> List[ModelInfo]:
    """Force refresh the models cache from database."""
    global _models_cache, _models_cache_time
    
    db_models = _get_models_from_db()
    
    if db_models:
        _models_cache = db_models
        _models_cache_time = datetime.utcnow()
        return _models_cache
    
    # Fallback to hardcoded defaults if DB is empty/unavailable
    if _models_cache:
        return _models_cache
    
    _models_cache = _get_fallback_models()
    _models_cache_time = datetime.utcnow()
    return _models_cache


def get_all_models() -> List[ModelInfo]:
    """Get all available models (from cache or database)."""
    if _is_cache_valid():
        return _models_cache
    return refresh_models_cache()


# ============================================================================
# Fallback Models (used when DB is unavailable)
# ============================================================================

def _get_fallback_models() -> List[ModelInfo]:
    """Fallback hardcoded models for when database is unavailable."""
    return [
        # Free tier models
        ModelInfo(
            id="xiaomi/mimo-v2-flash:free",
            name="MIMO v2 Flash (Free)",
            provider="OpenRouter",
            category="general",
            tier="free",
            is_free=True,
            credit_multiplier=0.0,
            is_default_free=True,
            description="Fast free model for general tasks",
        ),
        ModelInfo(
            id="mistralai/devstral-2512:free",
            name="Devstral 2512 (Free)",
            provider="OpenRouter",
            category="coding",
            tier="free",
            is_free=True,
            credit_multiplier=0.0,
            description="Mistral's free model for coding",
        ),
        ModelInfo(
            id="nvidia/nemotron-3-nano-30b-a3b:free",
            name="Nemotron 3 Nano (Free)",
            provider="OpenRouter",
            category="general",
            tier="free",
            is_free=True,
            credit_multiplier=0.0,
            description="NVIDIA's free model",
        ),
        ModelInfo(
            id="google/gemini-2.0-flash-exp:free",
            name="Gemini 2.0 Flash Exp (Free)",
            provider="OpenRouter",
            category="general",
            tier="free",
            is_free=True,
            credit_multiplier=0.0,
            description="Google's experimental flash model (Free)",
        ),
        ModelInfo(
            id="arcee-ai/trinity-large-preview:free",
            name="Trinity Large Preview (Free)",
            provider="OpenRouter",
            category="general",
            tier="free",
            is_free=True,
            credit_multiplier=0.0,
            description="Arcee AI's preview model",
        ),
        ModelInfo(
            id="tngtech/deepseek-r1t2-chimera:free",
            name="DeepSeek R1T2 Chimera (Free)",
            provider="OpenRouter",
            category="reasoning",
            tier="free",
            is_free=True,
            credit_multiplier=0.0,
            description="DeepSeek reasoning model",
        ),
        
        # Standard tier models
        ModelInfo(
            id="google/gemini-2.5-flash",
            name="Gemini 2.5 Flash",
            provider="Google",
            category="general",
            tier="standard",
            is_free=False,
            credit_multiplier=1.0,
            input_price_per_1m=0.3,
            output_price_per_1m=2.5,
            max_tokens=1048576,
            context_window=1048576,
            supports_images=True,
            is_default=True,
            description="Fast Gemini model with great price/performance",
        ),
        ModelInfo(
            id="deepseek/deepseek-v3.2",
            name="DeepSeek V3.2",
            provider="DeepSeek",
            category="general",
            tier="standard",
            is_free=False,
            credit_multiplier=1.0,
            input_price_per_1m=0.25,
            output_price_per_1m=0.38,
            max_tokens=163840,
            context_window=163840,
            description="Great value model with strong reasoning",
        ),
        
        # Premium tier models
        ModelInfo(
            id="google/gemini-2.5-pro",
            name="Gemini 2.5 Pro",
            provider="Google",
            category="general",
            tier="premium",
            is_free=False,
            credit_multiplier=2.0,
            input_price_per_1m=1.25,
            output_price_per_1m=5.0,
            max_tokens=8192,
            context_window=1048576,
            supports_images=True,
            description="Google's most capable Gemini model",
        ),
        ModelInfo(
            id="anthropic/claude-3.5-sonnet",
            name="Claude 3.5 Sonnet",
            provider="Anthropic",
            category="general",
            tier="premium",
            is_free=False,
            credit_multiplier=2.0,
            input_price_per_1m=3.0,
            output_price_per_1m=15.0,
            max_tokens=200000,
            context_window=200000,
            description="Anthropic's balanced model",
        ),
        
        # Ultra tier models
        ModelInfo(
            id="openai/gpt-4o",
            name="GPT-4o",
            provider="OpenAI",
            category="general",
            tier="ultra",
            is_free=False,
            credit_multiplier=4.0,
            input_price_per_1m=5.0,
            output_price_per_1m=15.0,
            max_tokens=128000,
            context_window=128000,
            description="Most capable GPT-4 model",
        ),
    ]


# ============================================================================
# Public API
# ============================================================================

# Lazy-loaded model lists
def _ensure_models_loaded():
    """Ensure models are loaded."""
    if not _is_cache_valid():
        refresh_models_cache()


@property
def ALL_MODELS() -> List[ModelInfo]:
    """Get all models."""
    return get_all_models()


@property  
def FREE_MODELS() -> List[ModelInfo]:
    """Get free tier models."""
    return [m for m in get_all_models() if m.is_free]


@property
def PAID_MODELS() -> List[ModelInfo]:
    """Get paid models."""
    return [m for m in get_all_models() if not m.is_free]


# Convenience functions
def get_model_by_id(model_id: str) -> Optional[ModelInfo]:
    """Get model information by ID."""
    for model in get_all_models():
        if model.id == model_id:
            return model
    return None


def get_models_by_category(category: str) -> List[ModelInfo]:
    """Get all models in a category."""
    return [m for m in get_all_models() if m.category == category]


def get_models_by_tier(tier: str) -> List[ModelInfo]:
    """Get all models in a tier."""
    return [m for m in get_all_models() if m.tier == tier]


def get_models_by_provider(provider: str) -> List[ModelInfo]:
    """Get all models from a provider."""
    return [m for m in get_all_models() if m.provider.lower() == provider.lower()]


def get_free_models() -> List[ModelInfo]:
    """Get all free tier models."""
    return [m for m in get_all_models() if m.is_free]


def get_models_for_use_case(use_case: str) -> List[ModelInfo]:
    """Get models recommended for a use case."""
    return [m for m in get_all_models() if use_case in m.recommended_for]


def get_default_model() -> Optional[ModelInfo]:
    """Get the default model."""
    for model in get_all_models():
        if model.is_default:
            return model
    # Fallback to first standard tier model
    models = get_all_models()
    for m in models:
        if m.tier == "standard":
            return m
    return models[0] if models else None


def get_default_free_model() -> Optional[ModelInfo]:
    """Get the default free model."""
    for model in get_all_models():
        if model.is_default_free:
            return model
    # Fallback to first free model
    free_models = get_free_models()
    return free_models[0] if free_models else None


def get_model_pricing(model_id: str) -> Optional[Dict[str, float]]:
    """Get pricing information for a model."""
    model = get_model_by_id(model_id)
    if not model:
        return None
    
    input_price = model.get_input_token_price()
    output_price = model.get_output_token_price()
    
    if input_price is None or output_price is None:
        return None
    
    return {
        "input_token_price": input_price,
        "output_token_price": output_price,
        "credit_multiplier": model.credit_multiplier,
    }


def get_credit_multiplier(model_id: str) -> float:
    """Get credit multiplier for a model."""
    model = get_model_by_id(model_id)
    if model:
        if model.is_free:
            return 0.0
        return model.credit_multiplier
    return 1.0  # Default to standard


# ============================================================================
# Default Model IDs (for backward compatibility)
# ============================================================================

DEFAULT_MODEL = "google/gemini-2.5-flash"
VIDEO_GENERATION_DEFAULT_MODEL = "google/gemini-2.0-flash-exp:free"


# ============================================================================
# Backward Compatibility - Legacy Lists
# ============================================================================

# These are populated lazily from the database
OPENAI_MODELS: List[ModelInfo] = []
GEMINI_MODELS: List[ModelInfo] = []
OPENROUTER_MODELS: List[ModelInfo] = []
MODELS_BY_ID: Dict[str, ModelInfo] = {}


def _refresh_legacy_lists():
    """Refresh legacy model lists from database."""
    global OPENAI_MODELS, GEMINI_MODELS, OPENROUTER_MODELS, MODELS_BY_ID
    
    all_models = get_all_models()
    
    OPENAI_MODELS = [m for m in all_models if m.provider == "OpenAI"]
    GEMINI_MODELS = [m for m in all_models if m.provider == "Google"]
    OPENROUTER_MODELS = [m for m in all_models if m.provider == "OpenRouter"]
    MODELS_BY_ID = {m.id: m for m in all_models}


# Refresh on module load
try:
    _refresh_legacy_lists()
except Exception as e:
    logger.warning(f"Could not refresh legacy model lists: {e}")


__all__ = [
    "ModelCategory",
    "ModelTier",
    "ModelInfo",
    "get_all_models",
    "get_model_by_id",
    "get_models_by_category",
    "get_models_by_tier",
    "get_models_by_provider",
    "get_free_models",
    "get_models_for_use_case",
    "get_default_model",
    "get_default_free_model",
    "get_model_pricing",
    "get_credit_multiplier",
    "refresh_models_cache",
    "DEFAULT_MODEL",
    "VIDEO_GENERATION_DEFAULT_MODEL",
    # Legacy
    "OPENAI_MODELS",
    "GEMINI_MODELS",
    "OPENROUTER_MODELS",
    "MODELS_BY_ID",
]
