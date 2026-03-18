"""
LLM client with provider priority fallback (OpenRouter -> Gemini).
"""
from __future__ import annotations

import json
import logging
from typing import AsyncGenerator, Dict, Any, List, Optional
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
    
    def _convert_to_multimodal_messages(self, messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Convert messages with attachments to OpenAI multimodal format."""
        converted = []
        for msg in messages:
            attachments = msg.get("attachments")
            if attachments and msg.get("role") == "user":
                content_parts = []
                if msg.get("content"):
                    content_parts.append({"type": "text", "text": msg["content"]})
                for att in attachments:
                    if att.get("type") == "image":
                        content_parts.append({
                            "type": "image_url",
                            "image_url": {"url": att["url"]}
                        })
                converted.append({
                    "role": msg["role"],
                    "content": content_parts if content_parts else msg.get("content", ""),
                })
            else:
                # Strip attachments key for non-multimodal messages
                clean_msg = {k: v for k, v in msg.items() if k != "attachments"}
                converted.append(clean_msg)
        return converted

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
        
        # Check for multimodal content and convert if needed
        has_attachments = any(msg.get("attachments") for msg in messages)
        if has_attachments:
            messages = self._convert_to_multimodal_messages(messages)

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

        if response.status_code == 402:
            error_body = response.text
            logger.error(
                f"OpenRouter 402 Payment Required - insufficient credits or quota exceeded. "
                f"Model: {model}, Status: {response.status_code}, "
                f"Response: {error_body}"
            )
            raise Exception(
                f"OpenRouter 402 Payment Required: insufficient credits or quota exceeded. "
                f"Model: {model}. Details: {error_body}"
            )

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
    
    async def chat_completion_stream(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        temperature: float = 0.3,
        max_tokens: int = 1500,
        institute_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Stream LLM response token-by-token.
        Yields dicts: {"type": "token", "content": "..."} or {"type": "tool_calls", "tool_calls": [...]} or {"type": "done", "usage": {...}}
        Falls back to non-streaming if streaming fails.
        """
        openrouter_key, gemini_key, model = self.api_key_resolver.resolve_keys(
            institute_id=institute_id or "default",
            user_id=user_id
        )

        if openrouter_key:
            try:
                async for chunk in self._stream_openrouter(messages, tools, temperature, max_tokens, openrouter_key, model):
                    yield chunk
                return
            except Exception as e:
                logger.warning(f"OpenRouter streaming failed: {e}")

        # Fallback to non-streaming
        response = await self.chat_completion(messages, tools, temperature, max_tokens, institute_id, user_id)
        if response.get("content"):
            yield {"type": "token", "content": response["content"]}
        if response.get("tool_calls"):
            yield {"type": "tool_calls", "tool_calls": response["tool_calls"]}
        yield {"type": "done", "usage": response.get("usage"), "model": response.get("model"), "provider": response.get("provider")}

    async def _stream_openrouter(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]],
        temperature: float,
        max_tokens: int,
        api_key: str,
        model: str = "xiaomi/mimo-v2-flash:free",
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Stream from OpenRouter using SSE."""
        # Check for multimodal content and convert if needed
        has_attachments = any(msg.get("attachments") for msg in messages)
        if has_attachments:
            messages = self._convert_to_multimodal_messages(messages)

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
            "stream": True,
        }

        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"

        accumulated_tool_calls = {}  # index -> {id, function: {name, arguments}}

        async with self.http_client.stream("POST", url, json=payload, headers=headers) as response:
            if response.status_code == 402:
                raise Exception(f"OpenRouter 402 Payment Required")
            response.raise_for_status()

            async for line in response.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data_str = line[6:]
                if data_str.strip() == "[DONE]":
                    # Yield accumulated tool calls if any
                    if accumulated_tool_calls:
                        tool_calls_list = []
                        for idx in sorted(accumulated_tool_calls.keys()):
                            tc = accumulated_tool_calls[idx]
                            tool_calls_list.append(tc)
                        yield {"type": "tool_calls", "tool_calls": tool_calls_list}
                    yield {"type": "done", "usage": None, "model": model, "provider": "openrouter"}
                    return

                try:
                    chunk = json.loads(data_str)
                except json.JSONDecodeError:
                    continue

                if not chunk.get("choices"):
                    # Could be usage data at the end
                    if chunk.get("usage"):
                        yield {"type": "done", "usage": chunk["usage"], "model": chunk.get("model", model), "provider": "openrouter"}
                    continue

                delta = chunk["choices"][0].get("delta", {})

                # Token content
                if delta.get("content"):
                    yield {"type": "token", "content": delta["content"]}

                # Tool calls (accumulated across chunks)
                if delta.get("tool_calls"):
                    for tc_delta in delta["tool_calls"]:
                        idx = tc_delta.get("index", 0)
                        if idx not in accumulated_tool_calls:
                            accumulated_tool_calls[idx] = {
                                "id": tc_delta.get("id", ""),
                                "type": "function",
                                "function": {"name": "", "arguments": ""}
                            }
                        if tc_delta.get("id"):
                            accumulated_tool_calls[idx]["id"] = tc_delta["id"]
                        func = tc_delta.get("function", {})
                        if func.get("name"):
                            accumulated_tool_calls[idx]["function"]["name"] = func["name"]
                        if func.get("arguments"):
                            accumulated_tool_calls[idx]["function"]["arguments"] += func["arguments"]

    async def close(self):
        """Close the HTTP client."""
        await self.http_client.aclose()


__all__ = ["ChatLLMClient"]
