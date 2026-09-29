"""Time in heart-rate-reserve zones, Edwards TRIMP, and acute/chronic training load.

- Time in zones: each sample's heart rate is held until the next sample (the stored samples are
  five-second buckets starting at `elapsed_seconds`). An interval counts only when both samples
  exist no more than 15 s apart, the left sample has heart rate, and it is not stopped (recorded
  speed below 0.5 m/s). Zones are heart-rate-reserve zones from `heart_rate_zones`.
- Edwards TRIMP = sum over zones of minutes in zone x zone number (Z1..Z5 weighted 1..5).
- Acute load = TRIMP over the last 7 days (including the as-of date). Chronic load = TRIMP over the
  last 28 days / 4, i.e. the average weekly load. The acute:chronic ratio is guidance only.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

from app.services.heart_rate_zones import heart_rate_zone

ZONE_COUNT = 5
MAX_SAMPLE_GAP_SECONDS = 15
STOP_SPEED_MPS = 0.5
ACUTE_DAYS = 7
CHRONIC_DAYS = 28
LOAD_HISTORY_DAYS = 120

# (label, lower bound inclusive, upper bound exclusive, description). The plan defines <0.8 low,
# 0.8-1.3 typical and >1.5 spike; 1.3-1.5 is reported as "elevated".
RATIO_BANDS: tuple[tuple[str, float | None, float | None, str], ...] = (
    ("low", None, 0.8, "Recent load is below your recent average."),
    ("typical", 0.8, 1.3, "Recent load is in line with your recent average."),
    ("elevated", 1.3, 1.5, "Recent load is somewhat above your recent average."),
    ("spike", 1.5, None, "Recent load is well above your recent average."),
)
RATIO_GUIDANCE = (
    "Acute:chronic ratio compares the last 7 days of TRIMP with the average week of the last 28 "
    "days. The bands are rough guidance, not a rule or an injury prediction."
)


@dataclass(frozen=True)
class RunZones:
    activity_id: str
    local_date: date
    category: str | None
    zone_seconds: tuple[float, ...]

    @property
    def total_seconds(self) -> float:
        return sum(self.zone_seconds)

    @property
    def trimp(self) -> float:
        return edwards_trimp(self.zone_seconds)


def time_in_zones(
    samples: Iterable[dict[str, Any]], max_heart_rate: float, resting_heart_rate: float
) -> tuple[float, ...]:
    """Seconds in Z1..Z5 from raw sample documents (elapsed_seconds, heart_rate, speed_mps)."""
    ordered = sorted(
        (sample for sample in samples if sample.get("elapsed_seconds") is not None),
        key=lambda sample: sample["elapsed_seconds"],
    )
    totals = [0.0] * ZONE_COUNT
    for left, right in zip(ordered, ordered[1:], strict=False):
        step = right["elapsed_seconds"] - left["elapsed_seconds"]
        heart_rate = left.get("heart_rate")
        speed = left.get("speed_mps")
        if step <= 0 or step > MAX_SAMPLE_GAP_SECONDS or not heart_rate:
            continue
        if speed is not None and speed < STOP_SPEED_MPS:
            continue
        totals[heart_rate_zone(heart_rate, max_heart_rate, resting_heart_rate) - 1] += step
    return tuple(totals)


def edwards_trimp(zone_seconds: Sequence[float]) -> float:
    return sum(seconds / 60 * zone for zone, seconds in enumerate(zone_seconds, start=1))


def ratio_band(ratio: float | None) -> str | None:
    if ratio is None:
        return None
    for label, lower, upper, _description in RATIO_BANDS:
        if (lower is None or ratio >= lower) and (upper is None or ratio < upper):
            return label
    return None


@dataclass(frozen=True)
class LoadSummary:
    daily: list[tuple[date, float, int]]
    acute_load: float
    chronic_load: float
    ratio: float | None
    band: str | None
    chronic_history_complete: bool


def training_load(
    runs: Sequence[RunZones], as_of: date, first_run_date: date | None
) -> LoadSummary:
    """Daily TRIMP for the last 120 days plus acute/chronic load and their ratio.

    The ratio is null when chronic load is zero or the recorded history (first run date) is
    shorter than 28 days, since a partial chronic window would inflate the ratio.
    """
    start = as_of - timedelta(days=LOAD_HISTORY_DAYS - 1)
    by_day: dict[date, list[float]] = {}
    for run in runs:
        if start <= run.local_date <= as_of:
            by_day.setdefault(run.local_date, []).append(run.trimp)
    daily = [
        (day, round(sum(by_day.get(day, [])), 1), len(by_day.get(day, [])))
        for day in (start + timedelta(days=offset) for offset in range(LOAD_HISTORY_DAYS))
    ]

    def window(days: int) -> float:
        begin = as_of - timedelta(days=days - 1)
        return sum(sum(values) for day, values in by_day.items() if begin <= day <= as_of)

    acute = window(ACUTE_DAYS)
    chronic = window(CHRONIC_DAYS) / 4
    complete = first_run_date is not None and first_run_date <= as_of - timedelta(
        days=CHRONIC_DAYS - 1
    )
    ratio = round(acute / chronic, 2) if chronic > 0 and complete else None
    return LoadSummary(
        daily, round(acute, 1), round(chronic, 1), ratio, ratio_band(ratio), complete
    )
