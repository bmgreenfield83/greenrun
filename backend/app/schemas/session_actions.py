from datetime import date

from pydantic import Field

from app.schemas.common import ApiModel
from app.schemas.plans import PlannedSessionResponse


class SkipSessionRequest(ApiModel):
    reason: str | None = Field(default=None, max_length=4000)


class RescheduleSessionRequest(ApiModel):
    scheduled_date: date
    notes: str | None = Field(default=None, max_length=4000)


class RescheduleSessionResponse(ApiModel):
    original_session: PlannedSessionResponse
    replacement_session: PlannedSessionResponse


class AttachActivityRequest(ApiModel):
    activity_id: str
