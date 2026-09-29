from datetime import date, datetime

from pydantic import Field, model_validator

from app.models.enums import PlanStatus, SessionStatus, Sport
from app.schemas.common import ApiModel


class PlanSource(ApiModel):
    type: str = "manual"
    imported_at_utc: datetime | None = None


class PlanWeekSummary(ApiModel):
    week_number: int = Field(ge=1)
    focus: str | None = Field(default=None, max_length=1000)
    planned_running_miles: float | None = Field(default=None, ge=0)


class TrainingPlanCreate(ApiModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=10000)
    primary_goal: str | None = Field(default=None, max_length=10000)
    secondary_goal: str | None = Field(default=None, max_length=10000)
    status: PlanStatus = PlanStatus.ACTIVE
    start_date: date
    end_date: date
    week_starts_on: str = Field(default="monday", pattern="^monday$")
    source: PlanSource = Field(default_factory=PlanSource)
    week_summaries: list[PlanWeekSummary] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_dates(self) -> "TrainingPlanCreate":
        if self.end_date < self.start_date:
            raise ValueError("end_date cannot be before start_date")
        return self


class TrainingPlanUpdate(ApiModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=10000)
    primary_goal: str | None = Field(default=None, max_length=10000)
    secondary_goal: str | None = Field(default=None, max_length=10000)
    status: PlanStatus | None = None


class TrainingPlanResponse(TrainingPlanCreate):
    id: str
    schema_version: int
    created_at_utc: datetime
    updated_at_utc: datetime
    archived_at_utc: datetime | None = None


class TrainingPlanListResponse(ApiModel):
    items: list[TrainingPlanResponse]
    total: int


class PlannedSessionBase(ApiModel):
    scheduled_date: date
    original_scheduled_date: date | None = None
    sport: Sport
    session_type: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=200)
    planned_distance_meters: float | None = Field(default=None, ge=0)
    planned_duration_seconds: float | None = Field(default=None, gt=0)
    instructions: str | None = Field(default=None, max_length=10000)
    justification: str | None = Field(default=None, max_length=10000)
    status: SessionStatus = SessionStatus.PLANNED
    completed_activity_id: str | None = None
    completed_on_date: date | None = None
    skip_reason: str | None = Field(default=None, max_length=4000)
    reschedule_notes: str | None = Field(default=None, max_length=4000)
    rescheduled_from_session_id: str | None = None
    rescheduled_to_session_id: str | None = None

    @model_validator(mode="after")
    def default_original_date(self) -> "PlannedSessionBase":
        if self.original_scheduled_date is None:
            self.original_scheduled_date = self.scheduled_date
        return self


class PlannedSessionCreateRequest(PlannedSessionBase):
    pass


class PlannedSessionCreate(PlannedSessionBase):
    training_plan_id: str


class PlannedSessionUpdate(ApiModel):
    scheduled_date: date | None = None
    session_type: str | None = Field(default=None, min_length=1, max_length=100)
    title: str | None = Field(default=None, min_length=1, max_length=200)
    planned_distance_meters: float | None = Field(default=None, ge=0)
    planned_duration_seconds: float | None = Field(default=None, gt=0)
    instructions: str | None = Field(default=None, max_length=10000)
    justification: str | None = Field(default=None, max_length=10000)
    status: SessionStatus | None = None
    skip_reason: str | None = Field(default=None, max_length=4000)
    reschedule_notes: str | None = Field(default=None, max_length=4000)


class PlannedSessionResponse(PlannedSessionCreate):
    id: str
    schema_version: int
    created_at_utc: datetime
    updated_at_utc: datetime


class PlannedSessionListResponse(ApiModel):
    items: list[PlannedSessionResponse]
    total: int
