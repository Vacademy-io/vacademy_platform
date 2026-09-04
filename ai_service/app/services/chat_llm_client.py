"""
LLM client. All completions run through OpenRouter (the direct-Gemini
fallback was retired — that key was free-tier with a zero image quota, and
text now runs exclusively through the billed OpenRouter account).
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
    Handles LLM calls through OpenRouter. Supports tool calling for
    agentic behavior.
    """
    
    def __init__(
        self,
        api_key_resolver: ApiKeyResolver,
        disable_reasoning: bool = False,
        platform_model_key: Optional[str] = None,
    ):
        """
        disable_reasoning: send `reasoning: {"enabled": false}` so the provider
            does not spend hidden reasoning tokens before answering.

            OFF BY DEFAULT AND DELIBERATELY SO. This client is shared by
            assessment generation, coding-question generation, the page builder,
            the admin assistant and copy-check grading — reasoning is worth
            paying for there, and copy-check in particular grades real student
            answer sheets, where suppressing it could cost accuracy on marks.

            Only the learner text chatbot opts in (see
            AiChatAgentService._make_llm_client): its median message is 23
            characters and most turns are greetings, "yes"/"idk" and quiz
            acknowledgements, so reasoning is pure latency and cost there.
        """
        self.api_key_resolver = api_key_resolver
        self.disable_reasoning = disable_reasoning
        # Name of the platform setting (super-admin portal) whose value is the
        # default model for this client, e.g. "chatbot.text.model". None keeps
        # the env default — right for every consumer that isn't the chatbot.
        self.platform_model_key = platform_model_key
        self.http_client = httpx.AsyncClient(timeout=120.0)

    @staticmethod
    def _fallback_model_for(model: str, explicit_model: Optional[str]) -> Optional[str]:
        """
        The env default model, when it differs from the one that just failed and
        the caller did not pin the model on purpose (an explicit override —
        escalation to a stronger model — should fail loudly, not silently
        downgrade).
        """
        if explicit_model:
            return None
        try:
            from ..config import get_settings
            default = get_settings().llm_default_model
        except Exception:
            return None
        return default if default and default != model else None

    @staticmethod
    def _note_model_failure(model: str, reason: str, fallback: Optional[str]) -> None:
        try:
            from .platform_settings_service import record_model_failure
            record_model_failure(model, reason, fallback)
        except Exception:
            pass

    @staticmethod
    def _note_model_ok(model: str) -> None:
        try:
            from .platform_settings_service import record_model_success
            record_model_success(model)
        except Exception:
            pass

    def _resolve(self, institute_id: Optional[str], user_id: Optional[str]):
        """
        resolve_keys with the platform-default hint, tolerating resolvers that
        don't know it. The chatbot and the assistant hand this client duck-typed
        resolvers that return pre-fetched keys; passing them an unexpected
        keyword took the learner chatbot down for every institute (2026-09-03).
        """
        base = {"institute_id": institute_id or "default", "user_id": user_id}
        if not self.platform_model_key:
            return self.api_key_resolver.resolve_keys(**base)
        try:
            return self.api_key_resolver.resolve_keys(
                **base, platform_default_key=self.platform_model_key
            )
        except TypeError:
            return self.api_key_resolver.resolve_keys(**base)
    
    async def chat_completion(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        temperature: float = 0.3,
        max_tokens: int = 1500,
        institute_id: Optional[str] = None,
        user_id: Optional[str] = None,
        model: Optional[str] = None,
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
            model: Optional explicit model override — when supplied, takes
                priority over the resolver's choice (used by copy-check to
                escalate flagged questions to a stronger model).

        Returns:
            Response dict with content, tool_calls, finish_reason, etc.
        """
        # Resolve keys. gemini_key is ignored — the Gemini fallback was retired.
        openrouter_key, _gemini_key, resolved_model = self._resolve(institute_id, user_id)
        # Caller override wins over the resolver's pick.
        explicit_model = model
        model = model or resolved_model

        # Track per-provider failure reasons so the final exception surfaces
        # actionable detail (e.g. "Gemini: 403 PERMISSION_DENIED") instead of
        # the misleading "no API keys available" — which was wrong whenever
        # keys WERE present but providers rejected them.
        failures: List[str] = []

        # Try OpenRouter first (primary provider)
        if openrouter_key:
            try:
                logger.info(f"Attempting OpenRouter API call with model: {model}")
                result = await self._call_openrouter(messages, tools, temperature, max_tokens, openrouter_key, model)
                self._note_model_ok(model)
                return result
            except Exception as e:
                logger.warning(f"OpenRouter failed: {e}")
                failures.append(f"OpenRouter: {e}")
                # A model chosen in the portal / institute settings that OpenRouter
                # rejects must not take the chatbot down: answer with the env
                # default and record why, so the portal can show it.
                fallback = self._fallback_model_for(model, explicit_model)
                if fallback:
                    self._note_model_failure(model, str(e), fallback)
                    try:
                        logger.error(
                            f"Model {model} failed; falling back to {fallback} for this call"
                        )
                        result = await self._call_openrouter(
                            messages, tools, temperature, max_tokens, openrouter_key, fallback
                        )
                        result["fallback_from"] = model
                        return result
                    except Exception as e2:
                        logger.warning(f"OpenRouter fallback {fallback} failed too: {e2}")
                        failures.append(f"OpenRouter fallback {fallback}: {e2}")
        else:
            failures.append("OpenRouter: no key configured")

        raise Exception("All LLM providers failed - " + "; ".join(failures))
    
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

        # Per-client opt-in only — see __init__. Never global: this client also
        # serves copy-check grading and assessment generation, where reasoning earns
        # its cost. Accepted by every model we serve and does not affect tool calls.
        if self.disable_reasoning:
            payload["reasoning"] = {"enabled": False}

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
        openrouter_key, _gemini_key, model = self._resolve(institute_id, user_id)

        if openrouter_key:
            try:
                async for chunk in self._stream_openrouter(messages, tools, temperature, max_tokens, openrouter_key, model):
                    yield chunk
                return
            except Exception as e:
                logger.warning(f"OpenRouter streaming failed: {e}")
                self._note_model_failure(model, f"streaming: {e}", None)

        # Fallback to non-streaming (which falls back to the env default model
        # if the configured one is what OpenRouter rejects)
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

        # Per-client opt-in only — see __init__. Never global: this client also
        # serves copy-check grading and assessment generation, where reasoning earns
        # its cost. Accepted by every model we serve and does not affect tool calls.
        if self.disable_reasoning:
            payload["reasoning"] = {"enabled": False}

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
