"""Manual Garmin Connect sync: find the day's runs, skip ones already imported, and hand the rest to
the FIT import flow as previews. Saving still goes through FIT import confirmation, so a synced run
gets the same duplicate checks and planned-session matching as an uploaded file."""

from datetime import date
from typing import Any, Protocol

from anyio import to_thread

from app.core.errors import AppError
from app.schemas.fit_imports import FitImportPreviewResponse
from app.schemas.garmin_sync import GarminSyncItem, GarminSyncResponse
from app.services.garmin.archive import extract_fit
from app.services.garmin.client import GarminGateway, GarminRun
from app.services.garmin.errors import GarminSessionError


class FitPreviewer(Protocol):
    async def preview(
        self, content: bytes, filename: str, *, garmin_activity_id: str | None = None
    ) -> FitImportPreviewResponse: ...


class GarminActivityLookup(Protocol):
    async def find_by_garmin_activity_id(
        self, garmin_activity_id: str
    ) -> dict[str, Any] | None: ...


class GarminSyncService:
    def __init__(
        self,
        gateway: GarminGateway,
        fit_imports: FitPreviewer,
        activities: GarminActivityLookup,
        *,
        max_fit_bytes: int,
    ) -> None:
        self.gateway = gateway
        self.fit_imports = fit_imports
        self.activities = activities
        self.max_fit_bytes = max_fit_bytes

    async def sync(self, day: date) -> GarminSyncResponse:
        runs = await to_thread.run_sync(self.gateway.list_runs, day)
        if not runs:
            return GarminSyncResponse(date=day, status="no_activities", items=[])
        items = [await self._sync_run(run) for run in runs]
        statuses = {item.status for item in items}
        if "ready" in statuses:
            status = "ready"
        elif statuses == {"already_imported"}:
            status = "already_imported"
        else:
            status = "failed"
        return GarminSyncResponse(date=day, status=status, items=items)

    async def _sync_run(self, run: GarminRun) -> GarminSyncItem:
        summary = {
            "garmin_activity_id": run.activity_id,
            "name": run.name,
            "started_at_local": run.started_at_local,
            "distance_meters": run.distance_meters,
        }
        existing = await self.activities.find_by_garmin_activity_id(run.activity_id)
        if existing:
            return GarminSyncItem(**summary, status="already_imported", activity_id=existing["id"])
        try:
            archive = await to_thread.run_sync(self.gateway.download_original, run.activity_id)
            content, filename = extract_fit(
                archive,
                fallback_name=f"garmin-{run.activity_id}.fit",
                max_bytes=self.max_fit_bytes,
            )
            preview = await self.fit_imports.preview(
                content, filename, garmin_activity_id=run.activity_id
            )
        except GarminSessionError:
            raise  # sign-in or rate-limit trouble affects every run, so stop the whole sync
        except AppError as error:
            return GarminSyncItem(**summary, status="error", error=error.message)
        return GarminSyncItem(**summary, status="ready", preview=preview)
