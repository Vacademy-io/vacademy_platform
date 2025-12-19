"""
Repository for AI Generated Video database operations.
"""
from __future__ import annotations

from typing import Optional, Dict, Any
from uuid import uuid4
from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy.exc import IntegrityError

from ..models.ai_gen_video import AiGenVideo
from ..db import get_engine


class AiVideoRepository:
    """Repository for managing AI generated video records."""
    
    def __init__(self, session: Optional[Session] = None):
        """
        Initialize repository with optional session.
        If no session provided, creates a new one for each operation.
        """
        self.session = session
        self._engine = get_engine()
    
    def _get_session(self) -> Session:
        """Get session for database operations."""
        if self.session:
            return self.session
        return Session(self._engine)
    
    def create(
        self,
        video_id: str,
        prompt: str,
        language: str = "English",
        metadata: Optional[Dict[str, Any]] = None
    ) -> AiGenVideo:
        """
        Create a new AI video generation record.
        
        Args:
            video_id: Unique identifier for the video
            prompt: Text prompt for video generation
            language: Language for video content
            metadata: Additional metadata
            
        Returns:
            Created AiGenVideo instance
        """
        session = self._get_session()
        try:
            video_record = AiGenVideo(
                video_id=video_id,
                prompt=prompt,
                language=language,
                current_stage="PENDING",
                status="PENDING",
                extra_metadata=metadata or {},
                file_ids={},
                s3_urls={}
            )
            session.add(video_record)
            session.commit()
            session.refresh(video_record)
            return video_record
        except IntegrityError:
            session.rollback()
            # Video ID already exists, fetch and return it
            return self.get_by_video_id(video_id)
        finally:
            if not self.session:
                session.close()
    
    def get_by_video_id(self, video_id: str) -> Optional[AiGenVideo]:
        """Get video record by video_id."""
        session = self._get_session()
        try:
            stmt = select(AiGenVideo).where(AiGenVideo.video_id == video_id)
            result = session.execute(stmt)
            return result.scalar_one_or_none()
        finally:
            if not self.session:
                session.close()
    
    def get_by_id(self, id: str) -> Optional[AiGenVideo]:
        """Get video record by primary key id."""
        session = self._get_session()
        try:
            stmt = select(AiGenVideo).where(AiGenVideo.id == id)
            result = session.execute(stmt)
            return result.scalar_one_or_none()
        finally:
            if not self.session:
                session.close()
    
    def update_stage(
        self,
        video_id: str,
        stage: str,
        status: str = "IN_PROGRESS",
        file_id: Optional[str] = None,
        s3_url: Optional[str] = None,
        stage_key: Optional[str] = None
    ) -> Optional[AiGenVideo]:
        """
        Update the current stage and optionally add file information.
        
        Args:
            video_id: Video identifier
            stage: New stage (SCRIPT, TTS, WORDS, HTML, RENDER, COMPLETED)
            status: Status (IN_PROGRESS, COMPLETED, FAILED)
            file_id: File ID to store for this stage
            s3_url: S3 URL to store for this stage
            stage_key: Key to use in file_ids/s3_urls JSON (defaults to lowercase stage)
            
        Returns:
            Updated AiGenVideo instance
        """
        session = self._get_session()
        try:
            # Query in current session to ensure object is attached
            video = session.query(AiGenVideo).filter_by(video_id=video_id).first()
            if not video:
                return None
            
            # Update stage and status
            video.current_stage = stage
            video.status = status
            video.updated_at = datetime.utcnow()
            
            # Update file_ids and s3_urls if provided
            if file_id or s3_url:
                key = stage_key or stage.lower()
                
                if file_id:
                    # Create a completely new dict to ensure SQLAlchemy detects the change
                    file_ids = {}
                    if video.file_ids:
                        file_ids.update(video.file_ids)
                    file_ids[key] = file_id
                    video.file_ids = file_ids
                    flag_modified(video, "file_ids")  # Mark JSONB as modified
                
                if s3_url:
                    # Create a completely new dict to ensure SQLAlchemy detects the change
                    s3_urls = {}
                    if video.s3_urls:
                        s3_urls.update(video.s3_urls)
                    s3_urls[key] = s3_url
                    video.s3_urls = s3_urls
                    flag_modified(video, "s3_urls")  # Mark JSONB as modified
            
            # Mark as completed if stage is COMPLETED
            if stage == "COMPLETED":
                video.completed_at = datetime.utcnow()
            
            session.commit()
            session.refresh(video)
            return video
        except Exception as e:
            session.rollback()
            raise e
        finally:
            if not self.session:
                session.close()
    
    def update_files(
        self,
        video_id: str,
        file_ids: Optional[Dict[str, str]] = None,
        s3_urls: Optional[Dict[str, str]] = None
    ) -> Optional[AiGenVideo]:
        """
        Update file_ids and s3_urls for a video.
        
        Args:
            video_id: Video identifier
            file_ids: Dictionary of stage -> file_id mappings
            s3_urls: Dictionary of stage -> s3_url mappings
            
        Returns:
            Updated AiGenVideo instance
        """
        session = self._get_session()
        try:
            # Query in current session to ensure object is attached
            video = session.query(AiGenVideo).filter_by(video_id=video_id).first()
            if not video:
                return None
            
            if file_ids:
                # Create a completely new dict to ensure SQLAlchemy detects the change
                current_file_ids = {}
                if video.file_ids:
                    current_file_ids.update(video.file_ids)
                current_file_ids.update(file_ids)
                video.file_ids = current_file_ids
                flag_modified(video, "file_ids")  # Mark JSONB column as modified for SQLAlchemy change detection
            
            if s3_urls:
                # Create a completely new dict to ensure SQLAlchemy detects the change
                current_s3_urls = {}
                if video.s3_urls:
                    current_s3_urls.update(video.s3_urls)
                current_s3_urls.update(s3_urls)
                video.s3_urls = current_s3_urls
                flag_modified(video, "s3_urls")  # Mark JSONB column as modified for SQLAlchemy change detection
            
            video.updated_at = datetime.utcnow()
            session.commit()
            session.refresh(video)
            return video
        except Exception as e:
            session.rollback()
            raise e
        finally:
            if not self.session:
                session.close()
    
    def mark_failed(
        self,
        video_id: str,
        error_message: str,
        current_stage: Optional[str] = None
    ) -> Optional[AiGenVideo]:
        """
        Mark video generation as failed.
        
        Args:
            video_id: Video identifier
            error_message: Error description
            current_stage: Stage where failure occurred (optional)
            
        Returns:
            Updated AiGenVideo instance
        """
        session = self._get_session()
        try:
            # Query in current session to ensure object is attached
            video = session.query(AiGenVideo).filter_by(video_id=video_id).first()
            if not video:
                return None
            
            video.status = "FAILED"
            video.error_message = error_message
            if current_stage:
                video.current_stage = current_stage
            video.updated_at = datetime.utcnow()
            
            session.commit()
            session.refresh(video)
            return video
        except Exception as e:
            session.rollback()
            raise e
        finally:
            if not self.session:
                session.close()
    
    def mark_completed(self, video_id: str) -> Optional[AiGenVideo]:
        """Mark video generation as completed."""
        return self.update_stage(video_id, "COMPLETED", "COMPLETED")

