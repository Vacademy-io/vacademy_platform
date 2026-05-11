"""
Repository for ai_reels + ai_reel_candidates database operations.

Mirrors the connection-handling pattern from ai_input_asset_repository.py:
a fresh session is used for background-task writes; passed sessions are
reused for request-scope reads.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional, Dict, Any, List, Sequence

from sqlalchemy import select, update, delete
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, OperationalError, PendingRollbackError

from ..models.ai_reel import AiReel
from ..models.ai_reel_candidate import AiReelCandidate
from ..db import get_engine

logger = logging.getLogger(__name__)


def _is_connection_error(exc: Exception) -> bool:
    if isinstance(exc, (OperationalError, PendingRollbackError)):
        return True
    msg = str(exc).lower()
    return any(s in msg for s in (
        "server closed the connection", "connection was reset",
        "ssl connection has been closed", "could not connect", "broken pipe",
    ))


# ===========================================================================
# Candidates (Gate 1 scan output + Gate 2 enrichment)
# ===========================================================================

class AiReelCandidateRepository:
    """Repository for ai_reel_candidates rows."""

    def __init__(self, session: Optional[Session] = None):
        self.session = session
        self._engine = get_engine()

    def _get_session(self) -> Session:
        return self.session or Session(self._engine)

    def _get_fresh_session(self) -> Session:
        return Session(self._engine)

    # ── CREATE (bulk insert from /scan) ───────────────────────────────────

    def bulk_create(
        self,
        institute_id: str,
        input_asset_id: str,
        config_hash: str,
        rows: Sequence[Dict[str, Any]],
    ) -> List[AiReelCandidate]:
        """Insert N candidate rows in one transaction.

        Each row dict must contain the per-candidate fields:
          rank, source_t_start, source_t_end, source_duration_s,
          predicted_output_duration_s, score, breakdown, transcript_snippet,
          thumbnail_strip_url (optional).

        Idempotent: if a concurrent /scan inserted rows with the same
        (input_asset_id, config_hash, rank) tuple, the UNIQUE index trips
        IntegrityError and we return the winning rows instead. This is the
        "lost race" recovery path — both racers end up with the same view.
        """
        if not rows:
            return []
        session = self._get_session()
        try:
            records: List[AiReelCandidate] = []
            for r in rows:
                rec = AiReelCandidate(
                    institute_id=institute_id,
                    input_asset_id=input_asset_id,
                    config_hash=config_hash,
                    rank=r["rank"],
                    source_t_start=r["source_t_start"],
                    source_t_end=r["source_t_end"],
                    source_duration_s=r["source_duration_s"],
                    predicted_output_duration_s=r["predicted_output_duration_s"],
                    score=r["score"],
                    breakdown=r.get("breakdown", {}),
                    transcript_snippet=r["transcript_snippet"],
                    thumbnail_strip_url=r.get("thumbnail_strip_url"),
                )
                session.add(rec)
                records.append(rec)
            session.commit()
            for rec in records:
                session.refresh(rec)
            return records
        except IntegrityError as e:
            session.rollback()
            logger.info(
                "bulk_create lost the race to a concurrent /scan; "
                f"returning the winner's rows for ({input_asset_id}, {config_hash}): {e}"
            )
            # Use a FRESH session — the prior one is poisoned by the rollback
            # and the in-flight find_cached call needs clean state.
            winner_session = self._get_fresh_session()
            try:
                stmt = (
                    select(AiReelCandidate)
                    .where(
                        AiReelCandidate.input_asset_id == input_asset_id,
                        AiReelCandidate.config_hash == config_hash,
                    )
                    .order_by(AiReelCandidate.rank.asc())
                )
                return list(winner_session.execute(stmt).scalars().all())
            finally:
                winner_session.close()
        except Exception as e:
            session.rollback()
            logger.error(f"Error bulk-creating reel candidates: {e}")
            raise

    # ── READ ──────────────────────────────────────────────────────────────

    def get_by_id(self, candidate_id: str) -> Optional[AiReelCandidate]:
        session = self._get_session()
        try:
            return session.get(AiReelCandidate, candidate_id)
        except Exception as e:
            if _is_connection_error(e):
                return self._get_fresh_session().get(AiReelCandidate, candidate_id)
            raise

    def get_by_ids(self, candidate_ids: List[str]) -> List[AiReelCandidate]:
        """Fetch multiple candidates, preserving the input id order."""
        if not candidate_ids:
            return []
        session = self._get_session()
        try:
            stmt = select(AiReelCandidate).where(AiReelCandidate.id.in_(candidate_ids))
            rows = {str(r.id): r for r in session.execute(stmt).scalars().all()}
            return [rows[cid] for cid in candidate_ids if cid in rows]
        except Exception as e:
            if _is_connection_error(e):
                session = self._get_fresh_session()
                stmt = select(AiReelCandidate).where(AiReelCandidate.id.in_(candidate_ids))
                rows = {str(r.id): r for r in session.execute(stmt).scalars().all()}
                return [rows[cid] for cid in candidate_ids if cid in rows]
            raise

    def find_cached(
        self,
        input_asset_id: str,
        config_hash: str,
    ) -> List[AiReelCandidate]:
        """Return cached scan rows for an asset+config that haven't expired,
        ordered by rank. Empty list → no cache hit, caller re-scans."""
        session = self._get_session()
        now = datetime.utcnow()
        stmt = (
            select(AiReelCandidate)
            .where(
                AiReelCandidate.input_asset_id == input_asset_id,
                AiReelCandidate.config_hash == config_hash,
                AiReelCandidate.ttl_at > now,
            )
            .order_by(AiReelCandidate.rank.asc())
        )
        try:
            return list(session.execute(stmt).scalars().all())
        except Exception as e:
            if _is_connection_error(e):
                return list(self._get_fresh_session().execute(stmt).scalars().all())
            raise

    # ── UPDATE (Gate 2 enrichment) ────────────────────────────────────────

    def set_enriched(self, candidate_id: str, enriched: Dict[str, Any]) -> None:
        """Attach /preview LLM output to a candidate row."""
        session = self._get_fresh_session()
        try:
            stmt = (
                update(AiReelCandidate)
                .where(AiReelCandidate.id == candidate_id)
                .values(enriched=enriched)
            )
            session.execute(stmt)
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"Error setting enriched on candidate {candidate_id}: {e}")
            raise
        finally:
            session.close()

    def set_thumbnail(self, candidate_id: str, thumbnail_strip_url: str) -> None:
        session = self._get_fresh_session()
        try:
            stmt = (
                update(AiReelCandidate)
                .where(AiReelCandidate.id == candidate_id)
                .values(thumbnail_strip_url=thumbnail_strip_url)
            )
            session.execute(stmt)
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"Error setting thumbnail on candidate {candidate_id}: {e}")
        finally:
            session.close()

    # ── REAPER (later — kept simple here) ─────────────────────────────────

    def delete_expired(self) -> int:
        """Hard-delete TTL'd rows. Returns row count. Called from a periodic
        sweeper job in a later phase."""
        session = self._get_fresh_session()
        try:
            now = datetime.utcnow()
            stmt = delete(AiReelCandidate).where(AiReelCandidate.ttl_at < now)
            result = session.execute(stmt)
            session.commit()
            return result.rowcount or 0
        except Exception as e:
            session.rollback()
            logger.error(f"Error reaping expired candidates: {e}")
            return 0
        finally:
            session.close()


# ===========================================================================
# Reels (post-Gate-3 reel records)
# ===========================================================================

class AiReelRepository:
    """Repository for ai_reels rows."""

    def __init__(self, session: Optional[Session] = None):
        self.session = session
        self._engine = get_engine()

    def _get_session(self) -> Session:
        return self.session or Session(self._engine)

    def _get_fresh_session(self) -> Session:
        return Session(self._engine)

    # ── CREATE ────────────────────────────────────────────────────────────

    def create(
        self,
        reel_id: str,
        institute_id: str,
        input_asset_id: str,
        parent_candidate_id: Optional[str],
        config: Dict[str, Any],
        source_window: Dict[str, Any],
        created_by_user_id: Optional[str] = None,
    ) -> AiReel:
        session = self._get_session()
        try:
            record = AiReel(
                reel_id=reel_id,
                institute_id=institute_id,
                input_asset_id=input_asset_id,
                parent_candidate_id=parent_candidate_id,
                status="PENDING",
                current_stage="PENDING",
                progress=0,
                config=config,
                source_window=source_window,
                created_by_user_id=created_by_user_id,
            )
            session.add(record)
            session.commit()
            session.refresh(record)
            return record
        except Exception as e:
            session.rollback()
            logger.error(f"Error creating reel record: {e}")
            raise

    # ── READ ──────────────────────────────────────────────────────────────

    def get_by_id(self, reel_pk: str) -> Optional[AiReel]:
        session = self._get_session()
        try:
            return session.get(AiReel, reel_pk)
        except Exception as e:
            if _is_connection_error(e):
                return self._get_fresh_session().get(AiReel, reel_pk)
            raise

    def get_by_reel_id(self, reel_id: str) -> Optional[AiReel]:
        session = self._get_session()
        stmt = select(AiReel).where(AiReel.reel_id == reel_id)
        try:
            return session.execute(stmt).scalar_one_or_none()
        except Exception as e:
            if _is_connection_error(e):
                return self._get_fresh_session().execute(stmt).scalar_one_or_none()
            raise

    def list_by_institute(
        self,
        institute_id: str,
        input_asset_id: Optional[str] = None,
    ) -> List[AiReel]:
        session = self._get_session()
        stmt = (
            select(AiReel)
            .where(AiReel.institute_id == institute_id)
            .order_by(AiReel.created_at.desc())
        )
        if input_asset_id:
            stmt = stmt.where(AiReel.input_asset_id == input_asset_id)
        try:
            return list(session.execute(stmt).scalars().all())
        except Exception as e:
            if _is_connection_error(e):
                return list(self._get_fresh_session().execute(stmt).scalars().all())
            raise

    # ── UPDATE ────────────────────────────────────────────────────────────

    def update_stage(
        self,
        reel_pk: str,
        current_stage: str,
        progress: int,
        stages: Optional[List[Dict[str, Any]]] = None,
        status: Optional[str] = None,
        error_message: Optional[str] = None,
    ) -> None:
        """Update during a render run. Uses a fresh session for safety in
        background tasks."""
        session = self._get_fresh_session()
        try:
            values: Dict[str, Any] = {
                "current_stage": current_stage,
                "progress": max(0, min(100, progress)),
            }
            if stages is not None:
                values["stages"] = stages
            if status is not None:
                values["status"] = status
            if error_message is not None:
                values["error_message"] = error_message
            stmt = update(AiReel).where(AiReel.id == reel_pk).values(**values)
            session.execute(stmt)
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"Error updating reel stage: {e}")
        finally:
            session.close()

    def update_on_completion(
        self,
        reel_pk: str,
        s3_urls: Dict[str, Any],
        trim_map: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        session = self._get_fresh_session()
        try:
            values: Dict[str, Any] = {
                "status": "COMPLETED",
                "current_stage": "COMPLETED",
                "progress": 100,
                "s3_urls": s3_urls,
                "completed_at": datetime.utcnow(),
            }
            if trim_map is not None:
                values["trim_map"] = trim_map
            if metadata is not None:
                values["extra_metadata"] = metadata
            stmt = update(AiReel).where(AiReel.id == reel_pk).values(**values)
            session.execute(stmt)
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"Error completing reel: {e}")
        finally:
            session.close()

    # ── DELETE ────────────────────────────────────────────────────────────

    def delete_by_id(self, reel_pk: str) -> bool:
        session = self._get_session()
        try:
            stmt = delete(AiReel).where(AiReel.id == reel_pk)
            result = session.execute(stmt)
            session.commit()
            return (result.rowcount or 0) > 0
        except Exception as e:
            session.rollback()
            logger.error(f"Error deleting reel: {e}")
            raise
