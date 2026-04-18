"""
Router for Video Input indexing — upload, list, status, delete.

Users upload a video (podcast or software demo), the system indexes it
(transcript, visual metadata, speaker foreground extraction), and the
output feeds into the existing prompt-driven video generation pipeline.
"""
from __future__ import annotations

import asyncio
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..db import db_dependency
from ..dependencies import get_institute_from_api_key
from ..config import get_settings
from ..repositories.ai_input_video_repository import AiInputVideoRepository
from ..services.index_service import IndexService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/input-video", tags=["input-video"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class CreateInputVideoRequest(BaseModel):
    name: str = Field(..., description="User-given name for this video")
    mode: str = Field(..., description="'podcast' or 'demo'")
    source_url: str = Field(..., description="S3 URL of the uploaded video file")


class InputVideoResponse(BaseModel):
    id: str
    institute_id: str
    name: str
    mode: str
    status: str
    source_url: str
    duration_seconds: Optional[float] = None
    resolution: Optional[str] = None
    context_json_url: Optional[str] = None
    spatial_db_url: Optional[str] = None
    assets_urls: Optional[dict] = None
    render_job_id: Optional[str] = None
    progress: int = 0
    error_message: Optional[str] = None
    metadata: Optional[dict] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class InputVideoStatusResponse(BaseModel):
    id: str
    status: str
    progress: int = 0
    error_message: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_index_service() -> IndexService:
    settings = get_settings()
    return IndexService(
        render_server_url=settings.render_server_url,
        render_key=settings.render_server_key,
    )


async def _poll_index_status(
    input_video_id: str,
    job_id: str,
    index_service: IndexService,
) -> None:
    """Background task: poll render worker for job status, update DB.

    Runs for up to 1 hour. On completion or failure, writes final state to DB.
    """
    deadline_s = 3600
    interval_s = 10
    elapsed = 0

    while elapsed < deadline_s:
        await asyncio.sleep(interval_s)
        elapsed += interval_s

        try:
            resp = index_service.check_status(job_id)
        except Exception as e:
            logger.warning(f"Poll error for {input_video_id}: {e}")
            continue

        rs = resp.get("status", "")
        repo = AiInputVideoRepository()  # fresh session per poll

        if rs == "completed":
            output_urls = resp.get("output_urls") or {}
            repo.update_on_completion(
                input_video_id,
                context_json_url=output_urls.get("context_json"),
                spatial_db_url=output_urls.get("spatial_db"),
                assets_urls=output_urls.get("assets"),
                duration_seconds=resp.get("duration_seconds"),
                resolution=resp.get("resolution"),
            )
            logger.info(f"Input video {input_video_id} indexing completed")
            return

        if rs == "failed":
            repo.update_status(
                input_video_id, "FAILED",
                error_message=resp.get("error", "Unknown error"),
            )
            logger.error(f"Input video {input_video_id} indexing failed: {resp.get('error')}")
            return

        # Still running — update progress
        progress = int(resp.get("progress", 0) or 0)
        repo.update_status(input_video_id, "PROCESSING", progress=progress)

    # Timed out
    repo = AiInputVideoRepository()
    repo.update_status(input_video_id, "FAILED", error_message="Indexing timed out (1h)")
    logger.error(f"Input video {input_video_id} indexing timed out")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/create", response_model=InputVideoResponse)
async def create_input_video(
    request: CreateInputVideoRequest,
    institute_id: str = Depends(get_institute_from_api_key),
    db: Session = Depends(db_dependency),
):
    """Upload metadata and start indexing a video."""
    if request.mode not in ("podcast", "demo"):
        raise HTTPException(status_code=400, detail="mode must be 'podcast' or 'demo'")

    repo = AiInputVideoRepository(session=db)
    record = repo.create(
        institute_id=institute_id,
        name=request.name,
        mode=request.mode,
        source_url=request.source_url,
    )

    # Submit to render worker
    index_svc = _get_index_service()
    try:
        job_id = index_svc.submit(
            input_video_id=str(record.id),
            source_url=request.source_url,
            mode=request.mode,
        )
        repo.update_status(str(record.id), "QUEUED", render_job_id=job_id)
    except RuntimeError as e:
        repo.update_status(str(record.id), "FAILED", error_message=str(e))
        logger.error(f"Failed to submit index job: {e}")
        # Return the record even on failure — FE shows the error
        db.refresh(record)
        return InputVideoResponse(**record.to_dict())

    # Start background poller
    asyncio.create_task(_poll_index_status(str(record.id), job_id, index_svc))

    db.refresh(record)
    return InputVideoResponse(**record.to_dict())


@router.get("/list", response_model=List[InputVideoResponse])
async def list_input_videos(
    institute_id: str = Depends(get_institute_from_api_key),
    db: Session = Depends(db_dependency),
):
    """List all input videos for an institute, newest first."""
    repo = AiInputVideoRepository(session=db)
    records = repo.list_by_institute(institute_id)
    return [InputVideoResponse(**r.to_dict()) for r in records]


@router.get("/{record_id}", response_model=InputVideoResponse)
async def get_input_video(
    record_id: str,
    institute_id: str = Depends(get_institute_from_api_key),
    db: Session = Depends(db_dependency),
):
    """Get full details for a single input video."""
    repo = AiInputVideoRepository(session=db)
    record = repo.get_by_id(record_id)
    if not record or record.institute_id != institute_id:
        raise HTTPException(status_code=404, detail="Input video not found")
    return InputVideoResponse(**record.to_dict())


@router.get("/{record_id}/status", response_model=InputVideoStatusResponse)
async def get_input_video_status(
    record_id: str,
    institute_id: str = Depends(get_institute_from_api_key),
    db: Session = Depends(db_dependency),
):
    """Lightweight status check for FE polling."""
    repo = AiInputVideoRepository(session=db)
    record = repo.get_by_id(record_id)
    if not record or record.institute_id != institute_id:
        raise HTTPException(status_code=404, detail="Input video not found")
    return InputVideoStatusResponse(
        id=str(record.id),
        status=record.status,
        progress=record.progress or 0,
        error_message=record.error_message,
    )


@router.delete("/{record_id}")
async def delete_input_video(
    record_id: str,
    institute_id: str = Depends(get_institute_from_api_key),
    db: Session = Depends(db_dependency),
):
    """Delete an input video record."""
    repo = AiInputVideoRepository(session=db)
    record = repo.get_by_id(record_id)
    if not record or record.institute_id != institute_id:
        raise HTTPException(status_code=404, detail="Input video not found")
    repo.delete_by_id(record_id)
    return {"deleted": True}
