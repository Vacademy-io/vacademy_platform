"""Chat-with-PDF router — migrated from media_service ChatWithPdfController.

  GET /ai-service/ai/chat-with-pdf/get-response   (one chat turn → full history)
  GET /ai-service/ai/chat-with-pdf/get-chat       (one thread by parentId)
  GET /ai-service/ai/chat-with-pdf/get/chat-list  (parentless sessions, an institute)

All three are GET with query params (no request body), matching Java.

Still-processing contract: when the PDF's MathPix conversion isn't done yet,
get-response returns 425 (not a 2xx). The redesigned FE (PlayWithPDF) drives its
retry loop through the axios error path — a non-2xx makes axios reject → onError
→ re-poll every 10s up to 10×. (Java returned 202-with-body here, which the
redesigned FE would mis-handle as a success payload; 425 is the correct pairing
for the new client and is consistent with this service's pdf-to-html endpoint.)
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..core.security import get_optional_user
from ..db import db_dependency
from ..schemas.chat_with_pdf import ChatWithPdfResponse
from ..services import chat_with_pdf_service
from ..services.model_selection import resolve_models
from ..services.pdf_questions_service import StillProcessing

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai/chat-with-pdf", tags=["AI Chat with PDF"])


@router.get(
    "/get-response",
    response_model=List[ChatWithPdfResponse],
    response_model_exclude_none=False,
)
async def get_response(
    pdfId: str = Query(...),
    userPrompt: str = Query(...),
    taskName: Optional[str] = Query(None),
    instituteId: Optional[str] = Query(None),
    parentId: Optional[str] = Query(None),
    preferredModel: Optional[str] = Query(None),
    db: Session = Depends(db_dependency),
    user=Depends(get_optional_user),
) -> List[Dict[str, Any]]:
    """Generate one AI answer for a chat turn over the PDF, persist it, and
    return the full ordered chat history for the PDF."""
    primary_model, fallback_models = resolve_models(
        db, chat_with_pdf_service.CHAT_USE_CASE, preferredModel
    )
    user_id = getattr(user, "user_id", None)
    try:
        return await chat_with_pdf_service.generate_chat_response(
            pdf_id=pdfId,
            user_prompt=userPrompt,
            task_name=taskName or "",
            institute_id=instituteId,
            parent_id=parentId,
            models=[primary_model, *fallback_models],
            user_id=user_id,
        )
    except StillProcessing:
        raise HTTPException(
            status_code=status.HTTP_425_TOO_EARLY,
            detail=f"PDF {pdfId} is still processing",
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("chat-with-pdf get-response failed")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))


@router.get(
    "/get-chat",
    response_model=List[ChatWithPdfResponse],
    response_model_exclude_none=False,
)
def get_previous_chat(
    parentId: str = Query(...),
    db: Session = Depends(db_dependency),
) -> List[Dict[str, Any]]:
    """Read back one conversation thread (head row + its children)."""
    return chat_with_pdf_service.get_thread(db, parentId)


@router.get("/get/chat-list")
def get_chat_list(
    instituteId: str = Query(...),
    db: Session = Depends(db_dependency),
) -> List[Dict[str, Any]]:
    """List all top-level chat sessions for an institute (TaskStatusDto shape)."""
    return chat_with_pdf_service.list_chat_sessions(db, instituteId)
