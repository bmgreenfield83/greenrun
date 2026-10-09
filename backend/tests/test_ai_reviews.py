from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.api.dependencies import get_ai_review_service, get_session_service
from app.core.config import Settings
from app.core.errors import NotFoundError
from app.main import create_app
from app.services.ai_reviews import AiReviewService, AiServiceError, GreenAiClient

EDITED_AT = "2026-09-08T14:28:59.787000"


def review(*session_ids: str) -> dict[str, Any]:
    return {
        "id": "review-1",
        "proposed_patches": [
            {"session_id": s, "patch": {"title": f"New {s}", "planned_distance_meters": 6437.4}}
            for s in session_ids
        ],
        "editable_sessions": [{"id": s, "updated_at_utc": EDITED_AT} for s in session_ids],
    }


class FakeGreenAi:
    def __init__(self, current: dict[str, Any]) -> None:
        self.current = current
        self.marked: list[list[str]] = []

    async def get(self, review_id: str) -> dict[str, Any]:
        return self.current

    async def create(self, activity_id: str) -> dict[str, Any]:
        return {"id": "review-1", "activity_id": activity_id}

    async def mark_applied(self, review_id: str, session_ids: list[str]) -> dict[str, Any]:
        self.marked.append(session_ids)
        return {**self.current, "applied": dict.fromkeys(session_ids, "now")}


class FakeSessions:
    def __init__(self, sessions: dict[str, SimpleNamespace]) -> None:
        self.sessions = sessions
        self.updates: list[tuple[str, dict[str, Any]]] = []

    async def get(self, session_id: str) -> SimpleNamespace:
        if session_id not in self.sessions:
            raise NotFoundError("Planned session not found.")
        return self.sessions[session_id]

    async def update(self, session_id: str, payload: Any) -> None:
        self.updates.append((session_id, payload.model_dump(exclude_unset=True)))


def session(status: str = "planned", edited: str = EDITED_AT, completed: str | None = None):
    return SimpleNamespace(
        status=status,
        completed_activity_id=completed,
        updated_at_utc=datetime.fromisoformat(edited).replace(tzinfo=UTC),
    )


def app_with(green_ai_url: str = "http://green-ai:8000", service: AiReviewService | None = None):
    settings = Settings(
        mongodb_uri=SecretStr("mongodb://example.invalid"),
        app_env="test",
        green_ai_url=green_ai_url,
    )
    app = create_app(settings)
    app.state.settings = settings
    app.dependency_overrides[get_session_service] = lambda: FakeSessions({})
    if service is not None:
        app.dependency_overrides[get_ai_review_service] = lambda: service
    return TestClient(app)


def test_status_reports_whether_reviews_are_configured() -> None:
    assert app_with().get("/api/ai-reviews/status").json() == {"enabled": True}
    assert app_with(green_ai_url="").get("/api/ai-reviews/status").json() == {"enabled": False}


def test_reviews_are_unavailable_when_not_configured() -> None:
    response = app_with(green_ai_url="").post("/api/ai-reviews", json={"activity_id": "a1"})
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "ai_reviews_disabled"


def test_create_passes_the_review_through() -> None:
    service = AiReviewService(FakeGreenAi(review()), FakeSessions({}))
    response = app_with(service=service).post("/api/ai-reviews", json={"activity_id": "a1"})
    assert response.status_code == 201
    assert response.json() == {"id": "review-1", "activity_id": "a1"}


def test_apply_writes_only_planned_unchanged_proposed_sessions() -> None:
    green_ai = FakeGreenAi(review("fresh", "edited", "done", "gone"))
    sessions = FakeSessions(
        {
            "fresh": session(),
            "edited": session(edited="2026-10-08T19:00:00"),
            "done": session(status="completed", completed="activity-9"),
            "unproposed": session(),
        }
    )
    service = AiReviewService(green_ai, sessions)
    response = app_with(service=service).post(
        "/api/ai-reviews/review-1/apply",
        json={"session_ids": ["fresh", "edited", "done", "gone", "unproposed", "fresh"]},
    )
    body = response.json()
    assert body["applied"] == ["fresh"]
    assert {s["session_id"]: s["reason"] for s in body["skipped"]} == {
        "edited": "The session was edited after the review was written. Run a new review.",
        "done": "The session is no longer planned.",
        "gone": "The session no longer exists.",
        "unproposed": "The review has no proposal for this session.",
    }
    assert sessions.updates == [
        ("fresh", {"title": "New fresh", "planned_distance_meters": 6437.4})
    ]
    assert green_ai.marked == [["fresh"]]
    assert body["review"]["applied"] == {"fresh": "now"}


def test_apply_with_nothing_applicable_records_nothing() -> None:
    green_ai = FakeGreenAi(review("done"))
    service = AiReviewService(green_ai, FakeSessions({"done": session(status="skipped")}))
    body = (
        app_with(service=service)
        .post("/api/ai-reviews/review-1/apply", json={"session_ids": ["done"]})
        .json()
    )
    assert body["applied"] == [] and green_ai.marked == []


def transport(status: int, body: Any = None, error: bool = False) -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        if error:
            raise httpx.ConnectError("refused", request=request)
        return httpx.Response(status, json=body)

    return httpx.MockTransport(handler)


async def test_client_maps_green_ai_failures_to_readable_errors() -> None:
    with pytest.raises(NotFoundError):
        await GreenAiClient("http://x", transport(404, {"detail": "Review not found."})).get("r")
    with pytest.raises(AiServiceError, match="Response did not complete"):
        await GreenAiClient(
            "http://x", transport(502, {"detail": "Response did not complete"})
        ).create("a")
    with pytest.raises(AiServiceError, match="could not be reached"):
        await GreenAiClient("http://x", transport(0, error=True)).create("a")


async def test_client_returns_json_on_success() -> None:
    client = GreenAiClient("http://x", transport(200, [{"id": "r1"}]))
    assert await client.list_for_activity("a1") == [{"id": "r1"}]
