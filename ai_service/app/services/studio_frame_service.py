"""
Frame add/update/delete/reorder for a Studio build's `time_based_frame.json`.

The editor (`/vim/edit/$buildId?kind=studio`) saves user edits by POSTing to
`/external/studio/v1/builds/{id}/frame/{add,update,delete,reorder}`. Each call
rewrites the build's timeline JSON in-place on S3 (same key the build executor
wrote — `ai-studio/{build_id}/time_based_frame.json`), no DB write needed.

Mirrors `reels_frame_service.ReelsFrameService` field-for-field; differences:
  * identifier is `build_id` (UUID), institute scope is asserted via the
    parent project;
  * timeline URL comes from `AiStudioBuild.s3_urls['timeline']`;
  * adds a `reorder_frame` op (move an entry to a new index, by entry_id).

Sync work (S3 download + JSON munge + upload) runs inside `asyncio.to_thread`
in the router so the FastAPI loop stays responsive.
"""
from __future__ import annotations

import json
import logging
import re
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

from ..config import get_settings
from ..models.ai_studio_build import AiStudioBuild
from ..repositories.ai_studio_build_repository import AiStudioBuildRepository
from ..repositories.ai_studio_project_repository import AiStudioProjectRepository
from .s3_service import S3Service

logger = logging.getLogger(__name__)


class StudioTimelineNotFound(ValueError):
    """Raised when the build has no timeline yet (hasn't reached AWAITING_EDIT)."""


class StudioBuildNotFound(ValueError):
    """Raised when the build is missing or not owned by the institute."""


class StudioFrameService:
    """add/update/delete/reorder a single entry in a build's S3 timeline JSON."""

    def __init__(
        self,
        s3: Optional[S3Service] = None,
        build_repo: Optional[AiStudioBuildRepository] = None,
        project_repo: Optional[AiStudioProjectRepository] = None,
    ):
        self._s3 = s3
        self._build_repo = build_repo
        self._project_repo = project_repo

    # ── helpers ────────────────────────────────────────────────────────────

    def _ensure_s3(self) -> S3Service:
        if self._s3 is None:
            self._s3 = S3Service()
        return self._s3

    def _build_repo_(self) -> AiStudioBuildRepository:
        if self._build_repo is None:
            self._build_repo = AiStudioBuildRepository()
        return self._build_repo

    def _project_repo_(self) -> AiStudioProjectRepository:
        if self._project_repo is None:
            self._project_repo = AiStudioProjectRepository()
        return self._project_repo

    def _load_build(self, build_id: str, institute_id: str) -> AiStudioBuild:
        """Fetch build + verify institute ownership via the parent project."""
        build = self._build_repo_().get_by_id(build_id)
        if build is None:
            raise StudioBuildNotFound(f"Build '{build_id}' not found")
        project = self._project_repo_().get_by_id(str(build.project_id))
        if project is None or project.institute_id != institute_id:
            raise StudioBuildNotFound(f"Build '{build_id}' not found")
        return build

    def _timeline_url(self, build: AiStudioBuild) -> str:
        url = (build.s3_urls or {}).get("timeline")
        if not isinstance(url, str) or not url:
            raise StudioTimelineNotFound(
                f"Build '{build.id}' has no timeline yet — open after the build completes"
            )
        return url

    def _s3_key_from_url(self, build_id: str, timeline_url: str, bucket: str) -> str:
        if bucket and f"/{bucket}/" in timeline_url:
            return timeline_url.split(f"/{bucket}/")[-1]
        if bucket and f"{bucket}.s3" in timeline_url:
            m = re.search(r"\.com/(.+)$", timeline_url)
            if m:
                return m.group(1)
        return f"ai-studio/{build_id}/time_based_frame.json"

    def _download_timeline(
        self, timeline_url: str, file_path: Path
    ) -> Tuple[Any, List[dict], dict, bool]:
        s3 = self._ensure_s3()
        if not s3.download_file(timeline_url, file_path):
            raise RuntimeError(f"Failed to download timeline from {timeline_url}")
        data = json.loads(file_path.read_text(encoding="utf-8"))
        is_wrapped = isinstance(data, dict) and "entries" in data
        entries = data["entries"] if is_wrapped else data
        meta = data.get("meta", {}) if is_wrapped else {}
        return data, entries, meta, is_wrapped

    def _save_timeline(self, data: Any, file_path: Path, key: str) -> str:
        file_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
        try:
            return self._ensure_s3().upload_file(
                file_path, s3_key=key, content_type="application/json"
            )
        except Exception as e:
            logger.error(f"Failed to upload studio timeline {key}: {e}")
            raise RuntimeError(f"Failed to save studio timeline to S3: {e}") from e

    def _result(self, build_id: str, entry_id: Optional[str], idx: Optional[int],
                url: str, entries: List[dict], meta: dict, msg: str) -> Dict[str, Any]:
        return {
            "status": "ok",
            "build_id": build_id,
            "entry_id": entry_id,
            "frame_index": idx,
            "timeline_url": url,
            "total_duration": (meta or {}).get("total_duration"),
            "entry_count": len(entries),
            "message": msg,
        }

    # ── public ops ─────────────────────────────────────────────────────────

    def add_frame(
        self, build_id: str, institute_id: str, *, html: str,
        in_time: Optional[float], exit_time: Optional[float], z: int = 0,
        entry_id: Optional[str] = None, insert_after_entry_id: Optional[str] = None,
        html_start_x: Optional[int] = None, html_start_y: Optional[int] = None,
        html_end_x: Optional[int] = None, html_end_y: Optional[int] = None,
        entry_meta: Optional[dict] = None,
    ) -> Dict[str, Any]:
        if in_time is not None and exit_time is not None and in_time >= exit_time:
            raise ValueError(f"in_time ({in_time}) must be < exit_time ({exit_time})")
        build = self._load_build(build_id, institute_id)
        url = self._timeline_url(build)
        bucket = get_settings().aws_bucket_name
        key = self._s3_key_from_url(build_id, url, bucket)

        with tempfile.TemporaryDirectory(prefix="studio-frame-add-") as tmp:
            fp = Path(tmp) / "time_based_frame.json"
            data, entries, meta, wrapped = self._download_timeline(url, fp)
            dims = (meta or {}).get("dimensions", {})
            default_w = int(dims.get("width", 1920))
            default_h = int(dims.get("height", 1080))

            new_id = entry_id or f"shot-{uuid4().hex[:8]}"
            new_entry: Dict[str, Any] = {
                "id": new_id, "html": html, "z": z,
                "htmlStartX": html_start_x if html_start_x is not None else 0,
                "htmlStartY": html_start_y if html_start_y is not None else 0,
                "htmlEndX": html_end_x if html_end_x is not None else default_w,
                "htmlEndY": html_end_y if html_end_y is not None else default_h,
            }
            if in_time is not None:
                new_entry["inTime"] = in_time
            if exit_time is not None:
                new_entry["exitTime"] = exit_time
            if entry_meta:
                new_entry["entry_meta"] = entry_meta

            # Insert after a named entry if given; else ordered by inTime; else append.
            if insert_after_entry_id:
                idx = next((i for i, e in enumerate(entries)
                            if e.get("id") == insert_after_entry_id), len(entries) - 1)
                insert_idx = idx + 1
                entries.insert(insert_idx, new_entry)
            elif in_time is not None:
                insert_idx = len(entries)
                for i, e in enumerate(entries):
                    e_in = e.get("inTime", e.get("start", float("inf")))
                    if isinstance(e_in, (int, float)) and e_in > in_time:
                        insert_idx = i
                        break
                entries.insert(insert_idx, new_entry)
            else:
                entries.append(new_entry)
                insert_idx = len(entries) - 1

            if exit_time is not None and wrapped:
                if exit_time > float(meta.get("total_duration") or 0):
                    meta["total_duration"] = exit_time
                    data["meta"] = meta
            if wrapped:
                data["entries"] = entries
            else:
                data = entries
            saved = self._save_timeline(data, fp, key)
            return self._result(build_id, new_id, insert_idx, saved, entries, meta,
                                 "Frame added.")

    def update_frame(
        self, build_id: str, institute_id: str, *,
        entry_id: Optional[str] = None, frame_index: Optional[int] = None,
        html: Optional[str] = None, in_time: Optional[float] = None,
        exit_time: Optional[float] = None, z: Optional[int] = None,
        entry_meta: Optional[dict] = None,
    ) -> Dict[str, Any]:
        build = self._load_build(build_id, institute_id)
        url = self._timeline_url(build)
        bucket = get_settings().aws_bucket_name
        key = self._s3_key_from_url(build_id, url, bucket)

        with tempfile.TemporaryDirectory(prefix="studio-frame-update-") as tmp:
            fp = Path(tmp) / "time_based_frame.json"
            data, entries, meta, wrapped = self._download_timeline(url, fp)

            idx = self._resolve_index(entries, entry_id, frame_index)
            entry = entries[idx]
            if html is not None:
                entry["html"] = html
            if in_time is not None:
                entry["inTime"] = in_time
            if exit_time is not None:
                entry["exitTime"] = exit_time
            if z is not None:
                entry["z"] = z
            if entry_meta:
                merged = dict(entry.get("entry_meta") or {})
                merged.update(entry_meta)
                entry["entry_meta"] = merged

            if exit_time is not None and wrapped:
                if exit_time > float(meta.get("total_duration") or 0):
                    meta["total_duration"] = exit_time
                    data["meta"] = meta
            saved = self._save_timeline(data, fp, key)
            return self._result(build_id, entry.get("id"), idx, saved, entries, meta,
                                 "Frame updated.")

    def delete_frame(
        self, build_id: str, institute_id: str, *,
        entry_id: Optional[str] = None, frame_index: Optional[int] = None,
    ) -> Dict[str, Any]:
        if entry_id is None and frame_index is None:
            raise ValueError("Either entry_id or frame_index must be provided.")
        build = self._load_build(build_id, institute_id)
        url = self._timeline_url(build)
        bucket = get_settings().aws_bucket_name
        key = self._s3_key_from_url(build_id, url, bucket)

        with tempfile.TemporaryDirectory(prefix="studio-frame-delete-") as tmp:
            fp = Path(tmp) / "time_based_frame.json"
            data, entries, meta, wrapped = self._download_timeline(url, fp)
            idx = self._resolve_index(entries, entry_id, frame_index)
            removed_id = entries[idx].get("id")
            entries.pop(idx)
            if wrapped:
                data["entries"] = entries
            else:
                data = entries
            saved = self._save_timeline(data, fp, key)
            return self._result(build_id, removed_id, idx, saved, entries, meta,
                                 "Frame deleted.")

    def reorder_frame(
        self, build_id: str, institute_id: str, *, entry_id: str, to_index: int,
    ) -> Dict[str, Any]:
        build = self._load_build(build_id, institute_id)
        url = self._timeline_url(build)
        bucket = get_settings().aws_bucket_name
        key = self._s3_key_from_url(build_id, url, bucket)

        with tempfile.TemporaryDirectory(prefix="studio-frame-reorder-") as tmp:
            fp = Path(tmp) / "time_based_frame.json"
            data, entries, meta, wrapped = self._download_timeline(url, fp)
            src = next((i for i, e in enumerate(entries) if e.get("id") == entry_id), -1)
            if src < 0:
                raise ValueError(f"Entry '{entry_id}' not found")
            target = max(0, min(to_index, len(entries) - 1))
            entry = entries.pop(src)
            entries.insert(target, entry)
            if wrapped:
                data["entries"] = entries
            else:
                data = entries
            saved = self._save_timeline(data, fp, key)
            return self._result(build_id, entry_id, target, saved, entries, meta,
                                 "Frame reordered.")

    # ── shared index resolution ──────────────────────────────────────────

    def _resolve_index(
        self, entries: List[dict], entry_id: Optional[str], frame_index: Optional[int]
    ) -> int:
        if entry_id is not None:
            for i, e in enumerate(entries):
                if e.get("id") == entry_id:
                    return i
            if frame_index is None:
                raise ValueError(f"Entry '{entry_id}' not found")
        if frame_index is not None:
            if frame_index < 0 or frame_index >= len(entries):
                raise IndexError(
                    f"Frame index {frame_index} out of range (0-{len(entries) - 1})"
                )
            return frame_index
        raise ValueError("Either entry_id or frame_index must be provided.")
