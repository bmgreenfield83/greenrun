"""Grade-adjusted running speed from the Minetti et al. (2002) energy cost of running.

Minetti AE, Moia C, Roi GS, Susta D, Ferretti G. "Energy cost of walking and running at extreme
uphill and downhill slopes." J Appl Physiol 93:1039-1046 (2002). Their polynomial fit of the
metabolic cost of running per unit body mass and distance is

    Cr(i) = 155.4 i^5 - 30.4 i^4 - 43.3 i^3 + 46.3 i^2 + 19.5 i + 3.6   (J/kg/m)

for grade ``i`` as a fraction (rise / horizontal run), measured between -0.45 and +0.45. Grades are
clamped to that range. Grade-adjusted speed is the flat speed with the same energy cost per second:

    grade_adjusted_speed = speed * Cr(i) / Cr(0),  Cr(0) = 3.6

Caveats: the curve comes from a small group of trained runners on a treadmill at fixed speeds; it
models metabolic cost, not heart rate, and tends to overstate the cost of moderate uphills relative
to heart-rate-based adjustments. Recorded grade also inherits GPS/barometric elevation noise.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol

MAX_ABS_GRADE = 0.45
FLAT_COST = 3.6
GRADE_WINDOW_SECONDS = 30
# Below this horizontal distance within the grade window, grade is treated as 0 (standing,
# walking slowly, or GPS jitter would otherwise produce extreme grades).
MINIMUM_GRADE_DISTANCE_METERS = 20.0


class GradeSample(Protocol):
    elapsed_seconds: int
    distance_meters: float | None
    elevation_meters: float | None


def minetti_cost(grade: float) -> float:
    """Energy cost of running (J/kg/m) at `grade`, clamped to +/-0.45."""
    i = max(-MAX_ABS_GRADE, min(MAX_ABS_GRADE, grade))
    return ((((155.4 * i - 30.4) * i - 43.3) * i + 46.3) * i + 19.5) * i + 3.6


def grade_factor(grade: float) -> float:
    """Multiplier converting actual speed to flat-equivalent speed: Cr(i) / Cr(0)."""
    return minetti_cost(grade) / FLAT_COST


def grade_adjusted_speed(speed_mps: float, grade: float) -> float:
    return speed_mps * grade_factor(grade)


def window_grades(
    samples: Sequence[GradeSample], window_seconds: int = GRADE_WINDOW_SECONDS
) -> list[float]:
    """Grade for each sample from elevation and distance change over a centered time window.

    The window spans roughly ``window_seconds`` of elapsed time centered on the sample (clipped at
    the ends of the series). Grade is 0 when elevation or distance is missing at either window end
    or when less than 20 m of horizontal distance is covered. `samples` must be sorted by elapsed
    time. The result is not clamped; `minetti_cost` clamps to +/-0.45.
    """
    half = window_seconds / 2
    count = len(samples)
    grades: list[float] = []
    left = right = 0
    for index, sample in enumerate(samples):
        centre = sample.elapsed_seconds
        while left < index and samples[left].elapsed_seconds < centre - half:
            left += 1
        right = max(right, index)
        while right + 1 < count and samples[right + 1].elapsed_seconds <= centre + half:
            right += 1
        start, end = samples[left], samples[right]
        if (
            start.distance_meters is None
            or end.distance_meters is None
            or start.elevation_meters is None
            or end.elevation_meters is None
        ):
            grades.append(0.0)
            continue
        horizontal = end.distance_meters - start.distance_meters
        if horizontal < MINIMUM_GRADE_DISTANCE_METERS:
            grades.append(0.0)
            continue
        grades.append((end.elevation_meters - start.elevation_meters) / horizontal)
    return grades
