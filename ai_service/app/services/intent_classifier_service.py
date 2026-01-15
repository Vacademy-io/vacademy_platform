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
        2. Current slide/chapter name from context
        3. Subject from context
        4. Generic "current topic"
        """
        # Try to extract topic from message
        topic_patterns = [
            r'quiz\s+(?:on|about)\s+([^,.!?]+)',
            r'practice\s+([^,.!?]+)',
            r'test\s+me\s+on\s+([^,.!?]+)',
            r'questions?\s+(?:on|about)\s+([^,.!?]+)',
        ]
        
        message_lower = message.lower()
        for pattern in topic_patterns:
            match = re.search(pattern, message_lower)
            if match:
                topic = match.group(1).strip()
                if len(topic) > 3:  # Avoid very short matches
                    return topic.title()
        
        # Fall back to context
        context_data = context.get("context_data", {})
        
        # Try slide/content name
        if context_data.get("name"):
            return context_data["name"]
        
        # Try chapter
        if context_data.get("chapter"):
            return context_data["chapter"]
        
        # Try subject
        if context_data.get("subject"):
            return context_data["subject"]
        
        return "Current Topic"


__all__ = ["IntentClassifierService"]
