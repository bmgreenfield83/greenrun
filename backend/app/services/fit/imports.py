from collections import defaultdict
from hashlib import sha256
from typing import Any

from anyio import to_thread

from app.core.errors import ConflictError, NotFoundError
from app.models.enums import RunCategory
from app.repositories.activities import ActivityRepository, ActivitySampleRepository
from app.repositories.plans import PlannedSessionRepository, TrainingPlanRepository
from app.schemas.activities import ActivityCreate, ActivityResponse, SubjectiveData
from app.schemas.common import utc_now
from app.schemas.fit_imports import (
    DuplicateMatch,
    FitImportConfirmRequest,
    FitImportConfirmResponse,
    FitImportPreviewResponse,
    PlannedSessionSuggestion,
)
from app.services.analytics import calculate_heart_rate_response
from app.services.fit.cache import PREVIEW_TTL_SECONDS, FitPreviewCache
from app.services.fit.models import ActivitySample, FitActivityParser


def chunk_samples(samples: list[ActivitySample], chunk_seconds: int) -> list[dict[str, Any]]:
    groups: dict[int, list[ActivitySample]] = defaultdict(list)
    for sample in samples:
        groups[sample.elapsed_seconds // chunk_seconds].append(sample)
    return [
        {
            "schema_version": 1,
            "chunk_index": index,
            "start_elapsed_seconds": values[0].elapsed_seconds,
            "end_elapsed_seconds": values[-1].elapsed_seconds,
            "samples": [value.model_dump(mode="python") for value in values],
        }
        for index, values in sorted(groups.items())
    ]


class FitImportService:
    def __init__(
        self,
        parser: FitActivityParser,
        cache: FitPreviewCache,
        activities: ActivityRepository,
        samples: ActivitySampleRepository,
        sessions: PlannedSessionRepository,
        plans: TrainingPlanRepository,
        *,
        sample_interval_seconds: int,
        sample_chunk_seconds: int,
    ) -> None:
        self.parser = parser
        self.cache = cache
        self.activities = activities
        self.samples = samples
        self.sessions = sessions
        self.plans = plans
        self.sample_interval_seconds = sample_interval_seconds
        self.sample_chunk_seconds = sample_chunk_seconds

    async def preview(
        self, content: bytes, filename: str, *, garmin_activity_id: str | None = None
    ) -> FitImportPreviewResponse:
        """Parse a FIT file and check it for duplicates. Garmin sync passes the Connect activity ID,
        which the FIT file itself does not always carry, so it is stored and checked too."""
        checksum = sha256(content).hexdigest()
        parsed = await to_thread.run_sync(
            self.parser.parse, content, filename, self.sample_interval_seconds
        )
        parsed.activity.source.checksum_sha256 = checksum
        parsed.activity.source.imported_at_utc = utc_now()
        if garmin_activity_id:
            parsed.activity.source.garmin_activity_id = garmin_activity_id
        duplicate_documents = await self.activities.find_duplicates(
            checksum=checksum,
            garmin_activity_id=parsed.activity.source.garmin_activity_id,
            started_at=parsed.activity.started_at_utc,
            elapsed_seconds=parsed.activity.elapsed_time_seconds,
            distance_meters=parsed.activity.distance_meters,
        )
        duplicates = [self._duplicate_match(item, parsed.activity) for item in duplicate_documents]
        suggestion = await self._suggest_session(parsed.activity)
        if suggestion:
            parsed.activity.planned_session_id = suggestion.planned_session_id
            if parsed.activity.sport == "run" and suggestion.session_type in RunCategory:
                parsed.activity.category = suggestion.session_type
        elif parsed.activity.sport == "run" and parsed.activity.local_date.weekday() == 2:
            parsed.activity.category = "run_club"
        token = self.cache.put(parsed, duplicates, suggestion)
        return FitImportPreviewResponse(
            preview_token=token,
            expires_in_seconds=PREVIEW_TTL_SECONDS,
            activity=parsed.activity,
            sample_count=len(parsed.samples),
            duplicate_matches=duplicates,
            suggested_planned_session=suggestion,
        )

    def _duplicate_match(self, item: dict[str, Any], incoming: ActivityCreate) -> DuplicateMatch:
        source = item.get("source", {})
        if source.get("checksum_sha256") == incoming.source.checksum_sha256:
            reason = "checksum"
        elif incoming.source.garmin_activity_id and (
            source.get("garmin_activity_id") == incoming.source.garmin_activity_id
        ):
            reason = "garmin_activity_id"
        else:
            reason = "activity_signature"
        return DuplicateMatch(
            activity_id=item["id"],
            title=item.get("title"),
            local_date=item["local_date"],
            reason=reason,
        )

    async def _suggest_session(self, activity: ActivityCreate) -> PlannedSessionSuggestion | None:
        active_plan = await self.plans.get_active()
        if not active_plan:
            return None
        local_date = activity.local_date.isoformat()
        same_day = await self.sessions.find_match_candidates(
            training_plan_id=active_plan["id"],
            start_date=local_date,
            end_date=local_date,
            sport=activity.sport,
        )
        scored: list[tuple[float, dict[str, Any]]] = []
        for session in same_day:
            scheduled_date = session["scheduled_date"]
            if isinstance(scheduled_date, str):
                scheduled_date = activity.local_date.fromisoformat(scheduled_date)
            if scheduled_date != activity.local_date:
                continue
            score = 100
            planned_distance = session.get("planned_distance_meters")
            if planned_distance and activity.distance_meters:
                difference = abs(planned_distance - activity.distance_meters) / planned_distance
                score += max(0, 25 - difference * 50)
            if activity.category and session.get("session_type") == activity.category:
                score += 20
            scored.append((score, session))
        if not scored:
            return None
        score, session = max(scored, key=lambda item: item[0])
        return PlannedSessionSuggestion(
            planned_session_id=session["id"],
            title=session["title"],
            scheduled_date=session["scheduled_date"],
            session_type=session["session_type"],
            score=round(score, 1),
        )

    async def confirm(self, request: FitImportConfirmRequest) -> FitImportConfirmResponse:
        entry = self.cache.get(request.preview_token)
        duplicate_ids = {match.activity_id for match in entry.duplicates}
        if entry.duplicates and request.duplicate_action == "create":
            raise ConflictError("Choose replace, import as duplicate, or cancel this import.")
        if request.duplicate_action == "replace":
            if (
                not request.duplicate_activity_id
                or request.duplicate_activity_id not in duplicate_ids
            ):
                raise ConflictError("Select one of the detected duplicate activities to replace.")
            existing = await self.activities.get(request.duplicate_activity_id)
            if not existing:
                raise NotFoundError("The activity selected for replacement no longer exists.")
        else:
            existing = None

        activity = self._apply_metadata(entry.parsed.activity, request, existing)
        activity = activity.model_copy(
            update={
                "derived_metrics": activity.derived_metrics
                | {
                    "heart_rate_response": calculate_heart_rate_response(
                        activity, entry.parsed.samples
                    )
                }
            }
        )
        if activity.planned_session_id:
            selected_session = await self.sessions.get(activity.planned_session_id)
            if not selected_session:
                raise NotFoundError("The selected planned session no longer exists.")
            fulfilled_by = selected_session.get("completed_activity_id")
            if fulfilled_by and (not existing or fulfilled_by != existing["id"]):
                raise ConflictError("The selected planned session is already fulfilled.")
        now = utc_now()
        document = activity.model_dump(mode="python") | {
            "schema_version": 1,
            "created_at_utc": existing["created_at_utc"] if existing else now,
            "updated_at_utc": now,
        }
        if existing:
            activity_id = existing["id"]
            await self.sessions.detach_activity(activity_id, now)
            persisted = await self.activities.replace(activity_id, document)
            if not persisted:
                raise NotFoundError("The activity selected for replacement no longer exists.")
        else:
            persisted = await self.activities.create(document)
            activity_id = persisted["id"]

        chunks = chunk_samples(entry.parsed.samples, self.sample_chunk_seconds)
        try:
            await self.samples.replace_chunks(activity_id, chunks)
            if activity.planned_session_id:
                await self._attach_session(activity.planned_session_id, activity_id, activity)
        except Exception:
            if not existing:
                await self.activities.delete(activity_id)
            raise
        self.cache.remove(request.preview_token)
        return FitImportConfirmResponse(
            activity=ActivityResponse.model_validate(persisted),
            samples_persisted=len(entry.parsed.samples),
        )

    def _apply_metadata(
        self,
        parsed: ActivityCreate,
        request: FitImportConfirmRequest,
        existing: dict[str, Any] | None,
    ) -> ActivityCreate:
        values = parsed.model_dump(mode="python")
        if existing:
            for field in (
                "title",
                "category",
                "subjective",
                "weather_notes",
                "planned_session_id",
                "heart_rate_analysis_start_distance_meters",
            ):
                values[field] = existing.get(field)
        supplied = request.metadata.model_dump(mode="python", exclude_unset=True)
        subjective = supplied.pop("subjective", None)
        values.update(supplied)
        if subjective is not None:
            base = SubjectiveData.model_validate(values.get("subjective") or {}).model_dump(
                mode="python"
            )
            values["subjective"] = base | request.metadata.subjective.model_dump(
                mode="python", exclude_unset=True
            )
        return ActivityCreate.model_validate(values)

    async def _attach_session(
        self, session_id: str, activity_id: str, activity: ActivityCreate
    ) -> None:
        session = await self.sessions.get(session_id)
        if not session:
            raise NotFoundError("The selected planned session no longer exists.")
        scheduled = session["scheduled_date"]
        if not isinstance(scheduled, str):
            scheduled = scheduled.isoformat()
        completed = activity.local_date.isoformat()
        status = "completed"
        if completed > scheduled:
            status = "completed_late"
        elif completed < scheduled:
            status = "completed_early"
        attached = await self.sessions.attach_activity(
            session_id, activity_id, completed, status, utc_now()
        )
        if not attached:
            raise ConflictError("The selected planned session is already fulfilled.")
