"""Caller gender, shadow mode (app/caller_gender.py, 2026-10-01)."""
import numpy as np
import pytest

from app.caller_gender import PitchTracker, gender_from_words, summarize, yin_f0

SR = 8000


def _voice(f0: float, secs: float = 2.5, sr: int = SR, jitter: float = 0.02) -> np.ndarray:
    """A voiced-speech-like signal: harmonics of a slowly wandering F0 with a
    falling spectrum, then the telephone band (no energy below 300 Hz — the
    fundamental itself is gone, as on a real phone line)."""
    t = np.arange(int(secs * sr)) / sr
    f = f0 * (1 + jitter * np.sin(2 * np.pi * 0.7 * t))
    phase = 2 * np.pi * np.cumsum(f) / sr
    x = sum((1.0 / k) * np.sin(k * phase) for k in range(1, 20))
    X = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(len(x), 1 / sr)
    X[(freqs < 300) | (freqs > 3400)] = 0
    y = np.fft.irfft(X, n=len(x))
    return (y / np.max(np.abs(y)) * 12000).astype(np.int16)


def _track(pcm: np.ndarray) -> dict:
    t = PitchTracker()
    for i in range(0, len(pcm), 160):                 # 20 ms chunks, like the transport
        t.add(pcm[i:i + 160].tobytes(), SR)
    return t.estimate()


@pytest.mark.parametrize("f0,want", [(105, "m"), (125, "m"), (210, "f"), (235, "f")])
def test_pitch_separates_typical_male_and_female_voices_through_the_phone_band(f0, want):
    e = _track(_voice(f0))
    assert e["gender"] == want, e
    assert e["confidence"] >= 0.6, e
    assert abs(e["medianHz"] - f0) < 0.08 * f0, e


def test_a_voice_in_the_overlap_band_is_unsure_not_guessed():
    e = _track(_voice(165))
    assert e["gender"] == "unsure" and e["confidence"] == 0.0, e


def test_silence_and_noise_give_no_decision():
    assert _track(np.zeros(SR * 3, dtype=np.int16))["gender"] is None
    rng = np.random.default_rng(0)
    noise = (rng.standard_normal(SR * 3) * 2000).astype(np.int16)
    e = _track(noise)
    assert e["gender"] in (None, "unsure") or e["confidence"] < 0.6, e


def test_too_little_speech_gives_no_decision():
    assert _track(_voice(120, secs=0.6))["gender"] is None


def test_yin_on_one_window():
    w = _voice(200, secs=0.04).astype(np.float32)
    f0 = yin_f0(w - w.mean(), SR)
    assert f0 is not None and abs(f0 - 200) < 12


def test_words_mark_the_speakers_gender():
    assert gender_from_words(["मैं बच्चे का पिता बोल रहा हूँ बोलिए।"])[0] == "m"
    assert gender_from_words(["मैं उसकी बुआ जी बोल रही हूँ।"])[0] == "f"
    assert gender_from_words(["मैं उसकी मम्मी हूँ"])[0] == "f"
    assert gender_from_words(["I am his father."])[0] == "m"
    for t in ("हाँ जी बताइए।", "वो पढ़ रहा था", "उसके पापा बाहर गए हैं", "आप क्या बोल रहे हो"):
        assert gender_from_words([t])[0] is None, t
    # Cues both ways (two people on the line / an STT slip): no verdict.
    assert gender_from_words(["मैं उसका पिता बोल रहा हूँ", "मैं बता रही हूँ"])[0] is None


def test_summary_marks_agreement():
    s = summarize({"gender": "f", "confidence": 0.9, "medianHz": 214.0, "voicedSecs": 3.0},
                  ["मैं उसकी मम्मी हूँ"])
    assert s["words"] == "f" and s["agree"] is True
    s = summarize({"gender": "m", "confidence": 0.9}, ["मैं उसकी मम्मी हूँ"])
    assert s["agree"] is False
    s = summarize({"gender": "unsure", "confidence": 0.0}, ["मैं उसकी मम्मी हूँ"])
    assert s["agree"] is None


@pytest.mark.asyncio
async def test_the_probe_passes_audio_through_and_ignores_it_while_the_bot_talks():
    from pipecat.frames.frames import InputAudioRawFrame
    from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
    from app.caller_gender import make_probe

    async def _noop(self, frame, direction):
        return None
    talking = {"v": True}
    probe = make_probe(lambda: talking["v"], echo_tail_secs=0.0)
    pushed = []

    async def push(frame, direction=FrameDirection.DOWNSTREAM):
        pushed.append(frame)
    probe.push_frame = push
    orig = FrameProcessor.process_frame
    FrameProcessor.process_frame = _noop
    try:
        pcm = _voice(120)
        for i in range(0, len(pcm), 160):
            await probe.process_frame(InputAudioRawFrame(audio=pcm[i:i + 160].tobytes(),
                                                         sample_rate=SR, num_channels=1),
                                      FrameDirection.DOWNSTREAM)
        assert len(pushed) == len(range(0, len(pcm), 160)), "a frame was not passed through"
        assert probe.tracker.voiced_secs == 0, "it listened while the bot was talking"
        talking["v"] = False
        for i in range(0, len(pcm), 160):
            await probe.process_frame(InputAudioRawFrame(audio=pcm[i:i + 160].tobytes(),
                                                         sample_rate=SR, num_channels=1),
                                      FrameDirection.DOWNSTREAM)
        assert probe.tracker.estimate()["gender"] == "m"
    finally:
        FrameProcessor.process_frame = orig
