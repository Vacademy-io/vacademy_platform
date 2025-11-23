from __future__ import annotations

import json
from typing import Any, Dict

from ..schemas.course_outline import CourseOutlineResponse


class CourseOutlineParser:
    """
    Responsible for turning raw LLM output into a typed CourseOutlineResponse.

    Keeps parsing, sanitisation, and fallback behaviour isolated from the service
    orchestration and HTTP layers.
    """

    def parse(self, llm_raw_output: str) -> CourseOutlineResponse:
        """
        Parse the media-service style output which includes thinking/generation phases
        and ends with a final JSON containing explanation and todos.
        """
        try:
            # Extract the final JSON block (should contain explanation and todos)
            json_str = self._extract_final_json(llm_raw_output)
            data: Dict[str, Any] = json.loads(json_str)

            # Convert the media-service format to our schema
            return self._convert_from_media_service_format(data)
        except Exception:
            # Safe fallback: empty outline
            return CourseOutlineResponse(
                explanation="",
                tree=[],
                todos=[],
                course_metadata={
                    "course_name": "Error",
                    "about_the_course_html": "",
                    "why_learn_html": "",
                    "who_should_learn_html": "",
                    "course_banner_media_id": "",
                    "course_preview_image_media_id": "",
                    "tags": [],
                    "course_depth": 3
                }
            )

    def _convert_from_media_service_format(self, data: Dict[str, Any]) -> CourseOutlineResponse:
        """Convert media-service JSON format to our CourseOutlineResponse format."""
        # Debug: Log the structure we received from LLM
        print(f"DEBUG PARSER: Received data keys: {list(data.keys())}")
        print(f"DEBUG PARSER: Number of todos: {len(data.get('todos', []))}")
        
        explanation = data.get("explanation", "")

        # Extract todos and convert to our format
        todos_data = data.get("todos", [])
        todos = []

        for i, todo_data in enumerate(todos_data):
            # Extract hierarchical names from LLM response (try both snake_case and camelCase)
            subject_name = todo_data.get("subject_name") or todo_data.get("subjectName")
            module_name = todo_data.get("module_name") or todo_data.get("moduleName")
            chapter_name = todo_data.get("chapter_name") or todo_data.get("chapterName")
            
            # Debug: Log what we're extracting
            if i == 0:  # Log first todo for debugging
                print(f"DEBUG PARSER: First todo raw data keys: {list(todo_data.keys())}")
                print(f"DEBUG PARSER: subject_name from LLM: {subject_name}")
                print(f"DEBUG PARSER: module_name from LLM: {module_name}")
                print(f"DEBUG PARSER: chapter_name from LLM: {chapter_name}")
            
            todo = {
                "name": todo_data.get("name", f"todo-{i}"),
                "title": todo_data.get("title", ""),
                "type": todo_data.get("type", "DOCUMENT"),
                "path": todo_data.get("path", ""),
                "keyword": todo_data.get("keyword"),
                "model": todo_data.get("model"),
                "action_type": todo_data.get("actionType", "ADD"),  # media-service uses actionType
                "prompt": todo_data.get("prompt", ""),
                "order": todo_data.get("order", i + 1),
                "subject_name": subject_name,
                "module_name": module_name,
                "chapter_name": chapter_name
            }
            todos.append(todo)

        # Extract course metadata
        metadata_data = data.get("courseMetadata", {})
        course_metadata = {
            "course_name": metadata_data.get("courseName", "Generated Course"),
            "about_the_course_html": metadata_data.get("aboutTheCourseHtml", "<p>Course description</p>"),
            "why_learn_html": metadata_data.get("whyLearnHtml", "<p>Benefits of learning</p>"),
            "who_should_learn_html": metadata_data.get("whoShouldLearnHtml", "<p>Target audience</p>"),
            "course_banner_media_id": metadata_data.get("courseBannerMediaId", "course-banner.jpg"),
            "course_preview_image_media_id": metadata_data.get("coursePreviewImageMediaId", "course-preview.jpg"),
            "tags": metadata_data.get("tags", []),
            "course_depth": metadata_data.get("courseDepth", 3)
        }

        # Extract tree structure from LLM response
        tree_data = data.get("tree", [])
        tree = tree_data  # Pass through the tree structure from LLM

        return CourseOutlineResponse(
            explanation=explanation,
            tree=tree,
            todos=todos,
            course_metadata=course_metadata
        )

    @staticmethod
    def _extract_final_json(raw: str) -> str:
        """
        Extract the final JSON block from the media-service style output.
        Looks for the JSON block that contains "explanation" and "todos".
        """
        # Look for the final JSON block (after all the [Thinking...]/[Generating...] phases)
        lines = raw.strip().split('\n')

        # Find the last JSON block
        json_start = -1
        brace_count = 0

        for i in range(len(lines) - 1, -1, -1):
            line = lines[i].strip()
            if '}' in line:
                if json_start == -1:
                    json_start = i
                brace_count += line.count('}')
            if '{' in line:
                brace_count -= line.count('{')
                if brace_count == 0 and json_start != -1:
                    # Found a complete JSON block
                    json_block = '\n'.join(lines[i:json_start + 1])
                    # Check if it contains "explanation" and "todos"
                    if '"explanation"' in json_block and '"todos"' in json_block:
                        return json_block

        # Fallback: try to extract any JSON-like block
        last_open = raw.rfind("{")
        if last_open == -1:
            return "{}"
        candidate = raw[last_open:]
        return candidate.strip()


__all__ = ["CourseOutlineParser"]


