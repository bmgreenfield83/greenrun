from copy import deepcopy
from typing import Any

import pytest
from pydantic import SecretStr, ValidationError

from app.core.config import Settings
from app.schemas.settings import AppSettingsUpdate
from app.services.settings import InvalidSettingsError, SettingsService


class SettingsRepositoryFake:
    def __init__(self) -> None:
        self.document: dict[str, Any] | None = None

    async def get_or_create(self, defaults: dict[str, Any]) -> dict[str, Any]:
        if self.document is None:
            self.document = {"id": "application"} | deepcopy(defaults)
        return deepcopy(self.document)

    async def update(self, changes: dict[str, Any]) -> dict[str, Any]:
        assert self.document is not None
        self.document.update(deepcopy(changes))
        return deepcopy(self.document)


def service() -> tuple[SettingsService, SettingsRepositoryFake]:
    repository = SettingsRepositoryFake()
    config = Settings(mongodb_uri=SecretStr("mongodb://example.invalid"), app_env="test")
    return SettingsService(repository, config), repository  # type: ignore[arg-type]


@pytest.mark.asyncio
async def test_heart_rate_settings_default_to_unset() -> None:
    settings_service, _repository = service()

    current = await settings_service.get()

    assert current.max_heart_rate_bpm is None
    assert current.resting_heart_rate_bpm is None


@pytest.mark.asyncio
async def test_heart_rate_settings_can_be_set_individually_and_cleared() -> None:
    settings_service, repository = service()
    await settings_service.get()

    updated = await settings_service.update(
        AppSettingsUpdate(max_heart_rate_bpm=194, resting_heart_rate_bpm=55)
    )
    assert (updated.max_heart_rate_bpm, updated.resting_heart_rate_bpm) == (194, 55)

    updated = await settings_service.update(AppSettingsUpdate(resting_heart_rate_bpm=52))
    assert (updated.max_heart_rate_bpm, updated.resting_heart_rate_bpm) == (194, 52)

    updated = await settings_service.update(AppSettingsUpdate(timezone="America/Chicago"))
    assert updated.max_heart_rate_bpm == 194

    cleared = await settings_service.update(
        AppSettingsUpdate.model_validate({"max_heart_rate_bpm": None})
    )
    assert cleared.max_heart_rate_bpm is None
    assert cleared.resting_heart_rate_bpm == 52
    assert repository.document is not None and repository.document["timezone"] == "America/Chicago"


@pytest.mark.asyncio
async def test_resting_heart_rate_must_stay_below_stored_max() -> None:
    settings_service, _repository = service()
    await settings_service.update(AppSettingsUpdate(max_heart_rate_bpm=118))

    with pytest.raises(InvalidSettingsError, match="lower than max"):
        await settings_service.update(AppSettingsUpdate(resting_heart_rate_bpm=119))
    with pytest.raises(InvalidSettingsError, match="lower than max"):
        await settings_service.update(AppSettingsUpdate(resting_heart_rate_bpm=118))


@pytest.mark.parametrize(
    "values",
    [
        {"max_heart_rate_bpm": 99},
        {"max_heart_rate_bpm": 231},
        {"resting_heart_rate_bpm": 24},
        {"resting_heart_rate_bpm": 121},
        {"max_heart_rate_bpm": 120, "resting_heart_rate_bpm": 120},
    ],
)
def test_heart_rate_settings_reject_implausible_values(values: dict[str, int]) -> None:
    with pytest.raises(ValidationError):
        AppSettingsUpdate.model_validate(values)
