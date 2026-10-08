from datetime import date
from typing import Literal

from app.schemas.common import ApiModel
from app.schemas.fit_imports import FitImportPreviewResponse


class GarminSyncRequest(ApiModel):
    date: date


class GarminSyncItem(ApiModel):
    garmin_activity_id: str
    name: str | None = None
    started_at_local: str | None = None
    distance_meters: float | None = None
    # ready: previewed and waiting to be confirmed through the FIT import flow.
    status: Literal["ready", "already_imported", "error"]
    activity_id: str | None = None
    preview: FitImportPreviewResponse | None = None
    error: str | None = None


class GarminSyncResponse(ApiModel):
    date: date
    # ready: at least one new run to import; failed: nothing new could be downloaded.
    status: Literal["ready", "no_activities", "already_imported", "failed"]
    items: list[GarminSyncItem]
