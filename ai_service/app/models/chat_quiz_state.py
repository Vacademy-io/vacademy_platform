"""SQLAlchemy model + repo for durable practice-quiz answer keys.

The learner chatbot generates a 10-question practice quiz, shows the student a
copy with the correct answers stripped, and needs the full answer key back when
they submit. That key used to live only in
`AiChatAgentService._active_quizzes` — an in-process dict — so any restart or
deploy between "here's your quiz" and "submit" lost it and the student was told
"I couldn't find that quiz." In production that hit 59 of 315 submissions
(18.7%), 52 of them after answering all ten questions.

Why a table and not the quiz chat_message row: `_msg_event` and
`GET /session/{id}/updates` both serialise `chat_messages.metadata` verbatim to
the learner's browser, so anything stored there is visible to the student —
including the answers they are being tested on. This table is never serialised
to a client.

Follows the file_conversion / ai_task idiom: the model, an idempotent `_ENSURE`
DDL block applied at startup from `app_factory._lifespan`, and a repository.
One statement per `_ENSURE` entry — psycopg3's extended protocol rejects
multiple commands in a single execute().
"""
from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any, Dict, Optional
from uuid import uuid4

from sqlalchemy import Column, DateTime, String, Text, text
from sqlalchemy.orm import Session

from .ai_gen_video import Base


class ChatQuizState(Base):
    __tablename__ = "chat_quiz_state"

    id = Column(String(255), primary_key=True, default=lambda: str(uuid4()))
    session_id = Column(String(255), nullable=False, index=True)
    quiz_id = Column(String(255), nullable=False, index=True)
    # Full QuizData (correct_answer included) as JSON. Never sent to a client.
    quiz_json = Column(Text, nullable=False)
    created_at = Column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow
    )


_ENSURE = [
    """
    CREATE TABLE IF NOT EXISTS chat_quiz_state (
        id          VARCHAR(255) PRIMARY KEY,
        session_id  VARCHAR(255) NOT NULL,
        quiz_id     VARCHAR(255) NOT NULL,
        quiz_json   TEXT NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_chat_quiz_state_session ON chat_quiz_state(session_id)",
    "CREATE INDEX IF NOT EXISTS idx_chat_quiz_state_quiz ON chat_quiz_state(quiz_id)",
]

logger = logging.getLogger(__name__)


def ensure_chat_quiz_state_schema(db: Session) -> None:
    try:
        for stmt in _ENSURE:
            db.execute(text(stmt))
        db.commit()
        logger.info("chat_quiz_state schema ensured.")
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        logger.warning("ensure_chat_quiz_state_schema failed: %s", exc)


class ChatQuizStateRepository:
    def __init__(self, db: Session):
        self.db = db

    def save(self, session_id: str, quiz_id: str, quiz_payload: Dict[str, Any]) -> None:
        """Persist the answer key. Best-effort: a failure here must not stop the
        student receiving their quiz, it only degrades to the old behaviour."""
        try:
            self.db.execute(
                text(
                    "INSERT INTO chat_quiz_state (id, session_id, quiz_id, quiz_json) "
                    "VALUES (:id, :session_id, :quiz_id, :quiz_json)"
                ),
                {
                    "id": str(uuid4()),
                    "session_id": session_id,
                    "quiz_id": quiz_id,
                    "quiz_json": json.dumps(quiz_payload),
                },
            )
            self.db.commit()
        except Exception as exc:  # noqa: BLE001
            self.db.rollback()
            logger.warning("chat_quiz_state save failed for %s: %s", quiz_id, exc)

    def load(self, session_id: str, quiz_id: str) -> Optional[Dict[str, Any]]:
        """Return the stored QuizData dict, or None if it was never stored."""
        try:
            row = self.db.execute(
                text(
                    "SELECT quiz_json FROM chat_quiz_state "
                    "WHERE session_id = :session_id AND quiz_id = :quiz_id "
                    "ORDER BY created_at DESC LIMIT 1"
                ),
                {"session_id": session_id, "quiz_id": quiz_id},
            ).fetchone()
            if not row or not row[0]:
                return None
            return json.loads(row[0])
        except Exception as exc:  # noqa: BLE001
            self.db.rollback()
            logger.warning("chat_quiz_state load failed for %s: %s", quiz_id, exc)
            return None

    def delete(self, session_id: str, quiz_id: str) -> None:
        try:
            self.db.execute(
                text(
                    "DELETE FROM chat_quiz_state "
                    "WHERE session_id = :session_id AND quiz_id = :quiz_id"
                ),
                {"session_id": session_id, "quiz_id": quiz_id},
            )
            self.db.commit()
        except Exception as exc:  # noqa: BLE001
            self.db.rollback()
            logger.warning("chat_quiz_state delete failed for %s: %s", quiz_id, exc)
