"""
MediaPipe SelfieSegmentation — CPU default matting backend.

Post-processing (in order):
  1. Temporal smoothing: EMA with alpha_smooth=0.6
  2. Edge feather: 1-2px Gaussian blur on alpha
  3. Do NOT threshold — keep soft alpha for clean compositing edges
"""
from __future__ import annotations

from typing import Iterable, Iterator

import cv2
import numpy as np


class SelfieSegMatter:
    """CPU matting via MediaPipe SelfieSegmentation.

    model_selection=1 → landscape model (better quality, slightly slower).
    """

    def __init__(self, alpha_smooth: float = 0.6, feather_px: int = 2):
        self._alpha_smooth = alpha_smooth
        self._feather_px = feather_px

    def process(self, frames: Iterable[np.ndarray]) -> Iterator[np.ndarray]:
        """Yields float32 alpha mattes [0,1], temporally smoothed."""
        import mediapipe as mp

        seg = mp.solutions.selfie_segmentation.SelfieSegmentation(model_selection=1)
        prev_alpha: np.ndarray | None = None

        try:
            for frame in frames:
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                result = seg.process(rgb)
                raw_alpha = result.segmentation_mask  # float32 [0,1], HxW

                # Temporal EMA smoothing
                if prev_alpha is not None:
                    alpha = self._alpha_smooth * raw_alpha + (1.0 - self._alpha_smooth) * prev_alpha
                else:
                    alpha = raw_alpha.copy()
                prev_alpha = alpha.copy()

                # Edge feather
                if self._feather_px > 0:
                    k = self._feather_px * 2 + 1
                    alpha = cv2.GaussianBlur(alpha, (k, k), 0)

                yield alpha
        finally:
            seg.close()
