"""
Service for managing AI tool definitions and execution.
"""
from __future__ import annotations

import json
import logging
from typing import Dict, Any, List, Callable

from sqlalchemy import text
from sqlalchemy.orm import Session

from .learning_progress_service import LearningProgressService

logger = logging.getLogger(__name__)


# Tool definitions in OpenAI function calling format
TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "get_learning_progress",
            "description": "Get comprehensive learning progress including course paths, completion percentages, last viewed content, recent activity, and what to learn next. Use this when student asks about their progress, what they completed, where they left off, what's next, what they should learn next, or their learning path.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {
                        "type": "string",
                        "description": "The student's user ID"
                    },
                    "source_filter": {
                        "type": "string",
                        "enum": ["SLIDE", "CHAPTER", "MODULE", "SUBJECT", "PACKAGE_SESSION"],
                        "description": "Optional: Filter progress by specific source level. Leave empty for all levels."
                    }
                },
                "required": ["user_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_student_feedback",
            "description": "Get detailed performance feedback for the student including strengths, weaknesses, and recent activity",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {
                        "type": "string",
                        "description": "The student's user ID"
                    },
                    "date_range_days": {
                        "type": "integer",
                        "description": "Number of days to look back for analysis",
                        "default": 30
                    }
                },
                "required": ["user_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_related_resources",
            "description": "Search for slides, videos, or questions related to a topic to help the student",
            "parameters": {
                "type": "object",
                "properties": {
                    "topic": {
                        "type": "string",
                        "description": "The topic or keyword to search for"
                    },
                    "resource_type": {
                        "type": "string",
                        "enum": ["slide", "question", "all"],
                        "description": "Type of resource to search for",
                        "default": "all"
                    }
                },
                "required": ["topic"]
            }
        }
    }
]


class ToolManagerService:
    """
    Manages tool definitions and executes tool calls from the LLM.
    """
    
    def __init__(self, db_session: Session):
        self.db = db_session
        self.learning_progress_service = LearningProgressService(db_session)
        
        # Map tool names to executor methods
        self.executors: Dict[str, Callable] = {
            "get_learning_progress": self._execute_get_learning_progress,
            "get_student_feedback": self._execute_get_student_feedback,
            "search_related_resources": self._execute_search_resources,
        }
    
    def get_tool_definitions(self) -> List[Dict[str, Any]]:
        """
        Get all tool definitions for the LLM.
        
        Returns:
            List of tool definitions in OpenAI format
        """
        return TOOL_DEFINITIONS
    
    async def execute_tool(self, tool_name: str, arguments: Dict[str, Any]) -> str:
        """
        Execute a tool by name with given arguments.
        
        Args:
            tool_name: Name of the tool to execute
            arguments: Dictionary of arguments for the tool
            
        Returns:
            Tool execution result as a string
        """
        executor = self.executors.get(tool_name)
        
        if not executor:
            error_msg = f"Unknown tool: {tool_name}"
            logger.error(error_msg)
            return error_msg
        
        try:
            logger.info(f"Executing tool: {tool_name} with args: {arguments}")
            result = await executor(arguments)
            return result
        except Exception as e:
            error_msg = f"Error executing tool {tool_name}: {str(e)}"
            logger.error(error_msg)
            return error_msg
    
    async def _execute_get_learning_progress(self, args: Dict[str, Any]) -> str:
        """
        Get comprehensive learning progress from learner_operation table.
        Returns hierarchical paths, completion percentages, recent activity.
        """
        user_id = args.get("user_id")
        source_filter = args.get("source_filter")
        
        if not user_id:
            return "Error: user_id is required"
        
        try:
            # Use LearningProgressService to fetch and format data
            progress_data = await self.learning_progress_service.get_learning_progress(
                user_id=user_id,
                source_filter=source_filter,
                include_recent_activity=True
            )
            
            # Format for AI consumption
            return json.dumps(progress_data, indent=2, ensure_ascii=False)
            
        except Exception as e:
            logger.error(f"Error fetching learning progress: {e}")
            return f"Unable to fetch learning progress: {str(e)}"
    
    async def _execute_get_student_feedback(self, args: Dict[str, Any]) -> str:
        """
        Get student performance feedback from student_analysis_process and user_linked_data.
        """
        user_id = args.get("user_id")
        date_range_days = args.get("date_range_days", 30)
        
        if not user_id:
            return "Error: user_id is required"
        
        try:
            # Fetch strengths and weaknesses from user_linked_data
            stmt = text("""
                SELECT type, data, percentage
                FROM user_linked_data
                WHERE user_id = :user_id
                ORDER BY percentage DESC
            """)
            result = self.db.execute(stmt, {"user_id": user_id})
            rows = result.fetchall()
            
            strengths = []
            weaknesses = []
            
            for row in rows:
                type_val, data, percentage = row
                if type_val == "strength":
                    strengths.append(f"- {data} ({percentage}%)")
                elif type_val == "weakness":
                    weaknesses.append(f"- {data} ({percentage}%)")
            
            # Fetch recent analysis reports
            stmt = text("""
                SELECT status, report_json, created_at
                FROM student_analysis_process
                WHERE user_id = :user_id
                AND created_at >= NOW() - INTERVAL ':days days'
                ORDER BY created_at DESC
                LIMIT 1
            """)
            result = self.db.execute(stmt, {"user_id": user_id, "days": date_range_days})
            analysis_row = result.fetchone()
            
            recent_report = ""
            if analysis_row and analysis_row[1]:
                try:
                    report = json.loads(analysis_row[1]) if isinstance(analysis_row[1], str) else analysis_row[1]
                    recent_report = f"\nRecent Analysis: {report.get('summary', 'No summary available')}"
                except:
                    pass
            
            # Format response
            feedback = f"""
Student Performance Feedback:

Strengths:
{chr(10).join(strengths) if strengths else '- No strength data available yet'}

Areas for Improvement:
{chr(10).join(weaknesses) if weaknesses else '- No weakness data available yet'}
{recent_report}

Use this information to provide personalized guidance to the student.
"""
            return feedback.strip()
            
        except Exception as e:
            logger.error(f"Error fetching student feedback: {e}")
            return f"Unable to fetch student feedback: {str(e)}"
    
    async def _execute_search_resources(self, args: Dict[str, Any]) -> str:
        """
        Search for related resources (slides, questions) by topic.
        """
        topic = args.get("topic")
        resource_type = args.get("resource_type", "all")
        
        if not topic:
            return "Error: topic is required"
        
        try:
            results = []
            
            # Search slides
            if resource_type in ["slide", "all"]:
                stmt = text("""
                    SELECT id, title, description, source_type
                    FROM slide
                    WHERE status != 'DELETED'
                    AND (
                        title ILIKE :topic
                        OR description ILIKE :topic
                    )
                    LIMIT 5
                """)
                result = self.db.execute(stmt, {"topic": f"%{topic}%"})
                slides = result.fetchall()
                
                if slides:
                    results.append("Related Slides:")
                    for slide in slides:
                        results.append(f"- {slide[1]} (ID: {slide[0]}, Type: {slide[3]})")
            
            # Search questions
            if resource_type in ["question", "all"]:
                stmt = text("""
                    SELECT id, status
                    FROM quiz_slide_question
                    WHERE status != 'DELETED'
                    LIMIT 3
                """)
                result = self.db.execute(stmt)
                questions = result.fetchall()
                
                if questions:
                    results.append("\nRelated Questions:")
                    for q in questions:
                        results.append(f"- Question ID: {q[0]}")
            
            if not results:
                return f"No resources found related to '{topic}'"
            
            return "\n".join(results)
            
        except Exception as e:
            logger.error(f"Error searching resources: {e}")
            return f"Unable to search resources: {str(e)}"
    

__all__ = ["ToolManagerService", "TOOL_DEFINITIONS"]
