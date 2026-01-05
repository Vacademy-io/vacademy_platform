"""
Repository for managing AI token usage records.
"""
from __future__ import annotations

from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, func, extract
from sqlalchemy.dialects.postgresql import aggregate_order_by

from ..models.ai_token_usage import AiTokenUsage, ApiProvider, RequestType


class AiTokenUsageRepository:
    """
    Repository for CRUD operations on AI token usage records.
    """
    
    def __init__(self, session: Session):
        self._session = session
    
    def create_usage_record(
        self,
        api_provider: ApiProvider,
        prompt_tokens: int,
        completion_tokens: int,
        total_tokens: int,
        request_type: RequestType,
        institute_id: Optional[UUID] = None,
        user_id: Optional[UUID] = None,
        model: Optional[str] = None,
        request_id: Optional[str] = None,
        metadata: Optional[str] = None,
    ) -> AiTokenUsage:
        """
        Create a new token usage record.
        
        Args:
            api_provider: API provider (OPENAI or GEMINI)
            prompt_tokens: Number of prompt tokens used
            completion_tokens: Number of completion tokens used
            total_tokens: Total tokens used
            request_type: Type of request (OUTLINE, IMAGE, CONTENT, VIDEO)
            institute_id: Optional institute UUID
            user_id: Optional user UUID
            model: Optional model name
            request_id: Optional request identifier
            metadata: Optional JSON string with additional context
        
        Returns:
            Created AiTokenUsage object
        """
        usage = AiTokenUsage(
            institute_id=institute_id,
            user_id=user_id,
            api_provider=api_provider,
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            request_type=request_type,
            request_id=request_id,
            request_metadata=metadata,
        )
        self._session.add(usage)
        self._session.commit()
        self._session.refresh(usage)
        return usage
    
    def get_usage_by_institute(
        self,
        institute_id: UUID,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> List[AiTokenUsage]:
        """
        Get all token usage records for an institute.
        
        Args:
            institute_id: Institute UUID
            start_date: Optional start date filter
            end_date: Optional end date filter
        
        Returns:
            List of AiTokenUsage records
        """
        query = self._session.query(AiTokenUsage).filter(
            AiTokenUsage.institute_id == institute_id
        )
        
        if start_date:
            query = query.filter(AiTokenUsage.created_at >= start_date)
        if end_date:
            query = query.filter(AiTokenUsage.created_at <= end_date)
        
        return query.order_by(AiTokenUsage.created_at.desc()).all()
    
    def get_usage_by_user(
        self,
        user_id: UUID,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> List[AiTokenUsage]:
        """
        Get all token usage records for a user.
        
        Args:
            user_id: User UUID
            start_date: Optional start date filter
            end_date: Optional end date filter
        
        Returns:
            List of AiTokenUsage records
        """
        query = self._session.query(AiTokenUsage).filter(
            AiTokenUsage.user_id == user_id
        )
        
        if start_date:
            query = query.filter(AiTokenUsage.created_at >= start_date)
        if end_date:
            query = query.filter(AiTokenUsage.created_at <= end_date)
        
        return query.order_by(AiTokenUsage.created_at.desc()).all()
    
    def get_usage_summary(
        self,
        institute_id: Optional[UUID] = None,
        user_id: Optional[UUID] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        group_by_provider: bool = False,
        group_by_type: bool = False,
    ) -> Dict[str, Any]:
        """
        Get aggregated token usage summary.
        
        Args:
            institute_id: Optional institute UUID filter
            user_id: Optional user UUID filter
            start_date: Optional start date filter
            end_date: Optional end date filter
            group_by_provider: If True, group results by API provider
            group_by_type: If True, group results by request type
        
        Returns:
            Dictionary with aggregated usage statistics
        """
        query = self._session.query(AiTokenUsage)
        
        # Apply filters
        if institute_id:
            query = query.filter(AiTokenUsage.institute_id == institute_id)
        if user_id:
            query = query.filter(AiTokenUsage.user_id == user_id)
        if start_date:
            query = query.filter(AiTokenUsage.created_at >= start_date)
        if end_date:
            query = query.filter(AiTokenUsage.created_at <= end_date)
        
        # Aggregate totals
        totals = query.with_entities(
            func.sum(AiTokenUsage.prompt_tokens).label('total_prompt_tokens'),
            func.sum(AiTokenUsage.completion_tokens).label('total_completion_tokens'),
            func.sum(AiTokenUsage.total_tokens).label('total_tokens'),
            func.count(AiTokenUsage.id).label('request_count'),
        ).first()
        
        result = {
            "total_prompt_tokens": totals.total_prompt_tokens or 0,
            "total_completion_tokens": totals.total_completion_tokens or 0,
            "total_tokens": totals.total_tokens or 0,
            "request_count": totals.request_count or 0,
        }
        
        # Group by provider if requested
        if group_by_provider:
            provider_stats = query.with_entities(
                AiTokenUsage.api_provider,
                func.sum(AiTokenUsage.total_tokens).label('tokens'),
                func.count(AiTokenUsage.id).label('count'),
            ).group_by(AiTokenUsage.api_provider).all()
            
            result["by_provider"] = {
                provider.value: {
                    "total_tokens": tokens,
                    "request_count": count,
                }
                for provider, tokens, count in provider_stats
            }
        
        # Group by type if requested
        if group_by_type:
            type_stats = query.with_entities(
                AiTokenUsage.request_type,
                func.sum(AiTokenUsage.total_tokens).label('tokens'),
                func.count(AiTokenUsage.id).label('count'),
            ).group_by(AiTokenUsage.request_type).all()
            
            result["by_type"] = {
                req_type.value: {
                    "total_tokens": tokens,
                    "request_count": count,
                }
                for req_type, tokens, count in type_stats
            }
        
        return result
    
    def get_daily_usage(
        self,
        institute_id: Optional[UUID] = None,
        user_id: Optional[UUID] = None,
        days: int = 30,
    ) -> List[Dict[str, Any]]:
        """
        Get daily token usage for the last N days.
        
        Args:
            institute_id: Optional institute UUID filter
            user_id: Optional user UUID filter
            days: Number of days to look back
        
        Returns:
            List of dictionaries with daily usage statistics
        """
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        query = self._session.query(AiTokenUsage)
        
        if institute_id:
            query = query.filter(AiTokenUsage.institute_id == institute_id)
        if user_id:
            query = query.filter(AiTokenUsage.user_id == user_id)
        
        query = query.filter(
            and_(
                AiTokenUsage.created_at >= start_date,
                AiTokenUsage.created_at <= end_date,
            )
        )
        
        # Group by date
        daily_stats = query.with_entities(
            func.date(AiTokenUsage.created_at).label('date'),
            func.sum(AiTokenUsage.prompt_tokens).label('prompt_tokens'),
            func.sum(AiTokenUsage.completion_tokens).label('completion_tokens'),
            func.sum(AiTokenUsage.total_tokens).label('total_tokens'),
            func.count(AiTokenUsage.id).label('request_count'),
        ).group_by(func.date(AiTokenUsage.created_at)).order_by(func.date(AiTokenUsage.created_at)).all()
        
        return [
            {
                "date": date.isoformat() if date else None,
                "prompt_tokens": prompt_tokens or 0,
                "completion_tokens": completion_tokens or 0,
                "total_tokens": total_tokens or 0,
                "request_count": request_count or 0,
            }
            for date, prompt_tokens, completion_tokens, total_tokens, request_count in daily_stats
        ]
    
    def delete_usage_records(
        self,
        institute_id: Optional[UUID] = None,
        user_id: Optional[UUID] = None,
        before_date: Optional[datetime] = None,
    ) -> int:
        """
        Delete token usage records (for cleanup/archival).
        
        Args:
            institute_id: Optional institute UUID filter
            user_id: Optional user UUID filter
            before_date: Delete records before this date
        
        Returns:
            Number of records deleted
        """
        query = self._session.query(AiTokenUsage)
        
        if institute_id:
            query = query.filter(AiTokenUsage.institute_id == institute_id)
        if user_id:
            query = query.filter(AiTokenUsage.user_id == user_id)
        if before_date:
            query = query.filter(AiTokenUsage.created_at < before_date)
        
        count = query.count()
        query.delete(synchronize_session=False)
        self._session.commit()
        
        return count


__all__ = ["AiTokenUsageRepository"]





