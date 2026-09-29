from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.core.config import Settings
from app.main import create_app
from app.schemas.plan_imports import TrainingPlanTemplate


def test_static_plan_schema_routes_are_not_captured_as_plan_ids() -> None:
    settings = Settings(mongodb_uri=SecretStr("mongodb://example.invalid"), app_env="test")
    client = TestClient(create_app(settings))

    blank_response = client.get("/api/plans/export-blank")
    schema_response = client.get("/api/plans/schema")

    assert blank_response.status_code == 200
    assert schema_response.status_code == 200
    assert schema_response.json()["title"] == "TrainingPlanTemplate"
    TrainingPlanTemplate.model_validate(blank_response.json())
