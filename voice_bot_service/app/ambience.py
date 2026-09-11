"""Continuous office room-tone under every call.

Two small pieces, both removable without touching anything else:

* ``build_ambience_mixer`` — a pipecat ``SoundfileMixer`` for the output
  transport (``FastAPIWebsocketParams(audio_out_mixer=...)``). The transport
  calls ``mixer.start(sample_rate)`` when it starts — on the StartFrame, before
  the greeting is queued — and from then on mixes the loop into BOTH the bot's
  audio and the silence it generates between turns (base_output's
  ``with_mixer`` path), so the call opens on room tone and never drops to
  digital silence. Interruptions do not stop it (base_output keeps the audio
  task alive when a mixer is attached).

* ``AmbienceDucker`` — sits just before ``transport.output()`` and lowers the
  mixer gain while the bot speaks (TTSStartedFrame → 0.6×) and restores it when
  it stops (TTSStoppedFrame / InterruptionFrame). Pure control frames; delete
  the processor from the pipeline and the ambience simply stays at one level.

The asset must be 8 kHz mono 16-bit PCM: pipecat's mixer refuses a file whose
rate differs from the transport's (it logs a warning and mixes nothing), and
it does NOT resample. Verified in tests/test_call_behavior.py.
"""
from __future__ import annotations

import logging
from pathlib import Path

from pipecat.frames.frames import (
    Frame,
    InterruptionFrame,
    MixerUpdateSettingsFrame,
    TTSStartedFrame,
    TTSStoppedFrame,
)
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor

logger = logging.getLogger("voice_bot")

# Relative to the PACKAGE, never the CWD: uvicorn runs from /srv in the image
# and from wherever a developer happens to be locally.
ASSETS_DIR = Path(__file__).resolve().parent.parent / "assets"
AMBIENCE_FILE = ASSETS_DIR / "call_center_ambience_8k_mono.wav"
AMBIENCE_SOUND = "office"
SPEAKING_GAIN = 0.6     # ambience × this while the bot is talking


def build_ambience_mixer(settings):
    """The per-call mixer, or None when disabled / unavailable.

    None is the safe answer in every failure mode (extra not installed, file
    missing): the transport then behaves exactly as before this feature."""
    if not settings.ambience_enabled:
        return None
    if not AMBIENCE_FILE.is_file():
        logger.warning("ambience: %s missing — no room tone this call", AMBIENCE_FILE)
        return None
    try:
        from pipecat.audio.mixers.soundfile_mixer import SoundfileMixer
    except Exception as e:  # ImportError when pipecat-ai[soundfile] is absent
        logger.warning("ambience: soundfile mixer unavailable (%s) — no room tone", e)
        return None
    volume = max(0.0, min(1.0, float(settings.ambience_volume)))
    return SoundfileMixer(
        sound_files={AMBIENCE_SOUND: str(AMBIENCE_FILE)},
        default_sound=AMBIENCE_SOUND,
        volume=volume,
        loop=True,
    )


class AmbienceDucker(FrameProcessor):
    """Duck the room tone under speech; restore it while listening.

    Keyed on the TTS lifecycle frames that flow to the transport, so it reacts
    to what is actually about to play. Emits only MixerUpdateSettingsFrames —
    the transport hands them to the mixer and ignores them when none is
    attached, so the processor is harmless with ambience off."""

    def __init__(self, base_volume: float, speaking_gain: float = SPEAKING_GAIN):
        super().__init__()
        self._base = max(0.0, min(1.0, float(base_volume)))
        self._speaking = round(self._base * speaking_gain, 4)
        self._ducked = False

    async def _set(self, volume: float, direction):
        await self.push_frame(MixerUpdateSettingsFrame(settings={"volume": volume}), direction)

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        if direction == FrameDirection.DOWNSTREAM and isinstance(frame, TTSStartedFrame):
            if not self._ducked:
                self._ducked = True
                await self._set(self._speaking, direction)   # before the audio
            await self.push_frame(frame, direction)
            return
        if direction == FrameDirection.DOWNSTREAM and isinstance(frame, (TTSStoppedFrame, InterruptionFrame)):
            await self.push_frame(frame, direction)          # after the audio
            if self._ducked:
                self._ducked = False
                await self._set(self._base, direction)
            return
        await self.push_frame(frame, direction)
