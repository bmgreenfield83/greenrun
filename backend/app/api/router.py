from fastapi import APIRouter

from app.api.routes.activities import router as activities_router
from app.api.routes.analytics import router as analytics_router
from app.api.routes.calendar import router as calendar_router
from app.api.routes.exports import router as exports_router
from app.api.routes.fit_imports import router as fit_imports_router
from app.api.routes.garmin_sync import router as garmin_sync_router
from app.api.routes.health import router as health_router
from app.api.routes.plan_imports import router as plan_imports_router
from app.api.routes.plans import router as plans_router
from app.api.routes.session_actions import router as session_actions_router
from app.api.routes.settings import router as settings_router

api_router = APIRouter()
api_router.include_router(health_router, tags=["health"])
api_router.include_router(activities_router, tags=["activities"])
api_router.include_router(analytics_router, tags=["analytics"])
api_router.include_router(calendar_router, tags=["calendar"])
api_router.include_router(fit_imports_router, tags=["fit-imports"])
api_router.include_router(garmin_sync_router, tags=["garmin-sync"])
api_router.include_router(exports_router, tags=["exports"])
api_router.include_router(plan_imports_router, tags=["plan-imports"])
api_router.include_router(plans_router, tags=["plans"])
api_router.include_router(settings_router, tags=["settings"])
api_router.include_router(session_actions_router, tags=["planned-sessions"])
