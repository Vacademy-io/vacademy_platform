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
        on_progress: Optional[Callable[[float], None]] = None,
    ) -> dict:
        """
        Full transcription pipeline.

        Returns dict with keys: json_url, srt_url, vtt_url, txt_url,
        duration_seconds, detected_language, language_probability, segment_count, word_count.
        """
        import asyncio

        if output_formats is None:
            output_formats = ["json", "srt", "vtt", "txt"]

        def _progress(p: float):
            if on_progress:
                on_progress(min(p, 100))

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            self._transcribe_sync,
            job_id, source_url, language, model_size,
            word_timestamps, output_formats, _progress,
        )

    def _transcribe_sync(
        self,
        job_id: str,
        source_url: str,
        language: Optional[str],
        model_size: str,
        word_timestamps: bool,
        output_formats: list[str],
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

            # Get audio duration
            duration_seconds = self._get_duration(wav_path)
            logger.info(f"[{job_id}] Audio duration: {duration_seconds:.1f}s ({duration_seconds / 60:.1f} min)")

            # --- Stage 3: Transcribe with faster-whisper (20-85%) ---
            whisper_language = self._resolve_language(language)
            segments, info = self._run_whisper(
                wav_path, model_size, whisper_language, word_timestamps, on_progress, job_id,
            )
            on_progress(85)

            detected_language = info.language
            language_probability = round(info.language_probability, 3)
            logger.info(f"[{job_id}] Detected language: {detected_language} (p={language_probability})")

            # --- Stage 4: Build structured result (85-90%) ---
            transcript_data = self._build_transcript(
                segments, word_timestamps, detected_language, language_probability, duration_seconds,
            )
            on_progress(90)

            # --- Stage 5: Generate output formats & upload (90-100%) ---
            output_urls = {}

            if "json" in output_formats:
                json_path = work_dir / "transcript.json"
                json_path.write_text(json.dumps(transcript_data, ensure_ascii=False, indent=2))
                output_urls["json_url"] = self._upload(json_path, f"{s3_base}/transcript.json", "application/json")

            if "srt" in output_formats:
                srt_path = work_dir / "transcript.srt"
                srt_path.write_text(self._generate_srt(transcript_data["segments"]), encoding="utf-8")
                output_urls["srt_url"] = self._upload(srt_path, f"{s3_base}/transcript.srt", "text/plain")

            if "vtt" in output_formats:
                vtt_path = work_dir / "transcript.vtt"
                vtt_path.write_text(self._generate_vtt(transcript_data["segments"]), encoding="utf-8")
                output_urls["vtt_url"] = self._upload(vtt_path, f"{s3_base}/transcript.vtt", "text/plain")

            if "txt" in output_formats:
                txt_path = work_dir / "transcript.txt"
                txt_path.write_text(transcript_data["full_text"], encoding="utf-8")
                output_urls["txt_url"] = self._upload(txt_path, f"{s3_base}/transcript.txt", "text/plain")

            on_progress(100)

            return {
                **output_urls,
                "duration_seconds": round(duration_seconds, 2),
                "detected_language": detected_language,
                "language_probability": language_probability,
                "segment_count": len(transcript_data["segments"]),
                "word_count": transcript_data["word_count"],
            }

        finally:
            shutil.rmtree(work_dir, ignore_errors=True)

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

        if "s3.amazonaws.com" in url or "s3." in url:
            # Parse S3 URL
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

    def _run_whisper(
        self,
        wav_path: Path,
        model_size: str,
        language: Optional[str],
        word_timestamps: bool,
        on_progress: Callable[[float], None],
        job_id: str,
    ):
        """Run faster-whisper. Returns (segments_list, info)."""
        from faster_whisper import WhisperModel

        logger.info(f"[{job_id}] Loading faster-whisper model: {model_size} (int8, CPU)")
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
        logger.info(f"[{job_id}] Model loaded, starting transcription...")

        segments_iter, info = model.transcribe(
            str(wav_path),
            word_timestamps=word_timestamps,
            language=language,
            vad_filter=True,
            vad_parameters=dict(
                min_silence_duration_ms=500,
            ),
        )

        # Consume iterator with progress tracking
        # We estimate progress based on segment end times vs total duration
        duration = self._get_duration(wav_path)
        segments_list = []
        for seg in segments_iter:
            segments_list.append(seg)
            if duration > 0:
                pct = 20 + (seg.end / duration) * 65  # 20-85% range
                on_progress(min(pct, 85))

        logger.info(f"[{job_id}] Transcription complete: {len(segments_list)} segments")
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
        """Upload a file to S3 and return the public URL."""
        self._s3.upload_file(
            str(local_path),
            S3_BUCKET,
            s3_key,
            ExtraArgs={"ContentType": content_type},
        )
        return f"https://{S3_BUCKET}.s3.amazonaws.com/{s3_key}"
