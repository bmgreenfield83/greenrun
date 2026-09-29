from datetime import date, timedelta
from enum import StrEnum

from pydantic import Field, model_validator

from app.models.enums import RunCategory, Sport
from app.schemas.common import ApiModel
from app.schemas.plans import PlanGoalTarget


class DayOfWeek(StrEnum):
    SUNDAY = "sunday"
    MONDAY = "monday"
    TUESDAY = "tuesday"
    WEDNESDAY = "wednesday"
    THURSDAY = "thursday"
    FRIDAY = "friday"
    SATURDAY = "saturday"


DAY_OFFSETS = {
    DayOfWeek.MONDAY: 0,
    DayOfWeek.TUESDAY: 1,
    DayOfWeek.WEDNESDAY: 2,
    DayOfWeek.THURSDAY: 3,
    DayOfWeek.FRIDAY: 4,
    DayOfWeek.SATURDAY: 5,
    DayOfWeek.SUNDAY: 6,
}


def monday_of_week(value: date) -> date:
    return value - timedelta(days=value.weekday())


class PlanTemplateSession(ApiModel):
    day_of_week: DayOfWeek
    scheduled_date: date | None = None
    sport: Sport
    session_type: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=200)
    planned_distance_miles: float | None = Field(default=None, ge=0)
    planned_duration_minutes: float | None = Field(default=None, gt=0)
    instructions: str | None = Field(default=None, max_length=10000)
    justification: str | None = Field(default=None, max_length=10000)

    @model_validator(mode="after")
    def validate_session_type(self) -> "PlanTemplateSession":
        if self.sport == Sport.RUN and self.session_type not in RunCategory:
            raise ValueError("running session_type must be a supported run category")
        if self.sport == Sport.STRENGTH and self.planned_distance_miles is not None:
            raise ValueError("strength sessions cannot include distance")
        if self.scheduled_date is not None:
            expected_day = DayOfWeek(self.scheduled_date.strftime("%A").lower())
            if self.day_of_week != expected_day:
                raise ValueError("scheduled_date must match day_of_week")
        return self


class PlanTemplateWeek(ApiModel):
    week_number: int = Field(ge=1)
    focus: str | None = Field(default=None, max_length=1000)
    planned_running_miles: float | None = Field(default=None, ge=0)
    sessions: list[PlanTemplateSession] = Field(min_length=1)


class PlanSchemaReference(ApiModel):
    valid_sports: list[Sport]
    valid_run_session_types: list[RunCategory]
    note: str = Field(max_length=1000)


class TrainingPlanTemplate(ApiModel):
    schema_version: str = Field(pattern=r"^1\.0$")
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=10000)
    primary_goal: str | None = Field(default=None, max_length=10000)
    secondary_goal: str | None = Field(default=None, max_length=10000)
    goal_target: PlanGoalTarget | None = None
    start_date: date | None = None
    week_starts_on: str = Field(default="monday", pattern="^monday$")
    schema_reference: PlanSchemaReference | None = None
    weeks: list[PlanTemplateWeek] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_weeks(self) -> "TrainingPlanTemplate":
        numbers = [week.week_number for week in self.weeks]
        if len(numbers) != len(set(numbers)):
            raise ValueError("week_number values must be unique")
        if sorted(numbers) != list(range(1, max(numbers) + 1)):
            raise ValueError("week_number values must be contiguous starting at 1")
        for week in self.weeks:
            occupied = [session.day_of_week for session in week.sessions]
            if len(occupied) != len(set(occupied)):
                raise ValueError(f"week {week.week_number} contains multiple sessions on one day")
        anchors = {
            session.scheduled_date
            - timedelta(days=(week.week_number - 1) * 7 + DAY_OFFSETS[session.day_of_week])
            for week in self.weeks
            for session in week.sessions
            if session.scheduled_date is not None
        }
        if len(anchors) > 1:
            raise ValueError("scheduled_date values do not describe one consistent plan calendar")
        if (
            anchors
            and self.start_date is not None
            and next(iter(anchors)) != monday_of_week(self.start_date)
        ):
            raise ValueError("scheduled_date values do not match start_date")
        return self


class PlanImportPreviewRequest(ApiModel):
    template: TrainingPlanTemplate
    start_date: date | None = None

    @model_validator(mode="after")
    def validate_start_date(self) -> "PlanImportPreviewRequest":
        if (
            self.start_date is not None
            and self.template.start_date is not None
            and monday_of_week(self.start_date) != monday_of_week(self.template.start_date)
        ):
            raise ValueError("selected start_date does not match the plan start_date")
        dated_anchors = {
            session.scheduled_date
            - timedelta(days=(week.week_number - 1) * 7 + DAY_OFFSETS[session.day_of_week])
            for week in self.template.weeks
            for session in week.sessions
            if session.scheduled_date is not None
        }
        if (
            self.start_date is not None
            and dated_anchors
            and monday_of_week(self.start_date) not in dated_anchors
        ):
            raise ValueError("selected start_date does not match scheduled_date values")
        return self


class PlanImportConflict(ApiModel):
    active_plan_id: str
    active_plan_name: str
    active_start_date: date
    active_end_date: date
    dates_overlap: bool


class PlanImportPreviewResponse(ApiModel):
    preview_token: str
    expires_in_seconds: int
    name: str
    number_of_weeks: int
    start_date: date
    end_date: date
    planned_session_count: int
    total_planned_running_miles: float
    conflict: PlanImportConflict | None = None


class PlanImportConfirmRequest(ApiModel):
    preview_token: str
    replace_active_plan: bool = False


class PlanImportConfirmResponse(ApiModel):
    training_plan_id: str
    sessions_created: int
    archived_plan_id: str | None = None
