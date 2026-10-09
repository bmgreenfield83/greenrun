from typing import Any

from pydantic import Field

from app.schemas.common import ApiModel


class AiReviewStatusResponse(ApiModel):
    enabled: bool


class AiReviewCreateRequest(ApiModel):
    activity_id: str = Field(min_length=1)


class AiReviewReplyRequest(ApiModel):
    message: str = Field(min_length=1, max_length=4000)


class AiReviewApplyRequest(ApiModel):
    session_ids: list[str] = Field(min_length=1)


class AiReviewSkip(ApiModel):
    session_id: str
    reason: str


class AiReviewApplyResponse(ApiModel):
    applied: list[str]
    skipped: list[AiReviewSkip]
    # The review as green-ai returns it; Greenrun passes it through unchanged.
    review: dict[str, Any]
