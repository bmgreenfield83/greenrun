from datetime import date

from app.schemas.common import ApiModel


class WorkloadRun(ApiModel):
    activity_id: str
    title: str | None
    local_date: date
    heart_rate_bpm: float
    pace_seconds_per_mile: float
    matched_minutes: float
    temperature_fahrenheit: float | None


class WorkloadWeek(ApiModel):
    week_start: date
    median_heart_rate_bpm: float
    minimum_heart_rate_bpm: float
    maximum_heart_rate_bpm: float
    run_count: int


class WorkloadComparison(ApiModel):
    id: str
    category: str
    pace_seconds_per_mile: int
    start_minute: int
    end_minute: int
    temperature_min_fahrenheit: float | None
    temperature_max_fahrenheit: float | None
    runs: list[WorkloadRun]
    weeks: list[WorkloadWeek]


class WorkloadTrend(ApiModel):
    algorithm_version: int = 1
    start_date: date
    end_date: date
    runs_screened: int
    qualifying_runs: int
    exclusion_counts: dict[str, int]
    comparisons: list[WorkloadComparison]
