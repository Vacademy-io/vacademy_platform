"""
Service for fetching and parsing institute AI settings.
"""
from __future__ import annotations

import json
import logging
from typing import Optional, Dict, Any

from sqlalchemy import select, text, update
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class InstituteSettingsService:
    """
    Handles fetching and parsing AI-related settings from the institutes table.
    """
    
    DEFAULT_AI_SETTINGS = {
        "role": "Tutor",
        "assistant_name": "Savir",
        "institute_name": "Vacademy",
        "core_instruction": "You are a helpful tutor assisting students with their doubts.",
        "hard_rules": [
            "Never provide the final answer directly.",
            "Keep responses short and concise unless explaining a complex topic."
        ],
        "adherence_settings": {
            "level": "strict",
            "temperature": 0.5
        }
    }
    
    def __init__(self, db_session: Session):
        self.db = db_session
    
    def get_ai_settings(self, institute_id: str) -> Dict[str, Any]:
        """
        Fetch AI settings for an institute from the setting_json column.
        
        Args:
            institute_id: ID of the institute
            
        Returns:
            Dictionary containing AI settings
        """
        try:
            # Query the institutes table
            stmt = text("""
                SELECT setting_json, name
                FROM institutes
                WHERE id = :institute_id
            """)
            
            result = self.db.execute(stmt, {"institute_id": institute_id})
            row = result.fetchone()
            
            if not row:
                logger.warning(f"Institute {institute_id} not found, using default AI settings")
                return self.DEFAULT_AI_SETTINGS.copy()
            
            setting_json, institute_name = row
            
            # Parse setting_json if it exists
            if setting_json:
                try:
                    settings = json.loads(setting_json) if isinstance(setting_json, str) else setting_json

                    chatbot_setting = settings.get("setting", {}).get("CHATBOT_SETTING", {})
                    
                    ai_settings = chatbot_setting.get("data")
                    
                    # If no data or data is null, use defaults
                    if not ai_settings:
                        logger.warning(f"CHATBOT_SETTING data is empty for institute {institute_id}, using defaults")
                        ai_settings = self.DEFAULT_AI_SETTINGS.copy()
                    
                    # Ensure institute_name is set
                    if "institute_name" not in ai_settings and institute_name:
                        ai_settings["institute_name"] = institute_name
                    
                    return ai_settings
                except (json.JSONDecodeError, TypeError) as e:
                    logger.error(f"Error parsing setting_json for institute {institute_id}: {e}")
            
            # Fallback to default with institute name
            default = self.DEFAULT_AI_SETTINGS.copy()
            if institute_name:
                default["institute_name"] = institute_name
            
            return default
            
        except Exception as e:
            logger.error(f"Error fetching AI settings for institute {institute_id}: {e}")
            return self.DEFAULT_AI_SETTINGS.copy()
    
    def format_rules_for_prompt(self, ai_settings: Dict[str, Any]) -> str:
        """
        Format AI settings into a system prompt string.
        
        Args:
            ai_settings: Dictionary of AI settings
            
        Returns:
            Formatted string for system prompt
        """
        role = ai_settings.get("role", "Tutor")
        assistant_name = ai_settings.get("assistant_name", "AI Tutor")
        institute_name = ai_settings.get("institute_name", "Academy")
        core_instruction = ai_settings.get("core_instruction", "You are a helpful tutor.")
        hard_rules = ai_settings.get("hard_rules", [])
        adherence_level = ai_settings.get("adherence_settings", {}).get("level", "strict")
        
        rules_text = "\n".join([f"- {rule}" for rule in hard_rules])
        
        prompt = f"""
You are {assistant_name}, a {role} at {institute_name}.

{core_instruction}

IMPORTANT RULES (Adherence Level: {adherence_level.upper()}):
{rules_text}

Follow these rules strictly at all times.
"""
        
        return prompt.strip()
    
    def get_temperature(self, ai_settings: Dict[str, Any]) -> float:
        """
        Extract temperature setting from AI settings.
        
        Args:
            ai_settings: Dictionary of AI settings
            
        Returns:
            Temperature value (default 0.3)
        """
        return ai_settings.get("adherence_settings", {}).get("temperature", 0.3)

    def get_ai_course_settings(self, institute_id: str) -> Dict[str, Any]:
        """
        Get AI course settings for an institute, specifically for course outline generation.

        Args:
            institute_id: ID of the institute

        Returns:
            Dictionary containing AI course settings with AI_COURSE_PROMPT
        """
        try:
            # Query the institutes table for AI_settings
            stmt = text("""
                SELECT setting_json
                FROM institutes
                WHERE id = :institute_id
            """)

            result = self.db.execute(stmt, {"institute_id": institute_id})
            row = result.fetchone()

            if not row or not row[0]:
                return {"AI_COURSE_PROMPT": None}

            setting_json = row[0]
            settings = json.loads(setting_json) if isinstance(setting_json, str) else setting_json

            # Extract AI_settings from the settings
            ai_settings = settings.get("setting", {}).get("AI_settings", {})

            return {
                "AI_COURSE_PROMPT": ai_settings.get("AI_COURSE_PROMPT")
            }

        except Exception as e:
            logger.error(f"Error fetching AI course settings for institute {institute_id}: {e}")
            return {"AI_COURSE_PROMPT": None}

    def update_ai_course_settings(self, institute_id: str, ai_course_prompt: Optional[str]) -> Dict[str, Any]:
        """
        Update AI course settings for an institute.

        Args:
            institute_id: ID of the institute
            ai_course_prompt: The AI course prompt to set

        Returns:
            Updated AI course settings
        """
        try:
            # First, get the current settings
            stmt = text("""
                SELECT setting_json
                FROM institutes
                WHERE id = :institute_id
            """)

            result = self.db.execute(stmt, {"institute_id": institute_id})
            row = result.fetchone()

            if not row:
                raise ValueError(f"Institute {institute_id} not found")

            current_settings = {}
            if row[0]:
                current_settings = json.loads(row[0]) if isinstance(row[0], str) else row[0]

            # Ensure the nested structure exists
            if "setting" not in current_settings:
                current_settings["setting"] = {}
            if "AI_settings" not in current_settings["setting"]:
                current_settings["setting"]["AI_settings"] = {}

            # Update the AI_COURSE_PROMPT
            current_settings["setting"]["AI_settings"]["AI_COURSE_PROMPT"] = ai_course_prompt

            # Update the database
            update_stmt = text("""
                UPDATE institutes
                SET setting_json = :setting_json
                WHERE id = :institute_id
            """)

            self.db.execute(update_stmt, {
                "setting_json": json.dumps(current_settings),
                "institute_id": institute_id
            })

            self.db.commit()

            return {
                "AI_COURSE_PROMPT": ai_course_prompt
            }

        except Exception as e:
            self.db.rollback()
            logger.error(f"Error updating AI course settings for institute {institute_id}: {e}")
            raise


__all__ = ["InstituteSettingsService"]
