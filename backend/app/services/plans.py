from datetime import UTC, date, datetime

from pymongo.errors import DuplicateKeyError

from app.core.errors import ConflictError, NotFoundError
from app.models.enums import PlanStatus
from app.repositories.activities import ActivityRepository
from app.repositories.plans import PlannedSessionRepository, TrainingPlanRepository
from app.schemas.common import utc_now
from app.schemas.plans import (
    PlannedSessionCreate,
    PlannedSessionResponse,
    PlannedSessionUpdate,
    TrainingPlanCreate,
    TrainingPlanResponse,
    TrainingPlanUpdate,
)
from app.schemas.session_actions import RescheduleSessionResponse


def comparable_date(value: date | str) -> str:
    return value.isoformat() if isinstance(value, date) else value


class TrainingPlanService:
    def __init__(self, plans: TrainingPlanRepository) -> None:
        self.plans = plans

    async def create(self, payload: TrainingPlanCreate) -> TrainingPlanResponse:
        if payload.status == PlanStatus.ACTIVE and await self.plans.get_active():
            raise ConflictError("An active training plan already exists.")
        now = utc_now()
        document = payload.model_dump(mode="python") | {
            "schema_version": 1,
            "created_at_utc": now,
            "updated_at_utc": now,
            "archived_at_utc": None,
        }
        try:
            created = await self.plans.create(document)
        except DuplicateKeyError as error:
            raise ConflictError("An active training plan already exists.") from error
        return TrainingPlanResponse.model_validate(created)

    async def get(self, plan_id: str) -> TrainingPlanResponse:
        plan = await self.plans.get(plan_id)
        if not plan:
            raise NotFoundError("Training plan not found.")
        return TrainingPlanResponse.model_validate(plan)

    async def list(self, *, skip: int, limit: int) -> tuple[list[TrainingPlanResponse], int]:
        items, total = await self.plans.list(skip=skip, limit=limit)
        return [TrainingPlanResponse.model_validate(item) for item in items], total

    async def update(self, plan_id: str, payload: TrainingPlanUpdate) -> TrainingPlanResponse:
        current = await self.get(plan_id)
        changes = payload.model_dump(mode="python", exclude_unset=True)
        if changes.get("status") == PlanStatus.ACTIVE and current.status != PlanStatus.ACTIVE:
            active = await self.plans.get_active()
            if active and active["id"] != plan_id:
                raise ConflictError("An active training plan already exists.")
        if changes.get("status") == PlanStatus.ARCHIVED and current.status != PlanStatus.ARCHIVED:
            changes["archived_at_utc"] = datetime.now(UTC)
        elif changes.get("status") == PlanStatus.ACTIVE:
            changes["archived_at_utc"] = None
        try:
            updated = await self.plans.update(plan_id, changes, utc_now())
        except DuplicateKeyError as error:
            raise ConflictError("An active training plan already exists.") from error
        if not updated:
            raise NotFoundError("Training plan not found.")
        return TrainingPlanResponse.model_validate(updated)


class PlannedSessionService:
    def __init__(
        self,
        sessions: PlannedSessionRepository,
        plans: TrainingPlanRepository,
    ) -> None:
        self.sessions = sessions
        self.plans = plans

    async def create(self, payload: PlannedSessionCreate) -> PlannedSessionResponse:
        plan = await self.plans.get(payload.training_plan_id)
        if not plan:
            raise NotFoundError("Training plan not found.")
        start_date = comparable_date(plan["start_date"])
        end_date = comparable_date(plan["end_date"])
        if not (start_date <= payload.scheduled_date.isoformat() <= end_date):
            raise ConflictError("Planned session date must fall within the training plan.")
        now = utc_now()
        document = payload.model_dump(mode="python") | {
            "schema_version": 1,
            "created_at_utc": now,
            "updated_at_utc": now,
        }
        return PlannedSessionResponse.model_validate(await self.sessions.create(document))

    async def get(self, session_id: str) -> PlannedSessionResponse:
        session = await self.sessions.get(session_id)
        if not session:
            raise NotFoundError("Planned session not found.")
        return PlannedSessionResponse.model_validate(session)

    async def list_for_plan(self, plan_id: str) -> list[PlannedSessionResponse]:
        if not await self.plans.get(plan_id):
            raise NotFoundError("Training plan not found.")
        return [
            PlannedSessionResponse.model_validate(item)
            for item in await self.sessions.list_for_plan(plan_id)
        ]

    async def update(
        self, session_id: str, payload: PlannedSessionUpdate
    ) -> PlannedSessionResponse:
        current = await self.get(session_id)
        changes = payload.model_dump(mode="python", exclude_unset=True)
        if changes.get("scheduled_date"):
            plan = await self.plans.get(current.training_plan_id)
            scheduled = changes["scheduled_date"].isoformat()
            if not plan or not (
                comparable_date(plan["start_date"])
                <= scheduled
                <= comparable_date(plan["end_date"])
            ):
                raise ConflictError("Planned session date must fall within the training plan.")
        updated = await self.sessions.update(session_id, changes, utc_now())
        if not updated:
            raise NotFoundError("Planned session not found.")
        return PlannedSessionResponse.model_validate(updated)

    async def delete(self, session_id: str) -> None:
        current = await self.get(session_id)
        if current.completed_activity_id:
            raise ConflictError("Detach the completed activity before deleting this session.")
        if not await self.sessions.delete(session_id):
            raise NotFoundError("Planned session not found.")


class SessionWorkflowService:
    def __init__(
        self,
        sessions: PlannedSessionRepository,
        activities: ActivityRepository,
    ) -> None:
        self.sessions = sessions
        self.activities = activities

    async def skip(self, session_id: str, reason: str | None) -> PlannedSessionResponse:
        session = await self._session(session_id)
        if session.completed_activity_id:
            raise ConflictError("A completed session cannot be skipped.")
        updated = await self.sessions.update(
            session_id,
            {"status": "skipped", "skip_reason": reason},
            utc_now(),
        )
        return PlannedSessionResponse.model_validate(updated)

    async def unskip(self, session_id: str) -> PlannedSessionResponse:
        session = await self._session(session_id)
        if session.status != "skipped":
            raise ConflictError("Only a skipped session can be restored.")
        updated = await self.sessions.update(
            session_id,
            {"status": "planned", "skip_reason": None},
            utc_now(),
        )
        return PlannedSessionResponse.model_validate(updated)

    async def reschedule(
        self, session_id: str, scheduled_date: date, notes: str | None
    ) -> RescheduleSessionResponse:
        session = await self._session(session_id)
        if session.completed_activity_id:
            raise ConflictError("A completed session cannot be rescheduled.")
        if session.status == "rescheduled" or session.rescheduled_to_session_id:
            raise ConflictError("This session has already been rescheduled.")
        now = utc_now()
        replacement_document = session.model_dump(
            mode="python",
            exclude={"id", "created_at_utc", "updated_at_utc"},
        ) | {
            "scheduled_date": scheduled_date,
            "status": "planned",
            "completed_activity_id": None,
            "completed_on_date": None,
            "skip_reason": None,
            "reschedule_notes": notes,
            "rescheduled_from_session_id": session_id,
            "rescheduled_to_session_id": None,
            "created_at_utc": now,
            "updated_at_utc": now,
        }
        replacement = await self.sessions.create(replacement_document)
        try:
            original = await self.sessions.update(
                session_id,
                {
                    "status": "rescheduled",
                    "reschedule_notes": notes,
                    "rescheduled_to_session_id": replacement["id"],
                },
                now,
            )
        except Exception:
            await self.sessions.delete(replacement["id"])
            raise
        return RescheduleSessionResponse(
            original_session=PlannedSessionResponse.model_validate(original),
            replacement_session=PlannedSessionResponse.model_validate(replacement),
        )

    async def attach(self, session_id: str, activity_id: str) -> PlannedSessionResponse:
        session = await self._session(session_id)
        activity = await self.activities.get(activity_id)
        if not activity:
            raise NotFoundError("Activity not found.")
        if session.completed_activity_id and session.completed_activity_id != activity_id:
            raise ConflictError("The planned session is already fulfilled.")
        if activity.get("planned_session_id") and activity["planned_session_id"] != session_id:
            raise ConflictError("The activity is already linked to another planned session.")
        completed = activity["local_date"]
        scheduled = session.scheduled_date.isoformat()
        status = "completed"
        if completed > scheduled:
            status = "completed_late"
        elif completed < scheduled:
            status = "completed_early"
        now = utc_now()
        attached = await self.sessions.attach_activity(
            session_id, activity_id, completed, status, now
        )
        if not attached:
            raise ConflictError("The planned session is already fulfilled.")
        updated_activity = await self.activities.update_metadata(
            activity_id, {"planned_session_id": session_id}, now
        )
        if not updated_activity:
            await self.sessions.update(
                session_id,
                {"completed_activity_id": None, "completed_on_date": None, "status": "planned"},
                utc_now(),
            )
            raise NotFoundError("Activity not found.")
        return PlannedSessionResponse.model_validate(attached)

    async def detach(self, session_id: str) -> PlannedSessionResponse:
        session = await self._session(session_id)
        activity_id = session.completed_activity_id
        now = utc_now()
        updated = await self.sessions.update(
            session_id,
            {"completed_activity_id": None, "completed_on_date": None, "status": "planned"},
            now,
        )
        if activity_id:
            await self.activities.update_metadata(activity_id, {"planned_session_id": None}, now)
        return PlannedSessionResponse.model_validate(updated)

    async def _session(self, session_id: str) -> PlannedSessionResponse:
        document = await self.sessions.get(session_id)
        if not document:
            raise NotFoundError("Planned session not found.")
        return PlannedSessionResponse.model_validate(document)
