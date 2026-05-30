"""Evaluation-tool schemas — mirror media_service evaluation_ai DTOs.

EvaluationUserDTO (request body element) and EvaluationRequestResponse (kickoff
+ status response) are both @JsonNaming(SnakeCaseStrategy) in Java, so their JSON
keys are snake_case. The `response` field carries the serialized
EvaluationResultFromDeepSeek JSON as a STRING (the FE JSON.parses it and reads
`.evaluation_data`).
"""
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class EvaluationUserDTO(BaseModel):
    """One student in the evaluate-assessment request body. Snake_case keys,
    matching what the FE sends (id/response_id/full_name/email/contact_number)
    and media's @JsonNaming(SnakeCaseStrategy) EvaluationUserDTO. Unknown keys
    are ignored."""

    model_config = ConfigDict(extra="ignore")

    id: Optional[str] = None
    response_id: Optional[str] = None
    full_name: Optional[str] = None
    email: Optional[str] = None
    contact_number: Optional[str] = None


class EvaluationRequestResponse(BaseModel):
    """Kickoff + status response. `response` is a JSON string (the serialized
    EvaluationResultFromDeepSeek)."""

    task_id: Optional[str] = None
    response: Optional[str] = None
    status: Optional[str] = None


# Re-export the request body type alias for the router.
EvaluationRequestBody = List[EvaluationUserDTO]
