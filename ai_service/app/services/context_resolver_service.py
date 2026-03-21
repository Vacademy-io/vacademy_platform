"""
Service for resolving context based on context_type and context_meta.
"""
from __future__ import annotations

import logging
import re
from typing import Dict, Any, Optional

from sqlalchemy import select, text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def strip_html(html: str, max_length: int = 4000) -> str:
    """Strip HTML tags, decode entities, normalize whitespace, and truncate."""
    if not html:
        return ""
    # Remove script/style blocks
    text = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', html, flags=re.DOTALL | re.IGNORECASE)
    # Replace block-level tags with newlines
    text = re.sub(r'<(br|p|div|li|h[1-6]|tr)[^>]*/?\s*>', '\n', text, flags=re.IGNORECASE)
    # Strip remaining tags
    text = re.sub(r'<[^>]+>', '', text)
    # Decode common HTML entities
    text = text.replace('&nbsp;', ' ').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"').replace('&#39;', "'")
    # Normalize whitespace
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = text.strip()
    # Truncate
    if len(text) > max_length:
        text = text[:max_length] + "..."
    return text


class ContextResolverService:
    """
    Resolves passive context from context_meta based on context_type.
    Queries appropriate database tables to build context for the LLM.
    """
    
    def __init__(self, db_session: Session):
        self.db = db_session
    
    async def resolve_context(
        self,
        context_type: str,
        context_meta: Dict[str, Any],
        user_id: str,
        institute_id: str
    ) -> Dict[str, Any]:
        """
        Main method to resolve context based on type.
        Combines:
        1. Frontend context (slide/course/general data)
        2. User performance data (strengths/weaknesses from user_linked_data)
        3. User details (name, email from student table)
      
        Returns:
            Dict with context_type, context_data, user_performance, user_details
        """
        import json
        
        # Get user details from student table
        user_details = await self._fetch_user_details(user_id)
        
        # Get user performance data from admin_core_service
        user_performance = await self._fetch_user_performance(user_id, institute_id)
        
        # Clean HTML from content fields before passing to LLM
        cleaned_meta = dict(context_meta) if context_meta else {}
        if "content" in cleaned_meta and cleaned_meta["content"]:
            cleaned_meta["content"] = strip_html(cleaned_meta["content"])
        if "about" in cleaned_meta and cleaned_meta["about"]:
            cleaned_meta["about"] = strip_html(cleaned_meta["about"])
        if "why_learn" in cleaned_meta and cleaned_meta["why_learn"]:
            cleaned_meta["why_learn"] = strip_html(cleaned_meta["why_learn"])
        if "who_should_learn" in cleaned_meta and cleaned_meta["who_should_learn"]:
            cleaned_meta["who_should_learn"] = strip_html(cleaned_meta["who_should_learn"])

        # Clean question/option text (can also contain HTML)
        if "questions" in cleaned_meta and cleaned_meta["questions"]:
            cleaned_meta["questions"] = [strip_html(q) if isinstance(q, str) else q for q in cleaned_meta["questions"]]

        # Return as dict with all context components
        return {
            "context_type": context_type,
            "context_data": cleaned_meta,
            "user_performance": user_performance,
            "user_details": user_details
        }
    
    async def _fetch_user_details(self, user_id: str) -> Dict[str, Any]:
        """
        Fetch user details from student table.
        
        Args:
            user_id: ID of the student
            
        Returns:
            Dict with name and email
        """
        try:
            query = text("""
                SELECT full_name, email
                FROM student
                WHERE user_id = :user_id
                LIMIT 1
            """)
            
            result = self.db.execute(query, {"user_id": user_id}).fetchone()
            
            if result:
                email = result.email or None
                if getattr(result, "full_name", None) and str(result.full_name).strip():
                    name = result.full_name
                elif email and "@" in email:
                    name = email.split("@", 1)[0]
                else:
                    name = "Student"

                return {
                    "name": name,
                    "email": email
                }
            else:
                logger.warning(f"No student record found for user_id {user_id}")
                return {"name": "Student", "email": None}
                
        except Exception as e:
            logger.error(f"Error fetching user details for {user_id}: {e}")
            return {"name": "Student", "email": None}
    
    async def _fetch_user_performance(self, user_id: str, institute_id: str) -> Dict[str, Any]:
        """
        Fetch user's strengths and weaknesses from user_linked_data table.
        Table stores one row per strength/weakness with 'type' column.
        
        Returns:
            Dict with strengths, weaknesses, and performance metrics
        """
        try:
            # Fetch all strengths and weaknesses for the user
            stmt = text("""
                SELECT 
                    type,
                    data,
                    percentage
                FROM user_linked_data
                WHERE user_id = :user_id
                ORDER BY percentage DESC NULLS LAST, created_at DESC
            """)
            
            result = self.db.execute(stmt, {"user_id": user_id})
            rows = result.fetchall()
            
            if not rows:
                logger.info(f"No performance data found for user {user_id}")
                return {
                    "strengths": [],
                    "weaknesses": [],
                    "note": "No performance data available yet"
                }
            
            # Separate strengths and weaknesses
            strengths = []
            weaknesses = []
            
            for row in rows:
                type_val = row[0]  # 'strength' or 'weakness'
                topic = row[1]     # topic name (e.g., 'algebra', 'geometry')
                percentage = row[2]  # score 0-100
                
                entry = {
                    "topic": topic,
                    "score": percentage
                }
                
                if type_val == "strength":
                    strengths.append(entry)
                elif type_val == "weakness":
                    weaknesses.append(entry)
            
            return {
                "strengths": strengths,
                "weaknesses": weaknesses,
                "total_entries": len(rows),
                "note": f"Based on {len(rows)} recorded performance metrics"
            }
            
        except Exception as e:
            logger.error(f"Error fetching user performance data: {e}")
            # Return empty structure so context is still valid
            return {
                "strengths": [],
                "weaknesses": [],
                "note": "Performance data temporarily unavailable"
            }


__all__ = ["ContextResolverService"]
