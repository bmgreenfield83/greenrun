from datetime import date, timedelta
from types import SimpleNamespace

import pytest

from app.services.analytics import AnalyticsService
from app.services.training_load import (
    RunZones,
    edwards_trimp,
    ratio_band,
    time_in_zones,
    training_load,
)

MAX_HR, RESTING_HR = 194, 55  # reserve 139: Z2 starts at 138.4, Z3 at 152.3 bpm
TODAY = date(2026, 9, 29)  # Tuesday


def samples(*blocks: tuple[int, int, float]) -> list[dict]:
    """Consecutive 5 s samples: (seconds, heart rate, speed) blocks."""
    result: list[dict] = []
    elapsed = 0
    for seconds, heart_rate, speed in blocks:
        for _ in range(seconds // 5):
            result.append(
                {"elapsed_seconds": elapsed, "heart_rate": heart_rate, "speed_mps": speed}
            )
            elapsed += 5
    return result


def test_time_in_zones_is_timestamp_weighted_and_excludes_stops_and_gaps() -> None:
    raw = samples((600, 145, 3.0), (60, 150, 0.0), (300, 160, 3.2))
    # Remove 30 s of samples inside the zone 3 block: the gap interval is excluded.
    raw = [item for item in raw if not 900 <= item["elapsed_seconds"] < 930]
    raw.append({"elapsed_seconds": 960, "heart_rate": 120, "speed_mps": 3.0})

    zones = time_in_zones(raw, MAX_HR, RESTING_HR)

    assert zones[0] == 0
    assert zones[1] == 600  # Z2; the last Z2 sample is held until the first stopped sample
    assert zones[2] == 300 - 30 - 5  # Z3 minus the 30 s gap and the interval spanning it
    assert zones[3] == zones[4] == 0
    assert edwards_trimp(zones) == pytest.approx(600 / 60 * 2 + 265 / 60 * 3)


def test_heart_rate_below_zone_1_counts_as_zone_1_and_above_max_as_zone_5() -> None:
    zones = time_in_zones(samples((60, 90, 3.0), (60, 200, 3.0)), MAX_HR, RESTING_HR)
    assert zones[0] == 60
    assert zones[4] == 55


def test_training_load_acute_chronic_ratio_and_bands() -> None:
    runs = [
        RunZones("a", TODAY - timedelta(days=offset), "easy", (0.0, 1800.0, 0.0, 0.0, 0.0))
        for offset in range(0, 28, 2)
    ]
    load = training_load(runs, TODAY, TODAY - timedelta(days=60))

    assert len(load.daily) == 120
    assert load.daily[-1][0] == TODAY and load.daily[-1][1] == 60
    assert load.acute_load == 4 * 60
    assert load.chronic_load == 14 * 60 / 4
    assert load.ratio == pytest.approx(round(240 / 210, 2))
    assert load.band == "typical"

    short_history = training_load(runs, TODAY, TODAY - timedelta(days=10))
    assert short_history.ratio is None and short_history.chronic_history_complete is False

    assert ratio_band(0.5) == "low"
    assert ratio_band(1.3) == "elevated"
    assert ratio_band(1.5) == "spike"
    assert ratio_band(None) is None


class ActivitiesFake:
    def __init__(self, runs: list[dict]) -> None:
        self.runs = runs

    async def list_range(self, start: str, end: str) -> list[dict]:
        return [run for run in self.runs if start <= run["local_date"] < end]


class SamplesFake:
    def __init__(self, series: dict[str, list[dict]]) -> None:
        self.series = series
        self.calls: list[tuple[list[str], tuple[str, ...]]] = []

    async def list_sample_fields(self, ids: list[str], fields: tuple[str, ...]) -> dict:
        self.calls.append((ids, fields))
        return {key: value for key, value in self.series.items() if key in ids}


class SettingsFake:
    def __init__(self, max_hr: int | None, resting: int | None) -> None:
        self.value = SimpleNamespace(max_heart_rate_bpm=max_hr, resting_heart_rate_bpm=resting)

    async def get(self) -> SimpleNamespace:
        return self.value


def run(identifier: str, day: date, category: str) -> dict:
    return {
        "id": identifier,
        "sport": "run",
        "title": identifier,
        "category": category,
        "local_date": day.isoformat(),
    }


def service(settings: SettingsFake, runs: list[dict], series: dict) -> AnalyticsService:
    return AnalyticsService(
        ActivitiesFake(runs),  # type: ignore[arg-type]
        None,  # type: ignore[arg-type]
        None,  # type: ignore[arg-type]
        SamplesFake(series),  # type: ignore[arg-type]
        settings,  # type: ignore[arg-type]
    )


@pytest.mark.asyncio
async def test_zone_analytics_reports_missing_heart_rate_settings() -> None:
    result = await service(SettingsFake(194, None), [], {}).heart_rate_zones(TODAY)

    assert result.status == "heart_rate_settings_missing"
    assert "max and resting heart rate" in (result.message or "")
    assert result.training_load is None and result.weekly_time_in_zones == []


@pytest.mark.asyncio
async def test_zone_analytics_weekly_easy_distribution_and_load() -> None:
    runs = [
        run("old", date(2026, 3, 2), "easy"),
        run("easy", date(2026, 9, 22), "easy"),
        run("track", date(2026, 9, 24), "track"),
        run("today", TODAY, "recovery"),
        run("no-hr", date(2026, 9, 25), "easy"),
    ]
    series = {
        "old": samples((600, 145, 3.0)),
        "easy": samples((1800, 145, 3.0), (600, 160, 3.0)),
        "track": samples((600, 175, 4.5)),
        "today": samples((1200, 130, 2.8)),
        "no-hr": [{"elapsed_seconds": 0, "speed_mps": 3.0}],
    }
    result = await service(SettingsFake(194, 55), runs, series).heart_rate_zones(TODAY)

    assert result.status == "ok"
    assert [zone.lower_bpm for zone in result.zones] == [124.5, 138.4, 152.3, 166.2, 180.1]
    weeks = result.weekly_time_in_zones
    assert len(weeks) == 16 and weeks[-1].week_start == date(2026, 9, 28)
    assert weeks[-1].is_partial and not weeks[-2].is_partial
    assert weeks[0].total_seconds == 0  # zero-filled
    previous = weeks[-2]
    assert previous.run_count == 2
    assert previous.zone_seconds[1] == 1800 and previous.zone_seconds[3] == 595
    easy_previous = result.easy_run_weekly_distribution[-2]
    assert easy_previous.run_count == 1 and easy_previous.zone_seconds[3] == 0
    assert result.easy_run_weekly_distribution[-1].zone_seconds[0] == 1195
    assert result.runs_without_heart_rate == 1
    assert [item.activity_id for item in result.runs] == ["today", "track", "easy"]

    load = result.training_load
    assert load is not None and len(load.days) == 120
    easy_trimp = 1800 / 60 * 2 + 595 / 60 * 3  # 2026-09-22 is outside the 7-day acute window
    acute = 595 / 60 * 4 + 1195 / 60
    assert load.acute_load == pytest.approx(acute, abs=0.1)
    assert load.chronic_load == pytest.approx((acute + easy_trimp) / 4, abs=0.1)
    assert load.acute_chronic_ratio == pytest.approx(acute / ((acute + easy_trimp) / 4), abs=0.01)
    assert load.ratio_band == "spike"
    assert [band.label for band in load.bands] == ["low", "typical", "elevated", "spike"]
