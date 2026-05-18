"""Multi-track audio mixer for the AI video pipeline.

Composes VO + music underbed + SFX cues + transition stingers into a
single mastered audio track via one ffmpeg invocation.

Filter chain (high-level):

    [vo]                       → passthrough
    [music] aloop atrim volume → sidechain-ducked under [vo]
    [sfx_i] adelay volume      → placed at absolute time t
    [sting_j] adelay volume    → placed at absolute time t
    all     amix               → unified mix
    mix     loudnorm I=-16     → broadcast LUFS master
    mast    alimiter -1 dBTP   → brick-wall ceiling
    out     mp3 192kbps

Failure posture: every layer has a graceful degradation path. If
music download fails, mix VO + SFX. If any SFX url 404s, drop that
cue. If ffmpeg fails, return None — caller falls back to bare VO.

The existing `sound_planner.py` produces shot-relative cue times.
The caller (`automation_pipeline`) is responsible for flattening
across entries with `t_abs = entry.start + cue.t` before handing
cues to `build_mix`.

Why we do this in ffmpeg, not Python:
  - Python-side mixing via pydub/moviepy is 5-10× slower and produces
    artifacts at clip boundaries
  - ffmpeg's `sidechaincompress`, `loudnorm`, and `alimiter` are
    battle-tested broadcast tools — recreating in Python would be
    a multi-month project
  - Single subprocess call is easier to time out, log, and abort
    cleanly than a Python audio graph
"""
from __future__ import annotations

import json
import logging
import os
import shutil
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Tunables — keep at module level so they're discoverable + testable
# ---------------------------------------------------------------------------

# Sidechain compression — music ducks when VO is present
#   threshold: VO level at which compression kicks in. -25dB matches
#     typical TTS levels post-normalization. Bump down (e.g. -30dB) to
#     duck harder on quiet VO.
#   ratio: 8:1 is aggressive but not crushing — music drops ~6dB on VO peaks.
#   attack 20ms: fast pump so VO syllables don't get masked.
#   release 300ms: gentle return so music doesn't pump between syllables.
_SIDECHAIN_THRESHOLD_DB = -25.0
_SIDECHAIN_RATIO        = 8.0
_SIDECHAIN_ATTACK_MS    = 20
_SIDECHAIN_RELEASE_MS   = 300

# Master loudness target. -16 LUFS is YouTube/Spotify integrated loudness.
# LRA=11 LU is a comfortable range for educational/promotional content
# (movies typically run 15+; podcast/voice content 8-11).
# tp=-1 dBTP ceiling gives streaming platforms headroom for transcoding.
_TARGET_LUFS_I  = -16.0
_TARGET_LUFS_LRA = 11.0
_TARGET_LUFS_TP  = -1.0

# Final brick-wall limiter to guarantee no clipping above the ceiling.
_LIMITER_CEILING_DB = -1.0

# Output encoding. mp3 @ 192kbps 48kHz is the right balance — small file,
# perceptually transparent, universal codec support.
_OUTPUT_SAMPLE_RATE = 48000
_OUTPUT_BITRATE     = "192k"

# ffmpeg invocation deadline. A 30s video with 15 audio inputs typically
# finishes in 4-10s. 120s ceiling is generous enough for slow disks /
# large files but won't hang a render for minutes.
_FFMPEG_TIMEOUT_S = 120.0

# Cue download timeout per URL. Most S3 URLs respond in <1s. 8s ceiling
# catches stuck connections without blocking the whole render.
_CUE_DOWNLOAD_TIMEOUT_S = 8.0
_CUE_DOWNLOAD_PARALLELISM = 8


# ---------------------------------------------------------------------------
# Public types
# ---------------------------------------------------------------------------

@dataclass
class MixCue:
    """One audio cue to place at an absolute timestamp.

    `url`: either an http(s) URL OR a local file path. The mixer
    downloads URLs to a temp dir; local paths are used in-place.
    `t_s`: absolute time (seconds from video start) at which the cue
    should sound. The mixer applies `adelay = t_s * 1000` ms.
    `volume`: 0.0–1.0 linear gain. The sound_planner already applies
    its own perceptual scaling; we multiply through unchanged.
    """
    url: str
    t_s: float
    volume: float = 1.0
    label: str = ""  # human-readable for logging only


@dataclass
class MixSpec:
    """Full inputs to one mix render. Optional fields = layer disabled."""
    vo_path: Path
    video_duration_s: float
    music_path: Optional[Path] = None
    music_volume: float = 0.10
    sfx_cues: List[MixCue] = field(default_factory=list)
    stinger_cues: List[MixCue] = field(default_factory=list)
    enable_ducking: bool = True
    enable_loudnorm: bool = True


@dataclass
class MixResult:
    """Outcome of one mix render."""
    output_path: Optional[Path] = None
    ok: bool = False
    error: str = ""
    duration_s: float = 0.0
    layers_used: List[str] = field(default_factory=list)  # ["vo", "music", "sfx", "stingers"]
    ffmpeg_returncode: int = 0
    ffmpeg_stderr_excerpt: str = ""


# ---------------------------------------------------------------------------
# Cue download / caching
# ---------------------------------------------------------------------------

def _is_url(s: str) -> bool:
    """True for http(s):// URLs. Local file paths return False."""
    if not s:
        return False
    try:
        u = urlparse(s)
        return u.scheme in ("http", "https") and bool(u.netloc)
    except Exception:
        return False


def _download_one(url: str, dest_dir: Path, idx: int) -> Optional[Path]:
    """Download a single URL to dest_dir/cue_{idx:03d}{ext}. Returns the
    local path on success or None on any failure. Errors are logged but
    not raised — caller drops missing cues from the mix."""
    try:
        with httpx.Client(timeout=_CUE_DOWNLOAD_TIMEOUT_S, follow_redirects=True) as client:
            resp = client.get(url)
        if resp.status_code != 200 or not resp.content:
            logger.warning(
                "[mixer] cue download failed (HTTP %d) %s — dropping",
                resp.status_code, url[:80],
            )
            return None
    except Exception as e:
        logger.warning("[mixer] cue download error %s: %s", url[:80], e)
        return None
    # Sniff format from URL extension; fall back to .mp3 if unknown.
    ext = ".mp3"
    for candidate in (".mp3", ".wav", ".m4a", ".ogg", ".opus", ".webm"):
        if url.lower().split("?")[0].endswith(candidate):
            ext = candidate
            break
    out = dest_dir / f"cue_{idx:03d}{ext}"
    try:
        out.write_bytes(resp.content)
    except OSError as e:
        logger.warning("[mixer] cue write failed %s: %s", out, e)
        return None
    return out


def download_cues_to_disk(
    cues: Sequence[MixCue], dest_dir: Path,
) -> List[Tuple[Path, float, float, str]]:
    """Parallel-download URL cues; pass through local paths unchanged.

    Returns [(local_path, t_s, volume, label), ...] in input order.
    Cues that fail to download are silently dropped from the output —
    the mix continues with what we have.
    """
    dest_dir.mkdir(parents=True, exist_ok=True)
    results: List[Optional[Tuple[Path, float, float, str]]] = [None] * len(cues)

    download_jobs: List[Tuple[int, str]] = []
    for i, cue in enumerate(cues):
        if not cue.url:
            continue
        if _is_url(cue.url):
            download_jobs.append((i, cue.url))
        else:
            # Local path — verify it exists and pass through.
            p = Path(cue.url)
            if p.exists():
                results[i] = (p, float(cue.t_s), float(cue.volume), cue.label)
            else:
                logger.warning("[mixer] local cue file missing: %s", cue.url)

    if download_jobs:
        with ThreadPoolExecutor(max_workers=_CUE_DOWNLOAD_PARALLELISM) as ex:
            future_to_idx = {
                ex.submit(_download_one, url, dest_dir, i): i
                for i, url in download_jobs
            }
            for fut in as_completed(future_to_idx):
                i = future_to_idx[fut]
                try:
                    local = fut.result()
                except Exception as e:
                    logger.warning("[mixer] download job %d crashed: %s", i, e)
                    continue
                if local is None:
                    continue
                cue = cues[i]
                results[i] = (local, float(cue.t_s), float(cue.volume), cue.label)

    return [r for r in results if r is not None]


# ---------------------------------------------------------------------------
# ffmpeg filter graph builder
# ---------------------------------------------------------------------------

def _build_filter_graph(
    spec: MixSpec,
    cue_files: List[Tuple[Path, float, float, str]],
    n_total_inputs: int,
) -> Tuple[str, str]:
    """Construct the `-filter_complex` string and the final output label.

    Layout of inputs (0-indexed in the `[N:a]` references):
        [0] narration.mp3  (always present)
        [1] music.mp3      (if spec.music_path)
        [2..k] sfx + stingers in cue_files order

    Returns (filter_graph_str, final_label_without_brackets).
    Empty filter means trivial passthrough — caller can skip ffmpeg
    entirely if everything is degenerate.
    """
    parts: List[str] = []
    next_input = 0

    # ── VO layer ────────────────────────────────────────────────────
    # When ducking is enabled AND music is present, the VO stream feeds
    # two consumers: (a) the final amix, (b) the sidechain trigger on
    # the music compressor. ffmpeg filter labels can only be consumed
    # ONCE, so we asplit the VO into two named labels. When ducking is
    # off, a single anull pass is enough.
    needs_vo_split = spec.music_path is not None and spec.enable_ducking
    if needs_vo_split:
        parts.append(f"[{next_input}:a] asplit=2 [vo][vo_sc]")
    else:
        parts.append(f"[{next_input}:a] anull [vo]")
    vo_label = "[vo]"
    next_input += 1

    # ── Music layer (optional) ─────────────────────────────────────
    music_label: Optional[str] = None
    if spec.music_path is not None:
        # aloop=-1 (infinite) extends a short loopable bed to fill the
        # whole video. size is samples — at 48kHz, 22s = 1,056,000 samples.
        # We pass a generous large number to cover any reasonable length.
        # atrim then clips to the actual video duration so we don't pad
        # silence past the last frame.
        loop_samples = int(_OUTPUT_SAMPLE_RATE * max(spec.video_duration_s, 0.5))
        vol = max(0.0, min(1.0, float(spec.music_volume)))
        parts.append(
            f"[{next_input}:a] aloop=loop=-1:size={loop_samples}, "
            f"atrim=duration={spec.video_duration_s}, "
            f"asetpts=PTS-STARTPTS, "
            f"volume={vol} [bgm_raw]"
        )
        if spec.enable_ducking:
            # sidechaincompress: [bgm_raw] is main, [vo_sc] is sidechain
            # trigger. Filter syntax: [main][sc] sidechaincompress=... [out]
            # Note: `makeup` must be in [1, 64] — 1.0 = no makeup gain,
            # which is what we want (we already managed levels via
            # music_volume above). The deprecated `makeup=0` form throws
            # "Result too large" on modern ffmpeg.
            parts.append(
                f"[bgm_raw][vo_sc] sidechaincompress="
                f"threshold={_SIDECHAIN_THRESHOLD_DB}dB:"
                f"ratio={_SIDECHAIN_RATIO}:"
                f"attack={_SIDECHAIN_ATTACK_MS}:"
                f"release={_SIDECHAIN_RELEASE_MS}:"
                f"makeup=1 [bgm_ducked]"
            )
            music_label = "[bgm_ducked]"
        else:
            music_label = "[bgm_raw]"
        next_input += 1

    # ── SFX + stingers layer ────────────────────────────────────────
    sfx_labels: List[str] = []
    for (path, t_s, volume, label) in cue_files:
        delay_ms = max(0, int(round(float(t_s) * 1000)))
        vol = max(0.0, min(1.0, float(volume)))
        out_label = f"sfx{next_input}"
        # adelay applies an initial silence of N ms. `t|t` syntax delays
        # both stereo channels equally (avoiding the deprecated single-value
        # form). pan=stereo upmixes mono inputs so amix doesn't downmix
        # to mono later.
        parts.append(
            f"[{next_input}:a] adelay={delay_ms}|{delay_ms}, "
            f"volume={vol} [{out_label}]"
        )
        sfx_labels.append(f"[{out_label}]")
        next_input += 1

    if next_input != n_total_inputs:
        # Sanity — caller declared N inputs but we only wired M into the
        # graph. Refuse the build rather than ship a broken filter.
        raise ValueError(
            f"input count mismatch: declared {n_total_inputs}, wired {next_input}"
        )

    # ── amix all layers ─────────────────────────────────────────────
    mix_inputs: List[str] = []
    if music_label:
        mix_inputs.append(music_label)
    mix_inputs.append(vo_label)
    mix_inputs.extend(sfx_labels)
    k = len(mix_inputs)
    # If only VO is present, skip amix entirely — VO is already labeled.
    if k == 1:
        pre_master = vo_label
    else:
        # normalize=0 means amix doesn't auto-attenuate by 1/N — we managed
        # levels per-stream and don't want it crushed back into the floor.
        parts.append(
            f"{''.join(mix_inputs)} amix=inputs={k}:duration=longest:normalize=0 [mix]"
        )
        pre_master = "[mix]"

    # ── Master: loudnorm + limiter ─────────────────────────────────
    if spec.enable_loudnorm:
        parts.append(
            f"{pre_master} loudnorm="
            f"I={_TARGET_LUFS_I}:"
            f"LRA={_TARGET_LUFS_LRA}:"
            f"tp={_TARGET_LUFS_TP}:"
            f"linear=true [master_norm]"
        )
        parts.append(
            f"[master_norm] alimiter=limit={_LIMITER_CEILING_DB}dB [out]"
        )
        return ("; ".join(parts), "out")

    # No loudnorm path — still apply alimiter as the ceiling guard.
    parts.append(
        f"{pre_master} alimiter=limit={_LIMITER_CEILING_DB}dB [out]"
    )
    return ("; ".join(parts), "out")


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def build_mix(
    spec: MixSpec,
    *,
    run_dir: Path,
    output_filename: str = "final_mix.mp3",
    keep_artifacts: bool = False,
) -> MixResult:
    """Build the final multi-track audio mix.

    Args:
        spec: complete declaration of which layers to mix.
        run_dir: video render's working directory. Mixer creates
            `run_dir/_audio_cues/` for downloaded cue files and writes
            the output to `run_dir/output_filename`.
        output_filename: name (not full path) for the final mp3.
        keep_artifacts: when True, leave downloaded cues + intermediate
            files on disk for debugging. Default False → cleaned up.

    Returns:
        MixResult with `ok=True` and `output_path` set on success.
        On any failure, `ok=False` and `error` populated; caller falls
        back to bare narration.mp3.
    """
    run_dir = Path(run_dir)
    run_dir.mkdir(parents=True, exist_ok=True)
    output_path = run_dir / output_filename

    # Quick sanity check on VO — without it we have nothing to mix.
    if not spec.vo_path or not Path(spec.vo_path).exists():
        return MixResult(ok=False, error=f"VO file not found: {spec.vo_path}")

    layers_used: List[str] = ["vo"]
    cues_dir = run_dir / "_audio_cues"

    # ── Step 1: download all URL cues in parallel ─────────────────
    all_cues: List[MixCue] = []
    all_cues.extend(spec.sfx_cues)
    all_cues.extend(spec.stinger_cues)
    if all_cues:
        cue_files = download_cues_to_disk(all_cues, cues_dir)
        # Sort cues by absolute time for deterministic filter graphs
        # (also helps debug — first cue in graph = first cue in time).
        cue_files.sort(key=lambda r: r[1])
        if cue_files:
            layers_used.append("sfx")
    else:
        cue_files = []

    # ── Step 2: count inputs + build filter graph ─────────────────
    inputs: List[Path] = [Path(spec.vo_path)]
    if spec.music_path is not None and Path(spec.music_path).exists():
        inputs.append(Path(spec.music_path))
        layers_used.append("music")
    else:
        # Disable music in the spec so the filter graph builder skips it.
        spec.music_path = None
    inputs.extend(path for (path, _t, _v, _l) in cue_files)

    try:
        filter_graph, out_label = _build_filter_graph(
            spec, cue_files, n_total_inputs=len(inputs),
        )
    except Exception as e:
        return MixResult(ok=False, error=f"filter graph build failed: {e}")

    # ── Step 3: invoke ffmpeg ─────────────────────────────────────
    ffmpeg = shutil.which("ffmpeg") or "ffmpeg"
    cmd: List[str] = [ffmpeg, "-hide_banner", "-loglevel", "warning", "-y"]
    for p in inputs:
        cmd.extend(["-i", str(p)])
    cmd.extend([
        "-filter_complex", filter_graph,
        "-map", f"[{out_label}]",
        "-ar", str(_OUTPUT_SAMPLE_RATE),
        "-c:a", "libmp3lame",
        "-b:a", _OUTPUT_BITRATE,
        str(output_path),
    ])

    logger.info(
        "[mixer] running ffmpeg with %d inputs (layers=%s)",
        len(inputs), layers_used,
    )
    try:
        proc = subprocess.run(
            cmd, capture_output=True, text=True, timeout=_FFMPEG_TIMEOUT_S,
        )
    except subprocess.TimeoutExpired:
        return MixResult(
            ok=False, error=f"ffmpeg timed out after {_FFMPEG_TIMEOUT_S}s",
            layers_used=layers_used,
        )
    except FileNotFoundError:
        return MixResult(
            ok=False, error=f"ffmpeg not found on PATH ({ffmpeg})",
            layers_used=layers_used,
        )

    if proc.returncode != 0:
        excerpt = (proc.stderr or "")[-800:]
        logger.error(
            "[mixer] ffmpeg failed (rc=%d). stderr tail:\n%s",
            proc.returncode, excerpt,
        )
        if not keep_artifacts and cues_dir.exists():
            shutil.rmtree(cues_dir, ignore_errors=True)
        return MixResult(
            ok=False,
            error=f"ffmpeg returned {proc.returncode}",
            ffmpeg_returncode=proc.returncode,
            ffmpeg_stderr_excerpt=excerpt,
            layers_used=layers_used,
        )

    # ── Step 4: verify output exists + has content ────────────────
    if not output_path.exists() or output_path.stat().st_size < 1024:
        if not keep_artifacts and cues_dir.exists():
            shutil.rmtree(cues_dir, ignore_errors=True)
        return MixResult(
            ok=False,
            error="ffmpeg succeeded but output is missing or too small",
            ffmpeg_returncode=proc.returncode,
            layers_used=layers_used,
        )

    if not keep_artifacts and cues_dir.exists():
        shutil.rmtree(cues_dir, ignore_errors=True)

    if "sfx" in layers_used and spec.stinger_cues:
        layers_used.append("stingers")

    logger.info(
        "[mixer] success: wrote %s (%.1f KB, layers=%s)",
        output_path.name, output_path.stat().st_size / 1024.0, layers_used,
    )
    return MixResult(
        ok=True,
        output_path=output_path,
        duration_s=spec.video_duration_s,
        layers_used=layers_used,
        ffmpeg_returncode=0,
    )


# ---------------------------------------------------------------------------
# Diagnostic helper — probe LUFS of a generated mix
# ---------------------------------------------------------------------------

def measure_lufs(audio_path: Path) -> Optional[float]:
    """Run loudnorm in analysis mode and return integrated LUFS. Returns
    None on any failure. Useful for verifying the master is on-target
    (-16 ± 1 LU) after `build_mix`."""
    ffmpeg = shutil.which("ffmpeg") or "ffmpeg"
    cmd = [
        ffmpeg, "-hide_banner", "-i", str(audio_path),
        "-af", f"loudnorm=I={_TARGET_LUFS_I}:LRA={_TARGET_LUFS_LRA}:"
               f"tp={_TARGET_LUFS_TP}:print_format=json",
        "-f", "null", "-",
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    except Exception as e:
        logger.warning("[mixer] measure_lufs ffmpeg failed: %s", e)
        return None
    # loudnorm emits its JSON to stderr at the end of stderr stream.
    err = proc.stderr or ""
    try:
        # Find the LAST JSON block (loudnorm emits one).
        start = err.rfind("{")
        end = err.rfind("}")
        if start < 0 or end < 0 or end < start:
            return None
        data = json.loads(err[start:end + 1])
        return float(data.get("input_i", 0.0))
    except Exception:
        return None
