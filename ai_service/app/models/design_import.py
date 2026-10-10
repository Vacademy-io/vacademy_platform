"""
Storage for design_import uploads: the raw Figma results an AI app sends over
MCP (get_metadata XML, get_design_context code), kept 24 h so a big design can
arrive in several calls and save_draft can re-plan it.

Its own table on purpose — NOT ai_task: ai_task rows are served by the
unauthenticated /task-status/* routes and several by-id pollers, and a client's
artwork must never be readable through them. Only
``assistant_tools_design_import`` reads or writes this table, always filtered
by the caller's pinned institute.

One row per uploaded PART (not per import): parallel chunk calls each INSERT
their own row, so no part is lost to a read-modify-write race. Every part of an
import carries the import's ``expires_at`` (copied from its first part), so a
bulk ``DELETE ... WHERE expires_at <= now()`` drops whole imports, never half
of one.

The admin_core Flyway migration V561__mcp_design_import_part.sql is the source
of truth for the schema; keep this model identical to it. ai_service also
creates the table at startup (idempotent) and again lazily on first use, so it
runs standalone in local development.
"""
from __future__ import annotations

import logging

from sqlalchemy import Column, DateTime, Index, Integer, String, Text
from sqlalchemy.orm import Session, declarative_base

logger = logging.getLogger(__name__)

Base = declarative_base()


class DesignImportPart(Base):
    __tablename__ = "mcp_design_import_part"

    id = Column(String(32), primary_key=True)
    import_id = Column(String(32), nullable=False)
    institute_id = Column(String(255), nullable=False)
    created_by = Column(String(255), nullable=True)
    #: JSON: {metadata_xml: [], design_code: [], variables: {}, frame_ids: [], design_url?}
    payload = Column(Text, nullable=False)
    bytes = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        Index("idx_mcp_design_import_part_import", "institute_id", "import_id"),
        Index("idx_mcp_design_import_part_expires", "expires_at"),
    )


def ensure_design_import_schema(db: Session) -> bool:
    """Create the table + indexes if missing. Idempotent; logs instead of raising."""
    try:
        DesignImportPart.__table__.create(bind=db.get_bind(), checkfirst=True)
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("ensure_design_import_schema failed: %s", exc)
        return False


__all__ = ["DesignImportPart", "ensure_design_import_schema"]
