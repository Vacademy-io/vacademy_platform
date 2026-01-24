from __future__ import annotations
import logging
from ..ports.llm_client import OutlineLLMClient
from ..schemas.chat_bot import ChatRequest, ChatResponse
from .chat_prompts import ChatPrompts

logger = logging.getLogger(__name__)

class AiChatService:
    """
    Service for handling AI Chat Bot interactions.
    """

    def __init__(self, llm_client: OutlineLLMClient) -> None:
        self._llm_client = llm_client
        # TODO: Allow configuring a specific chat model via settings if needed
        self._model = None 

    async def generate_chat_response(self, request: ChatRequest) -> ChatResponse:
        """
        Generates a response to the student's prompt using the LLM.
        """
        try:
            logger.info(f"Generating chat response for prompt: {request.prompt[:50]}...")
            
            # Build the prompt
            prompt = ChatPrompts.build_chat_prompt(request.prompt, request.context)
            
            # Call LLM
            # The generic client returns a string (the content)
            response_content = await self._llm_client.generate_outline(
                prompt=prompt,
                model=self._model
            )
            
            # TODO: Add post-processing if needed (e.g., sanitizing MDX)
            
            return ChatResponse(content=response_content)
            
        except Exception as e:
            logger.error(f"Error generating chat response: {e}")
            # Return a friendly error message instead of crashing
            return ChatResponse(
                content="I'm sorry, I encountered an error while processing your request. Please try again later."
            )

__all__ = ["AiChatService"]
