from datetime import date
from typing import Literal

from pydantic import Field

from app.schemas.activities import ActivityCreate, ActivityMetadataUpdate, ActivityResponse
from app.schemas.common import ApiModel


class DuplicateMatch(ApiModel):
    activity_id: str
    title: str | None
    local_date: date
    reason: Literal["checksum", "garmin_activity_id", "activity_signature"]


class PlannedSessionSuggestion(ApiModel):
    planned_session_id: str
    title: str
    scheduled_date: date
    session_type: str
    score: float


class FitImportPreviewResponse(ApiModel):
    preview_token: str
    expires_in_seconds: int
    activity: ActivityCreate
    sample_count: int
    duplicate_matches: list[DuplicateMatch]
    suggested_planned_session: PlannedSessionSuggestion | None = None


class FitImportConfirmRequest(ApiModel):
    preview_token: str
    duplicate_action: Literal["create", "replace", "import_duplicate"] = "create"
    duplicate_activity_id: str | None = None
    metadata: ActivityMetadataUpdate = Field(default_factory=ActivityMetadataUpdate)


class FitImportConfirmResponse(ApiModel):
    activity: ActivityResponse
    samples_persisted: int


class ActivitySampleChunkResponse(ApiModel):
    id: str
    activity_id: str
    schema_version: int
    chunk_index: int
    start_elapsed_seconds: int
    end_elapsed_seconds: int
    samples: list[dict[str, float | int | None]]


class ActivitySamplesResponse(ApiModel):
    items: list[ActivitySampleChunkResponse]
    sample_count: int
