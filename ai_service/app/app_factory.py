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
from .routers.brand_kit_scrape import router as brand_kit_scrape_router
from .routers.transcript_notes import router as transcript_notes_router
from .routers.copy_check import router as copy_check_router



# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)


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
    )

    # CORS
    allow_origins = [o.strip() for o in settings.cors_allow_origins.split(",") if o.strip()]
    allow_methods = [m.strip() for m in settings.cors_allow_methods.split(",") if m.strip()]
    allow_headers = [h.strip() for h in settings.cors_allow_headers.split(",") if h.strip()]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
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
    app.include_router(brand_kit_scrape_router, prefix=settings.api_base_path)
    app.include_router(transcript_notes_router, prefix=settings.api_base_path)
    app.include_router(copy_check_router, prefix=settings.api_base_path)
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


