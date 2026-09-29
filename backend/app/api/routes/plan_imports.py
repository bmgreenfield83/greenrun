from fastapi import APIRouter, status

from app.api.dependencies import PlanImportServiceDependency
from app.schemas.plan_imports import (
    PlanImportConfirmRequest,
    PlanImportConfirmResponse,
    PlanImportPreviewRequest,
    PlanImportPreviewResponse,
    TrainingPlanTemplate,
)

router = APIRouter(prefix="/plans")


@router.post("/import/preview", response_model=PlanImportPreviewResponse)
async def preview_plan_import(
    payload: PlanImportPreviewRequest, service: PlanImportServiceDependency
) -> PlanImportPreviewResponse:
    return await service.preview(payload)


@router.post(
    "/import/confirm",
    response_model=PlanImportConfirmResponse,
    status_code=status.HTTP_201_CREATED,
)
async def confirm_plan_import(
    payload: PlanImportConfirmRequest, service: PlanImportServiceDependency
) -> PlanImportConfirmResponse:
    return await service.confirm(payload)


@router.get("/schema", response_model=dict)
async def get_plan_schema() -> dict:
    return TrainingPlanTemplate.model_json_schema()


@router.get("/export-blank", response_model=dict)
async def get_blank_plan_template() -> dict:
    return {
        "schema_version": "1.0",
        "name": "My Training Plan",
        "description": "Replace this description.",
        "primary_goal": "Describe the plan's most important outcome.",
        "secondary_goal": "Describe a supporting outcome, or set this to null.",
        "start_date": "2026-01-05",
        "week_starts_on": "monday",
        "schema_reference": {
            "valid_sports": ["run", "walk", "bike", "swim", "strength", "hike", "other"],
            "valid_run_session_types": [
                "easy",
                "long",
                "track",
                "tempo",
                "recovery",
                "race",
                "trail",
                "progression",
                "run_club",
                "other",
            ],
            "note": (
                "Dates are optional. Remove start_date and scheduled_date to resolve from "
                "the current week's Monday or a selected Monday."
            ),
        },
        "weeks": [
            {
                "week_number": 1,
                "focus": "Replace this focus.",
                "planned_running_miles": 0,
                "sessions": [
                    {
                        "day_of_week": "tuesday",
                        "scheduled_date": "2026-01-06",
                        "sport": "run",
                        "session_type": "easy",
                        "title": "Example session — replace or remove",
                        "planned_distance_miles": 0,
                        "planned_duration_minutes": None,
                        "instructions": "Replace these instructions.",
                        "justification": "Explain how this workout supports the plan goals.",
                    }
                ],
            }
        ],
    }
