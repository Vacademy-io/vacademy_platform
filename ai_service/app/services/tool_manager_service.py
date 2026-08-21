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
    },
    {
        "type": "function",
        "function": {
            "name": "get_learning_analytics",
            "description": "Get learning analytics including doubt patterns, quiz performance trends, and topic engagement. Use when the student asks about their learning patterns, weak areas, or overall performance trends.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {
                        "type": "string",
                        "description": "The student's user ID"
                    }
                },
                "required": ["user_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "semantic_search_content",
            "description": "Search across all course materials (slides, chapters, questions) using semantic similarity. Use this when the student asks about a topic and you need to find relevant learning materials, or when you need more context about a subject.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query - describe what you're looking for"
                    },
                    "top_k": {
                        "type": "integer",
                        "description": "Number of results to return (default 5)",
                        "default": 5
                    }
                },
                "required": ["query"]
            }
        }
    }
]


class ToolManagerService:
    """
    Manages tool definitions and executes tool calls from the LLM.
    """
    
    def __init__(
        self,
        db_session: Session,
        rag_service=None,
        analytics_service=None,
        institute_id: str = "",
        user_id: str = "",
    ):
        self.db = db_session
        self.learning_progress_service = LearningProgressService(db_session)
        self.rag_service = rag_service
        self.analytics_service = analytics_service

        # Identity/tenant scope comes from the session row, NEVER from the tool
        # arguments the model produced. `institute_id` in particular is not a
        # declared parameter on any tool, so reading it out of `args` always
        # yielded "" and every scoped query silently matched zero rows —
        # semantic_search_content returned nothing on 571/571 production calls.
        # Holding it as instance state also means a hallucinated user_id cannot
        # be used to read another learner's progress.
        self.institute_id = institute_id or ""
        self.user_id = user_id or ""

        # Map tool names to executor methods
        self.executors: Dict[str, Callable] = {
            "get_learning_progress": self._execute_get_learning_progress,
            "get_student_feedback": self._execute_get_student_feedback,
            "search_related_resources": self._execute_search_resources,
            "semantic_search_content": self._execute_semantic_search,
            "get_learning_analytics": self._execute_get_analytics,
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
        # Session identity wins over anything the model supplied.
        user_id = self.user_id or args.get("user_id")
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
        # Session identity wins over anything the model supplied.
        user_id = self.user_id or args.get("user_id")
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
            
            # Fetch recent analysis reports.
            #
            # This used to read `INTERVAL ':days days'` — a *quoted literal*, so
            # the bind never applied and Postgres raised
            # `invalid input syntax for type interval: ":days days"`. Because that
            # raise happened inside the same try as the strengths/weaknesses
            # query above, the whole tool returned "Unable to fetch student
            # feedback" and threw away data it had already fetched. make_interval
            # takes a real bind, and the lookup now fails in isolation.
            recent_report = ""
            try:
                stmt = text("""
                    SELECT status, report_json, created_at
                    FROM student_analysis_process
                    WHERE user_id = :user_id
                    AND created_at >= NOW() - make_interval(days => :days)
                    ORDER BY created_at DESC
                    LIMIT 1
                """)
                result = self.db.execute(
                    stmt, {"user_id": user_id, "days": int(date_range_days)}
                )
                analysis_row = result.fetchone()

                if analysis_row and analysis_row[1]:
                    report = (
                        json.loads(analysis_row[1])
                        if isinstance(analysis_row[1], str)
                        else analysis_row[1]
                    )
                    recent_report = (
                        f"\nRecent Analysis: "
                        f"{report.get('summary', 'No summary available')}"
                    )
            except Exception as e:
                logger.warning(f"Recent analysis report lookup failed: {e}")

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

        # Both queries below were previously unscoped, so a keyword search ran
        # across every tenant on the platform: a search for "motion" returned
        # slides belonging to other institutes (verified in production). Slides
        # carry no institute_id of their own, so tenancy is resolved through
        # chapter_to_slides -> chapter_package_session_mapping -> package_session
        # -> package_institute.
        if not self.institute_id:
            logger.error("search_related_resources called with no institute scope")
            return (
                "LOOKUP FAILED: resource search is unavailable right now "
                "(no institute scope). Do not invent slide or question names; "
                "tell the student you could not search the material."
            )

        try:
            results = []

            # Search slides — scoped to this institute
            if resource_type in ["slide", "all"]:
                stmt = text("""
                    SELECT DISTINCT s.id, s.title, s.source_type
                    FROM slide s
                    JOIN chapter_to_slides cts
                        ON cts.slide_id = s.id AND cts.status <> 'DELETED'
                    JOIN chapter_package_session_mapping cpsm
                        ON cpsm.chapter_id = cts.chapter_id
                       AND cpsm.status <> 'DELETED'
                    JOIN package_session ps ON ps.id = cpsm.package_session_id
                    JOIN package_institute pi ON pi.package_id = ps.package_id
                    WHERE s.status != 'DELETED'
                    AND pi.institute_id = :institute_id
                    AND (
                        s.title ILIKE :topic
                        OR s.description ILIKE :topic
                    )
                    LIMIT 5
                """)
                result = self.db.execute(
                    stmt,
                    {"topic": f"%{topic}%", "institute_id": self.institute_id},
                )
                slides = result.fetchall()

                if slides:
                    results.append("Related Slides:")
                    for slide in slides:
                        results.append(
                            f"- {slide[1]} (ID: {slide[0]}, Type: {slide[2]})"
                        )

            # Search questions — scoped to this institute, and actually filtered
            # by `topic`. This branch used to ignore `topic` entirely and return
            # three arbitrary question UUIDs with no text, which is unusable to
            # the model; it was nonetheless the most-requested resource_type
            # (153 of 283 production calls). The question text lives in
            # rich_text_data via quiz_slide_question.text_id.
            if resource_type in ["question", "all"]:
                stmt = text("""
                    SELECT DISTINCT q.id,
                           regexp_replace(rt.content, '<[^>]+>', '', 'g') AS question_text
                    FROM quiz_slide_question q
                    JOIN rich_text_data rt ON rt.id = q.text_id
                    JOIN slide s
                        ON s.source_id = q.quiz_slide_id AND s.source_type = 'QUIZ'
                    JOIN chapter_to_slides cts
                        ON cts.slide_id = s.id AND cts.status <> 'DELETED'
                    JOIN chapter_package_session_mapping cpsm
                        ON cpsm.chapter_id = cts.chapter_id
                       AND cpsm.status <> 'DELETED'
                    JOIN package_session ps ON ps.id = cpsm.package_session_id
                    JOIN package_institute pi ON pi.package_id = ps.package_id
                    WHERE q.status != 'DELETED'
                    AND s.status != 'DELETED'
                    AND pi.institute_id = :institute_id
                    AND rt.content ILIKE :topic
                    LIMIT 3
                """)
                result = self.db.execute(
                    stmt,
                    {"topic": f"%{topic}%", "institute_id": self.institute_id},
                )
                questions = result.fetchall()

                if questions:
                    results.append("\nRelated Practice Questions:")
                    for q in questions:
                        q_text = " ".join((q[1] or "").split())[:300]
                        results.append(f"- {q_text} (ID: {q[0]})")

            if not results:
                return (
                    f"No resources found related to '{topic}' in this "
                    f"institute's material. The search ran successfully — there "
                    f"is genuinely no matching slide or question."
                )

            return "\n".join(results)

        except Exception as e:
            logger.error(f"Error searching resources: {e}")
            return (
                f"LOOKUP FAILED: could not search resources ({str(e)}). "
                f"Tell the student you could not search the material rather "
                f"than guessing at what exists."
            )
    

    async def _execute_semantic_search(self, args: Dict[str, Any]) -> str:
        """Search course content using semantic similarity via RAG."""
        query = args.get("query")
        top_k = args.get("top_k", 5)
        # Tenant scope is server-side state, not a model argument.
        institute_id = self.institute_id

        if not query:
            return "Error: query is required"

        if not institute_id:
            # Fail loudly rather than running an unscoped search that quietly
            # matches nothing — the model must be told the lookup did not run.
            logger.error("semantic_search_content called with no institute scope")
            return (
                "LOOKUP FAILED: content search is unavailable right now "
                "(no institute scope). Do not guess at course content; tell the "
                "student you could not search the material."
            )

        if not self.rag_service:
            return "Semantic search is not available. Falling back to keyword search."

        try:
            results = await self.rag_service.search(
                query=query,
                institute_id=institute_id,
                top_k=top_k,
            )

            if not results:
                return f"No relevant content found for: '{query}'"

            formatted = [f"Found {len(results)} relevant materials:\n"]
            for i, r in enumerate(results, 1):
                meta = r.get("metadata", {})
                title = meta.get("title", "Untitled")
                chapter = meta.get("chapter", "")
                subject = meta.get("subject", "")
                source = f"{r['source_type']}/{r['source_id']}"

                formatted.append(f"--- Result {i} (relevance: {r['similarity_score']}) ---")
                if title:
                    formatted.append(f"Title: {title}")
                if chapter:
                    formatted.append(f"Chapter: {chapter}")
                if subject:
                    formatted.append(f"Subject: {subject}")
                formatted.append(f"Source: {source}")
                formatted.append(f"Content:\n{r['content_text']}\n")

            return "\n".join(formatted)
        except Exception as e:
            logger.error(f"Semantic search error: {e}")
            return f"Search error: {str(e)}"


    async def _execute_get_analytics(self, args: Dict[str, Any]) -> str:
        """Get learning analytics for a student."""
        # Session identity wins over anything the model supplied.
        user_id = self.user_id or args.get("user_id")
        if not user_id:
            return "Error: user_id is required"
        if not self.analytics_service:
            return "Learning analytics is not available."
        try:
            return self.analytics_service.get_analytics_summary(user_id)
        except Exception as e:
            logger.error(f"Error getting analytics: {e}")
            return f"Unable to fetch analytics: {str(e)}"


__all__ = ["ToolManagerService", "TOOL_DEFINITIONS"]
