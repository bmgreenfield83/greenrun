from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.api.dependencies import ActivityServiceDependency
from app.models.enums import Sport
from app.schemas.activities import (
    ActivityCreate,
    ActivityListResponse,
    ActivityMetadataUpdate,
    ActivityResponse,
    ActivitySamplesResponse,
)

router = APIRouter(prefix="/activities")


@router.post("", response_model=ActivityResponse, status_code=status.HTTP_201_CREATED)
async def create_activity(
    payload: ActivityCreate, service: ActivityServiceDependency
) -> ActivityResponse:
    return await service.create(payload)


@router.get("", response_model=ActivityListResponse)
async def list_activities(
    service: ActivityServiceDependency,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    sport: Sport | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> ActivityListResponse:
    items, total = await service.list(
        skip=skip,
        limit=limit,
        sport=sport,
        start_date=start_date.isoformat() if start_date else None,
        end_date=end_date.isoformat() if end_date else None,
    )
    return ActivityListResponse(items=items, total=total)


@router.get("/{activity_id}", response_model=ActivityResponse)
async def get_activity(activity_id: str, service: ActivityServiceDependency) -> ActivityResponse:
    return await service.get(activity_id)


@router.get("/{activity_id}/samples", response_model=ActivitySamplesResponse)
async def get_activity_samples(
    activity_id: str, service: ActivityServiceDependency
) -> ActivitySamplesResponse:
    items = await service.get_samples(activity_id)
    return ActivitySamplesResponse(items=items, total=len(items))


@router.patch("/{activity_id}", response_model=ActivityResponse)
async def update_activity_metadata(
    activity_id: str,
    payload: ActivityMetadataUpdate,
    service: ActivityServiceDependency,
) -> ActivityResponse:
    return await service.update_metadata(activity_id, payload)


@router.delete("/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_activity(activity_id: str, service: ActivityServiceDependency) -> Response:
    await service.delete(activity_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
