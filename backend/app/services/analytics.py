from __future__ import annotations

from datetime import date, timedelta
from statistics import median
from typing import Any

from app.repositories.activities import ActivityRepository, ActivitySampleRepository
from app.repositories.plans import PlannedSessionRepository, TrainingPlanRepository
from app.schemas.activities import ActivityResponse
from app.schemas.analytics import (
    AnalyticsSummary,
    BestEffort,
    ComparableRun,
    EasyPaceExclusion,
    EasyPaceHeartRate,
    EasyPaceMonth,
    EasyPaceRun,
    GoalDefinition,
    GoalEffort,
    GoalPlanReference,
    GoalProgress,
    GoalRep,
    GoalTrackSession,
    GoalWeek,
    HeartRateResponseResult,
    HeartRateZoneAnalytics,
    HeartRateZoneBoundary,
    LoadRatioBand,
    LongestRun,
    RunZoneSummary,
    SameWeekdayRun,
    TrainingLoad,
    TrainingLoadDay,
    ZoneWeek,
)
from app.schemas.common import utc_now
from app.services.best_efforts import (
    BEST_EFFORT_DISTANCES,
    distance_series,
    fastest_window,
    is_exact_distance_lap,
)
from app.services.easy_pace_heart_rate import (
    EASY_PACE_CATEGORIES,
    RunFit,
    fit_run,
    points_from_documents,
    reference_pace,
)
from app.services.fit.models import ActivitySample
from app.services.goal_progress import (
    TRACK_CATEGORY,
    counts_as_labeled_rep,
    counts_as_rep,
    distance_label,
    goal_weeks,
    has_workout_labels,
    is_rep_distance,
    pace_per_mile,
)
from app.services.heart_rate_response import ALGORITHM_VERSION as HEART_RATE_RESPONSE_VERSION
from app.services.heart_rate_response import calculate_heart_rate_response
from app.services.heart_rate_zones import heart_rate_reserve_zones
from app.services.settings import SettingsService
from app.services.training_load import (
    ACUTE_DAYS,
    CHRONIC_DAYS,
    LOAD_HISTORY_DAYS,
    RATIO_BANDS,
    RATIO_GUIDANCE,
    RunZones,
    time_in_zones,
    training_load,
)
from app.services.training_volume import (
    WEEKLY_INCREASE_THRESHOLD,
    WEEKLY_VOLUME_WEEKS,
    highest_week,
    monday_of,
    plan_progress,
    plan_weeks,
    weekly_volume,
)

METERS_PER_MILE = 1609.344
EASY_PACE_MONTHS = 12
# Categories whose time-in-zone distribution answers "are easy runs really easy?".
ZONE_EASY_CATEGORIES = ("easy", "recovery")


def _month_starts(today: date, count: int) -> list[date]:
    """First days of the last `count` calendar months, oldest first, ending with this month."""
    index = today.year * 12 + today.month - 1
    return [
        date((index - offset) // 12, (index - offset) % 12 + 1, 1)
        for offset in range(count - 1, -1, -1)
    ]


def _temperatures(activity: dict) -> dict[str, float | None]:
    celsius = (activity.get("summary") or {}).get("temperature_celsius")
    return {
        "temperature_celsius": celsius,
        "temperature_fahrenheit": round(celsius * 9 / 5 + 32, 1) if celsius is not None else None,
    }


def _effort_candidates(
    run: dict, points: list[tuple[float, float]], distance: float
) -> list[dict[str, Any]]:
    """Exact-distance effort candidates for one run: fastest sample window and exact laps."""
    candidates: list[dict[str, Any]] = []
    effort = fastest_window(points, distance) if points else None
    if effort:
        candidates.append(
            {
                "elapsed_seconds": round(effort.elapsed_seconds, 1),
                "pace_seconds_per_mile": round(
                    effort.elapsed_seconds / distance * METERS_PER_MILE, 1
                ),
                "source": "samples",
                "start_distance_meters": round(effort.start_distance_meters, 1),
            }
        )
    for lap in run.get("laps") or []:
        if is_exact_distance_lap(lap.get("distance_meters"), distance):
            seconds = lap["elapsed_time_seconds"]
            candidates.append(
                {
                    "elapsed_seconds": round(seconds, 1),
                    "pace_seconds_per_mile": round(seconds / distance * METERS_PER_MILE, 1),
                    "source": "lap",
                    "lap_index": lap.get("index"),
                }
            )
    return candidates


def _effort_rank(item: BestEffort | GoalEffort) -> tuple:
    """Fastest to the whole second, then race category, earlier date, lap over samples."""
    return (
        round(item.elapsed_seconds),
        item.category != "race",
        item.local_date,
        item.source != "lap",
    )


class AnalyticsService:
    def __init__(
        self,
        activities: ActivityRepository,
        plans: TrainingPlanRepository,
        sessions: PlannedSessionRepository,
        samples: ActivitySampleRepository,
        settings: SettingsService | None = None,
    ) -> None:
        self.activities, self.plans, self.sessions = activities, plans, sessions
        self.samples = samples
        self.settings = settings

    async def recalculate_heart_rate_response(self, today: date) -> int:
        activities = await self.activities.list_range(
            "0001-01-01", (today + timedelta(days=1)).isoformat()
        )
        updated = 0
        for document in activities:
            if document.get("sport") != "run":
                continue
            chunks = await self.samples.list_for_activity(document["id"])
            samples = [
                ActivitySample.model_validate(sample)
                for chunk in chunks
                for sample in chunk.get("samples", [])
            ]
            activity = ActivityResponse.model_validate(document)
            response = calculate_heart_rate_response(activity, samples)
            metrics = (document.get("derived_metrics") or {}) | {"heart_rate_response": response}
            metrics.pop("heart_rate_drift", None)
            await self.activities.update_metadata(
                document["id"],
                {"derived_metrics": metrics},
                utc_now(),
            )
            updated += 1
        return updated

    async def recalculate_activity_heart_rate_response(
        self, activity_id: str
    ) -> dict[str, Any] | None:
        document = await self.activities.get(activity_id)
        if not document:
            return None
        chunks = await self.samples.list_for_activity(activity_id)
        samples = [
            ActivitySample.model_validate(sample)
            for chunk in chunks
            for sample in chunk.get("samples", [])
        ]
        response = calculate_heart_rate_response(ActivityResponse.model_validate(document), samples)
        metrics = (document.get("derived_metrics") or {}) | {"heart_rate_response": response}
        metrics.pop("heart_rate_drift", None)
        await self.activities.update_metadata(activity_id, {"derived_metrics": metrics}, utc_now())
        return response

    async def summary(self, today: date) -> AnalyticsSummary:
        activities = await self.activities.list_range(
            "0001-01-01", (today + timedelta(days=1)).isoformat()
        )
        runs = [item for item in activities if item.get("sport") == "run"]
        active = await self.plans.get_active()
        progress = None
        planned_by_week: dict[date, float] = {}
        if active:
            weeks = plan_weeks(active, await self.sessions.list_for_plan(active["id"]))
            planned_by_week = {week.start: week.planned_miles for week in weeks}
            progress = plan_progress(active, weeks, {run["id"]: run for run in runs}, today)
        longest = max(runs, key=lambda run: run.get("distance_meters") or 0, default=None)
        return AnalyticsSummary(
            as_of_date=today,
            weekly_volume=weekly_volume(runs, today, planned_by_week),
            weekly_volume_increase_threshold_percent=WEEKLY_INCREASE_THRESHOLD * 100,
            plan_progress=progress,
            best_efforts=await self._best_efforts(runs),
            longest_run=LongestRun(
                activity_id=longest["id"],
                activity_title=longest.get("title"),
                local_date=longest["local_date"],
                distance_meters=longest.get("distance_meters") or 0,
                distance_miles=round((longest.get("distance_meters") or 0) / METERS_PER_MILE, 2),
            )
            if longest
            else None,
            highest_week=highest_week(runs),
            heart_rate_response_history=[
                HeartRateResponseResult(
                    activity_id=run["id"],
                    activity_title=run.get("title"),
                    local_date=run["local_date"],
                    category=run.get("category"),
                    **_temperatures(run),
                    **run["derived_metrics"]["heart_rate_response"],
                )
                for run in runs
                if (run.get("derived_metrics") or {}).get("heart_rate_response", {}).get("eligible")
            ],
            heart_rate_response_algorithm_version=HEART_RATE_RESPONSE_VERSION,
        )

    async def comparable_runs(self, activity_id: str) -> list[ComparableRun] | None:
        anchor = await self.activities.get(activity_id)
        if not anchor:
            return None
        activities = await self.activities.list_range("0001-01-01", "9999-12-31")
        return self._comparable_runs(
            [item for item in activities if item.get("sport") == "run"], anchor
        )

    async def same_weekday_runs(self, activity_id: str) -> list[SameWeekdayRun] | None:
        anchor = await self.activities.get(activity_id)
        if not anchor:
            return None
        if anchor.get("sport") != "run":
            return []
        anchor_date = date.fromisoformat(anchor["local_date"])
        activities = await self.activities.list_range("0001-01-01", anchor["local_date"])
        previous = sorted(
            (
                item
                for item in activities
                if item.get("sport") == "run"
                and item["id"] != anchor["id"]
                and (run_date := date.fromisoformat(item["local_date"])) < anchor_date
                and run_date.weekday() == anchor_date.weekday()
            ),
            key=lambda item: (item["local_date"], str(item.get("started_at_utc") or "")),
        )[-12:]
        return [SameWeekdayRun.from_activity(item, anchor["id"]) for item in [*previous, anchor]]

    async def _best_efforts(self, runs: list[dict]) -> list[BestEffort]:
        shortest = min(distance for _label, distance in BEST_EFFORT_DISTANCES)
        eligible = [run for run in runs if (run.get("distance_meters") or 0) >= shortest - 2]
        raw_series = await self.samples.list_distance_series([run["id"] for run in eligible])
        series = {key: distance_series(value) for key, value in raw_series.items()}
        results: list[BestEffort] = []
        for label, distance in BEST_EFFORT_DISTANCES:
            candidates = [
                BestEffort(
                    distance_label=label,
                    distance_meters=distance,
                    activity_id=run["id"],
                    activity_title=run.get("title"),
                    local_date=run["local_date"],
                    category=run.get("category"),
                    **candidate,
                )
                for run in eligible
                for candidate in _effort_candidates(run, series.get(run["id"], []), distance)
            ]
            if candidates:
                results.append(min(candidates, key=_effort_rank))
        return results

    async def _runs_between(self, start: date, end: date) -> list[dict]:
        """Run activities with local dates from `start` through `end` inclusive."""
        activities = await self.activities.list_range(
            start.isoformat(), (end + timedelta(days=1)).isoformat()
        )
        return [item for item in activities if item.get("sport") == "run"]

    async def _heart_rate_settings(self) -> tuple[int | None, int | None]:
        if self.settings is None:
            return None, None
        current = await self.settings.get()
        return current.max_heart_rate_bpm, current.resting_heart_rate_bpm

    async def heart_rate_zones(self, today: date) -> HeartRateZoneAnalytics:
        max_hr, resting_hr = await self._heart_rate_settings()
        common: dict[str, Any] = {
            "as_of_date": today,
            "max_heart_rate_bpm": max_hr,
            "resting_heart_rate_bpm": resting_hr,
            "easy_run_categories": list(ZONE_EASY_CATEGORIES),
        }
        if max_hr is None or resting_hr is None:
            return HeartRateZoneAnalytics(
                **common,
                status="heart_rate_settings_missing",
                message=(
                    "Set max and resting heart rate in Settings to see time in zones and "
                    "training load."
                ),
                zones=[],
                weekly_time_in_zones=[],
                easy_run_weekly_distribution=[],
                training_load=None,
                runs=[],
                runs_without_heart_rate=0,
            )
        current_week = monday_of(today)
        first_week = current_week - timedelta(weeks=WEEKLY_VOLUME_WEEKS - 1)
        window_start = min(first_week, today - timedelta(days=LOAD_HISTORY_DAYS - 1))
        all_runs = await self._runs_between(date(1, 1, 1), today)
        first_run_date = min(
            (date.fromisoformat(str(run["local_date"])) for run in all_runs), default=None
        )
        window_runs = [
            run for run in all_runs if date.fromisoformat(str(run["local_date"])) >= window_start
        ]
        raw = await self.samples.list_sample_fields(
            [run["id"] for run in window_runs], ("elapsed_seconds", "heart_rate", "speed_mps")
        )
        measured: list[tuple[dict, RunZones]] = []
        without_heart_rate = 0
        for run in window_runs:
            seconds = time_in_zones(raw.get(run["id"], []), max_hr, resting_hr)
            if not sum(seconds):
                without_heart_rate += 1
                continue
            measured.append(
                (
                    run,
                    RunZones(
                        activity_id=run["id"],
                        local_date=date.fromisoformat(str(run["local_date"])),
                        category=run.get("category"),
                        zone_seconds=seconds,
                    ),
                )
            )
        zone_runs = [zones for _run, zones in measured]

        def weeks(categories: tuple[str, ...] | None) -> list[ZoneWeek]:
            result: list[ZoneWeek] = []
            for offset in range(WEEKLY_VOLUME_WEEKS):
                week = first_week + timedelta(weeks=offset)
                selected = [
                    zones
                    for zones in zone_runs
                    if week <= zones.local_date <= week + timedelta(days=6)
                    and (categories is None or zones.category in categories)
                ]
                totals = [
                    round(sum(zones.zone_seconds[index] for zones in selected), 1)
                    for index in range(5)
                ]
                result.append(
                    ZoneWeek(
                        week_start=week,
                        week_end=week + timedelta(days=6),
                        is_partial=week == current_week,
                        run_count=len(selected),
                        zone_seconds=totals,
                        total_seconds=round(sum(totals), 1),
                    )
                )
            return result

        load = training_load(zone_runs, today, first_run_date)
        return HeartRateZoneAnalytics(
            **common,
            status="ok",
            zones=[
                HeartRateZoneBoundary(
                    zone=zone.zone,
                    lower_bpm=zone.lower_bpm,
                    upper_bpm=zone.upper_bpm,
                    lower_reserve_percent=round(zone.lower_reserve_fraction * 100),
                    upper_reserve_percent=round(zone.upper_reserve_fraction * 100),
                )
                for zone in heart_rate_reserve_zones(max_hr, resting_hr)
            ],
            weekly_time_in_zones=weeks(None),
            easy_run_weekly_distribution=weeks(ZONE_EASY_CATEGORIES),
            training_load=TrainingLoad(
                days=[
                    TrainingLoadDay(day=day, trimp=trimp, run_count=count)
                    for day, trimp, count in load.daily
                ],
                acute_days=ACUTE_DAYS,
                chronic_days=CHRONIC_DAYS,
                acute_load=load.acute_load,
                chronic_load=load.chronic_load,
                acute_chronic_ratio=load.ratio,
                ratio_band=load.band,
                chronic_history_complete=load.chronic_history_complete,
                bands=[
                    LoadRatioBand(label=label, lower=lower, upper=upper, description=text)
                    for label, lower, upper, text in RATIO_BANDS
                ],
                guidance=RATIO_GUIDANCE,
            ),
            runs=[
                RunZoneSummary(
                    activity_id=run["id"],
                    activity_title=run.get("title"),
                    local_date=zones.local_date,
                    category=zones.category,
                    zone_seconds=[round(value, 1) for value in zones.zone_seconds],
                    total_seconds=round(zones.total_seconds, 1),
                    trimp=round(zones.trimp, 1),
                )
                for run, zones in reversed(measured)
            ],
            runs_without_heart_rate=without_heart_rate,
        )

    async def easy_pace_heart_rate(self, today: date) -> EasyPaceHeartRate:
        month_starts = _month_starts(today, EASY_PACE_MONTHS)
        runs = [
            run
            for run in await self._runs_between(month_starts[0], today)
            if run.get("category") in EASY_PACE_CATEGORIES
        ]
        raw = await self.samples.list_sample_fields(
            [run["id"] for run in runs],
            ("elapsed_seconds", "distance_meters", "elevation_meters", "heart_rate", "speed_mps"),
        )
        fitted: list[tuple[dict, RunFit]] = []
        excluded: list[EasyPaceExclusion] = []

        def exclude(run: dict, reason: str) -> None:
            excluded.append(
                EasyPaceExclusion(
                    activity_id=run["id"],
                    activity_title=run.get("title"),
                    local_date=run["local_date"],
                    category=run.get("category"),
                    reason=reason,
                )
            )

        for run in runs:
            points = points_from_documents(raw.get(run["id"], []))
            outcome = fit_run(points) if points else "No stored samples."
            if isinstance(outcome, str):
                exclude(run, outcome)
            else:
                fitted.append((run, outcome))
        reference = reference_pace(fit for _run, fit in fitted)
        included: list[EasyPaceRun] = []
        for run, fit in fitted:
            if reference is None or not fit.covers(reference):
                exclude(run, "Reference pace is outside this run's grade-adjusted pace range.")
                continue
            included.append(
                EasyPaceRun(
                    activity_id=run["id"],
                    activity_title=run.get("title"),
                    local_date=run["local_date"],
                    category=run.get("category"),
                    heart_rate_at_reference_bpm=round(fit.heart_rate_at(reference), 1),
                    slope_bpm_per_second_per_mile=round(fit.slope, 3),
                    median_grade_adjusted_pace_seconds_per_mile=round(fit.median_pace, 1),
                    median_heart_rate_bpm=round(fit.median_heart_rate, 1),
                    steady_duration_seconds=round(fit.steady_seconds, 1),
                    **_temperatures(run),
                )
            )
        months: list[EasyPaceMonth] = []
        for month in month_starts:
            values = [
                item.heart_rate_at_reference_bpm
                for item in included
                if (item.local_date.year, item.local_date.month) == (month.year, month.month)
            ]
            months.append(
                EasyPaceMonth(
                    month=month,
                    median_heart_rate_bpm=round(median(values), 1) if values else None,
                    run_count=len(values),
                )
            )
        return EasyPaceHeartRate(
            as_of_date=today,
            categories=list(EASY_PACE_CATEGORIES),
            window_start=month_starts[0],
            reference_pace_seconds_per_mile=reference,
            months=months,
            runs=included,
            excluded=excluded,
        )

    async def goal_progress(self, today: date) -> GoalProgress:
        active = await self.plans.get_active()
        if not active:
            return GoalProgress(as_of_date=today, status="no_active_plan")
        start = date.fromisoformat(str(active["start_date"]))
        end = date.fromisoformat(str(active["end_date"]))
        plan = GoalPlanReference(
            plan_id=active["id"], plan_name=active["name"], start_date=start, end_date=end
        )
        target = active.get("goal_target")
        if not target:
            return GoalProgress(as_of_date=today, status="no_goal", plan=plan)
        distance = float(target["distance_meters"])
        goal_time = float(target["target_time_seconds"])
        goal_pace = pace_per_mile(goal_time, distance)
        week_starts = goal_weeks(start, end)
        window_start = week_starts[0]
        window_end = min(today, week_starts[-1] + timedelta(days=6))
        runs = (
            await self._runs_between(window_start, window_end) if window_end >= window_start else []
        )
        eligible = [run for run in runs if (run.get("distance_meters") or 0) >= distance - 2]
        raw_series = await self.samples.list_distance_series([run["id"] for run in eligible])
        efforts = [
            GoalEffort(
                activity_id=run["id"],
                activity_title=run.get("title"),
                local_date=run["local_date"],
                category=run.get("category"),
                **candidate,
            )
            for run in eligible
            for candidate in _effort_candidates(
                run, distance_series(raw_series.get(run["id"], [])), distance
            )
        ]
        weeks = [
            GoalWeek(
                week_start=week,
                week_end=week + timedelta(days=6),
                is_before_plan=week < monday_of(start),
                is_future=week > today,
                best_effort=min(
                    (
                        effort
                        for effort in efforts
                        if week <= effort.local_date <= week + timedelta(days=6)
                    ),
                    key=_effort_rank,
                    default=None,
                ),
            )
            for week in week_starts
        ]
        best = min(efforts, key=_effort_rank, default=None)
        sessions: list[GoalTrackSession] = []
        for run in reversed(runs):
            if run.get("category") != TRACK_CATEGORY:
                continue
            rep_laps = [
                (lap, pace_per_mile(lap["elapsed_time_seconds"], lap["distance_meters"]))
                for lap in run.get("laps") or []
                if is_rep_distance(lap.get("distance_meters")) and lap.get("elapsed_time_seconds")
            ]
            fastest = min((pace for _lap, pace in rep_laps), default=0.0)
            labeled = has_workout_labels(run.get("laps") or [])
            laps = [
                GoalRep(
                    lap_index=lap["index"],
                    distance_meters=round(lap["distance_meters"], 1),
                    elapsed_seconds=round(lap["elapsed_time_seconds"], 1),
                    pace_seconds_per_mile=round(pace, 1),
                    pace_seconds_per_400m=round(pace / METERS_PER_MILE * 400, 1),
                    pace_delta_seconds_per_mile=round(pace - goal_pace, 1),
                    counts_as_rep=(
                        counts_as_labeled_rep(lap)
                        if labeled
                        else counts_as_rep(pace, fastest, goal_pace)
                    ),
                    at_or_under_goal_pace=pace <= goal_pace,
                )
                for lap, pace in rep_laps
            ]
            sessions.append(
                GoalTrackSession(
                    activity_id=run["id"],
                    activity_title=run.get("title"),
                    local_date=run["local_date"],
                    rep_count=sum(lap.counts_as_rep for lap in laps),
                    reps_at_or_under_goal_pace=sum(
                        lap.at_or_under_goal_pace for lap in laps if lap.counts_as_rep
                    ),
                    rep_source="workout" if labeled else "pace",
                    laps=laps,
                )
            )
        return GoalProgress(
            as_of_date=today,
            status="ok",
            plan=plan,
            goal=GoalDefinition(
                distance_meters=distance,
                distance_label=distance_label(distance),
                target_time_seconds=goal_time,
                pace_seconds_per_mile=round(goal_pace, 1),
                pace_seconds_per_400m=round(goal_time / distance * 400, 1),
            ),
            window_start=window_start,
            window_end=window_end,
            weeks=weeks,
            current_best=best,
            gap_seconds=round(best.elapsed_seconds - goal_time, 1) if best else None,
            gap_pace_seconds_per_mile=(
                round(best.pace_seconds_per_mile - goal_pace, 1) if best else None
            ),
            track_sessions=sessions,
        )

    def _comparable_runs(self, runs: list[dict], anchor: dict | None = None) -> list[ComparableRun]:
        ordered = sorted(runs, key=lambda run: run["local_date"], reverse=True)
        if not ordered:
            return []
        anchor = anchor or ordered[0]
        distance = anchor.get("distance_meters") or 0
        return [
            ComparableRun.from_activity(run)
            for run in ordered
            if run["id"] != anchor["id"]
            if run.get("category") == anchor.get("category")
            and distance
            and abs((run.get("distance_meters") or 0) - distance) / distance <= 0.15
        ][:6]
