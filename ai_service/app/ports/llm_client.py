from __future__ import annotations

from typing import Protocol


class OutlineLLMClient(Protocol):
    """
    Port for calling an LLM to generate a course outline.

    High-level service code depends only on this protocol, not on any HTTP client
    or concrete vendor implementation.
    """

    async def generate_outline(self, prompt: str, model: str | None, api_key: str | None = None) -> str:
        """
        Generate a course outline given a fully constructed prompt.

        :param prompt: Final prompt string including any templates/context.
        :param model: Optional model identifier; when None, implementation
                      should fall back to a sensible default model.
        :param api_key: Optional API key to use; when None, implementation
                       should fall back to default/configured key.
        :return: Raw string response from the LLM (may contain markdown/JSON).
        """
        raise NotImplementedError


__all__ = ["OutlineLLMClient"]



