"""Repository for vision_review_cases — the per-shot defect bank.

Append-only. The vision-review path persists one row per flagged shot for
later prompt-tuning analysis. Read-side helpers exist only for the analysis
queries an engineer runs by hand (or via a future admin viewer).
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from ..db import get_engine
from ..models.vision_review_case import VisionReviewCase

logger = logging.getLogger(__name__)


class VisionReviewRepository:
    """Persistence for vision_review_cases. Mirrors AiVideoRepository's session pattern."""

    def __init__(self, session: Optional[Session] = None):
        self.session = session
        self._engine = get_engine()

    def _get_session(self) -> Session:
        if self.session:
            return self.session
        return Session(self._engine)

    def insert_case(
        self,
        *,
        video_id: str,
        shot_idx: int,
        shot_type: Optional[str],
        quality_tier: str,
        prompt_version: Optional[str],
        issue_codes: List[str],
        severity_max: int,
        shipped: str,
        reviewer_pre_json: Dict[str, Any],
        reviewer_post_json: Optional[Dict[str, Any]] = None,
        original_html_url: Optional[str] = None,
        regen_html_url: Optional[str] = None,
        screenshots_pre_urls: Optional[List[str]] = None,
        screenshots_post_urls: Optional[List[str]] = None,
        review_ms: Optional[int] = None,
        review_cost_usd: Optional[float] = None,
        regen_ms: Optional[int] = None,
        regen_cost_usd: Optional[float] = None,
        shot_meta: Optional[Dict[str, Any]] = None,
        shot_pack: Optional[Dict[str, Any]] = None,
        host_present: bool = False,
    ) -> Optional[VisionReviewCase]:
        """Insert a single defect case. Returns None on DB failure — vision
        review is non-blocking, so persistence failures must not fail the run.
        """
        session = self._get_session()
        try:
            row = VisionReviewCase(
                video_id=video_id,
                shot_idx=int(shot_idx),
                shot_type=shot_type,
                quality_tier=quality_tier,
                prompt_version=prompt_version,
                issue_codes=list(issue_codes or []),
                severity_max=int(severity_max),
                shipped=shipped,
                reviewer_pre_json=reviewer_pre_json or {},
                reviewer_post_json=reviewer_post_json,
                original_html_url=original_html_url,
                regen_html_url=regen_html_url,
                screenshots_pre_urls=list(screenshots_pre_urls) if screenshots_pre_urls else None,
                screenshots_post_urls=list(screenshots_post_urls) if screenshots_post_urls else None,
                review_ms=review_ms,
                review_cost_usd=review_cost_usd,
                regen_ms=regen_ms,
                regen_cost_usd=regen_cost_usd,
                shot_meta=shot_meta,
                shot_pack=shot_pack,
                host_present=bool(host_present),
            )
            session.add(row)
            session.commit()
            session.refresh(row)
            return row
        except Exception as exc:
            try:
                session.rollback()
            except Exception:
                pass
            logger.warning(f"VisionReviewRepository.insert_case failed: {exc}")
            return None
        finally:
            if not self.session:
                session.close()

    def list_for_video(self, video_id: str, limit: int = 100) -> List[VisionReviewCase]:
        """Return all defect cases for one video, newest first. Used by the run-detail UI."""
        session = self._get_session()
        try:
            stmt = (
                select(VisionReviewCase)
                .where(VisionReviewCase.video_id == video_id)
                .order_by(desc(VisionReviewCase.created_at))
                .limit(limit)
            )
            return list(session.execute(stmt).scalars().all())
        finally:
            if not self.session:
                session.close()

    def issue_code_histogram(
        self,
        *,
        days: int = 7,
        min_severity: int = 2,
        shot_type: Optional[str] = None,
        quality_tier: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """Aggregate top issue codes over the recent window. Mirrors the
        first weekly analysis query in the plan, served as a callable so a
        future admin viewer can render it without raw SQL.
        """
        session = self._get_session()
        try:
            unnested = func.unnest(VisionReviewCase.issue_codes).label("code")
            stmt = (
                select(unnested, func.count().label("hits"))
                .where(VisionReviewCase.created_at >= func.now() - func.make_interval(0, 0, 0, days))
                .where(VisionReviewCase.severity_max >= min_severity)
            )
            if shot_type:
                stmt = stmt.where(VisionReviewCase.shot_type == shot_type)
            if quality_tier:
                stmt = stmt.where(VisionReviewCase.quality_tier == quality_tier)
            stmt = stmt.group_by(unnested).order_by(desc("hits")).limit(limit)
            return [{"code": row.code, "hits": int(row.hits)} for row in session.execute(stmt)]
        finally:
            if not self.session:
                session.close()
