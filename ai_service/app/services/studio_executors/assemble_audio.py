"""
ASSEMBLE_AUDIO stage (P7) — give the build a real soundtrack.

Two jobs, with different failure contracts:

1. MASTER AUDIO (fail-loud — this is the silent-MP4 fix): assemble the
   soundtrack from the SOURCE_CLIP entries via `studio_master_audio` (ffmpeg
   `-ss/-t` range reads → adelay → amix over an anullsrc anchor), upload it as
   `ai-studio/{build_id}/master_audio.mp3` → `s3_urls.audio`. The render
   service passes it as the worker's required `audio_url`. The render worker
   never extracts source-clip audio (it composites pixels only), so a build
   without this track renders MUTE — an ffmpeg failure here must FAIL the
   build, not ship a silent video. Image-only builds legitimately skip.

2. BGM (best-effort — garnish, like captions): when the confirmed audio plan
   enables `propose_bgm`, attach ONE background-music track to
   `timeline.meta.audio_tracks` — the render worker already mixes those
   (adelay/volume/afade + amix) and the editor's AudioTracksPanel previews and
   edits them; zero worker changes. The bed is either the user's own URL
   (`manual_bgm`) or generated via fal/ElevenLabs (≤22s loopable bed,
   loop-extended to the video duration). Any hiccup logs, records why in
   `extra_metadata['bgm']`, and ships the build without music.

Whoosh SFX (`propose_sfx`) are synthesized pink-noise stingers baked into the
master track at cut points — no assets, no extra mix path.

Runs after ASSEMBLE_WORDS and before UPLOAD: the BGM track mutates
`ctx.timeline.meta`, which UPLOAD serializes.
"""
from __future__ import annotations

import asyncio
import logging
import tempfile
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from ..studio_master_audio import (
    DEFAULT_WHOOSH_VOLUME_DB,
    build_master_audio,
    loop_bed_to_duration,
)
from ..studio_orchestrator import STAGE_ASSEMBLE_AUDIO, BuildContext, register_stage_handler

logger = logging.getLogger(__name__)

_DEFAULT_BGM_VOLUME = 0.12
# Track id is stable so a re-build replaces rather than stacks the bed, and the
# FE can recognize the generated track.
_BGM_TRACK_ID = "background-music"


def _audio_ops(plan_snapshot: dict) -> list:
    audio = (plan_snapshot or {}).get("audio") or {}
    return list(audio.get("operations") or []) + list(audio.get("manual_operations") or [])


def _find_op(plan_snapshot: dict, tool: str) -> Optional[Dict[str, Any]]:
    for op in _audio_ops(plan_snapshot):
        if isinstance(op, dict) and op.get("tool") == tool and isinstance(op.get("params"), dict):
            return op["params"]
    return None


def _is_http_url(url: Any) -> bool:
    return isinstance(url, str) and url.lower().startswith(("http://", "https://"))


def _sfx_config(plan_snapshot: dict, sfx_policy: str = "auto") -> Tuple[bool, str, float]:
    """(enabled, placement, volume_db) from the confirmed propose_sfx op.
    `sfx_policy='never'` is a hard project rule — it wins over a confirmed op
    (confirm is not re-validated server-side, so enforce here too)."""
    params = _find_op(plan_snapshot, "propose_sfx") or {}
    enabled = bool(params.get("enabled")) and sfx_policy != "never"
    placement = params.get("placement")
    if placement not in ("segment_boundaries", "all_cuts"):
        placement = "segment_boundaries"
    try:
        volume_db = float(params.get("volume_db", DEFAULT_WHOOSH_VOLUME_DB))
    except (TypeError, ValueError):
        volume_db = DEFAULT_WHOOSH_VOLUME_DB
    return enabled, placement, max(-30.0, min(0.0, volume_db))


def _bgm_request(plan_snapshot: dict, bgm_policy: str = "auto") -> Optional[Dict[str, Any]]:
    """Resolve the confirmed BGM intent. A user-supplied `manual_bgm` URL wins
    over generation; returns None when BGM is off/absent. `bgm_policy='never'`
    is a hard project rule — the plan-time validator drops the op, but confirm
    persists losslessly without re-validation, so a hand-confirmed op (or a
    direct API caller) must not incur generation cost here either."""
    if bgm_policy == "never":
        return None
    manual = _find_op(plan_snapshot, "manual_bgm") or {}
    manual_url = manual.get("url")
    if _is_http_url(manual_url):
        return {
            "source": "manual",
            "url": manual_url.strip(),
            "volume": manual.get("volume"),
        }
    params = _find_op(plan_snapshot, "propose_bgm")
    if not params or not params.get("enabled"):
        return None
    return {
        "source": "generated",
        "prompt": str(params.get("music_prompt") or params.get("mood") or "neutral ambient"),
        "volume": params.get("volume"),
    }


def _bgm_volume(raw: Any) -> float:
    try:
        vol = float(raw)
    except (TypeError, ValueError):
        return _DEFAULT_BGM_VOLUME
    # 0.0 is a legitimate choice (track present but silent) — only invalid
    # values fall back to the default.
    return round(max(0.0, min(0.5, vol)), 3)


def _generate_bgm_url(ctx: BuildContext, prompt: str, total_duration: float) -> str:
    """Sync: generate a ≤22s loopable bed (fal/ElevenLabs), loop-extend it to
    the video duration, upload to S3. Raises on any failure (caller treats BGM
    as best-effort)."""
    from ..fal_elevenlabs_client import (
        FalElevenLabsClient,
        generate_music_bed,
        get_fal_api_key_from_env,
    )
    from ..s3_service import S3Service

    api_key = get_fal_api_key_from_env()
    if not api_key:
        raise RuntimeError("no_provider: FAL_API_KEY unset")

    client = FalElevenLabsClient(api_key=api_key)
    result = generate_music_bed(client, prompt)
    if not result.audio_bytes:
        raise RuntimeError("music bed returned no audio bytes")
    ctx.extra_metadata["bgm_cost_usd"] = result.cost_usd

    with tempfile.TemporaryDirectory(prefix="studio-bgm-") as tmp:
        bed = Path(tmp) / f"bed.{result.output_format or 'mp3'}"
        bed.write_bytes(result.audio_bytes)
        looped = loop_bed_to_duration(bed, total_duration, Path(tmp) / "bgm.mp3")
        return S3Service().upload_file(
            looped,
            s3_key=f"ai-studio/{ctx.build_id}/bgm.mp3",
            content_type="audio/mpeg",
        )


def _attach_bgm_track(timeline: dict, url: str, volume: float) -> None:
    """Set the single Studio BGM track on meta.audio_tracks — same shape the
    render worker mixes and the editor's AudioTracksPanel edits
    ({id,label,url,volume,delay,fadeIn,fadeOut}, camelCase fades)."""
    meta = timeline.setdefault("meta", {})
    tracks = [t for t in (meta.get("audio_tracks") or []) if t.get("id") != _BGM_TRACK_ID]
    tracks.append({
        "id": _BGM_TRACK_ID,
        "label": "Background music",
        "url": url,
        "volume": volume,
        "delay": 0,
        "fadeIn": 2.0,
        "fadeOut": 3.0,
    })
    meta["audio_tracks"] = tracks


def _video_only_handles(ctx: BuildContext) -> frozenset:
    """Handles the user marked `video_only` (strip source audio) — their clips
    must not contribute to the master mix."""
    muted = set()
    for ref in ctx.source_asset_refs or []:
        if not isinstance(ref, dict):
            continue
        overrides = ref.get("overrides") or {}
        if isinstance(overrides, dict) and overrides.get("video_only"):
            handle = ref.get("handle")
            if handle:
                muted.add(handle)
    return frozenset(muted)


def _assemble_master_audio(ctx: BuildContext, sfx: Tuple[bool, str, float]) -> None:
    """Sync: build + upload the master track. Raises on ffmpeg/S3 failure."""
    from ..s3_service import S3Service

    sfx_enabled, placement, volume_db = sfx
    with tempfile.TemporaryDirectory(prefix="studio-audio-") as tmp:
        path = build_master_audio(
            ctx.timeline, Path(tmp),
            sfx_enabled=sfx_enabled, sfx_placement=placement, sfx_volume_db=volume_db,
            exclude_handles=_video_only_handles(ctx),
        )
        if path is None:
            # Image-only build — render falls back to the silent master.
            ctx.extra_metadata["master_audio"] = "none"
            logger.info(f"[StudioBuild] {ctx.build_id} no source-clip audio — master audio skipped")
            return
        url = S3Service().upload_file(
            path,
            s3_key=f"ai-studio/{ctx.build_id}/master_audio.mp3",
            content_type="audio/mpeg",
        )
    ctx.s3_urls["audio"] = url
    total = float(((ctx.timeline or {}).get("meta") or {}).get("total_duration") or 0)
    ctx.extra_metadata["master_audio_seconds"] = round(total, 3)
    if sfx_enabled:
        ctx.extra_metadata["sfx_placement"] = placement
    logger.info(f"[StudioBuild] {ctx.build_id} master audio → {url}")


async def _assemble_audio_stage(ctx: BuildContext) -> None:
    if not ctx.timeline:
        raise ValueError("no timeline to score (ASSEMBLE_TIMELINE must run first)")

    prefs = ctx.preferences or {}
    bgm_policy = str(prefs.get("bgm_policy") or "auto")
    sfx_policy = str(prefs.get("sfx_policy") or "auto")

    # 1) BGM — best-effort enhancement, mirrors ASSEMBLE_WORDS' contract.
    bgm = _bgm_request(ctx.plan_snapshot or {}, bgm_policy)
    if bgm:
        try:
            volume = _bgm_volume(bgm.get("volume"))
            total = float((ctx.timeline.get("meta") or {}).get("total_duration") or 0) or 1.0
            if bgm["source"] == "manual":
                url = bgm["url"]
            else:
                url = await asyncio.to_thread(_generate_bgm_url, ctx, bgm["prompt"], total)
            _attach_bgm_track(ctx.timeline, url, volume)
            ctx.extra_metadata["bgm"] = bgm["source"]
            logger.info(f"[StudioBuild] {ctx.build_id} bgm ({bgm['source']}) → attached")
        except Exception as e:
            ctx.extra_metadata["bgm"] = f"skipped: {e}"[:200]
            logger.warning(f"[StudioBuild] {ctx.build_id} bgm skipped ({e})")

    # 2) Master audio — the soundtrack itself. Fail-loud (see module docstring).
    await asyncio.to_thread(
        _assemble_master_audio, ctx, _sfx_config(ctx.plan_snapshot or {}, sfx_policy)
    )


register_stage_handler(STAGE_ASSEMBLE_AUDIO, _assemble_audio_stage)
