"""
Repository for managing AI API keys stored in the database.
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from ..models.ai_api_keys import AiApiKeys


class AiApiKeysRepository:
    """
    Repository for retrieving API keys from the database.
    
    Supports hierarchical key resolution:
    1. User-level keys (highest priority)
    2. Institute-level keys (fallback)
    """
    
    def __init__(self, session: Session):
        self._session = session
    
    def get_keys_for_user(
        self,
        user_id: UUID,
        institute_id: Optional[UUID] = None
    ) -> Optional[AiApiKeys]:
        """
        Get API keys for a user, checking user-level first, then institute-level.
        
        Args:
            user_id: User UUID
            institute_id: Optional institute UUID for fallback
        
        Returns:
            AiApiKeys object or None if no keys found
        """
        # First try user-level keys
        user_keys = self._session.query(AiApiKeys).filter(
            and_(
                AiApiKeys.user_id == user_id,
                AiApiKeys.is_active == True
            )
        ).first()
        
        if user_keys:
            return user_keys
        
        # Fallback to institute-level keys
        if institute_id:
            institute_keys = self._session.query(AiApiKeys).filter(
                and_(
                    AiApiKeys.institute_id == institute_id,
                    AiApiKeys.user_id.is_(None),  # Only institute-level, not user-level
                    AiApiKeys.is_active == True
                )
            ).first()
            
            if institute_keys:
                return institute_keys
        
        return None
    
    def get_keys_for_institute(
        self,
        institute_id: UUID
    ) -> Optional[AiApiKeys]:
        """
        Get API keys for an institute.
        
        Args:
            institute_id: Institute UUID
        
        Returns:
            AiApiKeys object or None if no keys found
        """
        institute_keys = self._session.query(AiApiKeys).filter(
            and_(
                AiApiKeys.institute_id == institute_id,
                AiApiKeys.user_id.is_(None),  # Only institute-level
                AiApiKeys.is_active == True
            )
        ).first()
        
        return institute_keys
    
    def create_or_update_institute_keys(
        self,
        institute_id: UUID,
        openai_key: Optional[str] = None,
        gemini_key: Optional[str] = None,
        default_model: Optional[str] = None,
        notes: Optional[str] = None,
        created_by: Optional[UUID] = None
    ) -> AiApiKeys:
        """
        Create or update institute-level API keys.
        
        Args:
            institute_id: Institute UUID
            openai_key: Optional OpenAI/OpenRouter API key
            gemini_key: Optional Gemini API key
            default_model: Optional default model preference
            notes: Optional notes
            created_by: Optional user UUID who created/updated this
        
        Returns:
            Created or updated AiApiKeys object
        """
        existing = self.get_keys_for_institute(institute_id)
        
        if existing:
            # Update existing
            if openai_key is not None:
                existing.openai_key = openai_key
            if gemini_key is not None:
                existing.gemini_key = gemini_key
            if default_model is not None:
                existing.default_model = default_model
            if notes is not None:
                existing.notes = notes
            if created_by is not None:
                existing.created_by = created_by
            self._session.commit()
            return existing
        else:
            # Create new
            new_keys = AiApiKeys(
                institute_id=institute_id,
                user_id=None,
                openai_key=openai_key,
                gemini_key=gemini_key,
                default_model=default_model,
                notes=notes,
                created_by=created_by,
                is_active=True
            )
            self._session.add(new_keys)
            self._session.commit()
            return new_keys
    
    def create_or_update_user_keys(
        self,
        user_id: UUID,
        institute_id: Optional[UUID] = None,
        openai_key: Optional[str] = None,
        gemini_key: Optional[str] = None,
        default_model: Optional[str] = None,
        notes: Optional[str] = None,
        created_by: Optional[UUID] = None
    ) -> AiApiKeys:
        """
        Create or update user-level API keys.
        
        Args:
            user_id: User UUID
            institute_id: Optional institute UUID for lookup context only (not stored in DB)
            openai_key: Optional OpenAI/OpenRouter API key
            gemini_key: Optional Gemini API key
            default_model: Optional default model preference
            notes: Optional notes
            created_by: Optional user UUID who created/updated this
        
        Returns:
            Created or updated AiApiKeys object
            
        Note:
            User-level keys are stored with user_id only (institute_id is NULL).
            The institute_id parameter is only used for lookup/context purposes.
        """
        existing = self._session.query(AiApiKeys).filter(
            and_(
                AiApiKeys.user_id == user_id,
                AiApiKeys.is_active == True
            )
        ).first()
        
        if existing:
            # Update existing
            if openai_key is not None:
                existing.openai_key = openai_key
            if gemini_key is not None:
                existing.gemini_key = gemini_key
            if default_model is not None:
                existing.default_model = default_model
            if notes is not None:
                existing.notes = notes
            if created_by is not None:
                existing.created_by = created_by
            self._session.commit()
            return existing
        else:
            # Create new
            # For user-level keys, institute_id should be NULL (constraint requires only one entity type)
            new_keys = AiApiKeys(
                institute_id=None,  # User-level keys should not have institute_id
                user_id=user_id,
                openai_key=openai_key,
                gemini_key=gemini_key,
                default_model=default_model,
                notes=notes,
                created_by=created_by,
                is_active=True
            )
            self._session.add(new_keys)
            self._session.commit()
            return new_keys


__all__ = ["AiApiKeysRepository"]





