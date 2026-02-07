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
    db_pool_size: int = 2
    db_max_overflow: int = 2
    db_pool_timeout_seconds: int = 30
    db_pool_recycle_seconds: int = 1800  # 30 minutes
    # Trigger git status

    # LLM Configuration - Using OpenRouter (your working API key)
    llm_base_url: str = "https://openrouter.ai/api/v1/chat/completions"
    openrouter_api_key: Optional[str] = None  # Will be populated from OPENROUTER_API_KEY env var
    # Default to free tier model, can be overridden via LLM_DEFAULT_MODEL env var
    llm_default_model: str = os.getenv("LLM_DEFAULT_MODEL", "xiaomi/mimo-v2-flash:free")
    # Free tier models (fallback chain):
    # - xiaomi/mimo-v2-flash:free
    # - mistralai/devstral-2512:free
    # - nvidia/nemotron-3-nano-30b-a3b:free
    # Alternative paid models:
    # - google/gemini-2.5-pro
    # - openai/gpt-4o-mini
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

    # YouTube API Configuration
    youtube_api_key: Optional[str] = None

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


