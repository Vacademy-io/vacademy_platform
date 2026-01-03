from __future__ import annotations

import json
import logging
from typing import AsyncGenerator, Optional
from uuid import uuid4

from ..ports.llm_client import OutlineLLMClient
from ..schemas.course_outline import Todo
from .youtube_service import YouTubeService
from .content_prompts import ContentGenerationPrompts
from .video_generation_service import VideoGenerationService
from ..repositories.ai_video_repository import AiVideoRepository
from .s3_service import S3Service

logger = logging.getLogger(__name__)


class ContentGenerationService:
    """
    Service for generating slide content (documents, assessments, and videos) based on todos.
    Matches the pattern from media-service DocumentContentGenerationStrategy, AssignmentContentGeneration, and YoutubeContentGenerationStrategy.
    """

    def __init__(
        self, 
        llm_client: OutlineLLMClient, 
        youtube_service: Optional[YouTubeService] = None,
        video_gen_service: Optional[VideoGenerationService] = None
    ) -> None:
        logger.info("[ContentGenService] Initializing ContentGenerationService")
        self._llm_client = llm_client
        self._youtube_service = youtube_service or YouTubeService()
        
        logger.info("[ContentGenService] Creating VideoGenerationService...")
        try:
            self._video_gen_service = video_gen_service or VideoGenerationService(
                repository=AiVideoRepository(),
                s3_service=S3Service()
            )
            logger.info("[ContentGenService] VideoGenerationService initialized successfully")
        except Exception as e:
            logger.error(f"[ContentGenService] FAILED to initialize VideoGenerationService: {e}")
            raise
        
        # Use the same model as outline generation
        self._content_model = "google/gemini-2.5-flash"
        logger.info("[ContentGenService] ContentGenerationService fully initialized")

    async def generate_document_content(
        self, todo: Todo, prompt: str
    ) -> dict:
        """
        Generate document content for a DOCUMENT type todo.
        Returns content in the same format as media-service DocumentContentGenerationStrategy.
        
        Format: {
            "type": "SLIDE_CONTENT_UPDATE",
            "path": "<slidePath>",
            "status": true,
            "actionType": "<actionType>",
            "slideType": "DOCUMENT",
            "contentData": "<generated HTML or Markdown content>"
        }
        """
        try:
            logger.info(f"Generating document content for slide: {todo.path}")
            
            # Check if diagrams should be included based on prompt
            diagram_keywords = ["include diagrams", "include diagram", "with diagrams", "with diagram", 
                               "add diagrams", "add diagram", "diagrams", "mermaid"]
            prompt_lower = prompt.lower()
            include_diagrams = any(keyword in prompt_lower for keyword in diagram_keywords)
            
            if include_diagrams:
                logger.info(f"Detected diagram request in prompt for slide: {todo.path}, generating markdown with Mermaid diagrams")
            
            # Build document prompt (will generate markdown if diagrams requested, HTML otherwise)
            document_prompt = ContentGenerationPrompts.build_document_prompt(
                text_prompt=prompt,
                title=todo.title or todo.name,
                include_diagrams=include_diagrams
            )
            
            # Generate content using the enhanced prompt
            generated_content = await self._llm_client.generate_outline(
                prompt=document_prompt,
                model=self._content_model,
            )
            
            # Format response matching media-service DocumentContentGenerationStrategy
            return {
                "type": "SLIDE_CONTENT_UPDATE",
                "path": todo.path,
                "status": True,
                "actionType": todo.action_type,
                "slideType": "DOCUMENT",
                "contentData": generated_content,
            }
        except Exception as e:
            error_msg = str(e)
            # Try to extract more details from httpx errors
            if hasattr(e, 'response') and hasattr(e.response, 'text'):
                try:
                    error_detail = e.response.text
                    logger.error(f"Error generating document content for {todo.path}: {error_msg}. Response: {error_detail}")
                    error_msg = f"{error_msg}: {error_detail[:200]}"  # Limit error detail length
                except:
                    pass
            else:
                logger.error(f"Error generating document content for {todo.path}: {error_msg}")
            return {
                "type": "SLIDE_CONTENT_ERROR",
                "path": todo.path,
                "status": False,
                "actionType": todo.action_type,
                "slideType": "DOCUMENT",
                "errorMessage": f"Failed to generate content: {error_msg}",
                "contentData": "Error generating content for this slide. Please try again or contact support.",
            }

    async def generate_assessment_content(
        self, todo: Todo, prompt: str
    ) -> dict:
        """
        Generate assessment/quiz content for an ASSESSMENT type todo.
        Returns content in the same format as media-service AssignmentContentGeneration.
        
        Format: {
            "type": "SLIDE_CONTENT_UPDATE",
            "path": "<slidePath>",
            "status": true,
            "title": "<title>",
            "actionType": "<actionType>",
            "slideType": "ASSESSMENT",
            "contentData": <JSON object with questions>
        }
        """
        try:
            logger.info(f"Generating assessment content for slide: {todo.path}")
            
            # Build assessment prompt using template similar to media-service PROMPT_TO_QUESTIONS
            assessment_prompt = ContentGenerationPrompts.build_assessment_prompt(
                text_prompt=prompt,
                title=todo.title or todo.name,
            )
            
            # Generate content
            generated_content = await self._llm_client.generate_outline(
                prompt=assessment_prompt,
                model=self._content_model,
            )
            
            # Extract and parse JSON from the response
            content_json = self._extract_json_from_response(generated_content)
            
            # Format response matching media-service AssignmentContentGeneration
            return {
                "type": "SLIDE_CONTENT_UPDATE",
                "path": todo.path,
                "status": True,
                "title": todo.title or todo.name,
                "actionType": todo.action_type,
                "slideType": "ASSESSMENT",
                "contentData": content_json,
            }
        except Exception as e:
            error_msg = str(e)
            # Try to extract more details from httpx errors
            if hasattr(e, 'response') and hasattr(e.response, 'text'):
                try:
                    error_detail = e.response.text
                    logger.error(f"Error generating assessment content for {todo.path}: {error_msg}. Response: {error_detail}")
                    error_msg = f"{error_msg}: {error_detail[:200]}"  # Limit error detail length
                except:
                    pass
            else:
                logger.error(f"Error generating assessment content for {todo.path}: {error_msg}")
            return {
                "type": "SLIDE_CONTENT_ERROR",
                "path": todo.path,
                "status": False,
                "actionType": todo.action_type,
                "slideType": "ASSESSMENT",
                "errorMessage": f"Failed to generate content: {error_msg}",
                "contentData": "Error generating content for this slide. Please try again or contact support.",
            }

    async def generate_video_content(
        self, todo: Todo
    ) -> dict:
        """
        Generate video content for a VIDEO type todo by searching YouTube.
        Returns content in the same format as media-service YoutubeContentGenerationStrategy.
        
        Format: {
            "type": "SLIDE_CONTENT_UPDATE",
            "path": "<slidePath>",
            "status": true,
            "title": "<title>",
            "actionType": "<actionType>",
            "slideType": "VIDEO",
            "contentData": <JSON object with video details>
        }
        """
        try:
            logger.info(f"Generating video content for slide: {todo.path}")
            
            # Use keyword if available, otherwise use title or name
            search_query = todo.keyword or todo.title or todo.name
            
            if not search_query:
                raise ValueError("No search query available for YouTube search (keyword, title, or name required)")
            
            # Search YouTube for the video
            video_id = await self._youtube_service.search_video(search_query)
            
            if not video_id:
                raise ValueError(f"No YouTube video found for query: {search_query}")
            
            # Format response matching media-service YoutubeContentGenerationStrategy
            youtube_details = self._youtube_service.format_youtube_response(
                video_id=video_id,
                title=todo.title or todo.name,
                description=f"Video related to: {search_query}"
            )
            
            return {
                "type": "SLIDE_CONTENT_UPDATE",
                "path": todo.path,
                "status": True,
                "title": todo.title or todo.name,
                "actionType": todo.action_type,
                "slideType": "VIDEO",
                "contentData": youtube_details,
            }
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Error generating video content for {todo.path}: {error_msg}")
            return {
                "type": "SLIDE_CONTENT_ERROR",
                "path": todo.path,
                "status": False,
                "actionType": todo.action_type,
                "slideType": "VIDEO",
                "errorMessage": f"Failed to generate content: {error_msg}",
                "contentData": "Error generating video content for this slide. Please try again or contact support.",
            }

    async def generate_ai_video_content(
        self, todo: Todo
    ) -> AsyncGenerator[str, None]:
        """
        Generate AI video content for an AI_VIDEO type todo.
        Streams progress events and returns final video metadata.
        
        Yields SSE events during generation, final event contains video files.
        """
        try:
            logger.info(f"[AI_VIDEO] Starting generation for slide: {todo.path}")
            
            # Generate unique video ID from todo path
            video_id = f"video-{todo.path.replace('.', '-').replace('/', '-')}-{str(uuid4())[:8]}"
            logger.info(f"[AI_VIDEO] Generated video_id: {video_id}")
            
            # Use prompt from todo, or generate from title
            prompt = todo.prompt or f"Create an educational video explaining: {todo.title or todo.name}"
            logger.info(f"[AI_VIDEO] Using prompt: {prompt[:100]}...")
            
            # Send immediate "started" event so frontend knows generation has begun
            started_event = {
                "type": "SLIDE_CONTENT_UPDATE",
                "path": todo.path,
                "status": True,
                "actionType": todo.action_type,
                "slideType": "AI_VIDEO",
                "contentData": {
                    "videoId": video_id,
                    "status": "GENERATING",
                    "message": "AI video generation started. This may take 2-5 minutes...",
                    "currentStage": "INITIALIZING",
                    "progress": 0
                },
                "metadata": {
                    "isGenerating": True,
                    "videoId": video_id
                }
            }
            yield json.dumps(started_event)
            logger.info(f"[AI_VIDEO] Sent started event for {video_id}")
            
            # Stream video generation progress
            # NOTE: Only generates till HTML stage (script, audio, timestamps, timeline)
            # DOES NOT render final video - frontend player will use these files directly
            logger.info(f"[AI_VIDEO] Calling video generation service for {video_id}")
            
            event_count = 0
            async for event in self._video_gen_service.generate_till_stage(
                video_id=video_id,
                prompt=prompt,
                target_stage="HTML",  # STOPS at HTML - no video rendering
                language="English",  # TODO: Get from todo metadata if available
                captions_enabled=True,  # Default for course outline
                html_quality="advanced",  # Default for course outline
                resume=False
            ):
                event_count += 1
                logger.info(f"[AI_VIDEO] Received event #{event_count} for {video_id}: {event.get('type', 'unknown')}, stage={event.get('stage', 'N/A')}")
                
                # Wrap progress events inside a slide update envelope
                wrapped_event = {
                    "type": "SLIDE_CONTENT_UPDATE",
                    "path": todo.path,
                    "status": True,
                    "actionType": todo.action_type,
                    "slideType": "AI_VIDEO",
                    "contentData": {
                        "videoId": video_id,
                        "status": "GENERATING",
                        "currentStage": event.get("stage", "UNKNOWN"),
                        "progress": event.get("percentage", 0),
                        "message": f"Generating {event.get('stage', 'stage')}..."
                    },
                    "metadata": {
                        "isGenerating": True,
                        "videoId": video_id,
                        "internalEvent": event  # Include raw event for debugging
                    }
                }
                yield json.dumps(wrapped_event)
            
            logger.info(f"[AI_VIDEO] Video generation completed. Total events: {event_count}")
            
            # Get final video status from database
            video_status = self._video_gen_service.get_video_status(video_id)
            
            if not video_status:
                raise ValueError(f"Video generation failed: no status found for {video_id}")
            
            logger.info(f"AI video generation completed for {todo.path}. Status: {video_status['status']}, Stage: {video_status['current_stage']}")
            logger.info(f"Generated files: {list(video_status.get('file_ids', {}).keys())}")
            
            # Format final response with video files and IDs for frontend
            ai_video_details = {
                "videoId": video_id,
                "status": "COMPLETED",
                "scriptFileId": video_status["file_ids"].get("script"),
                "audioFileId": video_status["file_ids"].get("audio"),
                "wordsFileId": video_status["file_ids"].get("words"),
                "alignmentFileId": video_status["file_ids"].get("alignment"),
                "timelineFileId": video_status["file_ids"].get("timeline"),
                "scriptUrl": video_status["s3_urls"].get("script"),
                "audioUrl": video_status["s3_urls"].get("audio"),
                "wordsUrl": video_status["s3_urls"].get("words"),
                "alignmentUrl": video_status["s3_urls"].get("alignment"),
                "timelineUrl": video_status["s3_urls"].get("timeline"),
                "language": video_status.get("language", "English"),
                "currentStage": video_status.get("current_stage"),
                "progress": 100
            }
            
            # Final content update event for frontend
            final_update = {
                "type": "SLIDE_CONTENT_UPDATE",
                "path": todo.path,
                "status": True,
                "actionType": todo.action_type,
                "slideType": "AI_VIDEO",
                "contentData": ai_video_details,
                "metadata": {
                    "isGenerating": False,
                    "videoId": video_id
                }
            }
            yield json.dumps(final_update)
            
            logger.info(f"Successfully sent final AI_VIDEO update for {todo.path}")
            
        except Exception as e:
            import traceback
            error_msg = str(e)
            error_trace = traceback.format_exc()
            logger.error(f"[AI_VIDEO] Error generating AI video content for {todo.path}: {error_msg}")
            logger.error(f"[AI_VIDEO] Full traceback:\n{error_trace}")
            
            error_response = {
                "type": "SLIDE_CONTENT_ERROR",
                "path": todo.path,
                "status": False,
                "actionType": todo.action_type,
                "slideType": "AI_VIDEO",
                "errorMessage": f"Failed to generate AI video: {error_msg}",
                "contentData": f"Error generating AI video: {error_msg}",
            }
            yield json.dumps(error_response)

    async def generate_video_code_content(
        self, todo: Todo
    ) -> dict:
        """
        Generate video+code content for a VIDEO_CODE type todo.
        Combines YouTube video with code examples in a split-screen layout.
        
        Format: {
            "type": "SLIDE_CONTENT_UPDATE",
            "path": "<slidePath>",
            "status": true,
            "title": "<title>",
            "actionType": "<actionType>",
            "slideType": "VIDEO_CODE",
            "contentData": {
                "video": { ... YouTube video details ... },
                "code": { "content": "...", "language": "python" },
                "layout": "split-left" | "split-right" | "split-top" | "split-bottom"
            }
        }
        """
        try:
            logger.info(f"Generating video+code content for slide: {todo.path}")
            
            # Step 1: Generate YouTube video content
            video_content = await self.generate_video_content(todo)
            if not video_content.get("status") or video_content.get("type") == "SLIDE_CONTENT_ERROR":
                raise ValueError(f"Failed to generate video: {video_content.get('errorMessage', 'Unknown error')}")
            
            video_data = video_content.get("contentData", {})
            
            # Step 2: Generate code content
            code_prompt = ContentGenerationPrompts.build_code_prompt(
                text_prompt=todo.prompt,
                title=todo.title or todo.name,
                video_topic=todo.title or todo.name
            )
            
            code_content = await self._llm_client.generate_outline(
                prompt=code_prompt,
                model=self._content_model,
            )
            
            # Extract code language from prompt or default to python
            code_language = self._extract_code_language(todo.prompt) or "python"
            
            # Step 3: Determine layout (default: split-left)
            layout = self._extract_layout_preference(todo.prompt) or "split-left"
            
            # Format response
            return {
                "type": "SLIDE_CONTENT_UPDATE",
                "path": todo.path,
                "status": True,
                "title": todo.title or todo.name,
                "actionType": todo.action_type,
                "slideType": "VIDEO_CODE",
                "contentData": {
                    "video": video_data,
                    "code": {
                        "content": code_content,
                        "language": code_language
                    },
                    "layout": layout
                },
            }
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Error generating video+code content for {todo.path}: {error_msg}")
            return {
                "type": "SLIDE_CONTENT_ERROR",
                "path": todo.path,
                "status": False,
                "actionType": todo.action_type,
                "slideType": "VIDEO_CODE",
                "errorMessage": f"Failed to generate content: {error_msg}",
                "contentData": "Error generating video+code content for this slide. Please try again or contact support.",
            }

    async def generate_ai_video_code_content(
        self, todo: Todo
    ) -> AsyncGenerator[str, None]:
        """
        Generate AI video+code content for an AI_VIDEO_CODE type todo.
        Combines AI-generated video with code examples in a split-screen layout.
        Streams progress events and returns final combined content.
        """
        try:
            logger.info(f"[AI_VIDEO_CODE] Starting generation for slide: {todo.path}")
            
            # Step 1: Generate AI video (stream events)
            video_id = None
            video_status = None
            
            async for event_str in self.generate_ai_video_content(todo):
                event = json.loads(event_str)
                
                # Extract video_id from events
                if event.get("slideType") == "AI_VIDEO":
                    content_data = event.get("contentData", {})
                    if content_data.get("videoId") and not video_id:
                        video_id = content_data.get("videoId")
                    
                    # If video generation is complete, get final status
                    if content_data.get("status") == "COMPLETED":
                        video_status = content_data
                        break
                    
                    # Forward progress events with updated slide type
                    progress_event = {
                        "type": "SLIDE_CONTENT_UPDATE",
                        "path": todo.path,
                        "status": True,
                        "actionType": todo.action_type,
                        "slideType": "AI_VIDEO_CODE",
                        "contentData": {
                            "video": content_data,
                            "status": "GENERATING_VIDEO",
                            "message": f"Generating video: {content_data.get('currentStage', 'Processing')}...",
                            "progress": content_data.get("progress", 0)
                        }
                    }
                    yield json.dumps(progress_event)
            
            if not video_status or not video_id:
                raise ValueError(f"AI video generation failed for {todo.path}")
            
            # Step 2: Generate code content
            logger.info(f"[AI_VIDEO_CODE] Generating code content for {todo.path}")
            
            code_prompt = ContentGenerationPrompts.build_code_prompt(
                text_prompt=todo.prompt,
                title=todo.title or todo.name,
                video_topic=todo.title or todo.name
            )
            
            code_content = await self._llm_client.generate_outline(
                prompt=code_prompt,
                model=self._content_model,
            )
            
            # Extract code language and layout
            code_language = self._extract_code_language(todo.prompt) or "python"
            layout = self._extract_layout_preference(todo.prompt) or "split-left"
            
            # Step 3: Combine and return final content
            final_content = {
                "type": "SLIDE_CONTENT_UPDATE",
                "path": todo.path,
                "status": True,
                "title": todo.title or todo.name,
                "actionType": todo.action_type,
                "slideType": "AI_VIDEO_CODE",
                "contentData": {
                    "video": video_status,
                    "code": {
                        "content": code_content,
                        "language": code_language
                    },
                    "layout": layout
                },
            }
            
            yield json.dumps(final_content)
            logger.info(f"[AI_VIDEO_CODE] Successfully completed generation for {todo.path}")
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"[AI_VIDEO_CODE] Error generating AI video+code content for {todo.path}: {error_msg}")
            error_response = {
                "type": "SLIDE_CONTENT_ERROR",
                "path": todo.path,
                "status": False,
                "actionType": todo.action_type,
                "slideType": "AI_VIDEO_CODE",
                "errorMessage": f"Failed to generate AI video+code: {error_msg}",
                "contentData": f"Error generating AI video+code: {error_msg}",
            }
            yield json.dumps(error_response)

    def _extract_code_language(self, prompt: str) -> Optional[str]:
        """Extract programming language from prompt if mentioned."""
        prompt_lower = prompt.lower()
        languages = {
            "python": ["python", "py"],
            "javascript": ["javascript", "js", "node"],
            "java": ["java"],
            "cpp": ["c++", "cpp", "c plus plus"],
            "c": [" c ", " c,"],
            "typescript": ["typescript", "ts"],
            "go": ["go", "golang"],
            "rust": ["rust"],
            "php": ["php"],
            "ruby": ["ruby"],
            "swift": ["swift"],
            "kotlin": ["kotlin"],
            "html": ["html"],
            "css": ["css"],
            "sql": ["sql", "database"],
        }
        
        for lang, keywords in languages.items():
            if any(keyword in prompt_lower for keyword in keywords):
                return lang
        return None

    def _extract_layout_preference(self, prompt: str) -> Optional[str]:
        """Extract layout preference from prompt if mentioned."""
        prompt_lower = prompt.lower()
        
        if "split-left" in prompt_lower or "video left" in prompt_lower or "code right" in prompt_lower:
            return "split-left"
        elif "split-right" in prompt_lower or "video right" in prompt_lower or "code left" in prompt_lower:
            return "split-right"
        elif "split-top" in prompt_lower or "video top" in prompt_lower or "code bottom" in prompt_lower:
            return "split-top"
        elif "split-bottom" in prompt_lower or "video bottom" in prompt_lower or "code top" in prompt_lower:
            return "split-bottom"
        
        return None

    def _extract_json_from_response(self, response: str) -> dict:
        """
        Extract JSON from LLM response, handling markdown code blocks and other formatting.
        Matches the pattern from media-service JsonUtils.extractAndSanitizeJson.
        """
        # Remove markdown code blocks if present
        if "```json" in response:
            start = response.find("```json") + 7
            end = response.find("```", start)
            if end != -1:
                response = response[start:end].strip()
        elif "```" in response:
            start = response.find("```") + 3
            end = response.find("```", start)
            if end != -1:
                response = response[start:end].strip()
        
        # Try to find JSON object boundaries
        start_idx = response.find("{")
        end_idx = response.rfind("}")
        
        if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
            json_str = response[start_idx : end_idx + 1]
            try:
                return json.loads(json_str)
            except json.JSONDecodeError:
                logger.warning(f"Failed to parse JSON, returning raw content")
                return {"raw_content": response}
        
        # Fallback: return as string wrapped in dict
        return {"raw_content": response}

    async def generate_content_for_todo(
        self, todo: Todo
    ) -> AsyncGenerator[str, None]:
        """
        Generate content for a single todo and yield the formatted JSON update.
        This matches the pattern from media-service processSingleTodoForContent.
        """
        try:
            logger.info(
                f"Initiating content generation for slide: {todo.path} "
                f"(Type: {todo.type}, Action: {todo.action_type})"
            )
            
            # Generate content based on todo type
            if todo.type == "DOCUMENT":
                content_update = await self.generate_document_content(
                    todo=todo, prompt=todo.prompt
                )
                # Yield the content update as JSON string (matches media-service format)
                yield json.dumps(content_update)
            elif todo.type == "ASSESSMENT":
                content_update = await self.generate_assessment_content(
                    todo=todo, prompt=todo.prompt
                )
                # Yield the content update as JSON string
                yield json.dumps(content_update)
            elif todo.type == "VIDEO":
                content_update = await self.generate_video_content(todo=todo)
                # Yield the content update as JSON string
                yield json.dumps(content_update)
            elif todo.type == "VIDEO_CODE":
                content_update = await self.generate_video_code_content(todo=todo)
                # Yield the content update as JSON string
                yield json.dumps(content_update)
            elif todo.type == "AI_VIDEO":
                # AI_VIDEO generation streams multiple events
                async for event in self.generate_ai_video_content(todo=todo):
                    yield event
            elif todo.type == "AI_VIDEO_CODE":
                # AI_VIDEO_CODE generation streams multiple events
                async for event in self.generate_ai_video_code_content(todo=todo):
                    yield event
            else:
                logger.warning(f"Unknown todo type: {todo.type}, skipping content generation")
                return
            
            logger.info(f"Successfully completed content generation for slide: {todo.path}")
            
        except Exception as e:
            logger.error(f"Failed content generation for slide {todo.path}: {str(e)}")
            # Yield error response
            error_response = {
                "type": "SLIDE_CONTENT_ERROR",
                "path": todo.path,
                "status": False,
                "actionType": todo.action_type,
                "slideType": todo.type,
                "errorMessage": f"Failed to generate content: {str(e)}",
                "contentData": "Error generating content for this slide. Please try again or contact support.",
            }
            yield json.dumps(error_response)


__all__ = ["ContentGenerationService"]

