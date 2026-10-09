from typing import Any

from fastapi import APIRouter, Query, status
from fastapi.responses import PlainTextResponse

from app.api.dependencies import AiReviewServiceDependency, RuntimeSettings
from app.schemas.ai_reviews import (
    AiReviewApplyRequest,
    AiReviewApplyResponse,
    AiReviewCreateRequest,
    AiReviewReplyRequest,
    AiReviewStatusResponse,
)

router = APIRouter(prefix="/ai-reviews")


@router.get("/status", response_model=AiReviewStatusResponse)
async def ai_review_status(config: RuntimeSettings) -> AiReviewStatusResponse:
    return AiReviewStatusResponse(enabled=config.ai_reviews_enabled)


@router.get("", response_model=list[dict[str, Any]])
async def list_ai_reviews(
    service: AiReviewServiceDependency, activity_id: str = Query(min_length=1)
) -> list[dict[str, Any]]:
    return await service.client.list_for_activity(activity_id)


@router.post("", response_model=dict[str, Any], status_code=status.HTTP_201_CREATED)
async def create_ai_review(
    payload: AiReviewCreateRequest, service: AiReviewServiceDependency
) -> dict[str, Any]:
    """Runs a review: sends the session and recent training to the AI provider (~25 s)."""
    return await service.client.create(payload.activity_id)


@router.get("/{review_id}", response_model=dict[str, Any])
async def get_ai_review(review_id: str, service: AiReviewServiceDependency) -> dict[str, Any]:
    return await service.client.get(review_id)


@router.get("/{review_id}/context", response_class=PlainTextResponse)
async def get_ai_review_context(review_id: str, service: AiReviewServiceDependency) -> str:
    """Exactly what was sent to the AI provider for this review."""
    return await service.client.context(review_id)


@router.post("/{review_id}/replies", response_model=dict[str, Any])
async def reply_to_ai_review(
    review_id: str, payload: AiReviewReplyRequest, service: AiReviewServiceDependency
) -> dict[str, Any]:
    return await service.client.reply(review_id, payload.message)


@router.post("/{review_id}/apply", response_model=AiReviewApplyResponse)
async def apply_ai_review(
    review_id: str, payload: AiReviewApplyRequest, service: AiReviewServiceDependency
) -> AiReviewApplyResponse:
    """Applies the approved proposals to their planned sessions."""
    return await service.apply(review_id, payload.session_ids)
