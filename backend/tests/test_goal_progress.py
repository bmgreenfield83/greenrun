from datetime import date

import pytest

from app.services.analytics import AnalyticsService
from app.services.goal_progress import counts_as_rep, distance_label, goal_weeks, is_rep_distance

TODAY = date(2026, 9, 29)
MILE = 1609.344
PLAN = {
    "id": "plan-1",
    "name": "Mile block",
    "start_date": "2026-09-07",
    "end_date": "2026-11-29",
    "goal_target": {"distance_meters": MILE, "target_time_seconds": 360},
}


def run(identifier: str, day: str, distance: float, **changes: object) -> dict:
    return {
        "id": identifier,
        "sport": "run",
        "title": identifier,
        "category": "easy",
        "local_date": day,
        "distance_meters": distance,
        "laps": [],
    } | changes


def lap(index: int, distance: float, seconds: float) -> dict:
    return {"index": index, "distance_meters": distance, "elapsed_time_seconds": seconds}


RUNS = [
    run("too-early", "2026-05-01", 5000),
    run("lead-in", "2026-06-20", 3000),
    run("steady", "2026-09-16", 3000),
    run("race", "2026-09-20", MILE, category="race", laps=[lap(1, MILE + 1, 395)]),
    run(
        "track",
        "2026-09-22",
        4000,
        category="track",
        laps=[
            lap(1, MILE, 1050),  # warm-up, 10:52 /mi
            lap(2, 400, 88),  # 5:54 /mi, faster than goal
            lap(3, 400, 180),  # recovery jog
            lap(4, 400, 92),  # 6:10 /mi rep
            lap(5, 100, 15),  # too short to be a rep
            lap(6, 1600, 400),  # 6:42 /mi rep, within 15% of the fastest
        ],
    ),
]
SERIES = {
    "lead-in": [
        {"elapsed_seconds": seconds, "distance_meters": seconds * 3.5}
        for seconds in range(0, 860, 5)
    ],
    "steady": [
        {"elapsed_seconds": seconds, "distance_meters": seconds * 4.0}
        for seconds in range(0, 755, 5)
    ],
}


class ActivitiesFake:
    async def list_range(self, start: str, end: str) -> list[dict]:
        return [item for item in RUNS if start <= item["local_date"] < end]


class PlansFake:
    def __init__(self, active: dict | None) -> None:
        self.active = active

    async def get_active(self) -> dict | None:
        return self.active


class SamplesFake:
    async def list_distance_series(self, ids: list[str]) -> dict[str, list[dict]]:
        return {key: value for key, value in SERIES.items() if key in ids}


def service(active: dict | None) -> AnalyticsService:
    return AnalyticsService(
        ActivitiesFake(),  # type: ignore[arg-type]
        PlansFake(active),  # type: ignore[arg-type]
        None,  # type: ignore[arg-type]
        SamplesFake(),  # type: ignore[arg-type]
    )


@pytest.mark.asyncio
async def test_goal_card_absent_without_active_plan_or_structured_goal() -> None:
    assert (await service(None).goal_progress(TODAY)).status == "no_active_plan"
    without_goal = await service(PLAN | {"goal_target": None}).goal_progress(TODAY)
    assert without_goal.status == "no_goal"
    assert without_goal.plan is not None and without_goal.goal is None
    assert without_goal.weeks == [] and without_goal.track_sessions == []


@pytest.mark.asyncio
async def test_goal_card_efforts_gap_and_track_reps() -> None:
    result = await service(PLAN).goal_progress(TODAY)

    assert result.status == "ok"
    goal = result.goal
    assert goal is not None
    assert goal.distance_label == "1 mile"
    assert goal.pace_seconds_per_mile == 360
    assert goal.pace_seconds_per_400m == pytest.approx(89.5, abs=0.05)
    assert result.window_start == date(2026, 6, 15)
    assert result.window_end == TODAY
    assert len(result.weeks) == 24
    assert result.weeks[0].is_before_plan and not result.weeks[12].is_before_plan
    assert result.weeks[-1].is_future and not result.weeks[15].is_future

    by_week = {week.week_start: week.best_effort for week in result.weeks}
    lead_in = by_week[date(2026, 6, 15)]
    assert lead_in is not None and lead_in.elapsed_seconds == pytest.approx(MILE / 3.5, abs=0.1)
    assert by_week[date(2026, 9, 14)].source == "lap"  # the race lap beats the samples window
    assert by_week[date(2026, 9, 14)].elapsed_seconds == 395
    assert by_week[date(2026, 9, 7)] is None
    assert result.current_best is not None and result.current_best.activity_id == "race"
    assert result.gap_seconds == 35
    assert result.gap_pace_seconds_per_mile == pytest.approx(35, abs=0.1)

    [session] = result.track_sessions
    assert [item.lap_index for item in session.laps] == [1, 2, 3, 4, 6]
    assert [item.counts_as_rep for item in session.laps] == [False, True, False, True, True]
    assert session.rep_count == 3
    assert session.reps_at_or_under_goal_pace == 1
    fastest = session.laps[1]
    assert fastest.at_or_under_goal_pace and fastest.pace_delta_seconds_per_mile < 0
    assert fastest.pace_seconds_per_400m == 88


@pytest.mark.asyncio
async def test_goal_card_is_generic_for_other_distances() -> None:
    plan = PLAN | {"goal_target": {"distance_meters": 3000, "target_time_seconds": 700}}
    result = await service(plan).goal_progress(TODAY)

    assert result.goal is not None and result.goal.distance_label == "3 km"
    assert result.current_best is not None
    assert result.current_best.activity_id == "steady"
    assert result.current_best.elapsed_seconds == 750
    assert result.gap_seconds == 50


def test_goal_helpers() -> None:
    assert distance_label(5000) == "5K"
    assert distance_label(2 * MILE) == "2 miles"
    assert distance_label(800) == "800 m"
    assert is_rep_distance(196) and is_rep_distance(1609) and not is_rep_distance(150)
    assert counts_as_rep(355, 300, 360)  # at goal pace even when far from the fastest lap
    assert not counts_as_rep(600, 590, 360)  # slow session: nothing near goal pace
    weeks = goal_weeks(date(2026, 9, 9), date(2026, 9, 20))
    assert weeks[0] == date(2026, 6, 15)  # Monday 12 weeks before the start week
    assert weeks[-1] == date(2026, 9, 14)


@pytest.mark.asyncio
async def test_track_reps_use_watch_lap_labels_when_recorded() -> None:
    labeled = run(
        "labeled",
        "2026-09-23",
        3000,
        category="track",
        laps=[
            lap(1, 400, 150) | {"intensity": "warmup"},
            lap(2, 400, 95) | {"intensity": "active"},
            lap(3, 400, 88) | {"intensity": "recovery"},  # fast, but the watch says recovery
            lap(4, 400, 118) | {"intensity": "interval"},  # slow, but still a labeled rep
        ],
    )
    RUNS.append(labeled)
    try:
        result = await service(PLAN).goal_progress(TODAY)
    finally:
        RUNS.remove(labeled)

    session = next(item for item in result.track_sessions if item.activity_id == "labeled")
    assert session.rep_source == "workout"
    assert [item.counts_as_rep for item in session.laps] == [False, True, False, True]
    assert session.rep_count == 2
    assert session.reps_at_or_under_goal_pace == 0
    heuristic = next(item for item in result.track_sessions if item.activity_id == "track")
    assert heuristic.rep_source == "pace"
