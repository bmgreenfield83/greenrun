from __future__ import annotations

from app.core.errors import AppError, NotFoundError
from app.repositories.activities import ActivityRepository, ActivitySampleRepository
from app.repositories.plans import PlannedSessionRepository
from app.schemas.activities import (
    ActivityCreate,
    ActivityMetadataUpdate,
    ActivityResponse,
    ActivitySampleResponse,
)
from app.schemas.common import utc_now


class ActivityService:
    def __init__(
        self,
        activities: ActivityRepository,
        sessions: PlannedSessionRepository,
        samples: ActivitySampleRepository | None = None,
    ) -> None:
        self.activities = activities
        self.sessions = sessions
        self.samples = samples

    async def create(self, payload: ActivityCreate) -> ActivityResponse:
        if payload.planned_session_id is not None:
            raise AppError("Activity/session linking is not available until the matching workflow.")
        now = utc_now()
        document = payload.model_dump(mode="python") | {
            "schema_version": 1,
            "created_at_utc": now,
            "updated_at_utc": now,
        }
        return ActivityResponse.model_validate(await self.activities.create(document))

    async def get(self, activity_id: str) -> ActivityResponse:
        activity = await self.activities.get(activity_id)
        if not activity:
            raise NotFoundError("Activity not found.")
        return ActivityResponse.model_validate(activity)

    async def list(
        self,
        *,
        skip: int,
        limit: int,
        sport: str | None,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> tuple[list[ActivityResponse], int]:
        items, total = await self.activities.list(
            skip=skip,
            limit=limit,
            sport=sport,
            start_date=start_date,
            end_date=end_date,
        )
        return [ActivityResponse.model_validate(item) for item in items], total

    async def update_metadata(
        self, activity_id: str, payload: ActivityMetadataUpdate
    ) -> ActivityResponse:
        current = await self.get(activity_id)
        changes = payload.model_dump(mode="python", exclude_unset=True)
        if (
            "planned_session_id" in changes
            and changes["planned_session_id"] != current.planned_session_id
        ):
            raise AppError("Use the planned-session matching workflow to change activity links.")
        if changes.get("category") is not None and current.sport != "run":
            raise AppError("Category is only valid for running activities.")
        if "heart_rate_analysis_start_distance_meters" in changes:
            start_distance = changes["heart_rate_analysis_start_distance_meters"]
            if current.sport != "run":
                raise AppError("Heart-rate analysis overrides are only valid for runs.")
            if (
                start_distance is not None
                and current.distance_meters is not None
                and start_distance >= current.distance_meters
            ):
                raise AppError("The HR analysis start must be before the end of the run.")
        if payload.subjective is not None:
            changes["subjective"] = current.subjective.model_dump(
                mode="python"
            ) | payload.subjective.model_dump(mode="python", exclude_unset=True)
        updated = await self.activities.update_metadata(activity_id, changes, utc_now())
        if not updated:
            raise NotFoundError("Activity not found.")
        return ActivityResponse.model_validate(updated)

    async def delete(self, activity_id: str) -> None:
        await self.get(activity_id)
        now = utc_now()
        await self.sessions.detach_activity(activity_id, now)
        if not await self.activities.delete(activity_id):
            raise NotFoundError("Activity not found.")

    async def get_samples(self, activity_id: str) -> list[ActivitySampleResponse]:
        await self.get(activity_id)
        if self.samples is None:
            return []
        chunks = await self.samples.list_for_activity(activity_id)
        values = [sample for chunk in chunks for sample in chunk.get("samples", [])]
        values.sort(key=lambda sample: sample["elapsed_seconds"])
        return [ActivitySampleResponse.model_validate(sample) for sample in values]
