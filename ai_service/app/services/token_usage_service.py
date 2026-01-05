"""
Service for recording and querying AI token usage.
"""
from __future__ import annotations

from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from ..repositories.ai_token_usage_repository import AiTokenUsageRepository
from ..models.ai_token_usage import ApiProvider, RequestType, AiTokenUsage


class TokenUsageService:
    """
    High-level service for token usage tracking.
    Provides convenient methods for recording and querying usage.
    """
    
    def __init__(self, session: Session):
        self._session = session
        self._repository = AiTokenUsageRepository(session)
    
    def record_usage(
        self,
        api_provider: ApiProvider,
        prompt_tokens: int,
        completion_tokens: int,
        total_tokens: int,
        request_type: RequestType,
        institute_id: Optional[str] = None,
        user_id: Optional[str] = None,
        model: Optional[str] = None,
        request_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> AiTokenUsage:
        """
        Record token usage for an API call.
        
        Args:
            api_provider: API provider (OPENAI or GEMINI)
            prompt_tokens: Number of prompt tokens
            completion_tokens: Number of completion tokens
            total_tokens: Total tokens
            request_type: Type of request (OUTLINE, IMAGE, CONTENT, VIDEO)
            institute_id: Optional institute ID (string UUID)
            user_id: Optional user ID (string UUID)
            model: Optional model name
            request_id: Optional request identifier
            metadata: Optional metadata dictionary (will be JSON stringified)
        
        Returns:
            Created AiTokenUsage record
        """
        # Convert string UUIDs to UUID objects
        institute_uuid = None
        user_uuid = None
        
        if institute_id:
            try:
                institute_uuid = UUID(institute_id)
            except (ValueError, AttributeError):
                pass
        
        if user_id:
            try:
                user_uuid = UUID(user_id)
            except (ValueError, AttributeError):
                pass
        
        # Convert metadata dict to JSON string
        metadata_str = None
        if metadata:
            import json
            metadata_str = json.dumps(metadata)
        
        return self._repository.create_usage_record(
            api_provider=api_provider,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            request_type=request_type,
            institute_id=institute_uuid,
            user_id=user_uuid,
            model=model,
            request_id=request_id,
            metadata=metadata_str,
        )
    
    def get_institute_usage(
        self,
        institute_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> List[AiTokenUsage]:
        """
        Get token usage records for an institute.
        
        Args:
            institute_id: Institute ID (string UUID)
            start_date: Optional start date filter
            end_date: Optional end date filter
        
        Returns:
            List of token usage records
        """
        try:
            institute_uuid = UUID(institute_id)
        except (ValueError, AttributeError):
            return []
        
        return self._repository.get_usage_by_institute(
            institute_id=institute_uuid,
            start_date=start_date,
            end_date=end_date,
        )
    
    def get_user_usage(
        self,
        user_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> List[AiTokenUsage]:
        """
        Get token usage records for a user.
        
        Args:
            user_id: User ID (string UUID)
            start_date: Optional start date filter
            end_date: Optional end date filter
        
        Returns:
            List of token usage records
        """
        try:
            user_uuid = UUID(user_id)
        except (ValueError, AttributeError):
            return []
        
        return self._repository.get_usage_by_user(
            user_id=user_uuid,
            start_date=start_date,
            end_date=end_date,
        )
    
    def get_usage_summary(
        self,
        institute_id: Optional[str] = None,
        user_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        group_by_provider: bool = True,
        group_by_type: bool = True,
    ) -> Dict[str, Any]:
        """
        Get aggregated usage summary.
        
        Args:
            institute_id: Optional institute ID (string UUID)
            user_id: Optional user ID (string UUID)
            start_date: Optional start date filter
            end_date: Optional end date filter
            group_by_provider: Group results by API provider
            group_by_type: Group results by request type
        
        Returns:
            Dictionary with usage statistics
        """
        institute_uuid = None
        user_uuid = None
        
        if institute_id:
            try:
                institute_uuid = UUID(institute_id)
            except (ValueError, AttributeError):
                pass
        
        if user_id:
            try:
                user_uuid = UUID(user_id)
            except (ValueError, AttributeError):
                pass
        
        return self._repository.get_usage_summary(
            institute_id=institute_uuid,
            user_id=user_uuid,
            start_date=start_date,
            end_date=end_date,
            group_by_provider=group_by_provider,
            group_by_type=group_by_type,
        )
    
    def get_daily_usage(
        self,
        institute_id: Optional[str] = None,
        user_id: Optional[str] = None,
        days: int = 30,
    ) -> List[Dict[str, Any]]:
        """
        Get daily usage for the last N days.
        
        Args:
            institute_id: Optional institute ID (string UUID)
            user_id: Optional user ID (string UUID)
            days: Number of days to look back
        
        Returns:
            List of daily usage statistics
        """
        institute_uuid = None
        user_uuid = None
        
        if institute_id:
            try:
                institute_uuid = UUID(institute_id)
            except (ValueError, AttributeError):
                pass
        
        if user_id:
            try:
                user_uuid = UUID(user_id)
            except (ValueError, AttributeError):
                pass
        
        return self._repository.get_daily_usage(
            institute_id=institute_uuid,
            user_id=user_uuid,
            days=days,
        )


__all__ = ["TokenUsageService"]





