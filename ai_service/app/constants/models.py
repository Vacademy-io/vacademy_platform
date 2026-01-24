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
        input_price_per_1m: Optional[float] = None,
        output_price_per_1m: Optional[float] = None,
        context_window: Optional[int] = None,
    ):
        self.id = id
        self.name = name
        self.provider = provider
        self.category = category
        self.description = description
        self.max_tokens = max_tokens
        self.supports_streaming = supports_streaming
        self.supports_images = supports_images
        self.input_price_per_1m = input_price_per_1m
        self.output_price_per_1m = output_price_per_1m
        self.context_window = context_window
    
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
            "category": self.category.value,
            "description": self.description,
            "max_tokens": self.max_tokens,
            "context_window": self.context_window,
            "supports_streaming": self.supports_streaming,
            "supports_images": self.supports_images,
            "input_price_per_1m": self.input_price_per_1m,
            "output_price_per_1m": self.output_price_per_1m,
            "input_token_price": self.get_input_token_price(),
            "output_token_price": self.get_output_token_price(),
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
    # New models with pricing
    ModelInfo(
        id="anthropic/claude-sonnet-4.5",
        name="Claude Sonnet 4.5",
        provider="Anthropic",
        category=ModelCategory.PAID,
        description="Anthropic's Claude Sonnet 4.5 model",
        max_tokens=1000000,
        context_window=1000000,
        supports_streaming=True,
        input_price_per_1m=3.0,
        output_price_per_1m=15.0,
    ),
    ModelInfo(
        id="x-ai/grok-code-fast-1",
        name="Grok Code Fast 1",
        provider="xAI",
        category=ModelCategory.PAID,
        description="xAI's fast code model",
        max_tokens=256000,
        context_window=256000,
        supports_streaming=True,
        input_price_per_1m=0.2,
        output_price_per_1m=1.5,
    ),
    ModelInfo(
        id="google/gemini-2.5-flash",
        name="Gemini 2.5 Flash",
        provider="Google",
        category=ModelCategory.GEMINI,
        description="Fast Gemini model",
        max_tokens=1048576,
        context_window=1048576,
        supports_streaming=True,
        supports_images=True,
        input_price_per_1m=0.3,
        output_price_per_1m=2.5,
    ),
    ModelInfo(
        id="google/gemini-3-flash-preview",
        name="Gemini 3 Flash Preview",
        provider="Google",
        category=ModelCategory.GEMINI,
        description="Gemini 3 Flash preview model",
        max_tokens=1048576,
        context_window=1048576,
        supports_streaming=True,
        supports_images=True,
        input_price_per_1m=0.5,
        output_price_per_1m=3.0,
    ),
    ModelInfo(
        id="deepseek/deepseek-v3.2",
        name="DeepSeek V3.2",
        provider="DeepSeek",
        category=ModelCategory.PAID,
        description="DeepSeek V3.2 model",
        max_tokens=163840,
        context_window=163840,
        supports_streaming=True,
        input_price_per_1m=0.25,
        output_price_per_1m=0.38,
    ),
    ModelInfo(
        id="anthropic/claude-opus-4.5",
        name="Claude Opus 4.5",
        provider="Anthropic",
        category=ModelCategory.PAID,
        description="Anthropic's Claude Opus 4.5 model",
        max_tokens=200000,
        context_window=200000,
        supports_streaming=True,
        input_price_per_1m=5.0,
        output_price_per_1m=25.0,
    ),
    ModelInfo(
        id="x-ai/grok-4.1-fast",
        name="Grok 4.1 Fast",
        provider="xAI",
        category=ModelCategory.PAID,
        description="xAI's Grok 4.1 Fast model",
        max_tokens=2000000,
        context_window=2000000,
        supports_streaming=True,
        input_price_per_1m=0.2,
        output_price_per_1m=0.5,
    ),
    ModelInfo(
        id="google/gemini-2.5-flash-lite",
        name="Gemini 2.5 Flash Lite",
        provider="Google",
        category=ModelCategory.GEMINI,
        description="Lightweight Gemini Flash model",
        max_tokens=1048576,
        context_window=1048576,
        supports_streaming=True,
        supports_images=True,
        input_price_per_1m=0.1,
        output_price_per_1m=0.4,
    ),
    ModelInfo(
        id="google/gemini-3-pro-preview",
        name="Gemini 3 Pro Preview",
        provider="Google",
        category=ModelCategory.GEMINI,
        description="Gemini 3 Pro preview model",
        max_tokens=1048576,
        context_window=1048576,
        supports_streaming=True,
        supports_images=True,
        input_price_per_1m=2.0,
        output_price_per_1m=12.0,
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


def get_model_pricing(model_id: str) -> Optional[Dict[str, float]]:
    """
    Get pricing information for a model.
    
    Returns:
        Dictionary with 'input_token_price' and 'output_token_price' (per token),
        or None if model not found or has no pricing
    """
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
    }


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
    "get_model_pricing",
]

