"""
Knowledge Base CRUD endpoints.
Institutes can add knowledge items that get auto-embedded for RAG search.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..db import db_dependency
from ..dependencies import get_embedding_service
from ..services.embedding_service import EmbeddingService
from ..services.rag_service import RAGService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/knowledge-base/v1", tags=["knowledge-base"])


# ---------- Schemas ----------

class KBItemCreate(BaseModel):
    title: str
    content: str
    category: str = "general"
    tags: List[str] = []


class KBItemUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    is_active: Optional[bool] = None


class KBItemResponse(BaseModel):
    id: str
    title: str
    content: str
    category: str
    tags: List[str]
    is_active: bool
    created_at: str
    updated_at: str


# ---------- Helpers ----------

async def _embed_item(db: Session, item_id: str, title: str, content: str, category: str, institute_id: str, tags: list):
    """Embed a knowledge base item into content_embeddings for RAG search."""
    try:
        from ..services.api_key_resolver import ApiKeyResolver
        api_key_resolver = ApiKeyResolver(db)
        embedding_service = EmbeddingService(api_key_resolver)
        rag_service = RAGService(db, embedding_service)

        # Delete old embeddings for this item
        db.execute(
            text("DELETE FROM content_embeddings WHERE source_type = 'knowledge_base' AND source_id = :source_id"),
            {"source_id": item_id}
        )
        db.commit()

        # Combine title + content for richer embedding
        full_text = f"{title}\n\n{content}"
        metadata = {"title": title, "category": category, "tags": tags}

        chunks_created = await rag_service.ingest_content(
            content_text=full_text,
            source_type="knowledge_base",
            source_id=item_id,
            institute_id=institute_id,
            metadata=metadata,
        )
        logger.info(f"Embedded KB item {item_id} into {chunks_created} chunks")
    except Exception as e:
        logger.error(f"Failed to embed KB item {item_id}: {e}")


def _row_to_response(row) -> dict:
    return {
        "id": row[0],
        "title": row[1],
        "content": row[2],
        "category": row[3],
        "tags": row[4] or [],
        "is_active": row[5],
        "created_at": row[6].isoformat() if row[6] else "",
        "updated_at": row[7].isoformat() if row[7] else "",
    }


# ---------- Endpoints ----------

@router.get("/institute/{institute_id}/items")
async def list_items(institute_id: str, category: Optional[str] = None, db: Session = Depends(db_dependency)):
    """List all knowledge base items for an institute."""
    if category:
        stmt = text("""
            SELECT id, title, content, category, tags, is_active, created_at, updated_at
            FROM knowledge_base_items
            WHERE institute_id = :institute_id AND category = :category
            ORDER BY updated_at DESC
        """)
        rows = db.execute(stmt, {"institute_id": institute_id, "category": category}).fetchall()
    else:
        stmt = text("""
            SELECT id, title, content, category, tags, is_active, created_at, updated_at
            FROM knowledge_base_items
            WHERE institute_id = :institute_id
            ORDER BY updated_at DESC
        """)
        rows = db.execute(stmt, {"institute_id": institute_id}).fetchall()

    return [_row_to_response(r) for r in rows]


@router.post("/institute/{institute_id}/items")
async def create_item(institute_id: str, body: KBItemCreate, db: Session = Depends(db_dependency)):
    """Create a knowledge base item and auto-embed for RAG search."""
    item_id = str(uuid4())
    now = datetime.utcnow()

    stmt = text("""
        INSERT INTO knowledge_base_items (id, institute_id, title, content, category, tags, is_active, created_at, updated_at)
        VALUES (:id, :institute_id, :title, :content, :category, :tags, true, :now, :now)
    """)
    db.execute(stmt, {
        "id": item_id,
        "institute_id": institute_id,
        "title": body.title,
        "content": body.content,
        "category": body.category,
        "tags": body.tags,
        "now": now,
    })
    db.commit()

    # Auto-embed in background (non-blocking)
    await _embed_item(db, item_id, body.title, body.content, body.category, institute_id, body.tags)

    return {
        "id": item_id,
        "title": body.title,
        "content": body.content,
        "category": body.category,
        "tags": body.tags,
        "is_active": True,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }


@router.put("/institute/{institute_id}/items/{item_id}")
async def update_item(institute_id: str, item_id: str, body: KBItemUpdate, db: Session = Depends(db_dependency)):
    """Update a knowledge base item and re-embed if content changed."""
    # Fetch existing
    row = db.execute(
        text("SELECT id, title, content, category, tags, is_active FROM knowledge_base_items WHERE id = :id AND institute_id = :institute_id"),
        {"id": item_id, "institute_id": institute_id}
    ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Item not found")

    old_title, old_content, old_category, old_tags, old_active = row[1], row[2], row[3], row[4], row[5]

    new_title = body.title if body.title is not None else old_title
    new_content = body.content if body.content is not None else old_content
    new_category = body.category if body.category is not None else old_category
    new_tags = body.tags if body.tags is not None else old_tags
    new_active = body.is_active if body.is_active is not None else old_active

    now = datetime.utcnow()
    db.execute(
        text("""
            UPDATE knowledge_base_items
            SET title = :title, content = :content, category = :category, tags = :tags, is_active = :is_active, updated_at = :now
            WHERE id = :id AND institute_id = :institute_id
        """),
        {
            "title": new_title, "content": new_content, "category": new_category,
            "tags": new_tags, "is_active": new_active, "now": now,
            "id": item_id, "institute_id": institute_id,
        }
    )
    db.commit()

    # Re-embed if content or title changed
    content_changed = (new_title != old_title or new_content != old_content)
    if content_changed and new_active:
        await _embed_item(db, item_id, new_title, new_content, new_category, institute_id, new_tags or [])
    elif not new_active:
        # Deactivated — remove embeddings
        db.execute(
            text("DELETE FROM content_embeddings WHERE source_type = 'knowledge_base' AND source_id = :source_id"),
            {"source_id": item_id}
        )
        db.commit()

    return {
        "id": item_id, "title": new_title, "content": new_content,
        "category": new_category, "tags": new_tags or [],
        "is_active": new_active,
        "created_at": "", "updated_at": now.isoformat(),
    }


@router.delete("/institute/{institute_id}/items/{item_id}")
async def delete_item(institute_id: str, item_id: str, db: Session = Depends(db_dependency)):
    """Delete a knowledge base item and its embeddings."""
    row = db.execute(
        text("SELECT id FROM knowledge_base_items WHERE id = :id AND institute_id = :institute_id"),
        {"id": item_id, "institute_id": institute_id}
    ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Item not found")

    # Delete embeddings first
    db.execute(
        text("DELETE FROM content_embeddings WHERE source_type = 'knowledge_base' AND source_id = :source_id"),
        {"source_id": item_id}
    )
    # Delete the item
    db.execute(
        text("DELETE FROM knowledge_base_items WHERE id = :id AND institute_id = :institute_id"),
        {"id": item_id, "institute_id": institute_id}
    )
    db.commit()

    return {"deleted": True}
