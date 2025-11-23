from __future__ import annotations

from typing import Optional

from ..domain.course_metadata import CourseMetadata
from ..ports.course_metadata_port import CourseMetadataPort
from ..ports.llm_client import OutlineLLMClient
from ..schemas.course_outline import CourseOutlineRequest, CourseOutlineResponse
from .prompt_builder import CourseOutlinePromptBuilder
from .parser import CourseOutlineParser


class CourseOutlineGenerationService:
    """
    High-level orchestration service for course outline generation.

    This class follows SRP by coordinating collaborators that each have
    a focused responsibility:
      - CourseMetadataPort: load metadata from admin-core
      - CourseOutlinePromptBuilder: construct the LLM prompt
      - OutlineLLMClient: call the LLM provider
      - CourseOutlineParser: turn raw output into a typed response
    """

    def __init__(
        self,
        llm_client: OutlineLLMClient,
        metadata_port: CourseMetadataPort,
        prompt_builder: CourseOutlinePromptBuilder,
        parser: CourseOutlineParser,
    ) -> None:
        self._llm_client = llm_client
        self._metadata_port = metadata_port
        self._prompt_builder = prompt_builder
        self._parser = parser

    async def generate_outline(
        self, request: CourseOutlineRequest
    ) -> CourseOutlineResponse:
        metadata: Optional[CourseMetadata] = None

        if request.course_id:
            metadata = await self._metadata_port.load_course_metadata(
                course_id=request.course_id,
                institute_id=request.institute_id,
            )

        prompt = self._prompt_builder.build_prompt(request=request, metadata=metadata)

        raw_output = await self._llm_client.generate_outline(
            prompt=prompt,
            model=request.model,
        )

        return self._parser.parse(raw_output)

    async def stream_outline_events(
        self, request: CourseOutlineRequest, request_id: str
    ) -> AsyncGenerator[str, None]:
        """Generate outline using streaming and return SSE events (matches media-service pattern)."""
        metadata: Optional[CourseMetadata] = None

        if request.course_id:
            metadata = await self._metadata_port.load_course_metadata(
                course_id=request.course_id,
                institute_id=request.institute_id,
            )

        prompt = self._prompt_builder.build_prompt(request=request, metadata=metadata)

        # Send initial metadata event (matches media-service)
        yield f"```json {{\"requestId\": \"{request_id}\"}}```"

        # For now, get the complete response and yield it as a single event
        # This simulates streaming but uses non-streaming API call
        try:
            full_content = await self._llm_client.generate_outline(
                prompt=prompt,
                model=request.model,
            )

            # Yield some thinking-like events to simulate streaming
            yield "[Thinking...]\nPlanning the course structure based on your requirements..."

            yield "[Generating...]\nCreating the course outline with subjects, modules, and slides..."

            # Parse and yield the final result
            outline_response = self._parser.parse(full_content)

            # Yield the final processed outline as JSON (matches media-service pattern)
            import json
            yield json.dumps({
                "explanation": outline_response.explanation,
                "tree": [node.model_dump() for node in outline_response.tree],
                "todos": [todo.model_dump() for todo in outline_response.todos],
                "courseMetadata": outline_response.course_metadata.model_dump()
            })

        except Exception as e:
            yield f"[Error] Failed to generate outline: {str(e)}"


__all__ = ["CourseOutlineGenerationService"]


