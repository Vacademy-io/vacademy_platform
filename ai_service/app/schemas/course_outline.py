from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class GenerationOptions(BaseModel):
    """
    Optional configuration for course outline generation.
    Allows fine-grained control over generation behavior.
    """
    num_slides: Optional[int] = Field(
        default=None,
        description="Target number of slides to generate (overrides user_prompt specification)"
    )
    num_chapters: Optional[int] = Field(
        default=None,
        description="Target number of chapters to generate (only for depth >= 3)"
    )
    generate_images: bool = Field(
        default=False,
        description="Whether to generate course_banner_image and course_preview_image (S3 URLs)"
    )
    image_style: Optional[str] = Field(
        default="professional",
        description="Style for generated images (e.g., 'professional', 'creative', 'minimalist')"
    )


class CourseUserPromptRequest(BaseModel):
    """
    Request schema matching media-service CourseUserPrompt format.
    """
    user_prompt: str = Field(..., description="High-level user prompt / goal for the course")
    course_tree: Optional[str] = Field(default=None, description="Existing course tree JSON string")
    course_depth: Optional[int] = Field(default=None, description="Desired course depth (2-5), auto-determined if not specified")
    generation_options: Optional[GenerationOptions] = Field(
        default=None,
        description="Optional generation configuration (slides, chapters, images, etc.)"
    )


class CourseOutlineRequest(BaseModel):
    """
    Input contract for generating a course outline.

    This is intentionally generic so callers from different services
    (media-service, admin-core-service, frontend) can reuse it.
    """

    institute_id: str = Field(..., description="Institute identifier")
    user_prompt: str = Field(..., description="High-level user prompt / goal for the course")
    course_id: Optional[str] = Field(
        default=None,
        description="Existing course identifier in admin-core-service (optional)",
    )
    existing_course_tree: Optional[dict] = Field(
        default=None,
        description="Existing course tree JSON, if any, to be refined or extended",
    )
    model: Optional[str] = Field(
        default=None,
        description="LLM model identifier; falls back to service default when omitted",
    )
    course_depth: Optional[int] = Field(
        default=None,
        description="Desired course depth (2-5); AI determines optimal depth if not specified",
    )
    generation_options: Optional[GenerationOptions] = Field(
        default=None,
        description="Optional generation configuration (slides, chapters, images, etc.)",
    )


class CourseNode(BaseModel):
    """
    Abstract node in the course outline tree.
    Types are kept stringly-typed to keep the JSON contract flexible.
    """

    id: Optional[str] = Field(default=None, description="Optional node identifier")
    type: Literal["COURSE", "SUBJECT", "MODULE", "CHAPTER", "SLIDE"]
    title: str
    path: str = Field(
        ...,
        description="Stable hierarchical path (e.g. COURSE/subject-1/module-1/chapter-2/slide-3)",
    )
    order: Optional[int] = Field(
        default=None,
        description="Ordering among siblings; optional for callers that don't care",
    )
    children: List["CourseNode"] = Field(
        default_factory=list,
        description="Child nodes (subjects, modules, chapters, slides, depending on type)",
    )
    # Hierarchical names for slides in deeper depths
    subject_name: Optional[str] = Field(
        default=None,
        description="Subject name (only populated for SLIDE nodes in depth 5)"
    )
    module_name: Optional[str] = Field(
        default=None,
        description="Module name (only populated for SLIDE nodes in depth 4-5)"
    )
    chapter_name: Optional[str] = Field(
        default=None,
        description="Chapter name (only populated for SLIDE nodes in depth 3-5)"
    )


class Todo(BaseModel):
    """
    Work items for downstream slide-content generation (matches media-service format).
    """

    name: str
    title: str
    type: str
    path: str
    keyword: Optional[str] = None
    model: Optional[str] = None
    action_type: str
    prompt: str
    order: Optional[int] = None
    # Hierarchical names for todos based on depth
    subject_name: Optional[str] = Field(
        default=None,
        description="Subject name (only populated for depth 5 todos)"
    )
    module_name: Optional[str] = Field(
        default=None,
        description="Module name (only populated for depth 4-5 todos)"
    )
    chapter_name: Optional[str] = Field(
        default=None,
        description="Chapter name (only populated for depth 3-5 todos)"
    )


class CourseMetadata(BaseModel):
    """
    Course metadata for course creation (matches AddCourseDTO fields).
    """
    course_name: str = Field(..., description="Engaging course title")
    about_the_course_html: str = Field(..., description="HTML description of course content")
    why_learn_html: str = Field(..., description="HTML explanation of learning benefits")
    who_should_learn_html: str = Field(..., description="HTML description of target audience")
    course_banner_media_id: str = Field(..., description="Banner image filename")
    course_preview_image_media_id: str = Field(..., description="Preview image filename")
    tags: List[str] = Field(default_factory=list, description="Course tags")
    course_depth: int = Field(..., description="Course hierarchy depth (2-5)")
    banner_image_url: Optional[str] = Field(
        default=None,
        description="Generated banner image S3 URL (if generate_images was true)"
    )
    preview_image_url: Optional[str] = Field(
        default=None,
        description="Generated preview image S3 URL (if generate_images was true)"
    )
    media_image_url: Optional[str] = Field(
        default=None,
        description="Generated media image S3 URL (if generate_images was true)"
    )


class CourseOutlineResponse(BaseModel):
    """
    Output contract for AI-generated course outline.
    """

    explanation: str = Field(
        ...,
        description="Natural language explanation of the structure and design choices",
    )
    tree: List[CourseNode] = Field(
        default_factory=list, description="Hierarchical course outline"
    )
    todos: List[Todo] = Field(
        default_factory=list,
        description="Slide-level tasks for separate content generation",
    )
    course_metadata: CourseMetadata = Field(
        ...,
        description="Course metadata for course creation",
    )


class ContentGenerationRequest(BaseModel):
    """
    Request schema for generating content from an existing coursetree.
    Frontend will call this endpoint with the coursetree from the outline API.
    
    You can send either:
    1. Full outline response: {"explanation": "...", "tree": [...], "todos": [...], "courseMetadata": {...}}
    2. Just todos: {"todos": [...]}
    3. Direct todos array: [...]
    
    The endpoint will extract and use only the todos array.
    """
    course_tree: dict = Field(
        ...,
        description="Course tree JSON from outline API response. Can be full response or just {'todos': [...]}. Only 'todos' array is used."
    )
    institute_id: Optional[str] = Field(
        default=None,
        description="Institute identifier (optional, for logging/context)"
    )


__all__ = [
    "GenerationOptions",
    "CourseUserPromptRequest",
    "CourseOutlineRequest",
    "CourseNode",
    "Todo",
    "CourseMetadata",
    "CourseOutlineResponse",
    "ContentGenerationRequest",
]


