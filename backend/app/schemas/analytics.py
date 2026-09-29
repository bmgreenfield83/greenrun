from datetime import date

from app.schemas.common import ApiModel


class MileagePoint(ApiModel):
    week_start: date
    miles: float


class PlanProgress(ApiModel):
    plan_name: str
    planned_miles: float
    completed_miles: float
    completed_sessions: int
    total_sessions: int
    skipped_sessions: int
    rescheduled_sessions: int
    current_week_planned_miles: float
    current_week_completed_miles: float


class PersonalBest(ApiModel):
    label: str
    value: str
    activity_id: str | None = None
    local_date: date


class ComparableRun(ApiModel):
    activity_id: str
    title: str | None
    local_date: date
    distance_miles: float
    pace_seconds_per_mile: float | None
    average_heart_rate: int | None
    temperature_fahrenheit: float | None
    humidity_percent: float | None

    @classmethod
    def from_activity(cls, activity: dict) -> "ComparableRun":
        summary = activity.get("summary") or {}
        speed = summary.get("average_speed_mps")
        celsius = summary.get("temperature_celsius")
        return cls(
            activity_id=activity["id"],
            title=activity.get("title"),
            local_date=activity["local_date"],
            distance_miles=round((activity.get("distance_meters") or 0) / 1609.344, 2),
            pace_seconds_per_mile=round(1609.344 / speed, 1) if speed else None,
            average_heart_rate=summary.get("average_heart_rate"),
            temperature_fahrenheit=round(celsius * 9 / 5 + 32, 1) if celsius is not None else None,
            humidity_percent=summary.get("humidity_percent"),
        )


class SameWeekdayRun(ApiModel):
    activity_id: str
    title: str | None
    local_date: date
    category: str | None
    distance_miles: float
    pace_seconds_per_mile: float | None
    average_heart_rate: int | None
    is_current: bool

    @classmethod
    def from_activity(cls, activity: dict, current_activity_id: str) -> "SameWeekdayRun":
        summary = activity.get("summary") or {}
        speed = summary.get("average_speed_mps")
        return cls(
            activity_id=activity["id"],
            title=activity.get("title"),
            local_date=activity["local_date"],
            category=activity.get("category"),
            distance_miles=round((activity.get("distance_meters") or 0) / 1609.344, 2),
            pace_seconds_per_mile=round(1609.344 / speed, 1) if speed else None,
            average_heart_rate=summary.get("average_heart_rate"),
            is_current=activity["id"] == current_activity_id,
        )


class TemperatureBand(ApiModel):
    label: str
    activity_count: int
    average_pace_seconds_per_mile: float | None


class HeartRateResponseResult(ApiModel):
    activity_id: str
    activity_title: str | None
    local_date: date
    category: str | None = None
    algorithm_version: int
    eligible: bool
    exclusion_reason: str | None = None
    adjusted_change_bpm_per_hour: float | None = None
    adjusted_total_change_bpm: float | None = None
    response_time_constant_seconds: int | None = None
    r_squared: float | None = None
    rmse_bpm: float | None = None
    analysis_start_seconds: int | None = None
    analysis_start_distance_meters: float | None = None
    usable_duration_seconds: float | None = None
    confidence: str | None = None
    interpretation: str | None = None


class AnalyticsSummary(ApiModel):
    as_of_date: date
    rolling_7_day_miles: float
    rolling_28_day_miles: float
    rolling_90_day_miles: float
    weekly_mileage: list[MileagePoint]
    plan_progress: PlanProgress | None
    personal_bests: list[PersonalBest]
    temperature_bands: list[TemperatureBand]
    heart_rate_response_history: list[HeartRateResponseResult]
