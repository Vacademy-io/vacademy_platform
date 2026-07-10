from __future__ import annotations

import json
import logging
import asyncio
from typing import Optional, AsyncGenerator
from uuid import uuid4

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
from ..core.exceptions import PaymentRequiredError
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

    async def _apply_reference_grounding(self, request: CourseOutlineRequest) -> None:
        """If reference PDFs were uploaded, ingest them and append their extracted
        text/tables to the user prompt so the outline is built from the actual
        document. Best-effort — a failure leaves the prompt unchanged."""
        file_ids = getattr(request, "reference_document_file_ids", None)
        if not file_ids:
            return
        try:
            from .course_document_ingest import ingest_documents, MAX_GROUNDING_CHARS_OUTLINE
            # Bound the wait: MathPix polling can take minutes on a slow/large
            # PDF, and grounding must not block the outline stream indefinitely.
            # On timeout we proceed ungrounded — the conversion keeps caching, so
            # the content step still gets the figures (cache hit).
            # Outline only needs the text — skip figure re-hosting (the content
            # pass re-hosts them when it actually embeds them).
            ingest = await asyncio.wait_for(
                ingest_documents(file_ids, rehost_figures=False), timeout=150
            )
            if not ingest.grounding_text:
                return
            source = ingest.grounding_text[:MAX_GROUNDING_CHARS_OUTLINE]
            truncated = " (truncated)" if len(ingest.grounding_text) > len(source) else ""
            figure_note = (
                f"\n\nThe document also contains {len(ingest.figures)} figures/diagrams that will be "
                "embedded into the generated slides — structure the course so its slides follow the "
                "document's sections, so those figures land in the right context."
                if ingest.figures else ""
            )
            request.user_prompt = (
                f"{request.user_prompt}\n\n"
                f"===== SOURCE DOCUMENT{truncated} — build the ENTIRE course strictly from this uploaded "
                "material: use its real structure, section order, facts, terminology, definitions, tables, "
                "and examples. Do NOT pad with generic outside content. =====\n"
                f"{source}\n"
                "===== END SOURCE DOCUMENT ====="
                f"{figure_note}"
            )
            logger.info(
                f"Grounded outline in {len(file_ids)} reference document(s): "
                f"{len(source)} chars, {len(ingest.figures)} figures"
            )
        except Exception as e:  # noqa: BLE001
            logger.warning(f"Reference grounding failed (continuing without it): {str(e)}")

    async def generate_outline(
        self, request: CourseOutlineRequest
    ) -> CourseOutlineResponse:
        # Homework-slide injection keys off the user's OWN words — capture them
        # before grounding appends the document text (which almost always
        # contains "exercise"/"assignment" and would spuriously trigger it).
        original_user_prompt = request.user_prompt
        await self._apply_reference_grounding(request)
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
                if not model:
                    from ..services.ai_models_service import AIModelsService
                    model = request.model or AIModelsService(self._db_session).get_models_for_use_case("outline").default_model.model_id
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

            # Parametric course_outline charge: max(flat DB rate, actual tokens).
            # Best-effort on a fresh session; idempotent per request.
            if usage_info:
                from .ai_billing import record_tool_billing
                request_id = str(uuid4())
                record_tool_billing(
                    tool_key="course_outline",
                    tool_params={},
                    request_type=RequestType.OUTLINE,
                    model=model,
                    prompt_tokens=usage_info.get("prompt_tokens", 0),
                    completion_tokens=usage_info.get("completion_tokens", 0),
                    institute_id=request.institute_id,
                    user_id=request.user_id,
                    request_id=request_id,
                    idempotency_key=f"course_outline:{request_id}",
                )
        else:
            # Fallback for clients that don't support usage tracking
            raw_output = await self._llm_client.generate_outline(
                prompt=prompt,
                model=model,
                api_key=openai_key,
            )

        outline_response = self._parser.parse(raw_output)

        # Check if practice problems/solutions are requested and add homework slides
        outline_response = self._add_homework_slides_if_needed(outline_response, original_user_prompt)

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
        # Emit the requestId first so the client gets a first byte before the
        # (possibly slow) document grounding — otherwise a proxy/EventSource
        # first-byte timeout could drop the connection during MathPix ingestion.
        yield f"```json {{\"requestId\": \"{request_id}\"}}```"
        # Capture the user's own words before grounding appends document text
        # (which would spuriously trigger homework-slide injection).
        original_user_prompt = request.user_prompt
        await self._apply_reference_grounding(request)
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
                if not model:
                    from ..services.ai_models_service import AIModelsService
                    model = request.model or AIModelsService(self._db_session).get_models_for_use_case("outline").default_model.model_id
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

        # (requestId already emitted at the top, before grounding)

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

                # Parametric course_outline charge: max(flat DB rate, actual
                # tokens). Best-effort on a fresh session; idempotent per request.
                if usage_info:
                    from .ai_billing import record_tool_billing
                    record_tool_billing(
                        tool_key="course_outline",
                        tool_params={},
                        request_type=RequestType.OUTLINE,
                        model=model,
                        prompt_tokens=usage_info.get("prompt_tokens", 0),
                        completion_tokens=usage_info.get("completion_tokens", 0),
                        institute_id=request.institute_id,
                        user_id=request.user_id,
                        request_id=request_id,
                        idempotency_key=f"course_outline:{request_id}",
                    )
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
            outline_response = self._add_homework_slides_if_needed(outline_response, original_user_prompt)

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

        except PaymentRequiredError:
            # Re-raise so the router can return a proper 402 response to the caller
            raise
        except Exception as e:
            yield f"[Error] Failed to generate outline: {str(e)}"

    async def generate_content_from_coursetree(
        self,
        course_tree: dict,
        request_id: str,
        institute_id: Optional[str] = None,
        user_id: Optional[str] = None,
        language: Optional[str] = "English",
        video_settings: Optional[dict] = None,
        reference_document_file_ids: Optional[list] = None,
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
            
            # Filter todos to only process content types (excludes structural types like CHAPTER, MODULE, etc.)
            content_todos = [
                todo for todo in todos
                if todo.type in ["DOCUMENT", "ASSESSMENT", "VIDEO", "VIDEO_CODE", "AI_VIDEO", "AI_VIDEO_CODE", "AI_SLIDES", "AI_STORYBOOK"]
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
            # Keys idempotent per-slide charges for this generation run
            self._content_generation_service._request_id = request_id

            # Ingest reference PDFs once (cache hit from the outline pass) so
            # DOCUMENT slides can embed the document's real figures. Each figure
            # is assigned to the ONE slide it best matches (by caption↔title) so
            # the same figure doesn't get embedded on every slide. Best-effort.
            self._content_generation_service._document_figures_by_path = {}
            if reference_document_file_ids:
                try:
                    from .course_document_ingest import ingest_documents, assign_figures_to_slides
                    # Bounded like the outline pass: a slow/dead MathPix job must
                    # not stall content generation (no slides would stream).
                    ingest = await asyncio.wait_for(
                        ingest_documents(reference_document_file_ids), timeout=150
                    )
                    doc_slides = [
                        {"path": t.path, "title": t.title or t.name or ""}
                        for t in content_todos
                        if t.type == "DOCUMENT"
                        and "assignment" not in (t.title or "").lower()
                    ]
                    figures_by_path = assign_figures_to_slides(ingest.figures, doc_slides)
                    self._content_generation_service._document_figures_by_path = figures_by_path
                    logger.info(
                        f"Content generation: {len(ingest.figures)} reference figure(s) "
                        f"assigned across {len(figures_by_path)} slide(s)"
                    )
                except Exception as e:  # noqa: BLE001
                    logger.warning(f"Reference figure ingest failed (continuing): {str(e)}")
            
            # Inject request-level language into todo metadata if not already set
            effective_language = language or "English"
            for todo in content_todos:
                if todo.metadata is None:
                    todo.metadata = {}
                if not todo.metadata.get("language"):
                    todo.metadata["language"] = effective_language

            # Inject course-level AI-video settings (from the wizard) into the
            # video-pipeline todos' metadata. These are the user's EXPLICIT
            # per-course choices for video pages, so they override the auto-
            # injected defaults (e.g. the "language" above) for video todos.
            # "language" here is the video-narration language (may differ from
            # the document language) and drives the TTS voice.
            if video_settings:
                _video_types = {"AI_VIDEO", "AI_VIDEO_CODE", "AI_SLIDES", "AI_STORYBOOK"}
                _video_setting_keys = (
                    "model", "voice_gender", "voice_id",
                    "tts_provider", "quality_tier", "target_duration", "language",
                )
                for todo in content_todos:
                    if todo.type not in _video_types:
                        continue
                    for key in _video_setting_keys:
                        value = video_settings.get(key)
                        if value:
                            todo.metadata[key] = value

            # ── Parallel content generation with dependency awareness ──
            # Separate independent todos from dependent homework→solution pairs.
            # Independent todos run concurrently (semaphore-limited); dependent pairs run sequentially.
            CONCURRENCY = 5  # Max parallel LLM calls (tune based on API rate limits)
            semaphore = asyncio.Semaphore(CONCURRENCY)

            independent_todos = []
            dependent_pairs = []  # list of (homework_todo, solution_todo)

            i = 0
            while i < len(content_todos):
                todo = content_todos[i]
                title_lower = (todo.title or todo.name or "").lower()

                # Check if this is a homework slide followed by its solution
                is_homework = (
                    "assignment -" in title_lower
                    or "homework questions" in title_lower
                )
                if is_homework and i + 1 < len(content_todos):
                    next_todo = content_todos[i + 1]
                    next_title_lower = (next_todo.title or next_todo.name or "").lower()
                    if "assignment solutions" in next_title_lower or "homework solutions" in next_title_lower:
                        dependent_pairs.append((todo, next_todo))
                        i += 2
                        continue

                independent_todos.append(todo)
                i += 1

            logger.info(
                f"Content generation plan: {len(independent_todos)} independent todos (concurrency={CONCURRENCY}), "
                f"{len(dependent_pairs)} dependent homework→solution pairs (sequential)"
            )

            generated_content_by_path = {}

            # ── Phase 1: Stream independent todos in parallel via queue ──
            # Using a queue so events are yielded to the SSE stream in real-time
            # as each slide completes, rather than buffering until all are done.
            if independent_todos:
                logger.info(f"Phase 1: Processing {len(independent_todos)} independent todos in parallel...")
                event_queue: asyncio.Queue = asyncio.Queue()
                _SENTINEL = object()  # Signals all tasks are done
                # Paths whose worker actually started generating (left the
                # semaphore queue) — see the disconnect handling below.
                started_paths: set = set()

                async def _process_todo_to_queue(todo: Todo):
                    """Generate content for one todo and push events to the queue."""
                    async with semaphore:
                        started_paths.add(todo.path)
                        try:
                            logger.info(f"Starting content generation for todo: {todo.path} (Type: {todo.type})")
                            async for content_update in self._content_generation_service.generate_content_for_todo(
                                todo, generated_content_by_path
                            ):
                                await event_queue.put(content_update)
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
                            await event_queue.put(error_response)

                # Start all tasks
                task_todo_pairs = [
                    (asyncio.create_task(_process_todo_to_queue(todo)), todo)
                    for todo in independent_todos
                ]
                tasks = [task for task, _ in task_todo_pairs]

                # Watchdog: wait for all tasks, then push sentinel
                async def _signal_done():
                    await asyncio.gather(*tasks, return_exceptions=True)
                    await event_queue.put(_SENTINEL)

                asyncio.create_task(_signal_done())

                # Yield events in real-time as they arrive from any task.
                # If the client disconnects, the generator is closed here —
                # cancel the pure-LLM workers so orphaned generations (and
                # their credit charges) don't keep running for a stream nobody
                # receives. Video-pipeline workers must NOT be hard-cancelled:
                # a CancelledError inside generate_till_stage bypasses its
                # `except Exception` cleanup (row stuck IN_PROGRESS, no refund)
                # and unwinds a `with ThreadPoolExecutor()` whose shutdown
                # blocks the whole event loop until the stage thread finishes.
                # Those runs complete in the background instead (their DB rows
                # and S3 artifacts stay usable, billed as actual usage).
                _video_pipeline_types = {"AI_VIDEO", "AI_VIDEO_CODE", "AI_SLIDES", "AI_STORYBOOK"}
                try:
                    while True:
                        event = await event_queue.get()
                        if event is _SENTINEL:
                            break
                        yield event
                        # Accumulate generated content for potential downstream use
                        try:
                            data = json.loads(event)
                            if (
                                data.get("type") == "SLIDE_CONTENT_UPDATE"
                                and data.get("status")
                                and "contentData" in data
                            ):
                                generated_content_by_path[data["path"]] = data["contentData"]
                        except (json.JSONDecodeError, TypeError):
                            pass
                finally:
                    for task, todo in task_todo_pairs:
                        # Video-family workers that already entered the pipeline
                        # must finish (see comment above); ones still queued on
                        # the semaphore have no DB row/charges yet and are safe
                        # (and cheap) to cancel.
                        if (
                            todo.type not in _video_pipeline_types
                            or todo.path not in started_paths
                        ):
                            task.cancel()

            # ── Phase 2: Process dependent homework→solution pairs sequentially ──
            if dependent_pairs:
                logger.info(f"Phase 2: Processing {len(dependent_pairs)} homework→solution pairs sequentially...")
                for homework_todo, solution_todo in dependent_pairs:
                    # First generate homework questions
                    try:
                        logger.info(f"Starting content generation for homework todo: {homework_todo.path}")
                        async for event in self._content_generation_service.generate_content_for_todo(
                            homework_todo, generated_content_by_path
                        ):
                            yield event
                            try:
                                data = json.loads(event)
                                if (
                                    data.get("type") == "SLIDE_CONTENT_UPDATE"
                                    and data.get("status")
                                    and "contentData" in data
                                ):
                                    generated_content_by_path[data["path"]] = data["contentData"]
                            except (json.JSONDecodeError, TypeError):
                                pass
                    except Exception as e:
                        logger.error(f"Error processing homework todo {homework_todo.path}: {str(e)}")
                        yield json.dumps({
                            "type": "SLIDE_CONTENT_ERROR",
                            "path": homework_todo.path,
                            "status": False,
                            "actionType": homework_todo.action_type,
                            "slideType": homework_todo.type,
                            "errorMessage": f"Failed to generate content: {str(e)}",
                            "contentData": "Error generating content for this slide.",
                        })

                    # Then generate solutions (which can reference the homework content)
                    try:
                        logger.info(f"Starting content generation for solution todo: {solution_todo.path}")
                        async for event in self._content_generation_service.generate_content_for_todo(
                            solution_todo, generated_content_by_path
                        ):
                            yield event
                            try:
                                data = json.loads(event)
                                if (
                                    data.get("type") == "SLIDE_CONTENT_UPDATE"
                                    and data.get("status")
                                    and "contentData" in data
                                ):
                                    generated_content_by_path[data["path"]] = data["contentData"]
                            except (json.JSONDecodeError, TypeError):
                                pass
                    except Exception as e:
                        logger.error(f"Error processing solution todo {solution_todo.path}: {str(e)}")
                        yield json.dumps({
                            "type": "SLIDE_CONTENT_ERROR",
                            "path": solution_todo.path,
                            "status": False,
                            "actionType": solution_todo.action_type,
                            "slideType": solution_todo.type,
                            "errorMessage": f"Failed to generate content: {str(e)}",
                            "contentData": "Error generating content for this slide.",
                        })

            logger.info("All 'todo' content generation tasks have completed.")
            
        except PaymentRequiredError:
            # Re-raise so the router can return a proper 402 response to the caller
            raise
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
                model=chapter_document_slides[0].model,
                prompt=f"""Create the homework assignment based ONLY on the course content covered in {chapter_name} from the following slides in this chapter: {slide_references}.

IMPORTANT: The assignment should ONLY reference content from {chapter_name}. Do not include tasks from other chapters.

The homework must be hands-on and applied — something the student actively DOES, not recall-style question-answer. Choose the task type from the chapter's subject matter:
- ONLY if the chapter teaches programming or another code-based technical skill: one coding task (mini project, implementation, setup, or debugging task)
- For any other subject: one practical non-coding task (e.g. analyze a provided case or examples, create a deliverable like a properly formatted document or plan, correct provided flawed examples, or solve realistic scenario problems)
Never force a coding task onto a non-technical chapter.
Include exactly ONE task, with: clear title, brief context, concrete instructions, the materials to work on embedded in the assignment, and the expected outcome. Base it on THIS chapter only: {slide_references}.""",
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
                model=chapter_document_slides[0].model,
                prompt=f"""Create solutions for the homework task from the previous slide in {chapter_name}. You MUST give: (1) HINT first, (2) then the full solution.

IMPORTANT: Solutions should ONLY reference content from {chapter_name}. The homework task is based on these slides: {slide_references}.

For the homework task:
- First provide one or more HINTs (short, actionable, without giving the full answer).
- Then provide the full solution matching the task type: complete runnable code ONLY if the homework was a coding task; otherwise the complete worked deliverable or step-by-step working (e.g. the corrected examples, the finished document, the full analysis).
- Reference concepts only from: {slide_references}.""",
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


