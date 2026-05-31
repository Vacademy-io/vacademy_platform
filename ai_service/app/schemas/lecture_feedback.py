"""Lecture-feedback response schema — mirrors media_service LectureFeedbackDto
(+ nested). Plain Lombok @Data classes (no @JsonNaming) → camelCase wire keys,
reproduced via a camelCase alias generator (FastAPI serializes by alias).
"""
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class _CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="ignore")


class LectureInfoDto(_CamelModel):
    lecture_title: Optional[str] = None
    duration: Optional[str] = None
    evaluation_date: Optional[str] = None


class LectureFeedbackPointDto(_CamelModel):
    title: Optional[str] = None
    description: Optional[List[str]] = None


class LectureFeedbackCriteriaDto(_CamelModel):
    name: Optional[str] = None
    score: Optional[str] = None
    points: Optional[List[LectureFeedbackPointDto]] = None
    scope_of_improvement: Optional[List[str]] = None


class LectureFeedbackResponse(_CamelModel):
    """Mirror of media_service LectureFeedbackDto. Returned by
    GET /ai-service/task-status/get/lecture-feedback."""
    title: Optional[str] = None
    report_title: Optional[str] = None
    lecture_info: Optional[LectureInfoDto] = None
    total_score: Optional[str] = None
    criteria: Optional[List[LectureFeedbackCriteriaDto]] = None
    summary: Optional[List[str]] = None
