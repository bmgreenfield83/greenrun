from datetime import date

from fastapi import APIRouter, HTTPException, status

from app.api.dependencies import AnalyticsServiceDependency
from app.schemas.analytics import (
    AnalyticsSummary,
    ComparableRun,
    EasyPaceHeartRate,
    GoalProgress,
    HeartRateZoneAnalytics,
    SameWeekdayRun,
)

router = APIRouter(prefix="/analytics")


@router.get("/summary", response_model=AnalyticsSummary)
async def get_analytics_summary(service: AnalyticsServiceDependency) -> AnalyticsSummary:
    return await service.summary(date.today())


@router.get("/heart-rate-zones", response_model=HeartRateZoneAnalytics)
async def get_heart_rate_zones(service: AnalyticsServiceDependency) -> HeartRateZoneAnalytics:
    """Weekly time in HR-reserve zones, easy-run zone distribution, and TRIMP training load."""
    return await service.heart_rate_zones(date.today())


@router.get("/easy-pace-heart-rate", response_model=EasyPaceHeartRate)
async def get_easy_pace_heart_rate(service: AnalyticsServiceDependency) -> EasyPaceHeartRate:
    """Heart rate at a fixed easy grade-adjusted pace, per run and by month."""
    return await service.easy_pace_heart_rate(date.today())


@router.get("/goal", response_model=GoalProgress)
async def get_goal_progress(service: AnalyticsServiceDependency) -> GoalProgress:
    """Goal-card data from the active plan's structured goal_target."""
    return await service.goal_progress(date.today())


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
