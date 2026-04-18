"""
RobustVideoMatting — GPU stub placeholder.

Drop-in replacement for SelfieSegMatter when GPU is available.
Temporal consistency is built into RVM, so skip post-smoothing.
"""
from __future__ import annotations

from typing import Iterable, Iterator

import numpy as np


class RVMMatter:
    """GPU-accelerated Robust Video Matting. Not implemented yet."""

    def process(self, frames: Iterable[np.ndarray]) -> Iterator[np.ndarray]:
        raise NotImplementedError(
            "RVM requires GPU. Use SelfieSegMatter for CPU-only environments."
        )
