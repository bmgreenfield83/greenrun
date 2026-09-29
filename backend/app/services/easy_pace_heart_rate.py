"""Heart rate at a fixed easy grade-adjusted pace (aerobic efficiency trend).

For each easy/long/recovery run:

1. Grade-adjusted speed (Minetti, `grade_adjustment`) is smoothed with a 30 s first-order filter
   so it lines up with the slower heart-rate response; the filter restarts after each stop.
2. Steady samples are those after the first 10 minutes, with heart rate, moving (>= 0.5 m/s), at
   least 90 s after the last stop (a sample gap > 15 s or a stopped sample), and with a plausible
   grade-adjusted pace (4:00-20:00 /mi).
3. A run needs at least 15 minutes of steady samples. Heart rate is fit against grade-adjusted pace
   (seconds per mile) with Huber-weighted least squares. When pace barely varies (SD < 5 s/mi),
   the slope is not identifiable and the run's median heart rate is used instead.
4. The reference pace is the median of the runs' median grade-adjusted paces, rounded to the
   nearest 15 s/mi, so every run is evaluated at the same pace. A run is excluded when the reference
   lies more than 30 s/mi outside its 5th-95th percentile pace range (no extrapolation).
5. Monthly values are medians of the per-run estimates. Falling heart rate at the same pace
   suggests improved aerobic fitness, but heat, fatigue, and sensor error also move it.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from math import exp
from statistics import median, pstdev
from typing import Any

from app.services.grade_adjustment import grade_adjusted_speed, window_grades

METERS_PER_MILE = 1609.344
EASY_PACE_CATEGORIES = ("easy", "long", "recovery")
SETTLING_SECONDS = 600
AFTER_STOP_SECONDS = 90
MAX_SAMPLE_GAP_SECONDS = 15
STOP_SPEED_MPS = 0.5
SMOOTHING_SECONDS = 30
MINIMUM_STEADY_SECONDS = 900
FASTEST_PACE = 240.0
SLOWEST_PACE = 1200.0
FLAT_PACE_SD = 5.0
REFERENCE_ROUNDING = 15
EXTRAPOLATION_LIMIT = 30.0


@dataclass
class Point:
    elapsed_seconds: int
    distance_meters: float | None
    elevation_meters: float | None
    heart_rate: float | None
    speed_mps: float | None


@dataclass(frozen=True)
class RunFit:
    intercept: float
    slope: float
    median_pace: float
    pace_low: float
    pace_high: float
    steady_seconds: float
    median_heart_rate: float

    def heart_rate_at(self, pace: float) -> float:
        return self.intercept + self.slope * pace

    def covers(self, pace: float) -> bool:
        return self.pace_low - EXTRAPOLATION_LIMIT <= pace <= self.pace_high + EXTRAPOLATION_LIMIT


def points_from_documents(samples: Iterable[dict[str, Any]]) -> list[Point]:
    return sorted(
        (
            Point(
                elapsed_seconds=sample["elapsed_seconds"],
                distance_meters=sample.get("distance_meters"),
                elevation_meters=sample.get("elevation_meters"),
                heart_rate=sample.get("heart_rate"),
                speed_mps=sample.get("speed_mps"),
            )
            for sample in samples
            if sample.get("elapsed_seconds") is not None
        ),
        key=lambda point: point.elapsed_seconds,
    )


def steady_pairs(points: Sequence[Point]) -> tuple[list[tuple[float, float]], float]:
    """Return (grade-adjusted pace s/mi, heart rate) pairs and the steady duration in seconds."""
    grades = window_grades(points)
    pairs: list[tuple[float, float]] = []
    seconds = 0.0
    smoothed: float | None = None
    resumed_at: int | None = None
    previous: Point | None = None
    for point, grade in zip(points, grades, strict=True):
        moving = (point.speed_mps or 0.0) >= STOP_SPEED_MPS
        gap = previous is not None and (
            point.elapsed_seconds - previous.elapsed_seconds > MAX_SAMPLE_GAP_SECONDS
        )
        if not moving or gap or resumed_at is None:
            smoothed = None
            resumed_at = point.elapsed_seconds if moving else None
        if moving:
            speed = grade_adjusted_speed(point.speed_mps or 0.0, grade)
            if smoothed is None or previous is None:
                smoothed = speed
            else:
                step = point.elapsed_seconds - previous.elapsed_seconds
                smoothed += (1 - exp(-step / SMOOTHING_SECONDS)) * (speed - smoothed)
        if (
            moving
            and smoothed
            and resumed_at is not None
            and point.heart_rate
            and point.elapsed_seconds >= SETTLING_SECONDS
            and point.elapsed_seconds - resumed_at >= AFTER_STOP_SECONDS
        ):
            pace = METERS_PER_MILE / smoothed
            if FASTEST_PACE <= pace <= SLOWEST_PACE:
                pairs.append((pace, float(point.heart_rate)))
                if previous is not None:
                    seconds += min(point.elapsed_seconds - previous.elapsed_seconds, 10)
        previous = point
    return pairs, seconds


def _weighted_line(
    pairs: Sequence[tuple[float, float]], weights: Sequence[float]
) -> tuple[float, float]:
    total = sum(weights)
    mean_x = sum(w * x for (x, _y), w in zip(pairs, weights, strict=True)) / total
    mean_y = sum(w * y for (_x, y), w in zip(pairs, weights, strict=True)) / total
    sxx = sum(w * (x - mean_x) ** 2 for (x, _y), w in zip(pairs, weights, strict=True))
    sxy = sum(w * (x - mean_x) * (y - mean_y) for (x, y), w in zip(pairs, weights, strict=True))
    slope = sxy / sxx if sxx else 0.0
    return mean_y - slope * mean_x, slope


def huber_line(pairs: Sequence[tuple[float, float]]) -> tuple[float, float]:
    """Huber-weighted straight line y = a + b x (cutoff 1.5 x MAD scale, at least 1 bpm)."""
    weights = [1.0] * len(pairs)
    intercept, slope = _weighted_line(pairs, weights)
    for _ in range(6):
        residuals = [y - (intercept + slope * x) for x, y in pairs]
        cutoff = 1.5 * max(1.0, median(abs(value) for value in residuals) * 1.4826)
        weights = [1.0 if abs(value) <= cutoff else cutoff / abs(value) for value in residuals]
        intercept, slope = _weighted_line(pairs, weights)
    return intercept, slope


def _percentile(sorted_values: Sequence[float], fraction: float) -> float:
    position = fraction * (len(sorted_values) - 1)
    lower = int(position)
    upper = min(lower + 1, len(sorted_values) - 1)
    return sorted_values[lower] + (position - lower) * (sorted_values[upper] - sorted_values[lower])


def fit_run(points: Sequence[Point]) -> RunFit | str:
    """Fit one run, or return the exclusion reason."""
    pairs, seconds = steady_pairs(points)
    if seconds < MINIMUM_STEADY_SECONDS or len(pairs) < 20:
        return "Less than 15 minutes of steady running after the first 10 minutes."
    paces = sorted(pace for pace, _heart_rate in pairs)
    heart_rates = [heart_rate for _pace, heart_rate in pairs]
    if pstdev(paces) < FLAT_PACE_SD:
        intercept, slope = float(median(heart_rates)), 0.0
    else:
        intercept, slope = huber_line(pairs)
    return RunFit(
        intercept=intercept,
        slope=slope,
        median_pace=float(median(paces)),
        pace_low=_percentile(paces, 0.05),
        pace_high=_percentile(paces, 0.95),
        steady_seconds=seconds,
        median_heart_rate=float(median(heart_rates)),
    )


def reference_pace(fits: Iterable[RunFit]) -> int | None:
    medians = [fit.median_pace for fit in fits]
    if not medians:
        return None
    return int(round(median(medians) / REFERENCE_ROUNDING) * REFERENCE_ROUNDING)
