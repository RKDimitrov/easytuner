"""Application configuration."""

import json
from functools import lru_cache
from typing import Literal

from pydantic import Field, PostgresDsn, RedisDsn, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_name: str = "EasyTuner Server"
    app_version: str = "0.1.0"
    environment: Literal["development", "staging", "production"] = "development"
    debug: bool = False
    
    # API
    api_v1_prefix: str = "/api/v1"
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    reload: bool = True  # For development
    
    # Database
    database_url: PostgresDsn = Field(
        default="postgresql+asyncpg://easytuner:password@localhost:5432/easytuner"
    )
    database_pool_size: int = 5
    database_max_overflow: int = 10
    database_echo: bool = False
    
    # Redis
    redis_url: RedisDsn = Field(default="redis://localhost:6379/0")
    
    # Celery
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/1"
    
    # MinIO / S3
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket_uploads: str = "easytuner-uploads"
    minio_bucket_exports: str = "easytuner-exports"
    minio_secure: bool = False
    
    # Authentication
    jwt_secret_key: str = Field(
        default="CHANGE_THIS_IN_PRODUCTION_TO_A_SECURE_RANDOM_KEY"
    )
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30
    
    # Security
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]
    cors_allow_credentials: bool = True
    cors_allow_methods: list[str] = ["*"]
    cors_allow_headers: list[str] = ["*"]
    
    # File Upload
    upload_dir: str = "/app/uploads"  # Directory for storing uploaded files
    max_upload_size_mb: int = 16
    allowed_file_extensions: list[str] = [".bin", ".hex"]
    
    @field_validator("cors_origins", "cors_allow_methods", "cors_allow_headers", "allowed_file_extensions", mode="before")
    @classmethod
    def parse_json_list(cls, v):
        """Parse JSON string to list if needed."""
        if isinstance(v, str):
            # Try to parse as JSON first
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                # If not JSON, try comma-separated values
                return [item.strip() for item in v.split(",") if item.strip()]
        return v
    
    # Rate Limiting
    rate_limit_uploads_per_hour: int = 100
    rate_limit_scans_per_hour: int = 50
    rate_limit_exports_per_hour: int = 20
    rate_limit_reads_per_hour: int = 1000
    
    # Detection Pipeline
    scan_timeout_seconds: int = 300  # 5 minutes
    max_candidates_per_scan: int = 500
    
    # Logging
    log_level: str = "INFO"
    log_format: str = "json"  # or "text"
    
    @property
    def database_url_sync(self) -> str:
        """Synchronous database URL for Alembic migrations."""
        return str(self.database_url).replace("+asyncpg", "")
    
    @property
    def max_upload_size_bytes(self) -> int:
        """Maximum upload size in bytes."""
        return self.max_upload_size_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Global settings instance
settings = get_settings()

