"""AI track-session reviews through the green-ai service.

green-ai reads Greenrun's API, asks a model for a review, and proposes session changes. It never
writes to Greenrun: changes are applied here, only for sessions Brett approves, and only if the
session is still planned and unchanged since the review was written.
"""

from datetime import UTC, datetime
from typing import Any

import httpx

from app.core.errors import AppError, NotFoundError
from app.models.enums import SessionStatus
from app.schemas.ai_reviews import AiReviewApplyResponse, AiReviewSkip
from app.schemas.plans import PlannedSessionUpdate
from app.services.plans import PlannedSessionService

# A review takes about 25 seconds; allow for a retry inside green-ai.
REVIEW_TIMEOUT_SECONDS = 180.0


class AiReviewsDisabledError(AppError):
    status_code = 503
    code = "ai_reviews_disabled"


class AiServiceError(AppError):
    status_code = 502
    code = "ai_service_error"


class GreenAiClient:
    def __init__(self, base_url: str, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self.base_url = base_url.rstrip("/")
        self.transport = transport

    async def _request(self, method: str, path: str, **kwargs: Any) -> httpx.Response:
        try:
            async with httpx.AsyncClient(
                base_url=self.base_url, timeout=REVIEW_TIMEOUT_SECONDS, transport=self.transport
            ) as client:
                response = await client.request(method, path, **kwargs)
        except httpx.HTTPError as error:
            raise AiServiceError(
                "The AI service could not be reached. Try again shortly."
            ) from error
        if response.status_code == 404:
            raise NotFoundError("AI review not found.")
        if response.is_error:
            try:
                detail = response.json().get("detail")
            except ValueError:
                detail = None
            raise AiServiceError(
                detail if isinstance(detail, str) else "The AI service failed. Try again shortly."
            )
        return response

    async def list_for_activity(self, activity_id: str) -> list[dict[str, Any]]:
        return (
            await self._request("GET", "/track-reviews", params={"activity_id": activity_id})
        ).json()

    async def create(self, activity_id: str) -> dict[str, Any]:
        return (
            await self._request("POST", "/track-reviews", json={"activity_id": activity_id})
        ).json()

    async def get(self, review_id: str) -> dict[str, Any]:
        return (await self._request("GET", f"/track-reviews/{review_id}")).json()

    async def context(self, review_id: str) -> str:
        return (await self._request("GET", f"/track-reviews/{review_id}/context")).text

    async def reply(self, review_id: str, message: str) -> dict[str, Any]:
        response = await self._request(
            "POST", f"/track-reviews/{review_id}/replies", json={"message": message}
        )
        return response.json()

    async def mark_applied(self, review_id: str, session_ids: list[str]) -> dict[str, Any]:
        response = await self._request(
            "POST", f"/track-reviews/{review_id}/applied", json={"session_ids": session_ids}
        )
        return response.json()


def as_utc(value: datetime | str | None) -> datetime | None:
    if value is None:
        return None
    parsed = datetime.fromisoformat(value) if isinstance(value, str) else value
    return parsed.replace(tzinfo=UTC) if parsed.tzinfo is None else parsed.astimezone(UTC)


class AiReviewService:
    def __init__(self, client: GreenAiClient, sessions: PlannedSessionService) -> None:
        self.client = client
        self.sessions = sessions

    async def apply(self, review_id: str, session_ids: list[str]) -> AiReviewApplyResponse:
        review = await self.client.get(review_id)
        patches = {item["session_id"]: item["patch"] for item in review["proposed_patches"]}
        snapshots = {item["id"]: item for item in review["editable_sessions"]}
        applied: list[str] = []
        skipped: list[AiReviewSkip] = []
        for session_id in dict.fromkeys(session_ids):
            reason = await self._apply_one(
                session_id, patches.get(session_id), snapshots.get(session_id)
            )
            if reason:
                skipped.append(AiReviewSkip(session_id=session_id, reason=reason))
            else:
                applied.append(session_id)
        if applied:
            review = await self.client.mark_applied(review_id, applied)
        return AiReviewApplyResponse(applied=applied, skipped=skipped, review=review)

    async def _apply_one(
        self, session_id: str, patch: dict[str, Any] | None, snapshot: dict[str, Any] | None
    ) -> str | None:
        """Applies one proposal, or returns why it was skipped."""
        if patch is None or snapshot is None:
            return "The review has no proposal for this session."
        try:
            current = await self.sessions.get(session_id)
        except NotFoundError:
            return "The session no longer exists."
        if current.status != SessionStatus.PLANNED or current.completed_activity_id:
            return "The session is no longer planned."
        if as_utc(current.updated_at_utc) != as_utc(snapshot.get("updated_at_utc")):
            return "The session was edited after the review was written. Run a new review."
        await self.sessions.update(session_id, PlannedSessionUpdate.model_validate(patch))
        return None
