import zipfile
from datetime import date
from io import BytesIO
from typing import Any

import pytest
from fastapi.testclient import TestClient
from garminconnect import (
    GarminConnectAuthenticationError,
    GarminConnectConnectionError,
    GarminConnectTooManyRequestsError,
)
from pydantic import SecretStr

from app.api.dependencies import get_garmin_sync_service
from app.core.config import Settings
from app.main import create_app
from app.schemas.activities import ActivityCreate, ActivitySource
from app.schemas.fit_imports import FitImportPreviewResponse
from app.schemas.garmin_sync import GarminSyncResponse
from app.services.fit.garmin import InvalidFitError
from app.services.garmin.archive import extract_fit
from app.services.garmin.client import GarminConnectClient, GarminRun, runs_on
from app.services.garmin.errors import (
    GarminArchiveError,
    GarminAuthenticationError,
    GarminRateLimitedError,
    GarminSetupRequiredError,
    GarminUnavailableError,
)
from app.services.garmin.sync import GarminSyncService

DAY = date(2026, 10, 8)
# Enough of a FIT header for the signature check: ".FIT" at bytes 8-11.
FIT = bytes(8) + b".FIT" + b"activity-data"


def summary(activity_id: int, type_key: str, start: str, parent: int | None = None) -> dict:
    return {
        "activityId": activity_id,
        "activityName": f"Activity {activity_id}",
        "startTimeLocal": start,
        "distance": 8046.7,
        "duration": 2700.0,
        "activityType": {"typeKey": type_key, "parentTypeId": parent},
    }


def zipped(files: dict[str, bytes]) -> bytes:
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for name, content in files.items():
            archive.writestr(name, content)
    return buffer.getvalue()


# -- Activity lookup ------------------------------------------------------------------------------


def test_runs_on_keeps_only_the_days_runs_oldest_first() -> None:
    runs = runs_on(
        [
            summary(3, "running", "2026-10-08 17:45:00"),
            summary(1, "treadmill_running", "2026-10-08 06:10:00", parent=1),
            summary(2, "trail_running", "2026-10-08 12:00:00"),
            summary(4, "cycling", "2026-10-08 09:00:00", parent=2),
            summary(5, "running", "2026-10-07 23:30:00"),
            summary(6, "strength_training", "2026-10-08 07:00:00"),
        ],
        DAY,
    )

    assert [run.activity_id for run in runs] == ["1", "2", "3"]
    assert runs[0] == GarminRun(
        activity_id="1",
        name="Activity 1",
        started_at_local="2026-10-08 06:10:00",
        distance_meters=8046.7,
        duration_seconds=2700.0,
    )


# -- FIT extraction -------------------------------------------------------------------------------


def test_extract_fit_reads_the_fit_file_from_the_zip_in_memory() -> None:
    content, filename = extract_fit(
        zipped({"readme.txt": b"hello", "nested/123_ACTIVITY.fit": FIT}),
        fallback_name="garmin-123.fit",
        max_bytes=1_000,
    )

    assert content == FIT
    assert filename == "123_ACTIVITY.fit"


def test_extract_fit_accepts_a_bare_fit_download() -> None:
    assert extract_fit(FIT, fallback_name="garmin-1.fit", max_bytes=1_000) == (
        FIT,
        "garmin-1.fit",
    )


@pytest.mark.parametrize(
    ("download", "message"),
    [
        (b"<html>Sign in</html>", "neither a ZIP archive nor a FIT file"),
        (zipped({"activity.gpx": b"<gpx/>"}), "did not contain a FIT file"),
        (zipped({"activity.fit": b"not really fit"}), "not a valid FIT file"),
        (zipped({"activity.fit": FIT * 100}), "exceeds the configured FIT size limit"),
    ],
)
def test_extract_fit_rejects_unusable_downloads(download: bytes, message: str) -> None:
    with pytest.raises(GarminArchiveError, match=message):
        extract_fit(download, fallback_name="garmin-1.fit", max_bytes=500)


# -- Garmin client: session reuse and error handling ----------------------------------------------


class LibraryFake:
    class ActivityDownloadFormat:
        ORIGINAL = "original"

    def __init__(self, error: Exception | None = None) -> None:
        self.error = error
        self.logins: list[str] = []
        self.downloads: list[tuple[str, str]] = []

    def login(self, tokenstore: str) -> tuple[None, None]:
        self.logins.append(tokenstore)
        return None, None

    def get_activities_by_date(self, start: str, end: str) -> list[dict]:
        if self.error:
            raise self.error
        assert start == end == "2026-10-08"
        return [summary(11, "running", "2026-10-08 06:00:00")]

    def download_activity(self, activity_id: str, dl_fmt: str) -> bytes:
        self.downloads.append((activity_id, dl_fmt))
        return FIT


def client_for(*libraries: LibraryFake) -> tuple[GarminConnectClient, list[tuple]]:
    created: list[tuple] = []
    pending = list(libraries)

    def factory(email: str | None, password: str | None) -> LibraryFake:
        created.append((email, password))
        return pending.pop(0)

    client = GarminConnectClient(
        email=" runner@example.com ", password="secret", token_dir="/tokens", factory=factory
    )
    return client, created


def test_client_logs_in_once_with_saved_tokens_and_reuses_the_session() -> None:
    library = LibraryFake()
    client, created = client_for(library)

    runs = client.list_runs(DAY)
    download = client.download_original("11")

    assert [run.activity_id for run in runs] == ["11"]
    assert download == FIT
    assert created == [("runner@example.com", "secret")]
    assert library.logins == ["/tokens"]
    assert library.downloads == [("11", "original")]


@pytest.mark.parametrize(
    ("error", "expected"),
    [
        (
            GarminConnectAuthenticationError("MFA Required but no prompt_mfa mechanism supplied"),
            GarminSetupRequiredError,
        ),
        (
            GarminConnectAuthenticationError("Username and password are required"),
            GarminSetupRequiredError,
        ),
        (
            GarminConnectAuthenticationError("Invalid username or password"),
            GarminAuthenticationError,
        ),
        (GarminConnectTooManyRequestsError("429"), GarminRateLimitedError),
        (GarminConnectConnectionError("boom"), GarminUnavailableError),
        (TimeoutError("slow"), GarminUnavailableError),
    ],
)
def test_client_translates_library_errors(error: Exception, expected: type[Exception]) -> None:
    client, _created = client_for(LibraryFake(error))

    with pytest.raises(expected) as raised:
        client.list_runs(DAY)

    assert "secret" not in raised.value.message


def test_client_starts_a_fresh_session_after_garmin_rejects_the_sign_in() -> None:
    rejected = LibraryFake(GarminConnectAuthenticationError("Invalid username or password"))
    client, created = client_for(rejected, LibraryFake())

    with pytest.raises(GarminAuthenticationError):
        client.list_runs(DAY)
    assert [run.activity_id for run in client.list_runs(DAY)] == ["11"]
    assert len(created) == 2


# -- Sync service ---------------------------------------------------------------------------------


def run(activity_id: str, start: str = "2026-10-08 06:00:00") -> GarminRun:
    return GarminRun(
        activity_id=activity_id,
        name=f"Run {activity_id}",
        started_at_local=start,
        distance_meters=5000.0,
        duration_seconds=1500.0,
    )


class GatewayFake:
    def __init__(self, runs: list[GarminRun], downloads: dict[str, Any] | None = None) -> None:
        self.runs = runs
        self.downloads = downloads or {}
        self.downloaded: list[str] = []

    def list_runs(self, day: date) -> list[GarminRun]:
        assert day == DAY
        return self.runs

    def download_original(self, activity_id: str) -> bytes:
        self.downloaded.append(activity_id)
        result = self.downloads.get(activity_id, zipped({f"{activity_id}_ACTIVITY.fit": FIT}))
        if isinstance(result, Exception):
            raise result
        return result


class PreviewerFake:
    def __init__(self, error: Exception | None = None) -> None:
        self.error = error
        self.calls: list[tuple[bytes, str, str | None]] = []

    async def preview(
        self, content: bytes, filename: str, *, garmin_activity_id: str | None = None
    ) -> FitImportPreviewResponse:
        self.calls.append((content, filename, garmin_activity_id))
        if self.error:
            raise self.error
        return FitImportPreviewResponse(
            preview_token=f"token-{garmin_activity_id}",
            expires_in_seconds=900,
            activity=ActivityCreate(
                sport="run",
                started_at_utc="2026-10-08T10:00:00Z",
                local_date=DAY,
                elapsed_time_seconds=1500,
                source=ActivitySource(
                    type="fit", filename=filename, garmin_activity_id=garmin_activity_id
                ),
            ),
            sample_count=10,
            duplicate_matches=[],
        )


class LookupFake:
    def __init__(self, imported: dict[str, str] | None = None) -> None:
        self.imported = imported or {}

    async def find_by_garmin_activity_id(self, garmin_activity_id: str) -> dict | None:
        activity_id = self.imported.get(garmin_activity_id)
        return {"id": activity_id} if activity_id else None


def sync_service(
    gateway: GatewayFake,
    previewer: PreviewerFake | None = None,
    imported: dict[str, str] | None = None,
) -> GarminSyncService:
    return GarminSyncService(
        gateway, previewer or PreviewerFake(), LookupFake(imported), max_fit_bytes=10_000
    )


async def test_sync_reports_when_garmin_has_no_runs_that_day() -> None:
    result = await sync_service(GatewayFake([])).sync(DAY)

    assert result.status == "no_activities"
    assert result.items == []


async def test_sync_previews_every_new_run_with_its_garmin_id() -> None:
    gateway = GatewayFake([run("101"), run("102", "2026-10-08 18:00:00")])
    previewer = PreviewerFake()

    result = await sync_service(gateway, previewer).sync(DAY)

    assert result.status == "ready"
    assert [item.status for item in result.items] == ["ready", "ready"]
    assert result.items[0].preview.preview_token == "token-101"
    assert previewer.calls == [
        (FIT, "101_ACTIVITY.fit", "101"),
        (FIT, "102_ACTIVITY.fit", "102"),
    ]


async def test_sync_skips_runs_already_imported_without_downloading_them() -> None:
    gateway = GatewayFake([run("101"), run("102")])

    result = await sync_service(gateway, imported={"101": "a-1", "102": "a-2"}).sync(DAY)

    assert result.status == "already_imported"
    assert [(item.status, item.activity_id) for item in result.items] == [
        ("already_imported", "a-1"),
        ("already_imported", "a-2"),
    ]
    assert gateway.downloaded == []


async def test_sync_imports_new_runs_alongside_ones_already_imported() -> None:
    gateway = GatewayFake([run("101"), run("102")])

    result = await sync_service(gateway, imported={"101": "a-1"}).sync(DAY)

    assert result.status == "ready"
    assert [item.status for item in result.items] == ["already_imported", "ready"]
    assert gateway.downloaded == ["102"]


async def test_sync_reports_a_failed_download_and_keeps_going() -> None:
    gateway = GatewayFake(
        [run("101"), run("102"), run("103")],
        downloads={
            "101": GarminUnavailableError("Garmin Connect could not be reached."),
            "102": b"<html/>",
        },
    )

    result = await sync_service(gateway).sync(DAY)

    assert result.status == "ready"
    assert [item.status for item in result.items] == ["error", "error", "ready"]
    assert result.items[0].error == "Garmin Connect could not be reached."
    assert "neither a ZIP archive" in result.items[1].error


async def test_sync_reports_an_unreadable_fit_file_per_run() -> None:
    previewer = PreviewerFake(
        InvalidFitError("The FIT file failed its size or CRC integrity check.")
    )

    result = await sync_service(GatewayFake([run("101")]), previewer).sync(DAY)

    assert result.status == "failed"
    assert result.items[0].status == "error"
    assert "CRC" in result.items[0].error


async def test_sync_stops_when_the_garmin_session_is_unusable() -> None:
    gateway = GatewayFake(
        [run("101"), run("102")],
        downloads={"101": GarminRateLimitedError("Garmin is rate-limiting requests.")},
    )

    with pytest.raises(GarminRateLimitedError):
        await sync_service(gateway).sync(DAY)
    assert gateway.downloaded == ["101"]


# -- Route ----------------------------------------------------------------------------------------


class ServiceFake:
    def __init__(self, error: Exception | None = None) -> None:
        self.error = error
        self.days: list[date] = []

    async def sync(self, day: date) -> GarminSyncResponse:
        self.days.append(day)
        if self.error:
            raise self.error
        return GarminSyncResponse(date=day, status="no_activities", items=[])


def route_client(fake: ServiceFake) -> TestClient:
    settings = Settings(mongodb_uri=SecretStr("mongodb://example.invalid"), app_env="test")
    app = create_app(settings)
    app.dependency_overrides[get_garmin_sync_service] = lambda: fake
    return TestClient(app)


def test_sync_route_returns_the_structured_result() -> None:
    fake = ServiceFake()

    response = route_client(fake).post("/api/activities/garmin-sync", json={"date": "2026-10-08"})

    assert response.status_code == 200
    assert response.json() == {"date": "2026-10-08", "status": "no_activities", "items": []}
    assert fake.days == [DAY]


def test_sync_route_reports_garmin_errors_with_their_own_codes() -> None:
    fake = ServiceFake(GarminSetupRequiredError("Garmin needs you to sign in again."))

    response = route_client(fake).post("/api/activities/garmin-sync", json={"date": "2026-10-08"})

    assert response.status_code == 503
    assert response.json() == {
        "error": {
            "code": "garmin_setup_required",
            "message": "Garmin needs you to sign in again.",
        }
    }


def test_sync_route_rejects_a_missing_date() -> None:
    response = route_client(ServiceFake()).post("/api/activities/garmin-sync", json={})

    assert response.status_code == 422
