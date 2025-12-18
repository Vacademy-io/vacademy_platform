from __future__ import annotations

from functools import lru_cache

from .adapters.admin_core_client import AdminCoreCourseMetadataClient
from .adapters.openrouter_llm_client import OpenRouterOutlineLLMClient
from .ports.course_metadata_port import CourseMetadataPort
from .ports.llm_client import OutlineLLMClient
from .services.course_outline_service import CourseOutlineGenerationService
from .services.parser import CourseOutlineParser
from .services.prompt_builder import CourseOutlinePromptBuilder
from .services.image_service import ImageGenerationService
from .services.content_generation_service import ContentGenerationService
from .services.youtube_service import YouTubeService
from .config import get_settings


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
def get_image_service() -> ImageGenerationService:
    """
    Singleton ImageGenerationService for the application.
    
    Initializes with S3 configuration from environment variables.
    If S3 is not configured, image generation will be skipped gracefully.
    """
    settings = get_settings()

    # Initialize S3 client only if credentials are provided
    s3_client = None
    if settings.s3_aws_access_key and settings.s3_aws_access_secret and settings.s3_aws_region:
        try:
            import boto3
            s3_client = boto3.client(
                's3',
                aws_access_key_id=settings.s3_aws_access_key,
                aws_secret_access_key=settings.s3_aws_access_secret,
                region_name=settings.s3_aws_region
            )
        except Exception as e:
            s3_client = None
    
    return ImageGenerationService(
        s3_client=s3_client,
        s3_bucket=settings.aws_bucket_name,
        gemini_api_key=settings.gemini_api_key,
        openrouter_api_key=settings.openrouter_api_key,
        llm_model=settings.llm_default_model
    )


@lru_cache(maxsize=1)
def get_youtube_service() -> YouTubeService:
    """
    Singleton YouTubeService for the application.
    """
    settings = get_settings()
    return YouTubeService(api_key=settings.youtube_api_key)


@lru_cache(maxsize=1)
def get_content_generation_service() -> ContentGenerationService:
    """
    Singleton ContentGenerationService for the application.
    """
    llm_client = get_llm_client()
    youtube_service = get_youtube_service()
    return ContentGenerationService(llm_client=llm_client, youtube_service=youtube_service)


@lru_cache(maxsize=1)
def get_course_outline_service() -> CourseOutlineGenerationService:
    """
    High-level service dependency that wires up all collaborators.
    """
    llm_client = get_llm_client()
    metadata_port = get_course_metadata_port()
    prompt_builder = CourseOutlinePromptBuilder()
    parser = CourseOutlineParser()
    image_service = get_image_service()
    content_generation_service = get_content_generation_service()
    return CourseOutlineGenerationService(
        llm_client=llm_client,
        metadata_port=metadata_port,
        prompt_builder=prompt_builder,
        parser=parser,
        image_service=image_service,
        content_generation_service=content_generation_service,
    )


__all__ = ["get_course_outline_service", "get_image_service"]



