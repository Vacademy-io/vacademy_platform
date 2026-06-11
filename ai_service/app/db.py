import logging
from contextlib import contextmanager
from typing import Iterator, Optional

from sqlalchemy import event, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy import create_engine

from .config import get_settings

logger = logging.getLogger(__name__)


_engine: Optional[Engine] = None
_SessionLocal: Optional[sessionmaker] = None


def _create_engine() -> Engine:
    settings = get_settings()
    url = settings.build_sqlalchemy_url()
    engine = create_engine(
        url,
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        pool_timeout=settings.db_pool_timeout_seconds,
        pool_recycle=settings.db_pool_recycle_seconds,
        pool_pre_ping=True,  # Test connections before use to detect stale connections
        future=True,
    )

    # Optionally set search_path to a specific schema on session begin
    target_schema = settings.db_schema

    if target_schema:
        @event.listens_for(Session, "after_begin")
        def set_search_path(session: Session, transaction, connection):  # type: ignore[no-redef]
            session.execute(text(f"SET search_path TO {target_schema}"))

    return engine


def get_engine() -> Engine:
    global _engine, _SessionLocal
    if _engine is None:
        _engine = _create_engine()
        _SessionLocal = sessionmaker(bind=_engine, expire_on_commit=False, future=True)
    return _engine


def get_sessionmaker() -> sessionmaker:
    global _SessionLocal
    if _SessionLocal is None:
        get_engine()
    assert _SessionLocal is not None
    return _SessionLocal


@contextmanager
def db_session() -> Iterator[Session]:
    """
    Context-managed DB session for imperative usage.
    """
    session_factory = get_sessionmaker()
    session: Session = session_factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@contextmanager
def background_db_session() -> Iterator[Session]:
    """
    Context-managed DB session for LONG-RUNNING background tasks
    (video generation / resume / retry).

    Identical to `db_session()` except the exit commit is best-effort.
    These tasks run for many minutes; SQLAlchemy auto-begins a
    transaction on the session's first read, so by the time the task
    finishes the connection has usually been killed by PgBouncer /
    Postgres (idle-in-transaction timeout) and `commit()` raises
    `psycopg.errors.ProtocolViolation: server conn crashed?` — AFTER
    the task already succeeded. With `db_session()` that propagates
    into the caller's error path and a successful run gets reported
    as failed (and refunded). All meaningful writes on these paths go
    through short-lived sessions that commit themselves, so nothing
    rides on this final commit — log it loudly and move on.
    """
    session_factory = get_sessionmaker()
    session: Session = session_factory()
    try:
        yield session
    except Exception:
        try:
            session.rollback()
        except Exception:
            logger.warning("background_db_session: rollback failed", exc_info=True)
        raise
    else:
        try:
            session.commit()
        except Exception:
            logger.warning(
                "background_db_session: exit commit failed (stale connection "
                "after a long-running task?) — swallowed so a finished task "
                "is not misreported as failed; any uncommitted writes on "
                "this session are discarded",
                exc_info=True,
            )
            try:
                session.rollback()
            except Exception:
                pass
    finally:
        session.close()


def db_dependency() -> Iterator[Session]:
    """
    FastAPI dependency for per-request DB session.
    """
    with db_session() as session:
        yield session


