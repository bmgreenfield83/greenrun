from datetime import date, timedelta

from app.core.errors import ConflictError
from app.repositories.plans import PlannedSessionRepository, TrainingPlanRepository
from app.schemas.common import utc_now
from app.schemas.plan_imports import (
    DAY_OFFSETS,
    PlanImportConfirmRequest,
    PlanImportConfirmResponse,
    PlanImportConflict,
    PlanImportPreviewRequest,
    PlanImportPreviewResponse,
    monday_of_week,
)
from app.services.plan_imports.cache import (
    PLAN_PREVIEW_TTL_SECONDS,
    PlanPreviewCache,
    PlanPreviewEntry,
)


class PlanImportService:
    def __init__(
        self,
        cache: PlanPreviewCache,
        plans: TrainingPlanRepository,
        sessions: PlannedSessionRepository,
    ) -> None:
        self.cache = cache
        self.plans = plans
        self.sessions = sessions

    async def preview(self, request: PlanImportPreviewRequest) -> PlanImportPreviewResponse:
        template = request.template
        dated_session = next(
            (
                (week, session)
                for week in template.weeks
                for session in week.sessions
                if session.scheduled_date is not None
            ),
            None,
        )
        if request.start_date is not None:
            start_date = monday_of_week(request.start_date)
        elif template.start_date is not None:
            start_date = monday_of_week(template.start_date)
        elif dated_session is not None:
            week, session = dated_session
            start_date = session.scheduled_date - timedelta(
                days=(week.week_number - 1) * 7 + DAY_OFFSETS[session.day_of_week]
            )
        else:
            today = date.today()
            start_date = today - timedelta(days=today.weekday())
        end_date = start_date + timedelta(
            days=max(week.week_number for week in template.weeks) * 7 - 1
        )
        resolved: list[dict] = []
        session_miles = 0.0
        for week in template.weeks:
            for session in week.sessions:
                scheduled = session.scheduled_date or start_date + timedelta(
                    days=(week.week_number - 1) * 7 + DAY_OFFSETS[session.day_of_week]
                )
                distance_meters = (
                    session.planned_distance_miles * 1609.344
                    if session.planned_distance_miles is not None
                    else None
                )
                if session.sport == "run" and session.planned_distance_miles:
                    session_miles += session.planned_distance_miles
                resolved.append(
                    {
                        "scheduled_date": scheduled,
                        "original_scheduled_date": scheduled,
                        "sport": session.sport,
                        "session_type": session.session_type,
                        "title": session.title,
                        "planned_distance_meters": distance_meters,
                        "planned_duration_seconds": (
                            session.planned_duration_minutes * 60
                            if session.planned_duration_minutes is not None
                            else None
                        ),
                        "instructions": session.instructions,
                        "justification": session.justification,
                        "status": "planned",
                        "completed_activity_id": None,
                        "completed_on_date": None,
                        "skip_reason": None,
                        "reschedule_notes": None,
                        "rescheduled_from_session_id": None,
                        "rescheduled_to_session_id": None,
                    }
                )

        declared_week_miles = [week.planned_running_miles for week in template.weeks]
        total_miles = (
            sum(miles for miles in declared_week_miles if miles is not None)
            if all(miles is not None for miles in declared_week_miles)
            else session_miles
        )
        active = await self.plans.get_active()
        conflict = None
        if active:
            overlap = (
                start_date.isoformat() <= active["end_date"]
                and end_date.isoformat() >= active["start_date"]
            )
            conflict = PlanImportConflict(
                active_plan_id=active["id"],
                active_plan_name=active["name"],
                active_start_date=active["start_date"],
                active_end_date=active["end_date"],
                dates_overlap=overlap,
            )
        token = self.cache.put(
            PlanPreviewEntry(
                template=template,
                start_date=start_date.isoformat(),
                end_date=end_date.isoformat(),
                sessions=resolved,
                conflict=conflict,
                expires_at=0,
            )
        )
        return PlanImportPreviewResponse(
            preview_token=token,
            expires_in_seconds=PLAN_PREVIEW_TTL_SECONDS,
            name=template.name,
            number_of_weeks=len(template.weeks),
            start_date=start_date,
            end_date=end_date,
            planned_session_count=len(resolved),
            total_planned_running_miles=round(total_miles, 2),
            conflict=conflict,
        )

    async def confirm(self, request: PlanImportConfirmRequest) -> PlanImportConfirmResponse:
        entry = self.cache.get(request.preview_token)
        current_active = await self.plans.get_active()
        if current_active and not request.replace_active_plan:
            raise ConflictError("An active plan exists. Confirm replacement or cancel the import.")
        now = utc_now()
        archived_plan_id = None
        if current_active:
            archived_plan_id = current_active["id"]
            await self.plans.update(
                archived_plan_id,
                {"status": "archived", "archived_at_utc": now},
                now,
            )
        plan_document = {
            "schema_version": 1,
            "name": entry.template.name,
            "description": entry.template.description,
            "primary_goal": entry.template.primary_goal,
            "secondary_goal": entry.template.secondary_goal,
            "status": "active",
            "start_date": date.fromisoformat(entry.start_date),
            "end_date": date.fromisoformat(entry.end_date),
            "week_starts_on": "monday",
            "source": {"type": "json_import", "imported_at_utc": now},
            "week_summaries": [
                {
                    "week_number": week.week_number,
                    "focus": week.focus,
                    "planned_running_miles": week.planned_running_miles,
                }
                for week in entry.template.weeks
            ],
            "created_at_utc": now,
            "updated_at_utc": now,
            "archived_at_utc": None,
        }
        created_plan = None
        try:
            created_plan = await self.plans.create(plan_document)
            session_documents = [
                session
                | {
                    "schema_version": 1,
                    "training_plan_id": created_plan["id"],
                    "created_at_utc": now,
                    "updated_at_utc": now,
                }
                for session in entry.sessions
            ]
            created_session_ids = await self.sessions.create_many(session_documents)
        except Exception:
            if created_plan:
                await self.sessions.delete_for_plan(created_plan["id"])
                await self.plans.delete(created_plan["id"])
            if archived_plan_id:
                await self.plans.update(
                    archived_plan_id,
                    {"status": "active", "archived_at_utc": None},
                    utc_now(),
                )
            raise
        self.cache.remove(request.preview_token)
        return PlanImportConfirmResponse(
            training_plan_id=created_plan["id"],
            sessions_created=len(created_session_ids),
            archived_plan_id=archived_plan_id,
        )
