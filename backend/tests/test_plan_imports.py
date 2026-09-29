from copy import deepcopy
from datetime import UTC, date, datetime

import pytest
from pydantic import ValidationError

from app.api.routes.plan_imports import get_blank_plan_template
from app.core.errors import ConflictError
from app.schemas.plan_imports import (
    PlanImportConfirmRequest,
    PlanImportPreviewRequest,
    TrainingPlanTemplate,
)
from app.services.plan_imports.cache import PlanPreviewCache
from app.services.plan_imports.imports import PlanImportService


def template() -> TrainingPlanTemplate:
    return TrainingPlanTemplate.model_validate(
        {
            "schema_version": "1.0",
            "name": "Two Week Plan",
            "primary_goal": "Improve 10K performance.",
            "secondary_goal": "Build durable weekly volume.",
            "week_starts_on": "monday",
            "weeks": [
                {
                    "week_number": 1,
                    "planned_running_miles": 6,
                    "sessions": [
                        {
                            "day_of_week": "tuesday",
                            "sport": "run",
                            "session_type": "easy",
                            "title": "Easy run",
                            "planned_distance_miles": 5,
                            "justification": "Supports aerobic durability for both goals.",
                        }
                    ],
                },
                {
                    "week_number": 2,
                    "planned_running_miles": 0,
                    "sessions": [
                        {
                            "day_of_week": "thursday",
                            "sport": "strength",
                            "session_type": "strength",
                            "title": "Strength",
                            "planned_duration_minutes": 30,
                        }
                    ],
                },
            ],
        }
    )


class PlansFake:
    def __init__(self, active: bool = False) -> None:
        now = datetime.now(UTC)
        self.active = (
            {
                "id": "old-plan",
                "name": "Old plan",
                "status": "active",
                "start_date": "2026-07-01",
                "end_date": "2026-08-15",
                "created_at_utc": now,
                "updated_at_utc": now,
            }
            if active
            else None
        )
        self.created: dict | None = None

    async def get_active(self) -> dict | None:
        return deepcopy(self.active)

    async def update(self, plan_id: str, changes: dict, _updated_at: datetime) -> dict:
        assert plan_id == "old-plan"
        assert self.active is not None
        self.active.update(changes)
        return deepcopy(self.active)

    async def create(self, document: dict) -> dict:
        self.created = deepcopy(document) | {"id": "new-plan"}
        return deepcopy(self.created)

    async def delete(self, _plan_id: str) -> bool:
        return True


class SessionsFake:
    def __init__(self) -> None:
        self.documents: list[dict] = []

    async def create_many(self, documents: list[dict]) -> list[str]:
        self.documents = deepcopy(documents)
        return [f"session-{index}" for index in range(len(documents))]

    async def delete_for_plan(self, _plan_id: str) -> int:
        return 0


@pytest.mark.asyncio
async def test_plan_preview_resolves_relative_dates_and_mileage() -> None:
    service = PlanImportService(PlanPreviewCache(), PlansFake(), SessionsFake())  # type: ignore[arg-type]

    preview = await service.preview(
        PlanImportPreviewRequest(template=template(), start_date=date(2026, 8, 3))
    )

    assert preview.end_date == date(2026, 8, 16)
    assert preview.planned_session_count == 2
    assert preview.total_planned_running_miles == 6


@pytest.mark.asyncio
async def test_active_plan_requires_replacement_and_is_archived_on_confirmation() -> None:
    plans = PlansFake(active=True)
    sessions = SessionsFake()
    service = PlanImportService(PlanPreviewCache(), plans, sessions)  # type: ignore[arg-type]
    preview = await service.preview(
        PlanImportPreviewRequest(template=template(), start_date=date(2026, 8, 3))
    )
    assert preview.conflict is not None
    assert preview.conflict.dates_overlap is True

    with pytest.raises(ConflictError, match="Confirm replacement"):
        await service.confirm(PlanImportConfirmRequest(preview_token=preview.preview_token))

    result = await service.confirm(
        PlanImportConfirmRequest(
            preview_token=preview.preview_token,
            replace_active_plan=True,
        )
    )

    assert result.archived_plan_id == "old-plan"
    assert result.sessions_created == 2
    assert plans.active is not None and plans.active["status"] == "archived"
    assert sessions.documents[0]["scheduled_date"] == date(2026, 8, 4)
    assert plans.created is not None
    assert plans.created["week_summaries"][0]["planned_running_miles"] == 6
    assert plans.created["primary_goal"] == "Improve 10K performance."
    assert plans.created["secondary_goal"] == "Build durable weekly volume."
    assert sessions.documents[0]["justification"] == ("Supports aerobic durability for both goals.")


def test_plan_schema_rejects_unknown_fields_and_noncontiguous_weeks() -> None:
    value = template().model_dump(mode="json")
    value["unknown"] = True
    value["weeks"][1]["week_number"] = 3

    with pytest.raises(ValidationError):
        TrainingPlanTemplate.model_validate(value)


@pytest.mark.asyncio
async def test_plan_preview_accepts_any_date_in_the_first_week() -> None:
    service = PlanImportService(PlanPreviewCache(), PlansFake(), SessionsFake())  # type: ignore[arg-type]

    preview = await service.preview(
        PlanImportPreviewRequest(template=template(), start_date=date(2026, 8, 5))
    )

    assert preview.start_date == date(2026, 8, 3)
    assert preview.end_date == date(2026, 8, 16)


@pytest.mark.asyncio
async def test_dated_plan_resolves_without_a_selected_start_date() -> None:
    value = template().model_dump(mode="json")
    value["start_date"] = "2026-08-03"
    value["weeks"][0]["sessions"][0]["scheduled_date"] = "2026-08-04"
    value["weeks"][1]["sessions"][0]["scheduled_date"] = "2026-08-13"
    service = PlanImportService(PlanPreviewCache(), PlansFake(), SessionsFake())  # type: ignore[arg-type]

    preview = await service.preview(
        PlanImportPreviewRequest(template=TrainingPlanTemplate.model_validate(value))
    )

    assert preview.start_date == date(2026, 8, 3)
    assert preview.end_date == date(2026, 8, 16)


def test_dated_plan_rejects_inconsistent_dates() -> None:
    value = template().model_dump(mode="json")
    value["weeks"][0]["sessions"][0]["scheduled_date"] = "2026-08-05"

    with pytest.raises(ValidationError, match="must match day_of_week"):
        TrainingPlanTemplate.model_validate(value)


@pytest.mark.asyncio
async def test_blank_template_is_schema_compatible_and_includes_dates() -> None:
    blank = await get_blank_plan_template()
    parsed = TrainingPlanTemplate.model_validate(blank)

    assert parsed.start_date == date(2026, 1, 5)
    assert parsed.weeks[0].sessions[0].scheduled_date == date(2026, 1, 6)
    assert parsed.primary_goal
    assert parsed.weeks[0].sessions[0].justification


@pytest.mark.asyncio
async def test_goal_target_is_optional_and_stored_when_imported() -> None:
    plans = PlansFake()
    service = PlanImportService(PlanPreviewCache(), plans, SessionsFake())  # type: ignore[arg-type]
    preview = await service.preview(PlanImportPreviewRequest(template=template()))
    await service.confirm(PlanImportConfirmRequest(preview_token=preview.preview_token))
    assert plans.created is not None and plans.created["goal_target"] is None

    value = template().model_dump(mode="json")
    value["goal_target"] = {"distance_meters": 1609.344, "target_time_seconds": 360}
    preview = await service.preview(
        PlanImportPreviewRequest(template=TrainingPlanTemplate.model_validate(value))
    )
    await service.confirm(PlanImportConfirmRequest(preview_token=preview.preview_token))
    assert plans.created["goal_target"] == {
        "distance_meters": 1609.344,
        "target_time_seconds": 360,
    }


@pytest.mark.parametrize(
    "goal_target",
    [
        {"distance_meters": 0, "target_time_seconds": 360},
        {"distance_meters": 1609.344, "target_time_seconds": -1},
        {"distance_meters": 1609.344},
        {"distance_meters": 1609.344, "target_time_seconds": 360, "pace": 1},
    ],
)
def test_goal_target_is_validated(goal_target: dict) -> None:
    value = template().model_dump(mode="json") | {"goal_target": goal_target}

    with pytest.raises(ValidationError):
        TrainingPlanTemplate.model_validate(value)


def test_generated_schema_documents_goal_target() -> None:
    schema = TrainingPlanTemplate.model_json_schema()

    assert "goal_target" in schema["properties"]
    assert "goal_target" not in schema.get("required", [])
    assert set(schema["$defs"]["PlanGoalTarget"]["required"]) == {
        "distance_meters",
        "target_time_seconds",
    }


@pytest.mark.asyncio
async def test_blank_template_includes_goal_target() -> None:
    parsed = TrainingPlanTemplate.model_validate(await get_blank_plan_template())

    assert parsed.goal_target is not None
    assert parsed.goal_target.target_time_seconds == 360
