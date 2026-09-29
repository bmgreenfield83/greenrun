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


class UpdatablePlanRepositoryFake(PlanRepositoryFake):
    async def update(self, plan_id: str, changes: dict, _updated_at: object) -> dict | None:
        if plan_id not in self.documents:
            return None
        self.documents[plan_id].update(deepcopy(changes))
        return deepcopy(self.documents[plan_id])


@pytest.mark.asyncio
async def test_existing_plan_goal_target_can_be_set_and_cleared() -> None:
    from app.schemas.plans import TrainingPlanUpdate

    repository = UpdatablePlanRepositoryFake()
    service = TrainingPlanService(repository)  # type: ignore[arg-type]
    plan = await service.create(plan_payload())
    assert plan.goal_target is None

    updated = await service.update(
        plan.id,
        TrainingPlanUpdate.model_validate(
            {"goal_target": {"distance_meters": 5000, "target_time_seconds": 1200}}
        ),
    )
    assert updated.goal_target is not None
    assert updated.goal_target.distance_meters == 5000

    renamed = await service.update(plan.id, TrainingPlanUpdate(name="Renamed"))
    assert renamed.goal_target is not None

    cleared = await service.update(
        plan.id, TrainingPlanUpdate.model_validate({"goal_target": None})
    )
    assert cleared.goal_target is None


@pytest.mark.asyncio
async def test_legacy_plan_document_without_goal_target_still_validates() -> None:
    repository = PlanRepositoryFake()
    service = TrainingPlanService(repository)  # type: ignore[arg-type]
    plan = await service.create(plan_payload())
    repository.documents[plan.id].pop("goal_target")

    assert (await service.get(plan.id)).goal_target is None
