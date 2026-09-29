from datetime import date

from fastapi import APIRouter, HTTPException, status

from app.api.dependencies import AnalyticsServiceDependency
from app.schemas.analytics import AnalyticsSummary, ComparableRun, SameWeekdayRun
from app.schemas.workload_trend import WorkloadTrend

router = APIRouter(prefix="/analytics")


@router.get("/comparable-heart-rate", response_model=WorkloadTrend)
async def get_workload_trend(service: AnalyticsServiceDependency) -> WorkloadTrend:
    return await service.workload_trend(date.today())


@router.get("/summary", response_model=AnalyticsSummary)
async def get_analytics_summary(service: AnalyticsServiceDependency) -> AnalyticsSummary:
    return await service.summary(date.today())


@router.post("/recalculate-heart-rate-response", response_model=dict)
async def recalculate_heart_rate_response(service: AnalyticsServiceDependency) -> dict:
    return {"activities_updated": await service.recalculate_heart_rate_response(date.today())}


@router.post("/activities/{activity_id}/recalculate-heart-rate-response", response_model=dict)
async def recalculate_activity_heart_rate_response(
    activity_id: str, service: AnalyticsServiceDependency
) -> dict:
    result = await service.recalculate_activity_heart_rate_response(activity_id)
    if result is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Activity not found.")
    return result


@router.get("/activities/{activity_id}/comparables", response_model=list[ComparableRun])
async def get_comparable_runs(
    activity_id: str, service: AnalyticsServiceDependency
) -> list[ComparableRun]:
    results = await service.comparable_runs(activity_id)
    if results is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Activity not found.")
    return results


@router.get(
    "/activities/{activity_id}/same-weekday-runs",
    response_model=list[SameWeekdayRun],
)
async def get_same_weekday_runs(
    activity_id: str, service: AnalyticsServiceDependency
) -> list[SameWeekdayRun]:
    results = await service.same_weekday_runs(activity_id)
    if results is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Activity not found.")
    return results
