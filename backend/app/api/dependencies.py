from typing import Annotated, Any

from fastapi import Depends, Request

from app.core.config import Settings
from app.repositories.activities import ActivityRepository, ActivitySampleRepository
from app.repositories.plans import PlannedSessionRepository, TrainingPlanRepository
from app.repositories.settings import SettingsRepository
from app.services.activities import ActivityService
from app.services.analytics import AnalyticsService
from app.services.calendar import CalendarService
from app.services.exports import ExportService
from app.services.fit.imports import FitImportService
from app.services.plan_imports.imports import PlanImportService
from app.services.plans import PlannedSessionService, SessionWorkflowService, TrainingPlanService
from app.services.settings import SettingsService


def get_database(request: Request) -> Any:
    return request.app.state.mongo.database


def get_runtime_settings(request: Request) -> Settings:
    return request.app.state.settings


Database = Annotated[Any, Depends(get_database)]
RuntimeSettings = Annotated[Settings, Depends(get_runtime_settings)]


def get_activity_service(database: Database) -> ActivityService:
    return ActivityService(
        ActivityRepository(database),
        PlannedSessionRepository(database),
        ActivitySampleRepository(database),
    )


def get_plan_service(database: Database) -> TrainingPlanService:
    return TrainingPlanService(TrainingPlanRepository(database))


def get_session_service(database: Database) -> PlannedSessionService:
    return PlannedSessionService(
        PlannedSessionRepository(database), TrainingPlanRepository(database)
    )


def get_session_workflow_service(database: Database) -> SessionWorkflowService:
    return SessionWorkflowService(PlannedSessionRepository(database), ActivityRepository(database))


def get_calendar_service(database: Database) -> CalendarService:
    return CalendarService(
        ActivityRepository(database),
        PlannedSessionRepository(database),
        TrainingPlanRepository(database),
    )


def get_settings_service(database: Database, config: RuntimeSettings) -> SettingsService:
    return SettingsService(SettingsRepository(database), config)


def get_plan_import_service(request: Request, database: Database) -> PlanImportService:
    return PlanImportService(
        request.app.state.plan_preview_cache,
        TrainingPlanRepository(database),
        PlannedSessionRepository(database),
    )


async def get_fit_import_service(
    request: Request, database: Database, config: RuntimeSettings
) -> FitImportService:
    settings = await SettingsService(SettingsRepository(database), config).get()
    return FitImportService(
        request.app.state.fit_parser,
        request.app.state.fit_preview_cache,
        ActivityRepository(database),
        ActivitySampleRepository(database),
        PlannedSessionRepository(database),
        TrainingPlanRepository(database),
        sample_interval_seconds=settings.sample_interval_seconds,
        sample_chunk_seconds=settings.sample_chunk_seconds,
    )


ActivityServiceDependency = Annotated[ActivityService, Depends(get_activity_service)]
PlanServiceDependency = Annotated[TrainingPlanService, Depends(get_plan_service)]
SessionServiceDependency = Annotated[PlannedSessionService, Depends(get_session_service)]
SessionWorkflowDependency = Annotated[SessionWorkflowService, Depends(get_session_workflow_service)]
SettingsServiceDependency = Annotated[SettingsService, Depends(get_settings_service)]
FitImportServiceDependency = Annotated[FitImportService, Depends(get_fit_import_service)]
PlanImportServiceDependency = Annotated[PlanImportService, Depends(get_plan_import_service)]
CalendarServiceDependency = Annotated[CalendarService, Depends(get_calendar_service)]


def get_analytics_service(database: Database, config: RuntimeSettings) -> AnalyticsService:
    return AnalyticsService(
        ActivityRepository(database),
        TrainingPlanRepository(database),
        PlannedSessionRepository(database),
        ActivitySampleRepository(database),
        SettingsService(SettingsRepository(database), config),
    )


AnalyticsServiceDependency = Annotated[AnalyticsService, Depends(get_analytics_service)]


def get_export_service(database: Database) -> ExportService:
    return ExportService(
        ActivityRepository(database),
        ActivitySampleRepository(database),
        TrainingPlanRepository(database),
        PlannedSessionRepository(database),
    )


ExportServiceDependency = Annotated[ExportService, Depends(get_export_service)]
