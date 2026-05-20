"""
Transcription Worker — Downloads audio/video from S3 or URL, runs
faster-whisper transcription, generates SRT/VTT/JSON, uploads to S3.

Designed for long recordings (1-2 hrs) on modest hardware (4 vCPU, 8GB RAM).
Supports English, Hindi, and code-mixed (Hinglish) via faster-whisper.
"""
from __future__ import annotations

import json
import logging
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Callable, Optional
from urllib.request import Request, urlopen

import boto3

logger = logging.getLogger("transcribe-worker")

# ---------------------------------------------------------------------------
# Config (reuses same env vars as render worker)
# ---------------------------------------------------------------------------

AWS_ACCESS_KEY = os.environ.get("S3_AWS_ACCESS_KEY") or os.environ.get("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_KEY = os.environ.get("S3_AWS_ACCESS_SECRET") or os.environ.get("AWS_SECRET_ACCESS_KEY", "")
AWS_REGION = os.environ.get("S3_AWS_REGION") or os.environ.get("AWS_REGION", "ap-south-1")
S3_BUCKET = os.environ.get("AWS_S3_PUBLIC_BUCKET", "vacademy-media-storage-public")

# Apple Silicon GPU acceleration: prefer mlx-whisper when available — it
# runs on the Mac's Metal GPU and is ~5-10× faster than faster-whisper CPU.
# Falls back automatically on non-arm64 hosts or if the package isn't
# installed. Disable explicitly with WHISPER_BACKEND=cpu.
def _detect_mlx_backend() -> bool:
    if os.environ.get("WHISPER_BACKEND", "auto").lower() == "cpu":
        return False
    import platform
    if platform.machine() not in ("arm64", "aarch64"):
        return False
    try:
        import mlx_whisper  # noqa: F401
        return True
    except ImportError:
        return False

USE_MLX_WHISPER = _detect_mlx_backend()

# Faster-whisper uses raw model names ("base"); MLX uses HuggingFace repo
# paths. This map covers the same five tiers admin-core requests.
MLX_REPO_MAP = {
    "tiny":   "mlx-community/whisper-tiny-mlx",
    "base":   "mlx-community/whisper-base-mlx",
    "small":  "mlx-community/whisper-small-mlx",
    "medium": "mlx-community/whisper-medium-mlx",
    "large":  "mlx-community/whisper-large-v3-turbo",
    "large-v3-turbo": "mlx-community/whisper-large-v3-turbo",
}

# Local-disk fallback for dev when AWS creds are absent. Files are written
# under LOCAL_TRANSCRIPT_DIR and served by the worker at LOCAL_PUBLIC_BASE
# (mounted in main.py as a static route at /transcripts).
LOCAL_TRANSCRIPT_DIR = os.environ.get("LOCAL_TRANSCRIPT_DIR", "/tmp/vacademy-transcripts")
LOCAL_PUBLIC_BASE = os.environ.get("LOCAL_TRANSCRIPT_PUBLIC_BASE", "http://localhost:8090/transcripts")

USE_LOCAL_STORAGE = not (AWS_ACCESS_KEY and AWS_SECRET_KEY)
if USE_LOCAL_STORAGE:
    logger.info(
        f"AWS credentials absent — transcripts will be written to {LOCAL_TRANSCRIPT_DIR} "
        f"and served from {LOCAL_PUBLIC_BASE}/<job_id>/..."
    )

# Limit concurrent model loads — only one model at a time
MAX_TRANSCRIBE_CONCURRENT = int(os.environ.get("MAX_TRANSCRIBE_CONCURRENT", "1"))


class TranscribeWorker:
    """Downloads source media, transcribes, generates output formats, uploads to S3."""

    def __init__(self):
        self._s3 = boto3.client(
            "s3",
            aws_access_key_id=AWS_ACCESS_KEY or None,
            aws_secret_access_key=AWS_SECRET_KEY or None,
            region_name=AWS_REGION,
        )

    async def transcribe(
        self,
        job_id: str,
        source_url: str,
        language: Optional[str] = None,
        model_size: str = "base",
        word_timestamps: bool = True,
        output_formats: Optional[list[str]] = None,
        task: str = "transcribe",
        on_progress: Optional[Callable[[float], None]] = None,
    ) -> dict:
        """
        Full transcription pipeline.

        task:
          - 'transcribe' (default): output is in the detected source language.
          - 'translate': output is always English (Whisper's built-in translate).
          - 'both': run the loaded model twice — source + English. Single decode.
        """
        import asyncio

        if output_formats is None:
            output_formats = ["json", "srt", "vtt", "txt"]

        if task not in ("transcribe", "translate", "both"):
            raise ValueError(f"task must be 'transcribe', 'translate', or 'both', got: {task}")

        def _progress(p: float):
            if on_progress:
                on_progress(min(p, 100))

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            self._transcribe_sync,
            job_id, source_url, language, model_size,
            word_timestamps, output_formats, task, _progress,
        )

    def _transcribe_sync(
        self,
        job_id: str,
        source_url: str,
        language: Optional[str],
        model_size: str,
        word_timestamps: bool,
        output_formats: list[str],
        task: str,
        on_progress: Callable[[float], None],
    ) -> dict:
        """Synchronous transcription pipeline (runs in thread pool)."""
        work_dir = Path(tempfile.mkdtemp(prefix=f"transcribe_{job_id}_"))
        s3_base = f"ai-transcriptions/{job_id}"

        try:
            # --- Stage 1: Download source (0-10%) ---
            on_progress(2)
            source_path = self._download(source_url, work_dir / "source_media")
            on_progress(10)
            logger.info(f"[{job_id}] Downloaded source: {source_path.name} ({source_path.stat().st_size / 1024 / 1024:.1f} MB)")

            # --- Stage 2: Extract audio as 16kHz mono WAV (10-20%) ---
            wav_path = work_dir / "audio.wav"
            self._demux_audio(source_path, wav_path)
            on_progress(20)

            duration_seconds = self._get_duration(wav_path)
            logger.info(f"[{job_id}] Audio duration: {duration_seconds:.1f}s ({duration_seconds / 60:.1f} min)")

            # --- Stage 3: Load Whisper once, then run the requested passes (20-90%) ---
            whisper_language = self._resolve_language(language)
            model = self._load_whisper_model(model_size, job_id)

            do_transcribe = task in ("transcribe", "both")
            do_translate = task in ("translate", "both")

            source_segments = source_info = None
            english_segments = english_info = None

            if task == "both":
                source_segments, source_info = self._run_whisper(
                    model, wav_path, whisper_language, word_timestamps,
                    task="transcribe", progress_range=(20, 55),
                    on_progress=on_progress, job_id=job_id,
                )
                if source_info.language == "en":
                    # Source is already English — skip the translate pass and
                    # reuse the source transcript as the English output. Halves
                    # wall time for English recordings.
                    logger.info(f"[{job_id}] Source is English; skipping translate pass")
                    english_segments, english_info = source_segments, source_info
                    on_progress(90)
                else:
                    english_segments, english_info = self._run_whisper(
                        model, wav_path, whisper_language, word_timestamps,
                        task="translate", progress_range=(55, 90),
                        on_progress=on_progress, job_id=job_id,
                    )
            elif task == "transcribe":
                source_segments, source_info = self._run_whisper(
                    model, wav_path, whisper_language, word_timestamps,
                    task="transcribe", progress_range=(20, 85),
                    on_progress=on_progress, job_id=job_id,
                )
            else:  # translate
                english_segments, english_info = self._run_whisper(
                    model, wav_path, whisper_language, word_timestamps,
                    task="translate", progress_range=(20, 85),
                    on_progress=on_progress, job_id=job_id,
                )

            on_progress(90)

            language_info = source_info or english_info
            detected_language = language_info.language
            language_probability = round(language_info.language_probability, 3)
            logger.info(f"[{job_id}] Detected language: {detected_language} (p={language_probability})")

            # --- Stage 4: Build + upload outputs per pass (90-100%) ---
            output_urls_source = None
            output_urls_english = None
            source_transcript = None
            english_transcript = None

            if do_transcribe:
                source_transcript = self._build_transcript(
                    source_segments, word_timestamps,
                    detected_language, language_probability, duration_seconds,
                )
                src_prefix = f"{s3_base}/source" if task == "both" else s3_base
                output_urls_source = self._write_and_upload_formats(
                    work_dir, source_transcript, output_formats, src_prefix, suffix="",
                )

            if do_translate:
                english_transcript = self._build_transcript(
                    english_segments, word_timestamps,
                    detected_language, language_probability, duration_seconds,
                )
                if task == "both":
                    output_urls_english = self._write_and_upload_formats(
                        work_dir, english_transcript, output_formats,
                        f"{s3_base}/english", suffix="",
                    )
                else:
                    output_urls_english = self._write_and_upload_formats(
                        work_dir, english_transcript, output_formats, s3_base, suffix=".en",
                    )

            on_progress(100)

            counts_transcript = source_transcript if do_transcribe else english_transcript
            legacy = output_urls_source if do_transcribe else output_urls_english

            return {
                **(legacy or {}),
                "output_urls_source": output_urls_source,
                "output_urls_english": output_urls_english,
                "duration_seconds": round(duration_seconds, 2),
                "detected_language": detected_language,
                "language_probability": language_probability,
                "segment_count": len(counts_transcript["segments"]),
                "word_count": counts_transcript["word_count"],
            }

        finally:
            shutil.rmtree(work_dir, ignore_errors=True)

    def _write_and_upload_formats(
        self,
        work_dir: Path,
        transcript_data: dict,
        output_formats: list[str],
        s3_prefix: str,
        suffix: str = "",
    ) -> dict:
        """Write the requested format files locally, upload to S3, return URL map.

        suffix is inserted before the extension: e.g. suffix='.en' → transcript.en.srt.
        """
        urls = {}

        if "json" in output_formats:
            p = work_dir / f"transcript{suffix}.json"
            p.write_text(json.dumps(transcript_data, ensure_ascii=False, indent=2))
            urls["json_url"] = self._upload(p, f"{s3_prefix}/transcript{suffix}.json", "application/json")

        if "srt" in output_formats:
            p = work_dir / f"transcript{suffix}.srt"
            p.write_text(self._generate_srt(transcript_data["segments"]), encoding="utf-8")
            urls["srt_url"] = self._upload(p, f"{s3_prefix}/transcript{suffix}.srt", "text/plain")

        if "vtt" in output_formats:
            p = work_dir / f"transcript{suffix}.vtt"
            p.write_text(self._generate_vtt(transcript_data["segments"]), encoding="utf-8")
            urls["vtt_url"] = self._upload(p, f"{s3_prefix}/transcript{suffix}.vtt", "text/plain")

        if "txt" in output_formats:
            p = work_dir / f"transcript{suffix}.txt"
            p.write_text(transcript_data["full_text"], encoding="utf-8")
            urls["txt_url"] = self._upload(p, f"{s3_prefix}/transcript{suffix}.txt", "text/plain")

        return urls

    # -----------------------------------------------------------------------
    # Download
    # -----------------------------------------------------------------------

    def _download(self, url: str, dest: Path) -> Path:
        """Download from S3 URL or public HTTP URL. Returns path with correct extension."""
        dest.parent.mkdir(parents=True, exist_ok=True)

        # Determine extension from URL
        clean_url = url.split("?")[0]
        ext = Path(clean_url).suffix or ".mp4"
        dest_with_ext = dest.with_suffix(ext)

        is_presigned = "X-Amz-Signature=" in url or "X-Amz-Algorithm=" in url
        if ("s3.amazonaws.com" in url or "s3." in url) and not is_presigned:
            bucket, key = self._parse_s3_url(url)
            self._s3.download_file(bucket, key, str(dest_with_ext))
        else:
            req = Request(url, headers={"User-Agent": "VacademyTranscribeWorker/1.0"})
            with urlopen(req, timeout=600) as resp, open(dest_with_ext, "wb") as f:
                while True:
                    chunk = resp.read(8192)
                    if not chunk:
                        break
                    f.write(chunk)

        return dest_with_ext

    def _parse_s3_url(self, url: str) -> tuple[str, str]:
        """Parse S3 URL into (bucket, key)."""
        url = url.split("?")[0]
        if ".s3.amazonaws.com/" in url:
            parts = url.split(".s3.amazonaws.com/", 1)
            bucket = parts[0].split("//")[-1]
            key = parts[1]
        elif "s3.amazonaws.com/" in url:
            path = url.split("s3.amazonaws.com/", 1)[1]
            bucket = path.split("/", 1)[0]
            key = path.split("/", 1)[1]
        else:
            # Assume bucket-style: https://bucket.s3.region.amazonaws.com/key
            parts = url.split("//")[-1].split("/", 1)
            bucket = parts[0].split(".s3")[0]
            key = parts[1] if len(parts) > 1 else ""
        return bucket, key

    # -----------------------------------------------------------------------
    # Audio extraction
    # -----------------------------------------------------------------------

    def _demux_audio(self, source_path: Path, wav_path: Path) -> None:
        """Extract audio as 16kHz mono WAV via ffmpeg."""
        wav_path.parent.mkdir(parents=True, exist_ok=True)
        cmd = [
            "ffmpeg", "-y", "-i", str(source_path),
            "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
            str(wav_path),
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        if result.returncode != 0:
            raise RuntimeError(f"ffmpeg demux failed: {result.stderr[:500]}")
        logger.info(f"Demuxed audio: {wav_path} ({wav_path.stat().st_size / 1024 / 1024:.1f} MB)")

    def _get_duration(self, wav_path: Path) -> float:
        """Get audio duration in seconds using ffprobe."""
        cmd = [
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", str(wav_path),
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            raise RuntimeError(f"ffprobe failed: {result.stderr[:300]}")
        return float(result.stdout.strip())

    # -----------------------------------------------------------------------
    # Language resolution
    # -----------------------------------------------------------------------

    def _resolve_language(self, language: Optional[str]) -> Optional[str]:
        """Convert user-friendly language string to Whisper language code."""
        if language is None or language == "auto":
            return None  # auto-detect
        lang_map = {
            "en": "en", "english": "en",
            "hi": "hi", "hindi": "hi",
            "hinglish": None,  # auto-detect works best for code-mixed
            "ta": "ta", "tamil": "ta",
            "te": "te", "telugu": "te",
            "bn": "bn", "bengali": "bn",
            "mr": "mr", "marathi": "mr",
            "gu": "gu", "gujarati": "gu",
            "kn": "kn", "kannada": "kn",
            "ml": "ml", "malayalam": "ml",
            "pa": "pa", "punjabi": "pa",
        }
        return lang_map.get(language.lower(), language.lower())

    # -----------------------------------------------------------------------
    # Whisper transcription
    # -----------------------------------------------------------------------

    def _load_whisper_model(self, model_size: str, job_id: str):
        """Return a model handle.

        For MLX: returns the HuggingFace repo path (a string). MLX downloads
        and loads the weights inside its own transcribe() on first use, so
        we don't pre-load here.

        For faster-whisper: instantiates and returns a WhisperModel. Loaded
        once per job, reused across the transcribe + translate passes.
        """
        if USE_MLX_WHISPER:
            repo = MLX_REPO_MAP.get(model_size, MLX_REPO_MAP["base"])
            logger.info(f"[{job_id}] Using mlx-whisper (Apple GPU): {repo}")
            return repo

        from faster_whisper import WhisperModel
        logger.info(f"[{job_id}] Loading faster-whisper model: {model_size} (int8, CPU)")
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
        logger.info(f"[{job_id}] Model loaded")
        return model

    def _run_whisper_mlx(
        self,
        repo: str,
        wav_path: Path,
        language: Optional[str],
        word_timestamps: bool,
        task: str,
        progress_range: tuple[float, float],
        on_progress: Callable[[float], None],
        job_id: str,
    ):
        """MLX inference path. Returns (segments_list, info) shaped like
        faster-whisper output so the rest of the pipeline is unchanged."""
        from types import SimpleNamespace
        import mlx_whisper

        logger.info(f"[{job_id}] MLX pass: task={task}")
        start_pct, end_pct = progress_range
        on_progress(start_pct)

        result = mlx_whisper.transcribe(
            str(wav_path),
            path_or_hf_repo=repo,
            word_timestamps=word_timestamps,
            language=language,
            task=task,
            verbose=None,
        )

        on_progress(end_pct)
        segments = []
        for s in result.get("segments", []):
            words = None
            if word_timestamps and s.get("words"):
                words = [
                    SimpleNamespace(
                        word=w.get("word", ""),
                        start=float(w.get("start", 0.0)),
                        end=float(w.get("end", 0.0)),
                    )
                    for w in s["words"]
                ]
            segments.append(SimpleNamespace(
                start=float(s.get("start", 0.0)),
                end=float(s.get("end", 0.0)),
                text=s.get("text", ""),
                words=words,
            ))
        # MLX doesn't expose language_probability; use a high placeholder.
        info = SimpleNamespace(
            language=result.get("language", language or "en"),
            language_probability=0.99,
        )
        logger.info(f"[{job_id}] MLX pass complete ({task}): {len(segments)} segments")
        return segments, info

    def _run_whisper(
        self,
        model,
        wav_path: Path,
        language: Optional[str],
        word_timestamps: bool,
        task: str,
        progress_range: tuple[float, float],
        on_progress: Callable[[float], None],
        job_id: str,
    ):
        """Run one pass on a pre-loaded model. Returns (segments_list, info).

        task: 'transcribe' (source language) or 'translate' (English).
        progress_range: (start_pct, end_pct) — segment end times are mapped
                        linearly into this window.
        """
        # MLX path: model is a HF repo path (string); delegate.
        if isinstance(model, str):
            return self._run_whisper_mlx(
                model, wav_path, language, word_timestamps, task,
                progress_range, on_progress, job_id,
            )

        logger.info(f"[{job_id}] Whisper pass: task={task}, progress={progress_range}")

        segments_iter, info = model.transcribe(
            str(wav_path),
            word_timestamps=word_timestamps,
            language=language,
            task=task,
            beam_size=1,
            condition_on_previous_text=False,
            vad_filter=True,
            vad_parameters=dict(
                min_silence_duration_ms=500,
            ),
        )

        duration = self._get_duration(wav_path)
        start_pct, end_pct = progress_range
        span = end_pct - start_pct
        segments_list = []
        for seg in segments_iter:
            segments_list.append(seg)
            if duration > 0:
                pct = start_pct + (seg.end / duration) * span
                on_progress(min(pct, end_pct))

        logger.info(f"[{job_id}] Whisper pass complete ({task}): {len(segments_list)} segments")
        return segments_list, info

    # -----------------------------------------------------------------------
    # Build structured transcript
    # -----------------------------------------------------------------------

    def _build_transcript(
        self,
        segments,
        word_timestamps: bool,
        detected_language: str,
        language_probability: float,
        duration_seconds: float,
    ) -> dict:
        """Build the structured transcript dict from Whisper segments."""
        result_segments = []
        all_words = []
        full_text_parts = []

        for i, seg in enumerate(segments):
            seg_data = {
                "id": i,
                "start": round(seg.start, 3),
                "end": round(seg.end, 3),
                "text": seg.text.strip(),
            }

            if word_timestamps and seg.words:
                seg_words = []
                for w in seg.words:
                    word_data = {
                        "word": w.word.strip(),
                        "start": round(w.start, 3),
                        "end": round(w.end, 3),
                    }
                    if hasattr(w, "probability"):
                        word_data["confidence"] = round(w.probability, 3)
                    seg_words.append(word_data)
                    all_words.append(word_data)
                seg_data["words"] = seg_words

            result_segments.append(seg_data)
            full_text_parts.append(seg.text.strip())

        full_text = " ".join(full_text_parts)

        return {
            "detected_language": detected_language,
            "language_probability": language_probability,
            "duration_seconds": round(duration_seconds, 2),
            "segment_count": len(result_segments),
            "word_count": len(all_words),
            "segments": result_segments,
            "full_text": full_text,
        }

    # -----------------------------------------------------------------------
    # SRT / VTT generation
    # -----------------------------------------------------------------------

    @staticmethod
    def _format_timestamp_srt(seconds: float) -> str:
        """Format seconds as SRT timestamp: HH:MM:SS,mmm"""
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        s = int(seconds % 60)
        ms = int((seconds % 1) * 1000)
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

    @staticmethod
    def _format_timestamp_vtt(seconds: float) -> str:
        """Format seconds as VTT timestamp: HH:MM:SS.mmm"""
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        s = int(seconds % 60)
        ms = int((seconds % 1) * 1000)
        return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"

    @classmethod
    def _generate_srt(cls, segments: list[dict]) -> str:
        """Generate SRT subtitle content from segments."""
        lines = []
        for i, seg in enumerate(segments, 1):
            start = cls._format_timestamp_srt(seg["start"])
            end = cls._format_timestamp_srt(seg["end"])
            lines.append(f"{i}")
            lines.append(f"{start} --> {end}")
            lines.append(seg["text"])
            lines.append("")
        return "\n".join(lines)

    @classmethod
    def _generate_vtt(cls, segments: list[dict]) -> str:
        """Generate WebVTT subtitle content from segments."""
        lines = ["WEBVTT", ""]
        for i, seg in enumerate(segments, 1):
            start = cls._format_timestamp_vtt(seg["start"])
            end = cls._format_timestamp_vtt(seg["end"])
            lines.append(f"{i}")
            lines.append(f"{start} --> {end}")
            lines.append(seg["text"])
            lines.append("")
        return "\n".join(lines)

    # -----------------------------------------------------------------------
    # S3 upload
    # -----------------------------------------------------------------------

    def _upload(self, local_path: Path, s3_key: str, content_type: str = "application/octet-stream") -> str:
        """Upload a file and return a fetchable URL.

        When AWS credentials are set, uploads to S3. Otherwise (dev mode),
        copies to LOCAL_TRANSCRIPT_DIR and returns a localhost URL served
        by the static route mounted in main.py.
        """
        if USE_LOCAL_STORAGE:
            import shutil
            target = Path(LOCAL_TRANSCRIPT_DIR) / s3_key
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(local_path, target)
            return f"{LOCAL_PUBLIC_BASE.rstrip('/')}/{s3_key}"

        self._s3.upload_file(
            str(local_path),
            S3_BUCKET,
            s3_key,
            ExtraArgs={"ContentType": content_type},
        )
        return f"https://{S3_BUCKET}.s3.amazonaws.com/{s3_key}"
