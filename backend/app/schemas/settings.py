from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import Field, field_validator, model_validator

from app.schemas.common import ApiModel

MAX_HEART_RATE_RANGE = (100, 230)
RESTING_HEART_RATE_RANGE = (25, 120)
HEART_RATE_FIELDS = ("max_heart_rate_bpm", "resting_heart_rate_bpm")


class AppSettingsResponse(ApiModel):
    id: str = "application"
    schema_version: int = 1
    timezone: str = "America/New_York"
    sample_interval_seconds: int = 5
    sample_chunk_seconds: int = 600
    export_size_threshold_bytes: int = 26_214_400
    storage_limit_bytes: int
    storage_warning_thresholds: list[int] = [70, 85, 95]
    max_heart_rate_bpm: int | None = None
    resting_heart_rate_bpm: int | None = None
    created_at_utc: datetime
    updated_at_utc: datetime


class AppSettingsUpdate(ApiModel):
    timezone: str | None = None
    sample_interval_seconds: int | None = Field(default=None, ge=1, le=60)
    export_size_threshold_bytes: int | None = Field(default=None, ge=1_048_576)
    storage_limit_bytes: int | None = Field(default=None, gt=0)
    # Heart-rate fields are nullable: sending null clears a stored value.
    max_heart_rate_bpm: int | None = Field(
        default=None, ge=MAX_HEART_RATE_RANGE[0], le=MAX_HEART_RATE_RANGE[1]
    )
    resting_heart_rate_bpm: int | None = Field(
        default=None, ge=RESTING_HEART_RATE_RANGE[0], le=RESTING_HEART_RATE_RANGE[1]
    )

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

    @model_validator(mode="after")
    def validate_heart_rates(self) -> "AppSettingsUpdate":
        validate_heart_rate_pair(self.max_heart_rate_bpm, self.resting_heart_rate_bpm)
        return self


def validate_heart_rate_pair(maximum: int | None, resting: int | None) -> None:
    if maximum is not None and resting is not None and resting >= maximum:
        raise ValueError("resting_heart_rate_bpm must be lower than max_heart_rate_bpm")


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
