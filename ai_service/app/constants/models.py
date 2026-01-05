"""
Constants for available AI models that can be used in the AI service.
"""
from typing import Dict, List, Optional
from enum import Enum


class ModelCategory(str, Enum):
    """Model categories."""
    FREE = "free"
    PAID = "paid"
    OPENAI = "openai"
    GEMINI = "gemini"
    OPENROUTER = "openrouter"


class ModelInfo:
    """Information about an AI model."""
    
    def __init__(
        self,
        id: str,
        name: str,
        provider: str,
        category: ModelCategory,
        description: str = "",
        max_tokens: Optional[int] = None,
        supports_streaming: bool = True,
        supports_images: bool = False,
    ):
        self.id = id
        self.name = name
        self.provider = provider
        self.category = category
        self.description = description
        self.max_tokens = max_tokens
        self.supports_streaming = supports_streaming
        self.supports_images = supports_images
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for API responses."""
        return {
            "id": self.id,
            "name": self.name,
            "provider": self.provider,
            "category": self.category.value,
            "description": self.description,
            "max_tokens": self.max_tokens,
            "supports_streaming": self.supports_streaming,
            "supports_images": self.supports_images,
        }


# Free tier models (OpenRouter)
FREE_MODELS = [
    ModelInfo(
        id="xiaomi/mimo-v2-flash:free",
        name="MIMO v2 Flash (Free)",
        provider="OpenRouter",
        category=ModelCategory.FREE,
        description="Fast free model for general tasks",
        supports_streaming=True,
    ),
    ModelInfo(
        id="mistralai/devstral-2512:free",
        name="Devstral 2512 (Free)",
        provider="OpenRouter",
        category=ModelCategory.FREE,
        description="Mistral's free model",
        supports_streaming=True,
    ),
    ModelInfo(
        id="nvidia/nemotron-3-nano-30b-a3b:free",
        name="Nemotron 3 Nano (Free)",
        provider="OpenRouter",
        category=ModelCategory.FREE,
        description="NVIDIA's free model",
        supports_streaming=True,
    ),
]

# Paid OpenAI/OpenRouter models
OPENAI_MODELS = [
    ModelInfo(
        id="openai/gpt-4o-mini",
        name="GPT-4o Mini",
        provider="OpenAI",
        category=ModelCategory.PAID,
        description="Fast and affordable GPT-4o model",
        max_tokens=16384,
        supports_streaming=True,
    ),
    ModelInfo(
        id="openai/gpt-4o",
        name="GPT-4o",
        provider="OpenAI",
        category=ModelCategory.PAID,
        description="Most capable GPT-4 model",
        max_tokens=128000,
        supports_streaming=True,
    ),
    ModelInfo(
        id="openai/gpt-4-turbo",
        name="GPT-4 Turbo",
        provider="OpenAI",
        category=ModelCategory.PAID,
        description="High-performance GPT-4 model",
        max_tokens=128000,
        supports_streaming=True,
    ),
    ModelInfo(
        id="openai/gpt-3.5-turbo",
        name="GPT-3.5 Turbo",
        provider="OpenAI",
        category=ModelCategory.PAID,
        description="Fast and cost-effective model",
        max_tokens=16384,
        supports_streaming=True,
    ),
]

# Gemini models
GEMINI_MODELS = [
    ModelInfo(
        id="google/gemini-2.5-pro",
        name="Gemini 2.5 Pro",
        provider="Google",
        category=ModelCategory.GEMINI,
        description="Google's most capable model",
        max_tokens=8192,
        supports_streaming=True,
        supports_images=True,
    ),
    ModelInfo(
        id="google/gemini-2.5-flash",
        name="Gemini 2.5 Flash",
        provider="Google",
        category=ModelCategory.GEMINI,
        description="Fast Gemini model",
        max_tokens=8192,
        supports_streaming=True,
        supports_images=True,
    ),
    ModelInfo(
        id="google/gemini-2.5-flash-image",
        name="Gemini 2.5 Flash Image",
        provider="Google",
        category=ModelCategory.GEMINI,
        description="Gemini model optimized for image generation",
        supports_streaming=False,
        supports_images=True,
    ),
]

# Other OpenRouter models
OPENROUTER_MODELS = [
    ModelInfo(
        id="anthropic/claude-3.5-sonnet",
        name="Claude 3.5 Sonnet",
        provider="Anthropic",
        category=ModelCategory.PAID,
        description="Anthropic's advanced model",
        max_tokens=200000,
        supports_streaming=True,
    ),
    ModelInfo(
        id="meta-llama/llama-3.1-70b-instruct",
        name="Llama 3.1 70B",
        provider="Meta",
        category=ModelCategory.PAID,
        description="Meta's large language model",
        max_tokens=8192,
        supports_streaming=True,
    ),
]

# All models combined
ALL_MODELS = FREE_MODELS + OPENAI_MODELS + GEMINI_MODELS + OPENROUTER_MODELS

# Model lookup dictionary
MODELS_BY_ID = {model.id: model for model in ALL_MODELS}

# Default model
DEFAULT_MODEL = "xiaomi/mimo-v2-flash:free"


def get_model_by_id(model_id: str) -> Optional[ModelInfo]:
    """Get model information by ID."""
    return MODELS_BY_ID.get(model_id)


def get_models_by_category(category: ModelCategory) -> List[ModelInfo]:
    """Get all models in a category."""
    return [model for model in ALL_MODELS if model.category == category]


def get_models_by_provider(provider: str) -> List[ModelInfo]:
    """Get all models from a provider."""
    return [model for model in ALL_MODELS if model.provider.lower() == provider.lower()]


__all__ = [
    "ModelCategory",
    "ModelInfo",
    "FREE_MODELS",
    "OPENAI_MODELS",
    "GEMINI_MODELS",
    "OPENROUTER_MODELS",
    "ALL_MODELS",
    "MODELS_BY_ID",
    "DEFAULT_MODEL",
    "get_model_by_id",
    "get_models_by_category",
    "get_models_by_provider",
]

