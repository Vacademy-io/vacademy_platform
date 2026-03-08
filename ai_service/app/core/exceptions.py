"""
Custom exceptions for the AI service.
"""
from __future__ import annotations


class PaymentRequiredError(Exception):
    """
    Raised when the upstream LLM provider (e.g. OpenRouter) returns HTTP 402
    Payment Required, indicating the API key has insufficient credits or the
    free-tier quota has been exhausted.
    """

    def __init__(self, message: str = "OpenRouter API payment required. The API key has insufficient credits or the free-tier quota has been exhausted.") -> None:
        super().__init__(message)
        self.message = message

    def __str__(self) -> str:
        return self.message


__all__ = ["PaymentRequiredError"]
