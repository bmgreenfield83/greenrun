from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.core.config import Settings
from app.db.client import MongoResources
from app.main import create_app


def make_settings() -> Settings:
    return Settings(mongodb_uri=SecretStr("mongodb://example.invalid"), app_env="test")


def mock_resources() -> MongoResources:
    client = AsyncMock()
    return MongoResources(client=client, database=object())


def test_liveness_does_not_require_database() -> None:
    resources = mock_resources()
    with patch("app.main.create_mongo_resources", return_value=resources):
        with TestClient(create_app(make_settings())) as client:
            response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    resources.client.close.assert_awaited_once()


def test_readiness_reports_connected_database() -> None:
    resources = mock_resources()
    with (
        patch("app.main.create_mongo_resources", return_value=resources),
        patch("app.api.routes.health.check_mongo_connection", new=AsyncMock()) as check,
    ):
        with TestClient(create_app(make_settings())) as client:
            response = client.get("/api/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ready", "database": "connected"}
    check.assert_awaited_once_with(resources)


def test_readiness_sanitizes_database_failure() -> None:
    resources = mock_resources()
    check = AsyncMock(side_effect=RuntimeError("contains sensitive connection details"))
    with (
        patch("app.main.create_mongo_resources", return_value=resources),
        patch("app.api.routes.health.check_mongo_connection", new=check),
    ):
        with TestClient(create_app(make_settings())) as client:
            response = client.get("/api/ready")

    assert response.status_code == 503
    assert response.json() == {"status": "unavailable", "database": "unavailable"}
    assert "sensitive" not in response.text


def test_cors_allows_an_explicit_network_frontend_origin() -> None:
    resources = mock_resources()
    settings = Settings(
        mongodb_uri=SecretStr("mongodb://example.invalid"),
        app_env="test",
        frontend_origins="http://localhost:5174,http://100.64.0.10:5174",
    )
    with patch("app.main.create_mongo_resources", return_value=resources):
        with TestClient(create_app(settings)) as client:
            response = client.options(
                "/api/health",
                headers={
                    "Origin": "http://100.64.0.10:5174",
                    "Access-Control-Request-Method": "GET",
                },
            )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://100.64.0.10:5174"
