"""
Main AI Chat Agent service with agentic processing loop and SSE support.

Uses short-lived DB sessions to avoid holding database connections during
long-running LLM calls and SSE streaming. Each DB operation block opens
and closes its own session via the session factory.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Callable, Dict, Any, List, Optional, AsyncGenerator
from uuid import uuid4

from sqlalchemy.orm import Session

from ..repositories.chat_session_repository import ChatSessionRepository
from ..services.token_usage_service import TokenUsageService
from ..models.ai_token_usage import ApiProvider, RequestType

from ..repositories.chat_message_repository import ChatMessageRepository
from ..services.context_resolver_service import ContextResolverService
from ..services.tool_manager_service import ToolManagerService, TOOL_DEFINITIONS
from ..services.chat_llm_client import ChatLLMClient
from ..services.institute_settings_service import InstituteSettingsService
from ..services.quiz_service import QuizService
from ..services.intent_classifier_service import IntentClassifierService
from ..services.context_window_service import ContextWindowService
from ..services.learning_analytics_service import LearningAnalyticsService
from ..services.api_key_resolver import ApiKeyResolver
from ..services.embedding_service import EmbeddingService
from ..services.rag_service import RAGService
from ..models.chat_message import ChatMessage
from ..services.mathpix_service import MathpixService
from ..schemas.chat_agent import (
    MessageIntent,
    QuizData,
    QuizSubmission,
    QuizFeedback,
)

logger = logging.getLogger(__name__)


class _CachedKeyResolver:
    """Lightweight API key resolver that returns pre-resolved keys without DB access."""

    def __init__(self, keys: tuple):
        self._keys = keys

    def resolve_keys(self, institute_id=None, user_id=None, request_model=None):
        return self._keys


def _msg_event(msg) -> dict:
    """Convert an ORM ChatMessage to an SSE-friendly dict."""
    return {
        "id": msg.id,
        "type": msg.message_type,
        "content": msg.content,
        "metadata": msg.meta_data,
        "created_at": msg.created_at.isoformat(),
    }


class AiChatAgentService:
    """
    Orchestrates the AI chat agent with agentic capabilities and SSE support.
    Handles session management, message processing, and real-time streaming.

    Uses a DB session factory so that each database operation block opens and
    closes its own short-lived connection — no connection is held during
    long-running LLM calls or the SSE polling loop.
    """

    def __init__(self, db_session_factory: Callable):
        """
        Args:
            db_session_factory: Callable context-manager that yields a Session.
                                Typically ``db.db_session``.
        """
        self._db_factory = db_session_factory
        self.intent_classifier = IntentClassifierService()
        # Store active quizzes for evaluation (session_id -> QuizData)
        self._active_quizzes: Dict[str, QuizData] = {}

    # ── helpers ──────────────────────────────────────────────────────────

    def _get_db(self):
        """Return a context-managed short-lived DB session."""
        return self._db_factory()

    @staticmethod
    def _resolve_keys(db: Session, institute_id: str, user_id: str) -> tuple:
        """Pre-resolve API keys using the given DB session."""
        return ApiKeyResolver(db).resolve_keys(
            institute_id=institute_id, user_id=user_id
        )

    @staticmethod
    def _make_llm_client(keys: tuple) -> ChatLLMClient:
        """Create an LLM client with pre-resolved keys (no DB dependency)."""
        return ChatLLMClient(_CachedKeyResolver(keys))

    def _record_token_usage(
        self, response: Dict[str, Any], institute_id: str, user_id: str
    ):
        """Record token usage in its own short-lived DB session."""
        try:
            usage = response.get("usage", {})
            provider = response.get("provider", "unknown")
            model = response.get("model", "unknown")

            prompt_tokens = 0
            completion_tokens = 0
            total_tokens = 0

            if usage:
                if provider == "openrouter":
                    prompt_tokens = usage.get("prompt_tokens", 0)
                    completion_tokens = usage.get("completion_tokens", 0)
                    total_tokens = usage.get("total_tokens", 0)
                elif provider == "gemini":
                    prompt_tokens = usage.get("promptTokenCount", 0)
                    completion_tokens = usage.get("candidatesTokenCount", 0)
                    total_tokens = usage.get("totalTokenCount", 0)

            if total_tokens > 0:
                api_provider = ApiProvider.OPENAI
                if provider == "gemini":
                    api_provider = ApiProvider.GEMINI

                with self._get_db() as db:
                    TokenUsageService(db).record_usage_and_deduct_credits(
                        api_provider=api_provider,
                        prompt_tokens=prompt_tokens,
                        completion_tokens=completion_tokens,
                        total_tokens=total_tokens,
                        request_type=RequestType.AGENT,
                        institute_id=institute_id,
                        user_id=user_id,
                        model=model,
                    )
                logger.debug(f"Recorded usage for agent chat: {total_tokens} tokens")
        except Exception as e:
            logger.warning(f"Failed to record token usage for agent: {e}")

    # ── public API ───────────────────────────────────────────────────────

    async def create_session(
        self,
        user_id: str,
        institute_id: str,
        context_type: Optional[str] = None,
        context_meta: Optional[Dict[str, Any]] = None,
        initial_message: Optional[str] = None,
        user_name: Optional[str] = None,
        session_mode: Optional[str] = "text",
    ) -> tuple[str, str]:
        """Create a new chat session and optionally save an initial message."""
        if context_type is None:
            context_type = "general"
        if context_meta is None:
            context_meta = {}

        with self._get_db() as db:
            session_repo = ChatSessionRepository(db)
            message_repo = ChatMessageRepository(db)

            session = session_repo.create_session(
                user_id=user_id,
                institute_id=institute_id,
                context_type=context_type,
                context_meta=context_meta,
                session_mode=session_mode or "text",
            )

            logger.info(f"Created chat session {session.id} for user {user_id}")

            if initial_message:
                message_repo.create_message(
                    session_id=session.id,
                    message_type="user",
                    content=initial_message,
                )

            session_id = session.id

        return (session_id, "idle")

    async def send_message(
        self,
        session_id: str,
        message: str,
        intent: Optional[MessageIntent] = None,
        quiz_submission: Optional[QuizSubmission] = None,
        idempotency_key: Optional[str] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
    ) -> tuple[int, str]:
        """Send a message to an existing session."""
        # Validate session
        with self._get_db() as db:
            session_repo = ChatSessionRepository(db)
            message_repo = ChatMessageRepository(db)

            session = session_repo.get_session_by_id(session_id)
            if not session:
                raise ValueError(f"Session {session_id} not found")
            if session.status != "ACTIVE":
                raise ValueError(f"Session {session_id} is not active")

            if idempotency_key:
                existing = message_repo.find_by_idempotency_key(
                    session_id, idempotency_key
                )
                if existing:
                    logger.info(
                        f"Duplicate message detected for idempotency key {idempotency_key}"
                    )
                    return (existing.id, "idle")

        # Extract LaTeX from image attachments via Mathpix OCR (async, no DB)
        enriched_message = message
        if attachments:
            mathpix = MathpixService()
            for att in attachments:
                att_dict = att if isinstance(att, dict) else {}
                att_type = att_dict.get("type", "")
                att_url = att_dict.get("url", "")
                if att_type == "image" and att_url:
                    try:
                        ocr_result = await mathpix.ocr_image(att_url)
                        latex_content = ocr_result.get("latex", "")
                        if latex_content:
                            enriched_message += (
                                f"\n\n[Math from image: ${latex_content}$]"
                            )
                    except Exception as e:
                        logger.warning(f"Mathpix OCR failed for attachment: {e}")

        # Build metadata
        metadata: Dict[str, Any] = {}
        if intent:
            metadata["intent"] = intent.value
        if idempotency_key:
            metadata["idempotency_key"] = idempotency_key
        if quiz_submission:
            metadata["quiz_submission"] = quiz_submission.model_dump()
        if attachments:
            metadata["attachments"] = [
                att.copy() if isinstance(att, dict) else att for att in attachments
            ]

        # Save message
        with self._get_db() as db:
            message_repo = ChatMessageRepository(db)
            session_repo = ChatSessionRepository(db)

            msg = message_repo.create_message(
                session_id=session_id,
                message_type="user",
                content=enriched_message,
                metadata=metadata if metadata else None,
            )
            session_repo.update_last_active(session_id)
            msg_id = msg.id

        return (msg_id, "idle")

    async def update_context(
        self,
        session_id: str,
        context_type: str,
        context_meta: Dict[str, Any],
    ) -> bool:
        """Update the context for an existing session without triggering AI response."""
        with self._get_db() as db:
            session_repo = ChatSessionRepository(db)
            session = session_repo.get_session_by_id(session_id)
            if not session:
                raise ValueError(f"Session {session_id} not found")
            if session.status != "ACTIVE":
                raise ValueError(f"Session {session_id} is not active")

            success = session_repo.update_context(
                session_id=session_id,
                context_type=context_type,
                context_meta=context_meta,
            )

        if success:
            logger.info(f"Context updated for session {session_id}: {context_type}")
        return success

    async def get_updates(
        self,
        session_id: str,
        last_message_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Get new messages since last_message_id (fallback for non-SSE clients)."""
        with self._get_db() as db:
            session_repo = ChatSessionRepository(db)
            message_repo = ChatMessageRepository(db)

            session = session_repo.get_session_by_id(session_id)
            if not session:
                raise ValueError(f"Session {session_id} not found")

            messages = message_repo.get_messages_by_session(
                session_id=session_id,
                after_message_id=last_message_id,
            )

            latest = message_repo.get_latest_message(session_id)
            ai_status = (
                "thinking" if latest and latest.message_type == "user" else "idle"
            )

            # Materialise data before session closes
            messages_list = list(messages)
            session_status = session.status

        return {
            "messages": messages_list,
            "ai_status": ai_status,
            "session_status": session_status,
        }

    async def stream_session(
        self,
        session_id: str,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Stream messages for a session via SSE.
        Uses short-lived DB sessions so the connection pool is not exhausted
        during the long-lived SSE polling loop.
        """
        # Verify session and extract identity
        with self._get_db() as db:
            session = ChatSessionRepository(db).get_session_by_id(session_id)
            if not session:
                raise ValueError(f"Session {session_id} not found")
            user_id = session.user_id
            institute_id = session.institute_id
            session_status = session.status

        logger.info(f"SSE stream started for session {session_id}")

        # Send existing messages
        with self._get_db() as db:
            existing_messages = ChatMessageRepository(db).get_messages_by_session(
                session_id
            )

        logger.info(
            f"Sending {len(existing_messages)} existing messages to SSE stream "
            f"for session {session_id}"
        )

        for msg in existing_messages:
            yield {"event": "message", "data": _msg_event(msg)}

        last_processed_id = existing_messages[-1].id if existing_messages else 0

        # If no messages exist, generate AI greeting
        if not existing_messages:
            logger.info(
                f"No existing messages for session {session_id}, generating AI greeting"
            )

            async for event in self._stream_greeting_generation(
                session_id, user_id, institute_id
            ):
                yield event
                if (
                    event.get("event") == "message"
                    and event.get("data", {}).get("id")
                ):
                    last_processed_id = max(
                        last_processed_id, event["data"]["id"]
                    )

            yield {
                "event": "status",
                "data": {
                    "ai_status": "idle",
                    "session_status": session_status,
                },
            }

        # Check for pending unprocessed user message
        with self._get_db() as db:
            latest = ChatMessageRepository(db).get_latest_message(session_id)
        needs_processing = (
            latest
            and latest.message_type == "user"
            and latest.id > last_processed_id
        )

        ai_status = "thinking" if needs_processing else "idle"
        yield {
            "event": "status",
            "data": {"ai_status": ai_status, "session_status": session_status},
        }

        if needs_processing:
            logger.info(
                f"Processing pending user message for session {session_id}"
            )
            async for event in self._stream_agentic_processing(
                session_id, user_id, institute_id
            ):
                yield event
                if (
                    event.get("event") == "message"
                    and event.get("data", {}).get("id")
                ):
                    last_processed_id = max(
                        last_processed_id, event["data"]["id"]
                    )

            yield {
                "event": "status",
                "data": {
                    "ai_status": "idle",
                    "session_status": session_status,
                },
            }

        # Keep connection alive and watch for new messages
        logger.info(f"SSE stream entering polling loop for session {session_id}")

        idle_counter = 0
        max_idle_time = 30 * 60  # 30 minutes
        max_idle_iterations = max_idle_time // 2

        while True:
            # Short-lived session for polling
            with self._get_db() as db:
                new_messages = ChatMessageRepository(
                    db
                ).get_messages_by_session(
                    session_id=session_id,
                    after_message_id=last_processed_id,
                )

            if new_messages:
                idle_counter = 0

                for msg in new_messages:
                    if msg.message_type == "user":
                        logger.info(
                            f"New user message detected for session {session_id}, "
                            "starting processing"
                        )

                        yield {"event": "message", "data": _msg_event(msg)}
                        last_processed_id = msg.id

                        yield {
                            "event": "status",
                            "data": {
                                "ai_status": "thinking",
                                "session_status": session_status,
                            },
                        }

                        async for event in self._stream_agentic_processing(
                            session_id, user_id, institute_id
                        ):
                            yield event
                            if (
                                event.get("event") == "message"
                                and event.get("data", {}).get("id")
                            ):
                                last_processed_id = max(
                                    last_processed_id, event["data"]["id"]
                                )

                        yield {
                            "event": "status",
                            "data": {
                                "ai_status": "idle",
                                "session_status": session_status,
                            },
                        }
            else:
                idle_counter += 1
                if idle_counter >= max_idle_iterations:
                    logger.info(
                        f"Session {session_id} idle for 30 minutes, closing stream"
                    )
                    break

            # Check if session closed (short-lived session)
            with self._get_db() as db:
                session = ChatSessionRepository(db).get_session_by_id(session_id)
            if not session or session.status == "CLOSED":
                logger.info(f"Session {session_id} closed, ending stream")
                break
            session_status = session.status

            yield {"event": "comment", "data": {"message": "keepalive"}}
            await asyncio.sleep(2)

        logger.info(f"SSE stream ended for session {session_id}")

    async def close_session(self, session_id: str) -> tuple[bool, int]:
        """Close a chat session."""
        with self._get_db() as db:
            session_repo = ChatSessionRepository(db)
            message_repo = ChatMessageRepository(db)
            success = session_repo.close_session(session_id)
            if success:
                count = message_repo.count_messages_by_session(session_id)
                return (True, count)
        return (False, 0)

    # ── private processing methods ───────────────────────────────────────

    async def _stream_greeting_generation(
        self,
        session_id: str,
        user_id: str,
        institute_id: str,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Generate personalised AI greeting for a new session."""
        try:
            # ── Phase 1: read context from DB ──
            with self._get_db() as db:
                session = ChatSessionRepository(db).get_session_by_id(session_id)
                if not session:
                    return

                context = await ContextResolverService(db).resolve_context(
                    session.context_type,
                    session.context_meta,
                    user_id,
                    institute_id,
                )

                inst_settings = InstituteSettingsService(db)
                ai_settings = inst_settings.get_ai_settings(institute_id)
                institute_rules = inst_settings.format_rules_for_prompt(ai_settings)
                temperature = inst_settings.get_temperature(ai_settings)

                keys = self._resolve_keys(db, institute_id, user_id)
            # ── DB released ──

            system_prompt = self._build_system_prompt(
                institute_rules, context, user_id, institute_id, is_greeting=True
            )
            messages = [{"role": "system", "content": system_prompt}]

            # ── Phase 2: LLM call (no DB held) ──
            try:
                llm_client = self._make_llm_client(keys)
                response = await llm_client.chat_completion(
                    messages=messages,
                    tools=None,
                    temperature=temperature,
                    institute_id=institute_id,
                    user_id=user_id,
                )

                self._record_token_usage(response, institute_id, user_id)
                greeting_content = response.get(
                    "content", "Hi! How can I help you today?"
                )

            except Exception as e:
                logger.error(f"Error generating greeting: {e}")
                greeting_content = (
                    "Hi! I'm your AI tutor. How can I help you today?"
                )

            # ── Phase 3: save to DB ──
            with self._get_db() as db:
                greeting_msg = ChatMessageRepository(db).create_message(
                    session_id=session_id,
                    message_type="assistant",
                    content=greeting_content,
                )
                msg_data = _msg_event(greeting_msg)

            yield {"event": "message", "data": msg_data}

        except Exception as e:
            logger.error(
                f"Error in greeting generation for session {session_id}: {e}"
            )

    async def _stream_agentic_processing(
        self,
        session_id: str,
        user_id: str,
        institute_id: str,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Main agentic processing loop with tool calling support.
        Streams events as they happen.

        DB sessions are acquired only for short DB-bound phases and released
        before every LLM call so the connection pool is not blocked.
        """
        try:
            # ── Phase 1: gather all context from DB ──
            with self._get_db() as db:
                session_repo = ChatSessionRepository(db)
                message_repo = ChatMessageRepository(db)

                session = session_repo.get_session_by_id(session_id)
                if not session:
                    return

                latest_msg = message_repo.get_latest_message(session_id)
                if not latest_msg or latest_msg.message_type != "user":
                    return

                # Materialise ORM data into local variables
                latest_msg_content = latest_msg.content
                latest_msg_meta_data = latest_msg.meta_data
                msg_metadata = latest_msg.meta_data or {}

                # Resolve context
                context = await ContextResolverService(db).resolve_context(
                    session.context_type,
                    session.context_meta,
                    user_id,
                    institute_id,
                )

                # Pre-resolve API keys
                keys = self._resolve_keys(db, institute_id, user_id)
                llm_client = self._make_llm_client(keys)

                # Get optimised conversation history
                optimized_history = ContextWindowService(
                    db, message_repo, llm_client
                ).get_optimized_history(session_id)

                # Fetch institute AI settings
                inst_settings = InstituteSettingsService(db)
                ai_settings = inst_settings.get_ai_settings(institute_id)
                institute_rules = inst_settings.format_rules_for_prompt(ai_settings)
                temperature = inst_settings.get_temperature(ai_settings)

                # Auto-search Knowledge Base
                kb_context = ""
                try:
                    cached_resolver = _CachedKeyResolver(keys)
                    embedding_service = EmbeddingService(cached_resolver)
                    rag_service = RAGService(db, embedding_service)
                    kb_results = await rag_service.search(
                        query=latest_msg_content,
                        institute_id=institute_id,
                        top_k=3,
                        similarity_threshold=0.35,
                    )
                    kb_items = [
                        r
                        for r in kb_results
                        if r.get("source_type") == "knowledge_base"
                    ]
                    if kb_items:
                        kb_snippets = []
                        for item in kb_items:
                            title = item.get("metadata", {}).get("title", "")
                            category = item.get("metadata", {}).get("category", "")
                            text = item.get("content_text", "")
                            header = (
                                f"[{category.upper()}] {title}"
                                if title
                                else f"[{category.upper()}]"
                            )
                            kb_snippets.append(f"- {header}: {text}")
                        kb_context = (
                            "\n\nINSTITUTE KNOWLEDGE BASE "
                            "(use this information when relevant to the student's question):\n"
                            + "\n".join(kb_snippets)
                        )
                        logger.info(
                            f"KB search found {len(kb_items)} relevant items "
                            f"for session {session_id}"
                        )
                except Exception as e:
                    logger.warning(f"KB search failed (non-critical): {e}")

                # Extract quiz submission data before session closes
                quiz_submission_data = msg_metadata.get("quiz_submission")
            # ── DB released ──

            # Handle quiz submission (manages its own sessions)
            if quiz_submission_data:
                logger.info(
                    f"Processing quiz submission for session {session_id}"
                )
                async for event in self._handle_quiz_submission(
                    session_id,
                    quiz_submission_data,
                    context,
                    institute_id,
                    user_id,
                    llm_client,
                ):
                    yield event
                return

            # Classify intent (no DB needed)
            explicit_intent = None
            if msg_metadata.get("intent"):
                explicit_intent = MessageIntent(msg_metadata["intent"])

            intent = self.intent_classifier.classify(
                message=latest_msg_content,
                explicit_intent=explicit_intent,
            )
            logger.info(f"Message intent for session {session_id}: {intent}")

            # Track doubt analytics
            if intent == MessageIntent.DOUBT:
                try:
                    topic = self.intent_classifier.get_practice_topic(
                        latest_msg_content, context
                    )
                    with self._get_db() as db:
                        LearningAnalyticsService(db).track_doubt(
                            user_id=user_id,
                            institute_id=institute_id,
                            topic=topic,
                            content=latest_msg_content,
                            session_id=session_id,
                        )
                except Exception as e:
                    logger.warning(f"Failed to track doubt analytics: {e}")

            # Handle PRACTICE intent (manages its own sessions)
            if intent == MessageIntent.PRACTICE:
                async for event in self._handle_practice_request(
                    session_id,
                    latest_msg_content,
                    context,
                    institute_id,
                    user_id,
                    llm_client,
                ):
                    yield event
                return

            # ── Phase 2: build prompt and run agentic loop ──

            system_prompt = self._build_system_prompt(
                institute_rules,
                context,
                user_id,
                institute_id,
                is_greeting=False,
                is_doubt=(intent == MessageIntent.DOUBT),
            )
            if kb_context:
                system_prompt += kb_context

            messages: List[Dict[str, Any]] = [
                {"role": "system", "content": system_prompt}
            ]
            messages.extend(optimized_history)

            # Add attachments to the latest user message if present
            if latest_msg_meta_data and latest_msg_meta_data.get("attachments"):
                for i in range(len(messages) - 1, -1, -1):
                    if messages[i].get("role") == "user":
                        messages[i]["attachments"] = latest_msg_meta_data[
                            "attachments"
                        ]
                        break

            max_iterations = 5
            iteration = 0
            tools = TOOL_DEFINITIONS

            while iteration < max_iterations:
                iteration += 1
                logger.info(
                    f"Agentic loop iteration {iteration} for session {session_id}"
                )

                # ── LLM call (no DB held!) ──
                try:
                    full_content = ""
                    tool_calls_result = None
                    usage_data = None

                    async for chunk in llm_client.chat_completion_stream(
                        messages=messages,
                        tools=tools,
                        temperature=temperature,
                        institute_id=institute_id,
                        user_id=user_id,
                    ):
                        if chunk["type"] == "token":
                            full_content += chunk["content"]
                            yield {
                                "event": "token",
                                "data": {"content": chunk["content"]},
                            }
                        elif chunk["type"] == "tool_calls":
                            tool_calls_result = chunk["tool_calls"]
                        elif chunk["type"] == "done":
                            usage_data = chunk

                    # Record token usage (opens its own session)
                    if usage_data:
                        self._record_token_usage(
                            {
                                "usage": usage_data.get("usage"),
                                "provider": usage_data.get("provider"),
                                "model": usage_data.get("model"),
                            },
                            institute_id,
                            user_id,
                        )

                except Exception as e:
                    logger.error(f"LLM call failed: {e}")
                    is_payment_error = (
                        "402" in str(e) or "Payment Required" in str(e)
                    )
                    if is_payment_error:
                        error_content = (
                            "AI service credits have been exhausted. "
                            "Please contact your administrator to add more credits."
                        )
                        logger.error(
                            f"OpenRouter 402 error for session {session_id}, "
                            f"institute {institute_id}: {e}"
                        )
                    else:
                        error_content = (
                            "I encountered an error processing your request. "
                            "Please try again."
                        )

                    yield {
                        "event": "error",
                        "data": {
                            "type": "ERROR",
                            "code": 402 if is_payment_error else 500,
                            "message": error_content,
                        },
                    }

                    with self._get_db() as db:
                        error_msg = ChatMessageRepository(db).create_message(
                            session_id=session_id,
                            message_type="assistant",
                            content=error_content,
                        )
                        error_data = _msg_event(error_msg)
                    yield {"event": "message", "data": error_data}
                    break

                tool_calls = tool_calls_result

                logger.info(
                    f"LLM response received for session {session_id}, "
                    f"tool_calls: {bool(tool_calls)}, content: {bool(full_content)}"
                )

                if not tool_calls:
                    # No tool calls — final response (tokens already streamed)
                    final_content = full_content
                    logger.info(
                        f"Final response for session {session_id}, "
                        f"content length: {len(final_content) if final_content else 0}"
                    )
                    if final_content:
                        logger.info(
                            f"Creating assistant message for session {session_id}"
                        )
                        with self._get_db() as db:
                            msg = ChatMessageRepository(db).create_message(
                                session_id=session_id,
                                message_type="assistant",
                                content=final_content,
                            )
                            msg_data = _msg_event(msg)
                        logger.info(
                            f"Created message {msg_data['id']}, yielding to SSE stream"
                        )
                        yield {"event": "message", "data": msg_data}
                    else:
                        logger.warning(
                            f"LLM returned empty content for session {session_id}"
                        )
                    break

                # ── Process tool calls ──
                for tool_call in tool_calls:
                    tool_name = tool_call["function"]["name"]
                    tool_args_str = tool_call["function"]["arguments"]

                    try:
                        tool_args = (
                            json.loads(tool_args_str)
                            if isinstance(tool_args_str, str)
                            else tool_args_str
                        )
                    except json.JSONDecodeError:
                        tool_args = {}

                    if "user_id" in tool_args and not tool_args["user_id"]:
                        tool_args["user_id"] = user_id

                    # Send engaging message before tool execution
                    engaging_messages = {
                        "get_learning_progress": "Let me check your progress! 🔍",
                        "get_student_feedback": "Looking up your feedback... 📝",
                        "search_related_resources": "Searching for helpful resources... 🔎",
                    }
                    engaging_msg_content = engaging_messages.get(
                        tool_name, "One moment, let me check that for you... ⏳"
                    )

                    with self._get_db() as db:
                        engaging_msg = ChatMessageRepository(db).create_message(
                            session_id=session_id,
                            message_type="assistant",
                            content=engaging_msg_content,
                        )
                        engaging_data = _msg_event(engaging_msg)
                    yield {"event": "message", "data": engaging_data}

                    # Execute tool (in its own short-lived session)
                    with self._get_db() as db:
                        cached_resolver = _CachedKeyResolver(keys)
                        embedding_service = EmbeddingService(cached_resolver)
                        rag_service = RAGService(db, embedding_service)
                        analytics_service = LearningAnalyticsService(db)
                        tool_manager = ToolManagerService(
                            db,
                            rag_service=rag_service,
                            analytics_service=analytics_service,
                        )
                        tool_result = await tool_manager.execute_tool(
                            tool_name, tool_args
                        )

                    # Save tool call and result messages
                    with self._get_db() as db:
                        message_repo = ChatMessageRepository(db)

                        tool_call_msg = message_repo.create_message(
                            session_id=session_id,
                            message_type="tool_call",
                            content=f"Calling tool: {tool_name}",
                            metadata={
                                "tool_name": tool_name,
                                "tool_arguments": tool_args,
                                "tool_call_id": tool_call["id"],
                            },
                        )
                        tool_call_data = _msg_event(tool_call_msg)

                        tool_result_msg = message_repo.create_message(
                            session_id=session_id,
                            message_type="tool_result",
                            content=tool_result,
                            metadata={
                                "tool_name": tool_name,
                                "tool_call_id": tool_call["id"],
                            },
                        )
                        tool_result_data = _msg_event(tool_result_msg)

                    yield {"event": "message", "data": tool_call_data}
                    yield {"event": "message", "data": tool_result_data}

                    # Append to conversation for next LLM call
                    messages.append(
                        {
                            "role": "assistant",
                            "content": None,
                            "tool_calls": [tool_call],
                        }
                    )
                    messages.append(
                        {
                            "role": "tool",
                            "content": tool_result,
                            "tool_call_id": tool_call["id"],
                            "name": tool_name,
                        }
                    )

                # Continue loop to process tool results

            # Update session last_active
            with self._get_db() as db:
                ChatSessionRepository(db).update_last_active(session_id)

            # Check if conversation needs summarisation
            # NOTE: generate_summary() calls the LLM while holding a DB session.
            # This is acceptable because it's rare and happens after main processing.
            try:
                with self._get_db() as db:
                    message_repo = ChatMessageRepository(db)
                    context_window = ContextWindowService(
                        db, message_repo, llm_client
                    )
                    if context_window.should_summarize(session_id):
                        await context_window.generate_summary(
                            session_id, institute_id, user_id
                        )
            except Exception as summary_err:
                logger.warning(
                    f"Non-critical: summary generation failed for "
                    f"{session_id}: {summary_err}"
                )

        except Exception as e:
            logger.error(
                f"Error in agentic processing for session {session_id}: {e}"
            )
            is_payment_error = (
                "402" in str(e) or "Payment Required" in str(e)
            )
            if is_payment_error:
                error_content = (
                    "AI service credits have been exhausted. "
                    "Please contact your administrator to add more credits."
                )
                logger.error(
                    f"OpenRouter 402 error for session {session_id}: {e}"
                )
            else:
                error_content = (
                    "I encountered an error processing your request. "
                    "Please try again."
                )

            yield {
                "event": "error",
                "data": {
                    "type": "ERROR",
                    "code": 402 if is_payment_error else 500,
                    "message": error_content,
                },
            }

            with self._get_db() as db:
                error_msg = ChatMessageRepository(db).create_message(
                    session_id=session_id,
                    message_type="assistant",
                    content=error_content,
                )
                error_data = _msg_event(error_msg)
            yield {"event": "message", "data": error_data}

    async def _handle_practice_request(
        self,
        session_id: str,
        user_message: str,
        context: Dict[str, Any],
        institute_id: str,
        user_id: str,
        llm_client: ChatLLMClient,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Handle PRACTICE intent — generate and send a quiz."""
        try:
            yield {"event": "status", "data": {"ai_status": "generating_quiz"}}

            topic = self.intent_classifier.get_practice_topic(
                user_message, context
            )

            # If topic is too generic, ask user to specify
            if topic in ("Current Topic", "current topic"):
                with self._get_db() as db:
                    ask_msg = ChatMessageRepository(db).create_message(
                        session_id=session_id,
                        message_type="assistant",
                        content=(
                            "What topic would you like to practice? "
                            "Please specify, for example:\n"
                            '- "Quiz me on quadratic equations"\n'
                            '- "Practice photosynthesis"\n'
                            '- "Test me on Newton\'s laws"'
                        ),
                    )
                    ask_data = _msg_event(ask_msg)
                yield {"event": "message", "data": ask_data}
                yield {"event": "status", "data": {"ai_status": "idle"}}
                return

            # Send engaging message
            with self._get_db() as db:
                prep_msg = ChatMessageRepository(db).create_message(
                    session_id=session_id,
                    message_type="assistant",
                    content=f"Great choice! Let me prepare a quiz on **{topic}** for you... 📝",
                )
                prep_data = _msg_event(prep_msg)
            yield {"event": "message", "data": prep_data}

            # Enrich context with user message
            quiz_context = dict(context)
            if "context_data" not in quiz_context:
                quiz_context["context_data"] = {}
            existing_content = quiz_context["context_data"].get("content", "")
            quiz_context["context_data"]["content"] = (
                f"{existing_content}\n\nUser's request: {user_message}"
                if existing_content
                else f"User's request: {user_message}"
            )

            # Generate quiz (LLM call — no DB held)
            quiz_service = QuizService(llm_client)
            quiz_data = await quiz_service.generate_quiz(
                topic=topic,
                context=quiz_context,
                num_questions=10,
                difficulty="medium",
                institute_id=institute_id,
                user_id=user_id,
            )

            # If quiz generation failed
            if not quiz_data.questions:
                with self._get_db() as db:
                    fallback_msg = ChatMessageRepository(db).create_message(
                        session_id=session_id,
                        message_type="assistant",
                        content=(
                            "I couldn't generate quiz questions for that. "
                            "Could you tell me the specific topic you'd like to practice? "
                            "For example:\n"
                            '- "Quiz me on quadratic equations"\n'
                            '- "Practice questions on photosynthesis"\n'
                            '- "Test me on Newton\'s laws"'
                        ),
                    )
                    fallback_data = _msg_event(fallback_msg)
                yield {"event": "message", "data": fallback_data}
                yield {"event": "status", "data": {"ai_status": "idle"}}
                return

            # Store quiz for later evaluation
            self._active_quizzes[session_id] = quiz_data

            # Prepare quiz data for frontend (strip correct answers)
            frontend_quiz_data = quiz_service.get_quiz_for_frontend(quiz_data)

            with self._get_db() as db:
                quiz_msg = ChatMessageRepository(db).create_message(
                    session_id=session_id,
                    message_type="quiz",
                    content=(
                        f"Here's your quiz on **{topic}**! "
                        f"Answer all {quiz_data.total_questions} questions "
                        "and submit when ready."
                    ),
                    metadata={"quiz_data": frontend_quiz_data},
                )
                quiz_data_dict = _msg_event(quiz_msg)
            yield {"event": "message", "data": quiz_data_dict}

            logger.info(
                f"Quiz generated for session {session_id}: {quiz_data.quiz_id}"
            )

        except Exception as e:
            logger.error(
                f"Error generating quiz for session {session_id}: {e}"
            )
            with self._get_db() as db:
                error_msg = ChatMessageRepository(db).create_message(
                    session_id=session_id,
                    message_type="assistant",
                    content=(
                        "I had trouble generating the quiz. Let me help you "
                        "understand the topic instead. What would you like to know?"
                    ),
                )
                error_data = _msg_event(error_msg)
            yield {"event": "message", "data": error_data}

    async def _handle_quiz_submission(
        self,
        session_id: str,
        submission_data: Dict[str, Any],
        context: Dict[str, Any],
        institute_id: str,
        user_id: str,
        llm_client: ChatLLMClient,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Handle quiz submission and generate feedback."""
        try:
            submission = QuizSubmission(**submission_data)

            quiz_data = self._active_quizzes.get(session_id)

            if not quiz_data or quiz_data.quiz_id != submission.quiz_id:
                logger.warning(
                    f"Quiz {submission.quiz_id} not found in active quizzes "
                    f"for session {session_id}"
                )
                with self._get_db() as db:
                    error_msg = ChatMessageRepository(db).create_message(
                        session_id=session_id,
                        message_type="assistant",
                        content=(
                            "I couldn't find that quiz. "
                            "Would you like to try a new practice quiz?"
                        ),
                    )
                    error_data = _msg_event(error_msg)
                yield {"event": "message", "data": error_data}
                return

            yield {"event": "status", "data": {"ai_status": "thinking"}}

            # Acknowledgment
            with self._get_db() as db:
                ack_msg = ChatMessageRepository(db).create_message(
                    session_id=session_id,
                    message_type="assistant",
                    content="Evaluating your answers... 🔍",
                )
                ack_data = _msg_event(ack_msg)
            yield {"event": "message", "data": ack_data}

            # Evaluate quiz (LLM call — no DB held)
            quiz_service = QuizService(llm_client)
            feedback = await quiz_service.evaluate_quiz(
                quiz_data=quiz_data,
                submission=submission,
                context=context,
                institute_id=institute_id,
                user_id=user_id,
            )

            # Track quiz score for analytics
            try:
                quiz_topic = quiz_data.topic if quiz_data else "Unknown"
                with self._get_db() as db:
                    LearningAnalyticsService(db).track_quiz_score(
                        user_id=user_id,
                        institute_id=institute_id,
                        topic=quiz_topic,
                        score=feedback.score,
                        total=feedback.total,
                        session_id=session_id,
                    )
            except Exception as e:
                logger.warning(f"Failed to track quiz score analytics: {e}")

            # Build result summary
            emoji = "🎉" if feedback.passed else "💪"
            result_text = f"""
## Quiz Results {emoji}

**Score:** {feedback.score}/{feedback.total} ({feedback.percentage}%)

**Status:** {"✅ Passed!" if feedback.passed else "Keep practicing!"}

{feedback.overall_feedback}
"""

            if feedback.recommendations:
                result_text += "\n\n**Recommendations:**\n"
                for rec in feedback.recommendations:
                    result_text += f"- {rec}\n"

            # Save feedback and follow-up messages
            with self._get_db() as db:
                message_repo = ChatMessageRepository(db)

                feedback_msg = message_repo.create_message(
                    session_id=session_id,
                    message_type="quiz_feedback",
                    content=result_text.strip(),
                    metadata={"feedback": feedback.model_dump()},
                )
                feedback_data = _msg_event(feedback_msg)

                followup_msg = message_repo.create_message(
                    session_id=session_id,
                    message_type="assistant",
                    content=(
                        "Would you like to **practice more**, or do you have "
                        "any **doubts** about the questions you got wrong?"
                    ),
                )
                followup_data = _msg_event(followup_msg)

            yield {"event": "message", "data": feedback_data}
            yield {"event": "message", "data": followup_data}

            # Clean up stored quiz
            if session_id in self._active_quizzes:
                del self._active_quizzes[session_id]

            logger.info(
                f"Quiz feedback sent for session {session_id}: "
                f"{feedback.score}/{feedback.total}"
            )

        except Exception as e:
            logger.error(
                f"Error processing quiz submission for session {session_id}: {e}"
            )
            with self._get_db() as db:
                error_msg = ChatMessageRepository(db).create_message(
                    session_id=session_id,
                    message_type="assistant",
                    content=(
                        "I had trouble evaluating your quiz. "
                        "Would you like to try again?"
                    ),
                )
                error_data = _msg_event(error_msg)
            yield {"event": "message", "data": error_data}

    def _build_system_prompt(self, institute_rules: str, context: Dict[str, Any], user_id: str, institute_id: str, is_greeting: bool = False, is_doubt: bool = False) -> str:
        """
        Build the system prompt combining institute rules and context.

        Args:
            is_greeting: If True, instructs AI to generate a personalized greeting
            is_doubt: If True, the user has a specific doubt - be more explanatory
        """
        import json

        # Extract user details
        user_details = context.get("user_details", {})
        user_name = user_details.get("name", "Student")
        user_email = user_details.get("email")

        # Build user identity section
        user_identity = f"""IMPORTANT - USER IDENTITY:
- Current User ID: {user_id}
- Current Institute ID: {institute_id}
- Student Name: {user_name}"""
        if user_email:
            user_identity += f"\n- Student Email: {user_email}"
        user_identity += """
- When you call tools that require user_id or institute_id, use these values above
- DO NOT ask the user for their user_id or institute_id - you already have them
- Address the student by their name naturally in conversation"""

        # Format context as JSON string
        context_str = json.dumps({
            "context_type": context.get("context_type"),
            "context_data": context.get("context_data"),
            "user_performance": context.get("user_performance")
        }, indent=2)

        # Extract assistant name from institute rules
        assistant_name = "your AI tutor"
        if "You are" in institute_rules:
            import re
            match = re.search(r'You are ([^,]+),', institute_rules)
            if match:
                assistant_name = match.group(1).strip()

        greeting_instruction = ""
        if is_greeting:
            greeting_instruction = f"""

SPECIAL INSTRUCTION - GENERATE GREETING:
This is the first message of the conversation. Generate a warm, personalized greeting for {user_name}.
- Introduce yourself using your name: "{assistant_name}"
- Use the student's name naturally
- Reference the current context (slide/course/general)
- Keep it friendly and encouraging (1-2 sentences)
- End with an open question to engage them
- Example: "Hi {user_name}! 👋 I'm {assistant_name}, here to help you master this topic. What would you like to explore first?"
"""

        prompt = f"""You are an AI educational tutor helping students learn. Your role is to guide students to understand concepts rather than just providing answers.

{user_identity}

{institute_rules}

CONTEXT INFORMATION:
{context_str}{greeting_instruction}

INSTRUCTIONS FOR USING CONTEXT:
The context above contains three key pieces of information:

1. CONTEXT DATA (context_type & context_data):
   - What the student is currently viewing (slide/course/general)
   - Specific content, materials, or topics they're working on
   - Their progress and difficulty level
   - Use this to understand what "this", "here", or "the slide" refers to

2. USER PERFORMANCE (user_performance):
   - Student's strengths: Topics/skills they excel at
   - Student's weaknesses: Topics/skills they struggle with
   - Overall performance metrics and improvement areas
   - Topics mastered vs topics they're struggling with
   - Use this when student asks about "my weaknesses", "my strengths", "what should I focus on", "give me feedback"

3. CONVERSATION HISTORY:
   - Last 5 user messages (system provides this separately)
   - Use for maintaining conversation context

HOW TO USE THIS INFORMATION:
- Reference specific slide content or course materials when relevant
- When student asks about their performance/weaknesses/strengths, use the user_performance data
- Tailor difficulty based on their known strengths and weaknesses
- If they're asking about a topic in their "weaknesses" list, provide extra support
- If they're asking about a topic in their "strengths" list, you can go deeper
- Suggest focus areas based on their improvement_areas or topics_struggling

RESPONSE FORMATTING - CRITICAL:
Your responses will be rendered as Markdown in a React frontend. Follow these formatting rules:

1. **Use Proper Markdown Syntax:**
   - Use actual line breaks (not \\n escape sequences)
   - Use `##` for headings, `**bold**`, `*italic*`, `- ` for lists
   - Use `---` for horizontal rules
   - Use ` ``` ` for code blocks
   - Use `> ` for blockquotes

2. **Rich Formatting When Appropriate:**
   When showing progress, data, or structured information, use Markdown tables, lists, or formatting:

   Example for progress:
   ```markdown
   ## Your Progress

   | Course | Progress | Status |
   |--------|----------|--------|
   | Biology | 75% | 🟢 On Track |
   | Math | 45% | 🟡 Needs Focus |

   ### What You Completed Today
   - ✅ Quiz 1 (100%)
   - ✅ Quiz 2 (100%)
   - ✅ Quiz 3 (100%)
   ```

3. **When to Use Rich Formatting:**
   - Progress reports: Use tables or formatted lists with emojis
   - Multiple items: Use bullet points or numbered lists
   - Comparisons: Use tables
   - Important info: Use **bold** or ## headings
   - Quotes or definitions: Use blockquotes
   - Step-by-step: Use numbered lists

4. **Keep It Simple When Not Needed:**
   - Regular explanations: Plain paragraphs
   - Simple answers: Short, direct text
   - Conversations: Natural, flowing text

5. **Response Length - Be Smart:**
   - Simple questions deserve simple answers:
     * "What's 2+2?" → "4"
     * "What does DNA stand for?" → "Deoxyribonucleic Acid"
     * "Is this correct?" → "Yes!" or "Not quite."
   - Complex questions deserve detailed explanations:
     * "Explain photosynthesis" → Full explanation with steps
     * "How do I solve this?" → Step-by-step guidance
     * "What's my progress?" → Detailed breakdown with tables
   - Match your response length to what the student needs:
     * Factual questions: 1-2 sentences
     * Conceptual questions: 2-4 paragraphs
     * Problem-solving: Step-by-step with examples

6. **General Response Guidelines:**
   - Be encouraging, supportive, and patient
   - Break down complex concepts into simpler parts
   - Ask guiding questions to help students think critically
   - Use analogies and examples to clarify difficult topics
   - Guide students through thinking rather than giving direct answers
   - Use tools when you need real-time information (grades, progress, resources, what's next)
   - Use a friendly, conversational tone

ADAPTIVE TEACHING:
- For topics in their weaknesses: Provide foundational explanations, check understanding frequently
- For topics in their strengths: Challenge with deeper questions, real-world applications
- If overall_performance is low: Be extra encouraging, break things down more
- If last_assessment_score is available: Reference it when discussing their progress

LEARNING PATH GUIDANCE:
When student asks "What's next?" or "What should I learn next?":
- Use get_learning_progress tool (includes next_recommendation)
- Check the "next_recommendation" field in the response
- If status is "next_available": Explain what they completed and what comes next with enthusiasm
- If status is "chapter_complete": Congratulate them and suggest exploring the next chapter
- Encourage continuous learning and acknowledge their progress
- Example: "Great work on 'Cell Structure'! Next up is 'Cell Division' which builds on what you just learned. Ready to continue? 🧬"

When student asks "What are my weaknesses?" or "What should I improve?":
- Refer to the weaknesses and topics_struggling from user_performance
- Be constructive and encouraging
- Suggest specific study strategies for each weakness
- Connect weaknesses to current context if relevant
"""
        return prompt.strip()


__all__ = ["AiChatAgentService"]
