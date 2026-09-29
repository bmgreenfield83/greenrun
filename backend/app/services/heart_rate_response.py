"""Workload-adjusted heart-rate response (algorithm version 4).

Estimates how much heart rate changes per hour of running after accounting for recorded workload.
The steps (see docs/analytics.md for the full description and caveats):

1. Eligibility: runs of at least 25 minutes; analysis starts after the first five minutes and after
   the optional per-activity start distance; at least 80% of analysis samples must have heart rate
   and moving speed (>= 0.5 m/s); at least 20 minutes of usable running must remain.
2. Workload is grade-adjusted speed (Minetti 2002, `grade_adjustment`), 0 while stopped.
3. Workload passes through a first-order response filter (time constant tau). Stops, whether
   recorded as slow samples or as auto-pause gaps, decay the filter toward zero for their real
   duration, capped at five minutes, so heart-rate recovery during a stop is modeled.
4. Heart rate is fit by robust (Huber-weighted) regression on filtered workload and cumulative
   running time in hours. Candidate taus from 15 to 120 s are tried; the lowest RMSE wins.
5. Uncertainty: a moving-block bootstrap of the fit residuals (blocks of ~2 minutes, fixed seed)
   gives a 90% interval for the bpm/hour coefficient. Confidence is derived from the interval width
   and the usable duration.
"""

from __future__ import annotations

import random
from math import ceil, exp, sqrt
from statistics import mean, median
from typing import Any

from app.services.fit.models import ActivitySample
from app.services.grade_adjustment import grade_adjusted_speed, window_grades

ALGORITHM_VERSION = 4
MINIMUM_ACTIVITY_SECONDS = 1500
SETTLING_SECONDS = 300
MINIMUM_USABLE_SECONDS = 1200
MINIMUM_COVERAGE = 0.8
STOP_SPEED_MPS = 0.5
# Consecutive samples further apart than this are treated as a stop/auto-pause gap.
MAX_SAMPLE_GAP_SECONDS = 15
MAX_MODELED_STOP_SECONDS = 300
RESPONSE_CANDIDATES_SECONDS = (15, 30, 45, 60, 90, 120)
MAX_WORKLOAD_TIME_CORRELATION = 0.92
BOOTSTRAP_RESAMPLES = 200
BOOTSTRAP_BLOCK_SECONDS = 120
BOOTSTRAP_SEED = 2002
# Confidence thresholds: (minimum usable seconds, maximum 90% interval width in bpm/hour).
HIGH_CONFIDENCE = (2400, 5.0)
MODERATE_CONFIDENCE = (1500, 10.0)

INTERPRETATION = (
    "Estimated heart-rate change per hour of running after accounting for grade-adjusted speed "
    "(Minetti energy cost) and stops; weather, hydration, fatigue, wind, and sensor error are not "
    "controlled. The 90% interval reflects noise within this run only."
)

Row = tuple[float, float, float]


def _solve_weighted_regression(
    rows: list[Row], weights: list[float]
) -> tuple[tuple[float, float, float], list[list[float]]] | None:
    """Weighted least squares for heart_rate ~ 1 + workload + hours.

    Returns the coefficients and the inverse of X'WX (used by the bootstrap).
    """
    xtx = [[0.0] * 3 for _ in range(3)]
    xty = [0.0] * 3
    for (workload, hours, heart_rate), weight in zip(rows, weights, strict=True):
        predictors = (1.0, workload, hours)
        for row in range(3):
            weighted = weight * predictors[row]
            xty[row] += weighted * heart_rate
            for column in range(3):
                xtx[row][column] += weighted * predictors[column]
    # Tiny ridge on workload keeps constant-workload runs solvable (workload is then absorbed by
    # the intercept).
    xtx[1][1] += 1e-6
    inverse = _invert_3x3(xtx)
    if inverse is None:
        return None
    coefficients = tuple(sum(inverse[row][k] * xty[k] for k in range(3)) for row in range(3))
    return (coefficients[0], coefficients[1], coefficients[2]), inverse


def _invert_3x3(matrix: list[list[float]]) -> list[list[float]] | None:
    augmented = [
        [*row, *(1.0 if column == index else 0.0 for column in range(3))]
        for index, row in enumerate(matrix)
    ]
    for pivot in range(3):
        selected = max(range(pivot, 3), key=lambda row: abs(augmented[row][pivot]))
        if abs(augmented[selected][pivot]) < 1e-9:
            return None
        augmented[pivot], augmented[selected] = augmented[selected], augmented[pivot]
        divisor = augmented[pivot][pivot]
        augmented[pivot] = [value / divisor for value in augmented[pivot]]
        for row in range(3):
            if row != pivot:
                factor = augmented[row][pivot]
                augmented[row] = [
                    value - factor * pivot_value
                    for value, pivot_value in zip(augmented[row], augmented[pivot], strict=True)
                ]
    return [row[3:] for row in augmented]


class RobustFit:
    def __init__(
        self,
        coefficients: tuple[float, float, float],
        weights: list[float],
        inverse: list[list[float]],
        predictions: list[float],
    ) -> None:
        self.coefficients = coefficients
        self.weights = weights
        self.inverse = inverse
        self.predictions = predictions


def _predict(coefficients: tuple[float, float, float], rows: list[Row]) -> list[float]:
    return [
        coefficients[0] + coefficients[1] * workload + coefficients[2] * hours
        for workload, hours, _heart_rate in rows
    ]


def robust_regression(rows: list[Row]) -> RobustFit | None:
    """Huber-weighted iteratively reweighted least squares (cutoff 1.5 x MAD scale, >= 1 bpm)."""
    weights = [1.0] * len(rows)
    solved = _solve_weighted_regression(rows, weights)
    if solved is None:
        return None
    for _ in range(6):
        predictions = _predict(solved[0], rows)
        residuals = [row[2] - prediction for row, prediction in zip(rows, predictions, strict=True)]
        scale = max(1.0, median(abs(value) for value in residuals) * 1.4826)
        cutoff = 1.5 * scale
        weights = [1.0 if abs(value) <= cutoff else cutoff / abs(value) for value in residuals]
        updated = _solve_weighted_regression(rows, weights)
        if updated is None:
            return None
        solved = updated
    coefficients, inverse = solved
    return RobustFit(coefficients, weights, inverse, _predict(coefficients, rows))


def _correlation(left: list[float], right: list[float]) -> float:
    left_mean, right_mean = mean(left), mean(right)
    numerator = sum((x - left_mean) * (y - right_mean) for x, y in zip(left, right, strict=True))
    left_sum = sum((value - left_mean) ** 2 for value in left)
    right_sum = sum((value - right_mean) ** 2 for value in right)
    return numerator / sqrt(left_sum * right_sum) if left_sum and right_sum else 0.0


def _is_moving(sample: ActivitySample) -> bool:
    return (sample.speed_mps or 0.0) >= STOP_SPEED_MPS


def _nominal_interval(samples: list[ActivitySample]) -> float:
    steps = [
        right.elapsed_seconds - left.elapsed_seconds
        for left, right in zip(samples, samples[1:], strict=False)
        if right.elapsed_seconds > left.elapsed_seconds
    ]
    return float(median(steps)) if steps else 5.0


def filtered_workloads(
    samples: list[ActivitySample], workloads: list[float], response_seconds: float
) -> list[float]:
    """First-order response of `workloads` (aligned with time-sorted `samples`).

    Normal steps use the exact exponential update over the sample spacing. A gap longer than
    15 s (auto-pause) decays the state toward zero for the gap duration minus one nominal interval,
    capped at five minutes, before the next sample's workload is applied over one nominal interval.
    Stopped samples carry zero workload, so recorded stops decay the state naturally.
    """
    nominal = _nominal_interval(samples)
    result: list[float] = []
    state: float | None = None
    previous_time = 0
    for sample, workload in zip(samples, workloads, strict=True):
        if state is None:
            state = workload
        else:
            step = sample.elapsed_seconds - previous_time
            if step > MAX_SAMPLE_GAP_SECONDS:
                stopped = min(step - nominal, MAX_MODELED_STOP_SECONDS)
                state *= exp(-stopped / response_seconds)
                step = nominal
            state += (1 - exp(-max(step, 0) / response_seconds)) * (workload - state)
        result.append(state)
        previous_time = sample.elapsed_seconds
    return result


def _percentile(sorted_values: list[float], fraction: float) -> float:
    position = fraction * (len(sorted_values) - 1)
    lower = int(position)
    upper = min(lower + 1, len(sorted_values) - 1)
    return sorted_values[lower] + (position - lower) * (sorted_values[upper] - sorted_values[lower])


def block_bootstrap_interval(
    rows: list[Row],
    fit: RobustFit,
    block_length: int,
    resamples: int = BOOTSTRAP_RESAMPLES,
    seed: int = BOOTSTRAP_SEED,
) -> tuple[float, float]:
    """90% moving-block bootstrap interval for the hours coefficient.

    Residual blocks of `block_length` consecutive samples are drawn with replacement (fixed seed),
    concatenated to the original length and added back to the fitted values. Each resample is
    refit by weighted least squares with the final robust weights held fixed, which is linear in
    the response: beta* = beta + sum(h_i * r*_i) with h = row 3 of (X'WX)^-1 X'W.
    """
    count = len(rows)
    block_length = max(1, min(block_length, count))
    time_row = fit.inverse[2]
    influence = [
        weight * (time_row[0] + time_row[1] * workload + time_row[2] * hours)
        for (workload, hours, _heart_rate), weight in zip(rows, fit.weights, strict=True)
    ]
    residuals = [row[2] - prediction for row, prediction in zip(rows, fit.predictions, strict=True)]
    generator = random.Random(seed)
    blocks = ceil(count / block_length)
    last_start = count - block_length
    estimates: list[float] = []
    beta = fit.coefficients[2]
    for _ in range(resamples):
        total = 0.0
        position = 0
        for _block in range(blocks):
            start = generator.randint(0, last_start)
            take = min(block_length, count - position)
            for offset in range(take):
                total += influence[position + offset] * residuals[start + offset]
            position += take
        estimates.append(beta + total)
    estimates.sort()
    return _percentile(estimates, 0.05), _percentile(estimates, 0.95)


def confidence_level(usable_seconds: float, interval_width: float) -> str:
    if usable_seconds >= HIGH_CONFIDENCE[0] and interval_width <= HIGH_CONFIDENCE[1]:
        return "high"
    if usable_seconds >= MODERATE_CONFIDENCE[0] and interval_width <= MODERATE_CONFIDENCE[1]:
        return "moderate"
    return "low"


def _analysis_ranges(valid: list[ActivitySample]) -> list[dict[str, int]]:
    ranges: list[dict[str, int]] = []
    for previous, sample in zip([None, *valid], valid, strict=False):
        if (
            previous is None
            or sample.elapsed_seconds - previous.elapsed_seconds > MAX_SAMPLE_GAP_SECONDS
        ):
            ranges.append(
                {"start_seconds": sample.elapsed_seconds, "end_seconds": sample.elapsed_seconds}
            )
        else:
            ranges[-1]["end_seconds"] = sample.elapsed_seconds
    return ranges


def calculate_heart_rate_response(activity: Any, samples: list[ActivitySample]) -> dict[str, Any]:
    base: dict[str, Any] = {
        "algorithm_version": ALGORITHM_VERSION,
        "eligible": False,
        "exclusion_reason": None,
    }
    if str(activity.sport) != "run":
        return base | {"exclusion_reason": "Only running activities are eligible."}
    if activity.elapsed_time_seconds < MINIMUM_ACTIVITY_SECONDS:
        return base | {"exclusion_reason": "Activity is shorter than 25 minutes."}
    ordered = sorted(samples, key=lambda sample: sample.elapsed_seconds)
    start_distance = getattr(activity, "heart_rate_analysis_start_distance_meters", None)
    in_window = [
        sample.elapsed_seconds >= SETTLING_SECONDS
        and (
            start_distance is None
            or (sample.distance_meters is not None and sample.distance_meters >= start_distance)
        )
        for sample in ordered
    ]
    analysis_count = sum(in_window)
    if analysis_count < 100:
        return base | {"exclusion_reason": "Insufficient samples after the warm-up."}
    valid_mask = [
        included and sample.heart_rate is not None and _is_moving(sample)
        for sample, included in zip(ordered, in_window, strict=True)
    ]
    valid = [sample for sample, keep in zip(ordered, valid_mask, strict=True) if keep]
    if len(valid) / analysis_count < MINIMUM_COVERAGE:
        return base | {"exclusion_reason": "Heart-rate or speed coverage is below 80%."}

    nominal = _nominal_interval(ordered)
    running_hours: list[float] = []
    usable_seconds = 0.0
    stopped_seconds = 0.0
    stop_count = 0
    for index, sample in enumerate(valid):
        if index:
            step = sample.elapsed_seconds - valid[index - 1].elapsed_seconds
            if step > MAX_SAMPLE_GAP_SECONDS:
                stop_count += 1
                stopped_seconds += step - nominal
                step = nominal
            usable_seconds += step
        running_hours.append(usable_seconds / 3600)
    if usable_seconds < MINIMUM_USABLE_SECONDS:
        return base | {"exclusion_reason": "Less than 20 minutes of usable running data remains."}

    grades = window_grades(ordered)
    raw_workloads = [
        grade_adjusted_speed(sample.speed_mps or 0.0, grade) if _is_moving(sample) else 0.0
        for sample, grade in zip(ordered, grades, strict=True)
    ]
    heart_rates = [float(sample.heart_rate or 0) for sample in valid]

    best: tuple[float, int, list[Row], RobustFit, list[float]] | None = None
    for response_seconds in RESPONSE_CANDIDATES_SECONDS:
        filtered = filtered_workloads(ordered, raw_workloads, response_seconds)
        workloads = [value for value, keep in zip(filtered, valid_mask, strict=True) if keep]
        rows = list(zip(workloads, running_hours, heart_rates, strict=True))
        fit = robust_regression(rows)
        if fit is None or fit.coefficients[1] < -0.1:
            continue
        rmse = sqrt(
            mean((row[2] - value) ** 2 for row, value in zip(rows, fit.predictions, strict=True))
        )
        if best is None or rmse < best[0]:
            best = rmse, response_seconds, rows, fit, workloads
    if best is None:
        return base | {"exclusion_reason": "Workload and heart-rate response could not be modeled."}
    rmse, response_seconds, rows, fit, workloads = best
    if abs(_correlation(workloads, running_hours)) > MAX_WORKLOAD_TIME_CORRELATION:
        return base | {
            "exclusion_reason": (
                "Pace or grade changed too consistently with time to separate workload "
                "from the heart-rate time trend."
            )
        }

    mean_heart_rate = mean(heart_rates)
    total_variation = sum((value - mean_heart_rate) ** 2 for value in heart_rates)
    residual_variation = sum(
        (value - prediction) ** 2
        for value, prediction in zip(heart_rates, fit.predictions, strict=True)
    )
    r_squared = max(0.0, 1 - residual_variation / total_variation) if total_variation else 0.0
    workload_mean = mean(workloads)
    workload_variability = (
        sqrt(mean((value - workload_mean) ** 2 for value in workloads)) / workload_mean
        if workload_mean
        else 0
    )
    block_length = max(1, round(BOOTSTRAP_BLOCK_SECONDS / nominal))
    lower, upper = block_bootstrap_interval(rows, fit, block_length)
    adjusted_rate = fit.coefficients[2]
    duration_hours = usable_seconds / 3600
    ranges = _analysis_ranges(valid)
    return base | {
        "eligible": True,
        "adjusted_change_bpm_per_hour": round(adjusted_rate, 2),
        "adjusted_change_lower_90_bpm_per_hour": round(lower, 2),
        "adjusted_change_upper_90_bpm_per_hour": round(upper, 2),
        "adjusted_total_change_bpm": round(adjusted_rate * duration_hours, 2),
        "response_time_constant_seconds": (
            response_seconds if workload_variability >= 0.05 else None
        ),
        "r_squared": round(r_squared, 3),
        "rmse_bpm": round(rmse, 2),
        "analysis_start_seconds": valid[0].elapsed_seconds,
        "analysis_end_seconds": valid[-1].elapsed_seconds,
        "analysis_ranges": ranges,
        "analysis_start_distance_meters": start_distance,
        "usable_duration_seconds": round(usable_seconds, 1),
        "stop_count": stop_count,
        "stopped_duration_seconds": round(stopped_seconds, 1),
        "bootstrap_resamples": BOOTSTRAP_RESAMPLES,
        "bootstrap_block_seconds": round(block_length * nominal),
        "confidence": confidence_level(usable_seconds, upper - lower),
        "interpretation": INTERPRETATION,
    }
