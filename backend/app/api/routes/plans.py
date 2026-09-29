from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.api.dependencies import PlanServiceDependency, SessionServiceDependency
from app.schemas.plans import (
    PlannedSessionCreate,
    PlannedSessionCreateRequest,
    PlannedSessionListResponse,
    PlannedSessionResponse,
    PlannedSessionUpdate,
    TrainingPlanCreate,
    TrainingPlanListResponse,
    TrainingPlanResponse,
    TrainingPlanUpdate,
)

router = APIRouter()


@router.post("/plans", response_model=TrainingPlanResponse, status_code=status.HTTP_201_CREATED)
async def create_plan(
    payload: TrainingPlanCreate, service: PlanServiceDependency
) -> TrainingPlanResponse:
    return await service.create(payload)


@router.get("/plans", response_model=TrainingPlanListResponse)
async def list_plans(
    service: PlanServiceDependency,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
) -> TrainingPlanListResponse:
    items, total = await service.list(skip=skip, limit=limit)
    return TrainingPlanListResponse(items=items, total=total)


@router.get("/plans/{plan_id}", response_model=TrainingPlanResponse)
async def get_plan(plan_id: str, service: PlanServiceDependency) -> TrainingPlanResponse:
    return await service.get(plan_id)


@router.patch("/plans/{plan_id}", response_model=TrainingPlanResponse)
async def update_plan(
    plan_id: str, payload: TrainingPlanUpdate, service: PlanServiceDependency
) -> TrainingPlanResponse:
    return await service.update(plan_id, payload)


@router.post(
    "/plans/{plan_id}/sessions",
    response_model=PlannedSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_plan_session(
    plan_id: str,
    payload: PlannedSessionCreateRequest,
    service: SessionServiceDependency,
) -> PlannedSessionResponse:
    normalized = PlannedSessionCreate(training_plan_id=plan_id, **payload.model_dump())
    return await service.create(normalized)


@router.get("/plans/{plan_id}/sessions", response_model=PlannedSessionListResponse)
async def list_plan_sessions(
    plan_id: str, service: SessionServiceDependency
) -> PlannedSessionListResponse:
    items = await service.list_for_plan(plan_id)
    return PlannedSessionListResponse(items=items, total=len(items))


@router.get("/planned-sessions/{session_id}", response_model=PlannedSessionResponse)
async def get_session(session_id: str, service: SessionServiceDependency) -> PlannedSessionResponse:
    return await service.get(session_id)


@router.patch("/planned-sessions/{session_id}", response_model=PlannedSessionResponse)
async def update_session(
    session_id: str,
    payload: PlannedSessionUpdate,
    service: SessionServiceDependency,
) -> PlannedSessionResponse:
    return await service.update(session_id, payload)


@router.delete("/planned-sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(session_id: str, service: SessionServiceDependency) -> Response:
    await service.delete(session_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
