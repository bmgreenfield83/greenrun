from datetime import date
from typing import Literal

from app.schemas.common import ApiModel


class CalendarEvent(ApiModel):
    id: str
    kind: Literal["activity", "planned_session"]
    title: str
    date: date
    sport: str
    status: str
    distance_meters: float | None = None
    completed_distance_meters: float | None = None
    completed_duration_seconds: float | None = None
    completed_average_speed_mps: float | None = None
    completed_pace_seconds_per_mile: float | None = None
    completed_activity_title: str | None = None
    completed_activity_notes: str | None = None
    planned_session_id: str | None = None
    activity_id: str | None = None
    completed_on_date: date | None = None
    original_scheduled_date: date | None = None
    notes: str | None = None
    instructions: str | None = None
    justification: str | None = None
    skip_reason: str | None = None
    reschedule_notes: str | None = None


class CalendarResponse(ApiModel):
    events: list[CalendarEvent]
