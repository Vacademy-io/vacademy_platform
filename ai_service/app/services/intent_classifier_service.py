"""
Intent Classifier Service - Classifies user message intent (DOUBT, PRACTICE, GENERAL).
"""
from __future__ import annotations

import logging
import re
from typing import Optional

from ..schemas.chat_agent import MessageIntent

logger = logging.getLogger(__name__)


# Keyword patterns for quick classification
PRACTICE_PATTERNS = [
    r'\bquiz\b',
    r'\btest\s+me\b',
    r'\bpractice\b',
    r'\bmcq\b',
    r'\bexercise\b',
    r'\bquestions?\s+for\s+me\b',
    r'\bcheck\s+my\s+(understanding|knowledge)\b',
    r'\bready\s+to\s+practice\b',
    r'\blet\'?s\s+practice\b',
    r'\bgive\s+me\s+(some\s+)?questions?\b',
    r'\bwant\s+to\s+practice\b',
    r'\btest\s+my\s+(understanding|knowledge)\b',
]

DOUBT_PATTERNS = [
    r'\bdoubt\b',
    r'\bdon\'?t\s+understand\b',
    r'\bdidn\'?t\s+understand\b',
    r'\bconfused?\b',
    r'\bwhat\s+(is|are|does|do)\b',
    r'\bhow\s+(does|do|can|is)\b',
    r'\bwhy\s+(is|are|does|do)\b',
    r'\bexplain\b',
    r'\bclarify\b',
    r'\bwhat\s+do\s+you\s+mean\b',
    r'\bi\s+don\'?t\s+get\b',
    r'\bhelp\s+me\s+understand\b',
    r'\bcan\s+you\s+explain\b',
    r'\bwhat\'?s\s+the\s+difference\b',
    r'\bhow\s+come\b',
]


class IntentClassifierService:
    """
    Classifies user message intent using keyword pattern matching.
    
    Intent Categories:
    - DOUBT: User has a question or needs clarification
    - PRACTICE: User wants to take a quiz or practice
    - GENERAL: Regular conversation or chat
    """
    
    def __init__(self):
        # Compile patterns for efficiency
        self.practice_patterns = [re.compile(p, re.IGNORECASE) for p in PRACTICE_PATTERNS]
        self.doubt_patterns = [re.compile(p, re.IGNORECASE) for p in DOUBT_PATTERNS]
    
    def classify(
        self,
        message: str,
        explicit_intent: Optional[MessageIntent] = None,
    ) -> MessageIntent:
        """
        Classify the user's message intent.
        
        Args:
            message: The user's message text
            explicit_intent: Optional explicit intent provided by frontend
            
        Returns:
            MessageIntent (DOUBT, PRACTICE, or GENERAL)
        """
        # If explicit intent provided, use it
        if explicit_intent is not None:
            logger.debug(f"Using explicit intent: {explicit_intent}")
            return explicit_intent
        
        # Normalize message for pattern matching
        message_lower = message.lower().strip()
        
        # Check for practice intent first (more specific)
        if self._matches_patterns(message_lower, self.practice_patterns):
            logger.debug(f"Classified as PRACTICE: '{message[:50]}...'")
            return MessageIntent.PRACTICE
        
        # Check for doubt intent
        if self._matches_patterns(message_lower, self.doubt_patterns):
            logger.debug(f"Classified as DOUBT: '{message[:50]}...'")
            return MessageIntent.DOUBT
        
        # Default to general conversation
        logger.debug(f"Classified as GENERAL: '{message[:50]}...'")
        return MessageIntent.GENERAL
    
    def _matches_patterns(self, text: str, patterns: list) -> bool:
        """Check if text matches any of the compiled patterns."""
        for pattern in patterns:
            if pattern.search(text):
                return True
        return False
    
    def get_practice_topic(self, message: str, context: dict) -> str:
        """
        Extract or infer the topic for practice quiz.

        Priority:
        1. Explicit topic mentioned in message
        2. Chapter name from context (most descriptive of current topic)
        3. Slide/content name (if meaningful, not generic)
        4. Subject from context
        5. Infer from slide content text
        6. Generic "current topic"
        """
        # Try to extract topic from message
        topic_patterns = [
            r'quiz\s+(?:on|about)\s+([^,.!?]+)',
            r'practice\s+([^,.!?]+)',
            r'test\s+me\s+on\s+([^,.!?]+)',
            r'questions?\s+(?:on|about)\s+([^,.!?]+)',
        ]

        # Generic/deictic words that refer to current context, not a real topic
        DEICTIC_WORDS = {"this", "that", "it", "these", "those", "here", "the above",
                         "the slide", "this slide", "this topic", "the topic",
                         "this chapter", "current", "the current"}

        message_lower = message.lower()
        for pattern in topic_patterns:
            match = re.search(pattern, message_lower)
            if match:
                topic = match.group(1).strip()
                # Skip deictic/generic references — fall through to context
                if topic.lower() in DEICTIC_WORDS:
                    break
                if len(topic) > 3:  # Avoid very short matches
                    return topic.title()

        # Fall back to context
        context_data = context.get("context_data", {})

        # Try chapter first (most descriptive of current learning topic)
        if context_data.get("chapter"):
            topic = context_data["chapter"]
            # Enrich with subject for better quiz scoping
            if context_data.get("subject"):
                topic = f"{topic} ({context_data['subject']})"
            return topic

        # Try slide/content name (skip generic names)
        slide_name = context_data.get("name", "")
        generic_names = {"current slide", "slide 1", "slide", ""}
        if slide_name and slide_name.lower().strip() not in generic_names:
            return slide_name

        # Try module
        if context_data.get("module"):
            return context_data["module"]

        # Try subject
        if context_data.get("subject"):
            return context_data["subject"]

        # Try course
        if context_data.get("course"):
            return context_data["course"]

        # Last resort: extract a topic hint from slide content
        content = context_data.get("content", "")
        if content and len(content) > 20:
            # Use first meaningful line as topic hint (up to 100 chars)
            first_line = content.strip().split("\n")[0][:100].strip()
            if len(first_line) > 10:
                logger.info(f"Inferred topic from content: '{first_line[:50]}...'")
                return first_line

        return "Current Topic"


__all__ = ["IntentClassifierService"]
