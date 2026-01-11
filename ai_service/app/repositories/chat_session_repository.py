"""
Repository for chat_sessions table operations.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional, List
from uuid import uuid4

from sqlalchemy import select, update, and_
from sqlalchemy.orm import Session

from ..models.chat_session import ChatSession

logger = logging.getLogger(__name__)


class ChatSessionRepository:
    """
    Handles database operations for chat sessions.
    """
    
    def __init__(self, db_session: Session):
        self.db = db_session
    
    def create_session(
        self,
        user_id: str,
        institute_id: str,
        context_type: str,
        context_meta: dict,
    ) -> ChatSession:
        """
        Create a new chat session.
        """
        session = ChatSession(
            id=str(uuid4()),
            user_id=user_id,
            institute_id=institute_id,
            context_type=context_type,
            context_meta=context_meta,
            status="ACTIVE",
            last_active=datetime.utcnow(),
        )
        
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        
        logger.info(f"Created chat session {session.id} for user {user_id}")
        return session
    
    def get_session_by_id(self, session_id: str) -> Optional[ChatSession]:
        """
        Retrieve a chat session by ID.
        Always fetches fresh data from DB to ensure latest context is returned.
        """
        stmt = select(ChatSession).where(ChatSession.id == session_id)
        result = self.db.execute(stmt)
        session = result.scalar_one_or_none()
        
        # Refresh to ensure we have the latest data from DB
        if session:
            self.db.refresh(session)
        
        return session
    
    def get_active_sessions_by_user(self, user_id: str) -> List[ChatSession]:
        """
        Get all active sessions for a user.
        """
        stmt = (
            select(ChatSession)
            .where(and_(
                ChatSession.user_id == user_id,
                ChatSession.status == "ACTIVE"
            ))
            .order_by(ChatSession.last_active.desc())
        )
        result = self.db.execute(stmt)
        return list(result.scalars().all())
    
    def update_last_active(self, session_id: str) -> None:
        """
        Update the last_active timestamp for a session.
        """
        stmt = (
            update(ChatSession)
            .where(ChatSession.id == session_id)
            .values(last_active=datetime.utcnow())
        )
        self.db.execute(stmt)
        self.db.commit()
    
    def close_session(self, session_id: str) -> bool:
        """
        Close a chat session by setting status to CLOSED.
        """
        stmt = (
            update(ChatSession)
            .where(ChatSession.id == session_id)
            .values(status="CLOSED")
        )
        result = self.db.execute(stmt)
        self.db.commit()
        
        if result.rowcount > 0:
            logger.info(f"Closed chat session {session_id}")
            return True
        return False
    
    def update_context(
        self,
        session_id: str,
        context_type: str,
        context_meta: dict,
    ) -> bool:
        """
        Update the context for an existing session.
        This allows seamless context switching as users navigate.
        """
        stmt = (
            update(ChatSession)
            .where(ChatSession.id == session_id)
            .values(
                context_type=context_type,
                context_meta=context_meta,
                last_active=datetime.utcnow()
            )
        )
        result = self.db.execute(stmt)
        self.db.commit()
        
        # Expire all cached instances to force fresh DB reads
        self.db.expire_all()
        
        if result.rowcount > 0:
            logger.info(f"Updated context for session {session_id} to {context_type}")
            return True
        return False
    
    def get_session_with_messages(self, session_id: str) -> Optional[ChatSession]:
        """
        Get a session with all its messages eagerly loaded.
        """
        stmt = select(ChatSession).where(ChatSession.id == session_id)
        result = self.db.execute(stmt)
        session = result.scalar_one_or_none()
        
        if session:
            # Explicitly load messages
            _ = session.messages
        
        return session


__all__ = ["ChatSessionRepository"]
