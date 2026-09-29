from copy import deepcopy
from datetime import UTC, date, datetime
from hashlib import sha256

import pytest

from app.core.errors import ConflictError
from app.schemas.activities import ActivityCreate, ActivitySource
from app.schemas.fit_imports import FitImportConfirmRequest
from app.services.fit.cache import FitPreviewCache
from app.services.fit.imports import FitImportService
from app.services.fit.models import ActivitySample, ParsedFitActivity


class ParserFake:
    parser_version = "test"

    def __init__(self) -> None:
        self.content_seen: bytes | None = None

    def parse(
        self, content: bytes, filename: str, sample_interval_seconds: int
    ) -> ParsedFitActivity:
        self.content_seen = content
        assert filename == "run.fit"
        assert sample_interval_seconds == 5
        return ParsedFitActivity(
            activity=ActivityCreate(
                sport="run",
                category="other",
                started_at_utc=datetime(2026, 8, 5, 11, tzinfo=UTC),
                local_date=date(2026, 8, 5),
                distance_meters=5000,
                elapsed_time_seconds=1800,
                source=ActivitySource(type="fit", filename=filename),
            ),
            samples=[
                ActivitySample(elapsed_seconds=0, distance_meters=0),
                ActivitySample(elapsed_seconds=5, distance_meters=15),
            ],
        )


class ActivitiesFake:
    def __init__(self, duplicates: list[dict] | None = None) -> None:
        self.duplicates = duplicates or []
        self.document: dict | None = None

    async def find_duplicates(self, **_kwargs: object) -> list[dict]:
        return deepcopy(self.duplicates)

    async def create(self, document: dict) -> dict:
        self.document = deepcopy(document) | {"id": "activity-1"}
        return deepcopy(self.document)

    async def get(self, activity_id: str) -> dict | None:
        if self.document and self.document["id"] == activity_id:
            return deepcopy(self.document)
        return next((deepcopy(item) for item in self.duplicates if item["id"] == activity_id), None)

    async def replace(self, activity_id: str, document: dict) -> dict:
        self.document = deepcopy(document) | {"id": activity_id}
        return deepcopy(self.document)

    async def delete(self, _activity_id: str) -> bool:
        self.document = None
        return True


class SamplesFake:
    def __init__(self) -> None:
        self.chunks: list[dict] = []

    async def replace_chunks(self, _activity_id: str, chunks: list[dict]) -> None:
        self.chunks = deepcopy(chunks)


class SessionsFake:
    async def find_match_candidates(self, **_kwargs: object) -> list[dict]:
        return []

    async def detach_activity(self, *_args: object) -> None:
        return None


class PlansFake:
    async def get_active(self) -> dict:
        return {"id": "active-plan"}


def service(
    activities: ActivitiesFake | None = None,
    sessions: SessionsFake | None = None,
) -> tuple[FitImportService, FitPreviewCache, SamplesFake]:
    cache = FitPreviewCache()
    samples = SamplesFake()
    result = FitImportService(
        ParserFake(),
        cache,
        activities or ActivitiesFake(),
        samples,
        sessions or SessionsFake(),
        PlansFake(),
        sample_interval_seconds=5,
        sample_chunk_seconds=600,
    )
    return result, cache, samples  # type: ignore[return-value]


class CandidateSessionsFake(SessionsFake):
    def __init__(self, scheduled_date: str = "2026-08-05") -> None:
        self.scheduled_date = scheduled_date
        self.attached_status: str | None = None
        self.match_query: dict[str, object] | None = None

    async def find_match_candidates(self, **kwargs: object) -> list[dict]:
        self.match_query = kwargs
        return [
            {
                "id": "planned-1",
                "title": "Wednesday track",
                "scheduled_date": self.scheduled_date,
                "session_type": "track",
                "planned_distance_meters": 5000,
            }
        ]

    async def get(self, session_id: str) -> dict | None:
        if session_id != "planned-1":
            return None
        return {
            "id": session_id,
            "scheduled_date": self.scheduled_date,
            "completed_activity_id": None,
        }

    async def attach_activity(
        self,
        _session_id: str,
        _activity_id: str,
        _completed_on_date: str,
        status: str,
        _updated_at: datetime,
    ) -> dict:
        self.attached_status = status
        return {"id": "planned-1"}


@pytest.mark.asyncio
async def test_preview_hashes_bytes_defaults_wednesday_run_and_does_not_cache_bytes() -> None:
    importer, cache, _samples = service()

    preview = await importer.preview(b"private-fit-bytes", "run.fit")

    assert preview.activity.source.checksum_sha256 == sha256(b"private-fit-bytes").hexdigest()
    assert preview.activity.category == "run_club"
    entry = cache.get(preview.preview_token)
    assert not hasattr(entry, "content")
    assert b"private-fit-bytes" not in repr(entry).encode()


@pytest.mark.asyncio
async def test_confirm_persists_normalized_samples_and_consumes_token() -> None:
    importer, cache, samples = service()
    preview = await importer.preview(b"bytes", "run.fit")

    confirmed = await importer.confirm(FitImportConfirmRequest(preview_token=preview.preview_token))

    assert confirmed.activity.id == "activity-1"
    assert confirmed.samples_persisted == 2
    assert "heart_rate_response" in confirmed.activity.derived_metrics
    assert "heart_rate_drift" not in confirmed.activity.derived_metrics
    assert len(samples.chunks) == 1
    with pytest.raises(Exception, match="expired or does not exist"):
        cache.get(preview.preview_token)


@pytest.mark.asyncio
async def test_duplicate_requires_explicit_action() -> None:
    duplicate = {
        "id": "existing",
        "title": "Existing run",
        "local_date": "2026-08-05",
        "source": {"checksum_sha256": "different"},
    }
    importer, _cache, _samples = service(ActivitiesFake([duplicate]))
    preview = await importer.preview(b"bytes", "run.fit")

    with pytest.raises(ConflictError, match="Choose replace"):
        await importer.confirm(FitImportConfirmRequest(preview_token=preview.preview_token))


@pytest.mark.asyncio
async def test_planned_session_match_takes_priority_over_wednesday_default() -> None:
    sessions = CandidateSessionsFake()
    importer, _cache, _samples = service(sessions=sessions)

    preview = await importer.preview(b"bytes", "run.fit")

    assert preview.suggested_planned_session is not None
    assert preview.activity.planned_session_id == "planned-1"
    assert preview.activity.category == "track"
    assert sessions.match_query == {
        "training_plan_id": "active-plan",
        "start_date": "2026-08-05",
        "end_date": "2026-08-05",
        "sport": "run",
    }


@pytest.mark.asyncio
async def test_preview_does_not_suggest_a_planned_session_on_another_date() -> None:
    sessions = CandidateSessionsFake(scheduled_date="2026-08-04")
    importer, _cache, _samples = service(sessions=sessions)

    preview = await importer.preview(b"bytes", "run.fit")

    assert preview.suggested_planned_session is None
    assert preview.activity.planned_session_id is None
    assert preview.activity.category == "run_club"


@pytest.mark.asyncio
async def test_replacement_preserves_existing_editable_metadata() -> None:
    now = datetime(2026, 8, 1, tzinfo=UTC)
    existing = {
        "id": "existing",
        "schema_version": 1,
        "sport": "run",
        "category": "easy",
        "title": "My preserved title",
        "started_at_utc": datetime(2026, 8, 5, 11, tzinfo=UTC),
        "timezone": "America/New_York",
        "local_date": "2026-08-05",
        "distance_meters": 5000,
        "elapsed_time_seconds": 1800,
        "moving_time_seconds": None,
        "summary": {},
        "laps": [],
        "subjective": {"notes": "Preserve this"},
        "weather_notes": "Warm",
        "source": {"type": "fit", "checksum_sha256": "different"},
        "planned_session_id": None,
        "derived_metrics": {},
        "created_at_utc": now,
        "updated_at_utc": now,
    }
    importer, _cache, _samples = service(ActivitiesFake([existing]))
    preview = await importer.preview(b"bytes", "run.fit")

    result = await importer.confirm(
        FitImportConfirmRequest(
            preview_token=preview.preview_token,
            duplicate_action="replace",
            duplicate_activity_id="existing",
        )
    )

    assert result.activity.title == "My preserved title"
    assert result.activity.subjective.notes == "Preserve this"
    assert result.activity.weather_notes == "Warm"
