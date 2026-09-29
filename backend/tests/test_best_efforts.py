import pytest

from app.services.best_efforts import (
    METERS_PER_MILE,
    distance_series,
    fastest_window,
    is_exact_distance_lap,
)


def constant_pace(seconds: int, speed: float, step: int = 5) -> list[tuple[float, float]]:
    return [(float(t), t * speed) for t in range(0, seconds + 1, step)]


def test_constant_pace_window_equals_distance_over_speed() -> None:
    effort = fastest_window(constant_pace(1800, 3.0), 5000)

    assert effort is not None
    assert effort.elapsed_seconds == pytest.approx(5000 / 3.0)


def test_fast_segment_is_found_with_interpolated_endpoints() -> None:
    # 10 minutes at 3 m/s, then a fast mile at 4.5 m/s, then 10 minutes at 3 m/s.
    points: list[tuple[float, float]] = []
    time, distance = 0.0, 0.0
    fast_duration = METERS_PER_MILE / 4.5
    while time < 600 + fast_duration + 600:
        speed = 4.5 if 600 <= time < 600 + fast_duration else 3.0
        points.append((time, distance))
        time += 5
        distance += speed * 5
    effort = fastest_window(points, METERS_PER_MILE)

    assert effort is not None
    # Sample boundaries do not align with the fast segment; interpolation stays within one sample.
    assert effort.elapsed_seconds == pytest.approx(fast_duration, abs=2.5)
    assert effort.start_distance_meters == pytest.approx(1800, abs=25)


def test_pauses_count_as_elapsed_time() -> None:
    points = [(0.0, 0.0), (500.0, 1500.0), (800.0, 1500.0), (1300.0, 3000.0)]

    effort = fastest_window(points, 3000)

    assert effort is not None
    assert effort.elapsed_seconds == 1300


def test_short_or_implausible_series_produce_no_effort() -> None:
    assert fastest_window(constant_pace(100, 3.0), METERS_PER_MILE) is None
    assert fastest_window([(0.0, 0.0), (60.0, 2000.0)], METERS_PER_MILE) is None
    assert fastest_window([], 5000) is None


def test_distance_series_drops_missing_and_backwards_points() -> None:
    samples = [
        {"elapsed_seconds": 10, "distance_meters": 30},
        {"elapsed_seconds": 0, "distance_meters": 0},
        {"elapsed_seconds": 5, "distance_meters": None},
        {"elapsed_seconds": 15, "distance_meters": 20},
        {"elapsed_seconds": 20, "distance_meters": 60},
    ]

    assert distance_series(samples) == [(0, 0), (10, 30), (20, 60)]


@pytest.mark.parametrize(
    ("lap_distance", "expected"),
    [
        (1609.344, True),
        (1608.0, True),
        (1616.0, True),
        (1600.0, False),
        (1620.0, False),
        (None, False),
    ],
)
def test_exact_distance_laps_use_tight_tolerance(
    lap_distance: float | None, expected: bool
) -> None:
    assert is_exact_distance_lap(lap_distance, METERS_PER_MILE) is expected
