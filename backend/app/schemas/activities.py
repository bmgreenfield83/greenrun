from datetime import date, datetime
from typing import Annotated, Any

from pydantic import Field, model_validator

from app.models.enums import ActivitySourceType, RunCategory, Sport
from app.schemas.common import ApiModel

PositiveSeconds = Annotated[float, Field(gt=0)]


class ActivitySummary(ApiModel):
    average_heart_rate: int | None = Field(default=None, ge=1)
    maximum_heart_rate: int | None = Field(default=None, ge=1)
    average_speed_mps: float | None = Field(default=None, ge=0)
    average_cadence_spm: float | None = Field(default=None, ge=0)
    maximum_cadence_spm: float | None = Field(default=None, ge=0)
    elevation_gain_meters: float | None = Field(default=None, ge=0)
    elevation_loss_meters: float | None = Field(default=None, ge=0)
    calories: float | None = Field(default=None, ge=0)
    temperature_celsius: float | None = None
    humidity_percent: float | None = Field(default=None, ge=0, le=100)
    aerobic_training_effect: float | None = Field(default=None, ge=0)
    anaerobic_training_effect: float | None = Field(default=None, ge=0)


class ActivityLap(ApiModel):
    index: int = Field(ge=1)
    start_time_utc: datetime | None = None
    elapsed_time_seconds: float = Field(gt=0)
    moving_time_seconds: float | None = Field(default=None, ge=0)
    distance_meters: float | None = Field(default=None, ge=0)
    average_speed_mps: float | None = Field(default=None, ge=0)
    average_heart_rate: int | None = Field(default=None, ge=1)
    maximum_heart_rate: int | None = Field(default=None, ge=1)
    average_cadence_spm: float | None = Field(default=None, ge=0)
    maximum_cadence_spm: float | None = Field(default=None, ge=0)
    elevation_gain_meters: float | None = Field(default=None, ge=0)
    elevation_loss_meters: float | None = Field(default=None, ge=0)
    lap_trigger: str | None = None
    # Garmin lap intensity (active, rest, warmup, cooldown, recovery, interval, other) and the
    # structured-workout step the lap belongs to. Recorded only for imports after 2026-09-29.
    intensity: str | None = None
    workout_step_index: int | None = Field(default=None, ge=0)


class SubjectiveData(ApiModel):
    effort: int | None = Field(default=None, ge=0, le=10)
    effort_label: str | None = None
    feel: str | None = None
    sleep_score: int | None = Field(default=None, ge=0, le=100)
    sleep_label: str | None = Field(default=None, pattern="^(poor|fair|good|great)$")
    pain_soreness_notes: str | None = Field(default=None, max_length=4000)
    notes: str | None = Field(default=None, max_length=10000)


class ActivitySource(ApiModel):
    type: ActivitySourceType
    filename: str | None = None
    checksum_sha256: str | None = Field(default=None, min_length=64, max_length=64)
    imported_at_utc: datetime | None = None
    parser_version: str | None = None
    # 2 = running cadence stored in steps/min; absent/1 = legacy per-leg Garmin running cadence.
    cadence_scale_version: int | None = None
    device_manufacturer: str | None = None
    device_product: str | None = None
    garmin_activity_id: str | None = None


class ActivityCreate(ApiModel):
    sport: Sport
    category: RunCategory | None = None
    title: str | None = Field(default=None, max_length=200)
    started_at_utc: datetime
    timezone: str = "America/New_York"
    local_date: date
    distance_meters: float | None = Field(default=None, ge=0)
    elapsed_time_seconds: PositiveSeconds
    moving_time_seconds: float | None = Field(default=None, ge=0)
    summary: ActivitySummary = Field(default_factory=ActivitySummary)
    laps: list[ActivityLap] = Field(default_factory=list)
    subjective: SubjectiveData = Field(default_factory=SubjectiveData)
    weather_notes: str | None = Field(default=None, max_length=4000)
    source: ActivitySource
    planned_session_id: str | None = None
    heart_rate_analysis_start_distance_meters: float | None = Field(default=None, ge=0)
    derived_metrics: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_activity_shape(self) -> "ActivityCreate":
        if self.sport != Sport.RUN and self.category is not None:
            raise ValueError("category is only valid for running activities")
        if self.sport == Sport.STRENGTH and self.distance_meters is not None:
            raise ValueError("strength activities cannot have distance")
        if self.moving_time_seconds and self.moving_time_seconds > self.elapsed_time_seconds:
            raise ValueError("moving time cannot exceed elapsed time")
        return self


class ActivityMetadataUpdate(ApiModel):
    title: str | None = Field(default=None, max_length=200)
    category: RunCategory | None = None
    subjective: SubjectiveData | None = None
    weather_notes: str | None = Field(default=None, max_length=4000)
    planned_session_id: str | None = None
    heart_rate_analysis_start_distance_meters: float | None = Field(default=None, ge=0)


class ActivityResponse(ActivityCreate):
    id: str
    schema_version: int
    created_at_utc: datetime
    updated_at_utc: datetime


class ActivityListResponse(ApiModel):
    items: list[ActivityResponse]
    total: int


class ActivitySampleResponse(ApiModel):
    elapsed_seconds: int = Field(ge=0)
    distance_meters: float | None = Field(default=None, ge=0)
    heart_rate: int | None = Field(default=None, ge=1)
    speed_mps: float | None = Field(default=None, ge=0)
    cadence_spm: float | None = Field(default=None, ge=0)
    elevation_meters: float | None = None
    temperature_celsius: float | None = None


class ActivitySamplesResponse(ApiModel):
    items: list[ActivitySampleResponse]
    total: int
