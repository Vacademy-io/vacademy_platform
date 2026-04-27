"""
Sentence-clip orchestration.

Owns the end-to-end flow that produces `meta.sentences[]` for a video:

  1. Pull the video record's S3 URLs (audio, words, timeline, script).
  2. Download script.txt + words.json + timeline.json into a temp dir.
  3. Use sentence_clips.build_sentence_clips() to split the script, map
     it onto the word stream, and call the render worker to slice the
     global narration.mp3 into per-sentence clips on S3.
  4. Patch `meta.sentences[]` into the timeline JSON and re-upload to
     the same S3 key (so /urls/{video_id} keeps returning the same URL).

Two callers, one implementation:
  - VideoGenerationService — invokes after a successful HTML stage so
    every newly generated video gets sentences[] automatically.
  - external_video_generation.py /sentences/build endpoint — backfills
    older videos on demand.
"""
from __future__ import annotations

import json
import logging
import sys
import tempfile
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Result type
# ---------------------------------------------------------------------------

class SentenceBuildResult:
    """Outcome of a build_for_video call."""

    def __init__(
        self,
        video_id: str,
        sentences: List[Dict[str, Any]],
        timeline_url: str,
        skipped_reason: Optional[str] = None,
    ) -> None:
        self.video_id = video_id
        self.sentences = sentences
        self.timeline_url = timeline_url
        self.skipped_reason = skipped_reason

    @property
    def ok(self) -> bool:
        return self.skipped_reason is None

    @property
    def count(self) -> int:
        return len(self.sentences)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "video_id": self.video_id,
            "sentences": self.sentences,
            "timeline_url": self.timeline_url,
            "count": self.count,
            "skipped_reason": self.skipped_reason,
        }


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class SentenceClipService:
    """Stateless except for the dependencies passed in. Construct one per
    request — the underlying services (s3, render, repository) own all
    real state."""

    # Where per-sentence clips are uploaded. Mirrors the existing
    # `ai-videos/{video_id}/...` layout used by the rest of the pipeline.
    _CLIP_KEY_PREFIX_FMT = "ai-videos/{video_id}/sentences/"

    # Required S3 keys on the video record. Audio + words are mandatory
    # because we need them to map sentences to time. Script is needed to
    # know what the sentences ARE. Timeline is where we persist the result.
    _REQUIRED_S3_KEYS = ("audio", "words", "script", "timeline")

    def __init__(
        self,
        s3_service,
        render_service,
        repository,
        video_gen_root: Path,
    ) -> None:
        self.s3_service = s3_service
        self.render_service = render_service
        self.repository = repository
        self.video_gen_root = video_gen_root

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    def build_for_video(self, video_id: str) -> SentenceBuildResult:
        """Build per-sentence clips for `video_id` and persist them into
        its timeline JSON. Idempotent — re-running overwrites the previous
        sentences[] and re-uploads the per-sentence clips at the same keys.

        Returns a SentenceBuildResult. On gracefully-skipped paths (no
        audio, missing files) the result has an empty sentences list and
        a `skipped_reason`. Raises only on unexpected I/O / network errors.
        """
        record = self.repository.get_by_video_id(video_id)
        if record is None:
            raise ValueError(f"video {video_id} not found")

        s3_urls = dict(record.s3_urls or {})
        missing = [k for k in self._REQUIRED_S3_KEYS if not s3_urls.get(k)]
        if missing:
            return SentenceBuildResult(
                video_id=video_id,
                sentences=[],
                timeline_url=s3_urls.get("timeline", ""),
                skipped_reason=f"missing s3 urls: {missing}",
            )

        with tempfile.TemporaryDirectory(prefix=f"sent-{video_id}-") as tmpdir:
            tmp = Path(tmpdir)
            script_text = self._download_text(s3_urls["script"], tmp / "script.txt")
            words = self._download_json(s3_urls["words"], tmp / "words.json")
            timeline = self._download_json(s3_urls["timeline"], tmp / "timeline.json")

            if not isinstance(words, list):
                return SentenceBuildResult(
                    video_id=video_id, sentences=[], timeline_url=s3_urls["timeline"],
                    skipped_reason=f"words.json malformed (got {type(words).__name__})",
                )
            if not isinstance(timeline, dict):
                return SentenceBuildResult(
                    video_id=video_id, sentences=[], timeline_url=s3_urls["timeline"],
                    skipped_reason=f"timeline.json malformed (got {type(timeline).__name__})",
                )

            clips = self._build_clips(
                script_text=script_text,
                words=words,
                audio_url=s3_urls["audio"],
                video_id=video_id,
            )
            sentence_dicts = [c.to_dict() for c in clips]

            timeline_url = self._persist_sentences(
                timeline=timeline,
                sentences=sentence_dicts,
                timeline_s3_url=s3_urls["timeline"],
                video_id=video_id,
                tmp_path=tmp / "timeline.out.json",
            )

            return SentenceBuildResult(
                video_id=video_id,
                sentences=sentence_dicts,
                timeline_url=timeline_url,
            )

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _build_clips(
        self,
        *,
        script_text: str,
        words: List[Dict[str, Any]],
        audio_url: str,
        video_id: str,
    ) -> List[Any]:
        """Call into the sentence_clips module living under ai-video-gen-main.
        Path-injected import matches the existing pattern used by
        VideoGenerationService for automation_pipeline."""
        if str(self.video_gen_root) not in sys.path:
            sys.path.insert(0, str(self.video_gen_root))
        try:
            from sentence_clips import build_sentence_clips, SentenceMappingError
        except ImportError as exc:
            raise RuntimeError(f"Failed to import sentence_clips module: {exc}") from exc

        slice_fn: Callable = self._make_slice_fn()
        prefix = self._CLIP_KEY_PREFIX_FMT.format(video_id=video_id)

        try:
            return build_sentence_clips(
                script_text=script_text,
                words=words,
                audio_url=audio_url,
                output_prefix=prefix,
                slice_fn=slice_fn,
            )
        except SentenceMappingError as exc:
            # Surface as a regular error so the caller can decide; the
            # caller (route or pipeline hook) decides whether to abort
            # the request or skip silently.
            raise RuntimeError(f"sentence-to-word mapping failed: {exc}") from exc

    def _make_slice_fn(self) -> Callable[[str, List[Dict[str, Any]], str], List[Dict[str, Any]]]:
        """Adapter that turns our render-service client into the plain
        callable shape `build_sentence_clips()` expects. Keeps that module
        free of any ai_service imports for testability."""
        render = self.render_service

        def _slice(audio_url: str, cuts: List[Dict[str, Any]], output_prefix: str) -> List[Dict[str, Any]]:
            return render.slice_audio(
                audio_url=audio_url,
                cuts=cuts,
                output_prefix=output_prefix,
            )

        return _slice

    def _persist_sentences(
        self,
        *,
        timeline: Dict[str, Any],
        sentences: List[Dict[str, Any]],
        timeline_s3_url: str,
        video_id: str,
        tmp_path: Path,
    ) -> str:
        """Write sentences[] under timeline.meta.sentences and re-upload
        the timeline JSON to the same S3 key. Returns the (possibly
        unchanged) S3 URL."""
        meta = timeline.setdefault("meta", {})
        if not isinstance(meta, dict):
            raise RuntimeError(f"timeline.meta is not an object (got {type(meta).__name__})")
        meta["sentences"] = sentences

        tmp_path.write_text(json.dumps(timeline, ensure_ascii=False), encoding="utf-8")
        s3_key = self._extract_s3_key(timeline_s3_url) or f"ai-videos/{video_id}/timeline/time_based_frame.json"
        return self.s3_service.upload_file(
            file_path=tmp_path,
            s3_key=s3_key,
            content_type="application/json",
        )

    # ----- I/O helpers -----

    def _download_text(self, url: str, dest: Path) -> str:
        if not self.s3_service.download_file(url, dest):
            raise RuntimeError(f"failed to download {url}")
        return dest.read_text(encoding="utf-8")

    def _download_json(self, url: str, dest: Path) -> Any:
        if not self.s3_service.download_file(url, dest):
            raise RuntimeError(f"failed to download {url}")
        return json.loads(dest.read_text(encoding="utf-8"))

    @staticmethod
    def _extract_s3_key(s3_url: str) -> Optional[str]:
        """Pull the key out of a `https://{bucket}.s3.amazonaws.com/{key}` URL."""
        marker = ".s3.amazonaws.com/"
        idx = s3_url.find(marker)
        if idx == -1:
            return None
        return s3_url[idx + len(marker):]
