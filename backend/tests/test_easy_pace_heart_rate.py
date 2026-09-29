import math
from datetime import date

import pytest

from app.services.analytics import AnalyticsService
from app.services.easy_pace_heart_rate import (
    RunFit,
    fit_run,
    points_from_documents,
    reference_pace,
)
from app.services.grade_adjustment import grade_factor

METERS_PER_MILE = 1609.344
TODAY = date(2026, 9, 29)


def easy_run(
    centre_pace: float,
    heart_rate_offset: float = 0.0,
    *,
    duration: int = 3000,
    hilly: bool = False,
    stop: tuple[int, int] | None = None,
) -> list[dict]:
    """HR = 150 - 0.1 bpm per s/mi slower than 10:00/mi (grade-adjusted) + offset."""
    samples: list[dict] = []
    distance = 0.0
    for seconds in range(0, duration + 1, 5):
        pace = centre_pace + 40 * math.sin(2 * math.pi * seconds / 900)
        flat_speed = METERS_PER_MILE / pace
        grade = 0.05 * math.sin(2 * math.pi * distance / 1000) if hilly else 0.0
        speed = flat_speed / grade_factor(grade)
        stopped = stop is not None and stop[0] <= seconds < stop[1]
        elevation = -0.05 * 1000 / (2 * math.pi) * math.cos(2 * math.pi * distance / 1000)
        samples.append(
            {
                "elapsed_seconds": seconds,
                "distance_meters": distance,
                "elevation_meters": elevation if hilly else 5.0,
                "heart_rate": 110
                if stopped
                else round(150 - 0.1 * (pace - 600) + heart_rate_offset),
                "speed_mps": 0.0 if stopped else speed,
            }
        )
        if not stopped:
            distance += speed * 5
    return samples


def test_fit_recovers_heart_rate_at_pace_on_flat_and_hilly_runs() -> None:
    flat = fit_run(points_from_documents(easy_run(610)))
    hilly = fit_run(points_from_documents(easy_run(610, hilly=True)))

    assert isinstance(flat, RunFit) and isinstance(hilly, RunFit)
    assert flat.heart_rate_at(615) == pytest.approx(148.5, abs=1.0)
    assert hilly.heart_rate_at(615) == pytest.approx(flat.heart_rate_at(615), abs=1.0)
    assert flat.slope == pytest.approx(-0.1, abs=0.03)
    assert flat.median_pace == pytest.approx(610, abs=3)
    # 50 minutes minus the first 10 minutes of settling.
    assert flat.steady_seconds == pytest.approx(2400, abs=15)


def test_stops_and_their_recovery_period_are_excluded() -> None:
    with_stop = fit_run(points_from_documents(easy_run(610, stop=(1500, 1560))))
    without = fit_run(points_from_documents(easy_run(610)))

    assert isinstance(with_stop, RunFit) and isinstance(without, RunFit)
    # 60 s stopped plus 90 s after resuming are excluded.
    assert without.steady_seconds - with_stop.steady_seconds == pytest.approx(150, abs=10)
    assert with_stop.heart_rate_at(615) == pytest.approx(without.heart_rate_at(615), abs=0.5)


def test_short_runs_are_excluded_and_reference_pace_rounds_to_15_seconds() -> None:
    assert isinstance(fit_run(points_from_documents(easy_run(610, duration=1400))), str)
    fits = [
        fit
        for fit in (fit_run(points_from_documents(easy_run(pace))) for pace in (600, 610, 620))
        if isinstance(fit, RunFit)
    ]
    assert reference_pace(fits) == 615
    assert reference_pace([]) is None


class ActivitiesFake:
    def __init__(self, runs: list[dict]) -> None:
        self.runs = runs

    async def list_range(self, start: str, end: str) -> list[dict]:
        return [run for run in self.runs if start <= run["local_date"] < end]


class SamplesFake:
    def __init__(self, series: dict[str, list[dict]]) -> None:
        self.series = series

    async def list_sample_fields(self, ids: list[str], fields: tuple[str, ...]) -> dict:
        assert "elevation_meters" in fields
        return {key: value for key, value in self.series.items() if key in ids}


def run(identifier: str, day: str, category: str = "easy", celsius: float | None = 20) -> dict:
    return {
        "id": identifier,
        "sport": "run",
        "title": identifier,
        "category": category,
        "local_date": day,
        "summary": {"temperature_celsius": celsius},
    }


@pytest.mark.asyncio
async def test_monthly_heart_rate_at_reference_pace_with_exclusions() -> None:
    runs = [
        run("july", "2026-07-10"),
        run("august", "2026-08-10", "long"),
        run("september", "2026-09-10", "recovery", celsius=None),
        run("slow", "2026-09-12", "long"),
        run("short", "2026-09-14"),
        run("track", "2026-09-15", "track"),
        run("too-old", "2025-09-01"),
    ]
    series = {
        "july": easy_run(600),
        "august": easy_run(610, -2),
        "september": easy_run(620, -4, hilly=True),
        "slow": easy_run(900),
        "short": easy_run(610, duration=1200),
        "track": easy_run(420),
        "too-old": easy_run(610),
    }
    service = AnalyticsService(
        ActivitiesFake(runs),  # type: ignore[arg-type]
        None,  # type: ignore[arg-type]
        None,  # type: ignore[arg-type]
        SamplesFake(series),  # type: ignore[arg-type]
    )

    result = await service.easy_pace_heart_rate(TODAY)

    assert result.reference_pace_seconds_per_mile == 615
    assert result.window_start == date(2025, 10, 1)
    assert len(result.months) == 12 and result.months[-1].month == date(2026, 9, 1)
    by_id = {item.activity_id: item for item in result.runs}
    assert set(by_id) == {"july", "august", "september"}
    assert by_id["july"].heart_rate_at_reference_bpm == pytest.approx(148.5, abs=1)
    assert by_id["september"].heart_rate_at_reference_bpm == pytest.approx(144.5, abs=1)
    assert by_id["july"].temperature_fahrenheit == 68.0
    assert by_id["september"].temperature_celsius is None
    reasons = {item.activity_id: item.reason for item in result.excluded}
    assert set(reasons) == {"slow", "short"}
    assert "outside" in reasons["slow"] and "15 minutes" in reasons["short"]
    september = result.months[-1]
    assert september.run_count == 1
    assert september.median_heart_rate_bpm == pytest.approx(144.5, abs=1)
    assert result.months[0].run_count == 0 and result.months[0].median_heart_rate_bpm is None
