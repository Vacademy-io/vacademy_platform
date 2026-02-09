"""
LLM client with provider priority fallback (OpenRouter -> Gemini).
"""
from __future__ import annotations

import json
import logging
from typing import Dict, Any, List, Optional
import httpx

from ..services.api_key_resolver import ApiKeyResolver

logger = logging.getLogger(__name__)


class ChatLLMClient:
    """
    Handles LLM calls with provider priority: OpenRouter -> Gemini.
    Supports tool calling for agentic behavior.
    """
    
    def __init__(self, api_key_resolver: ApiKeyResolver):
        self.api_key_resolver = api_key_resolver
        self.http_client = httpx.AsyncClient(timeout=120.0)
    
    async def chat_completion(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        temperature: float = 0.3,
        max_tokens: int = 1500,
        institute_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Call LLM with tool support, trying providers in priority order.
        
        Args:
            messages: List of message dicts with role and content
            tools: Optional list of tool definitions
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            institute_id: Optional institute ID for key resolution
            user_id: Optional user ID for key resolution
            
        Returns:
            Response dict with content, tool_calls, finish_reason, etc.
        """
        # Resolve all keys at once
        openrouter_key, gemini_key, model = self.api_key_resolver.resolve_keys(
            institute_id=institute_id or "default",
            user_id=user_id
        )
        
        # Try OpenRouter first (primary provider)
        if openrouter_key:
            try:
                logger.info(f"Attempting OpenRouter API call with model: {model}")
                return await self._call_openrouter(messages, tools, temperature, max_tokens, openrouter_key, model)
            except Exception as e:
                logger.warning(f"OpenRouter failed: {e}")
        
        # Try Gemini as fallback
        if gemini_key:
            try:
                logger.info("Attempting Gemini API call")
                return await self._call_gemini(messages, tools, temperature, max_tokens, gemini_key)
            except Exception as e:
                logger.error(f"Gemini failed: {e}")
        
        raise Exception("All LLM providers failed - no API keys available")
    
    async def _call_gemini(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]],
        temperature: float,
        max_tokens: int,
        api_key: str,
    ) -> Dict[str, Any]:
        """Call Gemini API (converted format)."""
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        
        # Convert messages to Gemini format
        gemini_contents = []
        for msg in messages:
            role = "user" if msg["role"] in ["user", "system"] else "model"
            gemini_contents.append({
                "role": role,
                "parts": [{"text": msg.get("content", "")}]
            })
        
        payload = {
            "contents": gemini_contents,
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
            }
        }
        
        # Note: Gemini tool calling has different format - simplified for now
        # Full tool support would need format conversion
        
        response = await self.http_client.post(url, json=payload)
        response.raise_for_status()
        
        data = response.json()
        candidate = data["candidates"][0]
        content = candidate["content"]["parts"][0]["text"]
        
        return {
            "content": content,
            "tool_calls": None,  # Gemini tool format needs conversion
            "finish_reason": candidate.get("finishReason"),
            "provider": "gemini",
            "usage": data.get("usageMetadata"),
            "model": "gemini-1.5-flash"
        }
    
    async def _call_openrouter(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]],
        temperature: float,
        max_tokens: int,
        api_key: str,
        model: str = "xiaomi/mimo-v2-flash:free",
    ) -> Dict[str, Any]:
        """Call OpenRouter API (OpenAI-compatible)."""
        url = "https://openrouter.ai/api/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://vacademy.io",
            "X-Title": "Vacademy AI Tutor"
        }
        
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"
        
        response = await self.http_client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        
        data = response.json()
        choice = data["choices"][0]
        message = choice["message"]
        
        return {
            "content": message.get("content", ""),
            "tool_calls": message.get("tool_calls"),
            "finish_reason": choice.get("finish_reason"),
            "provider": "openrouter",
            "usage": data.get("usage"),
            "model": data.get("model", model)
        }
    
    async def close(self):
        """Close the HTTP client."""
        await self.http_client.aclose()


__all__ = ["ChatLLMClient"]
