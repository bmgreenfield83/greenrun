from fastapi import APIRouter

from app.api.dependencies import Database, SettingsServiceDependency
from app.schemas.settings import AppSettingsResponse, AppSettingsUpdate, StorageStatisticsResponse
from app.services.settings import storage_statistics

router = APIRouter(prefix="/settings")


@router.get("", response_model=AppSettingsResponse)
async def get_settings(service: SettingsServiceDependency) -> AppSettingsResponse:
    return await service.get()


@router.patch("", response_model=AppSettingsResponse)
async def update_settings(
    payload: AppSettingsUpdate, service: SettingsServiceDependency
) -> AppSettingsResponse:
    return await service.update(payload)


@router.get("/storage", response_model=StorageStatisticsResponse)
async def get_storage_statistics(
    database: Database, service: SettingsServiceDependency
) -> StorageStatisticsResponse:
    return await storage_statistics(database, await service.get())
