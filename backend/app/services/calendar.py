from app.repositories.activities import ActivityRepository
from app.repositories.plans import PlannedSessionRepository, TrainingPlanRepository
from app.schemas.calendar import CalendarEvent, CalendarResponse


class CalendarService:
    def __init__(
        self,
        activities: ActivityRepository,
        sessions: PlannedSessionRepository,
        plans: TrainingPlanRepository,
    ) -> None:
        self.activities = activities
        self.sessions = sessions
        self.plans = plans

    async def get_range(self, start_date: str, end_date: str) -> CalendarResponse:
        activities = await self.activities.list_range(start_date, end_date)
        active_plan = await self.plans.get_active()
        sessions = (
            await self.sessions.list_range_for_plan(
                start_date, end_date, training_plan_id=active_plan["id"]
            )
            if active_plan
            else []
        )
        active_session_ids = {session["id"] for session in sessions}
        for activity in activities:
            session_id = activity.get("planned_session_id")
            if not active_plan or not session_id or session_id in active_session_ids:
                continue
            linked_session = await self.sessions.get(session_id)
            if linked_session and linked_session["training_plan_id"] == active_plan["id"]:
                active_session_ids.add(session_id)
        linked_activities = {
            activity["planned_session_id"]: activity
            for activity in activities
            if activity.get("planned_session_id")
        }
        for session in sessions:
            if session.get("completed_activity_id") and session["id"] not in linked_activities:
                linked = await self.activities.get(session["completed_activity_id"])
                if linked:
                    linked_activities[session["id"]] = linked
        events = [
            CalendarEvent(
                id=f"activity:{activity['id']}",
                kind="activity",
                title=activity.get("title") or activity["sport"].title(),
                date=activity["local_date"],
                sport=activity["sport"],
                status="completed" if activity.get("planned_session_id") else "unplanned",
                distance_meters=activity.get("distance_meters"),
                completed_distance_meters=activity.get("distance_meters"),
                completed_duration_seconds=(
                    activity.get("moving_time_seconds") or activity.get("elapsed_time_seconds")
                ),
                completed_average_speed_mps=(activity.get("summary") or {}).get(
                    "average_speed_mps"
                ),
                completed_pace_seconds_per_mile=(
                    1609.344 / (activity.get("summary") or {}).get("average_speed_mps")
                    if (activity.get("summary") or {}).get("average_speed_mps")
                    else None
                ),
                planned_session_id=activity.get("planned_session_id"),
                activity_id=activity["id"],
                notes=(activity.get("subjective") or {}).get("notes"),
            )
            for activity in activities
            if activity.get("planned_session_id") not in active_session_ids
        ]
        events.extend(
            CalendarEvent(
                id=f"session:{session['id']}",
                kind="planned_session",
                title=session["title"],
                date=session["scheduled_date"],
                sport=session["sport"],
                status=session["status"],
                distance_meters=session.get("planned_distance_meters"),
                completed_distance_meters=(
                    linked_activities.get(session["id"], {}).get("distance_meters")
                ),
                completed_duration_seconds=(
                    linked_activities.get(session["id"], {}).get("moving_time_seconds")
                    or linked_activities.get(session["id"], {}).get("elapsed_time_seconds")
                ),
                completed_average_speed_mps=(
                    linked_activities.get(session["id"], {})
                    .get("summary", {})
                    .get("average_speed_mps")
                ),
                completed_pace_seconds_per_mile=(
                    1609.344
                    / linked_activities.get(session["id"], {})
                    .get("summary", {})
                    .get("average_speed_mps")
                    if linked_activities.get(session["id"], {})
                    .get("summary", {})
                    .get("average_speed_mps")
                    else None
                ),
                completed_activity_title=linked_activities.get(session["id"], {}).get("title"),
                completed_activity_notes=(
                    linked_activities.get(session["id"], {}).get("subjective") or {}
                ).get("notes"),
                planned_session_id=session["id"],
                activity_id=session.get("completed_activity_id"),
                completed_on_date=session.get("completed_on_date"),
                original_scheduled_date=session.get("original_scheduled_date"),
                instructions=session.get("instructions"),
                justification=session.get("justification"),
                skip_reason=session.get("skip_reason"),
                reschedule_notes=session.get("reschedule_notes"),
            )
            for session in sessions
        )
        return CalendarResponse(events=events)
