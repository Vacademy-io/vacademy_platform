"""
Gate 3b — AUDIO_EDIT stage.

Takes a candidate's source window + cut plan, produces the final post-cut
post-atempo speaker audio MP3, uploads to S3, and records a trim_map.

Implemented as a single ffmpeg invocation using `filter_complex`:
  - `-ss/-t` on input does fast HTTPS-range seek to the window
  - Per kept-span `atrim` filters with `asetpts=PTS-STARTPTS`
  - `concat=n=K:v=0:a=1` stitches kept spans
  - `atempo=X` applies speed_multiplier (skipped when 1.0)
  - Encoded as MP3 22050Hz/96kbps mono (matches existing pipeline convention)

Trim map records (orig_t_start, orig_t_end, new_t_start, new_t_end) per kept
span — used by SOURCE_CLIP and DIRECTOR stages to map between source
timecodes and the trimmed output timeline.
"""
from __future__ import annotations

import asyncio
import logging
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Optional
from uuid import uuid4

from ..repositories.ai_input_asset_repository import AiInputAssetRepository
from ..repositories.ai_reel_repository import AiReelCandidateRepository
from ..services.reels_render_orchestrator import (
    RenderContext,
    STAGE_AUDIO_EDIT,
    register_stage_handler,
)
from ..services.s3_service import S3Service

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Timeout for the ffmpeg invocation. Even for a 90s window with 10+ cuts,
# the work is bounded — 60s is more than safe.
FFMPEG_TIMEOUT_S = 60

# Output encoding — matches `generate_audio_metadata.py` convention.
OUTPUT_SAMPLE_RATE = 22050
OUTPUT_BITRATE = "96k"

# Below this kept-span duration, ffmpeg's atrim can produce zero-frame
# outputs that break the concat filter. The cut planner already validates
# spans ≥80ms; the dual check here protects against rounding edge cases.
MIN_KEPT_SPAN_S = 0.1

# Source URL fallback chain: the indexer's re-encoded MP4 first (browser-
# friendly), then the user's original upload.
def _resolve_source_url(asset) -> Optional[str]:
    # G5: enforce scheme + strip whitespace. Defense in depth — ffmpeg
    # accepts `file:///etc/passwd`-style URLs and would read local files
    # if a malformed entry ever landed in the DB. The indexer only writes
    # https:// URLs but we validate at the consumer too.
    for raw in [(asset.assets_urls or {}).get("source_video"), asset.source_url]:
        if not raw or not isinstance(raw, str):
            continue
        url = raw.strip()
        if not url:
            continue
        # Only http(s) accepted. http:// retained for localhost dev environments.
        lower = url.lower()
        if not (lower.startswith("https://") or lower.startswith("http://")):
            logger.warning(
                f"[AudioEdit] rejecting non-http(s) source URL: {url[:80]!r}"
            )
            continue
        return url
    return None


# ---------------------------------------------------------------------------
# Internal types
# ---------------------------------------------------------------------------

@dataclass
class _KeptSpan:
    """A range to keep, in source-video timecodes."""
    orig_t_start: float
    orig_t_end: float

    @property
    def orig_duration(self) -> float:
        return max(0.0, self.orig_t_end - self.orig_t_start)


@dataclass
class _TrimMapEntry:
    """One kept span with both source and post-trim timestamps."""
    orig_t_start: float
    orig_t_end: float
    new_t_start: float
    new_t_end: float

    def to_dict(self) -> dict:
        return {
            "orig_t_start": round(self.orig_t_start, 3),
            "orig_t_end": round(self.orig_t_end, 3),
            "new_t_start": round(self.new_t_start, 3),
            "new_t_end": round(self.new_t_end, 3),
        }


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class ReelsAudioEditService:
    """Runs the AUDIO_EDIT stage."""

    def __init__(self, s3: Optional[S3Service] = None):
        self._s3 = s3
        self._ffmpeg = shutil.which("ffmpeg") or "ffmpeg"

    def _ensure_s3(self) -> S3Service:
        if self._s3 is None:
            self._s3 = S3Service()
        return self._s3

    def run(self, ctx: RenderContext) -> None:
        """Execute AUDIO_EDIT on the given render context. Writes
        `ctx.s3_urls['speaker_audio']` and `ctx.trim_map` on success.
        Raises on any error — orchestrator catches and writes FAILED.

        This is a SYNC method — ffmpeg subprocess and boto3 upload are both
        blocking. The async stage wrapper offloads to a thread so the
        asyncio loop doesn't stall."""
        # 1. Resolve the source asset to get the source_video URL.
        asset_repo = AiInputAssetRepository()
        asset = asset_repo.get_by_id(ctx.input_asset_id)
        if asset is None:
            raise RuntimeError(f"Source asset {ctx.input_asset_id} not found")
        source_url = _resolve_source_url(asset)
        if not source_url:
            raise RuntimeError(
                f"Source asset {ctx.input_asset_id} has no source_video / source_url"
            )

        # 2. Resolve the candidate to get cut_plan + source window.
        win_t_start = float(ctx.source_window.get("t_start", 0.0))
        win_t_end = float(ctx.source_window.get("t_end", 0.0))
        if win_t_end <= win_t_start:
            raise RuntimeError(
                f"Invalid source window: {win_t_start} → {win_t_end}"
            )

        cut_plan = self._resolve_cut_plan(ctx, win_t_start, win_t_end)

        # 3. Resolve speed multiplier.
        speed = 1.0
        pace = (ctx.config or {}).get("pace") or {}
        try:
            sm = float(pace.get("speed_multiplier") or 1.0)
            # atempo supports 0.5..100 per filter; we clamp to our config range.
            speed = max(1.0, min(1.5, sm))
        except (TypeError, ValueError):
            pass

        # 4. Compute kept spans and trim map.
        kept_spans = self._compute_kept_spans(win_t_start, win_t_end, cut_plan)
        if not kept_spans:
            raise RuntimeError(
                "Cut plan removes the entire window — no audio to produce"
            )
        trim_map = self._build_trim_map(kept_spans, speed)

        # 5. Run ffmpeg to produce the final audio.
        with tempfile.TemporaryDirectory(prefix="reels-audio-") as tmpdir:
            out_path = Path(tmpdir) / f"{ctx.reel_id}.mp3"
            self._run_ffmpeg(
                source_url=source_url,
                win_t_start=win_t_start,
                win_duration=win_t_end - win_t_start,
                kept_spans_relative=[
                    (s.orig_t_start - win_t_start, s.orig_t_end - win_t_start)
                    for s in kept_spans
                ],
                speed=speed,
                out_path=out_path,
            )

            if not out_path.exists() or out_path.stat().st_size == 0:
                raise RuntimeError("ffmpeg produced no audio output")

            # 6. Upload to S3.
            s3 = self._ensure_s3()
            s3_key = f"ai-reels/{ctx.reel_id}/speaker_audio-{uuid4().hex[:8]}.mp3"
            url = s3.upload_file(out_path, s3_key=s3_key, content_type="audio/mpeg")

        # 7. Write back to the context. The orchestrator persists at completion.
        ctx.s3_urls["speaker_audio"] = url
        ctx.trim_map = {
            "spans": [e.to_dict() for e in trim_map],
            "speed_multiplier": speed,
            "window_t_start": round(win_t_start, 3),
            "window_t_end": round(win_t_end, 3),
            "total_new_duration_s": (
                round(trim_map[-1].new_t_end, 3) if trim_map else 0.0
            ),
        }
        logger.info(
            f"[AudioEdit] {ctx.reel_id} kept {len(kept_spans)} spans, "
            f"speed={speed}x, final duration={ctx.trim_map['total_new_duration_s']}s"
        )

    # ── Helpers ───────────────────────────────────────────────────────────

    def _resolve_cut_plan(
        self,
        ctx: RenderContext,
        win_t_start: float,
        win_t_end: float,
    ) -> list[tuple[float, float]]:
        """Pull cut_plan from the SNAPSHOT in ctx.config (preferred) or fall
        back to the candidate row's current `enriched` (legacy reels that
        predate the snapshot). Returns a sorted, non-overlapping list of
        (t_start, t_end) ranges to remove. Empty list = no cuts.

        G4: Reading the snapshot — captured at /render dispatch — protects
        an in-flight render from being silently corrupted by a concurrent
        /preview re-run that changes candidate.enriched.
        """
        # Preferred: snapshot captured at /render dispatch.
        snapshot = (ctx.config or {}).get("enriched_snapshot")
        if isinstance(snapshot, dict):
            raw_cuts = snapshot.get("cut_plan") or []
        else:
            # Legacy fallback: read live candidate row. This path will only
            # fire for reels created before the snapshot field was added.
            if not ctx.candidate_id:
                return []
            candidate = AiReelCandidateRepository().get_by_id(ctx.candidate_id)
            if candidate is None or not candidate.enriched:
                return []
            raw_cuts = (candidate.enriched or {}).get("cut_plan") or []
        cuts: list[tuple[float, float]] = []
        for c in raw_cuts:
            if not isinstance(c, dict):
                continue
            try:
                ts = float(c.get("t_start", 0.0))
                te = float(c.get("t_end", 0.0))
            except (TypeError, ValueError):
                continue
            # Clip to window edges + drop spans that fell entirely outside.
            ts = max(ts, win_t_start)
            te = min(te, win_t_end)
            if te - ts >= 0.05:  # ignore sub-50ms slivers
                cuts.append((ts, te))
        cuts.sort()
        # Merge overlapping (planner should produce non-overlapping but be
        # defensive — overlaps would break the kept-spans computation).
        merged: list[tuple[float, float]] = []
        for ts, te in cuts:
            if merged and ts <= merged[-1][1]:
                merged[-1] = (merged[-1][0], max(merged[-1][1], te))
            else:
                merged.append((ts, te))
        return merged

    @staticmethod
    def _compute_kept_spans(
        win_t_start: float,
        win_t_end: float,
        cuts: list[tuple[float, float]],
    ) -> list[_KeptSpan]:
        """Subtract cuts from [win_t_start, win_t_end]. Returns the kept
        spans in source timecodes, ordered. Drops sub-MIN_KEPT_SPAN_S
        fragments."""
        if not cuts:
            return [_KeptSpan(win_t_start, win_t_end)]
        spans: list[_KeptSpan] = []
        cursor = win_t_start
        for ts, te in cuts:
            if ts > cursor:
                if ts - cursor >= MIN_KEPT_SPAN_S:
                    spans.append(_KeptSpan(cursor, ts))
            cursor = max(cursor, te)
        if win_t_end - cursor >= MIN_KEPT_SPAN_S:
            spans.append(_KeptSpan(cursor, win_t_end))
        return spans

    @staticmethod
    def _build_trim_map(
        kept_spans: list[_KeptSpan],
        speed: float,
    ) -> list[_TrimMapEntry]:
        """For each kept span, compute its position in the post-trim timeline."""
        if not kept_spans:
            return []
        entries: list[_TrimMapEntry] = []
        # Window-relative cursor advances by each span's duration (pre-atempo);
        # we divide by speed for the post-atempo new timestamps.
        rel_cursor = 0.0
        for s in kept_spans:
            new_t_start = rel_cursor / speed
            rel_cursor += s.orig_duration
            new_t_end = rel_cursor / speed
            entries.append(_TrimMapEntry(
                orig_t_start=s.orig_t_start,
                orig_t_end=s.orig_t_end,
                new_t_start=new_t_start,
                new_t_end=new_t_end,
            ))
        return entries

    def _run_ffmpeg(
        self,
        *,
        source_url: str,
        win_t_start: float,
        win_duration: float,
        kept_spans_relative: list[tuple[float, float]],
        speed: float,
        out_path: Path,
    ) -> None:
        """Single ffmpeg invocation that produces the final audio.

        Filter graph shape (N kept spans, optional atempo):

          [0:a]atrim=start=t0:end=t1,asetpts=PTS-STARTPTS[a0]
          [0:a]atrim=start=t2:end=t3,asetpts=PTS-STARTPTS[a1]
          ...
          [a0][a1]...[aN-1]concat=n=N:v=0:a=1[ac]    (skipped if N==1)
          [ac/a0]atempo=K[aout]                       (skipped if speed==1.0)
        """
        filter_lines: list[str] = []
        labels: list[str] = []
        for i, (ts, te) in enumerate(kept_spans_relative):
            label = f"a{i}"
            labels.append(f"[{label}]")
            # atrim end is inclusive of the keyframe; asetpts resets timestamps
            # so concat doesn't see overlapping PTS.
            filter_lines.append(
                f"[0:a]atrim=start={ts:.4f}:end={te:.4f},asetpts=PTS-STARTPTS[{label}]"
            )

        # Concatenate (only needed when more than one span).
        if len(labels) == 1:
            concat_out = labels[0]  # already the only stream
        else:
            concat_out = "[ac]"
            filter_lines.append(
                f"{''.join(labels)}concat=n={len(labels)}:v=0:a=1{concat_out}"
            )

        # Atempo. atempo's per-filter range is 0.5-100; values within 0.5..2.0
        # are recommended single-pass for quality. Our config caps at 1.5.
        if abs(speed - 1.0) < 1e-6:
            final_label = concat_out
        else:
            filter_lines.append(f"{concat_out}atempo={speed:.4f}[aout]")
            final_label = "[aout]"

        filter_complex = ";".join(filter_lines)

        cmd = [
            self._ffmpeg,
            "-hide_banner", "-loglevel", "error", "-y",
            # -ss/-t before -i = fast seek via HTTPS range, then bounded read.
            "-ss", f"{max(0.0, win_t_start):.3f}",
            "-t", f"{max(0.0, win_duration):.3f}",
            "-i", source_url,
            "-filter_complex", filter_complex,
            "-map", final_label,
            "-vn",
            "-acodec", "libmp3lame",
            "-ar", str(OUTPUT_SAMPLE_RATE),
            "-b:a", OUTPUT_BITRATE,
            "-ac", "1",  # mono — saves bandwidth, fine for podcast speech
            str(out_path),
        ]

        try:
            subprocess.run(
                cmd,
                check=True,
                capture_output=True,
                timeout=FFMPEG_TIMEOUT_S,
            )
        except subprocess.TimeoutExpired:
            raise RuntimeError(
                f"AUDIO_EDIT ffmpeg timed out after {FFMPEG_TIMEOUT_S}s"
            )
        except subprocess.CalledProcessError as e:
            stderr = (e.stderr or b"").decode("utf-8", errors="replace")[:500]
            raise RuntimeError(f"AUDIO_EDIT ffmpeg failed: {stderr}")


# ---------------------------------------------------------------------------
# Stage registration
# ---------------------------------------------------------------------------

async def _audio_edit_stage(ctx: RenderContext) -> None:
    """Async handler the orchestrator calls. Offloads the blocking
    ffmpeg + S3-upload work to a worker thread so the asyncio loop stays
    responsive for any concurrent renders running on the same process."""
    svc = ReelsAudioEditService()
    await asyncio.to_thread(svc.run, ctx)


# Replace the orchestrator's no-op handler with the real one at import time.
register_stage_handler(STAGE_AUDIO_EDIT, _audio_edit_stage)
