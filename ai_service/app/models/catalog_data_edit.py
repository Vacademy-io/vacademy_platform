"""
Records ``catalog_data_edit`` keeps of what IT created — today the folder
libraries made by ``create_folder_library``.

The tool may change existing nodes only in a library it created itself, or in
one no live site uses. A library's ``created_by`` is the admin's own user id
(the MCP replays the admin's token), so admin-core cannot tell the two apart:
this table can. One row per created record, filtered by the caller's pinned
institute on every read. Rows are never updated or deleted by the tool.

Created at startup (idempotent) and again lazily on first use, like the other
ai_service-owned tables (mcp_design_import_part, tutor_demo_grant, ...).
"""
from __future__ import annotations

import logging

from sqlalchemy import Column, DateTime, Index, String
from sqlalchemy.orm import Session, declarative_base

logger = logging.getLogger(__name__)

Base = declarative_base()


class CatalogDataRecord(Base):
    __tablename__ = "mcp_catalog_data_record"

    id = Column(String(32), primary_key=True)
    institute_id = Column(String(255), nullable=False)
    #: What was created: "folder_library".
    kind = Column(String(40), nullable=False)
    record_id = Column(String(255), nullable=False)
    created_by = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        Index("idx_mcp_catalog_data_record_lookup", "institute_id", "kind", "record_id"),
    )


def ensure_catalog_data_schema(db: Session) -> bool:
    """Create the table + index if missing. Idempotent; logs instead of raising."""
    try:
        CatalogDataRecord.__table__.create(bind=db.get_bind(), checkfirst=True)
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("ensure_catalog_data_schema failed: %s", exc)
        return False


__all__ = ["CatalogDataRecord", "ensure_catalog_data_schema"]
