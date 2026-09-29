from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from math import sqrt
from statistics import mean, median
from typing import Any

from app.repositories.activities import ActivityRepository, ActivitySampleRepository
from app.repositories.plans import PlannedSessionRepository, TrainingPlanRepository
from app.schemas.activities import ActivityResponse
from app.schemas.analytics import (
    AnalyticsSummary,
    ComparableRun,
    HeartRateResponseResult,
    MileagePoint,
    PersonalBest,
    PlanProgress,
    SameWeekdayRun,
    TemperatureBand,
)
from app.schemas.common import utc_now
from app.schemas.workload_trend import WorkloadTrend
from app.services.fit.models import ActivitySample
from app.services.workload_trend import (
    STEADY_CATEGORIES,
    build_workload_trend,
    merge_workload_comparisons,
)

METERS_PER_MILE = 1609.344


def _solve_weighted_regression(
    rows: list[tuple[float, float, float]], weights: list[float]
) -> tuple[float, float, float] | None:
    matrix = [[0.0] * 4 for _ in range(3)]
    for (workload, hours, heart_rate), weight in zip(rows, weights, strict=True):
        predictors = (1.0, workload, hours)
        for row in range(3):
            for column in range(3):
                matrix[row][column] += weight * predictors[row] * predictors[column]
            matrix[row][3] += weight * predictors[row] * heart_rate
    matrix[1][1] += 1e-6
    for pivot in range(3):
        selected = max(range(pivot, 3), key=lambda row: abs(matrix[row][pivot]))
        if abs(matrix[selected][pivot]) < 1e-9:
            return None
        matrix[pivot], matrix[selected] = matrix[selected], matrix[pivot]
        divisor = matrix[pivot][pivot]
        matrix[pivot] = [value / divisor for value in matrix[pivot]]
        for row in range(3):
            if row == pivot:
                continue
            factor = matrix[row][pivot]
            matrix[row] = [
                value - factor * pivot_value
                for value, pivot_value in zip(matrix[row], matrix[pivot], strict=True)
            ]
    return matrix[0][3], matrix[1][3], matrix[2][3]


def _robust_regression(
    rows: list[tuple[float, float, float]],
) -> tuple[tuple[float, float, float], list[float]] | None:
    weights = [1.0] * len(rows)
    coefficients = _solve_weighted_regression(rows, weights)
    if coefficients is None:
        return None
    for _ in range(6):
        predictions = [
            coefficients[0] + coefficients[1] * workload + coefficients[2] * hours
            for workload, hours, _heart_rate in rows
        ]
        residuals = [row[2] - prediction for row, prediction in zip(rows, predictions, strict=True)]
        scale = max(1.0, median(abs(value) for value in residuals) * 1.4826)
        cutoff = 1.5 * scale
        weights = [1.0 if abs(value) <= cutoff else cutoff / abs(value) for value in residuals]
        updated = _solve_weighted_regression(rows, weights)
        if updated is None:
            return None
        coefficients = updated
    predictions = [
        coefficients[0] + coefficients[1] * workload + coefficients[2] * hours
        for workload, hours, _heart_rate in rows
    ]
    return coefficients, predictions


def _correlation(left: list[float], right: list[float]) -> float:
    left_mean, right_mean = mean(left), mean(right)
    numerator = sum((x - left_mean) * (y - right_mean) for x, y in zip(left, right, strict=True))
    left_sum = sum((value - left_mean) ** 2 for value in left)
    right_sum = sum((value - right_mean) ** 2 for value in right)
    return numerator / sqrt(left_sum * right_sum) if left_sum and right_sum else 0.0


def _delayed_workloads(
    samples: list[ActivitySample], response_seconds: int
) -> list[tuple[ActivitySample, float]]:
    result: list[tuple[ActivitySample, float]] = []
    filtered: float | None = None
    prior: ActivitySample | None = None
    for index, sample in enumerate(samples):
        speed = sample.speed_mps or 0.0
        earlier = samples[max(0, index - 6)]
        distance_change = (sample.distance_meters or 0) - (earlier.distance_meters or 0)
        elevation_change = (
            (sample.elevation_meters or 0) - (earlier.elevation_meters or 0)
            if sample.elevation_meters is not None and earlier.elevation_meters is not None
            else 0.0
        )
        grade = (
            max(-0.25, min(0.25, elevation_change / distance_change))
            if distance_change >= 20
            else 0
        )
        factor = 1 + (4 * grade if grade >= 0 else 2 * grade)
        workload = speed * max(0.65, min(2.0, factor))
        elapsed = min(15, max(1, sample.elapsed_seconds - prior.elapsed_seconds)) if prior else 5
        alpha = elapsed / (response_seconds + elapsed)
        filtered = workload if filtered is None else filtered + alpha * (workload - filtered)
        result.append((sample, filtered))
        prior = sample
    return result


def calculate_heart_rate_response(activity: Any, samples: list[ActivitySample]) -> dict[str, Any]:
    base = {"algorithm_version": 3, "eligible": False, "exclusion_reason": None}
    if str(activity.sport) != "run":
        return base | {"exclusion_reason": "Only running activities are eligible."}
    if activity.elapsed_time_seconds < 1500:
        return base | {"exclusion_reason": "Activity is shorter than 25 minutes."}
    ordered = sorted(samples, key=lambda sample: sample.elapsed_seconds)
    start_distance = getattr(activity, "heart_rate_analysis_start_distance_meters", None)
    analysis = [
        sample
        for sample in ordered
        if sample.elapsed_seconds >= 300
        and (
            start_distance is None
            or (sample.distance_meters is not None and sample.distance_meters >= start_distance)
        )
    ]
    if len(analysis) < 100:
        return base | {"exclusion_reason": "Insufficient samples after the warm-up."}
    valid = [sample for sample in analysis if sample.heart_rate and (sample.speed_mps or 0) >= 0.5]
    if len(valid) / len(analysis) < 0.8:
        return base | {"exclusion_reason": "Heart-rate or speed coverage is below 80%."}
    usable_seconds = sum(
        min(right.elapsed_seconds - left.elapsed_seconds, 10)
        for left, right in zip(valid, valid[1:], strict=False)
    )
    if usable_seconds < 1200:
        return base | {"exclusion_reason": "Less than 20 minutes of usable running data remains."}
    best: tuple[float, int, tuple[float, float, float], list[float], list[float]] | None = None
    response_candidates = (15, 30, 45, 60, 90, 120)
    for response_seconds in response_candidates:
        delayed = _delayed_workloads(valid, response_seconds)
        workloads = [workload for _sample, workload in delayed]
        rows = [
            (
                workload,
                (sample.elapsed_seconds - valid[0].elapsed_seconds) / 3600,
                sample.heart_rate,
            )
            for sample, workload in delayed
            if sample.heart_rate is not None
        ]
        fitted = _robust_regression(rows)
        if fitted is None or fitted[0][1] < -0.1:
            continue
        coefficients, predictions = fitted
        rmse = sqrt(
            mean(
                (row[2] - predicted) ** 2 for row, predicted in zip(rows, predictions, strict=True)
            )
        )
        if best is None or rmse < best[0]:
            best = rmse, response_seconds, coefficients, predictions, workloads
    if best is None:
        return base | {"exclusion_reason": "Workload and heart-rate response could not be modeled."}
    rmse, response_seconds, coefficients, predictions, workloads = best
    hours = [(sample.elapsed_seconds - valid[0].elapsed_seconds) / 3600 for sample in valid]
    if abs(_correlation(workloads, hours)) > 0.92:
        return base | {
            "exclusion_reason": (
                "Pace or grade changed too consistently with time to separate workload "
                "from the heart-rate time trend."
            )
        }
    heart_rates = [float(sample.heart_rate) for sample in valid if sample.heart_rate is not None]
    total_variation = sum((value - mean(heart_rates)) ** 2 for value in heart_rates)
    residual_variation = sum(
        (value - prediction) ** 2
        for value, prediction in zip(heart_rates, predictions, strict=True)
    )
    r_squared = max(0.0, 1 - residual_variation / total_variation) if total_variation else 0.0
    workload_mean = mean(workloads)
    workload_variability = (
        sqrt(mean((value - workload_mean) ** 2 for value in workloads)) / workload_mean
        if workload_mean
        else 0
    )
    duration_hours = usable_seconds / 3600
    adjusted_rate = coefficients[2]
    confidence_score = sum(
        (
            usable_seconds >= 3300,
            usable_seconds >= 2100,
            r_squared >= 0.75,
            r_squared >= 0.5,
            rmse <= 5,
            rmse <= 8,
        )
    )
    confidence = "high" if confidence_score >= 5 else "moderate" if confidence_score >= 3 else "low"
    return base | {
        "eligible": True,
        "adjusted_change_bpm_per_hour": round(adjusted_rate, 2),
        "adjusted_total_change_bpm": round(adjusted_rate * duration_hours, 2),
        "response_time_constant_seconds": (
            response_seconds if workload_variability >= 0.05 else None
        ),
        "r_squared": round(r_squared, 3),
        "rmse_bpm": round(rmse, 2),
        "analysis_start_seconds": valid[0].elapsed_seconds,
        "analysis_start_distance_meters": start_distance,
        "usable_duration_seconds": round(usable_seconds, 1),
        "confidence": confidence,
        "interpretation": (
            "Estimated heart-rate change over time after accounting for recorded speed and grade; "
            "weather, hydration, fatigue, wind, and sensor error are not controlled."
        ),
    }


class AnalyticsService:
    def __init__(
        self,
        activities: ActivityRepository,
        plans: TrainingPlanRepository,
        sessions: PlannedSessionRepository,
        samples: ActivitySampleRepository,
    ) -> None:
        self.activities, self.plans, self.sessions = activities, plans, sessions
        self.samples = samples

    async def workload_trend(self, today: date) -> WorkloadTrend:
        start = today - timedelta(days=179)
        activities = await self.activities.list_range(
            start.isoformat(), (today + timedelta(days=1)).isoformat()
        )
        # Bound sample reads and discard each batch after deriving its comparisons.
        candidates = [a for a in activities if a.get("sport") == "run"]
        comparisons = []
        exclusions: dict[str, int] = defaultdict(int)
        qualifying = 0
        for offset in range(0, len(candidates), 25):
            batch = candidates[offset : offset + 25]
            identifiers = [a["id"] for a in batch if a.get("category") in STEADY_CATEGORIES]
            chunks = await self.samples.list_for_activities(identifiers) if identifiers else []
            samples_by_activity: dict[str, list[ActivitySample]] = defaultdict(list)
            for chunk in chunks:
                samples_by_activity[str(chunk["activity_id"])].extend(
                    ActivitySample.model_validate(sample) for sample in chunk.get("samples", [])
                )
            result = build_workload_trend(batch, samples_by_activity, start, today)
            qualifying += result.qualifying_runs
            for reason, count in result.exclusion_counts.items():
                exclusions[reason] += count
            comparisons.extend(result.comparisons)
        return merge_workload_comparisons(
            comparisons, start, today, len(candidates), qualifying, dict(exclusions)
        )

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
        weekly: dict[date, float] = defaultdict(float)
        for run in runs:
            run_date = date.fromisoformat(run["local_date"])
            monday = run_date - timedelta(days=run_date.weekday())
            weekly[monday] += (run.get("distance_meters") or 0) / METERS_PER_MILE
        rolling = {
            days: round(
                sum(
                    (run.get("distance_meters") or 0) / METERS_PER_MILE
                    for run in runs
                    if date.fromisoformat(run["local_date"]) >= today - timedelta(days=days - 1)
                ),
                2,
            )
            for days in (7, 28, 90)
        }
        active = await self.plans.get_active()
        plan_progress = None
        if active:
            plan_sessions = await self.sessions.list_for_plan(active["id"])
            week_targets = active.get("week_summaries") or []
            planned = (
                sum(week.get("planned_running_miles") or 0 for week in week_targets)
                if week_targets
                else sum(
                    (session.get("planned_distance_meters") or 0) / METERS_PER_MILE
                    for session in plan_sessions
                    if session.get("sport") == "run"
                )
            )
            completed = sum(
                (run.get("distance_meters") or 0) / METERS_PER_MILE
                for run in runs
                if run.get("planned_session_id")
                and active["start_date"] <= run["local_date"] <= active["end_date"]
            )
            completed_sessions = sum(
                1
                for session in plan_sessions
                if str(session.get("status", "")).startswith("completed")
            )
            current_monday = today - timedelta(days=today.weekday())
            current_sunday = current_monday + timedelta(days=6)
            plan_start = date.fromisoformat(active["start_date"])
            current_week_number = (current_monday - plan_start).days // 7 + 1
            current_target = next(
                (
                    week.get("planned_running_miles")
                    for week in week_targets
                    if week.get("week_number") == current_week_number
                ),
                None,
            )
            current_planned = (
                current_target
                if current_target is not None
                else sum(
                    (session.get("planned_distance_meters") or 0) / METERS_PER_MILE
                    for session in plan_sessions
                    if session.get("sport") == "run"
                    and current_monday.isoformat()
                    <= session["scheduled_date"]
                    <= current_sunday.isoformat()
                )
            )
            current_completed = sum(
                (run.get("distance_meters") or 0) / METERS_PER_MILE
                for run in runs
                if current_monday.isoformat() <= run["local_date"] <= current_sunday.isoformat()
            )
            plan_progress = PlanProgress(
                plan_name=active["name"],
                planned_miles=round(planned, 2),
                completed_miles=round(completed, 2),
                completed_sessions=completed_sessions,
                total_sessions=len(plan_sessions),
                skipped_sessions=sum(1 for s in plan_sessions if s.get("status") == "skipped"),
                rescheduled_sessions=sum(
                    1 for s in plan_sessions if s.get("status") == "rescheduled"
                ),
                current_week_planned_miles=round(current_planned, 2),
                current_week_completed_miles=round(current_completed, 2),
            )
        return AnalyticsSummary(
            as_of_date=today,
            rolling_7_day_miles=rolling[7],
            rolling_28_day_miles=rolling[28],
            rolling_90_day_miles=rolling[90],
            weekly_mileage=[
                MileagePoint(week_start=week, miles=round(miles, 2))
                for week, miles in sorted(weekly.items())[-16:]
            ],
            plan_progress=plan_progress,
            personal_bests=self._personal_bests(runs, weekly),
            temperature_bands=self._temperature_bands(runs),
            heart_rate_response_history=[
                HeartRateResponseResult(
                    activity_id=run["id"],
                    activity_title=run.get("title"),
                    local_date=run["local_date"],
                    category=run.get("category"),
                    **run["derived_metrics"]["heart_rate_response"],
                )
                for run in runs
                if (run.get("derived_metrics") or {}).get("heart_rate_response", {}).get("eligible")
            ],
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

    def _personal_bests(self, runs: list[dict], weekly: dict[date, float]) -> list[PersonalBest]:
        results: list[PersonalBest] = []
        if runs:
            longest = max(runs, key=lambda run: run.get("distance_meters") or 0)
            results.append(
                PersonalBest(
                    label="Longest run",
                    value=f"{(longest.get('distance_meters') or 0) / METERS_PER_MILE:.2f} mi",
                    activity_id=longest["id"],
                    local_date=longest["local_date"],
                )
            )
        for label, low, high in (("Fastest 5K", 4900, 5200), ("Fastest 10K", 9800, 10400)):
            candidates = [run for run in runs if low <= (run.get("distance_meters") or 0) <= high]
            if candidates:
                best = min(
                    candidates,
                    key=lambda run: run.get("moving_time_seconds") or run["elapsed_time_seconds"],
                )
                seconds = best.get("moving_time_seconds") or best["elapsed_time_seconds"]
                results.append(
                    PersonalBest(
                        label=label,
                        value=f"{int(seconds // 60)}:{int(seconds % 60):02d}",
                        activity_id=best["id"],
                        local_date=best["local_date"],
                    )
                )
        laps = [
            (lap, run)
            for run in runs
            for lap in run.get("laps", [])
            if 1529 <= (lap.get("distance_meters") or 0) <= 1689
        ]
        if laps:
            lap, run = min(laps, key=lambda pair: pair[0]["elapsed_time_seconds"])
            seconds = lap["elapsed_time_seconds"]
            results.append(
                PersonalBest(
                    label="Fastest mile lap",
                    value=f"{int(seconds // 60)}:{int(seconds % 60):02d}",
                    activity_id=run["id"],
                    local_date=run["local_date"],
                )
            )
        if weekly:
            week, miles = max(weekly.items(), key=lambda item: item[1])
            results.append(
                PersonalBest(
                    label="Highest weekly mileage", value=f"{miles:.2f} mi", local_date=week
                )
            )
        return results

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

    def _temperature_bands(self, runs: list[dict]) -> list[TemperatureBand]:
        bands = [("Under 60°F", -999, 15.56), ("60–75°F", 15.56, 23.89), ("Over 75°F", 23.89, 999)]
        return [
            TemperatureBand(
                label=label,
                activity_count=len(items),
                average_pace_seconds_per_mile=round(
                    mean(
                        METERS_PER_MILE / item["summary"]["average_speed_mps"]
                        for item in items
                        if item.get("summary", {}).get("average_speed_mps")
                    ),
                    1,
                )
                if any(item.get("summary", {}).get("average_speed_mps") for item in items)
                else None,
            )
            for label, low, high in bands
            if (
                items := [
                    run
                    for run in runs
                    if (temp := run.get("summary", {}).get("temperature_celsius")) is not None
                    and low <= temp < high
                ]
            )
        ]
