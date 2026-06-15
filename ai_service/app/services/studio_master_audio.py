"""
Studio master-audio builder (P7) — assemble the build's REAL soundtrack.

Why this exists: the render worker composites SOURCE_CLIP footage as PIXELS
ONLY (worker.py strips `<video data-source-clip>` before the browser render and
its audio collector skips the tag), so the unmuted `<video>` in the entry HTML
is audible only in the EDITOR. Without this stage every Studio MP4 shipped with
the silent master narration — i.e. no sound at all.

The fix mirrors how reels bake audio pre-render (`reels_audio_edit_service`):
one ffmpeg `filter_complex` builds a master MP3 on the composed-timeline clock —

  * input 0: `anullsrc` of `meta.total_duration` (the duration anchor; also
    covers IMAGE_STILL windows with silence),
  * one input per SOURCE_CLIP entry, seeked with `-ss/-t` BEFORE `-i` so ffmpeg
    range-reads the source over HTTPS instead of downloading whole files,
  * each clip resampled to 44.1k stereo and `adelay`ed to its `inTime`,
  * optional pink-noise whoosh stingers (the reels recipe — synthesized, no
    assets) at cut points,
  * `amix=duration=first:normalize=0` → libmp3lame.

The output is uploaded by the ASSEMBLE_AUDIO executor as
`ai-studio/{build_id}/master_audio.mp3` → `s3_urls.audio`, which the render
service passes as the worker's required `audio_url` (replacing the silent MP3).
Captions stay aligned for free: the words track lives on the same composed
clock (studio_words_track drives off the same entries).

Pure command-building (`build_master_audio_cmd`) is separated from execution
(`build_master_audio`) so the graph is unit-testable without ffmpeg — the same
split the timeline builder uses.
"""
from __future__ import annotations

import logging
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any, List, Optional

logger = logging.getLogger(__name__)

# Defensive cap — a pathological plan with hundreds of sub-clips would build an
# ffmpeg command with as many HTTPS inputs. 80 covers any sane edit; beyond it
# we keep the first 80 by timeline order and log what was dropped.
MAX_CLIP_INPUTS = 80

FFMPEG_TIMEOUT_S = 300

# Whoosh stinger constants — match reels_audio_edit_service so the two
# pipelines sound alike.
WHOOSH_DURATION_S = 0.2
WHOOSH_MIN_SPACING_S = 0.30
WHOOSH_TAIL_GUARD_S = 0.25
# Cues below this never fire: a whoosh at t≈0 (video start) sounds like a glitch.
WHOOSH_MIN_T_S = 1.0
DEFAULT_WHOOSH_VOLUME_DB = -10.0


@dataclass(frozen=True)
class ClipAudioSpec:
    """One SOURCE_CLIP entry's audio slice on the composed clock."""
    url: str
    source_start: float
    source_end: float
    in_time: float

    @property
    def duration(self) -> float:
        return self.source_end - self.source_start


def _is_http_url(url: Any) -> bool:
    """Only http(s) sources may reach the ffmpeg argv — anything else
    (file://, lavfi:, concat:) is an injection vector even in list form."""
    return isinstance(url, str) and url.lower().startswith(("http://", "https://"))


def collect_clip_audio_specs(
    timeline: dict,
    exclude_handles: Optional[frozenset] = None,
) -> List[ClipAudioSpec]:
    """Extract the SOURCE_CLIP audio slices from a built timeline, ordered by
    composed inTime. Malformed entries are skipped (the visual render tolerates
    them the same way); capped at MAX_CLIP_INPUTS. `exclude_handles` mutes
    assets the user marked `video_only` (entry_meta.handle match)."""
    meta = (timeline or {}).get("meta") or {}
    source_urls = meta.get("source_video_urls") or []
    specs: List[ClipAudioSpec] = []
    for entry in (timeline or {}).get("entries") or []:
        if not isinstance(entry, dict) or entry.get("shot_type") != "SOURCE_CLIP":
            continue
        if exclude_handles and (entry.get("entry_meta") or {}).get("handle") in exclude_handles:
            continue
        try:
            idx = int(entry["source_video_index"])
            start = float(entry["source_start"])
            end = float(entry["source_end"])
            in_time = float(entry["inTime"])
        except (KeyError, TypeError, ValueError):
            continue
        if not (0 <= idx < len(source_urls)) or end <= start or in_time < 0:
            continue
        url = source_urls[idx]
        if not _is_http_url(url):
            logger.warning(f"[StudioAudio] skipping non-http source url for clip at {in_time}s")
            continue
        specs.append(ClipAudioSpec(url=url, source_start=start, source_end=end, in_time=in_time))
    specs.sort(key=lambda s: s.in_time)
    if len(specs) > MAX_CLIP_INPUTS:
        logger.warning(
            f"[StudioAudio] {len(specs)} clip slices > cap {MAX_CLIP_INPUTS}; "
            f"keeping the first {MAX_CLIP_INPUTS} by timeline order"
        )
        specs = specs[:MAX_CLIP_INPUTS]
    return specs


def compute_sfx_cue_times(timeline: dict, placement: str = "segment_boundaries") -> List[float]:
    """Whoosh cue times on the composed clock.

    * `segment_boundaries` — the start of each entry whose
      `entry_meta.order_index` differs from the previous entry's (i.e. the
      jump between two arrangement segments, not the splices a silence cut
      makes inside one segment).
    * `all_cuts` — the start of every base entry (the reels behavior).

    Both honor: never before WHOOSH_MIN_T_S, min spacing WHOOSH_MIN_SPACING_S,
    nothing inside the last WHOOSH_TAIL_GUARD_S of the video.
    """
    meta = (timeline or {}).get("meta") or {}
    total = float(meta.get("total_duration") or 0)
    base_entries = [
        e for e in (timeline or {}).get("entries") or []
        if isinstance(e, dict) and e.get("shot_type") in ("SOURCE_CLIP", "IMAGE_STILL")
        and isinstance(e.get("inTime"), (int, float))
    ]
    base_entries.sort(key=lambda e: float(e["inTime"]))

    candidates: List[float] = []
    if placement == "all_cuts":
        candidates = [float(e["inTime"]) for e in base_entries]
    else:
        # Only entries carrying a usable order_index can define a segment
        # boundary — an entry without one (editor-added, malformed) must not
        # reset the tracking and swallow the next real boundary.
        prev_order: Optional[int] = None
        for entry in base_entries:
            order = (entry.get("entry_meta") or {}).get("order_index")
            if not isinstance(order, int):
                continue
            if prev_order is not None and order != prev_order:
                candidates.append(float(entry["inTime"]))
            prev_order = order

    cues: List[float] = []
    for t in candidates:
        if t < WHOOSH_MIN_T_S:
            continue
        if total and t > total - WHOOSH_TAIL_GUARD_S:
            continue
        if cues and t - cues[-1] < WHOOSH_MIN_SPACING_S:
            continue
        cues.append(round(t, 3))
    return cues


def _whoosh_chain(t: float, volume_db: float, label: str) -> str:
    """One synthesized pink-noise whoosh as a filter source (no input file) —
    the exact reels recipe: band-passed pink noise with a fast qsin fade in/out,
    delayed to the cut point."""
    ms = int(round(t * 1000))
    return (
        f"anoisesrc=color=pink:duration={WHOOSH_DURATION_S}:sample_rate=44100:amplitude=0.95,"
        "aformat=channel_layouts=mono,"
        "highpass=f=200,lowpass=f=2400,"
        "afade=t=in:st=0:d=0.025:curve=qsin,"
        "afade=t=out:st=0.08:d=0.12:curve=qsin,"
        f"volume={volume_db}dB,"
        "aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo,"
        f"adelay={ms}|{ms}{label}"
    )


def build_master_audio_cmd(
    specs: List[ClipAudioSpec],
    sfx_times: List[float],
    total_duration: float,
    out_path: Path,
    sfx_volume_db: float = DEFAULT_WHOOSH_VOLUME_DB,
) -> List[str]:
    """Build the full ffmpeg argv. Pure — no I/O, unit-testable."""
    if not specs:
        raise ValueError("no clip audio specs — nothing to assemble")
    total = max(0.1, float(total_duration))
    ffmpeg = shutil.which("ffmpeg") or "ffmpeg"

    cmd: List[str] = [ffmpeg, "-nostdin", "-y", "-hide_banner", "-loglevel", "error"]
    # Input 0 — the silence bed. duration=first on the amix pins the output to
    # this anchor, so stills/gaps are silent and the mix never under-runs.
    cmd += ["-f", "lavfi", "-t", f"{total:.3f}", "-i", "anullsrc=r=44100:cl=stereo"]
    # One seeked input per clip slice (-ss/-t before -i → HTTPS range read).
    for spec in specs:
        cmd += [
            "-ss", f"{spec.source_start:.3f}",
            "-t", f"{spec.duration:.3f}",
            "-i", spec.url,
        ]

    chains: List[str] = []
    mix_labels = ["[0:a]"]
    for i, spec in enumerate(specs):
        ms = int(round(spec.in_time * 1000))
        chains.append(
            f"[{i + 1}:a]aresample=44100,"
            "aformat=sample_fmts=fltp:channel_layouts=stereo,"
            f"asetpts=PTS-STARTPTS,adelay={ms}|{ms}[c{i}]"
        )
        mix_labels.append(f"[c{i}]")
    for k, t in enumerate(sfx_times):
        chains.append(_whoosh_chain(t, sfx_volume_db, f"[w{k}]"))
        mix_labels.append(f"[w{k}]")

    chains.append(
        f"{''.join(mix_labels)}amix=inputs={len(mix_labels)}:duration=first:normalize=0[mix]"
    )
    cmd += ["-filter_complex", ";".join(chains)]
    cmd += ["-map", "[mix]", "-vn", "-ar", "44100", "-ac", "2",
            "-b:a", "128k", "-codec:a", "libmp3lame", str(out_path)]
    return cmd


def url_has_audio_stream(url: str, timeout_s: float = 30.0) -> bool:
    """ffprobe whether a source has at least one audio stream. A SOURCE_CLIP
    without one (screen recording, b-roll) would make the `[N:a]` pad in the
    filter graph fail the WHOLE mix ("matches no streams") — and since the
    master build is fail-loud, that would brick every build of the project.
    Probe errors (network blip, weird container) return True so the clip stays
    in the graph and any real problem still surfaces loudly in the main run."""
    ffprobe = shutil.which("ffprobe") or "ffprobe"
    try:
        proc = subprocess.run(
            [ffprobe, "-v", "error", "-select_streams", "a",
             "-show_entries", "stream=codec_type", "-of", "csv=p=0", url],
            capture_output=True, timeout=timeout_s,
        )
    except Exception:
        return True
    if proc.returncode != 0:
        return True
    return b"audio" in proc.stdout


def build_master_audio(
    timeline: dict,
    workdir: Path,
    *,
    sfx_enabled: bool = False,
    sfx_placement: str = "segment_boundaries",
    sfx_volume_db: float = DEFAULT_WHOOSH_VOLUME_DB,
    exclude_handles: Optional[frozenset] = None,
    probe=url_has_audio_stream,
) -> Optional[Path]:
    """Assemble the master MP3 for a built timeline. Returns None when the
    timeline has no source-clip audio (image-only build or all sources silent —
    the render falls back to the silent master). Raises RuntimeError on ffmpeg
    failure: a build whose soundtrack silently vanished is exactly the bug this
    stage exists to fix, so the failure must be loud."""
    specs = collect_clip_audio_specs(timeline, exclude_handles)
    # Drop clips whose SOURCE has no audio stream (probe once per URL) — a
    # streamless input would fail the whole filter graph.
    has_audio: dict = {}
    kept: List[ClipAudioSpec] = []
    for s in specs:
        if s.url not in has_audio:
            has_audio[s.url] = probe(s.url)
            if not has_audio[s.url]:
                logger.info(f"[StudioAudio] source has no audio stream — muted in mix: {s.url}")
        if has_audio[s.url]:
            kept.append(s)
    specs = kept
    if not specs:
        return None
    meta = (timeline or {}).get("meta") or {}
    total = float(meta.get("total_duration") or 0) or max(
        s.in_time + s.duration for s in specs
    )
    sfx_times = compute_sfx_cue_times(timeline, sfx_placement) if sfx_enabled else []

    out_path = Path(workdir) / "master_audio.mp3"
    cmd = build_master_audio_cmd(specs, sfx_times, total, out_path, sfx_volume_db)
    logger.info(
        f"[StudioAudio] assembling master audio: {len(specs)} clip slices, "
        f"{len(sfx_times)} whooshes, {total:.1f}s"
    )
    proc = subprocess.run(cmd, capture_output=True, timeout=FFMPEG_TIMEOUT_S)
    if proc.returncode != 0 or not out_path.exists():
        stderr_tail = proc.stderr.decode("utf-8", "ignore")[-400:]
        raise RuntimeError(
            f"master-audio ffmpeg failed (rc={proc.returncode}): {stderr_tail}"
        )
    return out_path


def loop_bed_to_duration_cmd(bed_path: Path, total_duration: float, out_path: Path) -> List[str]:
    """ffmpeg argv to loop a short music bed out to the video duration (the
    fal/ElevenLabs bed is ≤22s and the worker's audio_tracks don't loop)."""
    ffmpeg = shutil.which("ffmpeg") or "ffmpeg"
    total = max(0.1, float(total_duration))
    return [
        ffmpeg, "-nostdin", "-y", "-hide_banner", "-loglevel", "error",
        "-stream_loop", "-1", "-i", str(bed_path),
        "-t", f"{total:.3f}",
        "-vn", "-ar", "44100", "-ac", "2", "-b:a", "128k",
        "-codec:a", "libmp3lame", str(out_path),
    ]


def loop_bed_to_duration(bed_path: Path, total_duration: float, out_path: Path) -> Path:
    """Run the loop-extend. Raises RuntimeError on failure (callers treat BGM
    as best-effort and catch)."""
    cmd = loop_bed_to_duration_cmd(bed_path, total_duration, out_path)
    proc = subprocess.run(cmd, capture_output=True, timeout=FFMPEG_TIMEOUT_S)
    if proc.returncode != 0 or not out_path.exists():
        stderr_tail = proc.stderr.decode("utf-8", "ignore")[-400:]
        raise RuntimeError(f"bgm loop-extend ffmpeg failed (rc={proc.returncode}): {stderr_tail}")
    return out_path
