from fastapi import APIRouter, Depends, HTTPException
from ..schemas.chat_bot import ChatRequest, ChatResponse
from ..services.ai_chat_service import AiChatService
from ..dependencies import get_ai_chat_service

router = APIRouter(prefix="/chat", tags=["ai-chat"])

@router.post(
    "/v1/ask",
    response_model=ChatResponse,
    summary="Ask a question to the AI Tutor",
    description="Generates an MDX response to the student's prompt, using the provided context."
)
async def ask_ai_tutor(
    request: ChatRequest,
    service: AiChatService = Depends(get_ai_chat_service)
) -> ChatResponse:
    """
    Ask the AI Tutor a question.
    """
    return await service.generate_chat_response(request)

__all__ = ["router"]
