"""
Router for content ingestion (embedding) for RAG.
"""
from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import db_dependency
from ..services.api_key_resolver import ApiKeyResolver
from ..services.embedding_service import EmbeddingService
from ..services.rag_service import RAGService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/content", tags=["content-ingestion"])


class IngestRequest(BaseModel):
    content_text: str
    source_type: str  # slide, chapter, question
    source_id: str
    institute_id: str
    metadata: Optional[dict] = None


class IngestBatchRequest(BaseModel):
    items: List[IngestRequest]


class IngestResponse(BaseModel):
    chunks_created: int
    source_id: str
    source_type: str


@router.post("/embed", response_model=IngestResponse)
async def embed_content(
    request: IngestRequest,
    db: Session = Depends(db_dependency),
):
    """Embed a single piece of content for RAG search."""
    api_key_resolver = ApiKeyResolver(db)
    embedding_service = EmbeddingService(api_key_resolver)
    rag_service = RAGService(db, embedding_service)

    try:
        count = await rag_service.ingest_content(
            content_text=request.content_text,
            source_type=request.source_type,
            source_id=request.source_id,
            institute_id=request.institute_id,
            metadata=request.metadata,
        )
        return IngestResponse(
            chunks_created=count,
            source_id=request.source_id,
            source_type=request.source_type,
        )
    except Exception as e:
        logger.error(f"Ingestion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await embedding_service.close()


@router.post("/embed-batch")
async def embed_batch(
    request: IngestBatchRequest,
    db: Session = Depends(db_dependency),
):
    """Embed multiple content items for RAG search."""
    api_key_resolver = ApiKeyResolver(db)
    embedding_service = EmbeddingService(api_key_resolver)
    rag_service = RAGService(db, embedding_service)

    results = []
    try:
        for item in request.items:
            count = await rag_service.ingest_content(
                content_text=item.content_text,
                source_type=item.source_type,
                source_id=item.source_id,
                institute_id=item.institute_id,
                metadata=item.metadata,
            )
            results.append({
                "source_id": item.source_id,
                "source_type": item.source_type,
                "chunks_created": count,
            })
        return {"results": results, "total_items": len(results)}
    except Exception as e:
        logger.error(f"Batch ingestion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await embedding_service.close()
