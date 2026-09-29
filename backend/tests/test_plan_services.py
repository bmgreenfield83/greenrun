from copy import deepcopy
from datetime import date

import pytest

from app.core.errors import ConflictError
from app.schemas.plans import PlannedSessionCreate, TrainingPlanCreate
from app.services.plans import PlannedSessionService, TrainingPlanService


class PlanRepositoryFake:
    def __init__(self) -> None:
        self.documents: dict[str, dict] = {}

    async def get_active(self) -> dict | None:
        return next(
            (deepcopy(item) for item in self.documents.values() if item["status"] == "active"), None
        )

    async def create(self, document: dict) -> dict:
        created = deepcopy(document) | {"id": f"plan-{len(self.documents) + 1}"}
        self.documents[created["id"]] = created
        return deepcopy(created)

    async def get(self, plan_id: str) -> dict | None:
        return deepcopy(self.documents.get(plan_id))


class SessionRepositoryFake:
    async def create(self, document: dict) -> dict:
        return deepcopy(document) | {"id": "session-1"}


def plan_payload(name: str = "Plan") -> TrainingPlanCreate:
    return TrainingPlanCreate(
        name=name,
        start_date=date(2026, 8, 3),
        end_date=date(2026, 8, 30),
    )


@pytest.mark.asyncio
async def test_only_one_active_plan_can_be_created() -> None:
    repository = PlanRepositoryFake()
    service = TrainingPlanService(repository)  # type: ignore[arg-type]
    await service.create(plan_payload("First"))

    with pytest.raises(ConflictError, match="active training plan"):
        await service.create(plan_payload("Second"))


@pytest.mark.asyncio
async def test_session_must_fall_inside_plan_dates() -> None:
    plans = PlanRepositoryFake()
    plan = await TrainingPlanService(plans).create(plan_payload())  # type: ignore[arg-type]
    service = PlannedSessionService(SessionRepositoryFake(), plans)  # type: ignore[arg-type]

    with pytest.raises(ConflictError, match="within the training plan"):
        await service.create(
            PlannedSessionCreate(
                training_plan_id=plan.id,
                scheduled_date=date(2026, 9, 1),
                sport="run",
                session_type="easy",
                title="Outside plan",
            )
        )


@pytest.mark.asyncio
async def test_session_defaults_original_scheduled_date() -> None:
    plans = PlanRepositoryFake()
    plan = await TrainingPlanService(plans).create(plan_payload())  # type: ignore[arg-type]
    service = PlannedSessionService(SessionRepositoryFake(), plans)  # type: ignore[arg-type]

    session = await service.create(
        PlannedSessionCreate(
            training_plan_id=plan.id,
            scheduled_date=date(2026, 8, 4),
            sport="run",
            session_type="easy",
            title="Easy run",
        )
    )

    assert session.original_scheduled_date == session.scheduled_date
