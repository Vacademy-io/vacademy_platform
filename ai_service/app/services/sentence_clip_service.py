"""
Sentence-clip orchestration.

Two top-level operations live here, sharing the same dependencies and
timeline-IO helpers so they stay in sync:

  build_for_video(video_id)
    Slice an existing global narration.mp3 along sentence boundaries and
    persist meta.sentences[] into the timeline JSON. Used by the pipeline
    post-HTML hook (auto for new videos) and by /sentences/build (backfill
    for old videos). No TTS — the existing audio is bit-preserved.

  regenerate_sentence(video_id, sentence_id, new_text, voice_overrides)
    The editor's "re-narrate this sentence" flow:
      1. TTS the new text in the same voice → fresh per-sentence MP3.
      2. Splice it into the global narration.mp3 (crossfaded) on the
         render worker, replacing the old sentence's time range.
      3. Ripple every later sentence and entry by the duration delta so
         downstream playback stays in sync with audio.
      4. Patch the timeline JSON, upload a new global MP3, point the
         video record's audio URL at it.

The two operations could live in separate classes, but they share enough
dependencies (s3, render, repo, timeline I/O, video_gen import path) that
keeping them in one focused class avoids gratuitous duplication.
"""
from __future__ import annotations

import json
import logging
import sys
import tempfile
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

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


class SentenceRegenerateResult:
    """Outcome of a regenerate_sentence call.

    `duration_delta` is what callers ripple downstream timestamps by — it's
    already been applied to the persisted timeline here, but the editor
    also uses it to update its in-memory entry list immediately rather
    than waiting for a refetch.
    """

    def __init__(
        self,
        video_id: str,
        sentence: Dict[str, Any],
        duration_delta: float,
        new_global_audio_url: str,
        new_global_duration: float,
        timeline_url: str,
    ) -> None:
        self.video_id = video_id
        self.sentence = sentence
        self.duration_delta = duration_delta
        self.new_global_audio_url = new_global_audio_url
        self.new_global_duration = new_global_duration
        self.timeline_url = timeline_url

    def to_dict(self) -> Dict[str, Any]:
        return {
            "video_id": self.video_id,
            "sentence": self.sentence,
            "duration_delta": self.duration_delta,
            "new_global_audio_url": self.new_global_audio_url,
            "new_global_duration": self.new_global_duration,
            "timeline_url": self.timeline_url,
        }


class ShotRegenerateResult:
    """Outcome of a regenerate_shot call.

    Mirrors `SentenceRegenerateResult` — shot-shaped instead of sentence-shaped.
    `shot` carries the updated `meta.shots[]` entry (id, text, audio_url,
    audio_words_url, audio_duration_s, start_time, duration, words).
    `duration_delta` is what the editor ripples downstream shots' start_time by;
    we've already applied it to the persisted timeline here.
    """

    def __init__(
        self,
        video_id: str,
        shot: Dict[str, Any],
        duration_delta: float,
        new_global_audio_url: str,
        new_global_duration: float,
        timeline_url: str,
    ) -> None:
        self.video_id = video_id
        self.shot = shot
        self.duration_delta = duration_delta
        self.new_global_audio_url = new_global_audio_url
        self.new_global_duration = new_global_duration
        self.timeline_url = timeline_url

    def to_dict(self) -> Dict[str, Any]:
        return {
            "video_id": self.video_id,
            "shot": self.shot,
            "duration_delta": self.duration_delta,
            "new_global_audio_url": self.new_global_audio_url,
            "new_global_duration": self.new_global_duration,
            "timeline_url": self.timeline_url,
        }


class ShotInsertResult:
    """Outcome of an insert_shot call.

    Inserting a shot into a gap is duration-neutral — no audio splice,
    no ripple, no global URL change. So the response shape is just the
    new entry plus the new timeline URL.
    """

    def __init__(
        self,
        video_id: str,
        entry: Dict[str, Any],
        timeline_url: str,
    ) -> None:
        self.video_id = video_id
        self.entry = entry
        self.timeline_url = timeline_url

    def to_dict(self) -> Dict[str, Any]:
        return {
            "video_id": self.video_id,
            "entry": self.entry,
            "timeline_url": self.timeline_url,
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

    def regenerate_sentence(
        self,
        video_id: str,
        sentence_id: str,
        new_text: str,
        *,
        voice_overrides: Optional[Dict[str, Any]] = None,
        crossfade_ms: int = 50,
        head_pad_ms: int = 40,
    ) -> SentenceRegenerateResult:
        """Re-narrate one sentence: TTS the new text in the same voice,
        splice the resulting clip into the global narration.mp3 with
        crossfading on both joins, ripple downstream timestamps by the
        duration delta, and persist the patched timeline.

        Voice configuration: read from the video record's metadata; per-
        request `voice_overrides` win when present (keys: `language`,
        `voice_gender`, `tts_provider`, `voice_id`).

        Raises ValueError when the video / sentence isn't found, or when
        meta.sentences[] hasn't been built yet (caller should run
        /sentences/build first). All other failures (TTS, splice, S3)
        bubble up as RuntimeError.
        """
        new_text = (new_text or "").strip()
        if not new_text:
            raise ValueError("new_text is required")

        record = self.repository.get_by_video_id(video_id)
        if record is None:
            raise ValueError(f"video {video_id} not found")
        s3_urls = dict(record.s3_urls or {})
        if not s3_urls.get("audio") or not s3_urls.get("timeline"):
            raise ValueError(
                "video is missing audio/timeline S3 URLs; cannot regenerate"
            )

        with tempfile.TemporaryDirectory(prefix=f"regen-{video_id}-") as tmpdir:
            tmp = Path(tmpdir)

            timeline = self._download_json(s3_urls["timeline"], tmp / "timeline.json")
            sentences = self._extract_sentences(timeline)
            if not sentences:
                raise ValueError(
                    "this video has no meta.sentences[] yet — call "
                    "/sentences/build first to bootstrap them"
                )
            idx, target = _find_sentence_by_id(sentences, sentence_id)
            if target is None:
                raise ValueError(f"sentence {sentence_id!r} not in timeline")

            old_start = float(target.get("start_time") or 0.0)
            old_duration = float(target.get("duration") or 0.0)
            old_end = old_start + old_duration

            # 1. TTS the new text → local MP3 + word timestamps.
            voice = self._resolve_voice(record, voice_overrides)
            tts_result = self._synthesize_sentence(
                text=new_text, output_path=tmp / "new_clip.mp3", voice=voice,
            )

            # 2. Upload the new per-sentence clip. Versioned key (timestamp
            # suffix) so old/cached URLs keep working until the timeline
            # JSON is refetched by clients.
            version_tag = _version_tag()
            clip_key = self._versioned_clip_key(video_id, sentence_id, version_tag)
            new_clip_url = self.s3_service.upload_file(
                file_path=tts_result.audio_path,
                s3_key=clip_key,
                content_type="audio/mpeg",
            )

            # 3. Splice into the global MP3 (render worker does ffmpeg +
            # crossfade). Output to a versioned key for the same cache
            # reason — we'll point the video record at this new URL.
            new_audio_key = self._versioned_audio_key(video_id, version_tag)
            splice = self.render_service.splice_audio(
                base_audio_url=s3_urls["audio"],
                new_clip_url=new_clip_url,
                replace_start=old_start,
                replace_end=old_end,
                output_key=new_audio_key,
                crossfade_ms=crossfade_ms,
                head_pad_ms=head_pad_ms,
            )
            new_global_url = splice.get("output_url")
            new_global_duration = float(splice.get("new_duration") or 0.0)
            duration_delta = float(splice.get("duration_delta") or 0.0)
            if not new_global_url:
                raise RuntimeError(f"splice_audio returned no output_url: {splice}")

            # 4. Mutate the timeline:
            #    - patch the target sentence in place
            #    - ripple every later sentence by delta
            #    - ripple every entry whose time range starts at/after the
            #      replacement window by delta
            #    - bump meta.total_duration if present
            updated_target = self._patch_sentence(
                target=target,
                new_text=new_text,
                new_clip_url=new_clip_url,
                tts_result=tts_result,
            )
            _ripple_sentences(sentences, after_idx=idx, delta=duration_delta)
            _ripple_entries(timeline, boundary=old_start, delta=duration_delta)
            _bump_total_duration(timeline, delta=duration_delta)

            # 5. Splice the global narration.words.json so caption playback
            # stays in sync with the new audio. Best-effort: if the words
            # file isn't reachable or is malformed we log and continue —
            # the sentence still plays, only captions for downstream words
            # would drift, which is recoverable later via a manual rebuild.
            words_url = s3_urls.get("words")
            if words_url:
                try:
                    self._splice_global_words(
                        words_s3_url=words_url,
                        old_start=old_start,
                        old_end=old_end,
                        new_sentence_words=updated_target.get("words") or [],
                        sentence_start_time=float(updated_target.get("start_time") or old_start),
                        duration_delta=duration_delta,
                        tmp_path=tmp / "words.out.json",
                    )
                except Exception as exc:
                    logger.warning(
                        "Failed to splice global words.json for %s: %s — captions "
                        "after %.2fs may drift until the file is rebuilt",
                        video_id, exc, old_start,
                    )

            # 6. Persist: timeline JSON back to its S3 key, video record's
            # audio URL pointed at the new spliced MP3.
            timeline_url = self._upload_timeline_json(
                timeline=timeline,
                timeline_s3_url=s3_urls["timeline"],
                video_id=video_id,
                tmp_path=tmp / "timeline.out.json",
            )
            try:
                self.repository.update_files(
                    video_id=video_id, s3_urls={"audio": new_global_url},
                )
            except AttributeError:
                # Older repository APIs may not have update_files; the
                # spliced URL is still in the timeline so playback works,
                # but next time someone reads s3_urls.audio they'll get
                # the stale URL. Surface it loudly.
                logger.warning(
                    "repository.update_files missing; record %s still points at old audio",
                    video_id,
                )

        return SentenceRegenerateResult(
            video_id=video_id,
            sentence=updated_target,
            duration_delta=duration_delta,
            new_global_audio_url=new_global_url,
            new_global_duration=new_global_duration,
            timeline_url=timeline_url,
        )

    # ------------------------------------------------------------------
    # Shot-level regen (v3 editor) — same mechanics as regenerate_sentence
    # but operates on meta.shots[] keyed by shot_idx. Used by the editor's
    # per-shot "re-narrate this shot" button.
    # ------------------------------------------------------------------

    def regenerate_shot(
        self,
        video_id: str,
        shot_idx: int,
        new_text: str,
        *,
        voice_overrides: Optional[Dict[str, Any]] = None,
        crossfade_ms: int = 50,
        head_pad_ms: int = 40,
    ) -> ShotRegenerateResult:
        """Re-narrate one shot's audio.

        Mirrors `regenerate_sentence` but uses `meta.shots[]` as the editor
        unit. The shot's time range on the master narration is replaced with
        a fresh TTS of `new_text`, the audio is spliced via the render
        worker with crossfading, and `meta.shots[shot_idx]` is patched +
        downstream shots' `start_time` rippled by the duration delta.

        Refuses to re-narrate `audio_policy=intrinsic_only` shots — those
        carry intrinsic audio (source clip speaker, Veo audio) and have no
        master-narration slot to replace.

        Raises ValueError when the video / shot isn't found, when
        meta.shots[] hasn't been built yet (not a v3-pipeline video), or
        when the target shot is intrinsic_only. Other failures
        (TTS / splice / S3) bubble up as RuntimeError.
        """
        new_text = (new_text or "").strip()
        if not new_text:
            raise ValueError("new_text is required")

        record = self.repository.get_by_video_id(video_id)
        if record is None:
            raise ValueError(f"video {video_id} not found")
        s3_urls = dict(record.s3_urls or {})
        if not s3_urls.get("audio") or not s3_urls.get("timeline"):
            raise ValueError(
                "video is missing audio/timeline S3 URLs; cannot regenerate"
            )

        with tempfile.TemporaryDirectory(prefix=f"regen-shot-{video_id}-") as tmpdir:
            tmp = Path(tmpdir)

            timeline = self._download_json(s3_urls["timeline"], tmp / "timeline.json")
            shots = self._extract_shots(timeline)
            if not shots:
                raise ValueError(
                    "this video has no meta.shots[] — it predates the v3 "
                    "shot-clip editor schema. Open it in the editor once to "
                    "auto-build meta.shots[], or regenerate via the legacy "
                    "/sentence/regenerate endpoint."
                )
            idx_in_list, target = _find_shot_by_idx(shots, shot_idx)
            if target is None:
                raise ValueError(f"shot {shot_idx!r} not in timeline")
            if (target.get("audio_policy") or "narration_only") == "intrinsic_only":
                raise ValueError(
                    f"shot {shot_idx} is intrinsic_only — it carries its own "
                    f"audio (source clip / Veo). There is no narration to "
                    f"re-narrate. To replace its audio, edit the underlying "
                    f"source asset."
                )

            old_start = float(target.get("start_time") or 0.0)
            old_duration = float(target.get("duration") or 0.0)
            old_end = old_start + old_duration

            # `start_time` is MASTER-timeline (offset by any branding intro).
            # The master narration.mp3 + words.json are MP3-relative (no leading
            # intro silence), so the audio/word splice positions must be rebased
            # into MP3 coordinates. The ripple + entry-ref below intentionally
            # stay in MASTER coordinates (they edit the timeline). With no intro
            # `audio_start_at == 0` and these equal old_start/old_end.
            audio_start_at = self._audio_start_at(timeline)
            splice_start = max(0.0, old_start - audio_start_at)
            splice_end = max(splice_start, old_end - audio_start_at)

            # 1. TTS the new text → local MP3 + word timestamps.
            voice = self._resolve_voice(record, voice_overrides)
            tts_result = self._synthesize_sentence(
                text=new_text, output_path=tmp / "new_shot_clip.mp3", voice=voice,
            )

            # Guard against a SILENT premium→edge downgrade baking a different
            # voice than the video was made with. If the video's voice resolves
            # to premium (Sarvam/Google) but synthesis actually used edge, the
            # premium TTS failed (historically: Sarvam calling asyncio.run()
            # from a running event loop, or missing credentials) and fell back —
            # fail loudly instead of splicing a mismatched voice into the
            # narration. The endpoint now runs this off the event loop so Sarvam
            # works; this stays as a safety net.
            _req_provider = (voice.tts_provider or "standard").strip().lower()
            _act_provider = (getattr(tts_result, "resolved_provider", None) or "").strip().lower()
            if _req_provider == "premium" and _act_provider == "edge":
                raise RuntimeError(
                    "Could not reproduce the video's voice: it uses a premium "
                    "voice (e.g. Sarvam) but premium TTS was unavailable here, "
                    "so synthesis fell back to a different (Edge) voice. Aborting "
                    "so a mismatched voice isn't baked into the narration — retry, "
                    "or pass voice_overrides to pick an available voice."
                )

            # 2. Upload the new per-shot clip with a versioned key (cache-safe).
            version_tag = _version_tag()
            shot_id = str(target.get("id") or f"shot_{shot_idx:03d}")
            clip_key = self._versioned_shot_clip_key(video_id, shot_id, version_tag)
            new_clip_url = self.s3_service.upload_file(
                file_path=tts_result.audio_path,
                s3_key=clip_key,
                content_type="audio/mpeg",
            )

            # 3. Splice into the master narration.mp3 (render worker does the
            # ffmpeg+crossfade work — same primitive as sentence regen).
            # MP3-relative positions (rebased above), not master start/end.
            new_audio_key = self._versioned_audio_key(video_id, version_tag)
            splice = self.render_service.splice_audio(
                base_audio_url=s3_urls["audio"],
                new_clip_url=new_clip_url,
                replace_start=splice_start,
                replace_end=splice_end,
                output_key=new_audio_key,
                crossfade_ms=crossfade_ms,
                head_pad_ms=head_pad_ms,
            )
            new_global_url = splice.get("output_url")
            new_global_duration = float(splice.get("new_duration") or 0.0)
            duration_delta = float(splice.get("duration_delta") or 0.0)
            if not new_global_url:
                raise RuntimeError(f"splice_audio returned no output_url: {splice}")

            # SANITY GUARD — abort BEFORE rippling/persisting if the splice
            # returned an implausible result. Replacing a `old_duration`s shot
            # with a `new_clip`s clip should change the master by ≈
            # (new_clip − old_duration); the crossfade/head-pad shift this by at
            # most ~0.1s. A wildly different delta means the render splice
            # mangled the file (a real incident produced a 621-byte / 0.288s
            # master and a duration_delta of −59s, which then drove every shot,
            # entry and word timestamp negative and destroyed the timeline).
            # Raising here leaves the timeline + words.json + audio pointer
            # untouched — the spliced MP3 is orphaned under a versioned key.
            _new_clip_dur = float(tts_result.duration or 0.0)
            _expected_delta = _new_clip_dur - old_duration
            if abs(duration_delta - _expected_delta) > 1.0 or new_global_duration <= _new_clip_dur - 1.0:
                raise RuntimeError(
                    f"splice_audio returned an implausible result for shot "
                    f"{shot_idx}: new_duration={new_global_duration:.3f}s, "
                    f"duration_delta={duration_delta:.3f}s (expected ≈"
                    f"{_expected_delta:.3f}s for a {_new_clip_dur:.3f}s clip "
                    f"replacing a {old_duration:.3f}s shot). The render splice "
                    f"likely failed — aborting without modifying the timeline."
                )

            # 4. Patch the target shot + ripple downstream shots and entries.
            #
            # Why ripple-boundary = `old_end` (not `old_start` like the
            # sentence path):
            #   In v3 each shot maps 1:1 to a timeline entry (entry.inTime
            #   == shot.start_time). If we rippled at `old_start`, the
            #   EDITED shot's entry inTime would be shifted by delta —
            #   moving the shot itself forward in time and breaking its
            #   render alignment. Using `old_end` means:
            #     • edited entry: inTime < old_end → not shifted ✓
            #     • edited entry: exitTime == old_end → shifted to
            #       old_end + delta == new_end ✓
            #     • next shot's entry: inTime == old_end → shifted by
            #       delta (it now starts at the edited shot's new end) ✓
            #     • overlays inside the edited shot: untouched (their
            #       timing stays inside the shot's new range) ✓
            #   The sentence path correctly uses old_start because
            #   sentences sit INSIDE entries (not 1:1 with them).
            updated_target = self._patch_shot(
                target=target,
                new_text=new_text,
                new_clip_url=new_clip_url,
                tts_result=tts_result,
            )
            _ripple_shots(shots, after_idx=idx_in_list, delta=duration_delta)
            _ripple_entries(timeline, boundary=old_end, delta=duration_delta)
            _bump_total_duration(timeline, delta=duration_delta)

            # Write the per-entry audio ref ("entry owns its audio clip"). The
            # edited entry's inTime is unchanged by the old_end-boundary ripple,
            # so the 1:1 match still resolves. Master MP3 stays authoritative
            # for playback/render this round (see TimelineMeta.entries_own_audio).
            self._sync_entry_audio_ref(timeline, updated_target, policy="narration_only")

            # 5. Optional: splice global narration.words.json (best-effort —
            # captions for downstream content stay in sync). Same logic as
            # the sentence path; lifted directly.
            words_url = s3_urls.get("words")
            if words_url:
                try:
                    self._splice_global_words(
                        words_s3_url=words_url,
                        # MP3-relative — the words.json carries no intro offset.
                        old_start=splice_start,
                        old_end=splice_end,
                        new_sentence_words=updated_target.get("words") or [],
                        sentence_start_time=splice_start,
                        duration_delta=duration_delta,
                        tmp_path=tmp / "words.out.json",
                    )
                except Exception as exc:
                    logger.warning(
                        "Failed to splice global words.json for shot %s of %s: %s",
                        shot_idx, video_id, exc,
                    )

            # 6. Persist: timeline JSON back to its S3 key, video record's
            # audio URL pointed at the new spliced MP3. Also (best-effort)
            # update shot_plan.json on S3 so resume parity holds.
            timeline_url = self._upload_timeline_json(
                timeline=timeline,
                timeline_s3_url=s3_urls["timeline"],
                video_id=video_id,
                tmp_path=tmp / "timeline.out.json",
            )
            shot_plan_url = (s3_urls.get("shot_plan")
                             or (s3_urls.get("html") if isinstance(s3_urls.get("html"), dict) else {}).get("shot_plan"))
            if shot_plan_url:
                try:
                    self._sync_shot_plan_after_regen(
                        shot_plan_s3_url=str(shot_plan_url),
                        shot_idx=shot_idx,
                        new_text=new_text,
                        new_clip_url=new_clip_url,
                        new_duration_s=float(tts_result.duration or 0.0),
                        duration_delta=duration_delta,
                        tmp_path=tmp / "shot_plan.out.json",
                    )
                except Exception as exc:
                    logger.warning(
                        "shot_plan.json sync skipped for %s: %s — timeline is "
                        "authoritative; resume may need to rebuild shot_plan",
                        video_id, exc,
                    )
            try:
                self.repository.update_files(
                    video_id=video_id, s3_urls={"audio": new_global_url},
                )
            except AttributeError:
                logger.warning(
                    "repository.update_files missing; record %s still points "
                    "at old audio URL", video_id,
                )

        return ShotRegenerateResult(
            video_id=video_id,
            shot=updated_target,
            duration_delta=duration_delta,
            new_global_audio_url=new_global_url,
            new_global_duration=new_global_duration,
            timeline_url=timeline_url,
        )

    @staticmethod
    def _extract_shots(timeline: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Pull `meta.shots[]` out of a timeline dict, returning [] when absent."""
        meta = timeline.get("meta")
        if not isinstance(meta, dict):
            return []
        shots = meta.get("shots")
        return shots if isinstance(shots, list) else []

    @staticmethod
    def _audio_start_at(timeline: Dict[str, Any]) -> float:
        """Master-clock time at which the narration.mp3 begins (the branding
        intro duration).

        The master narration.mp3 and narration.words.json carry NO leading
        intro silence — their t=0 maps to master time `audio_start_at`. So any
        position used to splice the MP3 / patch the words stream must be rebased
        from master time into MP3 time by subtracting this. `meta.shots[]`
        `start_time` is MASTER (already intro-offset), unlike legacy
        `meta.sentences[]` `start_time`, which is already MP3-relative — that's
        why the sentence path needs no rebasing but the shot path does.

        Returns 0.0 when there's no intro (the common case).
        """
        meta = timeline.get("meta")
        if not isinstance(meta, dict):
            return 0.0
        try:
            return max(0.0, float(meta.get("audio_start_at") or 0.0))
        except (TypeError, ValueError):
            return 0.0

    @staticmethod
    def _patch_shot(
        *,
        target: Dict[str, Any],
        new_text: str,
        new_clip_url: str,
        tts_result,
    ) -> Dict[str, Any]:
        """Mutate `target` (one entry in `meta.shots[]`) with the new clip's
        text/url/duration/words. Mirrors _patch_sentence's contract."""
        target["text"] = new_text
        target["audio_url"] = new_clip_url
        target["audio_duration_s"] = float(tts_result.duration or 0.0)
        target["duration"] = float(tts_result.duration or 0.0)
        target["audio_skipped"] = False  # by definition: we just generated audio
        target["words"] = [
            {"word": w["word"], "start": float(w["start"]), "end": float(w["end"])}
            for w in (tts_result.words or [])
        ]
        return target

    @staticmethod
    def _versioned_shot_clip_key(video_id: str, shot_id: str, version_tag: str) -> str:
        return f"ai-videos/{video_id}/shot_clips/{shot_id}-{version_tag}.mp3"

    @staticmethod
    def _entry_audio_ref_from(
        shot: Dict[str, Any],
        *,
        policy: str,
        clip_url: Optional[str] = None,
        duration_s: Optional[float] = None,
        words_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Build the per-entry ``audio`` ref ("entry owns its audio clip") for
        a shot. ``clip_url`` / ``duration_s`` default to the shot's current
        audio fields. Policy is one of narration_only | intrinsic | silent."""
        ref: Dict[str, Any] = {
            "clip_url": clip_url if clip_url is not None else (shot.get("audio_url") or ""),
            "duration_s": float(
                duration_s if duration_s is not None
                else (shot.get("audio_duration_s") or shot.get("duration") or 0.0)
            ),
            "policy": policy,
        }
        if words_url:
            ref["words_url"] = words_url
        return ref

    def _sync_entry_audio_ref(
        self,
        timeline: Dict[str, Any],
        shot: Dict[str, Any],
        *,
        policy: str,
        clip_url: Optional[str] = None,
        duration_s: Optional[float] = None,
        words_url: Optional[str] = None,
    ) -> None:
        """Write the per-entry ``audio`` ref onto the timeline entry that maps
        1:1 to ``shot`` (v3 invariant: ``entry.inTime == shot.start_time``).

        No-op when no matching base entry is found (e.g. legacy v2 sentence
        timelines, which stay master-driven this round). The master narration
        MP3 remains authoritative for playback/render until a full migration
        sets ``meta.entries_own_audio`` — these refs ride along as the future
        source of truth and let the player avoid double-playing narration."""
        entries = self._extract_entries(timeline)
        if not entries:
            return
        start = float(shot.get("start_time") or 0.0)
        eps = 0.05
        best: Optional[Dict[str, Any]] = None
        best_z: Optional[float] = None
        for e in entries:
            if not isinstance(e, dict):
                continue
            if str(e.get("id") or "").startswith("branding-"):
                continue
            in_t = e.get("inTime")
            if not isinstance(in_t, (int, float)):
                continue
            if abs(float(in_t) - start) > eps:
                continue
            z = e.get("z")
            z = float(z) if isinstance(z, (int, float)) else 0.0
            if best is None or (best_z is not None and z < best_z):
                best, best_z = e, z
        if best is None:
            return
        best["audio"] = self._entry_audio_ref_from(
            shot, policy=policy, clip_url=clip_url,
            duration_s=duration_s, words_url=words_url,
        )

    def _sync_shot_plan_after_regen(
        self,
        *,
        shot_plan_s3_url: str,
        shot_idx: int,
        new_text: str,
        new_clip_url: str,
        new_duration_s: float,
        duration_delta: float,
        tmp_path: Path,
    ) -> None:
        """Best-effort sync of shot_plan.json after a re-narrate.

        Keeps the v3 checkpoint coherent for resume scenarios. The timeline
        is authoritative for the editor / render path — this is just
        secondary state hygiene.
        """
        download_path = tmp_path.with_suffix(".in.json")
        if not self.s3_service.download_file(shot_plan_s3_url, download_path):
            raise RuntimeError(f"failed to download {shot_plan_s3_url}")
        plan = json.loads(download_path.read_text(encoding="utf-8"))
        shots = plan.get("shots") if isinstance(plan.get("shots"), list) else []
        if not shots:
            return
        # Find by shot_index in the persisted plan (which is the canonical
        # field on the plan, vs. shot_idx on timeline entries).
        for i, s in enumerate(shots):
            if not isinstance(s, dict):
                continue
            try:
                idx_v = int(s.get("shot_index") if "shot_index" in s else s.get("shot_idx"))
            except (TypeError, ValueError):
                continue
            if idx_v == shot_idx:
                s["narration_text"] = new_text
                s["audio_url"] = new_clip_url
                s["audio_duration_s"] = new_duration_s
                # Update end_time + ripple downstream by the duration delta
                s["end_time"] = float(s.get("start_time") or 0.0) + new_duration_s
                # Ripple every later shot's start/end by the delta
                if abs(duration_delta) > 1e-6:
                    for later in shots[i + 1:]:
                        if not isinstance(later, dict):
                            continue
                        if "start_time" in later:
                            later["start_time"] = float(later["start_time"]) + duration_delta
                        if "end_time" in later:
                            later["end_time"] = float(later["end_time"]) + duration_delta
                break
        tmp_path.write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
        s3_key = self._extract_s3_key(shot_plan_s3_url)
        if s3_key:
            self.s3_service.upload_file(
                file_path=tmp_path, s3_key=s3_key, content_type="application/json",
            )

    def silence_sentence(
        self,
        video_id: str,
        sentence_id: str,
        *,
        crossfade_ms: int = 50,
        head_pad_ms: int = 40,
    ) -> SentenceRegenerateResult:
        """Mute one sentence: replace its audio range with silence of the
        same length and clear the sentence's text + words. Total duration
        and downstream timestamps are preserved (no ripple).

        The sentence stays in `meta.sentences[]` so the editor can later
        re-narrate the same slot via `regenerate_sentence` — silenced
        sentences are detected on the frontend by `text === ""` and
        `audio_url === ""` (or both).

        Reuses the `SentenceRegenerateResult` shape because callers care
        about the same outcome (updated sentence + new global audio URL).
        `duration_delta` will be ~0.
        """
        record = self.repository.get_by_video_id(video_id)
        if record is None:
            raise ValueError(f"video {video_id} not found")
        s3_urls = dict(record.s3_urls or {})
        if not s3_urls.get("audio") or not s3_urls.get("timeline"):
            raise ValueError(
                "video is missing audio/timeline S3 URLs; cannot silence"
            )

        with tempfile.TemporaryDirectory(prefix=f"silence-{video_id}-") as tmpdir:
            tmp = Path(tmpdir)

            timeline = self._download_json(s3_urls["timeline"], tmp / "timeline.json")
            sentences = self._extract_sentences(timeline)
            if not sentences:
                raise ValueError(
                    "this video has no meta.sentences[] yet — call "
                    "/sentences/build first to bootstrap them"
                )
            idx, target = _find_sentence_by_id(sentences, sentence_id)
            if target is None:
                raise ValueError(f"sentence {sentence_id!r} not in timeline")

            old_start = float(target.get("start_time") or 0.0)
            old_duration = float(target.get("duration") or 0.0)
            old_end = old_start + old_duration

            # 1. Splice silence into the global MP3.
            version_tag = _version_tag()
            new_audio_key = self._versioned_audio_key(video_id, version_tag)
            silence = self.render_service.silence_audio_range(
                base_audio_url=s3_urls["audio"],
                silence_start=old_start,
                silence_end=old_end,
                output_key=new_audio_key,
                crossfade_ms=crossfade_ms,
                head_pad_ms=head_pad_ms,
            )
            new_global_url = silence.get("output_url")
            new_global_duration = float(silence.get("new_duration") or 0.0)
            duration_delta = float(silence.get("duration_delta") or 0.0)
            if not new_global_url:
                raise RuntimeError(f"silence_audio_range returned no output_url: {silence}")

            # 2. Mark the sentence as silenced. Empty text + audio_url is
            # the signal the frontend uses to render the slot differently
            # (greyed region, "Add narration" button).
            target["text"] = ""
            target["audio_url"] = ""
            target["words"] = []
            # `duration` and `start_time` stay — the silenced slot still
            # occupies the same range in the global timeline.

            # 3. Splice words.json so caption pass over this range stays
            # silent. We pass an EMPTY `new_sentence_words` list, which
            # drops the old words for this range without inserting any.
            words_url = s3_urls.get("words")
            if words_url:
                try:
                    self._splice_global_words(
                        words_s3_url=words_url,
                        old_start=old_start,
                        old_end=old_end,
                        new_sentence_words=[],
                        sentence_start_time=old_start,
                        duration_delta=duration_delta,  # ~0
                        tmp_path=tmp / "words.out.json",
                    )
                except Exception as exc:
                    logger.warning(
                        "Failed to splice global words.json for %s: %s — captions "
                        "near %.2fs may briefly show stale words until rebuilt",
                        video_id, exc, old_start,
                    )

            # 4. Persist timeline + audio URL update on the video record.
            timeline_url = self._upload_timeline_json(
                timeline=timeline,
                timeline_s3_url=s3_urls["timeline"],
                video_id=video_id,
                tmp_path=tmp / "timeline.out.json",
            )
            try:
                self.repository.update_files(
                    video_id=video_id, s3_urls={"audio": new_global_url},
                )
            except AttributeError:
                logger.warning(
                    "repository.update_files missing; record %s still points at old audio",
                    video_id,
                )

        return SentenceRegenerateResult(
            video_id=video_id,
            sentence=target,
            duration_delta=duration_delta,
            new_global_audio_url=new_global_url,
            new_global_duration=new_global_duration,
            timeline_url=timeline_url,
        )

    def silence_shot(
        self,
        video_id: str,
        shot_idx: int,
        *,
        crossfade_ms: int = 50,
        head_pad_ms: int = 40,
    ) -> ShotRegenerateResult:
        """Mute one shot: replace its audio range with silence of the same
        length and clear the shot's text + words. Total duration and
        downstream timestamps are preserved (no ripple).

        Mirrors `silence_sentence` but on `meta.shots[]`, and refuses
        `intrinsic_only` shots (they carry their own audio — edit the
        underlying source asset instead). The shot stays in `meta.shots[]`
        (with `text=""`, `audio_url=""`, `audio_skipped=True`) so the editor
        can re-narrate the same slot later via `regenerate_shot`. Also writes
        the per-entry audio ref with policy='silent' ("entry owns its audio
        clip"). `duration_delta` ~0.
        """
        record = self.repository.get_by_video_id(video_id)
        if record is None:
            raise ValueError(f"video {video_id} not found")
        s3_urls = dict(record.s3_urls or {})
        if not s3_urls.get("audio") or not s3_urls.get("timeline"):
            raise ValueError("video is missing audio/timeline S3 URLs; cannot silence")

        with tempfile.TemporaryDirectory(prefix=f"silence-shot-{video_id}-") as tmpdir:
            tmp = Path(tmpdir)

            timeline = self._download_json(s3_urls["timeline"], tmp / "timeline.json")
            shots = self._extract_shots(timeline)
            if not shots:
                raise ValueError(
                    "this video has no meta.shots[] — it predates the v3 "
                    "shot-clip editor schema."
                )
            idx_in_list, target = _find_shot_by_idx(shots, shot_idx)
            if target is None:
                raise ValueError(f"shot {shot_idx!r} not in timeline")
            if (target.get("audio_policy") or "narration_only") == "intrinsic_only":
                raise ValueError(
                    f"shot {shot_idx} is intrinsic_only — it carries its own "
                    f"audio (source clip / Veo) and cannot be muted here. To "
                    f"change its audio, edit the underlying source asset."
                )

            old_start = float(target.get("start_time") or 0.0)
            old_duration = float(target.get("duration") or 0.0)
            old_end = old_start + old_duration

            # `start_time` is MASTER-timeline (offset by any branding intro);
            # the master MP3 + words.json are MP3-relative (no leading intro
            # silence). Rebase the silence/word positions into MP3 coordinates.
            # No-intro videos: audio_start_at == 0 (these equal old_start/end).
            audio_start_at = self._audio_start_at(timeline)
            splice_start = max(0.0, old_start - audio_start_at)
            splice_end = max(splice_start, old_end - audio_start_at)

            # 1. Splice silence into the master MP3 (duration-preserving).
            version_tag = _version_tag()
            new_audio_key = self._versioned_audio_key(video_id, version_tag)
            silence = self.render_service.silence_audio_range(
                base_audio_url=s3_urls["audio"],
                silence_start=splice_start,
                silence_end=splice_end,
                output_key=new_audio_key,
                crossfade_ms=crossfade_ms,
                head_pad_ms=head_pad_ms,
            )
            new_global_url = silence.get("output_url")
            new_global_duration = float(silence.get("new_duration") or 0.0)
            duration_delta = float(silence.get("duration_delta") or 0.0)
            if not new_global_url:
                raise RuntimeError(f"silence_audio_range returned no output_url: {silence}")

            # SANITY GUARD — silencing is duration-preserving, so the master
            # length must barely change (delta ≈ 0). A large delta means the
            # render op mangled the file; abort BEFORE rippling/persisting so a
            # bad splice can't drive every timestamp negative (see the matching
            # guard + incident note in regenerate_shot).
            if abs(duration_delta) > 1.0 or new_global_duration <= old_duration:
                raise RuntimeError(
                    f"silence_audio_range returned an implausible result for "
                    f"shot {shot_idx}: new_duration={new_global_duration:.3f}s, "
                    f"duration_delta={duration_delta:.3f}s (expected ≈0 for a "
                    f"duration-preserving silence over a {old_duration:.3f}s "
                    f"shot). The render op likely failed — aborting without "
                    f"modifying the timeline."
                )

            # 2. Mark the shot silenced (slot preserved, no ripple). Empty text
            # + audio_url + audio_skipped is the signal the FE uses to render
            # the slot as muted and offer "Add narration" (re-narrate).
            target["text"] = ""
            target["audio_url"] = ""
            target["audio_skipped"] = True
            target["words"] = []

            # 3. Per-entry audio ref → silent ("entry owns its audio clip").
            self._sync_entry_audio_ref(
                timeline, target, policy="silent", clip_url="",
                duration_s=old_duration,
            )

            # 4. Splice words.json over the range (drop, no insert → silent).
            words_url = s3_urls.get("words")
            if words_url:
                try:
                    self._splice_global_words(
                        words_s3_url=words_url,
                        # MP3-relative — the words.json carries no intro offset.
                        old_start=splice_start,
                        old_end=splice_end,
                        new_sentence_words=[],
                        sentence_start_time=splice_start,
                        duration_delta=duration_delta,  # ~0
                        tmp_path=tmp / "words.out.json",
                    )
                except Exception as exc:
                    logger.warning(
                        "Failed to splice global words.json for shot %s of %s: %s",
                        shot_idx, video_id, exc,
                    )

            # 5. Persist timeline + audio URL update on the video record.
            timeline_url = self._upload_timeline_json(
                timeline=timeline,
                timeline_s3_url=s3_urls["timeline"],
                video_id=video_id,
                tmp_path=tmp / "timeline.out.json",
            )
            try:
                self.repository.update_files(
                    video_id=video_id, s3_urls={"audio": new_global_url},
                )
            except AttributeError:
                logger.warning(
                    "repository.update_files missing; record %s still points at old audio",
                    video_id,
                )

        return ShotRegenerateResult(
            video_id=video_id,
            shot=target,
            duration_delta=duration_delta,
            new_global_audio_url=new_global_url,
            new_global_duration=new_global_duration,
            timeline_url=timeline_url,
        )

    # ------------------------------------------------------------------ #
    # RECOVERY — rebuild a corrupted master from surviving per-shot clips #
    # ------------------------------------------------------------------ #
    def rebuild_master_from_shots(self, video_id: str) -> Dict[str, Any]:
        """Recover a video whose master narration / timeline was corrupted by a
        bad splice (e.g. negative timestamps, collapsed ``total_duration``).

        Re-concatenates the per-shot audio clips referenced in ``meta.shots[]``
        into a fresh master MP3 + ``words.json``, then recomputes every shot /
        entry / ``total_duration`` offset from the real per-shot durations. The
        edits survive because each shot's ``audio_url`` already points at the
        right clip:

          - regenerated shots → ``shot_clips/…`` (their words ride in
            ``shots[].words``);
          - original shots    → ``per_shot_tts/shot_NNN.mp3`` (+ ``_raw.json``);
          - skipped / intrinsic shots → a silent gap of the shot's duration.

        Reuses the pipeline's tested ``_concat_master_narration`` (hard ffmpeg
        concat + provider-aware word stitching) so the result matches a normal
        generation. Derives everything from S3 artifacts, so it's idempotent;
        the corrupted master is left as an orphaned version.

        Returns a summary dict. Raises ValueError when the video / shots are
        missing; RuntimeError on concat / S3 failure.
        """
        record = self.repository.get_by_video_id(video_id)
        if record is None:
            raise ValueError(f"video {video_id} not found")
        s3_urls = dict(record.s3_urls or {})
        if not s3_urls.get("audio") or not s3_urls.get("timeline"):
            raise ValueError("video is missing audio/timeline S3 URLs; cannot rebuild")

        with tempfile.TemporaryDirectory(prefix=f"rebuild-{video_id}-") as tmpdir:
            tmp = Path(tmpdir)

            timeline = self._download_json(s3_urls["timeline"], tmp / "timeline.json")
            shots = self._extract_shots(timeline)
            if not shots:
                raise ValueError("this video has no meta.shots[] — nothing to rebuild from")

            meta = timeline.get("meta") if isinstance(timeline.get("meta"), dict) else {}
            audio_start_at = self._audio_start_at(timeline)
            outro_duration = 0.0
            try:
                outro_duration = max(0.0, float(meta.get("outro_duration") or 0.0))
            except (TypeError, ValueError):
                outro_duration = 0.0

            # ── 1. Build the ordered per-shot inputs the concat expects ────────
            ordered = sorted(shots, key=lambda s: int(s.get("shot_idx") or 0))
            per_shot_outputs: List[Dict[str, Any]] = []
            for s in ordered:
                shot_idx = int(s.get("shot_idx") or 0)
                intended = float(s.get("duration") or s.get("audio_duration_s") or 0.0)
                audio_url = s.get("audio_url")
                is_skipped = (
                    bool(s.get("audio_skipped"))
                    or (s.get("audio_policy") or "narration_only") == "intrinsic_only"
                    or not audio_url
                )
                if is_skipped:
                    per_shot_outputs.append({
                        "shot_idx": shot_idx, "skipped": True,
                        "intended_duration_s": intended, "reason": "skipped_or_intrinsic",
                    })
                    continue
                mp3_path = tmp / f"shot_{shot_idx:03d}.mp3"
                if not self.s3_service.download_file(str(audio_url), mp3_path):
                    raise RuntimeError(f"failed to download shot {shot_idx} clip: {audio_url}")
                # Word source: regen shots carry clip-relative words in
                # shots[].words (a plain [{word,start,end}] list — the concat's
                # _read_per_shot_words handles that as the "Google" shape).
                # Original shots reference a provider-raw _raw.json on S3.
                raw_json_path: Optional[Path] = None
                shot_words = s.get("words")
                if isinstance(shot_words, list) and shot_words:
                    raw_json_path = tmp / f"shot_{shot_idx:03d}_raw.json"
                    raw_json_path.write_text(json.dumps(shot_words), encoding="utf-8")
                elif s.get("audio_words_url"):
                    cand = tmp / f"shot_{shot_idx:03d}_raw.json"
                    if self.s3_service.download_file(str(s.get("audio_words_url")), cand):
                        raw_json_path = cand
                per_shot_outputs.append({
                    "shot_idx": shot_idx,
                    "mp3_path": str(mp3_path),
                    "raw_json_path": str(raw_json_path) if raw_json_path else None,
                    "skipped": False,
                    "intended_duration_s": intended,
                })

            # ── 2. Concat via the pipeline's tested primitive ──────────────────
            # `_concat_master_narration` only touches `self._coerce_shot_index`
            # (static) + `self._read_per_shot_words` (classmethod), so a bare
            # instance via __new__ avoids the heavy pipeline __init__.
            import sys as _sys
            aigen = str(self.video_gen_root)
            if aigen not in _sys.path:
                _sys.path.insert(0, aigen)
            from automation_pipeline import VideoGenerationPipeline  # type: ignore
            pipe = VideoGenerationPipeline.__new__(VideoGenerationPipeline)
            concat = pipe._concat_master_narration(
                per_shot_outputs,
                run_dir=tmp,
                output_audio_path=tmp / "narration.mp3",
                output_raw_json=tmp / "narration_raw.json",
            )
            content_dur = float(concat.get("total_duration_s") or 0.0)
            # Guard: never overwrite a (corrupt) video with an even-worse empty
            # rebuild. A multi-shot video must concat to more than a fraction of
            # a second; clip downloads already raise on failure, so this only
            # trips on a deeper ffmpeg/decoding problem.
            if content_dur <= 0.5:
                raise RuntimeError(
                    f"rebuild produced an implausibly short master "
                    f"({content_dur:.3f}s) from {len(per_shot_outputs)} shots — "
                    f"aborting without overwriting the timeline."
                )
            shot_offsets = {int(o.get("shot_idx")): o for o in (concat.get("shot_offsets") or [])}
            master_raw = json.loads(Path(concat["raw_json_path"]).read_text(encoding="utf-8"))
            word_entries = master_raw.get("word_entries") or []

            # ── 3. Recompute every offset from the real per-shot durations ─────
            total_duration = round(audio_start_at + content_dur + outro_duration, 3)
            for s in shots:
                off = shot_offsets.get(int(s.get("shot_idx") or 0))
                if not off:
                    continue
                s["start_time"] = round(audio_start_at + float(off.get("start_s") or 0.0), 3)
                s["duration"] = round(float(off.get("dur_s") or 0.0), 3)
            shot_by_idx = {int(s.get("shot_idx") or 0): s for s in shots}
            for e in timeline.get("entries", []):
                eid = str(e.get("id") or "")
                if eid == "branding-watermark":
                    e["inTime"], e["exitTime"] = 0.0, total_duration
                elif eid == "branding-intro":
                    e["inTime"], e["exitTime"] = 0.0, round(audio_start_at, 3)
                elif eid == "branding-outro":
                    e["inTime"], e["exitTime"] = round(total_duration - outro_duration, 3), total_duration
                elif eid.startswith("shot-"):
                    try:
                        sh = shot_by_idx.get(int(eid.split("-", 1)[1]))
                    except (ValueError, IndexError):
                        sh = None
                    if sh is not None:
                        st = float(sh.get("start_time") or 0.0)
                        e["inTime"] = round(st, 3)
                        e["exitTime"] = round(st + float(sh.get("duration") or 0.0), 3)
                # other (overlay) entries are left untouched.
            if isinstance(meta, dict):
                meta["total_duration"] = total_duration
                meta["content_ends_at"] = round(audio_start_at + content_dur, 3)

            # ── 4. Upload fresh master MP3, words.json, timeline; repoint record ─
            version_tag = _version_tag()
            new_audio_key = self._versioned_audio_key(video_id, version_tag)
            new_audio_url = self.s3_service.upload_file(
                file_path=Path(concat["audio_path"]),
                s3_key=new_audio_key,
                content_type="audio/mpeg",
            )
            words_url = s3_urls.get("words")
            if words_url:
                words_key = self._extract_s3_key(words_url)
                if words_key:
                    words_out = tmp / "narration.words.json"
                    words_out.write_text(json.dumps(word_entries, ensure_ascii=False), encoding="utf-8")
                    self.s3_service.upload_file(
                        file_path=words_out, s3_key=words_key, content_type="application/json",
                    )
            timeline_url = self._upload_timeline_json(
                timeline=timeline,
                timeline_s3_url=s3_urls["timeline"],
                video_id=video_id,
                tmp_path=tmp / "timeline.out.json",
            )
            self.repository.update_files(video_id=video_id, s3_urls={"audio": new_audio_url})

        return {
            "video_id": video_id,
            "new_global_audio_url": new_audio_url,
            "total_duration": total_duration,
            "shot_count": len(shots),
            "word_count": len(word_entries),
            "timeline_url": timeline_url,
        }

    def insert_shot(
        self,
        video_id: str,
        gap_start: float,
        gap_end: float,
        *,
        user_hint: Optional[str] = None,
        html_model: Optional[str] = None,
    ) -> ShotInsertResult:
        """Generate a new HTML shot for `[gap_start, gap_end]` and insert
        it into the timeline. Duration-neutral: no audio splice, no
        ripple, no `total_duration` change — gap-filling only adds a
        visual layer over narration that already plays.

        The new shot's visual prompt combines the spoken text in the gap
        (extracted from `meta.sentences[]`) with the optional `user_hint`.
        Visuals are generated by the same per-shot HTML path the main
        pipeline uses, so style/branding match the rest of the video.

        Raises ValueError when the gap is invalid (out of range, overlaps
        an existing entry, zero/negative duration). All other failures
        (LLM, S3) bubble up as RuntimeError.
        """
        record = self.repository.get_by_video_id(video_id)
        if record is None:
            raise ValueError(f"video {video_id} not found")
        s3_urls = dict(record.s3_urls or {})
        if not s3_urls.get("timeline"):
            raise ValueError("video is missing timeline S3 URL; cannot insert shot")

        gap_start = float(gap_start)
        gap_end = float(gap_end)
        if gap_end - gap_start < 0.5:
            raise ValueError(
                f"gap too short to host a shot ({gap_end - gap_start:.2f}s; min 0.5s)"
            )

        with tempfile.TemporaryDirectory(prefix=f"insshot-{video_id}-") as tmpdir:
            tmp = Path(tmpdir)
            timeline = self._download_json(s3_urls["timeline"], tmp / "timeline.json")
            if not isinstance(timeline, dict):
                raise RuntimeError(
                    f"timeline.json malformed (got {type(timeline).__name__})"
                )

            entries = self._extract_entries(timeline)
            _validate_gap_free(entries, gap_start, gap_end)

            total_duration = self._extract_total_duration(timeline)
            if total_duration > 0 and gap_end > total_duration + 1e-3:
                raise ValueError(
                    f"gap_end {gap_end:.2f}s exceeds video duration {total_duration:.2f}s"
                )

            # Pull the speech context from sentences/words. Sentences
            # carry the human-readable script; words carry the per-token
            # timestamps the LLM uses to schedule reveals.
            sentences = self._extract_sentences(timeline)
            speech_text = _slice_speech_text(sentences, gap_start, gap_end)
            words_in_range = self._load_words_in_range(
                s3_urls.get("words"), gap_start, gap_end, tmp / "words.json",
            )

            # Read voice/style config for this video so the generated
            # shot matches the surrounding video's design.
            meta = dict(record.extra_metadata or {})
            video_width, video_height = _resolve_dimensions(meta)
            quality_tier = str(meta.get("quality_tier") or "ultra")
            style_guide = self._load_style_guide_checkpoint(video_id, tmp / "style_guide.json")

            entry = self._generate_shot(
                gap_start=gap_start,
                gap_end=gap_end,
                speech_text=speech_text,
                words_in_range=words_in_range,
                video_width=video_width,
                video_height=video_height,
                quality_tier=quality_tier,
                style_guide=style_guide,
                user_hint=user_hint,
                run_dir=tmp / "shot_gen",
                html_model=html_model,
            )

            _insert_entry_sorted(timeline, entry)
            timeline_url = self._upload_timeline_json(
                timeline=timeline,
                timeline_s3_url=s3_urls["timeline"],
                video_id=video_id,
                tmp_path=tmp / "timeline.out.json",
            )

        return ShotInsertResult(
            video_id=video_id, entry=entry, timeline_url=timeline_url,
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
        """Write sentences[] under timeline.meta.sentences and re-upload."""
        meta = timeline.setdefault("meta", {})
        if not isinstance(meta, dict):
            raise RuntimeError(f"timeline.meta is not an object (got {type(meta).__name__})")
        meta["sentences"] = sentences
        return self._upload_timeline_json(
            timeline=timeline,
            timeline_s3_url=timeline_s3_url,
            video_id=video_id,
            tmp_path=tmp_path,
        )

    # ----- regenerate-only internals -----

    def _resolve_voice(self, record, overrides: Optional[Dict[str, Any]]):
        """Build the VoiceConfig used for re-narration.

        Precedence (highest first):
          1. per-request `overrides`
          2. pinned `extra_metadata.resolved_voice` — the CONCRETE provider +
             voice name that synthesis actually used at generation (incl. a
             premium auto-pick or a mid-synth edge→google fallback)
          3. top-level `extra_metadata` knobs (only non-default knobs are
             stored there)
          4. `extra_metadata.user_selections` knobs (the request snapshot)
          5. language default

        (2) is what fixes regenerated clips drifting to a different voice than
        the original — see VideoGenerationService's persistence of
        `resolved_voice`. (4) is the fallback for videos generated before the
        pin existed: at least reuse the requested provider/gender/voice_id
        instead of a bare default. For Edge the concrete voice is deterministic
        from (language, gender), so pinning the provider also prevents regen
        from re-attempting premium and landing on a different provider."""
        self._ensure_video_gen_on_path()
        try:
            from sentence_tts import VoiceConfig
        except ImportError as exc:
            raise RuntimeError(f"sentence_tts not importable: {exc}") from exc

        emeta = dict(record.extra_metadata or {})
        meta: Dict[str, Any] = {}

        # Layer low→high so higher-precedence sources overwrite lower ones.
        # (4) user_selections — request knobs always snapshotted at gen time.
        user_sel = emeta.get("user_selections")
        if isinstance(user_sel, dict):
            for key in ("voice_gender", "tts_provider", "voice_id"):
                v = user_sel.get(key)
                if v is not None:
                    meta[key] = v
        # (3) top-level extra_metadata.
        for key in ("voice_gender", "tts_provider", "voice_id"):
            v = emeta.get(key)
            if v is not None:
                meta[key] = v
        # (2) pinned concrete resolved voice.
        resolved = emeta.get("resolved_voice")
        if isinstance(resolved, dict):
            if resolved.get("provider"):
                meta["tts_provider"] = resolved["provider"]
            if resolved.get("voice_id"):
                meta["voice_id"] = resolved["voice_id"]
            if resolved.get("gender"):
                meta["voice_gender"] = resolved["gender"]
        # (1) per-request overrides win outright.
        if overrides:
            for key in ("voice_gender", "tts_provider", "voice_id"):
                v = overrides.get(key)
                if v is not None:
                    meta[key] = v

        language = (
            (overrides or {}).get("language")
            or (resolved.get("language") if isinstance(resolved, dict) else None)
            or record.language
            or "English"
        )
        return VoiceConfig.from_metadata(language=language, metadata=meta)

    def backfill_resolved_voice(
        self, video_id: str, *, overwrite: bool = False
    ) -> Dict[str, Any]:
        """Freeze the current voice derivation onto an existing video's
        ``extra_metadata.resolved_voice`` so future re-narration is pinned and
        cannot drift if VOICE_MAPPING / defaults change later.

        Limitation: this does NOT recover a lost premium auto-pick. Videos
        generated before the resolved-voice pin existed never recorded the
        concrete voice the TTS engine auto-selected, so for the
        ``premium`` + ``voice_id=None`` case the best we can do is freeze the
        provider / gender / language (Edge is deterministic from those;
        Google/Sarvam auto-picks stay approximate). New videos record the real
        concrete voice at TTS time via VideoGenerationService.

        Returns the ``resolved_voice`` dict (existing one when a pin already
        exists and ``overwrite`` is False)."""
        record = self.repository.get_by_video_id(video_id)
        if record is None:
            raise ValueError(f"video {video_id} not found")
        emeta = dict(record.extra_metadata or {})
        existing = emeta.get("resolved_voice")
        if isinstance(existing, dict) and existing.get("voice_id") and not overwrite:
            return existing
        vc = self._resolve_voice(record, None)
        resolved = {
            "provider": getattr(vc, "tts_provider", None),
            "voice_id": getattr(vc, "voice_id", None),
            "gender": getattr(vc, "voice_gender", None),
            "language": getattr(vc, "language", None) or record.language,
            "backfilled": True,
        }
        emeta["resolved_voice"] = resolved
        self.repository.update_metadata(video_id, emeta)
        return resolved

    def _synthesize_sentence(self, *, text: str, output_path: Path, voice):
        """TTS one sentence using the same code path the pipeline uses."""
        self._ensure_video_gen_on_path()
        try:
            from sentence_tts import synthesize_one_sentence
        except ImportError as exc:
            raise RuntimeError(f"sentence_tts not importable: {exc}") from exc
        from ..config import get_settings
        openrouter_key = get_settings().openrouter_api_key
        if not openrouter_key:
            raise RuntimeError("OPENROUTER_API_KEY not configured")
        return synthesize_one_sentence(
            text=text, output_path=output_path, voice=voice,
            openrouter_key=openrouter_key, align_words=True,
        )

    @staticmethod
    def _extract_sentences(timeline: Dict[str, Any]) -> List[Dict[str, Any]]:
        meta = timeline.get("meta") if isinstance(timeline, dict) else None
        if not isinstance(meta, dict):
            return []
        sentences = meta.get("sentences")
        return sentences if isinstance(sentences, list) else []

    @staticmethod
    def _extract_entries(timeline: Dict[str, Any]) -> List[Dict[str, Any]]:
        entries = timeline.get("entries") if isinstance(timeline, dict) else None
        return entries if isinstance(entries, list) else []

    @staticmethod
    def _extract_total_duration(timeline: Dict[str, Any]) -> float:
        meta = timeline.get("meta") if isinstance(timeline, dict) else None
        if not isinstance(meta, dict):
            return 0.0
        td = meta.get("total_duration")
        try:
            return float(td) if td is not None else 0.0
        except (TypeError, ValueError):
            return 0.0

    def _load_words_in_range(
        self,
        words_url: Optional[str],
        gap_start: float,
        gap_end: float,
        tmp_path: Path,
    ) -> List[Dict[str, Any]]:
        """Download words.json (best-effort) and filter to the gap range.
        Empty list when words aren't available — the per-shot generator
        copes (no word-tied animation, just speech-text-driven visuals)."""
        if not words_url:
            return []
        try:
            raw = self._download_json(words_url, tmp_path)
        except Exception as exc:
            logger.warning("Failed to download words.json for gap insert: %s", exc)
            return []
        if not isinstance(raw, list):
            return []
        out: List[Dict[str, Any]] = []
        for w in raw:
            if not isinstance(w, dict):
                continue
            try:
                start = float(w.get("start", 0))
                end = float(w.get("end", 0))
            except (TypeError, ValueError):
                continue
            if end <= gap_start or start >= gap_end:
                continue
            out.append({"word": str(w.get("word", "")), "start": start, "end": end})
        return out

    def _load_style_guide_checkpoint(
        self, video_id: str, tmp_path: Path,
    ) -> Optional[Dict[str, Any]]:
        """Pull the original style_guide.json from S3 checkpoints so the
        new shot's visuals match the existing video's branding/colors.
        Returns None when the checkpoint is missing — the generator falls
        back to its own conservative default."""
        from ..config import get_settings
        settings = get_settings()
        bucket = settings.aws_s3_public_bucket or settings.aws_bucket_name
        if not bucket:
            return None
        url = f"https://{bucket}.s3.amazonaws.com/ai-videos/{video_id}/checkpoints/style_guide.json"
        try:
            data = self._download_json(url, tmp_path)
        except Exception as exc:
            logger.info("style_guide.json checkpoint missing for %s (%s) — using default", video_id, exc)
            return None
        return data if isinstance(data, dict) else None

    def _generate_shot(
        self,
        *,
        gap_start: float,
        gap_end: float,
        speech_text: str,
        words_in_range: List[Dict[str, Any]],
        video_width: int,
        video_height: int,
        quality_tier: str,
        style_guide: Optional[Dict[str, Any]],
        user_hint: Optional[str],
        run_dir: Path,
        html_model: Optional[str],
    ) -> Dict[str, Any]:
        """Call into the single_shot_generator module under ai-video-gen-main.
        Mirrors the import-via-sys.path trick used by `_synthesize_sentence`."""
        self._ensure_video_gen_on_path()
        try:
            from single_shot_generator import generate_one_shot
        except ImportError as exc:
            raise RuntimeError(f"single_shot_generator not importable: {exc}") from exc
        from ..config import get_settings
        openrouter_key = get_settings().openrouter_api_key
        if not openrouter_key:
            raise RuntimeError("OPENROUTER_API_KEY not configured")
        return generate_one_shot(
            gap_start=gap_start,
            gap_end=gap_end,
            speech_text=speech_text,
            words_in_range=words_in_range,
            video_width=video_width,
            video_height=video_height,
            quality_tier=quality_tier,
            style_guide=style_guide,
            user_hint=user_hint,
            openrouter_key=openrouter_key,
            run_dir=run_dir,
            html_model=html_model,
        )

    @staticmethod
    def _patch_sentence(
        *,
        target: Dict[str, Any],
        new_text: str,
        new_clip_url: str,
        tts_result,
    ) -> Dict[str, Any]:
        """Mutate `target` in place (so it reflects in `timeline.meta.sentences`)
        with the new clip's text/url/duration/words. Returns the same dict."""
        target["text"] = new_text
        target["audio_url"] = new_clip_url
        target["duration"] = float(tts_result.duration or 0.0)
        # Whisper words come back with absolute timestamps in the clip; we
        # already store them rebased to clip start (clip start == 0 for a
        # single-sentence MP3, so they're already relative — pass through).
        target["words"] = [
            {"word": w["word"], "start": float(w["start"]), "end": float(w["end"])}
            for w in (tts_result.words or [])
        ]
        return target

    @staticmethod
    def _versioned_clip_key(video_id: str, sentence_id: str, version_tag: str) -> str:
        return f"ai-videos/{video_id}/sentences/{sentence_id}-{version_tag}.mp3"

    @staticmethod
    def _versioned_audio_key(video_id: str, version_tag: str) -> str:
        return f"ai-videos/{video_id}/audio/narration-{version_tag}.mp3"

    def _ensure_video_gen_on_path(self) -> None:
        """sys.path injection — same trick used by VideoGenerationService for
        importing the dash-named ai-video-gen-main package as a module."""
        if str(self.video_gen_root) not in sys.path:
            sys.path.insert(0, str(self.video_gen_root))

    # ----- global words.json splice -----

    def _splice_global_words(
        self,
        *,
        words_s3_url: str,
        old_start: float,
        old_end: float,
        new_sentence_words: List[Dict[str, Any]],
        sentence_start_time: float,
        duration_delta: float,
        tmp_path: Path,
    ) -> None:
        """Patch the global narration.words.json to match the spliced audio.

        Strategy: drop every word that falls inside the replaced range,
        insert the new sentence's words rebased to absolute time, then
        ripple every word that comes after the replacement by
        `duration_delta`. The new file is uploaded back to the same S3 key
        — same pattern the timeline JSON uses, so consumers don't need to
        learn a versioned URL.
        """
        # Download → parse → splice → re-upload
        download_path = tmp_path.with_suffix(".in.json")
        if not self.s3_service.download_file(words_s3_url, download_path):
            raise RuntimeError(f"failed to download {words_s3_url}")
        raw = json.loads(download_path.read_text(encoding="utf-8"))
        if not isinstance(raw, list):
            raise RuntimeError(
                f"words.json malformed (expected list, got {type(raw).__name__})"
            )

        spliced = _splice_word_stream(
            base_words=raw,
            old_start=old_start,
            old_end=old_end,
            new_sentence_words=new_sentence_words,
            sentence_start_time=sentence_start_time,
            duration_delta=duration_delta,
        )
        tmp_path.write_text(json.dumps(spliced, ensure_ascii=False), encoding="utf-8")

        s3_key = self._extract_s3_key(words_s3_url)
        if not s3_key:
            raise RuntimeError(f"could not derive S3 key from {words_s3_url}")
        self.s3_service.upload_file(
            file_path=tmp_path, s3_key=s3_key, content_type="application/json",
        )

    # ----- shared timeline I/O -----

    def _upload_timeline_json(
        self,
        *,
        timeline: Dict[str, Any],
        timeline_s3_url: str,
        video_id: str,
        tmp_path: Path,
    ) -> str:
        tmp_path.write_text(json.dumps(timeline, ensure_ascii=False), encoding="utf-8")
        s3_key = self._extract_s3_key(timeline_s3_url) or (
            f"ai-videos/{video_id}/timeline/time_based_frame.json"
        )
        return self.s3_service.upload_file(
            file_path=tmp_path, s3_key=s3_key, content_type="application/json",
        )

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


# ---------------------------------------------------------------------------
# Module-level helpers (pure — no I/O, no class state)
# ---------------------------------------------------------------------------

def _find_sentence_by_id(
    sentences: List[Dict[str, Any]], sentence_id: str,
) -> Tuple[int, Optional[Dict[str, Any]]]:
    for i, s in enumerate(sentences):
        if s.get("id") == sentence_id:
            return i, s
    return -1, None


def _entry_time_range(entry: Dict[str, Any]) -> Tuple[float, float]:
    """Read an entry's [start, end] in absolute seconds. Tolerates both
    `inTime/exitTime` (canonical persisted form) and `start/end` (older
    pipeline output) so this works on legacy timelines too."""
    start = entry.get("inTime")
    if start is None:
        start = entry.get("start", 0)
    end = entry.get("exitTime")
    if end is None:
        end = entry.get("end", 0)
    try:
        return float(start), float(end)
    except (TypeError, ValueError):
        return 0.0, 0.0


def _validate_gap_free(
    entries: List[Dict[str, Any]], gap_start: float, gap_end: float,
) -> None:
    """Raise ValueError if any base-channel entry overlaps the gap.

    Only base-channel entries (z < 500) are checked: overlay entries
    (watermark, captions, decorative layers) are allowed to live on top
    of the new shot — that's their normal role."""
    epsilon = 1e-3
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        try:
            z = int(entry.get("z", 1))
        except (TypeError, ValueError):
            z = 1
        if z >= 500:
            continue
        e_start, e_end = _entry_time_range(entry)
        if e_end <= gap_start + epsilon or e_start >= gap_end - epsilon:
            continue
        raise ValueError(
            f"gap [{gap_start:.2f}, {gap_end:.2f}] overlaps existing entry "
            f"{entry.get('id')!r} at [{e_start:.2f}, {e_end:.2f}]"
        )


def _slice_speech_text(
    sentences: List[Dict[str, Any]], gap_start: float, gap_end: float,
) -> str:
    """Concatenate the text of every sentence whose audio falls inside
    the gap. Used as the LLM's narration context so generated visuals
    align with what's actually being said."""
    parts: List[str] = []
    for s in sentences:
        if not isinstance(s, dict):
            continue
        try:
            start = float(s.get("start_time", 0))
            duration = float(s.get("duration", 0))
        except (TypeError, ValueError):
            continue
        end = start + duration
        if end <= gap_start or start >= gap_end:
            continue
        text = str(s.get("text", "")).strip()
        if text:
            parts.append(text)
    return " ".join(parts)


def _resolve_dimensions(meta: Dict[str, Any]) -> Tuple[int, int]:
    """Derive (width, height) from the video record's gen_metadata.
    Mirrors the orientation→dimensions mapping in
    `VideoGenerationService` (line ~974). Defaults to landscape."""
    orientation = str(meta.get("orientation") or "landscape").lower()
    if orientation == "portrait":
        return 1080, 1920
    return 1920, 1080


def _insert_entry_sorted(timeline: Dict[str, Any], entry: Dict[str, Any]) -> None:
    """Insert `entry` into `timeline['entries']` at the position that
    keeps the list sorted by `inTime` ascending. Mutates in place.
    Creates `entries` if missing."""
    entries = timeline.get("entries")
    if not isinstance(entries, list):
        entries = []
        timeline["entries"] = entries
    new_start, _ = _entry_time_range(entry)
    insert_at = len(entries)
    for i, existing in enumerate(entries):
        if not isinstance(existing, dict):
            continue
        ex_start, _ = _entry_time_range(existing)
        if new_start < ex_start:
            insert_at = i
            break
    entries.insert(insert_at, entry)


def _ripple_sentences(
    sentences: List[Dict[str, Any]], *, after_idx: int, delta: float,
) -> None:
    """Shift every sentence after `after_idx` by `delta`. Mutates in place.
    Skipped when delta is effectively zero — no need to dirty floats."""
    if abs(delta) < 1e-6:
        return
    for s in sentences[after_idx + 1:]:
        if "start_time" in s and isinstance(s["start_time"], (int, float)):
            s["start_time"] = float(s["start_time"]) + delta


def _find_shot_by_idx(
    shots: List[Dict[str, Any]], shot_idx: int,
) -> Tuple[int, Optional[Dict[str, Any]]]:
    """Linear scan for `meta.shots[]` entry matching shot_idx. Tolerates
    `shot_idx` AND `shot_index` field names so this works on both v3
    (canonical: shot_idx) and director-style plans (shot_index)."""
    for i, s in enumerate(shots):
        if not isinstance(s, dict):
            continue
        cand = s.get("shot_idx", s.get("shot_index"))
        try:
            if int(cand) == int(shot_idx):
                return i, s
        except (TypeError, ValueError):
            continue
    return -1, None


def _ripple_shots(
    shots: List[Dict[str, Any]], *, after_idx: int, delta: float,
) -> None:
    """Shift every shot after `after_idx` by `delta`. Mirrors `_ripple_sentences`
    but operates on the v3 ShotClip schema. Mutates in place; no-op on ~0 delta."""
    if abs(delta) < 1e-6:
        return
    for s in shots[after_idx + 1:]:
        if not isinstance(s, dict):
            continue
        if "start_time" in s and isinstance(s["start_time"], (int, float)):
            s["start_time"] = float(s["start_time"]) + delta


def _ripple_entries(
    timeline: Dict[str, Any], *, boundary: float, delta: float,
) -> None:
    """Shift every entry whose `inTime`/`exitTime` falls AT or after the
    splice boundary by `delta`. Entries that started before the boundary
    but extend past it (e.g. an overlay that spans the edited sentence)
    only have their exitTime shifted — their start stays put.

    Mutates timeline['entries'] in place; no-ops if delta is ~0.
    """
    if abs(delta) < 1e-6:
        return
    entries = timeline.get("entries")
    if not isinstance(entries, list):
        return
    epsilon = 1e-3  # avoid floating-point boundary jitter
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        for key in ("inTime", "exitTime", "start", "end"):
            v = entry.get(key)
            if not isinstance(v, (int, float)):
                continue
            if v >= boundary - epsilon:
                entry[key] = float(v) + delta


def _bump_total_duration(timeline: Dict[str, Any], *, delta: float) -> None:
    if abs(delta) < 1e-6:
        return
    meta = timeline.get("meta")
    if not isinstance(meta, dict):
        return
    td = meta.get("total_duration")
    if isinstance(td, (int, float)):
        meta["total_duration"] = float(td) + delta


def _version_tag() -> str:
    """Filename-safe timestamp suffix for versioned S3 keys. Avoids
    cache collisions when the editor regenerates the same sentence twice
    without breaking older URLs that may still be referenced elsewhere."""
    return f"v{int(time.time() * 1000)}"


def _splice_word_stream(
    *,
    base_words: List[Dict[str, Any]],
    old_start: float,
    old_end: float,
    new_sentence_words: List[Dict[str, Any]],
    sentence_start_time: float,
    duration_delta: float,
) -> List[Dict[str, Any]]:
    """Rebuild a global word-timestamps list to match a spliced audio file.

    Three-band partition of `base_words`:
      - HEAD: words ending at or before `old_start`. Kept verbatim — the
        audio they describe is unchanged in the new MP3.
      - REPLACED: words whose [start, end] overlaps the replaced range.
        Dropped — the audio they described no longer exists. The new
        sentence's words take over this band.
      - TAIL: words starting at or after `old_end`. Kept, but their
        timestamps shift by `duration_delta` because the new sentence
        is longer/shorter than the old one.

    The new sentence's words come in clip-relative form (0..clip_duration);
    we rebase them to absolute time at `sentence_start_time` (== old_start
    in current callers) before splicing in.

    Pure function — no I/O, easy to unit-test against synthetic streams.
    """
    epsilon = 1e-3

    head: List[Dict[str, Any]] = []
    tail: List[Dict[str, Any]] = []
    for w in base_words:
        if not isinstance(w, dict):
            continue
        try:
            w_start = float(w.get("start", 0.0))
            w_end = float(w.get("end", 0.0))
        except (TypeError, ValueError):
            continue
        if w_end <= old_start + epsilon:
            head.append(w)
        elif w_start >= old_end - epsilon:
            # Ripple the tail by the duration delta (positive when the new
            # clip is longer; negative when it's shorter).
            tail.append({
                **w,
                "start": w_start + duration_delta,
                "end": w_end + duration_delta,
            })
        # else: word straddles or sits inside [old_start, old_end] → drop.

    inserted: List[Dict[str, Any]] = []
    for w in new_sentence_words:
        if not isinstance(w, dict):
            continue
        try:
            rel_start = float(w.get("start", 0.0))
            rel_end = float(w.get("end", 0.0))
        except (TypeError, ValueError):
            continue
        inserted.append({
            "word": str(w.get("word", "")),
            "start": sentence_start_time + rel_start,
            "end": sentence_start_time + rel_end,
        })

    return head + inserted + tail
