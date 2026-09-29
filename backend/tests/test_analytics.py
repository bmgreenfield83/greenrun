from datetime import date
from types import SimpleNamespace

import pytest

from app.services.analytics import AnalyticsService, calculate_heart_rate_response
from app.services.fit.models import ActivitySample


def activity(**changes: object) -> SimpleNamespace:
    values = {
        "sport": "run",
        "category": "easy",
        "title": "Steady run",
        "elapsed_time_seconds": 3600,
    }
    values.update(changes)
    return SimpleNamespace(**values)


def steady_samples(duration: int = 3600) -> list[ActivitySample]:
    return [
        ActivitySample(
            elapsed_seconds=seconds,
            heart_rate=140 if seconds < 2100 else 150,
            speed_mps=3.0,
        )
        for seconds in range(300, duration + 1, 5)
    ]


def variable_workload_samples(duration: int = 3600) -> list[ActivitySample]:
    samples: list[ActivitySample] = []
    delayed_workload = 3.0
    distance = 0.0
    for seconds in range(0, duration + 1, 5):
        speed = 2.7 if (seconds // 180) % 2 == 0 else 3.3
        delayed_workload += 5 / 50 * (speed - delayed_workload)
        distance += speed * 5
        samples.append(
            ActivitySample(
                elapsed_seconds=seconds,
                distance_meters=distance,
                heart_rate=round(105 + 12 * delayed_workload + 6 * seconds / 3600),
                speed_mps=speed,
                elevation_meters=20,
            )
        )
    return samples


def test_hr_response_is_transparent_and_eligible_for_steady_run() -> None:
    result = calculate_heart_rate_response(activity(), steady_samples())

    assert result["eligible"] is True
    assert result["adjusted_change_bpm_per_hour"] > 0
    assert result["adjusted_total_change_bpm"] > 0
    assert result["rmse_bpm"] >= 0
    assert 0 <= result["r_squared"] <= 1
    assert result["analysis_start_seconds"] == 300
    assert result["analysis_end_seconds"] == 3600
    assert result["analysis_ranges"] == [{"start_seconds": 300, "end_seconds": 3600}]
    assert result["algorithm_version"] == 4
    lower = result["adjusted_change_lower_90_bpm_per_hour"]
    upper = result["adjusted_change_upper_90_bpm_per_hour"]
    assert lower <= result["adjusted_change_bpm_per_hour"] <= upper
    assert result["confidence"] in {"moderate", "high"}


def test_hr_response_recovers_known_time_change_after_variable_workload() -> None:
    result = calculate_heart_rate_response(activity(), variable_workload_samples())

    assert result["eligible"] is True
    assert result["adjusted_change_bpm_per_hour"] == pytest.approx(6, abs=1.5)
    assert result["response_time_constant_seconds"] in {30, 45, 60}
    assert result["r_squared"] > 0.9


def test_hr_response_honors_distance_based_analysis_start() -> None:
    start_distance = 3000
    result = calculate_heart_rate_response(
        activity(heart_rate_analysis_start_distance_meters=start_distance),
        variable_workload_samples(4200),
    )

    assert result["eligible"] is True
    assert result["analysis_start_distance_meters"] == start_distance
    assert result["analysis_start_seconds"] > 300


def test_hr_response_includes_track_but_excludes_short_runs() -> None:
    track = calculate_heart_rate_response(activity(category="track"), steady_samples())
    short = calculate_heart_rate_response(activity(elapsed_time_seconds=1400), steady_samples())

    assert track["eligible"] is True
    assert short["eligible"] is False and "25 minutes" in short["exclusion_reason"]


def test_hr_response_rejects_workload_that_rises_with_time() -> None:
    samples = steady_samples()
    for sample in samples:
        # Progression run: speed rises steadily with time, so workload and drift are confounded.
        sample.speed_mps = 2.5 + sample.elapsed_seconds / 3600

    result = calculate_heart_rate_response(activity(), samples)

    assert result["eligible"] is False
    assert result["exclusion_reason"]


def test_25_minute_run_has_low_confidence_when_20_minutes_are_usable() -> None:
    result = calculate_heart_rate_response(
        activity(elapsed_time_seconds=1500), steady_samples(1500)
    )

    assert result["eligible"] is True
    assert result["confidence"] == "low"


class ActivitiesFake:
    async def list_range(self, _start: str, _end: str) -> list[dict]:
        return [
            {
                "id": "run-1",
                "sport": "run",
                "category": "easy",
                "title": "Five K",
                "local_date": "2026-08-04",
                "distance_meters": 5000,
                "elapsed_time_seconds": 1800,
                "moving_time_seconds": 1750,
                "summary": {
                    "average_speed_mps": 2.86,
                    "average_heart_rate": 145,
                    "temperature_celsius": 20,
                },
                "laps": [],
                "derived_metrics": {},
                "planned_session_id": None,
            }
        ]


class PlansFake:
    async def get_active(self) -> None:
        return None


class UnusedFake:
    pass


class ComparableActivitiesFake(ActivitiesFake):
    async def get(self, activity_id: str) -> dict | None:
        return (await self.list_range("", ""))[0] if activity_id == "run-1" else None

    async def list_range(self, _start: str, _end: str) -> list[dict]:
        anchor = (await super().list_range(_start, _end))[0]
        return [
            anchor,
            anchor
            | {
                "id": "run-2",
                "title": "Comparable five K",
                "local_date": "2026-07-28",
                "distance_meters": 5100,
            },
        ]


@pytest.mark.asyncio
async def test_comparable_runs_use_requested_activity_and_exclude_the_anchor() -> None:
    service = AnalyticsService(
        ComparableActivitiesFake(),
        PlansFake(),
        UnusedFake(),
        UnusedFake(),  # type: ignore[arg-type]
    )

    results = await service.comparable_runs("run-1")

    assert results is not None
    assert [result.activity_id for result in results] == ["run-2"]


class WeekdayActivitiesFake(ComparableActivitiesFake):
    async def get(self, activity_id: str) -> dict | None:
        anchor = (await ActivitiesFake().list_range("", ""))[0]
        return anchor if activity_id == "run-1" else None

    async def list_range(self, _start: str, _end: str) -> list[dict]:
        anchor = (await ActivitiesFake().list_range("", ""))[0]
        runs = [
            anchor
            | {
                "id": f"tuesday-{week}",
                "local_date": date(2026, 7, 28)
                .fromordinal(date(2026, 7, 28).toordinal() - week * 7)
                .isoformat(),
                "category": "track" if week == 1 else "easy",
                "distance_meters": 5000 + week * 100,
            }
            for week in range(14)
        ]
        return [
            *runs,
            anchor | {"id": "monday", "local_date": "2026-07-27"},
            anchor,
        ]


@pytest.mark.asyncio
async def test_same_weekday_runs_include_current_and_twelve_prior_runs() -> None:
    service = AnalyticsService(
        WeekdayActivitiesFake(),
        PlansFake(),
        UnusedFake(),
        UnusedFake(),  # type: ignore[arg-type]
    )

    results = await service.same_weekday_runs("run-1")

    assert results is not None
    assert len(results) == 13
    assert results[-1].activity_id == "run-1"
    assert results[-1].is_current is True
    assert any(result.category == "track" for result in results)
    assert all(result.local_date.weekday() == date(2026, 8, 4).weekday() for result in results)


class HistoryActivitiesFake:
    async def list_range(self, _start: str, _end: str) -> list[dict]:
        run = (await ActivitiesFake().list_range("", ""))[0]
        return [
            run
            | {
                "derived_metrics": {
                    "heart_rate_response": calculate_heart_rate_response(
                        activity(), variable_workload_samples()
                    )
                }
            },
            run | {"id": "run-2", "derived_metrics": {}},
        ]


class EmptySamplesFake:
    async def list_distance_series(self, _ids: list[str]) -> dict:
        return {}


@pytest.mark.asyncio
async def test_summary_history_includes_date_temperature_interval_and_version() -> None:
    service = AnalyticsService(
        HistoryActivitiesFake(),  # type: ignore[arg-type]
        PlansFake(),  # type: ignore[arg-type]
        UnusedFake(),  # type: ignore[arg-type]
        EmptySamplesFake(),  # type: ignore[arg-type]
    )

    result = await service.summary(date(2026, 9, 29))

    assert result.heart_rate_response_algorithm_version == 4
    [item] = result.heart_rate_response_history
    assert item.local_date == date(2026, 8, 4)
    assert item.temperature_celsius == 20 and item.temperature_fahrenheit == 68.0
    assert item.adjusted_change_lower_90_bpm_per_hour is not None
    assert item.analysis_ranges and item.analysis_ranges[0].start_seconds == 300
