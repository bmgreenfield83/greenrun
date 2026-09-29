from datetime import UTC, datetime

import pytest

from app.schemas.settings import AppSettingsResponse
from app.services.settings import storage_statistics


class DatabaseFake:
    async def command(self, _command: str, _collection: str) -> dict[str, int]:
        return {"size": 10, "storageSize": 20, "totalIndexSize": 5}


@pytest.mark.asyncio
async def test_storage_statistics_reports_highest_crossed_threshold() -> None:
    now = datetime.now(UTC)
    settings = AppSettingsResponse(
        storage_limit_bytes=100,
        created_at_utc=now,
        updated_at_utc=now,
    )

    result = await storage_statistics(DatabaseFake(), settings)

    assert result.available is True
    assert result.estimated_used_bytes == 125
    assert result.usage_percent == 125
    assert result.warning_threshold == 95
