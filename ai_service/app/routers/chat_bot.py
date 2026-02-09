from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..schemas.chat_bot import ChatRequest, ChatResponse
from ..services.ai_chat_service import AiChatService
from ..dependencies import get_ai_chat_service
from ..db import db_dependency

router = APIRouter(prefix="/chat", tags=["ai-chat"])

@router.post(
    "/v1/ask",
    response_model=ChatResponse,
    summary="Ask a question to the AI Tutor",
    description="Generates an MDX response to the student's prompt, using the provided context."
)
async def ask_ai_tutor(
    request: ChatRequest,
    service: AiChatService = Depends(get_ai_chat_service),
    db: Session = Depends(db_dependency)
) -> ChatResponse:
    """
    Ask the AI Tutor a question.
    
    Optionally include `institute_id` and `user_id` in the request body
    to enable credit deduction and usage tracking.
    """
    return await service.generate_chat_response(request, db_session=db)

__all__ = ["router"]

