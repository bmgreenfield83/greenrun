"""Algorithm version 4 of the workload-adjusted heart-rate response with synthetic runs."""

import math
import random
from types import SimpleNamespace

import pytest

from app.services.fit.models import ActivitySample
from app.services.grade_adjustment import grade_adjusted_speed
from app.services.heart_rate_response import (
    block_bootstrap_interval,
    calculate_heart_rate_response,
    confidence_level,
    filtered_workloads,
    robust_regression,
)

TRUE_DRIFT = 6.0
HILL_WAVELENGTH = 800.0
HILL_GRADE = 0.06


def run(duration: int = 3600) -> SimpleNamespace:
    return SimpleNamespace(sport="run", category="easy", elapsed_time_seconds=duration)


def synthetic_run(
    *,
    hilly: bool,
    seed: int,
    duration: int = 3600,
    pause: tuple[int, int] | None = None,
    record_pause: bool = True,
) -> list[ActivitySample]:
    """Identical fitness: HR follows filtered Minetti grade-adjusted speed + 6 bpm/h + AR noise."""
    generator = random.Random(seed)
    samples: list[ActivitySample] = []
    distance = 0.0
    state: float | None = None
    noise = 0.0
    for seconds in range(0, duration + 1, 5):
        paused = pause is not None and pause[0] <= seconds < pause[1]
        grade = HILL_GRADE * math.sin(2 * math.pi * distance / HILL_WAVELENGTH) if hilly else 0.0
        speed = 3.0 + 0.3 * math.sin(2 * math.pi * seconds / 420)
        if hilly:
            speed /= 1 + 4 * max(grade, 0.0)
        if paused:
            speed = 0.0
        workload = grade_adjusted_speed(speed, grade) if speed else 0.0
        state = workload if state is None else state + (1 - math.exp(-5 / 45)) * (workload - state)
        noise = 0.9 * noise + generator.gauss(0, 2.0 * math.sqrt(1 - 0.81))
        elevation = (
            -HILL_GRADE
            * HILL_WAVELENGTH
            / (2 * math.pi)
            * math.cos(2 * math.pi * distance / HILL_WAVELENGTH)
            if hilly
            else 10.0
        )
        if not paused or record_pause:
            samples.append(
                ActivitySample(
                    elapsed_seconds=seconds,
                    distance_meters=distance,
                    heart_rate=round(60 + 30 * state + TRUE_DRIFT * seconds / 3600 + noise),
                    speed_mps=speed,
                    elevation_meters=elevation,
                )
            )
        distance += speed * 5
    return samples


@pytest.mark.parametrize("seed", [2, 3])
def test_hills_and_flat_with_identical_fitness_give_similar_results(seed: int) -> None:
    flat = calculate_heart_rate_response(run(), synthetic_run(hilly=False, seed=seed))
    hilly = calculate_heart_rate_response(run(), synthetic_run(hilly=True, seed=seed))

    assert flat["eligible"] and hilly["eligible"]
    assert flat["algorithm_version"] == hilly["algorithm_version"] == 4
    assert hilly["adjusted_change_bpm_per_hour"] == pytest.approx(
        flat["adjusted_change_bpm_per_hour"], abs=1.0
    )
    assert hilly["adjusted_change_bpm_per_hour"] == pytest.approx(TRUE_DRIFT, abs=2.0)


def test_recorded_pause_and_auto_pause_gap_are_modeled_the_same_way() -> None:
    recorded = calculate_heart_rate_response(
        run(), synthetic_run(hilly=False, seed=4, pause=(1800, 1980))
    )
    gap = calculate_heart_rate_response(
        run(), synthetic_run(hilly=False, seed=4, pause=(1800, 1980), record_pause=False)
    )

    for result in (recorded, gap):
        assert result["eligible"] is True
        assert result["adjusted_change_bpm_per_hour"] == pytest.approx(TRUE_DRIFT, abs=2.0)
        assert result["stop_count"] == 1
        assert result["analysis_ranges"] == [
            {"start_seconds": 300, "end_seconds": 1795},
            {"start_seconds": 1980, "end_seconds": 3600},
        ]
        assert result["analysis_start_seconds"] == 300
        assert result["analysis_end_seconds"] == 3600
    assert recorded["adjusted_change_bpm_per_hour"] == gap["adjusted_change_bpm_per_hour"]
    # Usable duration excludes the stop; the stop is reported separately.
    assert gap["usable_duration_seconds"] == pytest.approx(3300 - 180)
    assert gap["stopped_duration_seconds"] == pytest.approx(180)


def test_filter_decays_through_stops_for_their_duration_capped_at_five_minutes() -> None:
    def state_after(gap: int) -> float:
        samples = [
            ActivitySample(elapsed_seconds=0, speed_mps=3.0),
            ActivitySample(elapsed_seconds=5, speed_mps=3.0),
            ActivitySample(elapsed_seconds=10, speed_mps=3.0),
            ActivitySample(elapsed_seconds=10 + gap, speed_mps=0.0),
        ]
        return filtered_workloads(samples, [3.0, 3.0, 3.0, 0.0], 60)[-1]

    assert state_after(60) < state_after(20) < 3.0
    assert state_after(600) == pytest.approx(state_after(305))
    assert state_after(600) == pytest.approx(3.0 * math.exp(-300 / 60) * math.exp(-5 / 60))


def test_bootstrap_interval_is_deterministic_and_seed_dependent() -> None:
    samples = synthetic_run(hilly=True, seed=7)
    first = calculate_heart_rate_response(run(), samples)
    second = calculate_heart_rate_response(run(), samples)
    assert first == second
    assert first["bootstrap_resamples"] == 200
    assert first["bootstrap_block_seconds"] == 120
    assert (
        first["adjusted_change_lower_90_bpm_per_hour"]
        < first["adjusted_change_bpm_per_hour"]
        < first["adjusted_change_upper_90_bpm_per_hour"]
    )

    rows = [
        (1.0 + (index % 7) / 10, index / 720, 140 + index / 120 + (index % 5))
        for index in range(720)
    ]
    fit = robust_regression(rows)
    assert fit is not None
    seeded = block_bootstrap_interval(rows, fit, 24, seed=1)
    assert block_bootstrap_interval(rows, fit, 24, seed=1) == seeded
    assert block_bootstrap_interval(rows, fit, 24, seed=2) != seeded


def test_confidence_uses_interval_width_and_usable_duration() -> None:
    assert confidence_level(3300, 4.0) == "high"
    assert confidence_level(3300, 9.0) == "moderate"
    assert confidence_level(3300, 15.0) == "low"
    assert confidence_level(1300, 2.0) == "low"
    assert confidence_level(2000, 2.0) == "moderate"


def test_noisier_run_gets_a_wider_interval() -> None:
    quiet = synthetic_run(hilly=False, seed=11)
    noisy = [
        sample.model_copy(
            update={
                "heart_rate": sample.heart_rate + (6 if (sample.elapsed_seconds // 300) % 2 else -6)
            }
        )
        for sample in quiet
    ]
    quiet_result = calculate_heart_rate_response(run(), quiet)
    noisy_result = calculate_heart_rate_response(run(), noisy)

    def width(result: dict) -> float:
        return (
            result["adjusted_change_upper_90_bpm_per_hour"]
            - result["adjusted_change_lower_90_bpm_per_hour"]
        )

    assert width(noisy_result) > width(quiet_result)
