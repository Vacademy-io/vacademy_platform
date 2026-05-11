"""
Gate 3d (final stage) — ASSEMBLE.

Packages the director's shot plan into the editor's expected
`{meta, entries}` payload, uploads to S3, and records the URL on
`ctx.s3_urls['time_based_frame']`.

The output JSON is THE editor contract — once this lands, the FE can open
the reel in `/vim/edit/$videoId` with zero additional code. Shape matches
VIDEO_EDITOR_REVIEW.md §1-§2 exactly.
"""
from __future__ import annotations

import asyncio
import json
import logging
import shutil
import tempfile
from pathlib import Path
from typing import Optional
from uuid import uuid4

from ..services.reels_render_orchestrator import (
    RenderContext,
    STAGE_ASSEMBLE,
    register_stage_handler,
)
from ..services.s3_service import S3Service

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class ReelsAssembleService:
    """Builds the final {meta, entries} payload and uploads it."""

    def __init__(self, s3: Optional[S3Service] = None):
        self._s3 = s3

    def _ensure_s3(self) -> S3Service:
        if self._s3 is None:
            self._s3 = S3Service()
        return self._s3

    def run(self, ctx: RenderContext) -> None:
        """Assemble + upload. Writes `ctx.s3_urls['time_based_frame']`.
        Sync method — JSON serialize + boto3 upload."""
        # 1. Inputs (set by DIRECTOR).
        shots = (ctx.extra_metadata or {}).get("shots") or []
        if not shots:
            raise RuntimeError(
                "extra_metadata.shots not set — DIRECTOR must run before ASSEMBLE"
            )
        dims = (ctx.extra_metadata or {}).get("canvas_dimensions") or {}
        total_duration = float(
            (ctx.extra_metadata or {}).get("total_duration_s")
            or (ctx.trim_map or {}).get("total_new_duration_s")
            or 0.0
        )
        if total_duration <= 0:
            raise RuntimeError("total_duration_s missing or non-positive")

        # 2. Build the payload — shape matches VIDEO_EDITOR_REVIEW.md §1+§2.
        payload = {
            "meta": {
                "content_type": "VIDEO",
                "navigation": "time_driven",
                "audio_start_at": 0,
                "total_duration": round(total_duration, 3),
                "dimensions": {
                    "width": int(dims.get("width") or 1080),
                    "height": int(dims.get("height") or 1920),
                },
                # Audio + words live as separate S3 artifacts referenced via
                # the editor's route search params (audioUrl, wordsUrl).
                # We DON'T inline audio_tracks here for time-driven reels —
                # matches the existing AI video gen pattern.
            },
            "entries": shots,
        }

        # 3. Validate the payload against editor contract before uploading.
        _validate_payload(payload)

        # 4. Serialize + upload.
        with tempfile.TemporaryDirectory(prefix="reels-assemble-") as tmpdir:
            out_path = Path(tmpdir) / f"{ctx.reel_id}.json"
            with out_path.open("w", encoding="utf-8") as f:
                json.dump(payload, f, separators=(",", ":"), ensure_ascii=False)

            s3 = self._ensure_s3()
            s3_key = f"ai-reels/{ctx.reel_id}/time_based_frame-{uuid4().hex[:8]}.json"
            url = s3.upload_file(
                out_path, s3_key=s3_key, content_type="application/json"
            )

        # 5. Write back.
        ctx.s3_urls["time_based_frame"] = url
        ctx.extra_metadata["entry_count"] = len(shots)
        logger.info(
            f"[Assemble] {ctx.reel_id} packaged {len(shots)} entries, "
            f"total_duration={total_duration:.2f}s → {url}"
        )


# ---------------------------------------------------------------------------
# Validation — fail loud on contract drift
# ---------------------------------------------------------------------------

def _validate_payload(payload: dict) -> None:
    """Strict editor-contract validation. Fail before upload so we never
    write a payload the FE will reject.

    The editor's TimelineData expects:
      - meta: dict with dimensions {width:int, height:int}
      - meta.total_duration > 0
      - entries: non-empty list, each with id (str), inTime/exitTime (float),
        html (str), z (int)
      - Per-entry html should be a body fragment (no <html>/<head>/<body>)
      - inTime < exitTime, both finite
    """
    if not isinstance(payload, dict):
        raise RuntimeError("payload must be a dict")
    meta = payload.get("meta")
    if not isinstance(meta, dict):
        raise RuntimeError("payload.meta missing or not dict")
    dims = meta.get("dimensions")
    if not isinstance(dims, dict) or "width" not in dims or "height" not in dims:
        raise RuntimeError("meta.dimensions must include width + height")
    if int(dims["width"]) <= 0 or int(dims["height"]) <= 0:
        raise RuntimeError("meta.dimensions width/height must be positive")
    if float(meta.get("total_duration") or 0) <= 0:
        raise RuntimeError("meta.total_duration must be positive")

    entries = payload.get("entries")
    if not isinstance(entries, list) or not entries:
        raise RuntimeError("entries must be a non-empty list")

    for i, e in enumerate(entries):
        if not isinstance(e, dict):
            raise RuntimeError(f"entries[{i}] not a dict")
        for key in ("id", "html"):
            if not e.get(key):
                raise RuntimeError(f"entries[{i}] missing required field {key!r}")
        in_t = float(e.get("inTime") or 0)
        out_t = float(e.get("exitTime") or 0)
        if not (0 <= in_t < out_t):
            raise RuntimeError(
                f"entries[{i}] invalid time range: inTime={in_t}, exitTime={out_t}"
            )
        # Body fragment check — the editor's html-processor wraps the
        # fragment in <html><head>...<body>. If we accidentally produced
        # a full document, the wrapped output would be double-nested.
        html_str = str(e.get("html") or "").lstrip()
        for bad in ("<!doctype", "<html", "<head", "<body"):
            if html_str[:30].lower().startswith(bad):
                raise RuntimeError(
                    f"entries[{i}].html must be a body fragment, not a full document "
                    f"(starts with {bad!r})"
                )


# ---------------------------------------------------------------------------
# Stage registration
# ---------------------------------------------------------------------------

async def _assemble_stage(ctx: RenderContext) -> None:
    """Async handler. Sync work in a thread."""
    svc = ReelsAssembleService()
    await asyncio.to_thread(svc.run, ctx)


register_stage_handler(STAGE_ASSEMBLE, _assemble_stage)
