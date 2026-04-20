"""
Render Worker — Downloads inputs from S3, runs generate_video.py, uploads MP4.

Reuses the exact same Playwright + MoviePy + FFmpeg pipeline from
ai-video-gen-main/generate_video.py. The only difference is that inputs
come from S3 URLs instead of local paths.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Callable, Optional
from urllib.request import Request, urlopen

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger("render-worker")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

AWS_ACCESS_KEY = os.environ.get("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY", "")
AWS_REGION = os.environ.get("AWS_REGION", "ap-south-1")
S3_BUCKET = os.environ.get("AWS_S3_PUBLIC_BUCKET", "vacademy-media-storage-public")

# Path to generate_video.py (baked into Docker image)
RENDER_SCRIPT = Path(__file__).parent / "ai-video-gen-main" / "generate_video.py"
VIDEO_OPTIONS = Path(__file__).parent / "ai-video-gen-main" / "video_options.json"
CAPTIONS_SETTINGS = Path(__file__).parent / "ai-video-gen-main" / "captions_settings.json"
REPO_ROOT = Path(__file__).parent / "ai-video-gen-main"


class RenderWorker:
    """Downloads inputs, runs generate_video.py, uploads output."""

    def __init__(self):
        self._s3 = boto3.client(
            "s3",
            aws_access_key_id=AWS_ACCESS_KEY or None,
            aws_secret_access_key=AWS_SECRET_KEY or None,
            region_name=AWS_REGION,
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def render(
        self,
        video_id: str,
        timeline_url: str,
        audio_url: str,
        words_url: Optional[str] = None,
        branding_meta_url: Optional[str] = None,
        avatar_video_url: Optional[str] = None,
        show_captions: bool = True,
        show_branding: bool = True,
        audio_delay: float = 0.0,
        on_progress: Optional[Callable[[float], None]] = None,
        width: int = 1920,
        height: int = 1080,
        fps: Optional[int] = None,
        caption_position: Optional[str] = None,
        caption_text_color: Optional[str] = None,
        caption_bg_color: Optional[str] = None,
        caption_bg_opacity: Optional[int] = None,
        caption_font_size: Optional[int] = None,
        audio_tracks: Optional[list] = None,
        source_video_urls: Optional[list] = None,
    ) -> str:
        """
        Run the full render pipeline and return the S3 URL of the output MP4.

        Runs generate_video.py in a subprocess (blocking I/O offloaded
        to a thread so the event loop stays free).
        """
        work_dir = Path(tempfile.mkdtemp(prefix=f"render_{video_id}_"))
        logger.info(f"Work dir: {work_dir}")

        try:
            # ── Download inputs ──
            if on_progress:
                on_progress(5)

            audio_path = work_dir / "narration.mp3"
            timeline_path = work_dir / "time_based_frame.json"

            self._download(audio_url, audio_path)
            self._download(timeline_url, timeline_path)

            words_path = work_dir / "narration.words.json"
            if words_url:
                self._download(words_url, words_path)

            if branding_meta_url:
                branding_meta_path = work_dir / "branding_meta.json"
                self._download(branding_meta_url, branding_meta_path)
                # Override audio_delay from branding_meta if present
                try:
                    meta = json.loads(branding_meta_path.read_text())
                    bd = float(meta.get("intro_duration_seconds", 0.0))
                    if bd > 0:
                        audio_delay = bd
                        logger.info(f"Audio delay from branding_meta: {audio_delay}s")
                except Exception:
                    pass

            avatar_path: Optional[Path] = None
            if avatar_video_url:
                avatar_path = work_dir / "avatar_video.mp4"
                self._download(avatar_video_url, avatar_path)

            # ── Download extra audio tracks ──
            # audio_tracks is a list of dicts: {id, label, url, volume, delay, fadeIn, fadeOut}
            # If not passed explicitly, try to read from timeline meta
            if audio_tracks is None:
                try:
                    timeline_data = json.loads(timeline_path.read_text())
                    if isinstance(timeline_data, dict):
                        audio_tracks = timeline_data.get("meta", {}).get("audio_tracks", []) or []
                    else:
                        audio_tracks = []
                except Exception:
                    audio_tracks = []

            # Each entry is (path, track_metadata) to keep indices aligned
            extra_audio_items: list[tuple[Path, dict]] = []
            for idx, track in enumerate(audio_tracks or []):
                track_url = track.get("url", "")
                if not track_url:
                    continue
                ext = track_url.rsplit(".", 1)[-1].split("?")[0].lower() or "mp3"
                if len(ext) > 10:  # bad parse — fallback
                    ext = "mp3"
                track_path = work_dir / f"audio_track_{idx}.{ext}"
                try:
                    self._download(track_url, track_path)
                    extra_audio_items.append((track_path, track))
                except Exception as exc:
                    logger.warning(f"Failed to download audio track {idx} ({track_url}): {exc}")

            if on_progress:
                on_progress(15)

            # ── Parallel frame rendering ──
            # Split frames across N parallel Playwright processes for speed.
            # Each process renders a subset of frames, then we assemble with FFmpeg.
            NUM_WORKERS = int(os.environ.get("RENDER_PARALLEL_WORKERS", "4"))
            FPS = fps if fps and fps in (15, 20, 25, 30, 45, 60) else 25
            output_path = work_dir / "output.mp4"
            frames_dir = work_dir / ".render_frames"
            frames_dir.mkdir(parents=True, exist_ok=True)

            # Always render at native resolution (1920x1080 or 1080x1920).
            # The HTML/CSS/SVG content was generated for this canvas size.
            # User's requested resolution (720p/1080p) is applied as FFmpeg downscale.
            output_width = width    # final video resolution (e.g. 1280x720 for 720p)
            output_height = height
            is_portrait = height > width
            render_width = 1080 if is_portrait else 1920
            render_height = 1920 if is_portrait else 1080

            # Build caption settings override if custom options provided
            _captions_settings_path = CAPTIONS_SETTINGS  # default baked-in file
            if any(v is not None for v in [caption_position, caption_text_color, caption_bg_color, caption_bg_opacity, caption_font_size]):
                try:
                    base_settings = json.loads(CAPTIONS_SETTINGS.read_text()) if CAPTIONS_SETTINGS.exists() else {}
                except Exception:
                    base_settings = {}
                if caption_font_size is not None:
                    # Scale font size proportionally to native render width (always 1920 or 1080)
                    scale = render_width / 1920.0
                    base_settings["font_size"] = int(caption_font_size * scale)
                if caption_text_color is not None:
                    base_settings["font_color"] = caption_text_color
                if caption_bg_color is not None or caption_bg_opacity is not None:
                    # Convert hex + opacity to rgba
                    hex_color = (caption_bg_color or "#000000").lstrip("#")
                    if len(hex_color) == 3:
                        hex_color = ''.join(c * 2 for c in hex_color)  # "FFF" → "FFFFFF"
                    elif len(hex_color) < 6:
                        hex_color = hex_color.ljust(6, "0")
                    r, g, b = int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
                    alpha = round((caption_bg_opacity if caption_bg_opacity is not None else 75) / 100.0, 2)
                    base_settings["background_color"] = f"rgba({r},{g},{b},{alpha})"
                if caption_position is not None:
                    base_settings["position"] = caption_position
                    # Update box.y for position
                    box = base_settings.get("box", {})
                    if caption_position == "top":
                        box["y"] = int(render_height * 0.03)
                    else:
                        box["y"] = int(render_height * 0.85)
                    base_settings["box"] = box
                override_path = work_dir / "captions_settings_override.json"
                override_path.write_text(json.dumps(base_settings, indent=2))
                _captions_settings_path = override_path
                logger.info(f"Caption settings override written: {base_settings}")

            # First, compute total frames by doing a dry-run parse of timeline + audio
            import json as _json
            import re as _re
            tl_data = _json.loads(timeline_path.read_text())
            if isinstance(tl_data, dict) and "entries" in tl_data:
                tl_entries = tl_data["entries"]
            else:
                tl_entries = tl_data

            # Strip <video data-source-clip> tags from SOURCE_CLIP entries so
            # Playwright doesn't render the video (the compositor handles it).
            # Without this, the video appears twice: once from Playwright and
            # once from the compositor.
            _video_tag_re = _re.compile(
                r'<video\b[^>]*data-source-clip[^>]*>(?:</video>)?',
                _re.IGNORECASE,
            )
            _modified_tl = False
            for _entry in tl_entries:
                if _entry.get("shot_type") == "SOURCE_CLIP" and "html" in _entry:
                    _orig = _entry["html"]
                    _stripped = _video_tag_re.sub("", _orig)
                    if _stripped != _orig:
                        _entry["html"] = _stripped
                        _modified_tl = True
            # Strip LLM-generated stage-drift camera animations from ALL entries.
            # The LLM adds gsap.fromTo('.stage-drift', ...) which creates a slow
            # zoom/pan that looks smooth in FE (60fps real-time) but choppy in
            # render (screenshot-based GSAP seeking). Disabling it makes render stable.
            _drift_re = _re.compile(
                r"gsap\.fromTo\(\s*['\"]\.stage-drift['\"].*?\);",
                _re.DOTALL,
            )
            for _entry in tl_entries:
                if "html" in _entry:
                    _orig = _entry["html"]
                    _cleaned = _drift_re.sub("", _orig)
                    if _cleaned != _orig:
                        _entry["html"] = _cleaned
                        _modified_tl = True

            if _modified_tl:
                timeline_path.write_text(_json.dumps(
                    tl_data if isinstance(tl_data, dict) else tl_entries,
                    ensure_ascii=False,
                ))
                logger.info("Stripped <video> tags and stage-drift animations for render")
            from moviepy import AudioFileClip as _AFC
            _audio_dur = _AFC(str(audio_path)).duration
            tl_max_end = max((e.get("exitTime", 0) for e in tl_entries), default=0)
            total_duration = max(_audio_dur + audio_delay, tl_max_end)
            total_frames = int(total_duration * FPS) + 1
            logger.info(
                f"Render: {render_width}x{render_height} @ {FPS}fps → output {output_width}x{output_height}. "
                f"Total frames: {total_frames}, splitting across {NUM_WORKERS} workers"
            )

            # Build base command (shared across all workers)
            base_cmd = [
                sys.executable,
                str(RENDER_SCRIPT),
                str(audio_path),
                str(timeline_path),
                str(output_path),  # not used in frames-only mode, but required arg
                "--frames-dir", str(frames_dir),
                "--fps", str(FPS),
                "--width", str(render_width),
                "--height", str(render_height),
                "--frames-only",
            ]
            if VIDEO_OPTIONS.exists():
                base_cmd.extend(["--video-options", str(VIDEO_OPTIONS)])
            if words_url and words_path.exists():
                base_cmd.extend(["--captions-words", str(words_path)])
            if _captions_settings_path.exists():
                base_cmd.extend(["--captions-settings", str(_captions_settings_path)])
            if audio_delay > 0:
                base_cmd.extend(["--audio-delay", str(audio_delay)])
            # Pass explicit caption/branding flags so they override video_options.json defaults
            if show_captions:
                base_cmd.append("--show-captions")
            else:
                base_cmd.append("--no-show-captions")

            # Branding watermark overlay (branding.json is baked into Docker image)
            branding_json = REPO_ROOT / "branding.json"
            if show_branding and branding_json.exists():
                base_cmd.extend(["--show-branding", "--branding-json", str(branding_json)])
            else:
                base_cmd.append("--no-show-branding")

            # Split frame ranges
            chunk_size = (total_frames + NUM_WORKERS - 1) // NUM_WORKERS
            frame_ranges = []
            for i in range(NUM_WORKERS):
                start = i * chunk_size
                end = min(start + chunk_size, total_frames)
                if start < total_frames:
                    frame_ranges.append((start, end))

            if on_progress:
                on_progress(20)

            # Run workers in parallel
            logger.info(f"Launching {len(frame_ranges)} parallel render workers: {frame_ranges}")

            def _run_chunk(start: int, end: int) -> subprocess.CompletedProcess:
                chunk_cmd = base_cmd + ["--start-frame", str(start), "--end-frame", str(end)]
                return subprocess.run(
                    chunk_cmd,
                    check=False,
                    cwd=str(REPO_ROOT),
                    capture_output=True,
                    text=True,
                    timeout=5400,
                )

            loop = asyncio.get_event_loop()
            from concurrent.futures import ThreadPoolExecutor
            with ThreadPoolExecutor(max_workers=NUM_WORKERS) as pool:
                futures = [
                    loop.run_in_executor(pool, _run_chunk, start, end)
                    for start, end in frame_ranges
                ]
                results = await asyncio.gather(*futures)

            # Check all workers succeeded and collect browser logs
            all_browser_errors: list[str] = []
            for i, result in enumerate(results):
                # Always save full stdout/stderr to log files for debugging
                worker_log_path = work_dir / f"worker_{i}_stdout.log"
                worker_err_path = work_dir / f"worker_{i}_stderr.log"
                try:
                    worker_log_path.write_text(result.stdout or "")
                    worker_err_path.write_text(result.stderr or "")
                except Exception:
                    pass

                if result.returncode != 0:
                    logger.error(f"Worker {i} STDERR:\n{result.stderr[-2000:]}")
                    logger.error(f"Worker {i} STDOUT:\n{result.stdout[-1000:]}")
                    raise RuntimeError(
                        f"Render worker {i} (frames {frame_ranges[i]}) failed: "
                        f"{result.stderr[-500:]}"
                    )
                # Collect ALL browser errors/warnings from successful workers
                if "[BROWSER ERROR]" in result.stdout or "[BROWSER EXCEPTION]" in result.stdout:
                    browser_lines = [l for l in result.stdout.split('\n') if '[BROWSER' in l]
                    all_browser_errors.extend(browser_lines)
                    logger.warning(
                        f"Worker {i} browser errors ({len(browser_lines)} lines):\n"
                        + '\n'.join(browser_lines[:50])  # Log up to 50 lines per worker
                    )
                # Forward diagnostic lines from worker stdout
                diag_lines = [l for l in result.stdout.split('\n')
                              if any(tag in l for tag in ('RENDER-VERSION', 'SIZING-DIAG', 'ANNOT-DIAG', 'VIDEO-DIAG', 'VIVUS-DIAG', 'ROUGHNOTATION-DIAG'))]
                if diag_lines:
                    logger.info(f"Worker {i} diagnostics ({len(diag_lines)} lines):\n" + '\n'.join(diag_lines[:50]))
                logger.info(f"Worker {i} done: {result.stdout[-200:]}")

            # Write consolidated browser error log
            if all_browser_errors:
                browser_log_path = work_dir / "browser_errors.log"
                try:
                    browser_log_path.write_text('\n'.join(all_browser_errors))
                    logger.info(f"Browser errors log: {browser_log_path} ({len(all_browser_errors)} total lines)")
                except Exception:
                    pass

            rendered_frames = sorted(frames_dir.glob("frame_*.jpg"))
            # Diagnostic: detect if frames were written as .png instead of .jpg (format mismatch)
            stale_png_count = len(list(frames_dir.glob("frame_*.png")))
            if stale_png_count > 0 and len(rendered_frames) == 0:
                logger.error(f"FRAME FORMAT MISMATCH: Found {stale_png_count} .png frames but expected .jpg. "
                             f"generate_video.py may be out of sync with worker.py.")
            logger.info(f"Total rendered frames: {len(rendered_frames)} (.jpg), stale .png: {stale_png_count}")

            if on_progress:
                on_progress(70)

            # ── SOURCE_CLIP compositing ──
            # For shots that use source video footage, overlay the rendered HTML
            # frames on top of extracted source clips. Supports multiple sources.
            if source_video_urls:
                from collections import defaultdict
                # Group SOURCE_CLIP entries by source_video_index
                _clips_by_source: dict = defaultdict(list)
                for _e in tl_entries:
                    if _e.get("shot_type") == "SOURCE_CLIP" and _e.get("source_start") is not None:
                        _sv_idx = _e.get("source_video_index", 0)
                        _clips_by_source[_sv_idx].append(_e)

                if _clips_by_source:
                    logger.info(f"Compositing SOURCE_CLIP shots from {len(_clips_by_source)} source(s)...")

                for _sv_idx, _clip_entries in _clips_by_source.items():
                    if _sv_idx >= len(source_video_urls):
                        logger.warning(f"source_video_index {_sv_idx} out of range (have {len(source_video_urls)} URLs)")
                        continue
                    _sv_path = work_dir / f"source_video_{_sv_idx}.mp4"
                    self._download(source_video_urls[_sv_idx], _sv_path)
                    logger.info(f"Downloaded source video [{_sv_idx}] for {len(_clip_entries)} clips")
                    await self._composite_source_clips(
                        source_video_path=_sv_path,
                        source_clip_entries=_clip_entries,
                        frames_dir=frames_dir,
                        render_width=render_width,
                        render_height=render_height,
                        fps=FPS,
                    )
                    # Free disk immediately after compositing this source
                    _sv_path.unlink(missing_ok=True)

            if on_progress:
                on_progress(75)

            # ── Assemble with FFmpeg ──
            logger.info("Assembling video with FFmpeg...")
            # Frames rendered at native resolution (1080p/1920p).
            # Downscale to target resolution if different.

            # Build multi-audio FFmpeg command.
            # Input 0: frame sequence
            # Input 1: narration (always present)
            # Inputs 2..N: extra audio tracks (optional)
            # extra_audio_items is list[(Path, track_dict)] — indices already aligned
            valid_extra = [(p, t) for p, t in extra_audio_items if p.exists()]
            narration_idx = 1  # input index for narration.mp3

            ffmpeg_cmd = [
                "ffmpeg", "-y",
                "-framerate", str(FPS),
                "-i", str(frames_dir / "frame_%06d.jpg"),
                "-i", str(audio_path),  # narration — always input 1
            ]
            for p, _ in valid_extra:
                ffmpeg_cmd += ["-i", str(p)]

            # Build filter_complex
            # 1. Scale video
            # 2. Delay + volume + fade narration
            # 3. Per extra track: delay + volume + fade
            # 4. amix all audio streams
            filter_parts = [f"[0:v]scale={output_width}:{output_height}:flags=lanczos[scaled]"]
            narration_delay_ms = int(audio_delay * 1000)
            filter_parts.append(
                f"[{narration_idx}:a]adelay={narration_delay_ms}|{narration_delay_ms}[nar]"
            )
            audio_labels = ["[nar]"]

            for rel_idx, (_, track) in enumerate(valid_extra):
                abs_idx = rel_idx + 2  # 0=frames, 1=narration, 2+=extra
                delay_ms = int(float(track.get("delay", 0)) * 1000)
                volume = float(track.get("volume", 1.0))
                fade_in = float(track.get("fadeIn", 0))
                fade_out = float(track.get("fadeOut", 0))
                label = f"extra{rel_idx}"

                chain = f"[{abs_idx}:a]adelay={delay_ms}|{delay_ms}"
                if volume != 1.0:
                    chain += f",volume={volume:.4f}"
                if fade_in > 0:
                    chain += f",afade=t=in:st=0:d={fade_in:.3f}"
                # fade_out: reverse→fade_in→reverse trick avoids needing audio duration
                if fade_out > 0:
                    chain += f",areverse,afade=t=in:d={fade_out:.3f},areverse"
                chain += f"[{label}]"
                filter_parts.append(chain)
                audio_labels.append(f"[{label}]")

            if len(audio_labels) == 1:
                # Single audio stream — no amix needed
                filter_parts.append(f"{audio_labels[0]}aresample=44100[aout]")
            else:
                n = len(audio_labels)
                filter_parts.append(
                    f"{''.join(audio_labels)}amix=inputs={n}:duration=longest:normalize=0[aout]"
                )

            filter_complex = ";".join(filter_parts)

            ffmpeg_cmd += [
                "-filter_complex", filter_complex,
                "-map", "[scaled]",
                "-map", "[aout]",
                "-c:v", "libx264",
                "-pix_fmt", "yuv420p",
                "-crf", "23",
                "-preset", "fast",
                "-c:a", "aac",
                "-shortest",
                str(output_path),
            ]
            logger.info(f"FFmpeg filter_complex: {filter_complex}")

            ffmpeg_result = await loop.run_in_executor(
                None,
                lambda: subprocess.run(
                    ffmpeg_cmd, check=False, capture_output=True, text=True, timeout=600
                ),
            )

            if ffmpeg_result.returncode != 0:
                logger.error(f"FFmpeg STDERR:\n{ffmpeg_result.stderr[-2000:]}")
                raise RuntimeError(f"FFmpeg assembly failed: {ffmpeg_result.stderr[-500:]}")

            if not output_path.exists():
                raise RuntimeError(f"FFmpeg completed but output.mp4 not found at {output_path}")

            logger.info(f"Video assembled: {output_path} ({output_path.stat().st_size / 1024 / 1024:.1f} MB)")

            if on_progress:
                on_progress(85)

            # ── Upload to S3 ──
            s3_key = f"ai-videos/{video_id}/video/output.mp4"
            video_url = self._upload(output_path, s3_key)
            logger.info(f"Uploaded to S3: {video_url}")

            if on_progress:
                on_progress(100)

            return video_url

        finally:
            # Clean up work directory
            try:
                shutil.rmtree(work_dir, ignore_errors=True)
                logger.info(f"Cleaned up {work_dir}")
            except Exception:
                pass

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _download(self, url: str, local_path: Path):
        """Download a file from S3 URL or any HTTP URL."""
        local_path.parent.mkdir(parents=True, exist_ok=True)

        # Try S3 download first (faster, no public URL needed)
        if S3_BUCKET and S3_BUCKET in url:
            try:
                parts = url.split(f"{S3_BUCKET}.s3.amazonaws.com/")
                if len(parts) == 2:
                    s3_key = parts[1]
                    self._s3.download_file(S3_BUCKET, s3_key, str(local_path))
                    logger.info(f"Downloaded (S3): {local_path.name}")
                    return
            except (ClientError, Exception) as e:
                logger.warning(f"S3 download failed, trying HTTP: {e}")

        # Fallback: HTTP download
        try:
            req = Request(url, headers={"User-Agent": "VacademyRenderWorker/1.0"})
            with urlopen(req, timeout=120) as resp:
                local_path.write_bytes(resp.read())
            logger.info(f"Downloaded (HTTP): {local_path.name}")
        except Exception as e:
            raise RuntimeError(f"Failed to download {url}: {e}")

    async def _composite_source_clips(
        self,
        source_video_path: Path,
        source_clip_entries: list,
        frames_dir: Path,
        render_width: int,
        render_height: int,
        fps: int,
    ) -> None:
        """Replace rendered HTML-only frames with source_video + HTML overlay composites.

        For each SOURCE_CLIP entry in the timeline:
        1. Extract the source video clip for [source_start, source_end]
        2. Read the Playwright-rendered overlay frames (transparent bg) for this shot
        3. Composite overlay on top of source clip → overwrite frame JPGs

        The Playwright renderer produced frames with whatever background the HTML had
        (should be transparent/black for SOURCE_CLIP). We replace those frames with
        the source video underneath + the overlay on top.
        """
        import cv2
        import numpy as np

        cap = cv2.VideoCapture(str(source_video_path))
        if not cap.isOpened():
            logger.error(f"Cannot open source video for compositing: {source_video_path}")
            return

        for entry in source_clip_entries:
            in_time = float(entry.get("inTime", 0))
            exit_time = float(entry.get("exitTime", 0))
            source_start = float(entry.get("source_start", 0))
            source_end = float(entry.get("source_end", source_start + (exit_time - in_time)))

            # Frame range in the output video
            # Frames are named frame_000001.jpg (1-indexed)
            first_frame_num = int(in_time * fps) + 1
            last_frame_num = int(exit_time * fps) + 1
            source_duration = source_end - source_start

            if source_duration <= 0:
                continue

            logger.info(
                f"  Compositing SOURCE_CLIP: output frames {first_frame_num}-{last_frame_num}, "
                f"source {source_start:.1f}-{source_end:.1f}s"
            )

            # Detect compositing mode from the FIRST frame of this shot.
            # Compute card bounds once and reuse for all frames to avoid flicker
            # caused by per-frame bounding-box jitter from JPEG artifacts.
            _first_path = frames_dir / f"frame_{first_frame_num:06d}.jpg"
            _first_overlay = cv2.imread(str(_first_path)) if _first_path.exists() else None

            # Compositing mode: "card" (video in a container) or "fullscreen" (video behind overlay)
            _comp_mode = "fullscreen"
            _card_bounds = None  # (y0, x0, card_h, card_w, new_h, new_w, oy, ox)

            if _first_overlay is not None:
                _fg = cv2.cvtColor(_first_overlay, cv2.COLOR_BGR2GRAY)
                _bm = _fg <= 15
                _br = np.sum(_bm) / _bm.size
                if _br < 0.75:
                    _coords = np.argwhere(_bm)
                    if len(_coords) > 100:
                        _comp_mode = "card"
                        _y0, _x0 = _coords.min(axis=0)
                        _y1, _x1 = _coords.max(axis=0) + 1
                        _card_w, _card_h = _x1 - _x0, _y1 - _y0
                        # Pre-compute source resize dimensions (stable for all frames)
                        _src_fps_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                        _src_fps_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                        _scale = min(_card_w / max(_src_fps_w, 1), _card_h / max(_src_fps_h, 1))
                        _nw = int(_src_fps_w * _scale)
                        _nh = int(_src_fps_h * _scale)
                        _ox = _x0 + (_card_w - _nw) // 2
                        _oy = _y0 + (_card_h - _nh) // 2
                        _card_bounds = (_oy, _ox, _nh, _nw)
                        logger.info(f"    Card layout detected: card=({_x0},{_y0})-({_x1},{_y1}), "
                                    f"video={_nw}x{_nh} at ({_ox},{_oy})")

            # Seek to source_start and read frames sequentially (avoids costly random seeks)
            cap.set(cv2.CAP_PROP_POS_MSEC, source_start * 1000)

            for frame_num in range(first_frame_num, last_frame_num + 1):
                frame_path = frames_dir / f"frame_{frame_num:06d}.jpg"
                if not frame_path.exists():
                    # Still advance the video even if frame file is missing
                    cap.read()
                    continue

                # Calculate the source video timestamp for this output frame
                t_in_shot = (frame_num - first_frame_num) / fps
                t_ratio = t_in_shot / max(exit_time - in_time, 0.001)
                source_t = source_start + t_ratio * source_duration

                # Seek to source timestamp and read frame
                cap.set(cv2.CAP_PROP_POS_MSEC, source_t * 1000)
                ret, src_frame = cap.read()
                if not ret:
                    continue

                # Read the existing overlay frame (rendered by Playwright)
                overlay = cv2.imread(str(frame_path))
                if overlay is None:
                    # Resize source and write directly
                    if src_frame.shape[1] != render_width or src_frame.shape[0] != render_height:
                        src_frame = cv2.resize(src_frame, (render_width, render_height))
                    cv2.imwrite(str(frame_path), src_frame)
                    continue

                # Resize overlay if needed
                if overlay.shape[1] != render_width or overlay.shape[0] != render_height:
                    overlay = cv2.resize(overlay, (render_width, render_height))

                if _comp_mode == "card" and _card_bounds:
                    # Card layout — place source video in the pre-computed card region
                    oy, ox, nh, nw = _card_bounds
                    resized_src = cv2.resize(src_frame, (nw, nh))
                    composited = overlay.copy()
                    composited[oy:oy + nh, ox:ox + nw] = resized_src
                else:
                    # Full-screen overlay — brightness-based alpha
                    if src_frame.shape[1] != render_width or src_frame.shape[0] != render_height:
                        src_frame = cv2.resize(src_frame, (render_width, render_height))
                    gray = cv2.cvtColor(overlay, cv2.COLOR_BGR2GRAY)
                    mask = (gray > 15).astype(np.float32)
                    mask = cv2.GaussianBlur(mask, (3, 3), 0)
                    mask = mask[:, :, np.newaxis]
                    composited = (src_frame * (1.0 - mask) + overlay * mask).astype(np.uint8)

                # Write composited frame back (as JPG to match existing format)
                cv2.imwrite(str(frame_path), composited)

            logger.info(f"  ✅ Composited {last_frame_num - first_frame_num + 1} frames")

        cap.release()

    def _upload(self, local_path: Path, s3_key: str) -> str:
        """Upload a file to S3 and return the public URL."""
        self._s3.upload_file(
            str(local_path),
            S3_BUCKET,
            s3_key,
            ExtraArgs={"ContentType": "video/mp4"},
        )
        return f"https://{S3_BUCKET}.s3.amazonaws.com/{s3_key}"
