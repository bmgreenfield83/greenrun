from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query

from app.api.dependencies import CalendarServiceDependency
from app.core.errors import AppError
from app.schemas.calendar import CalendarResponse

router = APIRouter(prefix="/calendar")


@router.get("", response_model=CalendarResponse)
async def get_calendar(
    service: CalendarServiceDependency,
    start: Annotated[date, Query()],
    end: Annotated[date, Query()],
) -> CalendarResponse:
    if end <= start:
        raise AppError("Calendar end date must be after the start date.")
    return await service.get_range(start.isoformat(), end.isoformat())
