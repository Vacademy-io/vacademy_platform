"""
Gate 3b — AUDIO_EDIT stage.

Takes a candidate's source window + cut plan, produces the final post-cut
post-atempo speaker audio MP3, uploads to S3, and records a trim_map.

Implemented as a single ffmpeg invocation using `filter_complex`:
  - `-ss/-t` on input does fast HTTPS-range seek to the window
  - Per kept-span `atrim` filters with `asetpts=PTS-STARTPTS`
  - `concat=n=K:v=0:a=1` stitches kept spans
  - `atempo=X` applies speed_multiplier (skipped when 1.0)
  - Encoded as MP3 22050Hz/96kbps mono (matches existing pipeline convention)

Trim map records (orig_t_start, orig_t_end, new_t_start, new_t_end) per kept
span — used by SOURCE_CLIP and DIRECTOR stages to map between source
timecodes and the trimmed output timeline.
"""
from __future__ import annotations

import asyncio
import logging
import os
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Optional
from uuid import uuid4

from ..repositories.ai_input_asset_repository import AiInputAssetRepository
from ..repositories.ai_reel_repository import AiReelCandidateRepository
from ..services.reels_render_orchestrator import (
    RenderContext,
    STAGE_AUDIO_EDIT,
    register_stage_handler,
)
from ..services.s3_service import S3Service

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Timeout for the ffmpeg invocation. Even for a 90s window with 10+ cuts,
# the work is bounded — 60s is more than safe.
FFMPEG_TIMEOUT_S = 60

# Output encoding. 44.1kHz/128k even for speech-only — the 22.05kHz/96k
# intermediate audibly dulled sibilants in the published reel, and the
# bandwidth saving is irrelevant for a <60s clip.
OUTPUT_SAMPLE_RATE = 44100
OUTPUT_BITRATE = "128k"

# Loudness mastering applied to the final mix. -14 LUFS integrated /
# -1.5 dBTP is the common loudness target for social feeds; without it
# reel volume varies wildly with source recording level.
LOUDNORM_FILTER = "loudnorm=I=-14:TP=-1.5:LRA=11"

# De-click fade applied to each kept span's head and tail before concat.
# Hard atrim+concat at word-cut seams produces audible clicks when the
# waveform is cut mid-cycle; 6ms qsin ramps are inaudible as fades but
# guarantee zero-crossing-safe seams.
SPAN_DECLICK_FADE_S = 0.006

# Below this kept-span duration, ffmpeg's atrim can produce zero-frame
# outputs that break the concat filter. The cut planner already validates
# spans ≥80ms; the dual check here protects against rounding edge cases.
MIN_KEPT_SPAN_S = 0.1

# PaceConfig.silence_trim handling. The cut planner emits kind="silence"
# spans at its default threshold (pauses ≥0.4s trimmed to a 0.15s gap);
# render time can only DROP spans, not plan stronger trims, so "aggressive"
# behaves like "on". "gentle" keeps only the cuts that came from clearly
# long pauses: a span this long corresponds to a ~0.8s+ pause after the
# planner's 0.15s kept gap.
GENTLE_MIN_SILENCE_SPAN_S = 0.65

# Output sample rate when background music is present — music gets crunchy
# at 22050Hz mono, so we bump to a music-friendly rate + stereo. Speech-only
# reels keep the lighter 22050/mono encoding.
OUTPUT_SAMPLE_RATE_WITH_BGM = 44100
OUTPUT_BITRATE_WITH_BGM = "128k"
OUTPUT_CHANNELS_WITH_BGM = "2"

# Volume reduction applied to bgm before it mixes with speech. -8 dB is the
# baseline "background bed" level even with ducking on; the sidechain
# compressor adds further dynamic reduction during speech.
BGM_BASE_GAIN_DB = -8

# Ducking parameters — research §12.2 calls for -8 to -12 dB additional
# reduction under speech. With ratio=8 + threshold=0.05, speech around -26
# dBFS triggers ~10 dB compression on bgm. attack=5 / release=200 (ms)
# gives a snappy duck-in + ~200 ms tail so the bed doesn't pop back the
# instant a syllable ends.
SIDECHAIN_THRESHOLD = 0.05
SIDECHAIN_RATIO = 8
SIDECHAIN_ATTACK_MS = 5
SIDECHAIN_RELEASE_MS = 200

# Whoosh SFX — short pink-noise burst with bandpass envelope, dropped on
# every hard cut in the speaker audio. The 2026-06-12 audit found the
# synthesized burst reads as a cheap hiss when fired on every seam, so
# the feature is now OPT-IN (REELS_WHOOSH_SFX_ENABLED=1); the de-click
# span fades handle seam masking by default.
WHOOSH_DURATION_S = 0.20
WHOOSH_VOLUME_DB = -10
# Minimum spacing between adjacent whooshes. If cuts cluster tighter than
# this (e.g. the planner removed several short filler-word slivers), only
# the first whoosh fires — overlapping noise bursts buzz.
WHOOSH_MIN_SPACING_S = 0.30
# Bandpass shaping. Below 200 Hz noise sounds muddy; above 2.4 kHz it
# sounds crackly. The 200-2400 Hz window is the "transition swoosh" band
# common in TikTok template SFX.
WHOOSH_HIGHPASS_HZ = 200
WHOOSH_LOWPASS_HZ = 2400
# Opt-in switch. The legacy kill-switch is still honored (it wins) so
# existing deployments that explicitly disabled SFX stay disabled.
_ENABLE_SFX_ENV = "REELS_WHOOSH_SFX_ENABLED"
_DISABLE_SFX_ENV = "REELS_WHOOSH_SFX_DISABLED"


def _whoosh_enabled() -> bool:
    """Whoosh SFX is opt-in (default OFF since the 2026-06-12 audit).
    Read per render so an ops flip takes effect on the next reel
    without a service restart."""
    if os.getenv(_DISABLE_SFX_ENV, "").strip().lower() in ("1", "true", "yes"):
        return False
    return os.getenv(_ENABLE_SFX_ENV, "").strip().lower() in ("1", "true", "yes")


def _compute_cut_points(
    trim_map: list,
    reel_duration_s: float,
) -> list[float]:
    """Pick reel-time positions for whoosh SFX. Returns sorted ascending,
    spaced by at least WHOOSH_MIN_SPACING_S, and trimmed to leave room
    for the whoosh's tail before reel end (otherwise `amix duration=first`
    clips the tail and produces a click).

    The cut points are the boundaries between adjacent kept spans on the
    reel timeline (`trim_map[i].new_t_start` for i ≥ 1). The first span
    starts at t=0 by definition; that's not a cut, it's the reel start.
    """
    if len(trim_map) < 2:
        return []
    # Tail guard — skip whooshes that would be truncated by amix.
    max_t = reel_duration_s - WHOOSH_DURATION_S
    if max_t <= 0:
        return []
    points: list[float] = []
    prev: Optional[float] = None
    for entry in trim_map[1:]:
        t = float(entry.new_t_start)
        if t > max_t:
            continue
        if prev is not None and t - prev < WHOOSH_MIN_SPACING_S:
            continue
        points.append(round(t, 3))
        prev = t
    return points


def _resolve_bgm_url(raw: Optional[str]) -> Optional[str]:
    """Apply the same scheme + whitespace gate to user-supplied bgm URLs
    that we apply to source assets. ffmpeg accepts `file:///etc/passwd`-
    style URLs and we don't trust arbitrary strings off a render request.
    Returns None when the URL is missing or fails validation."""
    if not raw or not isinstance(raw, str):
        return None
    url = raw.strip()
    if not url:
        return None
    lower = url.lower()
    if not (lower.startswith("https://") or lower.startswith("http://")):
        logger.warning(
            f"[AudioEdit] rejecting non-http(s) bgm URL: {url[:80]!r}"
        )
        return None
    return url


# Source URL fallback chain: the indexer's re-encoded MP4 first (browser-
# friendly), then the user's original upload.
def _resolve_source_url(asset) -> Optional[str]:
    # G5: enforce scheme + strip whitespace. Defense in depth — ffmpeg
    # accepts `file:///etc/passwd`-style URLs and would read local files
    # if a malformed entry ever landed in the DB. The indexer only writes
    # https:// URLs but we validate at the consumer too.
    for raw in [(asset.assets_urls or {}).get("source_video"), asset.source_url]:
        if not raw or not isinstance(raw, str):
            continue
        url = raw.strip()
        if not url:
            continue
        # Only http(s) accepted. http:// retained for localhost dev environments.
        lower = url.lower()
        if not (lower.startswith("https://") or lower.startswith("http://")):
            logger.warning(
                f"[AudioEdit] rejecting non-http(s) source URL: {url[:80]!r}"
            )
            continue
        return url
    return None


# ---------------------------------------------------------------------------
# Internal types
# ---------------------------------------------------------------------------

@dataclass
class _KeptSpan:
    """A range to keep, in source-video timecodes."""
    orig_t_start: float
    orig_t_end: float

    @property
    def orig_duration(self) -> float:
        return max(0.0, self.orig_t_end - self.orig_t_start)


@dataclass
class _TrimMapEntry:
    """One kept span with both source and post-trim timestamps."""
    orig_t_start: float
    orig_t_end: float
    new_t_start: float
    new_t_end: float

    def to_dict(self) -> dict:
        return {
            "orig_t_start": round(self.orig_t_start, 3),
            "orig_t_end": round(self.orig_t_end, 3),
            "new_t_start": round(self.new_t_start, 3),
            "new_t_end": round(self.new_t_end, 3),
        }


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class ReelsAudioEditService:
    """Runs the AUDIO_EDIT stage."""

    def __init__(self, s3: Optional[S3Service] = None):
        self._s3 = s3
        self._ffmpeg = shutil.which("ffmpeg") or "ffmpeg"

    def _ensure_s3(self) -> S3Service:
        if self._s3 is None:
            self._s3 = S3Service()
        return self._s3

    def run(self, ctx: RenderContext) -> None:
        """Execute AUDIO_EDIT on the given render context. Writes
        `ctx.s3_urls['speaker_audio']` and `ctx.trim_map` on success.
        Raises on any error — orchestrator catches and writes FAILED.

        This is a SYNC method — ffmpeg subprocess and boto3 upload are both
        blocking. The async stage wrapper offloads to a thread so the
        asyncio loop doesn't stall."""
        # 1. Resolve the source asset to get the source_video URL.
        asset_repo = AiInputAssetRepository()
        asset = asset_repo.get_by_id(ctx.input_asset_id)
        if asset is None:
            raise RuntimeError(f"Source asset {ctx.input_asset_id} not found")
        source_url = _resolve_source_url(asset)
        if not source_url:
            raise RuntimeError(
                f"Source asset {ctx.input_asset_id} has no source_video / source_url"
            )

        # 2. Resolve the candidate to get cut_plan + source window.
        win_t_start = float(ctx.source_window.get("t_start", 0.0))
        win_t_end = float(ctx.source_window.get("t_end", 0.0))
        if win_t_end <= win_t_start:
            raise RuntimeError(
                f"Invalid source window: {win_t_start} → {win_t_end}"
            )

        cut_plan = self._resolve_cut_plan(ctx, win_t_start, win_t_end)

        # 3. Resolve speed multiplier.
        speed = 1.0
        pace = (ctx.config or {}).get("pace") or {}
        try:
            sm = float(pace.get("speed_multiplier") or 1.0)
            # atempo supports 0.5..100 per filter; we clamp to our config range.
            speed = max(1.0, min(1.5, sm))
        except (TypeError, ValueError):
            pass

        # 4. Compute kept spans and trim map.
        kept_spans = self._compute_kept_spans(win_t_start, win_t_end, cut_plan)
        if not kept_spans:
            raise RuntimeError(
                "Cut plan removes the entire window — no audio to produce"
            )
        trim_map = self._build_trim_map(kept_spans, speed)
        # Final reel duration (post-atempo) — needed to bound the bgm trim
        # since `-stream_loop -1 -i` would otherwise feed amix indefinitely.
        reel_duration = trim_map[-1].new_t_end if trim_map else 0.0

        # 5. Resolve background-music config. Only activates when the user
        # selected `keep_speaker_plus_bgm` AND provided a valid http(s) URL.
        # Otherwise we silently fall back to speaker-only — matches what
        # most config-form misconfigurations should produce.
        audio_strategy = str((ctx.config or {}).get("audio_strategy") or "keep_speaker")
        bgm_url = None
        ducking = True
        if audio_strategy == "keep_speaker_plus_bgm":
            bgm_url = _resolve_bgm_url((ctx.config or {}).get("background_music_url"))
            ducking = bool((ctx.config or {}).get("ducking", True))
            if bgm_url is None:
                logger.info(
                    f"[AudioEdit] {ctx.reel_id} requested bgm but no usable URL — "
                    "falling back to speaker-only"
                )

        # 6. Pick reel-time positions for whoosh SFX. Empty list if the
        # env kill-switch is on, the reel has no cuts (only 1 kept span),
        # or after dedup / tail-trim nothing remains.
        cut_points = (
            _compute_cut_points(trim_map, reel_duration) if _whoosh_enabled() else []
        )

        # 7. Run ffmpeg to produce the final audio.
        with tempfile.TemporaryDirectory(prefix="reels-audio-") as tmpdir:
            out_path = Path(tmpdir) / f"{ctx.reel_id}.mp3"
            self._run_ffmpeg(
                source_url=source_url,
                win_t_start=win_t_start,
                win_duration=win_t_end - win_t_start,
                kept_spans_relative=[
                    (s.orig_t_start - win_t_start, s.orig_t_end - win_t_start)
                    for s in kept_spans
                ],
                speed=speed,
                bgm_url=bgm_url,
                ducking=ducking,
                reel_duration_s=reel_duration,
                whoosh_points=cut_points,
                out_path=out_path,
            )

            if not out_path.exists() or out_path.stat().st_size == 0:
                raise RuntimeError("ffmpeg produced no audio output")

            # 7. Upload to S3.
            s3 = self._ensure_s3()
            s3_key = f"ai-reels/{ctx.reel_id}/speaker_audio-{uuid4().hex[:8]}.mp3"
            url = s3.upload_file(out_path, s3_key=s3_key, content_type="audio/mpeg")

        # 8. Write back to the context. The orchestrator persists at completion.
        ctx.s3_urls["speaker_audio"] = url
        ctx.trim_map = {
            "spans": [e.to_dict() for e in trim_map],
            "speed_multiplier": speed,
            "window_t_start": round(win_t_start, 3),
            "window_t_end": round(win_t_end, 3),
            "total_new_duration_s": (
                round(trim_map[-1].new_t_end, 3) if trim_map else 0.0
            ),
        }
        # Track audio-mix mode for audit + so the FE can show "music + ducking"
        # on the reel detail page once we wire that. SFX is independent of
        # the bgm/ducking branch — recorded as a separate count.
        ctx.extra_metadata["audio_mode"] = (
            "speaker_plus_bgm_ducked" if (bgm_url and ducking)
            else "speaker_plus_bgm" if bgm_url
            else "speaker_only"
        )
        ctx.extra_metadata["whoosh_sfx_count"] = len(cut_points)
        logger.info(
            f"[AudioEdit] {ctx.reel_id} kept {len(kept_spans)} spans, "
            f"speed={speed}x, mode={ctx.extra_metadata['audio_mode']}, "
            f"whoosh_sfx={len(cut_points)}, "
            f"final duration={ctx.trim_map['total_new_duration_s']}s"
        )

    # ── Helpers ───────────────────────────────────────────────────────────

    def _resolve_cut_plan(
        self,
        ctx: RenderContext,
        win_t_start: float,
        win_t_end: float,
    ) -> list[tuple[float, float]]:
        """Pull cut_plan from the SNAPSHOT in ctx.config (preferred) or fall
        back to the candidate row's current `enriched` (legacy reels that
        predate the snapshot). Returns a sorted, non-overlapping list of
        (t_start, t_end) ranges to remove. Empty list = no cuts.

        G4: Reading the snapshot — captured at /render dispatch — protects
        an in-flight render from being silently corrupted by a concurrent
        /preview re-run that changes candidate.enriched.

        PaceConfig.silence_trim is honored HERE and only here: the kept
        spans computed from this list become the trim_map that AUDIO_EDIT,
        SOURCE_CLIP and the DIRECTOR caption remap all consume, so dropping
        kind="silence" spans at this single point keeps video + audio +
        captions in lockstep automatically.
        """
        # Preferred: snapshot captured at /render dispatch.
        snapshot = (ctx.config or {}).get("enriched_snapshot")
        if isinstance(snapshot, dict):
            raw_cuts = snapshot.get("cut_plan") or []
        else:
            # Legacy fallback: read live candidate row. This path will only
            # fire for reels created before the snapshot field was added.
            if not ctx.candidate_id:
                return []
            candidate = AiReelCandidateRepository().get_by_id(ctx.candidate_id)
            if candidate is None or not candidate.enriched:
                return []
            raw_cuts = (candidate.enriched or {}).get("cut_plan") or []
        pace = (ctx.config or {}).get("pace") or {}
        silence_mode = str(pace.get("silence_trim") or "on").strip().lower()
        cuts: list[tuple[float, float]] = []
        for c in raw_cuts:
            if not isinstance(c, dict):
                continue
            try:
                ts = float(c.get("t_start", 0.0))
                te = float(c.get("t_end", 0.0))
            except (TypeError, ValueError):
                continue
            if str(c.get("kind") or "word") == "silence":
                if silence_mode == "off":
                    continue
                if silence_mode == "gentle" and (te - ts) < GENTLE_MIN_SILENCE_SPAN_S:
                    continue
            # Clip to window edges + drop spans that fell entirely outside.
            ts = max(ts, win_t_start)
            te = min(te, win_t_end)
            if te - ts >= 0.05:  # ignore sub-50ms slivers
                cuts.append((ts, te))
        cuts.sort()
        # Merge overlapping (planner should produce non-overlapping but be
        # defensive — overlaps would break the kept-spans computation).
        merged: list[tuple[float, float]] = []
        for ts, te in cuts:
            if merged and ts <= merged[-1][1]:
                merged[-1] = (merged[-1][0], max(merged[-1][1], te))
            else:
                merged.append((ts, te))
        return merged

    @staticmethod
    def _compute_kept_spans(
        win_t_start: float,
        win_t_end: float,
        cuts: list[tuple[float, float]],
    ) -> list[_KeptSpan]:
        """Subtract cuts from [win_t_start, win_t_end]. Returns the kept
        spans in source timecodes, ordered. Drops sub-MIN_KEPT_SPAN_S
        fragments."""
        if not cuts:
            return [_KeptSpan(win_t_start, win_t_end)]
        spans: list[_KeptSpan] = []
        cursor = win_t_start
        for ts, te in cuts:
            if ts > cursor:
                if ts - cursor >= MIN_KEPT_SPAN_S:
                    spans.append(_KeptSpan(cursor, ts))
            cursor = max(cursor, te)
        if win_t_end - cursor >= MIN_KEPT_SPAN_S:
            spans.append(_KeptSpan(cursor, win_t_end))
        return spans

    @staticmethod
    def _build_trim_map(
        kept_spans: list[_KeptSpan],
        speed: float,
    ) -> list[_TrimMapEntry]:
        """For each kept span, compute its position in the post-trim timeline."""
        if not kept_spans:
            return []
        entries: list[_TrimMapEntry] = []
        # Window-relative cursor advances by each span's duration (pre-atempo);
        # we divide by speed for the post-atempo new timestamps.
        rel_cursor = 0.0
        for s in kept_spans:
            new_t_start = rel_cursor / speed
            rel_cursor += s.orig_duration
            new_t_end = rel_cursor / speed
            entries.append(_TrimMapEntry(
                orig_t_start=s.orig_t_start,
                orig_t_end=s.orig_t_end,
                new_t_start=new_t_start,
                new_t_end=new_t_end,
            ))
        return entries

    def _run_ffmpeg(
        self,
        *,
        source_url: str,
        win_t_start: float,
        win_duration: float,
        kept_spans_relative: list[tuple[float, float]],
        speed: float,
        bgm_url: Optional[str],
        ducking: bool,
        reel_duration_s: float,
        whoosh_points: list[float],
        out_path: Path,
    ) -> None:
        """Single ffmpeg invocation that produces the final audio.

        Three independent optional layers fan in to the final mix:
          1. Speaker (always present): atrim+concat each kept span, then atempo.
          2. BGM (when `bgm_url` is set): aresample+atrim+volume+sidechain.
          3. SFX whooshes (when `whoosh_points` non-empty): per-cut pink-noise
             burst with bandpass envelope, positioned via adelay.

        Each present layer produces a single labeled output; we then run
        ONE amix of N≥2 inputs (or pass through if only speaker is
        present). Mixed-rate inputs are handled by ffmpeg's auto-aresample.

        Speaker-only (no bgm, no SFX):
          [0:a]atrim=…,asetpts=PTS-STARTPTS[a0]…
          [a0][a1]…concat=n=N:v=0:a=1[ac]      (skipped if N==1)
          [ac]atempo=K[speaker]                  (skipped if speed==1.0)
          → encoded mono 22050Hz

        Speaker + bgm (+ optional ducking):
          Same speaker chain (with aresample=44100 inserted so sidechain
          matches), then:
            [1:a]aresample=44100,atrim=duration=<reel_dur>,volume=-8dB[bgm_quiet]
            (ducking) [bgm_quiet][speaker]sidechaincompress=…[bgm_ducked]
          → encoded stereo 44100Hz so music doesn't sound crunchy.

        Speaker + SFX (each cut → one whoosh):
          anoisesrc=color=pink:duration=0.2:sample_rate=…,bandpass,fade,
            volume=-10dB,adelay=<cut_ms>:all=1[w0]
          (multiple) [w0][w1]…amix=inputs=N:duration=longest[sfx]

        Final mix layers in order [speaker]+[bgm]+[sfx]. amix with
        duration=first keeps the result bounded to the speaker — SFX
        bursts past the end (we already trim those upstream in
        `_compute_cut_points`) and bgm loops are atrimmed.
        """
        has_bgm = bgm_url is not None
        has_sfx = bool(whoosh_points)
        # Bump the speaker chain to 44.1kHz when bgm is in play so the
        # sidechain compressor doesn't have to deal with mismatched rates.
        # SFX alone doesn't require this — amix auto-aresamples mono SFX
        # against mono speaker at 22050.
        aresample_prefix = "aresample=44100," if has_bgm else ""

        filter_lines: list[str] = []
        labels: list[str] = []
        multi_span = len(kept_spans_relative) > 1
        for i, (ts, te) in enumerate(kept_spans_relative):
            label = f"a{i}"
            labels.append(f"[{label}]")
            # atrim end is inclusive of the keyframe; asetpts resets timestamps
            # so concat doesn't see overlapping PTS.
            # When the plan has cuts, ramp each span's head/tail with a 6ms
            # qsin fade so mid-cycle cut points can't click at the seam.
            fade = ""
            span_d = te - ts
            if multi_span and span_d > 0.05:
                fade_out_st = max(0.0, span_d - SPAN_DECLICK_FADE_S)
                fade = (
                    f",afade=t=in:d={SPAN_DECLICK_FADE_S:.3f}:curve=qsin"
                    f",afade=t=out:st={fade_out_st:.4f}:d={SPAN_DECLICK_FADE_S:.3f}:curve=qsin"
                )
            filter_lines.append(
                f"[0:a]{aresample_prefix}atrim=start={ts:.4f}:end={te:.4f},"
                f"asetpts=PTS-STARTPTS{fade}[{label}]"
            )

        # Concatenate (only needed when more than one span).
        if len(labels) == 1:
            concat_out = labels[0]
        else:
            concat_out = "[ac]"
            filter_lines.append(
                f"{''.join(labels)}concat=n={len(labels)}:v=0:a=1{concat_out}"
            )

        # Atempo. atempo's per-filter range is 0.5-100; values within 0.5..2.0
        # are recommended single-pass for quality. Our config caps at 1.5.
        if abs(speed - 1.0) < 1e-6:
            speaker_label = concat_out
        else:
            filter_lines.append(f"{concat_out}atempo={speed:.4f}[speaker]")
            speaker_label = "[speaker]"

        # The final mix is composed of [speaker] + optional [bgm_final] +
        # optional [sfx_final]. We build each layer's label, then run a
        # single N-input amix at the end.
        mix_inputs: list[str] = [speaker_label]

        # BGM branch — only when we have a validated URL AND a positive
        # reel duration (otherwise atrim would be a no-op and amix returns
        # empty).
        if has_bgm and reel_duration_s > 0.1:
            # Bound the bgm to the reel's length so `-stream_loop -1` on
            # the input doesn't push amix forever.
            filter_lines.append(
                f"[1:a]aresample=44100,atrim=duration={reel_duration_s:.4f},"
                f"asetpts=PTS-STARTPTS,volume={BGM_BASE_GAIN_DB:+d}dB[bgm_quiet]"
            )
            if ducking:
                # A labeled pad can only be consumed ONCE in a filtergraph.
                # The speaker feeds both the sidechain detector AND the final
                # mix, so split it first — without the asplit ffmpeg rejects
                # the graph and every ducked-bgm render fails outright.
                filter_lines.append(f"{speaker_label}asplit=2[spk_mix][spk_sc]")
                mix_inputs[0] = "[spk_mix]"
                filter_lines.append(
                    f"[bgm_quiet][spk_sc]sidechaincompress="
                    f"threshold={SIDECHAIN_THRESHOLD:.3f}:"
                    f"ratio={SIDECHAIN_RATIO}:"
                    f"attack={SIDECHAIN_ATTACK_MS}:"
                    f"release={SIDECHAIN_RELEASE_MS}:"
                    f"level_sc=1[bgm_ducked]"
                )
                mix_inputs.append("[bgm_ducked]")
            else:
                mix_inputs.append("[bgm_quiet]")

        # SFX branch — one whoosh per cut, all mixed into a single track.
        # Sample rate matches the speaker's so amix doesn't have to
        # resample (mostly cosmetic; ffmpeg auto-aresamples either way).
        if has_sfx:
            sfx_rate = 44100 if has_bgm else OUTPUT_SAMPLE_RATE
            whoosh_labels: list[str] = []
            for i, t in enumerate(whoosh_points):
                delay_ms = int(round(t * 1000))
                label = f"w{i}"
                whoosh_labels.append(f"[{label}]")
                # afade out starts at duration - tail so the burst tapers
                # cleanly into silence before the next sample begins.
                fade_out_start = max(0.01, WHOOSH_DURATION_S - 0.12)
                filter_lines.append(
                    f"anoisesrc=color=pink:duration={WHOOSH_DURATION_S:.3f}"
                    f":sample_rate={sfx_rate}:amplitude=0.95"
                    f",aformat=channel_layouts=mono"
                    f",highpass=f={WHOOSH_HIGHPASS_HZ}"
                    f",lowpass=f={WHOOSH_LOWPASS_HZ}"
                    f",afade=t=in:d=0.025:curve=qsin"
                    f",afade=t=out:st={fade_out_start:.3f}:d=0.12:curve=qsin"
                    f",volume={WHOOSH_VOLUME_DB:+d}dB"
                    f",adelay={delay_ms}:all=1"
                    f"[{label}]"
                )
            if len(whoosh_labels) == 1:
                sfx_final = whoosh_labels[0]
            else:
                filter_lines.append(
                    f"{''.join(whoosh_labels)}amix=inputs={len(whoosh_labels)}"
                    f":duration=longest:dropout_transition=0:normalize=0[sfx]"
                )
                sfx_final = "[sfx]"
            mix_inputs.append(sfx_final)

        # Single final mix. duration=first keeps the result bounded to
        # the speaker's length. normalize=0 preserves loudness levels —
        # the default normalize=1 would halve every layer's volume.
        if len(mix_inputs) == 1:
            final_label = mix_inputs[0]
        else:
            filter_lines.append(
                f"{''.join(mix_inputs)}amix=inputs={len(mix_inputs)}"
                f":duration=first:dropout_transition=0:normalize=0[mix]"
            )
            final_label = "[mix]"

        # Loudness mastering — normalize the finished mix to the social-feed
        # target so reel volume doesn't track the source recording level.
        filter_lines.append(f"{final_label}{LOUDNORM_FILTER}[mastered]")
        final_label = "[mastered]"

        filter_complex = ";".join(filter_lines)

        cmd = [
            self._ffmpeg,
            "-hide_banner", "-loglevel", "error", "-y",
            # -ss/-t before -i = fast seek via HTTPS range, then bounded read.
            "-ss", f"{max(0.0, win_t_start):.3f}",
            "-t", f"{max(0.0, win_duration):.3f}",
            "-i", source_url,
        ]
        if has_bgm:
            # `-stream_loop -1` loops the music indefinitely — bounded by
            # the atrim filter above. Must be placed BEFORE the -i it
            # applies to.
            cmd.extend(["-stream_loop", "-1", "-i", bgm_url])
        cmd.extend([
            "-filter_complex", filter_complex,
            "-map", final_label,
            "-vn",
            "-acodec", "libmp3lame",
        ])
        if has_bgm:
            cmd.extend([
                "-ar", str(OUTPUT_SAMPLE_RATE_WITH_BGM),
                "-b:a", OUTPUT_BITRATE_WITH_BGM,
                "-ac", OUTPUT_CHANNELS_WITH_BGM,
            ])
        else:
            cmd.extend([
                "-ar", str(OUTPUT_SAMPLE_RATE),
                "-b:a", OUTPUT_BITRATE,
                "-ac", "1",  # mono — saves bandwidth, fine for speech-only
            ])
        cmd.append(str(out_path))

        try:
            subprocess.run(
                cmd,
                check=True,
                capture_output=True,
                timeout=FFMPEG_TIMEOUT_S,
            )
        except subprocess.TimeoutExpired:
            raise RuntimeError(
                f"AUDIO_EDIT ffmpeg timed out after {FFMPEG_TIMEOUT_S}s"
            )
        except subprocess.CalledProcessError as e:
            stderr = (e.stderr or b"").decode("utf-8", errors="replace")[:500]
            raise RuntimeError(f"AUDIO_EDIT ffmpeg failed: {stderr}")


# ---------------------------------------------------------------------------
# Stage registration
# ---------------------------------------------------------------------------

async def _audio_edit_stage(ctx: RenderContext) -> None:
    """Async handler the orchestrator calls. Offloads the blocking
    ffmpeg + S3-upload work to a worker thread so the asyncio loop stays
    responsive for any concurrent renders running on the same process."""
    svc = ReelsAudioEditService()
    await asyncio.to_thread(svc.run, ctx)


# Replace the orchestrator's no-op handler with the real one at import time.
register_stage_handler(STAGE_AUDIO_EDIT, _audio_edit_stage)
