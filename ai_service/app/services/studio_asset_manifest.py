"""
Asset-manifest builder for the Studio wizard's LLM steps.

Given a project's `source_asset_refs` (+ per-asset `AssetOverrides`), this
fetches each indexed asset's metadata artifact (video_context.json /
image_metadata.json) and produces a compact, prompt-sized digest the LLM can
reason over: handle, kind/mode, duration, a transcript digest (sentence-level
with timestamps), scene count, face info, plus image OCR + caption.

Design notes:
  * Digests are PRUNED to keep the prompt bounded — transcript is capped at
    `MAX_TRANSCRIPT_SENTENCES` evenly-sampled sentences; each sentence text is
    truncated. A 1-hour podcast must not blow the context window.
  * Per-asset `AssetOverrides.initial_range_s` clips the digest to that window
    so the LLM only sees the slice the user pre-selected. `exclude_ranges_s`
    and `notes` are surfaced verbatim so the model respects them.
  * Network + parse failures degrade to a minimal digest (handle + kind +
    duration) rather than failing the whole manifest — a missing transcript
    shouldn't block arrangement planning.
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence

import httpx

from ..models.ai_input_asset import AiInputAsset
from ..schemas.studio_projects import AssetRef

logger = logging.getLogger(__name__)

# Prompt-budget caps.
MAX_TRANSCRIPT_SENTENCES = 40
MAX_SENTENCE_CHARS = 160
MAX_TAGS = 12
_FETCH_TIMEOUT_S = 20.0
_FETCH_MAX_BYTES = 12 * 1024 * 1024  # 12 MB — context JSON is ~1-2 MB for 1hr


@dataclass
class AssetDigest:
    """One asset's prompt-ready digest. `to_prompt_dict` drops None fields."""
    handle: str
    asset_id: str
    kind: str
    mode: Optional[str]
    duration_s: Optional[float] = None
    transcript_digest: Optional[List[Dict[str, Any]]] = None
    scene_count: Optional[int] = None
    face_count: Optional[int] = None
    free_regions: Optional[List[str]] = None
    topic_keywords: Optional[List[str]] = None
    # Image-only
    ocr_summary: Optional[str] = None
    caption_short: Optional[str] = None
    dimensions: Optional[List[int]] = None
    # Echoed-back user overrides so the LLM honors them.
    used_range_s: Optional[List[float]] = None
    excluded_ranges_s: Optional[List[List[float]]] = None
    stream_hint: Optional[str] = None
    user_note: Optional[str] = None

    def to_prompt_dict(self) -> Dict[str, Any]:
        out: Dict[str, Any] = {
            "handle": self.handle,
            "kind": self.kind,
        }
        if self.mode:
            out["mode"] = self.mode
        for key in (
            "duration_s", "transcript_digest", "scene_count", "face_count",
            "free_regions", "topic_keywords", "ocr_summary", "caption_short",
            "dimensions", "used_range_s", "excluded_ranges_s", "stream_hint",
            "user_note",
        ):
            val = getattr(self, key)
            if val is not None and val != []:
                out[key] = val
        return out


async def _fetch_json(url: str) -> Optional[dict]:
    """GET a metadata artifact. Returns None on any failure (logged)."""
    if not url:
        return None
    try:
        async with httpx.AsyncClient(timeout=_FETCH_TIMEOUT_S) as client:
            resp = await client.get(url, headers={"User-Agent": "VacademyStudio/1.0"})
            if resp.status_code != 200:
                logger.warning(f"[studio-manifest] {resp.status_code} fetching {url[:120]}")
                return None
            if len(resp.content) > _FETCH_MAX_BYTES:
                logger.warning(f"[studio-manifest] artifact too large ({len(resp.content)}B): {url[:120]}")
                return None
            return resp.json()
    except Exception as e:
        logger.warning(f"[studio-manifest] fetch failed for {url[:120]}: {e}")
        return None


def _clip(start: float, end: float, window: Optional[Sequence[float]]) -> bool:
    """True if [start,end] sentence overlaps the user's initial_range window."""
    if window is None:
        return True
    ws, we = window[0], window[1]
    return end > ws and start < we


def _summarize_transcript(
    transcript: List[dict],
    window: Optional[Sequence[float]],
) -> List[Dict[str, Any]]:
    """Sentence-level digest, clipped to `window`, evenly downsampled to cap."""
    rows = [
        s for s in transcript
        if isinstance(s, dict) and _clip(
            float(s.get("start", 0) or 0), float(s.get("end", 0) or 0), window
        )
    ]
    if len(rows) > MAX_TRANSCRIPT_SENTENCES:
        step = len(rows) / MAX_TRANSCRIPT_SENTENCES
        rows = [rows[int(i * step)] for i in range(MAX_TRANSCRIPT_SENTENCES)]
    digest: List[Dict[str, Any]] = []
    for s in rows:
        text = str(s.get("text", "")).strip()
        if len(text) > MAX_SENTENCE_CHARS:
            text = text[: MAX_SENTENCE_CHARS - 1].rstrip() + "…"
        digest.append({
            "t_start": round(float(s.get("start", 0) or 0), 2),
            "t_end": round(float(s.get("end", 0) or 0), 2),
            "text": text,
        })
    return digest


def _topic_keywords(ctx: dict) -> Optional[List[str]]:
    """Synthesize a small keyword set from emphasis marks (no LLM)."""
    emphasis = ctx.get("emphasis")
    if not isinstance(emphasis, list):
        return None
    seen: List[str] = []
    for e in emphasis:
        w = str((e or {}).get("word", "")).strip().lower()
        if w and w not in seen and len(w) > 3:
            seen.append(w)
        if len(seen) >= 8:
            break
    return seen or None


def _video_digest(ref: AssetRef, ctx: dict) -> AssetDigest:
    meta = ctx.get("meta") or {}
    window = list(ref.overrides.initial_range_s) if (ref.overrides and ref.overrides.initial_range_s) else None
    transcript = ctx.get("transcript") if isinstance(ctx.get("transcript"), list) else []
    scenes = ctx.get("scenes") if isinstance(ctx.get("scenes"), list) else []
    faces = ctx.get("face_segments") if isinstance(ctx.get("face_segments"), list) else []
    free_regions: List[str] = []
    for fs in faces[:1]:
        fr = (fs or {}).get("free_regions")
        if isinstance(fr, list):
            free_regions = fr
    ov = ref.overrides
    return AssetDigest(
        handle=ref.handle,
        asset_id=ref.asset_id,
        kind="video",
        mode=ref.mode,
        duration_s=round(float(meta.get("duration_s", 0) or 0), 2) or None,
        transcript_digest=_summarize_transcript(transcript, window) or None,
        scene_count=len(scenes) or None,
        face_count=len(faces) or None,
        free_regions=free_regions or None,
        topic_keywords=_topic_keywords(ctx),
        used_range_s=window,
        excluded_ranges_s=(
            [list(r) for r in ov.exclude_ranges_s]
            if ov and ov.exclude_ranges_s else None
        ),
        stream_hint=(
            "audio_only" if (ov and ov.audio_only)
            else "video_only" if (ov and ov.video_only)
            else None
        ),
        user_note=(ov.notes if ov else None),
    )


def _image_digest(ref: AssetRef, meta_json: dict) -> AssetDigest:
    meta = meta_json.get("meta") or {}
    ocr = meta_json.get("ocr") or {}
    caption = meta_json.get("caption") or {}
    ocr_full = str(ocr.get("full_text", "") or "").strip()
    if len(ocr_full) > MAX_SENTENCE_CHARS:
        ocr_full = ocr_full[: MAX_SENTENCE_CHARS - 1] + "…"
    tags = caption.get("tags") if isinstance(caption.get("tags"), list) else None
    ov = ref.overrides
    return AssetDigest(
        handle=ref.handle,
        asset_id=ref.asset_id,
        kind="image",
        mode=ref.mode,
        dimensions=(
            [int(meta.get("width", 0) or 0), int(meta.get("height", 0) or 0)]
            if meta.get("width") else None
        ),
        ocr_summary=ocr_full or None,
        caption_short=str(caption.get("short", "") or "").strip() or None,
        topic_keywords=(tags[:MAX_TAGS] if tags else None),
        user_note=(ov.notes if ov else None),
    )


def _fallback_digest(ref: AssetRef, asset: Optional[AiInputAsset]) -> AssetDigest:
    ov = ref.overrides
    return AssetDigest(
        handle=ref.handle,
        asset_id=ref.asset_id,
        kind=ref.kind,
        mode=ref.mode,
        duration_s=(
            round(float(asset.duration_seconds), 2)
            if asset and asset.duration_seconds else None
        ),
        user_note=(ov.notes if ov else None),
    )


async def _digest_one(
    ref: AssetRef, asset: Optional[AiInputAsset]
) -> tuple[AssetDigest, Optional[dict]]:
    """Fetch + summarize a single asset. Returns (digest, raw_context).

    `raw_context` is the full fetched JSON for VIDEO assets (so the Cuts step's
    detectors can read prosody.pauses + word-level transcript without a second
    fetch); None for images / fetch failures. Never raises.
    """
    try:
        if ref.kind == "video":
            url = asset.context_json_url if asset else None
            ctx = await _fetch_json(url) if url else None
            digest = _video_digest(ref, ctx) if ctx else _fallback_digest(ref, asset)
            return digest, ctx
        url = asset.image_metadata_url if asset else None
        meta_json = await _fetch_json(url) if url else None
        digest = _image_digest(ref, meta_json) if meta_json else _fallback_digest(ref, asset)
        return digest, None
    except Exception as e:
        logger.warning(f"[studio-manifest] digest failed for {ref.handle}: {e}")
        return _fallback_digest(ref, asset), None


async def build_asset_manifest_with_raw(
    refs: Sequence[AssetRef],
    assets_by_handle: Dict[str, AiInputAsset],
) -> tuple[List[Dict[str, Any]], Dict[str, dict]]:
    """Build the prompt manifest AND return raw video contexts in one fetch pass.

    Returns `(manifest, raw_contexts)` where raw_contexts maps video handle →
    full video_context dict (for the Cuts detectors). Concurrent fetch via
    gather; output manifest preserves ref order.
    """
    results = await asyncio.gather(
        *(_digest_one(ref, assets_by_handle.get(ref.handle)) for ref in refs)
    )
    manifest: List[Dict[str, Any]] = []
    raw_contexts: Dict[str, dict] = {}
    for ref, (digest, raw) in zip(refs, results):
        manifest.append(digest.to_prompt_dict())
        if raw is not None:
            raw_contexts[ref.handle] = raw
    return manifest, raw_contexts


async def build_asset_manifest(
    refs: Sequence[AssetRef],
    assets_by_handle: Dict[str, AiInputAsset],
) -> List[Dict[str, Any]]:
    """Prompt-ready manifest only (discards raw contexts). Used by steps that
    don't need raw prosody/words (arrangement)."""
    manifest, _ = await build_asset_manifest_with_raw(refs, assets_by_handle)
    return manifest
