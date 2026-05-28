"""
Single-sentence TTS + word alignment.

Used by the editor's "re-narrate this sentence" flow. Produces:
  - one MP3 file at the requested output path
  - the per-word timestamps for that MP3 (for caption sync inside the
    editor and inside the player when this clip plays back)

Implementation is a thin wrapper around the existing pipeline TTS code:
we instantiate VideoGenerationPipeline minimally and call its
`_synthesize_voice` method on a temp script file with just the sentence.

The full pipeline class is heavyweight, but constructing it is cheap
(~one second; mostly Pexels/Pixabay client init that we don't use). It's
the cleanest way to keep one TTS code path across new-video generation
and per-sentence re-narration — extracting `_synthesize_voice` into a
standalone function would be a 300-line refactor across all providers
(Edge, Google, Sarvam) plus the voice-mapping table.

Whisper alignment uses the module-level `_whisper_align` already used by
the main pipeline.
"""
from __future__ import annotations

import logging
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Public types
# ---------------------------------------------------------------------------

@dataclass
class VoiceConfig:
    """All knobs needed to reproduce a video's TTS voice. Read off the
    video record's metadata; missing values fall back to standard defaults."""
    language: str = "English"
    voice_gender: str = "female"
    tts_provider: str = "standard"
    voice_id: Optional[str] = None

    @classmethod
    def from_metadata(cls, language: Optional[str], metadata: Optional[Dict[str, Any]]) -> "VoiceConfig":
        meta = metadata or {}
        return cls(
            language=language or "English",
            voice_gender=meta.get("voice_gender") or "female",
            tts_provider=meta.get("tts_provider") or "standard",
            voice_id=meta.get("voice_id"),
        )


@dataclass
class TtsResult:
    audio_path: Path
    duration: float
    words: List[Dict[str, Any]]   # [{"word": str, "start": float, "end": float}]
    # The provider/voice synthesis ACTUALLY used (after any silent fallback,
    # e.g. premium Sarvam → Edge). Lets callers detect a voice downgrade and
    # refuse to bake a mismatched voice. None when the pipeline didn't report it.
    resolved_provider: Optional[str] = None
    resolved_voice_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def synthesize_one_sentence(
    *,
    text: str,
    output_path: Path,
    voice: VoiceConfig,
    openrouter_key: str,
    align_words: bool = True,
) -> TtsResult:
    """Synthesize `text` to `output_path` using the requested voice and
    return its duration plus per-word timestamps.

    `openrouter_key` is required only because VideoGenerationPipeline.__init__
    refuses to construct without it. It's never actually used for TTS.
    """
    if not text.strip():
        raise ValueError("text is empty")
    output_path = Path(output_path)

    pipeline = _construct_pipeline_for_tts(openrouter_key)

    with tempfile.TemporaryDirectory(prefix="sent-tts-") as tmpdir:
        run_dir = Path(tmpdir)
        script_path = run_dir / "script.txt"
        script_path.write_text(text.strip(), encoding="utf-8")

        result = pipeline._synthesize_voice(  # noqa: SLF001 — intentional reuse
            script_path=script_path,
            run_dir=run_dir,
            language=voice.language,
            voice_gender=voice.voice_gender,
            tts_provider=voice.tts_provider,
            voice_id=voice.voice_id,
        )
        produced_audio = Path(result["audio_path"])
        if not produced_audio.exists():
            raise RuntimeError(f"TTS produced no audio file at {produced_audio}")

        # Move the produced MP3 into the caller's output_path (cross-device
        # safe — copy + delete rather than rename).
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(produced_audio.read_bytes())

        words: List[Dict[str, Any]] = []
        if align_words:
            try:
                words = _align_words(output_path, voice.language)
            except Exception as exc:
                # Word alignment is nice-to-have; the regenerated sentence
                # still works without it (captions degrade for that sentence).
                logger.warning("Word alignment failed for regenerated sentence: %s", exc)
                words = []

        duration = _probe_duration(output_path)
        return TtsResult(
            audio_path=output_path,
            duration=duration,
            words=words,
            # `_synthesize_voice` stamps the concrete provider/voice it used
            # (incl. a silent premium→edge fallback) onto the result dict.
            resolved_provider=result.get("resolved_provider"),
            resolved_voice_id=result.get("resolved_voice_id"),
        )


# ---------------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------------

def _construct_pipeline_for_tts(openrouter_key: str):
    """Build a VideoGenerationPipeline instance only for its TTS surface.
    Pexels/Pixabay/etc. init are skipped by passing empty key strings —
    they fail-soft and don't impact TTS. Caller is responsible for sys.path
    being set so `automation_pipeline` resolves."""
    try:
        from automation_pipeline import VideoGenerationPipeline
    except ImportError as exc:
        raise RuntimeError(f"automation_pipeline not importable: {exc}") from exc

    return VideoGenerationPipeline(
        openrouter_key=openrouter_key,
        pexels_api_keys="",
        pixabay_api_keys="",
    )


def _align_words(audio_path: Path, language: str) -> List[Dict[str, Any]]:
    try:
        from automation_pipeline import _whisper_align  # noqa: SLF001
    except ImportError as exc:
        raise RuntimeError(f"_whisper_align not importable: {exc}") from exc
    return _whisper_align(audio_path, language)


def _probe_duration(audio_path: Path) -> float:
    """ffprobe the audio file. We don't have ffmpeg on ai_service in all
    environments, so this falls back to a very loose decode-and-count via
    pydub if ffprobe isn't available. Returns 0.0 if everything fails — the
    caller can recover the duration from the splice response in that case."""
    import shutil
    import subprocess
    if shutil.which("ffprobe"):
        try:
            out = subprocess.check_output(
                ["ffprobe", "-v", "error", "-show_entries", "format=duration",
                 "-of", "default=noprint_wrappers=1:nokey=1", str(audio_path)],
                timeout=15,
            )
            return float(out.strip())
        except Exception as exc:
            logger.warning("ffprobe failed: %s", exc)
    # Pydub fallback (pure-Python MP3 frame parsing). Optional dep.
    try:
        from pydub.utils import mediainfo  # type: ignore
        info = mediainfo(str(audio_path))
        return float(info.get("duration", 0.0) or 0.0)
    except Exception:
        return 0.0
