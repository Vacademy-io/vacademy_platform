"""
UPLOAD stage — PUT the assembled timeline JSON to S3 under
`ai-studio/{build_id}/time_based_frame.json` and record the URL on the context.

The key name matches the editor's expected timeline artifact name
(`time_based_frame.json`, same as ai_gen_video / reels) so the editor's
loader + the /frame/* save loop (P5) operate on a familiar shape. S3 upload
is blocking boto3 — run it off the event loop via asyncio.to_thread.
"""
from __future__ import annotations

import asyncio
import json
import logging

from ..s3_service import S3Service
from ..studio_orchestrator import STAGE_UPLOAD, BuildContext, register_stage_handler

logger = logging.getLogger(__name__)


async def _upload_stage(ctx: BuildContext) -> None:
    if not ctx.timeline:
        raise ValueError("no timeline to upload (BUILD_TIMELINE must run first)")

    payload = json.dumps(ctx.timeline, ensure_ascii=False).encode("utf-8")
    s3_key = f"ai-studio/{ctx.build_id}/time_based_frame.json"

    def _put() -> str:
        return S3Service().upload_file_content(
            content=payload,
            filename="time_based_frame.json",
            s3_key=s3_key,
            content_type="application/json",
        )

    url = await asyncio.to_thread(_put)
    ctx.s3_urls["timeline"] = url
    logger.info(f"[StudioBuild] {ctx.build_id} uploaded timeline → {url}")


register_stage_handler(STAGE_UPLOAD, _upload_stage)
