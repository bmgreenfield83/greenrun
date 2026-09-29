from copy import deepcopy
from datetime import UTC, date, datetime

import pytest

from app.core.errors import AppError
from app.schemas.activities import (
    ActivityCreate,
    ActivityMetadataUpdate,
    ActivitySource,
    SubjectiveData,
)
from app.services.activities import ActivityService


class ActivityRepositoryFake:
    def __init__(self) -> None:
        self.document: dict | None = None
        self.deleted = False
        self.list_options: dict[str, object] | None = None

    async def create(self, document: dict) -> dict:
        self.document = deepcopy(document) | {"id": "activity-1"}
        return deepcopy(self.document)

    async def get(self, _activity_id: str) -> dict | None:
        return deepcopy(self.document)

    async def list(self, **kwargs: object) -> tuple[list[dict], int]:
        self.list_options = kwargs
        return ([deepcopy(self.document)] if self.document else [], int(self.document is not None))

    async def update_metadata(self, _activity_id: str, changes: dict, updated_at: datetime) -> dict:
        assert self.document is not None
        self.document.update(deepcopy(changes) | {"updated_at_utc": updated_at})
        return deepcopy(self.document)

    async def delete(self, _activity_id: str) -> bool:
        self.deleted = True
        self.document = None
        return True


class SessionRepositoryFake:
    def __init__(self) -> None:
        self.detached_activity_id: str | None = None

    async def detach_activity(self, activity_id: str, _updated_at: datetime) -> None:
        self.detached_activity_id = activity_id


class SampleRepositoryFake:
    async def list_for_activity(self, _activity_id: str) -> list[dict]:
        return [
            {"chunk_index": 1, "samples": [{"elapsed_seconds": 10, "heart_rate": 130}]},
            {"chunk_index": 0, "samples": [{"elapsed_seconds": 5, "heart_rate": 125}]},
        ]


def payload() -> ActivityCreate:
    return ActivityCreate(
        sport="run",
        category="easy",
        title="Morning run",
        started_at_utc=datetime(2026, 8, 4, 11, tzinfo=UTC),
        local_date=date(2026, 8, 4),
        distance_meters=5000,
        elapsed_time_seconds=1800,
        subjective=SubjectiveData(notes="Keep this note"),
        source=ActivitySource(type="manual"),
    )


@pytest.mark.asyncio
async def test_metadata_update_cannot_change_objective_fields() -> None:
    activities = ActivityRepositoryFake()
    service = ActivityService(activities, SessionRepositoryFake())  # type: ignore[arg-type]
    created = await service.create(payload())

    updated = await service.update_metadata(
        created.id,
        ActivityMetadataUpdate(
            title="Renamed",
            weather_notes="Humid",
            subjective=SubjectiveData(effort=4),
            heart_rate_analysis_start_distance_meters=3000,
        ),
    )

    assert updated.title == "Renamed"
    assert updated.distance_meters == 5000
    assert updated.elapsed_time_seconds == 1800
    assert updated.subjective.effort == 4
    assert updated.subjective.notes == "Keep this note"
    assert updated.heart_rate_analysis_start_distance_meters == 3000


@pytest.mark.asyncio
async def test_hr_analysis_start_must_precede_run_end() -> None:
    activities = ActivityRepositoryFake()
    service = ActivityService(activities, SessionRepositoryFake())  # type: ignore[arg-type]
    created = await service.create(payload())

    with pytest.raises(AppError, match="before the end"):
        await service.update_metadata(
            created.id,
            ActivityMetadataUpdate(heart_rate_analysis_start_distance_meters=5000),
        )


@pytest.mark.asyncio
async def test_deleting_activity_detaches_session_before_removing_activity() -> None:
    activities = ActivityRepositoryFake()
    sessions = SessionRepositoryFake()
    service = ActivityService(activities, sessions)  # type: ignore[arg-type]
    created = await service.create(payload())

    await service.delete(created.id)

    assert sessions.detached_activity_id == created.id
    assert activities.deleted is True


@pytest.mark.asyncio
async def test_activity_samples_are_flattened_and_sorted() -> None:
    activities = ActivityRepositoryFake()
    service = ActivityService(  # type: ignore[arg-type]
        activities, SessionRepositoryFake(), SampleRepositoryFake()
    )
    created = await service.create(payload())

    samples = await service.get_samples(created.id)

    assert [sample.elapsed_seconds for sample in samples] == [5, 10]
    assert samples[0].heart_rate == 125


@pytest.mark.asyncio
async def test_activity_list_passes_pagination_and_filters_to_repository() -> None:
    activities = ActivityRepositoryFake()
    service = ActivityService(activities, SessionRepositoryFake())  # type: ignore[arg-type]

    items, total = await service.list(
        skip=25,
        limit=25,
        sport="run",
        start_date="2026-07-01",
        end_date="2026-07-31",
    )

    assert items == [] and total == 0
    assert activities.list_options == {
        "skip": 25,
        "limit": 25,
        "sport": "run",
        "start_date": "2026-07-01",
        "end_date": "2026-07-31",
    }
