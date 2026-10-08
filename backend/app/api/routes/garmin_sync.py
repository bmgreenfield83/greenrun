from fastapi import APIRouter

from app.api.dependencies import GarminSyncServiceDependency
from app.schemas.garmin_sync import GarminSyncRequest, GarminSyncResponse

router = APIRouter(prefix="/activities")


@router.post("/garmin-sync", response_model=GarminSyncResponse)
async def sync_from_garmin(
    payload: GarminSyncRequest,
    service: GarminSyncServiceDependency,
) -> GarminSyncResponse:
    """Find the day's runs on Garmin Connect and preview the new ones for import."""
    return await service.sync(payload.date)
