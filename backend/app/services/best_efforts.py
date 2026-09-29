"""Exact-distance best efforts from stored samples and laps.

Samples provide a cumulative distance/elapsed-time series. The fastest window covering an exact
distance is found with two pointers, interpolating the opposite endpoint linearly on distance. On a
piecewise-linear distance/time series the optimum always has one endpoint on a sample, so evaluating
both "end on a sample" and "start on a sample" windows is exact. Times are elapsed (pauses count).
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass

METERS_PER_MILE = 1609.344

BEST_EFFORT_DISTANCES: tuple[tuple[str, float], ...] = (
    ("1 mile", METERS_PER_MILE),
    ("5K", 5000.0),
    ("10K", 10000.0),
    ("Half marathon", 21097.5),
    ("Marathon", 42195.0),
)
# A lap counts as an exact-distance effort when it is no more than 2 m short (rounding in the FIT
# distance) and at most 0.5% long. Longer laps are allowed because their time is conservative.
LAP_SHORT_TOLERANCE_METERS = 2.0
LAP_LONG_TOLERANCE_FRACTION = 0.005
# Windows faster than this average speed are treated as GPS/distance artifacts, not efforts.
MAXIMUM_PLAUSIBLE_SPEED_MPS = 7.0


@dataclass(frozen=True)
class Effort:
    elapsed_seconds: float
    start_distance_meters: float
    start_elapsed_seconds: float


def distance_series(samples: Iterable[dict]) -> list[tuple[float, float]]:
    """Return monotonic (elapsed seconds, cumulative distance) points from raw sample documents."""
    points: list[tuple[float, float]] = []
    for sample in sorted(samples, key=lambda item: item.get("elapsed_seconds") or 0):
        distance = sample.get("distance_meters")
        elapsed = sample.get("elapsed_seconds")
        if distance is None or elapsed is None:
            continue
        if points and (distance < points[-1][1] or elapsed <= points[-1][0]):
            continue
        points.append((float(elapsed), float(distance)))
    return points


def _time_at(points: Sequence[tuple[float, float]], index: int, distance: float) -> float:
    """Interpolated elapsed time at `distance` between points[index] and points[index + 1]."""
    left_time, left_distance = points[index]
    right_time, right_distance = points[index + 1]
    if right_distance <= left_distance:
        return left_time
    fraction = (distance - left_distance) / (right_distance - left_distance)
    return left_time + fraction * (right_time - left_time)


def fastest_window(points: Sequence[tuple[float, float]], distance: float) -> Effort | None:
    if len(points) < 2 or points[-1][1] - points[0][1] < distance:
        return None
    best: Effort | None = None

    def consider(start_time: float, start_distance: float, end_time: float) -> None:
        nonlocal best
        elapsed = end_time - start_time
        if elapsed <= 0 or distance / elapsed > MAXIMUM_PLAUSIBLE_SPEED_MPS:
            return
        if best is None or elapsed < best.elapsed_seconds:
            best = Effort(elapsed, start_distance, start_time)

    # Windows ending on a sample: interpolate the start.
    start = 0
    for end_time, end_distance in points:
        target = end_distance - distance
        if target < points[0][1]:
            continue
        while start + 1 < len(points) and points[start + 1][1] <= target:
            start += 1
        if start + 1 >= len(points):
            break
        consider(_time_at(points, start, target), target, end_time)

    # Windows starting on a sample: interpolate the end.
    end = 0
    for start_time, start_distance in points:
        target = start_distance + distance
        if target > points[-1][1]:
            break
        while end + 1 < len(points) and points[end + 1][1] < target:
            end += 1
        if end + 1 >= len(points):
            break
        consider(start_time, start_distance, _time_at(points, end, target))
    return best


def is_exact_distance_lap(lap_distance: float | None, distance: float) -> bool:
    if lap_distance is None:
        return False
    return (
        distance - LAP_SHORT_TOLERANCE_METERS
        <= lap_distance
        <= distance * (1 + LAP_LONG_TOLERANCE_FRACTION)
    )
