import os
from functools import lru_cache
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv


def _load_env_file() -> None:
    """
    Load environment variables from a .env file based on APP_ENV.
    Default APP_ENV is 'stage'. Supports:
      - .env
      - .env.<APP_ENV> (e.g., .env.stage)
    Files later in the list override earlier ones.
    """
    app_env = os.getenv("APP_ENV", "stage")

    # Load base .env first, then env-specific to allow overrides
    base_env = os.path.join(os.getcwd(), ".env")
    load_dotenv(dotenv_path=base_env, override=False)

    env_specific = os.path.join(os.getcwd(), f".env.{app_env}")
    if os.path.exists(env_specific):
        load_dotenv(dotenv_path=env_specific, override=True)


_load_env_file()


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    """
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    # App
    app_name: str = "AI Service"
    app_env: str = "stage"
    api_base_path: str = "/ai-service"
    host: str = "0.0.0.0"
    port: int = 8077

    # CORS
    cors_allow_origins: str = "*"  # comma-separated list
    cors_allow_credentials: bool = True
    cors_allow_methods: str = "*"
    cors_allow_headers: str = "*"

    # Database (connect to admin-core-service DB)
    # Preferred: provide a SQLAlchemy/Psycopg URL via DATABASE_URL
    database_url: Optional[str] = None
    # Fallbacks to build URL:
    db_username: Optional[str] = os.getenv("DB_USERNAME")
    db_password: Optional[str] = os.getenv("DB_PASSWORD")
    db_host: Optional[str] = os.getenv("DB_HOST")
    db_port: Optional[int] = int(os.getenv("DB_PORT", "5432"))
    db_name: Optional[str] = os.getenv("DB_NAME")
    db_schema: Optional[str] = os.getenv("DB_SCHEMA")  # optional; defaults to DB default search_path
    # If only JDBC URL is available from admin core envs, we can parse it
    admin_core_jdbc_url: Optional[str] = os.getenv("ADMIN_CORE_SERVICE_DB_URL")

    # SQLAlchemy pool tuning
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_pool_timeout_seconds: int = 30
    db_pool_recycle_seconds: int = 1800  # 30 minutes
    # Trigger git status

    # LLM Configuration - Using OpenRouter (your working API key)
    llm_base_url: str = "https://openrouter.ai/api/v1/chat/completions"
    openrouter_api_key: Optional[str] = None  # Will be populated from OPENROUTER_API_KEY env var
    # Strong default for production-grade tasks (script writing, director planning,
    # per-shot HTML, frame regeneration). Free-tier models like
    # `xiaomi/mimo-v2-flash:free` were producing too-variable HTML for the
    # frame-regen path — bumping the default raises the floor without
    # changing the env override. Override via `LLM_DEFAULT_MODEL` if needed.
    llm_default_model: str = os.getenv("LLM_DEFAULT_MODEL", "google/gemini-3.1-pro-preview")
    # Other models we've validated:
    # - google/gemini-2.5-pro
    # - openai/gpt-4o
    # - openai/gpt-4o-mini
    # Free-tier (low quality on structured HTML output, kept as last-resort fallback only):
    # - xiaomi/mimo-v2-flash:free
    # - mistralai/devstral-2512:free
    # - nvidia/nemotron-3-nano-30b-a3b:free
    llm_timeout_seconds: float = 60.0

    # S3 Configuration (for generated course images and AI videos)
    # Uses same config as media-service
    s3_aws_access_key: Optional[str] = None
    s3_aws_access_secret: Optional[str] = None
    s3_aws_region: Optional[str] = None
    aws_bucket_name: Optional[str] = None
    
    # AWS Configuration (alternative naming from media-service)
    aws_access_key: Optional[str] = None
    aws_secret_key: Optional[str] = None
    aws_region: str = "ap-south-1"
    aws_s3_public_bucket: Optional[str] = None

    # Google Generative AI Configuration (for Gemini image generation)
    gemini_api_key: Optional[str] = None

    # MathPix (PDF → Markdown/HTML conversion for question generation). Defaults
    # preserve the media_service credentials so the migrated PDF flow works
    # out-of-box; override via MATHPIX_APP_ID / MATHPIX_APP_KEY.
    mathpix_app_id: str = os.getenv("MATHPIX_APP_ID", "vacademy_8e6a90_950081")
    mathpix_app_key: str = os.getenv(
        "MATHPIX_APP_KEY",
        "b27375705e35a88b52f041c5f8eba2dda6a23f36350300d39854c8301b1a9de4",
    )
    # docconverter.pro (DOCX → HTML). Token fetched at runtime if not set.
    docconverter_base_url: str = os.getenv("DOCCONVERTER_BASE_URL", "https://api.docconverter.pro")

    # RunPod Configuration (legacy PiP avatar via EchoMimic)
    runpod_api_key: Optional[str] = None
    runpod_endpoint_id: Optional[str] = None

    # fal.ai Configuration (per-shot host-avatar talking-head video).
    # Used by app/services/fal_avatar_client.py when request.host.type == "avatar".
    # Supported custom-avatar models (see schemas/video_generation.py::AvatarModelLiteral
    # for the source of truth): fal-ai/flashtalk, fal-ai/kling-video/ai-avatar/v2/{standard,pro},
    # fal-ai/heygen/avatar4/image-to-video, veed/fabric-1.0. Plus the built-in
    # catalog routes argil/avatars/audio-to-video and veed/avatars/audio-to-video.
    fal_api_key: Optional[str] = None

    # YouTube API Configuration
    youtube_api_key: Optional[str] = None

    # Sarvam AI Configuration (for Indian-language STT/TTS)
    sarvam_api_key: str = ""

    # Pexels API Configuration (comma-separated keys for round-robin rotation)
    pexels_api_keys: str = ""

    # Pixabay API Configuration (comma-separated keys for round-robin rotation)
    pixabay_api_keys: str = ""

    # Serper API Configuration (Google Image / Video / Web search; comma-separated
    # keys for round-robin rotation). Used by news_recap and other videos that
    # need real photos of named entities (people, places, brands, events).
    serper_api_keys: str = ""

    # Render Worker (dedicated Hetzner server for video rendering)
    render_server_url: str = os.getenv("RENDER_SERVER_URL", "")
    render_server_key: str = os.getenv("RENDER_SERVER_KEY", "")
    # Public URL of THIS AI service (used as the callback target the render
    # worker POSTs progress/completion to). Defaults to the stage gateway so
    # production-like deployments work out of the box; override in prod /
    # dev with AI_SERVICE_PUBLIC_URL. Empty string disables push entirely.
    ai_service_public_url: str = os.getenv(
        "AI_SERVICE_PUBLIC_URL", "https://backend-stage.vacademy.io/"
    )

    # Internal Auth Configuration
    client_name: str = os.getenv("CLIENT_NAME", "ai_service")
    client_secret: Optional[str] = os.getenv("CLIENT_SECRET")
    auth_service_base_url: str = os.getenv("AUTH_SERVICE_BASE_URL", "http://auth-service:8071")
    # media_service base URL — used by migrated file-dependent features (lecture
    # feedback, question-from-pdf/audio/image) to resolve a media fileId to a
    # presigned S3 URL via /media-service/internal/get-url/id. media_service
    # permanently owns file storage.
    media_server_base_url: str = os.getenv("MEDIA_SERVER_BASE_URL", "http://media-service:8075")
    # assessment_service base URL — used by the migrated AI evaluation tool to
    # fetch assessment metadata (questions + per-question marking rubric) via the
    # internal HMAC-gated endpoint /assessment-service/internal/evaluation-tool/
    # metadata/{assessmentId}. Authenticated with client_name + client_secret
    # (clientName / Signature headers), same scheme media_service used.
    assessment_service_base_url: str = os.getenv("ASSESSMENT_SERVICE_BASE_URL", "http://assessment-service:8074")

    # JWT Configuration (Shared with Java services)
    # Default value works for dev/stage if matching common_service
    jwt_secret_key: str = os.getenv("JWT_SECRET_KEY", "357638792F423F4428472B4B6250655368566D597133743677397A2443264629")
    jwt_algorithm: str = "HS256"
    jwt_token_expiry_minutes: int = 43200  # 30 days in minutes (matching Java 2592000000ms)

    # Internal service-to-service auth.
    # Used by admin_core_service when calling /credits/v1/internal/* endpoints
    # (credit-pack purchase fulfillment from the Razorpay webhook handler).
    # Compared in constant time inside require_internal_service_token().
    # MUST be set in production; if unset, the internal endpoints reject all
    # requests (no implicit fallback).
    internal_service_token: Optional[str] = os.getenv("INTERNAL_SERVICE_TOKEN")

    model_config = SettingsConfigDict(env_file=None, extra="ignore")

    def build_sqlalchemy_url(self) -> str:
        """
        Derive the SQLAlchemy URL to connect to Postgres.
        Priority:
          1) self.database_url (already in sqlalchemy format)
          2) Build from discrete DB_* variables
          3) Convert from JDBC ADMIN_CORE_SERVICE_DB_URL if present
        """
        if self.database_url:
            return self.database_url

        # Build from discrete parts
        if self.db_host and self.db_name and self.db_username is not None:
            password_part = f":{self.db_password}" if self.db_password else ""
            return f"postgresql+psycopg://{self.db_username}{password_part}@{self.db_host}:{self.db_port}/{self.db_name}"

        # Convert from JDBC
        if self.admin_core_jdbc_url:
            # Example JDBC: jdbc:postgresql://host:5432/dbname?sslmode=disable&currentSchema=my_schema
            jdbc = self.admin_core_jdbc_url
            if jdbc.startswith("jdbc:"):
                jdbc = jdbc[len("jdbc:") :]
            # Strip query params for base; capture schema if provided
            base, _, query = jdbc.partition("?")
            # base now like postgresql://host:port/db
            # Convert to sqlalchemy + psycopg URL
            # Username/password may come from env DB_USERNAME/DB_PASSWORD
            user = self.db_username or ""
            pwd = f":{self.db_password}" if self.db_password else ""
            # Ensure protocol is postgresql+psycopg
            base = base.replace("postgresql://", "postgresql+psycopg://")
            url = base
            if user:
                # Insert credentials after protocol
                protocol_sep = "://"
                proto, _, rest = url.partition(protocol_sep)
                url = f"{proto}{protocol_sep}{user}{pwd}@{rest}"
            # Extract schema from query if present
            if query:
                for part in query.split("&"):
                    if part.startswith("currentSchema="):
                        schema = part.split("=", 1)[1]
                        if schema:
                            # Keep schema for later use
                            object.__setattr__(self, "db_schema", schema)
                        break
            return url

        raise ValueError(
            "Database configuration missing. Provide DATABASE_URL, or DB_HOST/DB_NAME/DB_USERNAME, "
            "or ADMIN_CORE_SERVICE_DB_URL plus DB_USERNAME/DB_PASSWORD."
        )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


