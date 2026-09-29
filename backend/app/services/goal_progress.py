"""Goal-card helpers for the active plan's structured `goal_target` ("time at a distance").

Nothing here is specific to a distance: the goal distance drives best-effort windows and the
goal pace drives the track-rep comparison.

- Weeks run Monday-Sunday from 12 weeks before the Monday of the plan's start week through the
  plan's last week. Each week's best effort at the goal distance is the fastest exact-distance
  window in samples or exact-distance lap (see `best_efforts`), elapsed time.
- Track reps: laps of track-category runs whose distance is 200-1600 m (2% tolerance), with pace
  from lap elapsed time. Without workout-step data, a lap counts as a work rep when its pace is
  within 15% of the session's fastest such lap and no more than 60% slower than goal pace; this
  separates reps from recovery jogs and warm-up laps. Laps at or faster than goal pace always
  count. When the watch labeled the laps (lap `intensity`, recorded for imports from 2026-09-29),
  the labels decide instead: active/interval laps are reps; warm-up, rest, recovery and cool-down
  laps are not.
"""

from __future__ import annotations

from datetime import date, timedelta

from app.services.best_efforts import BEST_EFFORT_DISTANCES

METERS_PER_MILE = 1609.344
LEAD_IN_WEEKS = 12
REP_MIN_METERS = 200.0
REP_MAX_METERS = 1600.0
REP_DISTANCE_TOLERANCE = 0.02
REP_SESSION_PACE_TOLERANCE = 1.15
REP_GOAL_PACE_LIMIT = 1.6
TRACK_CATEGORY = "track"


def monday_of(value: date) -> date:
    return value - timedelta(days=value.weekday())


def goal_weeks(start_date: date, end_date: date) -> list[date]:
    first = monday_of(start_date) - timedelta(weeks=LEAD_IN_WEEKS)
    last = monday_of(end_date)
    return [first + timedelta(weeks=index) for index in range((last - first).days // 7 + 1)]


def distance_label(distance_meters: float) -> str:
    for label, distance in BEST_EFFORT_DISTANCES:
        if abs(distance - distance_meters) <= 1:
            return label
    miles = distance_meters / METERS_PER_MILE
    if abs(miles - round(miles)) < 0.005:
        count = round(miles)
        return f"{count} mile" if count == 1 else f"{count} miles"
    if distance_meters >= 1000:
        return f"{distance_meters / 1000:g} km"
    return f"{distance_meters:g} m"


def is_rep_distance(distance_meters: float | None) -> bool:
    return distance_meters is not None and REP_MIN_METERS * (
        1 - REP_DISTANCE_TOLERANCE
    ) <= distance_meters <= REP_MAX_METERS * (1 + REP_DISTANCE_TOLERANCE)


def pace_per_mile(seconds: float, distance_meters: float) -> float:
    return seconds / distance_meters * METERS_PER_MILE


# Lap intensities the watch records for the work part of a structured workout.
WORK_INTENSITIES = {"active", "interval"}


def has_workout_labels(laps: list[dict]) -> bool:
    """True when the watch labeled this session's laps (imports from 2026-09-29 on)."""
    return any(lap.get("intensity") for lap in laps)


def counts_as_labeled_rep(lap: dict) -> bool:
    return lap.get("intensity") in WORK_INTENSITIES


def counts_as_rep(pace: float, fastest_session_pace: float, goal_pace: float) -> bool:
    """Heuristic work-rep test; a lap at or faster than goal pace always counts."""
    return pace <= goal_pace or (
        pace <= fastest_session_pace * REP_SESSION_PACE_TOLERANCE
        and pace <= goal_pace * REP_GOAL_PACE_LIMIT
    )
