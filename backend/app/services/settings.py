from typing import Any

from app.core.config import Settings
from app.db.collections import (
    ACTIVITIES,
    ACTIVITY_SAMPLES,
    APP_SETTINGS,
    PLANNED_SESSIONS,
    TRAINING_PLANS,
)
from app.repositories.settings import SettingsRepository
from app.schemas.common import utc_now
from app.schemas.settings import (
    AppSettingsResponse,
    AppSettingsUpdate,
    CollectionStorage,
    StorageStatisticsResponse,
)


class SettingsService:
    def __init__(self, repository: SettingsRepository, config: Settings) -> None:
        self.repository = repository
        self.config = config

    def defaults(self) -> dict[str, Any]:
        now = utc_now()
        return {
            "schema_version": 1,
            "timezone": "America/New_York",
            "sample_interval_seconds": 5,
            "sample_chunk_seconds": 600,
            "export_size_threshold_bytes": 26_214_400,
            "storage_limit_bytes": self.config.storage_limit_bytes,
            "storage_warning_thresholds": [70, 85, 95],
            "created_at_utc": now,
            "updated_at_utc": now,
        }

    async def get(self) -> AppSettingsResponse:
        return AppSettingsResponse.model_validate(
            await self.repository.get_or_create(self.defaults())
        )

    async def update(self, payload: AppSettingsUpdate) -> AppSettingsResponse:
        changes = payload.model_dump(exclude_unset=True, exclude_none=True)
        changes["updated_at_utc"] = utc_now()
        return AppSettingsResponse.model_validate(await self.repository.update(changes))


async def storage_statistics(
    database: Any, settings: AppSettingsResponse
) -> StorageStatisticsResponse:
    results: list[CollectionStorage] = []
    total = 0
    available = True
    for name in (ACTIVITIES, ACTIVITY_SAMPLES, TRAINING_PLANS, PLANNED_SESSIONS, APP_SETTINGS):
        try:
            stats = await database.command("collStats", name)
            storage = int(stats.get("storageSize", 0))
            indexes = int(stats.get("totalIndexSize", 0))
            total += storage + indexes
            results.append(
                CollectionStorage(
                    name=name,
                    data_size_bytes=int(stats.get("size", 0)),
                    storage_size_bytes=storage,
                    index_size_bytes=indexes,
                )
            )
        except Exception:
            available = False
            results.append(CollectionStorage(name=name))
    if not available:
        return StorageStatisticsResponse(
            available=False,
            configured_limit_bytes=settings.storage_limit_bytes,
            collections=results,
        )
    percent = round(total / settings.storage_limit_bytes * 100, 2)
    warning = next(
        (value for value in reversed(settings.storage_warning_thresholds) if percent >= value), None
    )
    return StorageStatisticsResponse(
        available=True,
        configured_limit_bytes=settings.storage_limit_bytes,
        estimated_used_bytes=total,
        usage_percent=percent,
        warning_threshold=warning,
        collections=results,
    )
