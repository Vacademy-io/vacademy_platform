from __future__ import annotations
import logging
from typing import Optional
from sqlalchemy.orm import Session
from ..ports.llm_client import OutlineLLMClient
from ..schemas.chat_bot import ChatRequest, ChatResponse
from .chat_prompts import ChatPrompts
from ..models.ai_token_usage import ApiProvider, RequestType

logger = logging.getLogger(__name__)

class AiChatService:
    """
    Service for handling AI Chat Bot interactions.
    """

    def __init__(
        self, 
        llm_client: OutlineLLMClient,
        db_session: Optional[Session] = None
    ) -> None:
        self._llm_client = llm_client
        self._db_session = db_session
        # TODO: Allow configuring a specific chat model via settings if needed
        self._model = None 

    async def generate_chat_response(self, request: ChatRequest, db_session: Optional[Session] = None) -> ChatResponse:
        """
        Generates a response to the student's prompt using the LLM.
        """
        session = db_session or self._db_session
        
        try:
            logger.info(f"Generating chat response for prompt: {request.prompt[:50]}...")
            
            # Build the prompt
            prompt = ChatPrompts.build_chat_prompt(request.prompt, request.context)
            
            # Call LLM with usage tracking
            content, usage = await self._llm_client.generate_outline_with_usage(
                prompt=prompt,
                model=self._model
            )
            
            # Record token usage and deduct credits
            if session and usage:
                try:
                    from .token_usage_service import TokenUsageService
                    token_service = TokenUsageService(session)
                    token_service.record_usage_and_deduct_credits(
                        api_provider=ApiProvider.OPENAI,  # OpenRouter uses OpenAI-compatible format
                        prompt_tokens=usage.get("prompt_tokens", 0),
                        completion_tokens=usage.get("completion_tokens", 0),
                        total_tokens=usage.get("total_tokens", 0),
                        request_type=RequestType.COPILOT,  # Chat is a copilot-type request
                        institute_id=request.institute_id,
                        user_id=request.user_id,
                        model=self._model or "default",
                    )
                    logger.info(f"Recorded chat usage: {usage.get('total_tokens', 0)} tokens for institute {request.institute_id}")
                except Exception as e:
                    logger.warning(f"Failed to record token usage: {e}")
            
            return ChatResponse(content=content)
            
        except Exception as e:
            logger.error(f"Error generating chat response: {e}")
            # Return a friendly error message instead of crashing
            return ChatResponse(
                content="I'm sorry, I encountered an error while processing your request. Please try again later."
            )

__all__ = ["AiChatService"]

