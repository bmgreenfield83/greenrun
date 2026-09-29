import pytest

from app.services.fit.models import ActivitySample
from app.services.grade_adjustment import (
    grade_adjusted_speed,
    grade_factor,
    minetti_cost,
    window_grades,
)


def test_flat_grade_has_unit_factor() -> None:
    assert minetti_cost(0) == pytest.approx(3.6)
    assert grade_factor(0) == pytest.approx(1.0)
    assert grade_adjusted_speed(3.0, 0) == pytest.approx(3.0)


def test_uphill_costs_more_and_moderate_downhill_costs_less() -> None:
    assert grade_factor(0.05) > 1.2
    assert grade_factor(0.10) > grade_factor(0.05)
    assert grade_factor(-0.05) < 1.0
    assert grade_factor(-0.10) < grade_factor(-0.05)


def test_steep_downhill_cost_rises_again_and_grade_is_clamped() -> None:
    minimum = min(grade_factor(-step / 100) for step in range(0, 46))
    assert minimum < grade_factor(-0.40) < grade_factor(-0.45)
    assert grade_factor(-0.45) > 1.0
    assert grade_factor(0.9) == grade_factor(0.45)
    assert grade_factor(-0.9) == grade_factor(-0.45)


def test_window_grades_use_centered_30_second_window_and_minimum_distance() -> None:
    samples = [
        ActivitySample(
            elapsed_seconds=seconds,
            distance_meters=seconds * 3.0,
            elevation_meters=seconds * 3.0 * 0.05,
            speed_mps=3.0,
        )
        for seconds in range(0, 300, 5)
    ]
    grades = window_grades(samples)
    assert grades[len(grades) // 2] == pytest.approx(0.05)

    standing = [
        ActivitySample(elapsed_seconds=seconds, distance_meters=1.0, elevation_meters=seconds)
        for seconds in range(0, 60, 5)
    ]
    assert window_grades(standing) == [0.0] * len(standing)

    missing = [ActivitySample(elapsed_seconds=seconds) for seconds in range(0, 60, 5)]
    assert window_grades(missing) == [0.0] * len(missing)
