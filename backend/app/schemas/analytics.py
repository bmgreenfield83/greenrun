from datetime import date
from typing import Literal

from app.schemas.common import ApiModel


class WeeklyVolumeWeek(ApiModel):
    week_start: date
    week_end: date
    miles: float
    run_count: int
    # True for the current, still-in-progress week (never flagged, no trailing average).
    is_partial: bool
    # Active plan's planned weekly miles for this week; null when the active plan does not cover it.
    planned_miles: float | None
    # Mean of this week and the three before it; null for the partial week or without 4 weeks of
    # history.
    trailing_4_week_average_miles: float | None
    # Mean of the four weeks before this week; null without 4 weeks of history.
    prior_4_week_average_miles: float | None
    # Completed week whose miles exceed prior_4_week_average_miles by more than the threshold.
    exceeds_prior_average: bool


class PlanProgress(ApiModel):
    plan_id: str
    plan_name: str
    start_date: date
    end_date: date
    total_weeks: int
    # Null when today is outside the plan's weeks.
    current_week_number: int | None
    total_planned_miles: float
    planned_miles_to_date: float
    completed_miles_to_date: float
    total_sessions: int
    sessions_due_to_date: int
    sessions_completed_to_date: int
    sessions_skipped_to_date: int
    current_week_planned_miles: float | None
    current_week_planned_miles_to_date: float | None
    current_week_completed_miles: float | None


class BestEffort(ApiModel):
    distance_label: str
    distance_meters: float
    elapsed_seconds: float
    pace_seconds_per_mile: float
    activity_id: str
    activity_title: str | None
    local_date: date
    category: str | None = None
    source: Literal["samples", "lap"]
    lap_index: int | None = None
    # Distance into the activity where the effort starts (samples source only).
    start_distance_meters: float | None = None


class LongestRun(ApiModel):
    activity_id: str
    activity_title: str | None
    local_date: date
    distance_meters: float
    distance_miles: float


class HighestWeek(ApiModel):
    week_start: date
    miles: float


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


class AnalysisRange(ApiModel):
    """Contiguous elapsed-time range (seconds) of samples included in the HR-response fit."""

    start_seconds: int
    end_seconds: int


class HeartRateResponseResult(ApiModel):
    activity_id: str
    activity_title: str | None
    local_date: date
    category: str | None = None
    # Activity summary temperature recorded by the device (wrist sensors read high); null when
    # not recorded.
    temperature_celsius: float | None = None
    temperature_fahrenheit: float | None = None
    algorithm_version: int
    eligible: bool
    exclusion_reason: str | None = None
    adjusted_change_bpm_per_hour: float | None = None
    # Version 4+: 90% moving-block bootstrap interval for adjusted_change_bpm_per_hour.
    adjusted_change_lower_90_bpm_per_hour: float | None = None
    adjusted_change_upper_90_bpm_per_hour: float | None = None
    adjusted_total_change_bpm: float | None = None
    response_time_constant_seconds: int | None = None
    r_squared: float | None = None
    rmse_bpm: float | None = None
    analysis_start_seconds: int | None = None
    # Version 4+: last included sample and the included ranges (breaks at stops > 15 s).
    analysis_end_seconds: int | None = None
    analysis_ranges: list[AnalysisRange] | None = None
    analysis_start_distance_meters: float | None = None
    usable_duration_seconds: float | None = None
    stop_count: int | None = None
    stopped_duration_seconds: float | None = None
    bootstrap_resamples: int | None = None
    bootstrap_block_seconds: int | None = None
    confidence: str | None = None
    interpretation: str | None = None


class AnalyticsSummary(ApiModel):
    as_of_date: date
    weekly_volume: list[WeeklyVolumeWeek]
    weekly_volume_increase_threshold_percent: float
    plan_progress: PlanProgress | None
    best_efforts: list[BestEffort]
    longest_run: LongestRun | None
    highest_week: HighestWeek | None
    # Eligible results, oldest first. Results whose algorithm_version is lower than
    # heart_rate_response_algorithm_version are stale until "Recalculate HR response" runs.
    heart_rate_response_history: list[HeartRateResponseResult]
    heart_rate_response_algorithm_version: int


# --- Heart-rate zones and training load -------------------------------------------------------


class HeartRateZoneBoundary(ApiModel):
    zone: int
    lower_bpm: float
    upper_bpm: float
    lower_reserve_percent: float
    upper_reserve_percent: float


class ZoneWeek(ApiModel):
    week_start: date
    week_end: date
    is_partial: bool
    run_count: int
    # Seconds in Z1..Z5 (index 0 = Z1).
    zone_seconds: list[float]
    total_seconds: float


class RunZoneSummary(ApiModel):
    activity_id: str
    activity_title: str | None
    local_date: date
    category: str | None
    zone_seconds: list[float]
    total_seconds: float
    trimp: float


class TrainingLoadDay(ApiModel):
    day: date
    trimp: float
    run_count: int


class LoadRatioBand(ApiModel):
    label: Literal["low", "typical", "elevated", "spike"]
    lower: float | None
    upper: float | None
    description: str


class TrainingLoad(ApiModel):
    # Last 120 days, oldest first, zero-filled.
    days: list[TrainingLoadDay]
    acute_days: int
    chronic_days: int
    # Sum of TRIMP over the last 7 days.
    acute_load: float
    # Sum of TRIMP over the last 28 days divided by 4 (average week).
    chronic_load: float
    # Null when chronic load is 0 or recorded history is shorter than 28 days.
    acute_chronic_ratio: float | None
    ratio_band: Literal["low", "typical", "elevated", "spike"] | None
    chronic_history_complete: bool
    bands: list[LoadRatioBand]
    guidance: str


class HeartRateZoneAnalytics(ApiModel):
    as_of_date: date
    status: Literal["ok", "heart_rate_settings_missing"]
    # Human-readable explanation when status is not "ok".
    message: str | None = None
    max_heart_rate_bpm: int | None
    resting_heart_rate_bpm: int | None
    zones: list[HeartRateZoneBoundary]
    # 16 Monday-based weeks, oldest first, zero-filled; all runs.
    weekly_time_in_zones: list[ZoneWeek]
    easy_run_categories: list[str]
    # Same weeks, only runs in easy_run_categories.
    easy_run_weekly_distribution: list[ZoneWeek]
    training_load: TrainingLoad | None
    # Every run in the 16-week / 120-day window that has heart-rate zone time, newest first.
    runs: list[RunZoneSummary]
    # Runs in the window without usable heart-rate samples (counted as zero load).
    runs_without_heart_rate: int


# --- Heart rate at easy grade-adjusted pace -------------------------------------------------


class EasyPaceMonth(ApiModel):
    # First day of the month.
    month: date
    median_heart_rate_bpm: float | None
    run_count: int


class EasyPaceRun(ApiModel):
    activity_id: str
    activity_title: str | None
    local_date: date
    category: str | None
    heart_rate_at_reference_bpm: float
    # Change in bpm per 1 s/mi slower; negative means heart rate falls as pace slows.
    slope_bpm_per_second_per_mile: float
    median_grade_adjusted_pace_seconds_per_mile: float
    median_heart_rate_bpm: float
    steady_duration_seconds: float
    temperature_celsius: float | None
    temperature_fahrenheit: float | None


class EasyPaceExclusion(ApiModel):
    activity_id: str
    activity_title: str | None
    local_date: date
    category: str | None
    reason: str


class EasyPaceHeartRate(ApiModel):
    as_of_date: date
    categories: list[str]
    window_start: date
    # Median of the included runs' median grade-adjusted paces, rounded to 15 s/mi; null when no
    # run qualifies.
    reference_pace_seconds_per_mile: int | None
    # Last 12 calendar months, oldest first, zero-filled (null median).
    months: list[EasyPaceMonth]
    runs: list[EasyPaceRun]
    excluded: list[EasyPaceExclusion]


# --- Goal card -------------------------------------------------------------------------------


class GoalEffort(ApiModel):
    activity_id: str
    activity_title: str | None
    local_date: date
    category: str | None
    elapsed_seconds: float
    pace_seconds_per_mile: float
    source: Literal["samples", "lap"]
    lap_index: int | None = None
    start_distance_meters: float | None = None


class GoalWeek(ApiModel):
    week_start: date
    week_end: date
    # True for weeks before the plan's first week (the 12-week lead-in).
    is_before_plan: bool
    is_future: bool
    best_effort: GoalEffort | None


class GoalRep(ApiModel):
    lap_index: int
    distance_meters: float
    elapsed_seconds: float
    pace_seconds_per_mile: float
    pace_seconds_per_400m: float
    # Lap pace minus goal pace (s/mi); negative = faster than goal.
    pace_delta_seconds_per_mile: float
    # Heuristic work-rep flag: within 15% of the session's fastest 200-1600 m lap and no more than
    # 60% slower than goal pace, or at/faster than goal pace. Other laps are treated as
    # warm-up/recovery.
    counts_as_rep: bool
    at_or_under_goal_pace: bool


class GoalTrackSession(ApiModel):
    activity_id: str
    activity_title: str | None
    local_date: date
    # Laps with counts_as_rep.
    rep_count: int
    # Laps at or faster than goal pace (always also counted as reps).
    reps_at_or_under_goal_pace: int
    # Every 200-1600 m lap in lap order, including warm-up/recovery laps.
    laps: list[GoalRep]
    # "workout": the watch's lap labels decided which laps are reps; "pace": inferred from pace.
    rep_source: Literal["workout", "pace"] = "pace"


class GoalDefinition(ApiModel):
    distance_meters: float
    distance_label: str
    target_time_seconds: float
    pace_seconds_per_mile: float
    pace_seconds_per_400m: float


class GoalPlanReference(ApiModel):
    plan_id: str
    plan_name: str
    start_date: date
    end_date: date


class GoalProgress(ApiModel):
    as_of_date: date
    status: Literal["ok", "no_active_plan", "no_goal"]
    plan: GoalPlanReference | None = None
    goal: GoalDefinition | None = None
    window_start: date | None = None
    window_end: date | None = None
    weeks: list[GoalWeek] = []
    # Fastest effort in the window (lead-in + plan to date).
    current_best: GoalEffort | None = None
    # current_best elapsed minus goal time; positive = slower than goal.
    gap_seconds: float | None = None
    gap_pace_seconds_per_mile: float | None = None
    # Track-category runs in the window, newest first.
    track_sessions: list[GoalTrackSession] = []
