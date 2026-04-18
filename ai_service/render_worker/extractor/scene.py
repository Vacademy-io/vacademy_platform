"""
Scene boundary detection using PySceneDetect.
"""
from __future__ import annotations

import logging
from pathlib import Path

from .schemas import SceneBoundary

logger = logging.getLogger(__name__)


def detect_scenes(
    video_path: Path,
    threshold: float = 27.0,
) -> list[SceneBoundary]:
    """Detect scene cuts via PySceneDetect ContentDetector.

    Args:
        threshold: Higher = fewer cuts. 27 is the default. Use 30-35 for
                   talking-head podcasts to avoid false positives from
                   lighting/expression changes.

    Returns list of SceneBoundary(t, frame_num) at each detected cut.
    """
    from scenedetect import open_video, SceneManager
    from scenedetect.detectors import ContentDetector

    video = open_video(str(video_path))
    scene_manager = SceneManager()
    scene_manager.add_detector(ContentDetector(threshold=threshold))
    scene_manager.detect_scenes(video)

    scene_list = scene_manager.get_scene_list()
    boundaries: list[SceneBoundary] = []

    for i, (start, _end) in enumerate(scene_list):
        if i == 0:
            continue  # first scene starts at 0, not a "cut"
        boundaries.append(SceneBoundary(
            t=round(start.get_seconds(), 3),
            frame_num=start.get_frames(),
        ))

    logger.info(f"Scene detection: {len(boundaries)} cuts found (threshold={threshold})")
    return boundaries
