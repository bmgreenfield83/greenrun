from __future__ import annotations

from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from statistics import mean
from typing import Any

from app.repositories.activities import ActivityRepository, ActivitySampleRepository
from app.repositories.plans import PlannedSessionRepository, TrainingPlanRepository
from app.services.analytics import METERS_PER_MILE
from app.services.fit.models import ActivitySample

GPS_KEYS = {"latitude", "longitude", "lat", "lon", "position_lat", "position_long"}


def without_gps(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: without_gps(item)
            for key, item in value.items()
            if key.lower() not in GPS_KEYS
            and "latitude" not in key.lower()
            and "longitude" not in key.lower()
        }
    if isinstance(value, list):
        return [without_gps(item) for item in value]
    return value


def smooth_samples(samples: list[ActivitySample], interval_seconds: int) -> list[dict[str, Any]]:
    groups: dict[int, list[ActivitySample]] = defaultdict(list)
    for sample in samples:
        groups[int(sample.elapsed_seconds // interval_seconds) * interval_seconds].append(sample)

    def average(items: list[ActivitySample], field: str) -> float | None:
        values = [getattr(item, field) for item in items if getattr(item, field) is not None]
        return round(mean(values), 2) if values else None

    result = []
    for elapsed, items in sorted(groups.items()):
        speed = average(items, "speed_mps")
        distance = next(
            (item.distance_meters for item in reversed(items) if item.distance_meters is not None),
            None,
        )
        result.append(
            {
                "elapsed_seconds": elapsed,
                "distance_miles": round(distance / METERS_PER_MILE, 4)
                if distance is not None
                else None,
                "average_heart_rate": average(items, "heart_rate"),
                "average_pace_seconds_per_mile": round(METERS_PER_MILE / speed, 1)
                if speed
                else None,
                "average_cadence_spm": average(items, "cadence_spm"),
                "elevation_feet": round(value * 3.28084, 1)
                if (value := average(items, "elevation_meters")) is not None
                else None,
                "temperature_fahrenheit": round(value * 9 / 5 + 32, 1)
                if (value := average(items, "temperature_celsius")) is not None
                else None,
            }
        )
    return result


class ExportService:
    def __init__(
        self,
        activities: ActivityRepository,
        samples: ActivitySampleRepository,
        plans: TrainingPlanRepository,
        sessions: PlannedSessionRepository,
    ) -> None:
        self.activities, self.samples, self.plans, self.sessions = (
            activities,
            samples,
            plans,
            sessions,
        )

    @staticmethod
    def metadata(export_type: str) -> dict[str, Any]:
        return {
            "schema_version": "1.0",
            "export_type": export_type,
            "generated_at": datetime.now(UTC).isoformat(),
            "units": "imperial_display_with_canonical_source_values",
            "gps_included": False,
        }

    async def _samples(self, activity_id: str, interval: int) -> list[dict[str, Any]]:
        chunks = await self.samples.list_for_activity(activity_id)
        points = [
            ActivitySample.model_validate(sample)
            for chunk in chunks
            for sample in chunk.get("samples", [])
        ]
        return smooth_samples(points, interval)

    @staticmethod
    def _activity(document: dict[str, Any]) -> dict[str, Any]:
        item = without_gps(document)
        speed = (item.get("summary") or {}).get("average_speed_mps")
        item["display"] = {
            "distance_miles": round((item.get("distance_meters") or 0) / METERS_PER_MILE, 2),
            "average_pace_seconds_per_mile": round(METERS_PER_MILE / speed, 1) if speed else None,
        }
        return item

    @staticmethod
    def _personal_bests(activities: list[dict[str, Any]]) -> list[dict[str, Any]]:
        runs = [item for item in activities if item.get("sport") == "run"]
        results: list[dict[str, Any]] = []
        if runs:
            longest = max(runs, key=lambda item: item.get("distance_meters") or 0)
            results.append(
                {
                    "label": "Longest run",
                    "activity_id": longest["id"],
                    "distance_miles": round(
                        (longest.get("distance_meters") or 0) / METERS_PER_MILE, 2
                    ),
                }
            )
        for label, low, high in (("Fastest 5K", 4900, 5200), ("Fastest 10K", 9800, 10400)):
            candidates = [
                item for item in runs if low <= (item.get("distance_meters") or 0) <= high
            ]
            if candidates:
                best = min(
                    candidates,
                    key=lambda item: (
                        item.get("moving_time_seconds") or item["elapsed_time_seconds"]
                    ),
                )
                results.append(
                    {
                        "label": label,
                        "activity_id": best["id"],
                        "time_seconds": best.get("moving_time_seconds")
                        or best["elapsed_time_seconds"],
                    }
                )
        return results

    @staticmethod
    def _comparable_groups(activities: list[dict[str, Any]]) -> list[dict[str, Any]]:
        groups: dict[tuple[str, int], list[dict[str, Any]]] = defaultdict(list)
        for item in activities:
            if item.get("sport") == "run" and item.get("distance_meters"):
                key = (
                    item.get("category") or "uncategorized",
                    round(item["distance_meters"] / METERS_PER_MILE),
                )
                groups[key].append(item)
        return [
            {
                "category": category,
                "approximate_distance_miles": distance,
                "activity_count": len(items),
                "activity_ids": [item["id"] for item in items],
            }
            for (category, distance), items in groups.items()
            if len(items) > 1
        ]

    async def activity_export(self, activity_id: str) -> dict[str, Any] | None:
        activity = await self.activities.get(activity_id)
        if not activity:
            return None
        day = date.fromisoformat(activity["local_date"])
        prior = await self.activities.list_range(
            (day - timedelta(days=90)).isoformat(), day.isoformat()
        )
        session = (
            await self.sessions.get(activity["planned_session_id"])
            if activity.get("planned_session_id")
            else None
        )

        def miles(days: int) -> float:
            return round(
                sum(
                    (item.get("distance_meters") or 0) / METERS_PER_MILE
                    for item in prior
                    if item.get("sport") == "run"
                    and date.fromisoformat(item["local_date"]) >= day - timedelta(days=days)
                ),
                2,
            )

        return self.metadata("activity") | {
            "activity": self._activity(activity),
            "planned_session": without_gps(session),
            "training_context": {
                "running_miles_previous_7_days": miles(7),
                "running_miles_previous_28_days": miles(28),
                "running_miles_previous_90_days": miles(90),
            },
            "samples": await self._samples(activity_id, 5),
        }

    async def range_export(
        self,
        start: date,
        end: date,
        scope: str,
        *,
        include_all_activities: bool = False,
    ) -> dict[str, Any] | None:
        activities = await self.activities.list_range(
            start.isoformat(), (end + timedelta(days=1)).isoformat()
        )
        if not include_all_activities:
            activities = [item for item in activities if item.get("sport") == "run"]
        if not activities:
            return None
        interval = 15 if scope == "week" else 30
        exported = []
        for activity in activities:
            exported.append(
                self._activity(activity)
                | {"samples": await self._samples(activity["id"], interval)}
            )
        return self.metadata(scope) | {
            "date_range": {"start": start, "end": end},
            "activities": exported,
            "planned_sessions": without_gps(
                await self.sessions.list_range(
                    start.isoformat(), (end + timedelta(days=1)).isoformat()
                )
            ),
        }

    async def plan_template(self, plan_id: str) -> dict[str, Any] | None:
        plan = await self.plans.get(plan_id)
        if not plan:
            return None
        sessions = await self.sessions.list_for_plan(plan_id)
        start = date.fromisoformat(plan["start_date"])
        weeks: dict[int, dict[str, Any]] = {}
        summaries = {item["week_number"]: item for item in plan.get("week_summaries", [])}
        for session in sessions:
            scheduled = date.fromisoformat(session["scheduled_date"])
            number = (scheduled - start).days // 7 + 1
            week = weeks.setdefault(
                number,
                {
                    "week_number": number,
                    "focus": summaries.get(number, {}).get("focus"),
                    "planned_running_miles": summaries.get(number, {}).get("planned_running_miles"),
                    "sessions": [],
                },
            )
            week["sessions"].append(
                {
                    "day_of_week": scheduled.strftime("%A").lower(),
                    "scheduled_date": scheduled,
                    "sport": session["sport"],
                    "session_type": session["session_type"],
                    "title": session["title"],
                    "planned_distance_miles": round(
                        session["planned_distance_meters"] / METERS_PER_MILE, 3
                    )
                    if session.get("planned_distance_meters") is not None
                    else None,
                    "planned_duration_minutes": round(session["planned_duration_seconds"] / 60, 1)
                    if session.get("planned_duration_seconds") is not None
                    else None,
                    "instructions": session.get("instructions"),
                    "justification": session.get("justification"),
                }
            )
        return {
            "schema_version": "1.0",
            "name": plan["name"],
            "description": plan.get("description"),
            "primary_goal": plan.get("primary_goal"),
            "secondary_goal": plan.get("secondary_goal"),
            "start_date": start,
            "week_starts_on": "monday",
            "weeks": list(weeks.values()),
        }

    async def plan_analysis(
        self, plan_id: str, *, include_all_activities: bool = False
    ) -> dict[str, Any] | None:
        plan = await self.plans.get(plan_id)
        if not plan:
            return None
        sessions = await self.sessions.list_for_plan(plan_id)
        start, end = date.fromisoformat(plan["start_date"]), date.fromisoformat(plan["end_date"])
        activities = await self.activities.list_range(
            start.isoformat(), (end + timedelta(days=1)).isoformat()
        )
        if not include_all_activities:
            activities = [item for item in activities if item.get("sport") == "run"]
        exported = []
        for activity in activities:
            exported.append(
                self._activity(activity) | {"samples": await self._samples(activity["id"], 30)}
            )
        weekly = []
        for number in range(1, ((end - start).days // 7) + 2):
            week_start, week_end = (
                start + timedelta(days=(number - 1) * 7),
                start + timedelta(days=number * 7 - 1),
            )
            week_sessions = [
                item
                for item in sessions
                if week_start.isoformat() <= item["scheduled_date"] <= week_end.isoformat()
            ]
            week_activities = [
                item
                for item in activities
                if week_start.isoformat() <= item["local_date"] <= week_end.isoformat()
            ]
            efforts = [(item.get("subjective") or {}).get("effort") for item in week_activities]
            heart_rates = [
                (item.get("summary") or {}).get("average_heart_rate") for item in week_activities
            ]
            weekly.append(
                {
                    "week_number": number,
                    "planned_running_miles": round(
                        sum(
                            (item.get("planned_distance_meters") or 0) / METERS_PER_MILE
                            for item in week_sessions
                            if item.get("sport") == "run"
                        ),
                        2,
                    ),
                    "completed_running_miles": round(
                        sum(
                            (item.get("distance_meters") or 0) / METERS_PER_MILE
                            for item in week_activities
                            if item.get("sport") == "run"
                        ),
                        2,
                    ),
                    "completed_sessions": sum(
                        1
                        for item in week_sessions
                        if str(item.get("status", "")).startswith("completed")
                    ),
                    "skipped_sessions": sum(
                        1 for item in week_sessions if item.get("status") == "skipped"
                    ),
                    "rescheduled_sessions": sum(
                        1 for item in week_sessions if item.get("status") == "rescheduled"
                    ),
                    "average_effort": round(
                        mean(value for value in efforts if value is not None), 1
                    )
                    if any(value is not None for value in efforts)
                    else None,
                    "average_heart_rate": round(
                        mean(value for value in heart_rates if value is not None), 1
                    )
                    if any(value is not None for value in heart_rates)
                    else None,
                    "valid_heart_rate_response_results": [
                        (item.get("derived_metrics") or {}).get("heart_rate_response")
                        for item in week_activities
                        if (item.get("derived_metrics") or {})
                        .get("heart_rate_response", {})
                        .get("eligible")
                    ],
                }
            )
        planned = sum(item["planned_running_miles"] for item in weekly)
        completed = sum(item["completed_running_miles"] for item in weekly)
        return self.metadata("training_plan_analysis") | {
            "plan": without_gps(plan),
            "planned_sessions": without_gps(sessions),
            "activities": exported,
            "weekly_summaries": weekly,
            "plan_summary": {
                "planned_running_miles": round(planned, 2),
                "completed_running_miles": round(completed, 2),
                "completion_percent": round(completed / planned * 100, 1) if planned else None,
                "completed_sessions": sum(item["completed_sessions"] for item in weekly),
                "skipped_sessions": sum(item["skipped_sessions"] for item in weekly),
                "rescheduled_sessions": sum(item["rescheduled_sessions"] for item in weekly),
                "personal_bests": self._personal_bests(activities),
            },
            "trend_metrics": {
                "rolling_mileage": [
                    {
                        "week_number": item["week_number"],
                        "completed_running_miles": item["completed_running_miles"],
                    }
                    for item in weekly
                ],
                "heart_rate_response": [
                    result
                    for item in weekly
                    for result in item["valid_heart_rate_response_results"]
                ],
                "comparable_run_groups": self._comparable_groups(activities),
            },
        }
