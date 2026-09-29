"""Observed HR comparisons; no inferred fitness score or pace extrapolation."""

from collections import Counter, defaultdict
from datetime import date, timedelta
from math import floor, isfinite
from statistics import median
from typing import Any

from app.schemas.workload_trend import (
    WorkloadComparison,
    WorkloadRun,
    WorkloadTrend,
    WorkloadWeek,
)
from app.services.fit.models import ActivitySample

METERS_PER_MILE = 1609.344
STEADY_CATEGORIES = {"easy", "long", "recovery", "run_club"}


def steady_sections(activity: dict, samples: list[ActivitySample]) -> list[dict[str, float]]:
    """Five-minute blocks, with a preceding settling minute at the same workload.

    Evaluate actual timestamp gaps, not sample counts. Grade uses a trailing
    30-second distance/elevation window. Missing grade is never assumed flat.
    """
    ordered = sorted(samples, key=lambda sample: sample.elapsed_seconds)
    points: list[tuple[ActivitySample, float | None]] = []
    earlier_index = 0
    for index, sample in enumerate(ordered):
        while (
            earlier_index + 1 < index
            and ordered[earlier_index + 1].elapsed_seconds <= sample.elapsed_seconds - 30
        ):
            earlier_index += 1
        earlier = ordered[earlier_index]
        values = (
            sample.distance_meters,
            earlier.distance_meters,
            sample.elevation_meters,
            earlier.elevation_meters,
        )
        grade = None
        if all(value is not None and isfinite(value) for value in values):
            distance = sample.distance_meters - earlier.distance_meters
            window = sample.elapsed_seconds - earlier.elapsed_seconds
            if distance >= 20 and 25 <= window <= 40:
                grade = (sample.elevation_meters - earlier.elevation_meters) / distance
        points.append((sample, grade))

    result = []
    start_distance = activity.get("heart_rate_analysis_start_distance_meters") or 0
    for start in range(600, 3600, 300):
        block = [(s, g) for s, g in points if start - 60 <= s.elapsed_seconds <= start + 300]
        if len(block) < 2:
            continue
        # No stops, missing sensors, steep sections, distance resets, or large gaps.
        if any(
            not s.heart_rate
            or not s.speed_mps
            or not isfinite(s.speed_mps)
            or s.speed_mps < 1.5
            or g is None
            or abs(g) > 0.01
            or s.distance_meters is None
            or s.distance_meters < start_distance
            for s, g in block
        ):
            continue
        gaps = [
            b[0].elapsed_seconds - a[0].elapsed_seconds
            for a, b in zip(block, block[1:], strict=False)
        ]
        if (
            any(gap <= 0 or gap > 15 for gap in gaps)
            or block[0][0].elapsed_seconds > start - 60 + 10
            or block[-1][0].elapsed_seconds < start + 300 - 10
        ):
            continue
        typical_speed = median(s.speed_mps for s, _ in block)
        if any(abs(s.speed_mps / typical_speed - 1) > 0.10 for s, _ in block):
            continue
        # Time-weighted means on observed intervals, clipped to the analysis block.
        seconds = hr_sum = speed_sum = 0.0
        for (left, _), (right, _) in zip(block, block[1:], strict=False):
            interval_start = max(start, left.elapsed_seconds)
            interval_end = min(start + 300, right.elapsed_seconds)
            duration = max(0, interval_end - interval_start)
            if not duration:
                continue
            fraction = ((interval_start + interval_end) / 2 - left.elapsed_seconds) / (
                right.elapsed_seconds - left.elapsed_seconds
            )
            seconds += duration
            hr_sum += duration * (left.heart_rate + fraction * (right.heart_rate - left.heart_rate))
            speed_sum += duration * (left.speed_mps + fraction * (right.speed_mps - left.speed_mps))
        if seconds < 280:
            continue
        result.append(
            {
                "start": start,
                "seconds": seconds,
                "heart_rate": hr_sum / seconds,
                "pace": METERS_PER_MILE / (speed_sum / seconds),
            }
        )
    return result


def build_workload_trend(
    activities: list[dict[str, Any]],
    samples_by_activity: dict[str, list[ActivitySample]],
    start_date: date,
    end_date: date,
) -> WorkloadTrend:
    groups: dict[tuple, dict[str, list[dict]]] = defaultdict(lambda: defaultdict(list))
    exclusions: Counter[str] = Counter()
    eligible_ids: set[str] = set()
    runs = [a for a in activities if a.get("sport") == "run"]
    documents = {a["id"]: a for a in runs}
    for activity in runs:
        category = activity.get("category")
        if category not in STEADY_CATEGORIES:
            exclusions["Run category is not easy, long, recovery, or run club."] += 1
            continue
        samples = samples_by_activity.get(activity["id"], [])
        sections = steady_sections(activity, samples)
        if not sections:
            exclusions[
                "No sustained flat section with sufficient HR, speed, and elevation data."
            ] += 1
            continue
        eligible_ids.add(activity["id"])
        temperature = (activity.get("summary") or {}).get("temperature_celsius")
        temperature_band = floor(temperature / 5) * 5 if temperature is not None else None
        for section in sections:
            pace_band = floor(section["pace"] / 30 + 0.5) * 30
            time_band = int(section["start"] // 600) * 10
            key = (category, pace_band, time_band, temperature_band)
            groups[key][activity["id"]].append(section)

    comparisons = []
    for (category, pace, minute, temperature), matched in groups.items():
        entries = []
        for activity_id, sections in matched.items():
            document = documents[activity_id]
            total_seconds = sum(s["seconds"] for s in sections)
            celsius = (document.get("summary") or {}).get("temperature_celsius")
            entries.append(
                WorkloadRun(
                    activity_id=activity_id,
                    title=document.get("title"),
                    local_date=document["local_date"],
                    heart_rate_bpm=round(
                        sum(s["heart_rate"] * s["seconds"] for s in sections) / total_seconds, 1
                    ),
                    pace_seconds_per_mile=round(
                        METERS_PER_MILE
                        / (
                            sum(METERS_PER_MILE / s["pace"] * s["seconds"] for s in sections)
                            / total_seconds
                        ),
                        1,
                    ),
                    matched_minutes=round(total_seconds / 60, 1),
                    temperature_fahrenheit=round(celsius * 9 / 5 + 32, 1)
                    if celsius is not None
                    else None,
                )
            )
        entries.sort(key=lambda item: (item.local_date, item.activity_id))
        weeks: dict[date, list[float]] = defaultdict(list)
        for entry in entries:
            monday = entry.local_date - timedelta(days=entry.local_date.weekday())
            weeks[monday].append(entry.heart_rate_bpm)
        comparisons.append(
            WorkloadComparison(
                id=f"{category}:{pace}:{minute}:{temperature}",
                category=category,
                pace_seconds_per_mile=pace,
                start_minute=minute,
                end_minute=minute + 10,
                temperature_min_fahrenheit=temperature * 9 / 5 + 32
                if temperature is not None
                else None,
                temperature_max_fahrenheit=(temperature + 5) * 9 / 5 + 32
                if temperature is not None
                else None,
                runs=entries,
                weeks=[
                    WorkloadWeek(
                        week_start=week,
                        median_heart_rate_bpm=round(median(values), 1),
                        minimum_heart_rate_bpm=min(values),
                        maximum_heart_rate_bpm=max(values),
                        run_count=len(values),
                    )
                    for week, values in sorted(weeks.items())
                ],
            )
        )
    comparisons.sort(key=lambda group: (-len(group.weeks), -len(group.runs), group.id))
    return WorkloadTrend(
        start_date=start_date,
        end_date=end_date,
        runs_screened=len(runs),
        qualifying_runs=len(eligible_ids),
        exclusion_counts=dict(exclusions),
        comparisons=comparisons,
    )


def merge_workload_comparisons(
    comparisons: list[WorkloadComparison],
    start_date: date,
    end_date: date,
    runs_screened: int,
    qualifying_runs: int,
    exclusion_counts: dict[str, int],
) -> WorkloadTrend:
    """Combine bounded database batches, retaining one observation per run per group."""
    groups: dict[str, WorkloadComparison] = {}
    for comparison in comparisons:
        if comparison.id not in groups:
            groups[comparison.id] = comparison.model_copy(deep=True)
        else:
            groups[comparison.id].runs.extend(comparison.runs)
    for group in groups.values():
        group.runs.sort(key=lambda run: (run.local_date, run.activity_id))
        weekly: dict[date, list[float]] = defaultdict(list)
        for run in group.runs:
            weekly[run.local_date - timedelta(days=run.local_date.weekday())].append(
                run.heart_rate_bpm
            )
        group.weeks = [
            WorkloadWeek(
                week_start=week,
                median_heart_rate_bpm=round(median(values), 1),
                minimum_heart_rate_bpm=min(values),
                maximum_heart_rate_bpm=max(values),
                run_count=len(values),
            )
            for week, values in sorted(weekly.items())
        ]
    ordered = sorted(groups.values(), key=lambda g: (-len(g.weeks), -len(g.runs), g.id))
    return WorkloadTrend(
        start_date=start_date,
        end_date=end_date,
        runs_screened=runs_screened,
        qualifying_runs=qualifying_runs,
        exclusion_counts=exclusion_counts,
        comparisons=ordered,
    )
