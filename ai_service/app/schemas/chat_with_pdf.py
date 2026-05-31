"""Chat-with-PDF response schema — mirrors media_service
ChatWithPdfResponse (@JsonNaming SnakeCaseStrategy).

Java fields id/createdAt/question/response/parentId serialize to snake_case
keys id/created_at/question/response/parent_id. The Python fields are already
snake_case, so the JSON contract matches the FE byte-for-byte.

Per TaskStatus.getPdfChatResponse, parent_id is intentionally left null in the
get-response / get-chat payloads (the FE never reads it off chat items).
"""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class ChatWithPdfResponse(BaseModel):
    id: Optional[str] = None
    created_at: Optional[str] = None
    question: Optional[str] = None
    response: Optional[str] = None
    parent_id: Optional[str] = None
