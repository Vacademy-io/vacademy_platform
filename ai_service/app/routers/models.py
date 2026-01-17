"""
Router for AI model information endpoints.
"""
from __future__ import annotations

from typing import Optional, List
from fastapi import APIRouter, Query
from pydantic import BaseModel

from ..constants.models import (
    ALL_MODELS,
    FREE_MODELS,
    OPENAI_MODELS,
    GEMINI_MODELS,
    OPENROUTER_MODELS,
    get_model_by_id,
    get_models_by_category,
    get_models_by_provider,
    ModelCategory,
    ModelInfo,
)


router = APIRouter(prefix="/models", tags=["models"])


class ModelResponse(BaseModel):
    """Response model for a single AI model."""
    id: str
    name: str
    provider: str
    category: str
    description: str
    max_tokens: Optional[int] = None
    context_window: Optional[int] = None
    supports_streaming: bool = True
    supports_images: bool = False
    input_price_per_1m: Optional[float] = None
    output_price_per_1m: Optional[float] = None
    input_token_price: Optional[float] = None
    output_token_price: Optional[float] = None


class ModelsListResponse(BaseModel):
    """Response model for list of AI models."""
    models: List[ModelResponse]
    total: int


@router.get(
    "/v1/list",
    response_model=ModelsListResponse,
    summary="Get all available AI models",
)
async def list_models(
    category: Optional[str] = Query(
        default=None,
        description="Filter by category: free, paid, openai, gemini, openrouter"
    ),
    provider: Optional[str] = Query(
        default=None,
        description="Filter by provider: OpenAI, Google, OpenRouter, Anthropic, Meta"
    ),
) -> ModelsListResponse:
    """
    Get a list of all available AI models.
    
    Can be filtered by category or provider.
    Models from this list can be used in outline and content generation APIs.
    """
    models: List[ModelInfo] = ALL_MODELS
    
    # Apply filters
    if category:
        try:
            category_enum = ModelCategory(category.lower())
            models = get_models_by_category(category_enum)
        except ValueError:
            # Invalid category, return empty list
            models = []
    
    if provider:
        models = [m for m in models if m.provider.lower() == provider.lower()]
    
    return ModelsListResponse(
        models=[ModelResponse(**model.to_dict()) for model in models],
        total=len(models),
    )


@router.get(
    "/v1/{model_id}",
    response_model=ModelResponse,
    summary="Get information about a specific model",
)
async def get_model(model_id: str) -> ModelResponse:
    """
    Get detailed information about a specific AI model by ID.
    
    Args:
        model_id: The model identifier (e.g., "openai/gpt-4o-mini", "google/gemini-2.5-pro")
    
    Returns:
        Model information including capabilities and limits
    """
    model = get_model_by_id(model_id)
    if not model:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found")
    
    return ModelResponse(**model.to_dict())


@router.get(
    "/v1/categories",
    summary="Get available model categories",
)
async def get_categories() -> dict:
    """
    Get list of available model categories.
    """
    return {
        "categories": [
            {
                "id": "free",
                "name": "Free Models",
                "description": "Free tier models available through OpenRouter",
                "count": len(FREE_MODELS),
            },
            {
                "id": "paid",
                "name": "Paid Models",
                "description": "Premium models requiring API credits",
                "count": len(OPENAI_MODELS) + len(OPENROUTER_MODELS),
            },
            {
                "id": "openai",
                "name": "OpenAI Models",
                "description": "Models from OpenAI",
                "count": len(OPENAI_MODELS),
            },
            {
                "id": "gemini",
                "name": "Gemini Models",
                "description": "Models from Google Gemini",
                "count": len(GEMINI_MODELS),
            },
            {
                "id": "openrouter",
                "name": "OpenRouter Models",
                "description": "Models available through OpenRouter",
                "count": len(OPENROUTER_MODELS),
            },
        ],
        "total_models": len(ALL_MODELS),
    }


@router.get(
    "/v1/providers",
    summary="Get available model providers",
)
async def get_providers() -> dict:
    """
    Get list of available model providers.
    """
    providers = {}
    for model in ALL_MODELS:
        provider = model.provider
        if provider not in providers:
            providers[provider] = 0
        providers[provider] += 1
    
    return {
        "providers": [
            {"name": provider, "count": count}
            for provider, count in sorted(providers.items())
        ],
        "total_providers": len(providers),
    }


__all__ = ["router"]




