"""
Frame add/update/delete for a reel's `time_based_frame.json`.

The editor (`/vim/edit/$videoId?kind=reel`) saves user edits by POSTing to
`/external/reels/v1/frame/{add,update,delete}`. Each call rewrites the
reel's timeline JSON in-place on S3 — no DB write (`AiReel.s3_urls.time_based_frame`
already points at the latest version since we overwrite the same key).

Mirrors the contract in `VideoGenerationService.{add,update,delete}_video_frame`
field-for-field. The differences are intentional and small:

  * identifier is `reel_id` (string user-facing id), not `video_id`
  * timeline URL comes from `AiReel.s3_urls['time_based_frame']`, not
    `AiGenVideo.s3_urls['timeline']`
  * S3 key derivation falls back to `ai-reels/{reel_id}/time_based_frame.json`,
    not the `ai-videos/...` shape

Sync work (S3 download + JSON munge + upload) runs inside `asyncio.to_thread`
in the router so the FastAPI loop stays responsive.
"""
from __future__ import annotations

import json
import logging
import re
import tempfile
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
from uuid import uuid4

from ..config import get_settings
from ..models.ai_reel import AiReel
from ..repositories.ai_reel_repository import AiReelRepository
from .s3_service import S3Service

logger = logging.getLogger(__name__)


class ReelTimelineNotFound(ValueError):
    """Raised when the reel hasn't reached ASSEMBLE yet (no time_based_frame URL)."""


class ReelsFrameService:
    """add/update/delete a single entry in a reel's S3 timeline JSON."""

    def __init__(
        self,
        s3: Optional[S3Service] = None,
        repo: Optional[AiReelRepository] = None,
    ):
        self._s3 = s3
        self._repo = repo

    # ── helpers ────────────────────────────────────────────────────────────

    def _ensure_s3(self) -> S3Service:
        if self._s3 is None:
            self._s3 = S3Service()
        return self._s3

    def _ensure_repo(self) -> AiReelRepository:
        if self._repo is None:
            self._repo = AiReelRepository()
        return self._repo

    def _load_reel(self, reel_id: str, institute_id: str) -> AiReel:
        """Fetch reel + verify institute ownership. Raises ValueError on miss."""
        row = self._ensure_repo().get_by_reel_id(reel_id)
        if row is None or row.institute_id != institute_id:
            raise ValueError(f"Reel '{reel_id}' not found")
        return row

    def _timeline_url(self, reel: AiReel) -> str:
        """Pull the time_based_frame URL off the reel's s3_urls.

        Raises `ReelTimelineNotFound` when assemble hasn't run yet — the FE
        shouldn't open a not-yet-assembled reel in the editor, so this is a
        client error, not a 500.
        """
        url = (reel.s3_urls or {}).get("time_based_frame")
        if not isinstance(url, str) or not url:
            raise ReelTimelineNotFound(
                f"Reel '{reel.reel_id}' has no timeline yet — open after render completes"
            )
        return url

    def _s3_key_from_url(self, reel_id: str, timeline_url: str, bucket: str) -> str:
        """Extract the S3 key from a public timeline URL.

        Handles both path-style (`https://s3.amazonaws.com/<bucket>/<key>`) and
        virtual-host style (`https://<bucket>.s3.<region>.amazonaws.com/<key>`).
        Falls back to a canonical default key — but in practice ASSEMBLE
        always writes a uuid-suffixed name, so the URL-derived path is the
        authoritative one.
        """
        if f"/{bucket}/" in timeline_url:
            return timeline_url.split(f"/{bucket}/")[-1]
        if f"{bucket}.s3" in timeline_url:
            m = re.search(r"\.com/(.+)$", timeline_url)
            if m:
                return m.group(1)
        return f"ai-reels/{reel_id}/time_based_frame.json"

    def _download_timeline(
        self, timeline_url: str, file_path: Path
    ) -> Tuple[Any, list, dict, bool]:
        """Download + parse the timeline JSON.

        Returns (data, entries, meta, is_wrapped). `entries` is the same list
        held inside `data` — mutating `entries` mutates `data`.
        """
        s3 = self._ensure_s3()
        if not s3.download_file(timeline_url, file_path):
            raise RuntimeError(f"Failed to download timeline from {timeline_url}")
        data = json.loads(file_path.read_text(encoding="utf-8"))
        is_wrapped = isinstance(data, dict) and "entries" in data
        entries = data["entries"] if is_wrapped else data
        meta = data.get("meta", {}) if is_wrapped else {}
        return data, entries, meta, is_wrapped

    def _save_timeline(self, data: Any, file_path: Path, bucket: str, key: str) -> str:
        """Serialize + upload the modified timeline. Returns public URL."""
        file_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
        try:
            return self._ensure_s3().upload_file(
                file_path, s3_key=key, content_type="application/json"
            )
        except Exception as e:
            logger.error(f"Failed to upload reel timeline {key}: {e}")
            raise RuntimeError(f"Failed to save reel timeline to S3: {e}") from e

    # ── public ops ─────────────────────────────────────────────────────────

    def add_frame(
        self,
        reel_id: str,
        institute_id: str,
        html: str,
        in_time: Optional[float],
        exit_time: Optional[float],
        z: int = 0,
        entry_id: Optional[str] = None,
        html_start_x: Optional[int] = None,
        html_start_y: Optional[int] = None,
        html_end_x: Optional[int] = None,
        html_end_y: Optional[int] = None,
    ) -> Dict[str, Any]:
        if in_time is not None and exit_time is not None and in_time >= exit_time:
            raise ValueError(
                f"in_time ({in_time}) must be less than exit_time ({exit_time})"
            )

        reel = self._load_reel(reel_id, institute_id)
        timeline_url = self._timeline_url(reel)
        settings = get_settings()
        bucket = settings.aws_bucket_name
        key = self._s3_key_from_url(reel_id, timeline_url, bucket)

        with tempfile.TemporaryDirectory(prefix="reels-frame-add-") as tmpdir:
            file_path = Path(tmpdir) / "time_based_frame.json"
            data, entries, meta, is_wrapped = self._download_timeline(
                timeline_url, file_path
            )

            # Reels always assemble into the wrapped {meta,entries} shape, so
            # meta.dimensions is always populated. The fallback to 1080×1920
            # matches our default 9:16 frame and only triggers if someone
            # post-hoc rewrote the timeline without meta.
            dims = (meta or {}).get("dimensions", {})
            default_w = int(dims.get("width", 1080))
            default_h = int(dims.get("height", 1920))

            new_id = entry_id or f"shot-{uuid4().hex[:8]}"
            new_entry: Dict[str, Any] = {
                "id": new_id,
                "html": html,
                "z": z,
                "htmlStartX": html_start_x if html_start_x is not None else 0,
                "htmlStartY": html_start_y if html_start_y is not None else 0,
                "htmlEndX": html_end_x if html_end_x is not None else default_w,
                "htmlEndY": html_end_y if html_end_y is not None else default_h,
            }
            if in_time is not None:
                new_entry["inTime"] = in_time
            if exit_time is not None:
                new_entry["exitTime"] = exit_time

            # Reels are time_driven by construction (assemble forces it). Insert
            # ordered by inTime so the editor's timeline stays monotonic.
            if in_time is not None:
                insert_idx = len(entries)
                for i, e in enumerate(entries):
                    e_in = e.get("inTime", e.get("start", float("inf")))
                    if isinstance(e_in, (int, float)) and e_in > in_time:
                        insert_idx = i
                        break
                entries.insert(insert_idx, new_entry)
                frame_index = insert_idx
            else:
                entries.append(new_entry)
                frame_index = len(entries) - 1

            # Stretch total_duration when an overlay lands past the current end.
            if exit_time is not None and is_wrapped:
                current_total = float(meta.get("total_duration") or 0)
                if exit_time > current_total:
                    meta["total_duration"] = exit_time
                    data["meta"] = meta

            if is_wrapped:
                data["entries"] = entries
            else:
                data = entries

            self._save_timeline(data, file_path, bucket, key)

            return {
                "status": "success",
                "reel_id": reel_id,
                "entry_id": new_id,
                "frame_index": frame_index,
                "message": "Frame added successfully.",
            }

    def update_frame(
        self,
        reel_id: str,
        institute_id: str,
        frame_index: int,
        new_html: str,
        in_time: Optional[float] = None,
        exit_time: Optional[float] = None,
        z: Optional[int] = None,
        entry_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        reel = self._load_reel(reel_id, institute_id)
        timeline_url = self._timeline_url(reel)
        settings = get_settings()
        bucket = settings.aws_bucket_name
        key = self._s3_key_from_url(reel_id, timeline_url, bucket)

        with tempfile.TemporaryDirectory(prefix="reels-frame-update-") as tmpdir:
            file_path = Path(tmpdir) / "time_based_frame.json"
            data, entries, meta, is_wrapped = self._download_timeline(
                timeline_url, file_path
            )

            if frame_index < 0 or frame_index >= len(entries):
                raise IndexError(
                    f"Frame index {frame_index} out of range (0-{len(entries) - 1})"
                )

            entry = entries[frame_index]
            if entry_id is not None and entry.get("id") != entry_id:
                logger.warning(
                    "update_frame: entry_id mismatch at index %d "
                    "(expected %s, got %s) — proceeding by index",
                    frame_index, entry_id, entry.get("id"),
                )

            entry["html"] = new_html
            if in_time is not None:
                entry["inTime"] = in_time
            if exit_time is not None:
                entry["exitTime"] = exit_time
            if z is not None:
                entry["z"] = z

            # Extend total_duration if this update pushed the entry past the end.
            if exit_time is not None and is_wrapped:
                current_total = float(meta.get("total_duration") or 0)
                if exit_time > current_total:
                    meta["total_duration"] = exit_time
                    data["meta"] = meta

            self._save_timeline(data, file_path, bucket, key)

            return {
                "status": "success",
                "reel_id": reel_id,
                "entry_id": entry.get("id"),
                "frame_index": frame_index,
                "message": "Frame updated successfully.",
            }

    def delete_frame(
        self,
        reel_id: str,
        institute_id: str,
        entry_id: Optional[str] = None,
        frame_index: Optional[int] = None,
    ) -> Dict[str, Any]:
        if entry_id is None and frame_index is None:
            raise ValueError("Either entry_id or frame_index must be provided.")

        reel = self._load_reel(reel_id, institute_id)
        timeline_url = self._timeline_url(reel)
        settings = get_settings()
        bucket = settings.aws_bucket_name
        key = self._s3_key_from_url(reel_id, timeline_url, bucket)

        with tempfile.TemporaryDirectory(prefix="reels-frame-delete-") as tmpdir:
            file_path = Path(tmpdir) / "time_based_frame.json"
            data, entries, _meta, is_wrapped = self._download_timeline(
                timeline_url, file_path
            )

            removed_idx = -1
            removed_id: Optional[str] = None

            if entry_id is not None:
                for i, e in enumerate(entries):
                    if e.get("id") == entry_id:
                        removed_idx = i
                        removed_id = entry_id
                        break
                if removed_idx < 0 and frame_index is not None:
                    logger.warning(
                        "delete_frame: entry_id %s not found, falling back to frame_index %d",
                        entry_id, frame_index,
                    )

            if removed_idx < 0 and frame_index is not None:
                if frame_index < 0 or frame_index >= len(entries):
                    raise IndexError(
                        f"Frame index {frame_index} out of range (0-{len(entries) - 1})"
                    )
                removed_idx = frame_index
                removed_id = entries[frame_index].get("id")

            if removed_idx < 0:
                raise ValueError(
                    f"Entry '{entry_id}' not found in reel '{reel_id}' "
                    "and no fallback frame_index provided."
                )

            entries.pop(removed_idx)
            if is_wrapped:
                data["entries"] = entries
            else:
                data = entries

            self._save_timeline(data, file_path, bucket, key)

            return {
                "status": "success",
                "reel_id": reel_id,
                "entry_id": removed_id,
                "frame_index": removed_idx,
                "message": "Frame deleted successfully.",
            }
