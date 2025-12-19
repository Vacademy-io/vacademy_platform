from __future__ import annotations

from typing import Any, Dict, Optional, AsyncGenerator

import httpx
import json

from ..config import get_settings
from ..ports.llm_client import OutlineLLMClient


class OpenRouterOutlineLLMClient(OutlineLLMClient):
    """
    HTTP-based OutlineLLMClient implementation using a generic OpenRouter-style API.

    All concrete details (base URL, API key, default model, timeouts) are configurable
    via environment variables. You can adapt this to any provider by adjusting the
    request payload format and headers.
    
    Supports free tier model fallback chain for cost-effective generation.
    """
    
    # Free tier models to try in order (fallback chain)
    FREE_MODELS = [
        "xiaomi/mimo-v2-flash:free",
        "mistralai/devstral-2512:free",
        "nvidia/nemotron-3-nano-30b-a3b:free"
    ]

    def __init__(
        self,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
        default_model: Optional[str] = None,
        timeout_seconds: float = 60.0,
    ) -> None:
        settings = get_settings()
        self._base_url = base_url or getattr(settings, "llm_base_url", "")
        self._api_key = api_key or getattr(settings, "openrouter_api_key", "")
        self._default_model = default_model or getattr(
            settings, "llm_default_model", "xiaomi/mimo-v2-flash:free"
        )
        # If using free models, set up fallback chain
        if self._default_model in self.FREE_MODELS:
            self._model_chain = self.FREE_MODELS
        else:
            self._model_chain = [self._default_model]
        self._timeout_seconds = timeout_seconds

    async def generate_outline(self, prompt: str, model: str | None) -> str:
        """Generate outline using regular (non-streaming) API call with free model fallback."""
        # Determine which models to try
        if model:
            models_to_try = [model]
        elif self._default_model in self.FREE_MODELS:
            models_to_try = self._model_chain
        else:
            models_to_try = [self._default_model]
        
        last_error = None
        for model_to_use in models_to_try:
            try:
                payload = self._build_payload(prompt=prompt, model=model_to_use, stream=False)
                headers = self._build_headers()

                async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
                    response = await client.post(
                        url=self._base_url,
                        headers=headers,
                        json=payload,
                    )
                    response.raise_for_status()
                    data: Dict[str, Any] = response.json()

                # This is intentionally generic; adapt to your provider's schema.
                # Expecting something like OpenAI/compatible:
                #   { "choices": [ { "message": { "content": "..." } } ] }
                try:
                    return data["choices"][0]["message"]["content"]
                except Exception:
                    # Fallback: return raw JSON string
                    return response.text
            except httpx.HTTPStatusError as exc:
                last_error = exc
                # If this is not the last model, continue to next
                if model_to_use != models_to_try[-1]:
                    continue
                # Last model failed, raise the error
                raise
            except Exception as exc:
                last_error = exc
                # If this is not the last model, continue to next
                if model_to_use != models_to_try[-1]:
                    continue
                # Last model failed, raise the error
                raise
        
        # Should never reach here, but just in case
        if last_error:
            raise last_error
        raise RuntimeError("No models available to try")

    async def stream_outline(self, prompt: str, model: str | None) -> AsyncGenerator[str, None]:
        """Generate outline using streaming API call (matches media-service pattern)."""
        # For now, use non-streaming API for simplicity
        result = await self.generate_outline(prompt, model)
        yield result

    def _build_payload(self, prompt: str, model: str, stream: bool = False) -> Dict[str, Any]:
        payload = {
            "model": model,
            "messages": [
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.3,
        }
        if stream:
            payload["stream"] = True
        return payload

    def _build_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"
        return headers


__all__ = ["OpenRouterOutlineLLMClient"]


