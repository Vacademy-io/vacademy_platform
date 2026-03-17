"""
Context Window Management Service.
Prevents context overflow by summarizing old messages into hierarchical summaries.
"""
from __future__ import annotations

import json
import logging
from typing import Dict, Any, List, Optional

from sqlalchemy.orm import Session

from ..repositories.chat_message_repository import ChatMessageRepository
from ..models.chat_message import ChatMessage
from .chat_llm_client import ChatLLMClient

logger = logging.getLogger(__name__)

# Summarize when message count since last summary exceeds this threshold
SUMMARY_THRESHOLD = 20
# Keep this many recent messages in full (not summarized)
RECENT_MESSAGES_LIMIT = 10


class ContextWindowService:
    """
    Manages conversation context window by generating hierarchical summaries.
    Keeps recent messages in full and summarizes older ones.
    """

    def __init__(
        self,
        db_session: Session,
        message_repo: ChatMessageRepository,
        llm_client: ChatLLMClient,
    ):
        self.db = db_session
        self.message_repo = message_repo
        self.llm_client = llm_client

    def should_summarize(self, session_id: str) -> bool:
        """Check if the session needs a new summary based on message count."""
        # Get latest summary
        latest_summary = self._get_latest_summary(session_id)

        # Count user+assistant messages since last summary
        if latest_summary:
            after_id = latest_summary.id
        else:
            after_id = 0

        messages = self.message_repo.get_messages_by_session(
            session_id=session_id,
            after_message_id=after_id,
        )
        # Count only user and assistant messages
        count = sum(1 for m in messages if m.message_type in ("user", "assistant"))
        return count >= SUMMARY_THRESHOLD

    async def generate_summary(
        self,
        session_id: str,
        institute_id: str,
        user_id: str,
    ) -> Optional[ChatMessage]:
        """
        Generate a summary of messages since the last summary.
        Saves it as a 'summary' type message.
        """
        latest_summary = self._get_latest_summary(session_id)
        after_id = latest_summary.id if latest_summary else 0

        # Get messages to summarize
        messages = self.message_repo.get_messages_by_session(
            session_id=session_id,
            after_message_id=after_id,
        )
        # Filter to user and assistant only
        conv_messages = [m for m in messages if m.message_type in ("user", "assistant")]

        if len(conv_messages) < SUMMARY_THRESHOLD:
            return None

        # Build conversation text for summarization
        conversation_text = self._format_conversation(conv_messages)

        # Include previous summary for continuity
        prev_summary = ""
        if latest_summary:
            prev_summary = f"\nPrevious conversation summary:\n{latest_summary.content}\n"

        # Generate summary via LLM
        summary_prompt = f"""Summarize the following conversation between a student and an AI tutor.
Focus on:
1. Key topics discussed
2. Questions the student asked and main answers given
3. Any quizzes taken and their results
4. The student's current understanding and struggles
5. What was being worked on most recently

Keep the summary concise (150-250 words) but preserve important context that would help continue the conversation naturally.
{prev_summary}
Conversation:
{conversation_text}

Summary:"""

        try:
            response = await self.llm_client.chat_completion(
                messages=[{"role": "user", "content": summary_prompt}],
                tools=None,
                temperature=0.2,
                max_tokens=500,
                institute_id=institute_id,
                user_id=user_id,
            )

            summary_text = response.get("content", "")
            if not summary_text:
                return None

            # Store as summary message
            summary_msg = self.message_repo.create_message(
                session_id=session_id,
                message_type="summary",
                content=summary_text,
                metadata={
                    "summarized_from_id": conv_messages[0].id if conv_messages else None,
                    "summarized_to_id": conv_messages[-1].id if conv_messages else None,
                    "message_count": len(conv_messages),
                },
            )

            logger.info(
                f"Generated summary for session {session_id}: "
                f"{len(conv_messages)} messages → {len(summary_text)} chars"
            )
            return summary_msg

        except Exception as e:
            logger.error(f"Error generating summary for session {session_id}: {e}")
            return None

    def get_optimized_history(self, session_id: str) -> List[Dict[str, str]]:
        """
        Get optimized conversation history for LLM context.
        Returns: latest summary (if any) + recent messages.
        This replaces the simple `get_conversation_history(limit=10)`.
        """
        result_messages = []

        # Get latest summary
        latest_summary = self._get_latest_summary(session_id)
        if latest_summary:
            # Include summary as a system-like context block
            result_messages.append({
                "role": "system",
                "content": f"[Conversation Summary]\n{latest_summary.content}",
            })

        # Get recent messages (after summary, or all if no summary)
        after_id = latest_summary.id if latest_summary else None
        recent = self.message_repo.get_conversation_history(
            session_id=session_id,
            limit=RECENT_MESSAGES_LIMIT,
        )

        # If we have a summary, only include messages after it
        if latest_summary:
            recent = [m for m in recent if m.id > latest_summary.id]
            # If filtering leaves too few, get more
            if len(recent) < 4:
                recent = self.message_repo.get_conversation_history(
                    session_id=session_id,
                    limit=RECENT_MESSAGES_LIMIT,
                )

        for msg in recent:
            if msg.message_type == "user":
                result_messages.append({"role": "user", "content": msg.content})
            elif msg.message_type == "assistant":
                result_messages.append({"role": "assistant", "content": msg.content})

        return result_messages

    def _get_latest_summary(self, session_id: str) -> Optional[ChatMessage]:
        """Get the most recent summary message for a session."""
        from sqlalchemy import select, and_

        stmt = (
            select(ChatMessage)
            .where(
                and_(
                    ChatMessage.session_id == session_id,
                    ChatMessage.message_type == "summary",
                )
            )
            .order_by(ChatMessage.id.desc())
            .limit(1)
        )

        result = self.db.execute(stmt)
        return result.scalars().first()

    def _format_conversation(self, messages: List[ChatMessage]) -> str:
        """Format a list of messages into readable conversation text."""
        lines = []
        for msg in messages:
            role = "Student" if msg.message_type == "user" else "Tutor"
            # Truncate very long messages
            content = msg.content[:500] if len(msg.content) > 500 else msg.content
            lines.append(f"{role}: {content}")
        return "\n".join(lines)


__all__ = ["ContextWindowService"]
