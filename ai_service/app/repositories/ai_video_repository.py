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
from sqlalchemy.exc import IntegrityError, OperationalError, PendingRollbackError

from ..models.ai_gen_video import AiGenVideo
from ..db import get_engine


def _is_connection_error(exc: Exception) -> bool:
    """Return True if the exception looks like a stale/dropped DB connection."""
    if isinstance(exc, (OperationalError, PendingRollbackError)):
        return True
    msg = str(exc).lower()
    return (
        "server closed the connection" in msg
        or "connection was reset" in msg
        or "ssl connection has been closed" in msg
        or "could not connect" in msg
        or "broken pipe" in msg
    )


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

    def _get_fresh_session(self) -> Session:
        """Always create a fresh session from the engine.

        Used for post-pipeline DB operations where the injected FastAPI session
        may have become stale after a long-running background task.
        """
        return Session(self._engine)
    
    def create(
        self,
        video_id: str,
        prompt: str,
        language: str = "English",
        content_type: str = "VIDEO",
        metadata: Optional[Dict[str, Any]] = None
    ) -> AiGenVideo:
        """
        Create a new AI video generation record.
        
        Args:
            video_id: Unique identifier for the video
            prompt: Text prompt for video generation
            language: Language for video content
            content_type: Type of content (VIDEO, QUIZ, STORYBOOK, etc.)
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
                content_type=content_type,
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
        def _do_update_stage(session: Session) -> Optional[AiGenVideo]:
            video = session.query(AiGenVideo).filter_by(video_id=video_id).first()
            if not video:
                return None
            video.current_stage = stage
            video.status = status
            video.updated_at = datetime.utcnow()
            if file_id or s3_url:
                key = stage_key or stage.lower()
                if file_id:
                    file_ids = {}
                    if video.file_ids:
                        file_ids.update(video.file_ids)
                    file_ids[key] = file_id
                    video.file_ids = file_ids
                    flag_modified(video, "file_ids")
                if s3_url:
                    s3_urls = {}
                    if video.s3_urls:
                        s3_urls.update(video.s3_urls)
                    s3_urls[key] = s3_url
                    video.s3_urls = s3_urls
                    flag_modified(video, "s3_urls")
            if stage == "COMPLETED":
                video.completed_at = datetime.utcnow()
            session.commit()
            session.refresh(video)
            return video

        session = self._get_session()
        try:
            return _do_update_stage(session)
        except Exception as e:
            try:
                session.rollback()
            except Exception:
                pass
            # If the injected session is stale, retry with a fresh engine session
            if self.session and _is_connection_error(e):
                fresh = self._get_fresh_session()
                try:
                    return _do_update_stage(fresh)
                except Exception as e2:
                    fresh.rollback()
                    raise e2
                finally:
                    fresh.close()
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
        def _do_update_files(session: Session) -> Optional[AiGenVideo]:
            video = session.query(AiGenVideo).filter_by(video_id=video_id).first()
            if not video:
                return None
            if file_ids:
                current_file_ids = {}
                if video.file_ids:
                    current_file_ids.update(video.file_ids)
                current_file_ids.update(file_ids)
                video.file_ids = current_file_ids
                flag_modified(video, "file_ids")
            if s3_urls:
                current_s3_urls = {}
                if video.s3_urls:
                    current_s3_urls.update(video.s3_urls)
                current_s3_urls.update(s3_urls)
                video.s3_urls = current_s3_urls
                flag_modified(video, "s3_urls")
            video.updated_at = datetime.utcnow()
            session.commit()
            session.refresh(video)
            return video

        session = self._get_session()
        try:
            return _do_update_files(session)
        except Exception as e:
            try:
                session.rollback()
            except Exception:
                pass
            # If the injected session is stale, retry with a fresh engine session
            if self.session and _is_connection_error(e):
                fresh = self._get_fresh_session()
                try:
                    return _do_update_files(fresh)
                except Exception as e2:
                    fresh.rollback()
                    raise e2
                finally:
                    fresh.close()
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
        def _do_mark_failed(session: Session) -> Optional[AiGenVideo]:
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

        session = self._get_session()
        try:
            return _do_mark_failed(session)
        except Exception as e:
            try:
                session.rollback()
            except Exception:
                pass
            if self.session and _is_connection_error(e):
                fresh = self._get_fresh_session()
                try:
                    return _do_mark_failed(fresh)
                except Exception as e2:
                    fresh.rollback()
                    raise e2
                finally:
                    fresh.close()
            raise e
        finally:
            if not self.session:
                session.close()
    
    def mark_completed(self, video_id: str) -> Optional[AiGenVideo]:
        """Mark video generation as completed."""
        return self.update_stage(video_id, "COMPLETED", "COMPLETED")

    def get_history_by_institute(
        self,
        institute_id: str,
        limit: int = 10,
        offset: int = 0
    ) -> list[AiGenVideo]:
        """Get history of generations for an institute."""
        session = self._get_session()
        try:
            # Query JSONB metadata field
            stmt = (
                select(AiGenVideo)
                .where(AiGenVideo.extra_metadata['institute_id'].astext == institute_id)
                .order_by(AiGenVideo.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
            result = session.execute(stmt)
            return result.scalars().all()
        finally:
            if not self.session:
                session.close()

