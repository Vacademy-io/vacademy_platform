"""
Audio operations on the render worker.

Two pure(-ish) functions used by the FastAPI routes in main.py:

  - slice_audio(): cut one MP3 into N independent clips (sentence-level
    backfill / per-sentence storage post-TTS). Stream-copy so the slices
    are bit-identical to the source within MP3 frame boundaries (~26 ms).

  - splice_audio(): replace one time range of an MP3 with a new clip,
    crossfading at both join points so the result has no audible seam.
    Used when the editor re-narrates a single sentence.

Both functions own download → ffmpeg → S3 upload end to end so the route
handlers stay short. ffmpeg / ffprobe / boto3 are imported lazily so the
module stays importable in tests where those aren't installed.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional
from urllib.request import Request as _UrlReq, urlopen

DEFAULT_BUCKET_ENV = "AWS_BUCKET_NAME"
DEFAULT_BUCKET_FALLBACK = "vacademy-media-storage"
DEFAULT_REGION = "ap-south-1"
DEFAULT_USER_AGENT = "VacademyRenderWorker/1.0"
DOWNLOAD_TIMEOUT_S = 120
FFMPEG_TIMEOUT_S = 600


# ---------------------------------------------------------------------------
# Public types
# ---------------------------------------------------------------------------

@dataclass
class SliceCut:
    """One cut request: start/end in seconds, plus a stable id used in the
    output S3 key and returned to the caller."""
    id: str
    start: float
    end: float


@dataclass
class SliceResult:
    """One produced clip."""
    id: str
    audio_url: str
    duration: float


@dataclass
class SpliceResult:
    output_url: str
    new_duration: float
    duration_delta: float


class AudioOpsError(RuntimeError):
    """Raised for any failure inside this module. Routes translate to HTTP."""


# ---------------------------------------------------------------------------
# Public operations
# ---------------------------------------------------------------------------

def slice_audio(
    audio_url: str,
    cuts: List[SliceCut],
    output_prefix: str,
    bucket: Optional[str] = None,
) -> List[SliceResult]:
    """Download `audio_url` once, cut it into N stream-copied MP3s, and upload
    each to `s3://{bucket}/{output_prefix}{cut.id}.mp3`.

    Stream copy (`-c copy`) is lossless and runs at ~real-time; cuts align to
    the nearest MP3 frame (~26 ms), which is well below perceptual threshold
    for sentence boundaries. Re-encoding would be sample-accurate but slower
    and lossy — not worth it for this use case.
    """
    if not cuts:
        raise AudioOpsError("cuts is required")
    _ensure_ffmpeg()
    bucket_name = _resolve_bucket(bucket)
    prefix = output_prefix if output_prefix.endswith("/") else output_prefix + "/"
    s3 = _get_s3_client()

    results: List[SliceResult] = []
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        source = tmp / "source.mp3"
        _download_url(audio_url, source)

        for cut in cuts:
            if cut.end <= cut.start:
                raise AudioOpsError(f"cut {cut.id}: end must be > start")
            out_path = tmp / f"{cut.id}.mp3"
            cmd = [
                "ffmpeg", "-y",
                "-ss", f"{cut.start:.3f}",
                "-to", f"{cut.end:.3f}",
                "-i", str(source),
                "-c", "copy",
                str(out_path),
            ]
            _run_ffmpeg(cmd, what=f"slice {cut.id}")
            duration = probe_duration(out_path)

            key = f"{prefix}{cut.id}.mp3"
            _upload_to_s3(s3, bucket_name, key, out_path.read_bytes(), "audio/mpeg")
            results.append(SliceResult(
                id=cut.id,
                audio_url=_s3_https_url(bucket_name, key),
                duration=duration,
            ))

    return results


def splice_audio(
    base_audio_url: str,
    new_clip_url: str,
    replace_start: float,
    replace_end: float,
    output_key: str,
    bucket: Optional[str] = None,
    crossfade_ms: int = 150,
) -> SpliceResult:
    """Replace `[replace_start, replace_end)` of `base_audio_url` with
    `new_clip_url`, crossfading at both joins, and upload to `output_key`.

    Returns the new total duration and the delta vs the original base. The
    delta is what callers (e.g. the editor) use to ripple downstream
    timestamps when the replacement is longer or shorter than the original.
    """
    if replace_end <= replace_start:
        raise AudioOpsError("replace_end must be > replace_start")
    if crossfade_ms < 0:
        raise AudioOpsError("crossfade_ms must be >= 0")
    _ensure_ffmpeg()
    bucket_name = _resolve_bucket(bucket)
    s3 = _get_s3_client()
    crossfade_s = crossfade_ms / 1000.0

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        base = tmp / "base.mp3"
        new_clip = tmp / "new.mp3"
        _download_url(base_audio_url, base)
        _download_url(new_clip_url, new_clip)

        base_duration = probe_duration(base)
        if replace_start < 0 or replace_end > base_duration + 0.05:
            raise AudioOpsError(
                f"replace range [{replace_start}, {replace_end}] outside base "
                f"audio duration {base_duration:.2f}s"
            )

        head = tmp / "head.mp3"
        tail = tmp / "tail.mp3"
        _run_ffmpeg([
            "ffmpeg", "-y", "-ss", "0", "-to", f"{replace_start:.3f}",
            "-i", str(base), "-c", "copy", str(head),
        ], what="splice head")
        _run_ffmpeg([
            "ffmpeg", "-y", "-ss", f"{replace_end:.3f}",
            "-i", str(base), "-c", "copy", str(tail),
        ], what="splice tail")

        # Concat with crossfade between head→new→tail. Re-encoding is required
        # for crossfade so we can't stream-copy here, but we keep bitrate at
        # 192k to match concat_audio for consistent quality across the file.
        output = tmp / "spliced.mp3"
        head_dur = probe_duration(head)
        new_dur = probe_duration(new_clip)
        # acrossfade overlaps two streams by `d` seconds, so the final length
        # of (head ⨯ new) is head_dur + new_dur − d, and similarly for the
        # tail join. If a clip is shorter than the crossfade window, fall back
        # to a hard concat to avoid ffmpeg errors / silent truncation.
        cf_head_new = min(crossfade_s, head_dur, new_dur) if crossfade_ms else 0
        tail_dur = probe_duration(tail)
        cf_new_tail = min(crossfade_s, new_dur, tail_dur) if crossfade_ms else 0

        if cf_head_new == 0 and cf_new_tail == 0:
            # No crossfade possible (e.g. splicing at the very start/end and
            # one side is zero-length). Use simple concat demuxer.
            concat_list = tmp / "concat.txt"
            concat_list.write_text(
                "\n".join([
                    f"file '{head}'",
                    f"file '{new_clip}'",
                    f"file '{tail}'",
                ]),
                encoding="utf-8",
            )
            _run_ffmpeg([
                "ffmpeg", "-y", "-f", "concat", "-safe", "0",
                "-i", str(concat_list),
                "-c", "copy", str(output),
            ], what="splice concat (no crossfade)")
        else:
            filter_parts = [
                f"[0:a][1:a]acrossfade=d={cf_head_new}:c1=tri:c2=tri[hn]",
                f"[hn][2:a]acrossfade=d={cf_new_tail}:c1=tri:c2=tri[out]",
            ]
            _run_ffmpeg([
                "ffmpeg", "-y",
                "-i", str(head), "-i", str(new_clip), "-i", str(tail),
                "-filter_complex", ";".join(filter_parts),
                "-map", "[out]", "-b:a", "192k", str(output),
            ], what="splice crossfade")

        new_total = probe_duration(output)
        _upload_to_s3(s3, bucket_name, output_key, output.read_bytes(), "audio/mpeg")
        return SpliceResult(
            output_url=_s3_https_url(bucket_name, output_key),
            new_duration=new_total,
            duration_delta=new_total - base_duration,
        )


def probe_duration(path: Path) -> float:
    """MP3 duration in seconds via ffprobe, or 0.0 on failure. Public so
    main.py can keep using it for the existing /concat_audio endpoint."""
    try:
        out = subprocess.check_output(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
            timeout=30,
        )
        return float(out.strip())
    except Exception:
        return 0.0


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _ensure_ffmpeg() -> None:
    if shutil.which("ffmpeg") is None:
        raise AudioOpsError("ffmpeg not installed on render worker")


def _resolve_bucket(bucket: Optional[str]) -> str:
    return bucket or os.environ.get(DEFAULT_BUCKET_ENV, DEFAULT_BUCKET_FALLBACK)


def _get_s3_client():
    try:
        import boto3  # type: ignore
    except ImportError as exc:
        raise AudioOpsError("boto3 not installed on render worker") from exc
    return boto3.client(
        "s3",
        aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID") or None,
        aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY") or None,
        region_name=os.environ.get("AWS_REGION", DEFAULT_REGION),
    )


def _download_url(url: str, dest: Path) -> None:
    try:
        req = _UrlReq(url, headers={"User-Agent": DEFAULT_USER_AGENT})
        with urlopen(req, timeout=DOWNLOAD_TIMEOUT_S) as resp:
            dest.write_bytes(resp.read())
    except Exception as exc:
        raise AudioOpsError(f"Failed to download {url}: {exc}") from exc


def _upload_to_s3(s3, bucket: str, key: str, body: bytes, content_type: str) -> None:
    try:
        s3.put_object(Bucket=bucket, Key=key, Body=body, ContentType=content_type)
    except Exception as exc:
        raise AudioOpsError(f"S3 upload failed for {key}: {exc}") from exc


def _s3_https_url(bucket: str, key: str) -> str:
    return f"https://{bucket}.s3.amazonaws.com/{key}"


def _run_ffmpeg(cmd: List[str], what: str) -> None:
    result = subprocess.run(cmd, capture_output=True, timeout=FFMPEG_TIMEOUT_S)
    if result.returncode != 0:
        stderr = result.stderr.decode("utf-8", errors="replace")[-1000:]
        raise AudioOpsError(f"ffmpeg failed ({what}): {stderr}")
