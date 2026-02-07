"""
Service for fetching and parsing institute AI settings.
"""
from __future__ import annotations

import json
import logging
from typing import Optional, Dict, Any

from sqlalchemy import select, text, update
from sqlalchemy.orm import Session

import secrets
import string
from datetime import datetime
from uuid import uuid4

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


    def generate_api_key(self, institute_id: str, name: str = "Default API Key") -> Dict[str, Any]:
        """
        Generate a new API key for the institute and store it in setting_json.
        
        Args:
            institute_id: ID of the institute
            name: Friendly name for the key
            
        Returns:
            Dictionary containing the new key and its details
        """
        try:
            # Generate a secure random key
            # Format: vac_live_<32_random_chars>
            alphabet = string.ascii_letters + string.digits
            random_chars = ''.join(secrets.choice(alphabet) for _ in range(32))
            api_key = f"vac_live_{random_chars}"
            
            created_at = datetime.utcnow().isoformat()
            
            # Get current settings
            stmt = text("SELECT setting_json FROM institutes WHERE id = :institute_id")
            result = self.db.execute(stmt, {"institute_id": institute_id})
            row = result.fetchone()
            
            if not row:
                raise ValueError(f"Institute {institute_id} not found")
            
            current_settings = {}
            if row[0]:
                current_settings = json.loads(row[0]) if isinstance(row[0], str) else row[0]
            
            # Initialize settings structure if needed
            if "setting" not in current_settings:
                current_settings["setting"] = {}
                
            # Get existing keys list
            video_api_keys_data = current_settings["setting"].get("VIDEO_API_KEYS", {})
            api_keys = []
            
            if isinstance(video_api_keys_data, list):
                api_keys = video_api_keys_data
            else:
                api_keys = video_api_keys_data.get("keys", [])
            
            # Add new key
            new_key_entry = {
                "id": str(uuid4()),
                "name": name,
                "key": api_key,  # In a real prod environment, we should hash this!
                "created_at": created_at,
                "last_used_at": None,
                "status": "active"
            }
            api_keys.append(new_key_entry)
            
            current_settings["setting"]["VIDEO_API_KEYS"] = {"keys": api_keys}
            
            # Update DB
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
            
            return new_key_entry
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error generating API key for institute {institute_id}: {e}")
            raise

    def get_api_keys(self, institute_id: str) -> List[Dict[str, Any]]:
        """
        Get all active API keys for an institute (masking the actual key).
        """
        try:
            stmt = text("SELECT setting_json FROM institutes WHERE id = :institute_id")
            result = self.db.execute(stmt, {"institute_id": institute_id})
            row = result.fetchone()
            
            if not row or not row[0]:
                return []
                
            settings = json.loads(row[0]) if isinstance(row[0], str) else row[0]
            video_api_keys_data = settings.get("setting", {}).get("VIDEO_API_KEYS", {})
            
            if isinstance(video_api_keys_data, list):
                api_keys = video_api_keys_data
            else:
                api_keys = video_api_keys_data.get("keys", [])
            
            # Mask keys for display
            masked_keys = []
            for k in api_keys:
                if k.get("status") == "active":
                    masked_key = k.copy()
                    # Keep first 12 chars (vac_live_...) and last 4
                    full_key = k.get("key", "")
                    if len(full_key) > 16:
                        masked_key["key"] = f"{full_key[:12]}...{full_key[-4:]}"
                    masked_keys.append(masked_key)
            
            return masked_keys
            
        except Exception as e:
            logger.error(f"Error fetching API keys for institute {institute_id}: {e}")
            return []

    def revoke_api_key(self, institute_id: str, key_id: str) -> bool:
        """
        Revoke/Delete an API key.
        """
        try:
            stmt = text("SELECT setting_json FROM institutes WHERE id = :institute_id")
            result = self.db.execute(stmt, {"institute_id": institute_id})
            row = result.fetchone()
            
            if not row or not row[0]:
                return False
                
            current_settings = json.loads(row[0]) if isinstance(row[0], str) else row[0]
            video_api_keys_data = current_settings.get("setting", {}).get("VIDEO_API_KEYS", {})
            
            if isinstance(video_api_keys_data, list):
                api_keys = video_api_keys_data
            else:
                api_keys = video_api_keys_data.get("keys", [])
            
            # Filter out the key to delete
            original_count = len(api_keys)
            api_keys = [k for k in api_keys if k.get("id") != key_id]
            
            if len(api_keys) == original_count:
                return False  # Key not found
                
            current_settings["setting"]["VIDEO_API_KEYS"] = {"keys": api_keys}
            
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
            return True
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error revoking API key for institute {institute_id}: {e}")
            return False

    def validate_api_key(self, api_key: str) -> Optional[str]:
        """
        Validate an API key and return the associated institute_id.
        Note: This is an expensive operation (scan) given the JSON storage structure.
        Ideally, keys should be in a separate indexed table. 
        For now, we query institutes where setting_json contains the key substring.
        """
        # Security check: basic format
        if not api_key.startswith("vac_live_") or len(api_key) < 20:
            return None
            
        try:
            # We use a LIKE query to find potential matches, then parse JSON to verify.
            # Postgres supports JSONB containment, but we'll stick to text search for compatibility/simplicity
            # assuming setting_json is TEXT or JSON type.
            stmt = text("SELECT id, setting_json FROM institutes WHERE setting_json LIKE :key_pattern")
            # We search for the key string inside the JSON
            result = self.db.execute(stmt, {"key_pattern": f"%{api_key}%"})
            
            rows = result.fetchall()
            for row in rows:
                inst_id, settings_raw = row
                settings = json.loads(settings_raw) if isinstance(settings_raw, str) else settings_raw
                
                keys_data = settings.get("setting", {}).get("VIDEO_API_KEYS", {})
                if isinstance(keys_data, list):
                    keys = keys_data
                else:
                    keys = keys_data.get("keys", [])
                for k in keys:
                    if k.get("key") == api_key and k.get("status") == "active":
                        # Valid key found!
                        # TODO: Update last_used_at (async/background preferred to avoid write-lock latency)
                        return str(inst_id)
            
            return None
            
        except Exception as e:
            logger.error(f"Error validating API key: {e}")
            return None

    def get_video_branding(self, institute_id: str) -> Dict[str, Any]:
        """
        Get video branding configuration for an institute.
        Returns default Vacademy branding if not configured.
        
        Args:
            institute_id: ID of the institute
            
        Returns:
            Dictionary containing video branding configuration
        """
        # Default Vacademy branding
        DEFAULT_BRANDING = {
            "intro": {
                "enabled": True,
                "duration_seconds": 3.0,
                "html": "<div style='display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);'><h1 style='color:#fff; font-size:72px; font-family:Inter,sans-serif; margin:0;'>Vacademy</h1><p style='color:rgba(255,255,255,0.8); font-size:24px; margin-top:16px;'>Learn Smarter</p></div>"
            },
            "outro": {
                "enabled": True,
                "duration_seconds": 4.0,
                "html": "<div style='display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; background:#111;'><h2 style='color:#fff; font-size:56px; font-family:Inter,sans-serif; margin:0;'>Thank You for Watching</h2><p style='color:#888; font-size:28px; margin-top:24px;'>Powered by Vacademy</p></div>"
            },
            "watermark": {
                "enabled": True,
                "position": "top-right",
                "max_width": 200,
                "max_height": 80,
                "margin": 40,
                "opacity": 0.7,
                "html": "<div style='font-family:Inter,sans-serif; font-weight:bold; color:rgba(170,170,170,0.7); font-size:18px; text-align:right;'>Vacademy</div>"
            }
        }
        
        try:
            stmt = text("SELECT setting_json FROM institutes WHERE id = :institute_id")
            result = self.db.execute(stmt, {"institute_id": institute_id})
            row = result.fetchone()
            
            if not row or not row[0]:
                return {"branding": DEFAULT_BRANDING, "has_custom_branding": False}
                
            settings = json.loads(row[0]) if isinstance(row[0], str) else row[0]
            branding = settings.get("setting", {}).get("VIDEO_BRANDING")
            
            if branding:
                # Merge with defaults to ensure all keys exist
                merged = {
                    "intro": {**DEFAULT_BRANDING["intro"], **(branding.get("intro") or {})},
                    "outro": {**DEFAULT_BRANDING["outro"], **(branding.get("outro") or {})},
                    "watermark": {**DEFAULT_BRANDING["watermark"], **(branding.get("watermark") or {})}
                }
                return {"branding": merged, "has_custom_branding": True}
            
            return {"branding": DEFAULT_BRANDING, "has_custom_branding": False}
            
        except Exception as e:
            logger.error(f"Error fetching video branding for institute {institute_id}: {e}")
            return {"branding": DEFAULT_BRANDING, "has_custom_branding": False}

    def update_video_branding(self, institute_id: str, branding: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update video branding configuration for an institute.
        
        Args:
            institute_id: ID of the institute
            branding: Branding configuration dictionary
            
        Returns:
            Updated branding configuration
        """
        try:
            # Get current settings
            stmt = text("SELECT setting_json FROM institutes WHERE id = :institute_id")
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
            
            # Update VIDEO_BRANDING
            current_settings["setting"]["VIDEO_BRANDING"] = branding
            
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
            
            return {"branding": branding, "has_custom_branding": True}
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error updating video branding for institute {institute_id}: {e}")
            raise


__all__ = ["InstituteSettingsService"]

