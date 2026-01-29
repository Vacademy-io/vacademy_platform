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
from .services.content_generation_service import ContentGenerationService
from .services.ai_chat_service import AiChatService
from .services.youtube_service import YouTubeService
from .services.api_key_resolver import ApiKeyResolver
from .services.context_resolver_service import ContextResolverService
from .services.tool_manager_service import ToolManagerService
from .services.chat_llm_client import ChatLLMClient
from .services.institute_settings_service import InstituteSettingsService
from .services.ai_chat_agent_service import AiChatAgentService
from .config import get_settings
from .db import db_dependency
from sqlalchemy.orm import Session
from fastapi import Depends, Header, HTTPException, status
from typing import Optional


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


def get_course_outline_service(db: Session = Depends(db_dependency)) -> CourseOutlineGenerationService:
    """
    High-level service dependency that wires up all collaborators.
    Accepts DB session for API key resolution.
    """
    llm_client = get_llm_client()
    metadata_port = get_course_metadata_port()
    institute_settings_service = InstituteSettingsService(db)
    prompt_builder = CourseOutlinePromptBuilder(institute_settings_service)
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
        db_session=db,
        institute_settings_service=institute_settings_service,
    )


@lru_cache(maxsize=1)
def get_ai_chat_service() -> AiChatService:
    """
    Singleton AiChatService for the application.
    """
    llm_client = get_llm_client()
    return AiChatService(llm_client=llm_client)


def get_chat_agent_service(db: Session = Depends(db_dependency)) -> AiChatAgentService:
    """
    Chat Agent Service with all dependencies.
    Creates new instance per request to use fresh DB session.
    """
    # Create services with DB session
    context_resolver = ContextResolverService(db)
    tool_manager = ToolManagerService(db)
    institute_settings = InstituteSettingsService(db)
    
    # Create API key resolver and LLM client
    api_key_resolver = ApiKeyResolver(db)
    llm_client = ChatLLMClient(api_key_resolver)
    
    # Create and return chat agent service
    return AiChatAgentService(
        db_session=db,
        context_resolver=context_resolver,
        tool_manager=tool_manager,
        llm_client=llm_client,
        institute_settings=institute_settings,
    )



def get_institute_from_api_key(
    x_institute_key: str = Header(..., description="API Key for Institute Authentication"),
    db: Session = Depends(db_dependency)
) -> str:
    """
    Validate API key and return institute_id.
    """
    settings_service = InstituteSettingsService(db)
    institute_id = settings_service.validate_api_key(x_institute_key)
    
    if not institute_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or inactive API Key"
        )
    return institute_id

__all__ = ["get_course_outline_service", "get_image_service", "get_ai_chat_service", "get_chat_agent_service", "get_institute_from_api_key"]



