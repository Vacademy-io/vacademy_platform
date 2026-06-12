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
from typing import List, Optional, Tuple
from urllib.request import Request as _UrlReq, urlopen

# Env var names, checked in order. AWS_S3_PUBLIC_BUCKET is what deploy.sh
# actually sets on the container today; AWS_BUCKET_NAME is the older name
# the existing /concat_audio endpoint uses. Supporting both lets either
# convention work without forcing a deploy-script change.
DEFAULT_BUCKET_ENVS = ("AWS_S3_PUBLIC_BUCKET", "AWS_BUCKET_NAME")
DEFAULT_BUCKET_FALLBACK = "vacademy-media-storage-public"
DEFAULT_REGION = "ap-south-1"
DEFAULT_USER_AGENT = "VacademyRenderWorker/1.0"
DOWNLOAD_TIMEOUT_S = 120
FFMPEG_TIMEOUT_S = 600

# Minimum seconds of base audio a head/tail slice must span to take part in
# a splice join. Below ~2 MP3 frames (≈52 ms) a stream-copied cut can contain
# zero audio frames — ffmpeg writes a header-only file that later fails to
# demux as an input ("Invalid frame size (576)"). Splicing the LAST sentence
# hits this: tail_start clamps to base_duration, so the tail slice is empty.
MIN_JOIN_SEGMENT_S = 0.06
# Below this a crossfade window is meaningless — hard-concat that join instead.
MIN_CROSSFADE_S = 0.01


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
    crossfade_ms: int = 50,
    head_pad_ms: int = 40,
) -> SpliceResult:
    """Replace `[replace_start, replace_end)` of `base_audio_url` with
    `new_clip_url`, crossfading at both joins, and upload to `output_key`.

    `head_pad_ms` extends the head slice that many milliseconds PAST
    `replace_start`. Word-boundary timestamps from Whisper mark the end of
    the spoken phoneme but ignore acoustic decay, so a "0-gap" sentence
    boundary still has audible word tail just after the timestamp. Without
    a pad, the crossfade sits over that tail (chopping the previous word
    mid-decay); with a small pad, the crossfade sits over the natural
    silence/breath at the START of the replaced sentence instead. The same
    pad shifts the tail's start by the same amount so total replaced
    duration matches the request.

    `crossfade_ms` defaults to 50 — short enough to avoid cross-sentence
    bleed, long enough to mask MP3 frame-boundary artefacts at the cuts.

    Returns the new total duration and the delta vs the original base. The
    delta is what callers ripple downstream timestamps by.
    """
    if replace_end <= replace_start:
        raise AudioOpsError("replace_end must be > replace_start")
    if crossfade_ms < 0:
        raise AudioOpsError("crossfade_ms must be >= 0")
    if head_pad_ms < 0:
        raise AudioOpsError("head_pad_ms must be >= 0")
    _ensure_ffmpeg()
    bucket_name = _resolve_bucket(bucket)
    s3 = _get_s3_client()
    crossfade_s = crossfade_ms / 1000.0
    pad_s = head_pad_ms / 1000.0

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        base = tmp / "base.mp3"
        new_clip = tmp / "new.mp3"
        _download_url(base_audio_url, base)
        _download_url(new_clip_url, new_clip)

        base_duration = probe_duration(base)
        if replace_start < 0 or replace_start >= base_duration:
            raise AudioOpsError(
                f"replace_start {replace_start} outside base audio duration "
                f"{base_duration:.2f}s"
            )
        # Clamp an overshooting `replace_end` to the real end. Timeline offsets
        # are summed from per-shot durations and can drift a few tens of ms past
        # the actual concatenated master length (MP3 frame-boundary rounding on
        # re-encode), so the LAST shot's end legitimately exceeds base_duration
        # by a hair. Treat that as "replace through the end" instead of failing —
        # `replace_start` is already validated to be inside the file.
        if replace_end > base_duration:
            replace_end = base_duration

        # Apply the pad: head ends `pad_s` later, tail starts `pad_s` later.
        # The window's TOTAL length is preserved so `duration_delta` math
        # downstream stays correct. Clamp so the shifted boundary stays
        # inside [replace_start, replace_end] (no point padding past the
        # window we're replacing).
        max_pad = max(0.0, (replace_end - replace_start) / 2.0)
        effective_pad = min(pad_s, max_pad)
        head_end = replace_start + effective_pad
        tail_start = replace_end + effective_pad
        if tail_start > base_duration:
            tail_start = base_duration

        new_dur = probe_duration(new_clip)
        if new_dur <= 0:
            raise AudioOpsError("replacement clip has no decodable audio")

        # Cut head/tail only when there's real audio on that side. Splicing
        # the FIRST sentence leaves (almost) no head; the LAST sentence
        # leaves no tail (tail_start clamps to base_duration). A stream-copied
        # cut of a near-zero span contains no MP3 frames and can't even be
        # opened as an ffmpeg input, so those sides are skipped entirely.
        parts: List[Tuple[Path, float]] = []
        if head_end > MIN_JOIN_SEGMENT_S:
            head = tmp / "head.mp3"
            _run_ffmpeg([
                "ffmpeg", "-y", "-ss", "0", "-to", f"{head_end:.3f}",
                "-i", str(base), "-c", "copy", str(head),
            ], what="splice head")
            head_dur = probe_duration(head)
            if head_dur > 0:
                parts.append((head, head_dur))
        parts.append((new_clip, new_dur))
        if base_duration - tail_start > MIN_JOIN_SEGMENT_S:
            tail = tmp / "tail.mp3"
            _run_ffmpeg([
                "ffmpeg", "-y", "-ss", f"{tail_start:.3f}",
                "-i", str(base), "-c", "copy", str(tail),
            ], what="splice tail")
            tail_dur = probe_duration(tail)
            if tail_dur > 0:
                parts.append((tail, tail_dur))

        output = tmp / "spliced.mp3"
        _join_audio_parts(
            parts,
            crossfade_s if crossfade_ms else 0.0,
            output,
            what="splice crossfade",
        )

        new_total = probe_duration(output)
        _upload_to_s3(s3, bucket_name, output_key, output.read_bytes(), "audio/mpeg")
        return SpliceResult(
            output_url=_s3_https_url(bucket_name, output_key),
            new_duration=new_total,
            duration_delta=new_total - base_duration,
        )


def silence_audio_range(
    base_audio_url: str,
    silence_start: float,
    silence_end: float,
    output_key: str,
    bucket: Optional[str] = None,
    crossfade_ms: int = 50,
    head_pad_ms: int = 40,
) -> SpliceResult:
    """Replace `[silence_start, silence_end)` in `base_audio_url` with
    silence of identical length. The total file length and every
    downstream timestamp stay unchanged — `duration_delta` is ~0.

    Useful for the editor's "mute this sentence" flow: the user wants the
    timing slot preserved (so shots downstream don't shift) but the audio
    in that slot replaced with nothing. They can later re-narrate the same
    slot via /sentence/regenerate, which splices a fresh TTS clip back in.

    Implementation: locally synthesize a stereo MP3 of silence using
    ffmpeg's `anullsrc` filter, then reuse the same head + new + tail
    crossfade pipeline as splice_audio.
    """
    if silence_end <= silence_start:
        raise AudioOpsError("silence_end must be > silence_start")
    if crossfade_ms < 0:
        raise AudioOpsError("crossfade_ms must be >= 0")
    if head_pad_ms < 0:
        raise AudioOpsError("head_pad_ms must be >= 0")
    _ensure_ffmpeg()
    bucket_name = _resolve_bucket(bucket)
    s3 = _get_s3_client()
    crossfade_s = crossfade_ms / 1000.0
    pad_s = head_pad_ms / 1000.0
    silence_duration = silence_end - silence_start

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        base = tmp / "base.mp3"
        _download_url(base_audio_url, base)

        base_duration = probe_duration(base)
        if silence_start < 0 or silence_end > base_duration + 0.05:
            raise AudioOpsError(
                f"silence range [{silence_start}, {silence_end}] outside base "
                f"audio duration {base_duration:.2f}s"
            )

        max_pad = max(0.0, silence_duration / 2.0)
        effective_pad = min(pad_s, max_pad)
        head_end = silence_start + effective_pad
        tail_start = silence_end + effective_pad
        if tail_start > base_duration:
            tail_start = base_duration

        # Locally synthesize silence at standard mp3 sample/channel layout.
        silence_clip = tmp / "silence.mp3"
        _run_ffmpeg([
            "ffmpeg", "-y",
            "-f", "lavfi",
            "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
            "-t", f"{silence_duration:.3f}",
            "-b:a", "192k",
            str(silence_clip),
        ], what="silence synth")

        silence_dur = probe_duration(silence_clip)
        if silence_dur <= 0:
            raise AudioOpsError("failed to synthesize silence clip")

        # Same join policy as splice_audio: skip a head/tail side that has
        # no real audio (silencing the first/last sentence) instead of
        # feeding an empty, undemuxable cut into ffmpeg.
        parts: List[Tuple[Path, float]] = []
        if head_end > MIN_JOIN_SEGMENT_S:
            head = tmp / "head.mp3"
            _run_ffmpeg([
                "ffmpeg", "-y", "-ss", "0", "-to", f"{head_end:.3f}",
                "-i", str(base), "-c", "copy", str(head),
            ], what="silence head")
            head_dur = probe_duration(head)
            if head_dur > 0:
                parts.append((head, head_dur))
        parts.append((silence_clip, silence_dur))
        if base_duration - tail_start > MIN_JOIN_SEGMENT_S:
            tail = tmp / "tail.mp3"
            _run_ffmpeg([
                "ffmpeg", "-y", "-ss", f"{tail_start:.3f}",
                "-i", str(base), "-c", "copy", str(tail),
            ], what="silence tail")
            tail_dur = probe_duration(tail)
            if tail_dur > 0:
                parts.append((tail, tail_dur))

        output = tmp / "silenced.mp3"
        _join_audio_parts(
            parts,
            crossfade_s if crossfade_ms else 0.0,
            output,
            what="silence crossfade",
        )

        new_total = probe_duration(output)
        _upload_to_s3(s3, bucket_name, output_key, output.read_bytes(), "audio/mpeg")
        return SpliceResult(
            output_url=_s3_https_url(bucket_name, output_key),
            new_duration=new_total,
            duration_delta=new_total - base_duration,
        )


def _join_audio_parts(
    parts: List[Tuple[Path, float]],
    crossfade_s: float,
    output: Path,
    what: str,
) -> None:
    """Join 1–3 audio clips into `output`, crossfading each join when both
    sides are long enough, hard-concatenating (concat filter) otherwise.

    Always re-encodes at 192k: the parts come from different encoders (the
    narration master is 48 kHz stereo, fresh TTS clips are 24 kHz mono), so
    a stream-copied concat would produce a corrupt file. Both acrossfade and
    the concat filter negotiate a common sample rate / channel layout.
    """
    if not parts:
        raise AudioOpsError(f"{what}: nothing to join")
    if len(parts) == 1:
        _run_ffmpeg([
            "ffmpeg", "-y", "-i", str(parts[0][0]),
            "-b:a", "192k", str(output),
        ], what=f"{what} (single part)")
        return

    filter_parts: List[str] = []
    prev_label = "0:a"
    prev_dur = parts[0][1]
    for idx in range(1, len(parts)):
        _path, dur = parts[idx]
        out_label = "out" if idx == len(parts) - 1 else f"j{idx}"
        cf = min(crossfade_s, prev_dur, dur)
        if cf >= MIN_CROSSFADE_S:
            filter_parts.append(
                f"[{prev_label}][{idx}:a]acrossfade=d={cf}:c1=tri:c2=tri[{out_label}]"
            )
            prev_dur = prev_dur + dur - cf
        else:
            filter_parts.append(
                f"[{prev_label}][{idx}:a]concat=n=2:v=0:a=1[{out_label}]"
            )
            prev_dur = prev_dur + dur
        prev_label = out_label

    cmd: List[str] = ["ffmpeg", "-y"]
    for path, _dur in parts:
        cmd += ["-i", str(path)]
    cmd += [
        "-filter_complex", ";".join(filter_parts),
        "-map", "[out]", "-b:a", "192k", str(output),
    ]
    _run_ffmpeg(cmd, what=what)


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
    if bucket:
        return bucket
    for env_name in DEFAULT_BUCKET_ENVS:
        value = os.environ.get(env_name)
        if value:
            return value
    return DEFAULT_BUCKET_FALLBACK


def _get_s3_client():
    try:
        import boto3  # type: ignore
    except ImportError as exc:
        raise AudioOpsError("boto3 not installed on render worker") from exc
    return boto3.client(
        "s3",
        aws_access_key_id=os.environ.get("S3_AWS_ACCESS_KEY") or os.environ.get("AWS_ACCESS_KEY_ID") or None,
        aws_secret_access_key=os.environ.get("S3_AWS_ACCESS_SECRET") or os.environ.get("AWS_SECRET_ACCESS_KEY") or None,
        region_name=os.environ.get("S3_AWS_REGION") or os.environ.get("AWS_REGION", DEFAULT_REGION),
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
