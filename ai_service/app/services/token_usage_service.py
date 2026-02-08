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
from ..constants.models import get_model_pricing


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
        input_token_price: Optional[float] = None,
        output_token_price: Optional[float] = None,
        total_price: Optional[float] = None,
        tts_provider: Optional[str] = None,
        character_count: Optional[int] = None,
    ) -> AiTokenUsage:
        """
        Record token usage for an API call.
        
        Args:
            api_provider: API provider (OPENAI or GEMINI)
            prompt_tokens: Number of prompt tokens
            completion_tokens: Number of completion tokens
            total_tokens: Total tokens
            request_type: Type of request (OUTLINE, IMAGE, CONTENT, VIDEO, TTS, etc.)
            institute_id: Optional institute ID (string UUID)
            user_id: Optional user ID (string UUID)
            model: Optional model name
            request_id: Optional request identifier
            metadata: Optional metadata dictionary (will be JSON stringified)
            input_token_price: Optional price per input token
            output_token_price: Optional price per output token
            total_price: Optional total price (if not provided, will be calculated)
            tts_provider: Optional TTS provider (google, edge, elevenlabs) for TTS requests
            character_count: Optional character count for TTS requests
        
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
        
        # Auto-fetch pricing from model if not provided
        final_input_price = input_token_price
        final_output_price = output_token_price
        
        if model and (final_input_price is None or final_output_price is None):
            model_pricing = get_model_pricing(model)
            if model_pricing:
                if final_input_price is None:
                    final_input_price = model_pricing.get("input_token_price")
                if final_output_price is None:
                    final_output_price = model_pricing.get("output_token_price")
        
        # Calculate total price if not provided but pricing is available
        calculated_total_price = total_price
        if calculated_total_price is None and final_input_price is not None and final_output_price is not None:
            calculated_total_price = (final_input_price * prompt_tokens) + (final_output_price * completion_tokens)
        
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
            input_token_price=final_input_price,
            output_token_price=final_output_price,
            total_price=calculated_total_price,
            tts_provider=tts_provider,
            character_count=character_count,
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
    
    def get_institute_activity_log(
        self,
        institute_id: str,
        page: int = 1,
        page_size: int = 20,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        request_type: Optional[RequestType] = None,
    ) -> tuple[List[AiTokenUsage], int]:
        """
        Get paginated activity log for an institute.
        
        Args:
            institute_id: Institute ID (string UUID)
            page: Page number (1-indexed)
            page_size: Number of records per page
            start_date: Optional start date filter
            end_date: Optional end date filter
            request_type: Optional request type filter
        
        Returns:
            Tuple of (list of records, total count)
        """
        try:
            institute_uuid = UUID(institute_id)
        except (ValueError, AttributeError):
            return [], 0
        
        return self._repository.get_institute_activity_log(
            institute_id=institute_uuid,
            page=page,
            page_size=page_size,
            start_date=start_date,
            end_date=end_date,
            request_type=request_type,
        )
    
    def get_institute_activity_log_by_user(
        self,
        institute_id: str,
        page: int = 1,
        page_size: int = 20,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        request_type: Optional[RequestType] = None,
    ) -> tuple[List[Dict[str, Any]], int]:
        """
        Get paginated activity log for an institute grouped by user.
        
        Args:
            institute_id: Institute ID (string UUID)
            page: Page number (1-indexed)
            page_size: Number of records per page
            start_date: Optional start date filter
            end_date: Optional end date filter
            request_type: Optional request type filter
        
        Returns:
            Tuple of (list of user activity records with aggregated stats, total count)
        """
        try:
            institute_uuid = UUID(institute_id)
        except (ValueError, AttributeError):
            return [], 0
        
        return self._repository.get_institute_activity_log_by_user(
            institute_id=institute_uuid,
            page=page,
            page_size=page_size,
            start_date=start_date,
            end_date=end_date,
            request_type=request_type,
        )


__all__ = ["TokenUsageService"]





