from pathlib import Path
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.core.config import Settings
from app.db.client import MongoResources
from app.main import create_app


def make_client(dist: Path) -> TestClient:
    settings = Settings(
        mongodb_uri=SecretStr("mongodb://example.invalid"),
        app_env="test",
        frontend_dist=str(dist),
    )
    return TestClient(create_app(settings))


def build_dist(tmp_path: Path) -> Path:
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<html>app</html>", encoding="utf-8")
    (dist / "assets" / "main.js").write_text("console.log(1)", encoding="utf-8")
    (tmp_path / "secret.txt").write_text("outside", encoding="utf-8")
    return dist


def test_serves_index_assets_and_client_routes(tmp_path: Path) -> None:
    resources = MongoResources(client=AsyncMock(), database=object())
    with patch("app.main.create_mongo_resources", return_value=resources):
        with make_client(build_dist(tmp_path)) as client:
            root = client.get("/")
            asset = client.get("/assets/main.js")
            route = client.get("/calendar/2026-09")
            health = client.get("/api/health")

    assert root.text == "<html>app</html>"
    assert asset.text == "console.log(1)"
    assert "immutable" in asset.headers["cache-control"]
    assert route.text == "<html>app</html>"
    assert health.json() == {"status": "ok"}


def test_unknown_api_paths_and_traversal_do_not_leak(tmp_path: Path) -> None:
    resources = MongoResources(client=AsyncMock(), database=object())
    with patch("app.main.create_mongo_resources", return_value=resources):
        with make_client(build_dist(tmp_path)) as client:
            missing_api = client.get("/api/does-not-exist")
            traversal = client.get("/..%2Fsecret.txt")

    assert missing_api.status_code == 404
    assert "outside" not in traversal.text


def test_frontend_is_not_served_without_setting() -> None:
    resources = MongoResources(client=AsyncMock(), database=object())
    settings = Settings(mongodb_uri=SecretStr("mongodb://example.invalid"), app_env="test")
    with patch("app.main.create_mongo_resources", return_value=resources):
        with TestClient(create_app(settings)) as client:
            response = client.get("/")

    assert response.status_code == 404
