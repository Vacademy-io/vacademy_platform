"""
ASSEMBLE_WORDS stage (P6b) — build the captions words track for a Studio build.

Runs only when the confirmed plan enables captions (`propose_captions.enabled`).
Studio has no narration words.json, so we REMAP each kept clip's indexed
word-transcript onto the composed timeline (via `studio_words_track`, driven off
the built SOURCE_CLIP entries so it can't drift from the footage), upload it as
`ai-studio/{build_id}/words.json`, and record `s3_urls.words`. The editor loads
it via `wordsUrl` (caption preview) and the render passes it as
`--captions-words`.

Captions are an ENHANCEMENT — a transcript fetch hiccup must NOT fail the build,
so all I/O here is best-effort: on any error we log and ship the build without a
words track (no captions), rather than raising.
"""
from __future__ import annotations

import asyncio
import json
import logging

from ..studio_asset_manifest import build_asset_manifest_with_raw
from ..studio_asset_validator import validate_asset_refs
from ..studio_orchestrator import STAGE_ASSEMBLE_WORDS, BuildContext, register_stage_handler
from ..studio_words_track import build_words_track, flatten_words
from ...schemas.studio_projects import AssetRef

logger = logging.getLogger(__name__)


def _captions_enabled(plan_snapshot: dict) -> bool:
    overlays = (plan_snapshot or {}).get("overlays") or {}
    ops = list(overlays.get("operations") or []) + list(overlays.get("manual_operations") or [])
    for op in ops:
        if isinstance(op, dict) and op.get("tool") == "propose_captions":
            return bool((op.get("params") or {}).get("enabled"))
    return False


async def _assemble_words_stage(ctx: BuildContext) -> None:
    if not _captions_enabled(ctx.plan_snapshot or {}):
        logger.info(f"[StudioBuild] {ctx.build_id} captions off — no words track")
        return
    if not ctx.timeline:
        logger.warning(f"[StudioBuild] {ctx.build_id} ASSEMBLE_WORDS: no timeline")
        return

    try:
        refs = []
        for r in ctx.source_asset_refs or []:
            try:
                ref = AssetRef.model_validate(r)
            except Exception:
                continue
            if ref.kind == "video":  # only videos carry a transcript
                refs.append(ref)
        if not refs:
            logger.info(f"[StudioBuild] {ctx.build_id} no video assets — no captions")
            return

        validation = await asyncio.to_thread(validate_asset_refs, refs, ctx.institute_id)
        _, raw_contexts = await build_asset_manifest_with_raw(refs, validation.by_handle)

        words_by_handle = {
            handle: flatten_words((rc or {}).get("transcript"))
            for handle, rc in raw_contexts.items()
        }
        words = build_words_track(ctx.timeline.get("entries") or [], words_by_handle)
        if not words:
            logger.info(f"[StudioBuild] {ctx.build_id} no caption words produced")
            return

        payload = json.dumps(words, ensure_ascii=False).encode("utf-8")
        s3_key = f"ai-studio/{ctx.build_id}/words.json"

        def _put() -> str:
            from ..s3_service import S3Service
            return S3Service().upload_file_content(
                content=payload, filename="words.json", s3_key=s3_key,
                content_type="application/json",
            )

        url = await asyncio.to_thread(_put)
        ctx.s3_urls["words"] = url
        ctx.extra_metadata["caption_word_count"] = len(words)
        logger.info(f"[StudioBuild] {ctx.build_id} built {len(words)}-word caption track → {url}")
    except Exception as e:
        # Best-effort: captions are optional, never fail the build over them.
        logger.warning(f"[StudioBuild] {ctx.build_id} ASSEMBLE_WORDS skipped ({e})")


register_stage_handler(STAGE_ASSEMBLE_WORDS, _assemble_words_stage)
