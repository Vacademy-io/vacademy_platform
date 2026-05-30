"""Question-metadata schemas — mirror media_service
QuestionMetadataExtractorRequest / QuestionMetadataExtractorResponse.

Casing asymmetry (the key trap): the REQUEST is snake_case via @JsonNaming, so
the wire keys are id_and_topics / preview_id_and_question_text. The RESPONSE has
NO naming strategy — its wire keys are the literal Java field identifiers
(questions, question_id, topic_ids, tags, difficulty, problem_type). Both happen
to be snake_case here, so plain snake_case field names reproduce both exactly
(no alias generator needed).
"""
from __future__ import annotations

from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class QuestionMetadataExtractRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id_and_topics: Dict[str, str] = Field(default_factory=dict)
    preview_id_and_question_text: Dict[str, str] = Field(default_factory=dict)
    institute_id: Optional[str] = None  # not in Java DTO; captured for billing if FE sends it


class QuestionMetadataItem(BaseModel):
    """Bounded re-projection: only these 5 keys survive (extras dropped), nulls
    kept — matches Java readValue→re-serialize."""
    model_config = ConfigDict(extra="ignore")
    question_id: Optional[str] = None
    topic_ids: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    difficulty: Optional[str] = None
    problem_type: Optional[str] = None


class QuestionMetadataExtractResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    questions: Optional[List[QuestionMetadataItem]] = None
