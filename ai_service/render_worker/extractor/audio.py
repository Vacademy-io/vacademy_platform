"""
Stage 1 audio layer: demux, transcribe, prosody analysis, emphasis detection.

Runs on the FULL video (not just the highlight window) because the transcript
is needed to select the highlight.
"""
from __future__ import annotations

import logging
import subprocess
import threading
from pathlib import Path
from typing import Optional

import numpy as np

from .schemas import EmphasisMark, ProsodySummary, Sentence, WordTimestamp

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# faster-whisper singleton (lazy, thread-safe)
# ---------------------------------------------------------------------------
_whisper_model = None
_whisper_lock = threading.Lock()


def _get_whisper_model(model_size: str = "base"):
    global _whisper_model
    if _whisper_model is None:
        with _whisper_lock:
            if _whisper_model is None:
                from faster_whisper import WhisperModel
                logger.info(f"Loading faster-whisper model: {model_size} (int8, CPU)")
                _whisper_model = WhisperModel(
                    model_size, device="cpu", compute_type="int8",
                )
                logger.info("faster-whisper model loaded")
    return _whisper_model


# ---------------------------------------------------------------------------
# Audio demux
# ---------------------------------------------------------------------------

def demux_audio(video_path: Path, output_wav: Path) -> None:
    """Extract audio as 16kHz mono WAV via ffmpeg."""
    output_wav.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg", "-y", "-i", str(video_path),
        "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
        str(output_wav),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg demux failed: {result.stderr[:500]}")
    logger.info(f"Demuxed audio: {output_wav} ({output_wav.stat().st_size / 1024:.0f} KB)")


# ---------------------------------------------------------------------------
# Transcription
# ---------------------------------------------------------------------------

def transcribe(
    wav_path: Path,
    model_size: str = "base",
    language: Optional[str] = None,
) -> tuple[list[Sentence], list[WordTimestamp]]:
    """Run faster-whisper on 16kHz mono WAV.

    Returns (sentences, flat_words).
    """
    model = _get_whisper_model(model_size)
    segments, info = model.transcribe(
        str(wav_path),
        word_timestamps=True,
        language=language,
        vad_filter=True,
    )
    logger.info(f"Whisper detected language: {info.language} (p={info.language_probability:.2f})")

    sentences: list[Sentence] = []
    all_words: list[WordTimestamp] = []

    for seg in segments:
        seg_words: list[WordTimestamp] = []
        for w in (seg.words or []):
            wt = WordTimestamp(word=w.word.strip(), start=round(w.start, 3), end=round(w.end, 3))
            seg_words.append(wt)
            all_words.append(wt)

        if seg_words:
            sentences.append(Sentence(
                text=seg.text.strip(),
                start=round(seg.start, 3),
                end=round(seg.end, 3),
                words=seg_words,
            ))

    logger.info(f"Transcribed: {len(sentences)} sentences, {len(all_words)} words")
    return sentences, all_words


# ---------------------------------------------------------------------------
# Prosody analysis
# ---------------------------------------------------------------------------

def analyze_prosody(
    wav_path: Path, hop_ms: int = 100,
) -> tuple[ProsodySummary, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Compute RMS energy, pitch, and detect pauses.

    Returns (summary, rms_times, rms_values, f0_times, f0_values).
    f0_values may contain NaN for unvoiced frames.
    """
    import librosa

    y, sr = librosa.load(str(wav_path), sr=16000)
    hop_length = int(sr * hop_ms / 1000)

    # RMS energy
    rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
    rms_times = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop_length)

    # Pitch via pyin (NaN where unvoiced)
    f0, voiced_flag, _ = librosa.pyin(
        y, fmin=librosa.note_to_hz("C2"), fmax=librosa.note_to_hz("C6"),
        sr=sr, hop_length=hop_length,
    )
    if f0 is None:
        f0 = np.array([])
    f0_times = librosa.frames_to_time(np.arange(len(f0)), sr=sr, hop_length=hop_length) if len(f0) > 0 else np.array([])
    f0_valid = f0[~np.isnan(f0)] if len(f0) > 0 else np.array([])

    mean_rms = float(np.mean(rms)) if len(rms) > 0 else 0.0
    peak_rms = float(np.max(rms)) if len(rms) > 0 else 0.0
    mean_pitch = float(np.mean(f0_valid)) if len(f0_valid) > 0 else 0.0

    # Pause detection: stretches where RMS < 0.1 * mean for > 0.4s
    threshold = mean_rms * 0.1
    pauses: list[dict] = []
    in_pause = False
    pause_start = 0.0
    for i, val in enumerate(rms):
        t = float(rms_times[i])
        if val < threshold:
            if not in_pause:
                in_pause = True
                pause_start = t
        else:
            if in_pause:
                dur = t - pause_start
                if dur >= 0.4:
                    pauses.append({"start": round(pause_start, 3), "end": round(t, 3),
                                   "duration_s": round(dur, 3)})
                in_pause = False
    # Handle trailing pause
    if in_pause:
        dur = float(rms_times[-1]) - pause_start
        if dur >= 0.4:
            pauses.append({"start": round(pause_start, 3), "end": round(float(rms_times[-1]), 3),
                           "duration_s": round(dur, 3)})

    summary = ProsodySummary(
        mean_rms=round(mean_rms, 6),
        peak_rms=round(peak_rms, 6),
        mean_pitch_hz=round(mean_pitch, 2),
        pause_count=len(pauses),
        pauses=pauses,
    )
    logger.info(f"Prosody: mean_rms={mean_rms:.4f}, pauses={len(pauses)}, pitch={mean_pitch:.0f}Hz")
    return summary, rms_times, rms, f0_times, f0


# ---------------------------------------------------------------------------
# Emphasis detection
# ---------------------------------------------------------------------------

def detect_emphasis(
    words: list[WordTimestamp],
    rms_times: np.ndarray,
    rms_values: np.ndarray,
    prosody: ProsodySummary,
    rms_factor: float = 1.5,
    pause_threshold_s: float = 0.8,
) -> list[EmphasisMark]:
    """Heuristic emphasis detection based on prosody signals.

    Reasons:
      - energy_spike: word coincides with RMS > mean * rms_factor
      - long_pause_before: pause > threshold_s immediately before the word
    """
    if len(rms_values) == 0 or not words:
        return []

    mean_rms = float(np.mean(rms_values))
    marks: list[EmphasisMark] = []
    seen_times: set[float] = set()

    for w in words:
        t = w.start
        if t in seen_times:
            continue

        # Energy spike check
        idx = np.searchsorted(rms_times, t)
        idx = min(idx, len(rms_values) - 1)
        if rms_values[idx] > mean_rms * rms_factor:
            marks.append(EmphasisMark(t=round(t, 3), word=w.word, reason="energy_spike"))
            seen_times.add(t)
            continue

        # Long pause before
        for p in prosody.pauses:
            if abs(p["end"] - t) < 0.3 and p["duration_s"] >= pause_threshold_s:
                marks.append(EmphasisMark(t=round(t, 3), word=w.word, reason="long_pause_before"))
                seen_times.add(t)
                break

    marks.sort(key=lambda m: m.t)
    logger.info(f"Emphasis: {len(marks)} marks detected")
    return marks


# ---------------------------------------------------------------------------
# Per-sentence prosody enrichment
# ---------------------------------------------------------------------------

def assign_sentence_prosody(
    sentences: list[Sentence],
    rms_times: np.ndarray,
    rms_values: np.ndarray,
    f0_times: np.ndarray,
    f0_values: np.ndarray,
) -> None:
    """Populate energy_mean, pitch_mean_hz, pitch_std_hz, speech_rate_wps on each sentence.

    Mutates the sentences list in-place. Future engagement-detection pipelines
    can use these signals to score per-sentence "interestingness" without
    re-running audio analysis.
    """
    for sent in sentences:
        # Energy (RMS) within sentence span
        if len(rms_times) > 0:
            mask = (rms_times >= sent.start) & (rms_times <= sent.end)
            if mask.any():
                sent.energy_mean = round(float(np.mean(rms_values[mask])), 6)

        # Pitch within sentence span (skip NaN unvoiced frames)
        if len(f0_times) > 0 and len(f0_values) > 0:
            pmask = (f0_times >= sent.start) & (f0_times <= sent.end)
            if pmask.any():
                seg = f0_values[pmask]
                seg_valid = seg[~np.isnan(seg)]
                if len(seg_valid) > 0:
                    sent.pitch_mean_hz = round(float(np.mean(seg_valid)), 2)
                    sent.pitch_std_hz = round(float(np.std(seg_valid)), 2)

        # Speech rate (words per second)
        dur = sent.end - sent.start
        if dur > 0 and sent.words:
            sent.speech_rate_wps = round(len(sent.words) / dur, 3)


def downsample_series(
    times: np.ndarray, values: np.ndarray, hop_s: float = 1.0,
) -> list[dict]:
    """Bucket a per-frame series into hop_s-wide bins, return [{t, v}].

    NaN values are skipped within each bucket; a bucket with no valid samples
    contributes an entry with v=None so the index stays time-aligned.
    """
    if len(times) == 0 or len(values) == 0:
        return []
    out: list[dict] = []
    t_max = float(times[-1])
    n_buckets = int(t_max / hop_s) + 1
    for i in range(n_buckets):
        lo = i * hop_s
        hi = lo + hop_s
        mask = (times >= lo) & (times < hi)
        if not mask.any():
            out.append({"t": round(lo, 3), "v": None})
            continue
        seg = values[mask]
        seg_valid = seg[~np.isnan(seg)] if seg.dtype.kind == "f" else seg
        if len(seg_valid) == 0:
            out.append({"t": round(lo, 3), "v": None})
        else:
            out.append({"t": round(lo, 3), "v": round(float(np.mean(seg_valid)), 6)})
    return out
