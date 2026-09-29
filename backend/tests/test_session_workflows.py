from copy import deepcopy
from datetime import UTC, date, datetime

import pytest

from app.services.plans import SessionWorkflowService


def session_document(**changes: object) -> dict:
    now = datetime.now(UTC)
    document = {
        "id": "session-1",
        "schema_version": 1,
        "training_plan_id": "plan-1",
        "scheduled_date": "2026-08-06",
        "original_scheduled_date": "2026-08-06",
        "sport": "run",
        "session_type": "easy",
        "title": "Easy run",
        "planned_distance_meters": 5000,
        "planned_duration_seconds": None,
        "instructions": None,
        "status": "planned",
        "completed_activity_id": None,
        "completed_on_date": None,
        "skip_reason": None,
        "reschedule_notes": None,
        "rescheduled_from_session_id": None,
        "rescheduled_to_session_id": None,
        "created_at_utc": now,
        "updated_at_utc": now,
    }
    document.update(changes)
    return document


class SessionsFake:
    def __init__(self) -> None:
        self.documents = {"session-1": session_document()}
        self.attached_status: str | None = None

    async def get(self, session_id: str) -> dict | None:
        return deepcopy(self.documents.get(session_id))

    async def update(self, session_id: str, changes: dict, updated_at: datetime) -> dict:
        self.documents[session_id].update(changes | {"updated_at_utc": updated_at})
        return deepcopy(self.documents[session_id])

    async def create(self, document: dict) -> dict:
        created = deepcopy(document) | {"id": "session-2"}
        self.documents["session-2"] = created
        return deepcopy(created)

    async def delete(self, session_id: str) -> bool:
        return self.documents.pop(session_id, None) is not None

    async def attach_activity(
        self,
        session_id: str,
        activity_id: str,
        completed_on_date: str,
        status: str,
        updated_at: datetime,
    ) -> dict:
        self.attached_status = status
        return await self.update(
            session_id,
            {
                "completed_activity_id": activity_id,
                "completed_on_date": completed_on_date,
                "status": status,
            },
            updated_at,
        )


class ActivitiesFake:
    def __init__(self) -> None:
        self.document = {
            "id": "activity-1",
            "local_date": "2026-08-07",
            "planned_session_id": None,
        }

    async def get(self, activity_id: str) -> dict | None:
        return deepcopy(self.document) if activity_id == "activity-1" else None

    async def update_metadata(
        self, _activity_id: str, changes: dict, _updated_at: datetime
    ) -> dict:
        self.document.update(changes)
        return deepcopy(self.document)


@pytest.mark.asyncio
async def test_skip_keeps_session_date_and_reason() -> None:
    sessions = SessionsFake()
    service = SessionWorkflowService(sessions, ActivitiesFake())  # type: ignore[arg-type]

    result = await service.skip("session-1", "Travel")

    assert result.status == "skipped"
    assert result.scheduled_date.isoformat() == "2026-08-06"
    assert result.skip_reason == "Travel"


@pytest.mark.asyncio
async def test_unskip_restores_planned_status_and_clears_reason() -> None:
    sessions = SessionsFake()
    sessions.documents["session-1"].update({"status": "skipped", "skip_reason": "Mistake"})
    service = SessionWorkflowService(sessions, ActivitiesFake())  # type: ignore[arg-type]

    result = await service.unskip("session-1")

    assert result.status == "planned"
    assert result.skip_reason is None


@pytest.mark.asyncio
async def test_reschedule_preserves_original_and_creates_linked_replacement() -> None:
    sessions = SessionsFake()
    service = SessionWorkflowService(sessions, ActivitiesFake())  # type: ignore[arg-type]

    result_date = date(2026, 8, 8)
    result = await service.reschedule("session-1", result_date, "Storm")

    assert result.original_session.status == "rescheduled"
    assert result.original_session.scheduled_date.isoformat() == "2026-08-06"
    assert result.replacement_session.scheduled_date == result_date
    assert result.replacement_session.original_scheduled_date.isoformat() == "2026-08-06"
    assert result.replacement_session.rescheduled_from_session_id == "session-1"


@pytest.mark.asyncio
async def test_friday_activity_completes_thursday_session_late_without_moving_dates() -> None:
    sessions = SessionsFake()
    activities = ActivitiesFake()
    service = SessionWorkflowService(sessions, activities)  # type: ignore[arg-type]

    result = await service.attach("session-1", "activity-1")

    assert result.status == "completed_late"
    assert result.scheduled_date.isoformat() == "2026-08-06"
    assert result.completed_on_date.isoformat() == "2026-08-07"
    assert activities.document["local_date"] == "2026-08-07"
    assert activities.document["planned_session_id"] == "session-1"
