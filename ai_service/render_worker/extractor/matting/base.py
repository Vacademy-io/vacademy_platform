"""
Matter protocol — swappable CPU→GPU matting interface.

The pipeline receives a Matter instance via dependency injection. Swapping
from SelfieSegMatter (CPU) to RVMMatter (GPU) is a one-line change in the
factory without touching any pipeline code.
"""
from __future__ import annotations

from typing import Iterable, Iterator, Protocol, runtime_checkable

import numpy as np


@runtime_checkable
class Matter(Protocol):
    """Returns soft alpha mattes (H, W) float32 in [0,1], one per input frame."""

    def process(self, frames: Iterable[np.ndarray]) -> Iterator[np.ndarray]:
        """Takes BGR uint8 frames, yields float32 alpha mattes same HxW."""
        ...
