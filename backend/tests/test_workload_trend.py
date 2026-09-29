from datetime import date, timedelta

import pytest

from app.services.analytics import AnalyticsService
from app.services.fit.models import ActivitySample
from app.services.workload_trend import build_workload_trend, steady_sections


def run(identifier="a", day="2026-09-01", **changes):
    return {
        "id": identifier,
        "sport": "run",
        "category": "easy",
        "local_date": day,
        "summary": {"temperature_celsius": 20},
        **changes,
    }


def samples(hr=150, speed=1609.344 / 600, interval=5, end=1800):
    return [
        ActivitySample(
            elapsed_seconds=t,
            distance_meters=t * speed,
            speed_mps=speed,
            elevation_meters=20,
            heart_rate=hr,
        )
        for t in range(0, end + 1, interval)
    ]


def trend(activities, records):
    return build_workload_trend(activities, records, date(2026, 3, 17), date(2026, 9, 12))


def test_known_hr_change_at_same_workload_is_preserved_across_weeks():
    result = trend([run(), run("b", "2026-09-08")], {"a": samples(151), "b": samples(146)})
    comparison = result.comparisons[0]
    assert comparison.pace_seconds_per_mile == 600
    assert [week.median_heart_rate_bpm for week in comparison.weeks] == [151, 146]
    assert comparison.weeks[0].week_start == date(2026, 8, 31)
    assert comparison.runs[0].matched_minutes == 10
    assert result.qualifying_runs == 2


@pytest.mark.parametrize(
    "problem", ["missing_hr", "missing_grade", "stop", "hill", "gap", "variable"]
)
def test_unreliable_or_nonsteady_sections_are_excluded(problem):
    records = samples(end=900)
    for sample in records:
        if problem == "missing_grade":
            sample.elevation_meters = None
        if problem == "hill":
            sample.elevation_meters = sample.distance_meters * 0.03
        if sample.elapsed_seconds == 700:
            if problem == "missing_hr":
                sample.heart_rate = None
            if problem == "stop":
                sample.speed_mps = 0
            if problem == "variable":
                sample.speed_mps *= 1.5
    if problem == "gap":
        records = [sample for sample in records if not 680 <= sample.elapsed_seconds <= 720]
    assert steady_sections(run(), records) == []


def test_interval_transition_during_settling_minute_is_excluded():
    records = samples(end=900)
    next(sample for sample in records if sample.elapsed_seconds == 550).speed_mps = 4
    assert steady_sections(run(), records) == []


def test_distance_override_excludes_early_sections_without_mutating_samples():
    records = samples()
    before = [sample.model_dump() for sample in records]
    sections = steady_sections(run(heart_rate_analysis_start_distance_meters=3200), records)
    assert sections and all(section["start"] >= 1500 for section in sections)
    assert before == [sample.model_dump() for sample in records]


def test_pace_temperature_category_and_elapsed_time_remain_separate():
    activities = [
        run(),
        run("fast"),
        run("hot", summary={"temperature_celsius": 30}),
        run("unknown", summary={}),
        run("long", category="long"),
        run("track", category="track"),
    ]
    records = {a["id"]: samples() for a in activities}
    records["fast"] = samples(speed=1609.344 / 540)
    result = trend(activities, records)
    assert result.qualifying_runs == 5
    assert all(len(group.runs) == 1 for group in result.comparisons)
    assert {group.start_minute for group in result.comparisons} == {10, 20}
    assert any(group.temperature_min_fahrenheit is None for group in result.comparisons)


def test_single_run_is_visible_without_claiming_a_multiweek_trend():
    result = trend([run()], {"a": samples()})
    assert len(result.comparisons[0].weeks) == 1
    assert result.comparisons[0].weeks[0].minimum_heart_rate_bpm == 150
    assert trend([run()], {}).comparisons == []


def test_sampling_resolution_and_order_do_not_change_constant_results():
    sections = steady_sections(run(), list(reversed(samples(interval=10))))
    assert len(sections) == 4
    assert all(section["heart_rate"] == 150 for section in sections)
    assert all(section["pace"] == pytest.approx(600) for section in sections)


def test_each_run_has_equal_weight_in_weekly_statistics():
    result = trend(
        [run(), run("b"), run("c")],
        {
            "a": samples(140),
            "b": samples(150, end=900),
            "c": samples(160, end=900),
        },
    )
    week = result.comparisons[0].weeks[0]
    assert week.median_heart_rate_bpm == 150
    assert (week.minimum_heart_rate_bpm, week.maximum_heart_rate_bpm) == (140, 160)
    assert week.run_count == 3


def test_irregular_sampling_uses_time_weights_not_sample_counts():
    records = samples(end=900)
    records = [s for s in records if s.elapsed_seconds >= 750 or s.elapsed_seconds % 15 == 0]
    for sample in records:
        sample.heart_rate = 30 + sample.elapsed_seconds // 5
    sections = steady_sections(run(), records)
    # HR rises linearly from 150 to 210 during minutes 10–15, despite more
    # samples in the second half. The time average is exactly 180 bpm.
    assert len(sections) == 1
    assert sections[0]["heart_rate"] == pytest.approx(180)


@pytest.mark.asyncio
async def test_service_merges_batches_and_bounds_date_range():
    class Activities:
        async def list_range(self, start, end):
            assert start == "2026-03-17"
            assert end == "2026-09-13"
            return [
                run(str(i), (date(2026, 8, 1) + timedelta(days=i)).isoformat()) for i in range(30)
            ]

    class Samples:
        calls = []

        async def list_for_activities(self, identifiers):
            self.calls.append(len(identifiers))
            return [
                {"activity_id": identifier, "samples": [s.model_dump() for s in samples()]}
                for identifier in identifiers
            ]

    repository = Samples()
    service = AnalyticsService(Activities(), None, None, repository)
    result = await service.workload_trend(date(2026, 9, 12))
    assert repository.calls == [25, 5]
    assert result.runs_screened == result.qualifying_runs == 30
    assert len(result.comparisons[0].runs) == 30
    assert sum(week.run_count for week in result.comparisons[0].weeks) == 30
