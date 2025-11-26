from contextlib import contextmanager
from typing import Iterator, Optional

from sqlalchemy import event, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy import create_engine

from .config import get_settings


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


def db_dependency() -> Iterator[Session]:
    """
    FastAPI dependency for per-request DB session.
    """
    with db_session() as session:
        yield session


