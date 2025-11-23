from __future__ import annotations

from functools import lru_cache

from .adapters.admin_core_client import AdminCoreCourseMetadataClient
from .adapters.openrouter_llm_client import OpenRouterOutlineLLMClient
from .ports.course_metadata_port import CourseMetadataPort
from .ports.llm_client import OutlineLLMClient
from .services.course_outline_service import CourseOutlineGenerationService
from .services.parser import CourseOutlineParser
from .services.prompt_builder import CourseOutlinePromptBuilder


@lru_cache(maxsize=1)
def get_llm_client() -> OutlineLLMClient:
    """
    Singleton OutlineLLMClient for the application.
    """
    return OpenRouterOutlineLLMClient()


@lru_cache(maxsize=1)
def get_course_metadata_port() -> CourseMetadataPort:
    """
    Singleton CourseMetadataPort for the application.
    """
    return AdminCoreCourseMetadataClient()


@lru_cache(maxsize=1)
def get_course_outline_service() -> CourseOutlineGenerationService:
    """
    High-level service dependency that wires up all collaborators.
    """
    llm_client = get_llm_client()
    metadata_port = get_course_metadata_port()
    prompt_builder = CourseOutlinePromptBuilder()
    parser = CourseOutlineParser()
    return CourseOutlineGenerationService(
        llm_client=llm_client,
        metadata_port=metadata_port,
        prompt_builder=prompt_builder,
        parser=parser,
    )


__all__ = ["get_course_outline_service"]



