from __future__ import annotations

import json
import logging
from typing import AsyncGenerator, Optional

from ..ports.llm_client import OutlineLLMClient
from ..schemas.course_outline import Todo
from .youtube_service import YouTubeService

logger = logging.getLogger(__name__)


class ContentGenerationService:
    """
    Service for generating slide content (documents, assessments, and videos) based on todos.
    Matches the pattern from media-service DocumentContentGenerationStrategy, AssignmentContentGeneration, and YoutubeContentGenerationStrategy.
    """

    def __init__(self, llm_client: OutlineLLMClient, youtube_service: Optional[YouTubeService] = None) -> None:
        self._llm_client = llm_client
        self._youtube_service = youtube_service or YouTubeService()
        # Use the same model as outline generation
        self._content_model = "google/gemini-2.5-flash"

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
            "contentData": "<generated HTML content>"
        }
        """
        try:
            logger.info(f"Generating document content for slide: {todo.path}")
            
            # Build document prompt with explicit HTML format requirement
            document_prompt = self._build_document_prompt(prompt, todo.title or todo.name)
            
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
            assessment_prompt = self._build_assessment_prompt(
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

    def _build_document_prompt(self, text_prompt: str, title: str) -> str:
        """
        Build document generation prompt with explicit HTML format requirement.
        Ensures the LLM generates content in HTML format.
        """
        return f"""**Task**: Generate educational content as HTML

**Topic**: {title}

**Content Requirements**:
{text_prompt}

**Output Format**:
- Generate the content in HTML format
- Use proper HTML tags like `<p>`, `<h1>`, `<h2>`, `<h3>`, `<ul>`, `<ol>`, `<li>`, `<strong>`, `<em>`, etc.
- Structure the content with appropriate headings and paragraphs
- Make it well-formatted and readable
- Include examples and explanations where appropriate

**Important**: Return ONLY the HTML content, no markdown, no explanations, just the HTML.
"""

    def _build_assessment_prompt(self, text_prompt: str, title: str) -> str:
        """
        Build assessment generation prompt matching media-service PROMPT_TO_QUESTIONS template.
        """
        return f"""**Objective** : {text_prompt}
**Topic** : {title}
                
**Instructions**:
1. Continuation Handling:
   - Content Should be related to Topic
   - Strictly avoid duplicate content from existing questions
                
2. Content Requirements:
   - Preserve ALL DS_TAGs in HTML comments
   - Include relevant images from Objective
                
3. Question Type Handling:
   - MCQS/MCQM: 4 options with clear single/multiple answers
   - ONE_WORD/LONG_ANSWER:
     * Omit 'options' field
     * Provide detailed 'ans' and 'exp'
   - Set difficulty based on cognitive complexity
                
4. Metadata Requirements:
   - Tags: 5 specific tags per question
   - Subjects: Minimum 1 relevant subject
   - Classes: Include secondary relevant classes if applicable
                
**Output Format**:
                
{{
    "questions": [
        {{
            "question_number": "number",
            "question": {{
                "type": "HTML",
                "content": "string" // Include img tags if present
            }},
            "options": [
                {{
                    "type": "HTML",
                    "preview_id": "string", // generate sequential id for each option like "1", "2", "3", "4"
                    "content": "string" // Include img tags if present
                }}
            ],
            "correct_options": ["1"], // preview_id of correct option or list of correct options
            "ans": "string",
            "exp": "string",
            "question_type": "MCQS | MCQM | ONE_WORD | LONG_ANSWER",  //Strictly Include question_type
            "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
            "level": "easy | medium | hard"
        }}
    ],
    "title": "string", // Suitable title for the question paper
    "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"], // multiple chapter and topic names for question paper
    "difficulty": "easy | medium | hard",
    "is_process_completed": true,
    "subjects": ["subject1", "subject2", "subject3", "subject4", "subject5"], // multiple subject names for question paper
    "classes": ["class 1", "class 2"] // can be of multiple class
}}
                
**Critical Rules**:
- If textPrompt is insufficient for questions, try to extract first 5 questions
- Never modify DS_TAG comments
- Maintain original HTML structure from source
- Strictly validate JSON syntax
- Ensure question numbers are sequential without gaps
- Never repeat question stems or options
"""

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
            elif todo.type == "ASSESSMENT":
                content_update = await self.generate_assessment_content(
                    todo=todo, prompt=todo.prompt
                )
            elif todo.type == "VIDEO":
                content_update = await self.generate_video_content(todo=todo)
            else:
                logger.warning(f"Unknown todo type: {todo.type}, skipping content generation")
                return
            
            # Yield the content update as JSON string (matches media-service format)
            yield json.dumps(content_update)
            
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

