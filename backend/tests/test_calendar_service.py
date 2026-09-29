from datetime import date

import pytest

from app.services.calendar import CalendarService


class ActivitiesFake:
    async def list_range(self, start_date: str, end_date: str) -> list[dict]:
        assert (start_date, end_date) == ("2026-08-02", "2026-08-09")
        return [
            {
                "id": "activity-1",
                "title": "Friday run",
                "sport": "run",
                "local_date": "2026-08-07",
                "distance_meters": 5000,
                "moving_time_seconds": 1600,
                "summary": {"average_speed_mps": 3.0},
                "planned_session_id": "session-1",
                "subjective": {"notes": "Felt good"},
            }
        ]


class SessionsFake:
    async def list_range_for_plan(
        self, start_date: str, end_date: str, *, training_plan_id: str
    ) -> list[dict]:
        assert (start_date, end_date) == ("2026-08-02", "2026-08-09")
        assert training_plan_id == "plan-1"
        return [
            {
                "id": "session-1",
                "title": "Thursday run",
                "sport": "run",
                "scheduled_date": "2026-08-06",
                "status": "completed_late",
                "planned_distance_meters": 4800,
                "completed_activity_id": "activity-1",
                "completed_on_date": "2026-08-07",
                "instructions": "Warm up, then run five controlled intervals.",
                "justification": "Develop speed while supporting the plan goal.",
            }
        ]


class PlansFake:
    async def get_active(self) -> dict:
        return {"id": "plan-1", "status": "active"}


@pytest.mark.asyncio
async def test_calendar_consolidates_linked_activity_into_planned_session() -> None:
    service = CalendarService(ActivitiesFake(), SessionsFake(), PlansFake())  # type: ignore[arg-type]

    response = await service.get_range("2026-08-02", "2026-08-09")

    assert [(event.kind, event.date) for event in response.events] == [
        ("planned_session", date(2026, 8, 6)),
    ]
    event = response.events[0]
    assert event.status == "completed_late"
    assert event.instructions == "Warm up, then run five controlled intervals."
    assert event.justification == "Develop speed while supporting the plan goal."
    assert event.completed_on_date == date(2026, 8, 7)
    assert event.completed_distance_meters == 5000
    assert event.completed_duration_seconds == 1600
    assert event.completed_average_speed_mps == 3.0
    assert event.completed_activity_title == "Friday run"
    assert event.completed_activity_notes == "Felt good"
    assert event.completed_pace_seconds_per_mile == pytest.approx(536.45, abs=0.01)


class ArchivedActivityFake:
    async def list_range(self, _start_date: str, _end_date: str) -> list[dict]:
        return [
            {
                "id": "activity-old",
                "title": "Completed old-plan run",
                "sport": "run",
                "local_date": "2026-08-07",
                "distance_meters": 5000,
                "moving_time_seconds": 1600,
                "summary": {"average_speed_mps": 3.0},
                "planned_session_id": "archived-session",
            }
        ]


class ActiveSessionsFake:
    async def list_range_for_plan(
        self, _start_date: str, _end_date: str, *, training_plan_id: str
    ) -> list[dict]:
        assert training_plan_id == "new-plan"
        return [
            {
                "id": "new-session",
                "title": "New-plan run",
                "sport": "run",
                "scheduled_date": "2026-08-08",
                "status": "planned",
            }
        ]

    async def get(self, session_id: str) -> dict:
        assert session_id == "archived-session"
        return {"id": session_id, "training_plan_id": "old-plan"}


class NewPlanFake:
    async def get_active(self) -> dict:
        return {"id": "new-plan", "status": "active"}


@pytest.mark.asyncio
async def test_calendar_hides_archived_plan_sessions_but_keeps_their_activities() -> None:
    service = CalendarService(  # type: ignore[arg-type]
        ArchivedActivityFake(), ActiveSessionsFake(), NewPlanFake()
    )

    response = await service.get_range("2026-08-02", "2026-08-09")

    assert [(event.kind, event.title) for event in response.events] == [
        ("activity", "Completed old-plan run"),
        ("planned_session", "New-plan run"),
    ]
