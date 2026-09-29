from fastapi import APIRouter, HTTPException, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from app.api.dependencies import ExportServiceDependency
from app.schemas.exports import DateRangeExportRequest

router = APIRouter()


def download(payload: dict, filename: str) -> JSONResponse:
    return JSONResponse(
        jsonable_encoder(payload),
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/activities/{activity_id}/export")
async def export_activity(activity_id: str, service: ExportServiceDependency) -> JSONResponse:
    payload = await service.activity_export(activity_id)
    if payload is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Activity not found.")
    return download(payload, f"activity-{activity_id}.json")


@router.post("/exports")
async def export_date_range(
    request: DateRangeExportRequest, service: ExportServiceDependency
) -> JSONResponse:
    payload = await service.range_export(
        request.start_date,
        request.end_date,
        request.scope,
        include_all_activities=request.include_all_activities,
    )
    if payload is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "No activities found in range.")
    return download(payload, f"running-{request.scope}-{request.start_date}.json")


@router.get("/plans/{plan_id}/export")
async def export_plan(plan_id: str, service: ExportServiceDependency) -> JSONResponse:
    payload = await service.plan_template(plan_id)
    if payload is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Training plan not found.")
    return download(payload, f"training-plan-{plan_id}.json")


@router.get("/plans/{plan_id}/analysis-export")
async def export_plan_analysis(
    plan_id: str,
    service: ExportServiceDependency,
    include_all_activities: bool = False,
) -> JSONResponse:
    payload = await service.plan_analysis(plan_id, include_all_activities=include_all_activities)
    if payload is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Training plan not found.")
    return download(payload, f"training-plan-analysis-{plan_id}.json")
