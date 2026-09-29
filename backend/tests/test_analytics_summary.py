from datetime import date, timedelta
from typing import Any

import pytest

from app.services.analytics import AnalyticsService
from app.services.training_volume import (
    PlanWeek,
    plan_progress,
    plan_weeks,
    weekly_volume,
)

MILE = 1609.344
TODAY = date(2026, 9, 30)  # Wednesday


def run(monday: date, miles: float, **changes: Any) -> dict[str, Any]:
    day = monday + timedelta(days=1)
    return {
        "id": f"run-{monday.isoformat()}",
        "sport": "run",
        "category": "easy",
        "title": f"Run {day.isoformat()}",
        "local_date": day.isoformat(),
        "distance_meters": miles * MILE,
        "elapsed_time_seconds": miles * 600,
        "summary": {},
        "laps": [],
        "derived_metrics": {},
    } | changes


def history() -> list[dict[str, Any]]:
    runs = []
    monday = date(2026, 5, 4)
    while monday <= date(2026, 9, 28):
        miles = 13 if monday == date(2026, 9, 14) else 10
        runs.append(run(monday, miles))
        monday += timedelta(weeks=1)
    runs.append(
        {
            "id": "bike-1",
            "sport": "bike",
            "local_date": "2026-09-16",
            "distance_meters": 50_000,
            "elapsed_time_seconds": 7200,
        }
    )
    race = next(item for item in runs if item["id"] == "run-2026-09-07")
    # Ties (to the second) with the sampled 4 m/s mile of run-2026-09-21; the race wins the tie.
    race["laps"] = [
        {"index": 1, "distance_meters": 1609.4, "elapsed_time_seconds": 402.0},
        {"index": 2, "distance_meters": 1500.0, "elapsed_time_seconds": 300.0},
    ]
    race["category"] = "race"
    return runs


# Plan starts on a Wednesday: week 1 is the week of Monday 2026-09-14.
PLAN = {
    "id": "plan-1",
    "name": "Mile block",
    "status": "active",
    "start_date": "2026-09-16",
    "end_date": "2026-10-11",
    "week_summaries": [
        {"week_number": 1, "planned_running_miles": 20},
        {"week_number": 2, "planned_running_miles": 22},
        {"week_number": 3, "planned_running_miles": None},
        {"week_number": 4, "planned_running_miles": 25},
    ],
}


def session(day: str, miles: float | None, status: str = "planned", **changes: Any) -> dict:
    return {
        "id": f"session-{day}",
        "scheduled_date": day,
        "sport": "run",
        "planned_distance_meters": miles * MILE if miles is not None else None,
        "status": status,
        "completed_activity_id": None,
    } | changes


SESSIONS = [
    session("2026-09-16", 4, "completed_late", completed_activity_id="run-2026-09-14"),
    session("2026-09-19", 6, "skipped"),
    session("2026-09-20", 6, "rescheduled"),
    session("2026-09-22", 8, "completed", completed_activity_id="run-2026-09-21"),
    session("2026-09-29", 5, "completed", completed_activity_id="run-2026-09-28"),
    session("2026-10-01", 5),
    session("2026-10-03", None, sport="strength"),
    session("2026-10-06", 6),
]


class ActivitiesFake:
    async def list_range(self, _start: str, _end: str) -> list[dict]:
        return history()


class PlansFake:
    def __init__(self, active: dict | None) -> None:
        self.active = active

    async def get_active(self) -> dict | None:
        return self.active


class SessionsFake:
    async def list_for_plan(self, plan_id: str) -> list[dict]:
        assert plan_id == "plan-1"
        return SESSIONS


class SamplesFake:
    def __init__(self) -> None:
        self.calls: list[list[str]] = []

    async def list_distance_series(self, activity_ids: list[str]) -> dict[str, list[dict]]:
        self.calls.append(activity_ids)
        # 10 miles at a steady 4 m/s for the run in the week of 2026-09-21.
        return {
            "run-2026-09-21": [
                {"elapsed_seconds": seconds, "distance_meters": seconds * 4.0}
                for seconds in range(0, 4025, 5)
            ]
        }


def service(active: dict | None = PLAN, samples: SamplesFake | None = None) -> AnalyticsService:
    return AnalyticsService(
        ActivitiesFake(),  # type: ignore[arg-type]
        PlansFake(active),  # type: ignore[arg-type]
        SessionsFake(),  # type: ignore[arg-type]
        samples or SamplesFake(),  # type: ignore[arg-type]
    )


@pytest.mark.asyncio
async def test_weekly_volume_has_16_zero_filled_weeks_with_plan_and_flags() -> None:
    result = await service().summary(TODAY)

    weeks = result.weekly_volume
    assert len(weeks) == 16
    assert weeks[0].week_start == date(2026, 6, 15)
    assert weeks[-1].week_start == date(2026, 9, 28)
    assert weeks[-1].is_partial and not any(week.is_partial for week in weeks[:-1])
    assert result.weekly_volume_increase_threshold_percent == 15
    by_start = {week.week_start: week for week in weeks}
    flagged = by_start[date(2026, 9, 14)]
    assert flagged.miles == 13
    assert flagged.prior_4_week_average_miles == 10
    assert flagged.exceeds_prior_average is True
    assert flagged.trailing_4_week_average_miles == 10.75
    assert by_start[date(2026, 9, 21)].exceeds_prior_average is False
    assert weeks[-1].trailing_4_week_average_miles is None
    assert weeks[-1].exceeds_prior_average is False
    assert [by_start[date(2026, 9, day)].planned_miles for day in (7, 14, 21, 28)] == [
        None,
        20,
        22,
        10,
    ]
    assert all(week.run_count == 1 for week in weeks)


@pytest.mark.asyncio
async def test_plan_progress_uses_one_to_date_definition_and_monday_week_numbers() -> None:
    progress = (await service().summary(TODAY)).plan_progress

    assert progress is not None
    assert progress.current_week_number == 3
    assert progress.total_weeks == 4
    assert progress.total_planned_miles == 77
    # Weeks 1-2 in full plus half of week 3 (5 of 10 planned session miles are due).
    assert progress.planned_miles_to_date == 47
    assert progress.completed_miles_to_date == 33
    assert progress.total_sessions == 7
    assert progress.sessions_due_to_date == 4
    assert progress.sessions_completed_to_date == 3
    assert progress.sessions_skipped_to_date == 1
    assert progress.current_week_planned_miles == 10
    assert progress.current_week_planned_miles_to_date == 5
    assert progress.current_week_completed_miles == 10
    assert "rescheduled_sessions" not in progress.model_dump()


@pytest.mark.asyncio
async def test_best_efforts_use_samples_and_exact_laps_preferring_races_on_ties() -> None:
    samples = SamplesFake()
    result = await service(samples=samples).summary(TODAY)

    assert len(samples.calls) == 1
    efforts = {effort.distance_label: effort for effort in result.best_efforts}
    assert set(efforts) == {"1 mile", "5K", "10K"}
    mile = efforts["1 mile"]
    assert (mile.source, mile.activity_id, mile.lap_index) == ("lap", "run-2026-09-07", 1)
    assert mile.category == "race"
    assert efforts["5K"].source == "samples"
    assert efforts["5K"].elapsed_seconds == pytest.approx(1250)
    assert efforts["5K"].activity_id == "run-2026-09-21"
    assert efforts["10K"].elapsed_seconds == pytest.approx(2500)
    assert efforts["10K"].pace_seconds_per_mile == pytest.approx(402.3, abs=0.1)
    assert result.longest_run is not None
    assert result.longest_run.activity_id == "run-2026-09-14"
    assert result.longest_run.distance_miles == 13
    assert result.highest_week is not None
    assert (result.highest_week.week_start, result.highest_week.miles) == (date(2026, 9, 14), 13)


@pytest.mark.asyncio
async def test_summary_without_plan_or_removed_fields() -> None:
    result = (await service(active=None).summary(TODAY)).model_dump()

    assert result["plan_progress"] is None
    assert all(week["planned_miles"] is None for week in result["weekly_volume"])
    for removed in (
        "temperature_bands",
        "personal_bests",
        "rolling_7_day_miles",
        "rolling_28_day_miles",
        "rolling_90_day_miles",
        "weekly_mileage",
    ):
        assert removed not in result


def test_weekly_averages_need_four_weeks_of_history() -> None:
    runs = [run(date(2026, 9, 14), 5), run(date(2026, 9, 21), 20)]

    weeks = weekly_volume(runs, TODAY, {})

    assert weeks[0].miles == 0 and weeks[0].prior_4_week_average_miles is None
    new_week = weeks[-2]
    assert new_week.miles == 20
    assert new_week.prior_4_week_average_miles is None
    assert new_week.exceeds_prior_average is False


def test_current_week_without_distances_is_apportioned_by_sessions_then_days() -> None:
    week = PlanWeek(number=1, start=date(2026, 9, 28), declared_miles=12)
    week.sessions = [session("2026-09-29", None), session("2026-10-02", None)]
    assert week.due_fraction(TODAY) == 0.5
    empty = PlanWeek(number=1, start=date(2026, 9, 28), declared_miles=14)
    assert empty.due_fraction(TODAY) == pytest.approx(3 / 7)
    assert empty.due_fraction(date(2026, 9, 27)) == 0
    assert empty.due_fraction(date(2026, 10, 4)) == 1


def test_completed_early_session_counts_as_due() -> None:
    plan = PLAN | {"start_date": "2026-09-28", "end_date": "2026-10-04", "week_summaries": []}
    sessions = [
        session("2026-10-02", 4, "completed_early", completed_activity_id="run-2026-09-28"),
        session("2026-10-04", 4),
    ]
    weeks = plan_weeks(plan, sessions)

    progress = plan_progress(plan, weeks, {"run-2026-09-28": run(date(2026, 9, 28), 4)}, TODAY)

    assert progress.sessions_due_to_date == 1
    assert progress.sessions_completed_to_date == 1
    assert progress.planned_miles_to_date == 4
    assert progress.completed_miles_to_date == 4
