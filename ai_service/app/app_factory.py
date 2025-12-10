from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers.health import router as health_router
from .routers.course_outline import router as course_outline_router
from .routers.content_generation import router as content_generation_router


def create_app() -> FastAPI:
    settings = get_settings()
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
        allow_origins=allow_origins or ["*"],
        allow_credentials=settings.cors_allow_credentials,
        allow_methods=allow_methods or ["*"],
        allow_headers=allow_headers or ["*"],
    )

    # Routers
    app.include_router(health_router, prefix=settings.api_base_path, tags=["health"])
    app.include_router(course_outline_router, prefix=settings.api_base_path)
    app.include_router(content_generation_router, prefix=settings.api_base_path)


    return app


