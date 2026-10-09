from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
ROOT_ENV_FILE = REPOSITORY_ROOT / ".env"


class Settings(BaseSettings):
    """Runtime configuration loaded from the repository-root environment file."""

    model_config = SettingsConfigDict(
        env_file=ROOT_ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "Greenrun API"
    app_env: Literal["development", "test", "production"] = "development"
    mongodb_uri: SecretStr
    mongodb_database: str = Field(default="running_tracker", min_length=1)
    backend_host: str = "0.0.0.0"
    backend_port: int = Field(default=8000, ge=1, le=65535)
    frontend_origin: str = ""
    frontend_origins: str = "http://localhost:5174,http://127.0.0.1:5174"
    # Directory of the built frontend. When set (production image), the API also serves the app.
    frontend_dist: str = ""
    storage_limit_bytes: int = Field(default=536_870_912, gt=0)
    max_fit_upload_bytes: int = Field(default=52_428_800, gt=0)
    # Garmin Connect sync. Credentials stay server-side; tokens persist in garmin_token_dir so a
    # full login (and MFA) is only needed once. See docs/garmin-sync.md.
    garmin_email: str = ""
    garmin_password: SecretStr = SecretStr("")
    garmin_token_dir: str = "~/.garminconnect"
    # Optional AI track-session reviews through the green-ai service, e.g. http://green-ai:8000.
    # Empty disables the feature. See docs/ai-reviews.md.
    green_ai_url: str = ""

    @property
    def ai_reviews_enabled(self) -> bool:
        return bool(self.green_ai_url.strip())

    @property
    def garmin_configured(self) -> bool:
        return bool(self.garmin_email.strip() and self.garmin_password.get_secret_value())

    @property
    def cors_origins(self) -> list[str]:
        """Return the explicit browser origins allowed to call the API."""
        configured = [
            origin.strip().rstrip("/")
            for origin in self.frontend_origins.split(",")
            if origin.strip()
        ]
        legacy = self.frontend_origin.strip().rstrip("/")
        if legacy and legacy not in configured:
            configured.append(legacy)
        return configured


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
