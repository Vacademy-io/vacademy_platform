from __future__ import annotations

import json
import logging
import asyncio
from typing import Optional, AsyncGenerator

from ..domain.course_metadata import CourseMetadata
from ..ports.course_metadata_port import CourseMetadataPort
from ..ports.llm_client import OutlineLLMClient
from ..schemas.course_outline import CourseOutlineRequest, CourseOutlineResponse, Todo
from .prompt_builder import CourseOutlinePromptBuilder
from .parser import CourseOutlineParser
from .image_service import ImageGenerationService
from .content_generation_service import ContentGenerationService
from .api_key_resolver import ApiKeyResolver
from .token_usage_service import TokenUsageService
from .institute_settings_service import InstituteSettingsService
from ..models.ai_token_usage import ApiProvider, RequestType
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class CourseOutlineGenerationService:
    """
    High-level orchestration service for course outline generation.

    This class follows SRP by coordinating collaborators that each have
    a focused responsibility:
      - CourseMetadataPort: load metadata from admin-core
      - CourseOutlinePromptBuilder: construct the LLM prompt
      - OutlineLLMClient: call the LLM provider
      - CourseOutlineParser: turn raw output into a typed response
      - ImageGenerationService: generate and upload course images (optional)
    """

    def __init__(
        self,
        llm_client: OutlineLLMClient,
        metadata_port: CourseMetadataPort,
        prompt_builder: CourseOutlinePromptBuilder,
        parser: CourseOutlineParser,
        image_service: Optional[ImageGenerationService] = None,
        content_generation_service: Optional[ContentGenerationService] = None,
        db_session: Optional[Session] = None,
        institute_settings_service: Optional[InstituteSettingsService] = None,
    ) -> None:
        self._llm_client = llm_client
        self._metadata_port = metadata_port
        self._prompt_builder = prompt_builder
        self._parser = parser
        self._image_service = image_service or ImageGenerationService()
        self._content_generation_service = content_generation_service
        self._db_session = db_session
        self._institute_settings_service = institute_settings_service
        self._llm_client = llm_client  # Store for content generation service
        # Note: content_generation_service will be initialized later in generate_content_from_coursetree if needed

    async def generate_outline(
        self, request: CourseOutlineRequest
    ) -> CourseOutlineResponse:
        metadata: Optional[CourseMetadata] = None

        if request.course_id:
            metadata = await self._metadata_port.load_course_metadata(
                course_id=request.course_id,
                institute_id=request.institute_id,
            )

        # Get institute AI course prompt
        ai_course_prompt = None
        if self._institute_settings_service and self._db_session:
            try:
                ai_settings = self._institute_settings_service.get_ai_course_settings(request.institute_id)
                ai_course_prompt = ai_settings.get("AI_COURSE_PROMPT")
            except Exception as e:
                logger.warning(f"Failed to fetch AI course prompt for institute {request.institute_id}: {str(e)}")

        prompt = self._prompt_builder.build_prompt(
            request=request,
            metadata=metadata,
            ai_course_prompt=ai_course_prompt
        )

        # Resolve API keys (request -> database -> defaults)
        openai_key = None
        gemini_key = None
        model = request.model
        
        if self._db_session:
            try:
                key_resolver = ApiKeyResolver(self._db_session)
                openai_key, gemini_key, model = key_resolver.resolve_keys(
                    institute_id=request.institute_id,
                    user_id=request.user_id,
                    request_model=request.model
                )
            except Exception as e:
                logger.warning(f"Failed to resolve API keys: {str(e)}, using environment defaults")
                # Fallback to environment defaults
                from ..config import get_settings
                settings = get_settings()
                openai_key = settings.openrouter_api_key
                gemini_key = settings.gemini_api_key
                model = request.model or settings.llm_default_model
        else:
            # No DB session, use environment defaults only
            from ..config import get_settings
            settings = get_settings()
            openai_key = settings.openrouter_api_key
            gemini_key = settings.gemini_api_key
            model = request.model or settings.llm_default_model

        # Generate outline and capture token usage
        if hasattr(self._llm_client, 'generate_outline_with_usage'):
            raw_output, usage_info = await self._llm_client.generate_outline_with_usage(
                prompt=prompt,
                model=model,
                api_key=openai_key,
            )
            
            # Record token usage
            if self._db_session and usage_info:
                try:
                    token_service = TokenUsageService(self._db_session)
                    token_service.record_usage_and_deduct_credits(
                        api_provider=ApiProvider.OPENAI,
                        prompt_tokens=usage_info.get("prompt_tokens", 0),
                        completion_tokens=usage_info.get("completion_tokens", 0),
                        total_tokens=usage_info.get("total_tokens", 0),
                        request_type=RequestType.OUTLINE,
                        institute_id=request.institute_id,
                        user_id=request.user_id,
                        model=model,
                    )
                except Exception as e:
                    logger.warning(f"Failed to record token usage: {str(e)}")
        else:
            # Fallback for clients that don't support usage tracking
            raw_output = await self._llm_client.generate_outline(
                prompt=prompt,
                model=model,
                api_key=openai_key,
            )

        outline_response = self._parser.parse(raw_output)

        # Check if practice problems/solutions are requested and add homework slides
        outline_response = self._add_homework_slides_if_needed(outline_response, request.user_prompt)

        # Generate images if requested AND parsing was successful
        # Skip image generation if course_name is "Error" (indicates parsing failure)
        if (request.generation_options and 
            request.generation_options.generate_images and
            outline_response.course_metadata.course_name and
            outline_response.course_metadata.course_name.lower() != "error" and
            len(outline_response.course_metadata.course_name.strip()) > 0):
            try:
                banner_url, preview_url, media_url, image_usage = await self._image_service.generate_images(
                    course_name=outline_response.course_metadata.course_name,
                    about_course=outline_response.course_metadata.about_the_course_html,
                    course_depth=outline_response.course_metadata.course_depth,
                    image_style=request.generation_options.image_style or "professional",
                    gemini_key=gemini_key
                )
                
                # Record image generation token usage
                if self._db_session and image_usage and image_usage.get("total_tokens", 0) > 0:
                    try:
                        token_service = TokenUsageService(self._db_session)
                        token_service.record_usage_and_deduct_credits(
                            api_provider=ApiProvider.GEMINI,
                            prompt_tokens=image_usage.get("prompt_tokens", 0),
                            completion_tokens=image_usage.get("completion_tokens", 0),
                            total_tokens=image_usage.get("total_tokens", 0),
                            request_type=RequestType.IMAGE,
                            institute_id=request.institute_id,
                            user_id=request.user_id,
                            model="gemini-2.5-flash-image",
                        )
                    except Exception as e:
                        logger.warning(f"Failed to record image token usage: {str(e)}")
                
                # Update metadata with image URLs if generation was successful
                if banner_url:
                    outline_response.course_metadata.banner_image_url = banner_url
                if preview_url:
                    outline_response.course_metadata.preview_image_url = preview_url
                if media_url:
                    outline_response.course_metadata.media_image_url = media_url
            except Exception as e:
                logger.error(f"Failed to generate course images: {str(e)}. Skipping image generation to save credits.")
                # Don't fail the entire request if image generation fails

        return outline_response

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

        # Get institute AI course prompt
        ai_course_prompt = None
        if self._institute_settings_service and self._db_session:
            try:
                ai_settings = self._institute_settings_service.get_ai_course_settings(request.institute_id)
                ai_course_prompt = ai_settings.get("AI_COURSE_PROMPT")
            except Exception as e:
                logger.warning(f"Failed to fetch AI course prompt for institute {request.institute_id}: {str(e)}")

        prompt = self._prompt_builder.build_prompt(
            request=request,
            metadata=metadata,
            ai_course_prompt=ai_course_prompt
        )

        # Resolve API keys (request -> database -> defaults)
        openai_key = None
        gemini_key = None
        model = request.model
        
        if self._db_session:
            try:
                key_resolver = ApiKeyResolver(self._db_session)
                openai_key, gemini_key, model = key_resolver.resolve_keys(
                    institute_id=request.institute_id,
                    user_id=request.user_id,
                    request_model=request.model
                )
            except Exception as e:
                logger.warning(f"Failed to resolve API keys: {str(e)}, using environment defaults")
                # Fallback to environment defaults
                from ..config import get_settings
                settings = get_settings()
                openai_key = settings.openrouter_api_key
                gemini_key = settings.gemini_api_key
                model = request.model or settings.llm_default_model
        else:
            # No DB session, use environment defaults only
            from ..config import get_settings
            settings = get_settings()
            openai_key = settings.openrouter_api_key
            gemini_key = settings.gemini_api_key
            model = request.model or settings.llm_default_model

        # Send initial metadata event (matches media-service)
        yield f"```json {{\"requestId\": \"{request_id}\"}}```"

        # For now, get the complete response and yield it as a single event
        # This simulates streaming but uses non-streaming API call
        try:
            # Generate outline and capture token usage
            if hasattr(self._llm_client, 'generate_outline_with_usage'):
                full_content, usage_info = await self._llm_client.generate_outline_with_usage(
                    prompt=prompt,
                    model=model,
                    api_key=openai_key,
                )
                
                # Record token usage
                if self._db_session and usage_info:
                    try:
                        token_service = TokenUsageService(self._db_session)
                        token_service.record_usage_and_deduct_credits(
                            api_provider=ApiProvider.OPENAI,
                            prompt_tokens=usage_info.get("prompt_tokens", 0),
                            completion_tokens=usage_info.get("completion_tokens", 0),
                            total_tokens=usage_info.get("total_tokens", 0),
                            request_type=RequestType.OUTLINE,
                            institute_id=request.institute_id,
                            user_id=request.user_id,
                            model=model,
                            request_id=request_id,
                        )
                    except Exception as e:
                        logger.warning(f"Failed to record token usage: {str(e)}")
            else:
                # Fallback for clients that don't support usage tracking
                full_content = await self._llm_client.generate_outline(
                    prompt=prompt,
                    model=model,
                    api_key=openai_key,
                )

            # Yield some thinking-like events to simulate streaming
            yield "[Thinking...]\nPlanning the course structure based on your requirements..."

            yield "[Generating...]\nCreating the course outline with subjects, modules, and slides..."

            # Parse and yield the final result
            outline_response = self._parser.parse(full_content)

            # Check if practice problems/solutions are requested and add homework slides
            outline_response = self._add_homework_slides_if_needed(outline_response, request.user_prompt)

            # Generate images if requested AND parsing was successful
            # Skip image generation if course_name is "Error" (indicates parsing failure)
            if (request.generation_options and 
                request.generation_options.generate_images and
                outline_response.course_metadata.course_name and
                outline_response.course_metadata.course_name.lower() != "error" and
                len(outline_response.course_metadata.course_name.strip()) > 0):
                yield "[Generating...]\nCreating course banner, preview, and media images..."

                try:
                    # Generate images (timeouts handled individually in image service)
                    banner_url, preview_url, media_url, image_usage = await self._image_service.generate_images(
                        course_name=outline_response.course_metadata.course_name,
                        about_course=outline_response.course_metadata.about_the_course_html,
                        course_depth=outline_response.course_metadata.course_depth,
                        image_style=request.generation_options.image_style or "professional",
                        gemini_key=gemini_key
                    )
                    
                    # Record image generation token usage
                    if self._db_session and image_usage and image_usage.get("total_tokens", 0) > 0:
                        try:
                            token_service = TokenUsageService(self._db_session)
                            token_service.record_usage_and_deduct_credits(
                                api_provider=ApiProvider.GEMINI,
                                prompt_tokens=image_usage.get("prompt_tokens", 0),
                                completion_tokens=image_usage.get("completion_tokens", 0),
                                total_tokens=image_usage.get("total_tokens", 0),
                                request_type=RequestType.IMAGE,
                                institute_id=request.institute_id,
                                user_id=request.user_id,
                                model="gemini-2.5-flash-image",
                                request_id=request_id,
                            )
                        except Exception as e:
                            logger.warning(f"Failed to record image token usage: {str(e)}")

                    # Update metadata with image URLs if generation was successful
                    if banner_url:
                        outline_response.course_metadata.banner_image_url = banner_url
                    if preview_url:
                        outline_response.course_metadata.preview_image_url = preview_url
                    if media_url:
                        outline_response.course_metadata.media_image_url = media_url
                except Exception as e:
                    logger.error(f"Failed to generate course images: {str(e)}. Skipping image generation to save credits.")
                    # Don't fail the entire request if image generation fails
            else:
                # Log why images were skipped
                if not outline_response.course_metadata.course_name or outline_response.course_metadata.course_name.lower() == "error":
                    logger.warning("Skipping image generation: Course parsing failed (course_name is 'Error')")
                elif not request.generation_options or not request.generation_options.generate_images:
                    logger.debug("Skipping image generation: Not requested by user")

            # Yield the final processed outline as JSON (matches media-service pattern)
            try:
                # Build course metadata dict with S3 URLs included
                metadata_dict = outline_response.course_metadata.model_dump()

                # Remove snake_case image URL fields if they exist
                metadata_dict.pop('banner_image_url', None)
                metadata_dict.pop('preview_image_url', None)
                metadata_dict.pop('media_image_url', None)

                # Add camelCase versions for frontend compatibility
                metadata_dict["bannerImageUrl"] = getattr(outline_response.course_metadata, 'banner_image_url', None)
                metadata_dict["previewImageUrl"] = getattr(outline_response.course_metadata, 'preview_image_url', None)
                metadata_dict["mediaImageUrl"] = getattr(outline_response.course_metadata, 'media_image_url', None)

                # Create the final response
                final_response = {
                    "explanation": outline_response.explanation,
                    "tree": [node.model_dump() for node in outline_response.tree],
                    "todos": [todo.model_dump() for todo in outline_response.todos],
                    "courseMetadata": metadata_dict
                }

                response_json = json.dumps(final_response)
                yield response_json
                
                # Note: Content generation is handled by a separate endpoint (/content/v1/generate)
                # The frontend will call that endpoint after reviewing the outline

            except Exception as e:
                logger.error(f"Exception in final JSON creation: {str(e)}")
                # Still try to yield something
                yield json.dumps({
                    "error": f"Failed to create final response: {str(e)}",
                    "explanation": outline_response.explanation if 'outline_response' in locals() else "Error occurred"
                })

        except Exception as e:
            yield f"[Error] Failed to generate outline: {str(e)}"

    async def generate_content_from_coursetree(
        self, course_tree: dict, request_id: str, institute_id: Optional[str] = None, user_id: Optional[str] = None, language: Optional[str] = "English"
    ) -> AsyncGenerator[str, None]:
        """
        Generate content for todos in an existing coursetree.
        This endpoint is called by frontend with a coursetree from the outline API.
        
        Matches the pattern from media-service where content generation happens
        after the structural outline is received.
        """
        try:
            # Send initial metadata event (matches media-service)
            yield f"```json {{\"requestId\": \"{request_id}\"}}```"
            
            # Extract todos from the coursetree
            # Handle different formats:
            # 1. Full outline response: {explanation, tree, todos, courseMetadata}
            # 2. Object with todos: {todos: [...]}
            # 3. Direct array: [...]
            todos_data = None
            if isinstance(course_tree, list):
                # If it's a direct array, assume it's todos
                todos_data = course_tree
            elif isinstance(course_tree, dict):
                # Try to get todos from the dict
                todos_data = course_tree.get("todos", [])
                # If no "todos" key, check if the dict itself is a todo or if it's empty
                if not todos_data and not course_tree:
                    todos_data = []
            
            if not todos_data:
                logger.warning("No todos found in coursetree. Nothing to generate.")
                yield json.dumps({
                    "type": "INFO",
                    "message": "No todos found in coursetree. Nothing to generate."
                })
                return
            
            logger.info(
                f"Found {len(todos_data)} 'todo' items in coursetree. "
                "Initiating content generation."
            )
            
            # Parse todos into Todo objects
            todos = []
            for todo_dict in todos_data:
                try:
                    todo = Todo(**todo_dict)
                    todos.append(todo)
                except Exception as e:
                    logger.warning(f"Failed to parse todo: {str(e)}, skipping")
                    continue
            
            # Filter todos to only process DOCUMENT, ASSESSMENT, VIDEO, VIDEO_CODE, AI_VIDEO, and AI_VIDEO_CODE types
            content_todos = [
                todo for todo in todos 
                if todo.type in ["DOCUMENT", "ASSESSMENT", "VIDEO", "VIDEO_CODE", "AI_VIDEO", "AI_VIDEO_CODE"]
            ]
            
            if not content_todos:
                logger.info("No content todos found. Content generation phase skipped.")
                yield json.dumps({
                    "type": "INFO",
                    "message": "No content generation todos found in coursetree."
                })
                return
            
            # Log the breakdown of todo types
            todo_types = {}
            for todo in content_todos:
                todo_types[todo.type] = todo_types.get(todo.type, 0) + 1
            logger.info(f"Processing {len(content_todos)} content generation tasks: {todo_types}")
            
            # Extract institute_id and user_id from course_tree if not provided
            extracted_institute_id = institute_id
            extracted_user_id = user_id
            if not extracted_institute_id and isinstance(course_tree, dict):
                # Try to get from courseMetadata or request metadata
                course_metadata = course_tree.get("courseMetadata", {})
                if isinstance(course_metadata, dict):
                    extracted_institute_id = extracted_institute_id or course_metadata.get("instituteId") or course_metadata.get("institute_id")
                    extracted_user_id = extracted_user_id or course_metadata.get("userId") or course_metadata.get("user_id")
            
            # Create or update content generation service with DB session and IDs
            if not self._content_generation_service:
                from .content_generation_service import ContentGenerationService
                self._content_generation_service = ContentGenerationService(
                    llm_client=self._llm_client,
                    db_session=self._db_session,
                    institute_id=extracted_institute_id,
                    user_id=extracted_user_id,
                )
            else:
                # Update existing service with IDs and DB session
                self._content_generation_service._institute_id = extracted_institute_id or self._content_generation_service._institute_id
                self._content_generation_service._user_id = extracted_user_id or self._content_generation_service._user_id
                self._content_generation_service._db_session = self._db_session or self._content_generation_service._db_session
            
            # Inject request-level language into todo metadata if not already set
            effective_language = language or "English"
            for todo in content_todos:
                if todo.metadata is None:
                    todo.metadata = {}
                if not todo.metadata.get("language"):
                    todo.metadata["language"] = effective_language

            # Process todos in order so "Homework Solutions" can use the generated "Homework Questions" content
            generated_content_by_path = {}
            for todo in content_todos:
                try:
                    logger.info(f"Starting content generation for todo: {todo.path} (Type: {todo.type})")
                    async for content_update in self._content_generation_service.generate_content_for_todo(
                        todo, generated_content_by_path
                    ):
                        yield content_update
                        # Accumulate generated content so solution slides can use homework content
                        try:
                            data = json.loads(content_update)
                            if (
                                data.get("type") == "SLIDE_CONTENT_UPDATE"
                                and data.get("status")
                                and "contentData" in data
                            ):
                                generated_content_by_path[data["path"]] = data["contentData"]
                        except (json.JSONDecodeError, TypeError):
                            pass
                    logger.info(f"Completed content generation for todo: {todo.path}")
                except Exception as e:
                    logger.error(f"Error processing todo {todo.path}: {str(e)}")
                    error_response = json.dumps({
                        "type": "SLIDE_CONTENT_ERROR",
                        "path": todo.path,
                        "status": False,
                        "actionType": todo.action_type,
                        "slideType": todo.type,
                        "errorMessage": f"Failed to generate content: {str(e)}",
                        "contentData": "Error generating content for this slide. Please try again or contact support.",
                    })
                    yield error_response
            
            logger.info("All 'todo' content generation tasks have completed.")
            
        except Exception as e:
            logger.error(f"Exception in content generation from coursetree: {str(e)}")
            yield json.dumps({
                "type": "ERROR",
                "message": f"Failed to generate content: {str(e)}"
            })

    def _add_homework_slides_if_needed(
        self, outline_response: CourseOutlineResponse, user_prompt: str
    ) -> CourseOutlineResponse:
        """
        Check if user prompt mentions practice problems/solutions and add two homework slides 
        at the end of EACH chapter.
        Adds for each chapter:
        1. DOCUMENT slide with homework questions from that chapter's slides
        2. DOCUMENT slide with solutions to those homework questions
        """
        # Check for keywords indicating practice problems/solutions are needed
        prompt_lower = user_prompt.lower()
        keywords = [
            "practice problem",
            "practice problems",
            "include solutions",
            "include solution",
            "homework",
            "homework questions",
            "exercise",
            "exercises",
            "problem set",
            "problem sets",
            "assignment",
            "assignments"
        ]
        
        has_practice_keywords = any(keyword in prompt_lower for keyword in keywords)
        
        if not has_practice_keywords:
            return outline_response
        
        logger.info("Detected practice problems/solutions keywords. Adding homework slides to each chapter.")
        
        # Remove any LLM-generated homework/solution slides (quiz or document). We add exactly one "Homework Questions -"
        # and one "Homework Solutions -" DOCUMENT per chapter; the user wants only those, not extra "X Homework" or
        # "X Homework Solution" slides from the outline.
        def _is_llm_homework_or_solution_todo(t: Todo) -> bool:
            title = (t.title or "").strip().lower()
            name = (t.name or "").strip().lower()
            # Our canonical slides we inject start with these prefixes
            if title.startswith("assignment -") or title.startswith("assignment solutions -"):
                return False
            if name.startswith("assignment -") or name.startswith("assignment solutions -"):
                return False

            # LLM-generated ones look like "Spark Data Processing Homework", "X Homework Solution", "Coding Assignment", etc.
            if "homework" in title or "homework" in name:
                return True
            if "assignment" in title or "assignment" in name:
                return True

            if ("solution" in title or "solution" in name) and ("homework" in title or "homework" in name):
                return True
            # LLM sometimes adds a standalone "Solution: [Topic]" slide (e.g. "Solution: Your First Spark Program");
            # we only want our single "Homework Solutions -" slide per chapter.
            if title.startswith("solution:") or title.startswith("solution -"):
                return True
            if name.startswith("solution:") or name.startswith("solution -"):
                return True
            # Quiz/assessment for practice
            if t.type == "ASSESSMENT" and any(k in title or k in name for k in ("practice", "exercise")):
                return True
            return False

        outline_response.todos = [t for t in outline_response.todos if not _is_llm_homework_or_solution_todo(t)]
        
        # Group todos by chapter and find insertion points
        # We need to insert homework slides right after the last slide of each chapter
        chapter_groups = {}
        
        for idx, todo in enumerate(outline_response.todos):
            # Extract chapter path from todo path
            path_parts = todo.path.split(".")
            chapter_path = None
            
            # Find the chapter part (CH1, CH2, etc.) or use the base path if no chapters
            for i, part in enumerate(path_parts):
                if part.startswith("CH"):
                    # Chapter found, include everything up to and including the chapter
                    chapter_path = ".".join(path_parts[:i+1])
                    break
            
            # If no chapter found, check if it's depth 2 (direct slides under course)
            if not chapter_path:
                # For depth 2, group by course (C1)
                if path_parts and path_parts[0].startswith("C"):
                    chapter_path = path_parts[0]
                else:
                    chapter_path = "C1"  # Fallback
            
            if chapter_path not in chapter_groups:
                chapter_groups[chapter_path] = []
            chapter_groups[chapter_path].append((idx, todo))
        
        # Process chapters in reverse order to maintain correct indices when inserting
        # Sort chapters by the index of their last todo (so we process from end to beginning)
        sorted_chapters = sorted(
            chapter_groups.items(),
            key=lambda x: max([idx for idx, _ in x[1]]),
            reverse=True
        )
        
        # Insert homework slides right after each chapter's last slide
        for chapter_path, chapter_todos_with_idx in sorted_chapters:
            chapter_todos = [todo for _, todo in chapter_todos_with_idx]
            
            # Get only DOCUMENT slides from this chapter for reference
            chapter_document_slides = [
                todo for todo in chapter_todos 
                if todo.type == "DOCUMENT"
            ]
            
            # Skip if no document slides in this chapter
            if not chapter_document_slides:
                continue
            
            # Find the last todo in this chapter (by order or by index)
            last_chapter_todo = max(chapter_todos_with_idx, key=lambda x: x[0])[1]
            last_chapter_idx = max([idx for idx, _ in chapter_todos_with_idx])
            
            path_parts = last_chapter_todo.path.split(".")
            
            # Determine next slide number
            if path_parts:
                last_part = path_parts[-1]
                if last_part.startswith("SL"):
                    try:
                        last_slide_num = int(last_part[2:])
                        next_slide_num = last_slide_num + 1
                    except:
                        next_slide_num = len(chapter_todos) + 1
                else:
                    next_slide_num = len(chapter_todos) + 1
            else:
                next_slide_num = len(chapter_todos) + 1
            
            # Build paths for homework and solutions slides
            base_path = chapter_path
            homework_path = f"{base_path}.SL{next_slide_num}"
            solutions_path = f"{base_path}.SL{next_slide_num + 1}"
            
            # Get slide references for this chapter only
            slide_references = ", ".join([todo.title or todo.name for todo in chapter_document_slides])
            
            # Get chapter name for better context
            chapter_name = chapter_document_slides[0].chapter_name if chapter_document_slides[0].chapter_name else "this chapter"
            
            # Determine order based on last todo in chapter
            last_order = last_chapter_todo.order if last_chapter_todo.order else last_chapter_idx + 1
            
            # Create homework questions todo for this chapter (coding/task-focused, not simple Q&A)
            homework_todo = Todo(
                name=f"Assignment - {chapter_name}",
                title=f"Assignment - {chapter_name}",
                type="DOCUMENT",
                path=homework_path,
                action_type="ADD",
                prompt=f"""Create homework tasks based ONLY on the course content covered in {chapter_name} from the following slides in this chapter: {slide_references}.

IMPORTANT: These homework tasks should ONLY reference content from {chapter_name}. Do not include tasks from other chapters.

The homework must be CODING- and TASK-oriented, NOT simple question-answer type. Include exactly ONE task per chapter, such as:
- One mini project (e.g. build a small app, implement a feature, create a script), or
- One setup/configuration task (e.g. set up environment, configure a tool), or
- One implementation task (e.g. implement a function, write code that does X)
The single task must have: clear title, brief context, concrete instructions, and expected outcome. Include code snippets or starter code where relevant. Base it on THIS chapter only: {slide_references}. Format as HTML with headings, paragraphs, and code blocks.""",
                order=last_order + 1,
                chapter_name=chapter_document_slides[0].chapter_name,
                module_name=chapter_document_slides[0].module_name,
                subject_name=chapter_document_slides[0].subject_name
            )
            
            # Create solutions todo for this chapter (hint first, then exact solution per item)
            solutions_todo = Todo(
                name=f"Assignment Solutions - {chapter_name}",
                title=f"Assignment Solutions - {chapter_name}",
                type="DOCUMENT",
                path=solutions_path,
                action_type="ADD",
                prompt=f"""Create solutions for the homework tasks from the previous slide in {chapter_name}. For EACH task you MUST give: (1) HINT first, (2) then the EXACT solution.

IMPORTANT: Solutions should ONLY reference content from {chapter_name}. The homework tasks are based on these slides: {slide_references}.

For every homework item:
- First provide one or more HINTs (short, actionable, without giving the full answer).
- Then provide the full EXACT solution: complete code (if coding), step-by-step commands (if setup), or full implementation with explanation.
- Code must be complete and runnable; for setup tasks include commands and how to verify. Reference concepts only from: {slide_references}.

Format as HTML: for each task use a heading, then a "Hint" subsection, then a "Solution" subsection with code in <pre><code> and steps in lists/paragraphs.""",
                order=last_order + 2,
                chapter_name=chapter_document_slides[0].chapter_name,
                module_name=chapter_document_slides[0].module_name,
                subject_name=chapter_document_slides[0].subject_name
            )
            
            # Insert homework slides right after the last slide of this chapter
            insert_position = last_chapter_idx + 1
            outline_response.todos.insert(insert_position, solutions_todo)
            outline_response.todos.insert(insert_position, homework_todo)
            
            logger.info(f"Added homework slides for chapter {chapter_path} at position {insert_position}: {homework_path} and {solutions_path}")
        
        return outline_response


__all__ = ["CourseOutlineGenerationService"]


