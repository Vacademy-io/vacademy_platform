from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
import sys

from .config import get_settings
from .routers.health import router as health_router
from .routers.course_outline import router as course_outline_router
from .routers.content_generation import router as content_generation_router
from .routers.video_generation import router as video_generation_router
from .routers.models import router as models_router
from .routers.api_keys import router as api_keys_router
from .routers.token_usage import router as token_usage_router
from .routers.chat_bot import router as chat_bot_router
from .routers.chat_agent import router as chat_agent_router
from .routers.assistant import router as assistant_router
from .routers.validation import router as validation_router
from .routers.institute_settings import router as institute_settings_router
from .routers.utils import router as utils_router
from .routers.institute_api_keys import router as institute_api_keys_router
from .routers.external_video_generation import router as external_video_generation_router
from .routers.auth_test import router as auth_test_router
from .routers.credits import router as credits_router
from .routers.ai_models import router as ai_models_router
from .routers.super_admin import router as super_admin_router
from .routers.content_ingestion import router as content_ingestion_router
from .routers.learning_analytics import router as learning_analytics_router
from .routers.mathpix import router as mathpix_router
from .routers.knowledge_base import router as knowledge_base_router
from .routers.voice_agent import router as voice_agent_router
from .routers.input_asset import router as input_asset_router
from .routers.reels import router as reels_router
from .routers.studio_projects import router as studio_router
from .routers.transcription import router as transcription_router
from .routers.assessment_generation import router as assessment_generation_router
from .routers.coding_question_gen import router as coding_question_gen_router
from .routers.brand_kit_scrape import router as brand_kit_scrape_router
from .routers.transcript_notes import router as transcript_notes_router
from .routers.html_document import router as html_document_router
from .routers.page_builder import router as page_builder_router
from .routers.copy_check import router as copy_check_router
from .routers.lecture import router as lecture_router
from .routers.ai_task_status import router as ai_task_status_router
from .routers.presentation import router as presentation_router
from .routers.incident import router as incident_router
from .routers.question_metadata import router as question_metadata_router
from .routers.question_gen import router as question_gen_router
from .routers.pdf_questions import router as pdf_questions_router
from .routers.audio_questions import router as audio_questions_router
from .routers.chat_with_pdf import router as chat_with_pdf_router
from .routers.evaluation import router as evaluation_router
from .routers.retry import router as retry_router
from .routers.translation import router as translation_router

from .db import db_session
from .repositories.ai_task_repository import ensure_ai_task_schema
from .models.file_conversion import ensure_file_conversion_schema
from .services.ai_task_service import sweep_stale_tasks



# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)


@asynccontextmanager
async def _lifespan(app: FastAPI):
    """Startup: ensure the ai_task schema exists (idempotent) and sweep any
    PROGRESS rows orphaned by a prior restart to FAILED."""
    _logger = logging.getLogger(__name__)
    try:
        with db_session() as db:
            ensure_ai_task_schema(db)
            ensure_file_conversion_schema(db)
            from .repositories.ai_video_cast_repository import ensure_ai_video_cast_schema
            ensure_ai_video_cast_schema(db)
        sweep_stale_tasks()
    except Exception as exc:  # noqa: BLE001
        _logger.warning("ai_task startup init skipped: %s", exc)
    # Orphaned AI-video runs (deploy/crash killed the in-process pipeline
    # task): refund + mark FAILED so slides stop spinning forever. Sweeps at
    # startup and every 30 min (a crash's own orphans are younger than the TTL
    # at boot). Lazy import so a module issue can't block app boot.
    try:
        from .services.ai_video_sweeper import start_ai_video_sweeper
        start_ai_video_sweeper()
    except Exception as exc:  # noqa: BLE001
        _logger.warning("ai_gen_video sweeper skipped: %s", exc)
    # Reels stuck-render reaper: sweeps PENDING/IN_PROGRESS rows orphaned by
    # a deploy/crash (in-process asyncio renders die with the process) every
    # 5 min. Lazy import so a reels-module issue can't block app boot.
    try:
        from .services.reels_render_orchestrator import start_reels_reaper
        start_reels_reaper()
    except Exception as exc:  # noqa: BLE001
        _logger.warning("reels reaper startup skipped: %s", exc)
    # CRM Call Intelligence: drains the call_intelligence work queue (transcribe +
    # LLM analysis of call recordings) every tick. FOR UPDATE SKIP LOCKED makes it
    # safe across replicas. Lazy import so a module issue can't block app boot.
    try:
        from .services.call_intelligence_poller import start_call_intelligence_poller
        start_call_intelligence_poller()
    except Exception as exc:  # noqa: BLE001
        _logger.warning("call-intelligence poller startup skipped: %s", exc)
    # Vacademy Assistant help corpus: keep the deployed pgvector corpus in sync
    # with app/data/help_knowledge.jsonl. Change-detected, so an unchanged corpus
    # is a no-op. Lazy import + background task so it can't block app boot.
    try:
        from .services.help_corpus_sync import start_help_corpus_sync
        start_help_corpus_sync()
    except Exception as exc:  # noqa: BLE001
        _logger.warning("help corpus sync startup skipped: %s", exc)
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    logger = logging.getLogger(__name__)
    logger.info("="*80)
    logger.info("Starting AI Service Application")
    logger.info(f"Environment: {settings.app_env}")
    # API keys loaded from environment (not logging to avoid exposing key status)
    logger.info("="*80)

    # ── Pipeline-version banner ─────────────────────────────────────────
    # v3 is the only supported pipeline. The v2 BeatPlanner→Director chain
    # remains as an internal exception-handler fallback inside
    # `_run_v3_shot_planning`, but is no longer user-selectable. Print the
    # banner + verify `automation_pipeline.QUALITY_TIERS` is importable so
    # any cold-start import failure surfaces immediately in logs (rather
    # than silently downgrading to v2 like the pre-V200 resolution did).
    try:
        import sys as _sys_pv
        from pathlib import Path as _Path_pv
        _aigen_pv = str(_Path_pv(__file__).resolve().parent / "ai-video-gen-main")
        if _aigen_pv not in _sys_pv.path:
            _sys_pv.path.insert(0, _aigen_pv)
        from automation_pipeline import QUALITY_TIERS as _qt_pv  # type: ignore
        _tier_names = sorted(_qt_pv.keys())
        logger.info("🚦 AI video pipeline: v3 (only supported version; v2 deprecated)")
        logger.info(f"   Resolved tier configs: {', '.join(_tier_names)}")
        # Probe v3-only modules explicitly. A partial deploy that left
        # `automation_pipeline.py` in place but lost `shot_planner.py` or
        # `narration_writer.py` would pass the QUALITY_TIERS probe above
        # but crash on every gen request. Surface here instead.
        try:
            from shot_planner import plan_shots  # type: ignore  # noqa: F401
            from narration_writer import write_narration  # type: ignore  # noqa: F401
            logger.info("   ShotPlanner + NarrationWriter modules: OK")
        except Exception as _v3_mod_err:
            logger.error(
                "🚨 v3 critical module probe FAILED (%s) — the pipeline will "
                "always fall back to the v2 safety net on every run. Verify "
                "shot_planner.py + narration_writer.py are present in "
                "ai-video-gen-main/.",
                _v3_mod_err,
            )
    except Exception as _pv_err:
        logger.error(
            "🚦 AI video pipeline boot probe FAILED to import "
            "automation_pipeline.QUALITY_TIERS (%s). Pipeline will still run "
            "v3 unconditionally, but this hints at a deploy/path problem.",
            _pv_err,
        )
    
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        docs_url=f"{settings.api_base_path}/docs",
        redoc_url=None,
        openapi_url=f"{settings.api_base_path}/openapi.json",
        lifespan=_lifespan,
    )

    # CORS
    allow_origins = [o.strip() for o in settings.cors_allow_origins.split(",") if o.strip()]
    allow_methods = [m.strip() for m in settings.cors_allow_methods.split(",") if m.strip()]
    allow_headers = [h.strip() for h in settings.cors_allow_headers.split(",") if h.strip()]

    # NOTE: `allow_origins=["*"]` with `allow_credentials=True` is an INVALID CORS
    # combination — browsers reject `Access-Control-Allow-Origin: *` for any
    # credentialed request. Use a regex that ECHOES the request origin (valid
    # with credentials), so it's correct regardless of whether a caller sends
    # credentials, while still effectively allowing all origins.
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=".*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routers
    app.include_router(health_router, prefix=settings.api_base_path, tags=["health"])
    app.include_router(course_outline_router, prefix=settings.api_base_path)
    app.include_router(content_generation_router, prefix=settings.api_base_path)
    app.include_router(video_generation_router, prefix=settings.api_base_path)
    app.include_router(models_router, prefix=settings.api_base_path)
    app.include_router(api_keys_router, prefix=settings.api_base_path)
    app.include_router(token_usage_router, prefix=settings.api_base_path)
    app.include_router(chat_bot_router, prefix=settings.api_base_path)
    app.include_router(chat_agent_router, prefix=settings.api_base_path)
    app.include_router(assistant_router, prefix=settings.api_base_path)
    app.include_router(validation_router, prefix=settings.api_base_path)
    app.include_router(institute_settings_router, prefix=settings.api_base_path)
    app.include_router(utils_router, prefix=settings.api_base_path)
    app.include_router(institute_api_keys_router, prefix=settings.api_base_path)
    app.include_router(external_video_generation_router, prefix=settings.api_base_path)
    app.include_router(auth_test_router, prefix=settings.api_base_path)
    app.include_router(credits_router, prefix=settings.api_base_path)
    app.include_router(ai_models_router, prefix=settings.api_base_path)
    app.include_router(super_admin_router, prefix=settings.api_base_path)
    app.include_router(content_ingestion_router, prefix=settings.api_base_path)
    app.include_router(learning_analytics_router, prefix=settings.api_base_path)
    app.include_router(mathpix_router, prefix=settings.api_base_path)
    app.include_router(knowledge_base_router, prefix=settings.api_base_path)
    app.include_router(voice_agent_router, prefix=settings.api_base_path)
    # Primary path: /input-asset/* — handles both video and image kinds.
    app.include_router(
        input_asset_router,
        prefix=f"{settings.api_base_path}/input-asset",
    )
    # Legacy alias: /input-video/* — kept so existing FE clients keep working
    # until they migrate. Hidden from OpenAPI to avoid duplicate routes in
    # Swagger. The same handlers serve both paths; image rows surface in
    # /input-video/list responses, but pre-migration UIs simply render them
    # as unrecognized cards.
    app.include_router(
        input_asset_router,
        prefix=f"{settings.api_base_path}/input-video",
        include_in_schema=False,
    )
    app.include_router(transcription_router, prefix=settings.api_base_path)
    app.include_router(assessment_generation_router, prefix=settings.api_base_path)
    app.include_router(coding_question_gen_router, prefix=settings.api_base_path)
    app.include_router(brand_kit_scrape_router, prefix=settings.api_base_path)
    app.include_router(transcript_notes_router, prefix=settings.api_base_path)
    app.include_router(html_document_router, prefix=settings.api_base_path)
    app.include_router(page_builder_router, prefix=settings.api_base_path)
    app.include_router(copy_check_router, prefix=settings.api_base_path)
    # Migrated from media_service: AI lecture planner (kick-off) + the
    # task-status polling mirror. Final paths:
    #   {api_base_path}/ai/lecture/generate-plan
    #   {api_base_path}/task-status/{get-status,get-raw-result,get/lecture-plan}
    app.include_router(lecture_router, prefix=settings.api_base_path)
    app.include_router(ai_task_status_router, prefix=settings.api_base_path)
    app.include_router(presentation_router, prefix=settings.api_base_path)
    app.include_router(incident_router, prefix=settings.api_base_path)
    app.include_router(question_metadata_router, prefix=settings.api_base_path)
    app.include_router(question_gen_router, prefix=settings.api_base_path)
    app.include_router(pdf_questions_router, prefix=settings.api_base_path)
    app.include_router(audio_questions_router, prefix=settings.api_base_path)
    app.include_router(chat_with_pdf_router, prefix=settings.api_base_path)
    app.include_router(evaluation_router, prefix=settings.api_base_path)
    app.include_router(retry_router, prefix=settings.api_base_path)
    # i18n Phase 1 — content translation pipeline (estimate / course job /
    # strings / review-approve / job status). Router declares its own
    # /translation/v1 prefix. Final paths: {api_base_path}/translation/v1/*.
    app.include_router(translation_router, prefix=settings.api_base_path)
    # Reels-from-long-video — three-gate funnel (scan/preview/render) +
    # /frame/{add,update,delete} for the editor's `kind=reel` save loop.
    # The router declares its own `/external/reels/v1` prefix; we only add
    # the service-wide `/ai-service` base here. Final paths:
    #   {api_base_path}/external/reels/v1/{scan,preview,render,list,...}
    app.include_router(reels_router, prefix=settings.api_base_path)
    # Vimotion Studio — multi-asset video editing pipeline. P0 contract
    # surface: all endpoints return 501 until P1+ wires the service modules.
    # Router declares its own `/external/studio/v1` prefix. Final paths:
    #   {api_base_path}/external/studio/v1/{projects,builds,...}
    # See docs/ai_content/AI_VIDEO_STUDIO.md for phase status.
    app.include_router(studio_router, prefix=settings.api_base_path)

    return app


