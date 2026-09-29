"""Weekly running volume and active-plan progress.

Definitions (see docs/analytics.md):

- Weeks are Monday-Sunday calendar weeks. Plan week numbers count from the Monday of the week that
  contains the plan start date, so plans that start mid-week still begin at week 1.
- A plan week's planned miles are its declared `planned_running_miles`, or the sum of its planned
  run-session distances when no weekly figure was declared.
- A session is *due* when it is scheduled on or before the as-of date, or has already been
  completed. Superseded (`rescheduled`) sessions are ignored.
- Planned miles to date = sum over plan weeks of (week planned miles x the share of that week's
  planned run-session distance that is due). Fully elapsed weeks therefore count in full, future
  weeks not at all, and the current week in proportion to its due sessions.
- Completed miles count only run activities linked to one of the plan's sessions.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any

from app.schemas.analytics import HighestWeek, PlanProgress, WeeklyVolumeWeek

METERS_PER_MILE = 1609.344
WEEKLY_VOLUME_WEEKS = 16
WEEKLY_INCREASE_THRESHOLD = 0.15
SUPERSEDED_STATUS = "rescheduled"


def monday_of(value: date) -> date:
    return value - timedelta(days=value.weekday())


def _miles(meters: float | None) -> float:
    return (meters or 0) / METERS_PER_MILE


def weekly_miles(runs: list[dict[str, Any]]) -> tuple[dict[date, float], dict[date, int]]:
    miles: dict[date, float] = {}
    counts: dict[date, int] = {}
    for run in runs:
        monday = monday_of(date.fromisoformat(str(run["local_date"])))
        miles[monday] = miles.get(monday, 0.0) + _miles(run.get("distance_meters"))
        counts[monday] = counts.get(monday, 0) + 1
    return miles, counts


@dataclass
class PlanWeek:
    number: int
    start: date
    declared_miles: float | None
    sessions: list[dict[str, Any]] = field(default_factory=list)

    @property
    def run_sessions(self) -> list[dict[str, Any]]:
        return [item for item in self.sessions if item.get("sport") == "run"]

    @property
    def planned_miles(self) -> float:
        if self.declared_miles is not None:
            return float(self.declared_miles)
        return sum(_miles(item.get("planned_distance_meters")) for item in self.run_sessions)

    def due_fraction(self, as_of: date) -> float:
        if as_of >= self.start + timedelta(days=6):
            return 1.0
        runs = self.run_sessions
        due = [item for item in runs if is_due(item, as_of)]
        total_distance = sum(item.get("planned_distance_meters") or 0 for item in runs)
        if total_distance > 0:
            return sum(item.get("planned_distance_meters") or 0 for item in due) / total_distance
        if runs:
            return len(due) / len(runs)
        # No run sessions to apportion by: fall back to elapsed days of the week.
        return max(0.0, min(1.0, ((as_of - self.start).days + 1) / 7))


def is_completed(session: dict[str, Any]) -> bool:
    return str(session.get("status", "")).startswith("completed")


def is_due(session: dict[str, Any], as_of: date) -> bool:
    return str(session["scheduled_date"]) <= as_of.isoformat() or is_completed(session)


def plan_weeks(plan: dict[str, Any], sessions: list[dict[str, Any]]) -> list[PlanWeek]:
    first_monday = monday_of(date.fromisoformat(str(plan["start_date"])))
    last_monday = monday_of(date.fromisoformat(str(plan["end_date"])))
    declared = {
        item.get("week_number"): item.get("planned_running_miles")
        for item in plan.get("week_summaries") or []
    }
    count = (last_monday - first_monday).days // 7 + 1
    weeks = [
        PlanWeek(
            number=index + 1,
            start=first_monday + timedelta(weeks=index),
            declared_miles=declared.get(index + 1),
        )
        for index in range(count)
    ]
    for session in sessions:
        if session.get("status") == SUPERSEDED_STATUS:
            continue
        index = (monday_of(date.fromisoformat(str(session["scheduled_date"]))) - first_monday).days
        if 0 <= index // 7 < count:
            weeks[index // 7].sessions.append(session)
    return weeks


def weekly_volume(
    runs: list[dict[str, Any]], today: date, planned_by_week: dict[date, float]
) -> list[WeeklyVolumeWeek]:
    miles, counts = weekly_miles(runs)
    current = monday_of(today)
    first_week = min(miles) if miles else current
    result: list[WeeklyVolumeWeek] = []
    for offset in range(WEEKLY_VOLUME_WEEKS - 1, -1, -1):
        week = current - timedelta(weeks=offset)
        partial = week == current
        value = miles.get(week, 0.0)
        prior_weeks = [week - timedelta(weeks=step) for step in range(1, 5)]
        prior = (
            sum(miles.get(item, 0.0) for item in prior_weeks) / 4
            if prior_weeks[-1] >= first_week
            else None
        )
        trailing_weeks = [week - timedelta(weeks=step) for step in range(4)]
        trailing = (
            sum(miles.get(item, 0.0) for item in trailing_weeks) / 4
            if not partial and trailing_weeks[-1] >= first_week
            else None
        )
        planned = planned_by_week.get(week)
        result.append(
            WeeklyVolumeWeek(
                week_start=week,
                week_end=week + timedelta(days=6),
                miles=round(value, 2),
                run_count=counts.get(week, 0),
                is_partial=partial,
                planned_miles=round(planned, 2) if planned is not None else None,
                trailing_4_week_average_miles=round(trailing, 2) if trailing is not None else None,
                prior_4_week_average_miles=round(prior, 2) if prior is not None else None,
                exceeds_prior_average=bool(
                    not partial and prior and value > prior * (1 + WEEKLY_INCREASE_THRESHOLD)
                ),
            )
        )
    return result


def highest_week(runs: list[dict[str, Any]]) -> HighestWeek | None:
    miles, _counts = weekly_miles(runs)
    if not miles:
        return None
    week, value = max(miles.items(), key=lambda item: (item[1], item[0]))
    return HighestWeek(week_start=week, miles=round(value, 2))


def plan_progress(
    plan: dict[str, Any],
    weeks: list[PlanWeek],
    runs_by_id: dict[str, dict[str, Any]],
    today: date,
) -> PlanProgress:
    end_date = date.fromisoformat(str(plan["end_date"]))
    as_of = min(today, end_date)
    sessions = [session for week in weeks for session in week.sessions]
    due = [session for session in sessions if is_due(session, as_of)]
    linked = [
        runs_by_id[str(session["completed_activity_id"])]
        for session in sessions
        if session.get("completed_activity_id")
        and str(session["completed_activity_id"]) in runs_by_id
    ]
    current_monday = monday_of(today)
    current = next((week for week in weeks if week.start == current_monday), None)
    current_completed = (
        sum(
            _miles(run.get("distance_meters"))
            for run in linked
            if current.start.isoformat()
            <= str(run["local_date"])
            <= (current.start + timedelta(days=6)).isoformat()
        )
        if current
        else None
    )
    return PlanProgress(
        plan_id=plan["id"],
        plan_name=plan["name"],
        start_date=plan["start_date"],
        end_date=plan["end_date"],
        total_weeks=len(weeks),
        current_week_number=current.number if current else None,
        total_planned_miles=round(sum(week.planned_miles for week in weeks), 2),
        planned_miles_to_date=round(
            sum(week.planned_miles * week.due_fraction(as_of) for week in weeks), 2
        ),
        completed_miles_to_date=round(sum(_miles(run.get("distance_meters")) for run in linked), 2),
        total_sessions=len(sessions),
        sessions_due_to_date=len(due),
        sessions_completed_to_date=sum(1 for session in due if is_completed(session)),
        sessions_skipped_to_date=sum(1 for session in due if session.get("status") == "skipped"),
        current_week_planned_miles=round(current.planned_miles, 2) if current else None,
        current_week_planned_miles_to_date=(
            round(current.planned_miles * current.due_fraction(as_of), 2) if current else None
        ),
        current_week_completed_miles=(
            round(current_completed, 2) if current_completed is not None else None
        ),
    )
