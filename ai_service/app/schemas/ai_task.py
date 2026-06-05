"""
Pydantic schemas for the migrated AI task endpoints.

The lecture-plan response mirrors media_service `LecturePlanDto` exactly. The
Java DTO is a plain Lombok `@Data` class (no @JsonNaming), so its JSON keys are
the field names verbatim — camelCase. We reproduce that with a camelCase alias
generator; FastAPI serializes responses by alias by default, so the wire shape
matches byte-for-byte.
"""
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, ConfigDict, field_validator
from pydantic.alias_generators import to_camel


class _CamelModel(BaseModel):
    """Base: snake_case fields in Python, camelCase on the wire. Accepts either
    spelling on input (populate_by_name) so we can parse raw LLM JSON that uses
    the camelCase keys from the prompt template."""
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class TimeSplitSection(_CamelModel):
    section_heading: Optional[str] = None
    time_split: Optional[str] = None
    content: Optional[str] = None
    topic_covered: Optional[List[str]] = None
    question_to_students: Optional[List[str]] = None
    activity: Optional[List[str]] = None


class Assignment(_CamelModel):
    topic_covered: Optional[List[str]] = None
    tasks: Optional[List[str]] = None


class LecturePlanResponse(_CamelModel):
    """Mirror of media_service LecturePlanDto. Returned by
    GET /ai-service/task-status/get/lecture-plan."""
    heading: Optional[str] = None
    mode: Optional[str] = None
    duration: Optional[str] = None
    language: Optional[str] = None
    level: Optional[str] = None
    time_wise_split: Optional[List[TimeSplitSection]] = None
    assignment: Optional[Assignment] = None
    summary: Optional[List[str]] = None

    @field_validator("heading", "mode", "duration", "language", "level", mode="before")
    @classmethod
    def _coerce_scalar_to_str(cls, v):
        """The lecture-planner LLM sometimes emits scalar string fields as
        numbers (observed: `level: 8`). Pydantic v2 won't coerce int→str, so the
        whole plan validation hard-fails and the user gets a blank lecture plan.
        Coerce numeric/bool scalars to str before validation."""
        if isinstance(v, (int, float, bool)):
            return str(v)
        return v


class LecturePlanKickoffResponse(BaseModel):
    """Mirror of AiLectureController#getLecturePlanner response. Field names are
    already camelCase/lowercase, so no alias machinery needed."""
    taskId: str
    status: str = "STARTED"
    model: str
    message: str = "Lecture plan generation started"


class LectureFeedbackKickoffResponse(BaseModel):
    """Kick-off response for lecture feedback. Mirrors the plan kick-off shape;
    `fileId` echoes the migrated single-step input (the audio file id) in place
    of the old AssemblyAI `audioId`."""
    taskId: str
    fileId: str
    status: str = "STARTED"
    model: str
    message: str = "Lecture feedback generation started"
