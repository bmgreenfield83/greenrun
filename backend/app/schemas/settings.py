from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import Field, field_validator

from app.schemas.common import ApiModel


class AppSettingsResponse(ApiModel):
    id: str = "application"
    schema_version: int = 1
    timezone: str = "America/New_York"
    sample_interval_seconds: int = 5
    sample_chunk_seconds: int = 600
    export_size_threshold_bytes: int = 26_214_400
    storage_limit_bytes: int
    storage_warning_thresholds: list[int] = [70, 85, 95]
    created_at_utc: datetime
    updated_at_utc: datetime


class AppSettingsUpdate(ApiModel):
    timezone: str | None = None
    sample_interval_seconds: int | None = Field(default=None, ge=1, le=60)
    export_size_threshold_bytes: int | None = Field(default=None, ge=1_048_576)
    storage_limit_bytes: int | None = Field(default=None, gt=0)

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: str | None) -> str | None:
        if value is None:
            return value
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as error:
            raise ValueError("timezone must be a valid IANA timezone") from error
        return value


class CollectionStorage(ApiModel):
    name: str
    data_size_bytes: int | None = None
    storage_size_bytes: int | None = None
    index_size_bytes: int | None = None


class StorageStatisticsResponse(ApiModel):
    available: bool
    configured_limit_bytes: int
    estimated_used_bytes: int | None = None
    usage_percent: float | None = None
    warning_threshold: int | None = None
    collections: list[CollectionStorage]
