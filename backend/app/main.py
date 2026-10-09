import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.core.config import Settings, get_settings
from app.core.errors import AppError
from app.db.client import create_mongo_resources
from app.db.indexes import ensure_indexes
from app.frontend import mount_frontend
from app.services.ai_reviews import GreenAiClient
from app.services.fit import GarminFitActivityParser
from app.services.fit.cache import FitPreviewCache
from app.services.garmin.client import GarminConnectClient
from app.services.plan_imports.cache import PlanPreviewCache

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved_settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        resources = create_mongo_resources(resolved_settings)
        app.state.mongo = resources
        app.state.settings = resolved_settings
        try:
            await ensure_indexes(resources.database)
            app.state.indexes_ready = True
        except Exception:
            app.state.indexes_ready = False
            logger.warning("MongoDB indexes could not be initialized; readiness may be degraded.")
        try:
            yield
        finally:
            await resources.client.close()

    application = FastAPI(
        title=resolved_settings.app_name,
        version="0.1.0",
        lifespan=lifespan,
    )
    application.state.fit_parser = GarminFitActivityParser()
    application.state.fit_preview_cache = FitPreviewCache()
    application.state.plan_preview_cache = PlanPreviewCache()
    application.state.green_ai_client = (
        GreenAiClient(resolved_settings.green_ai_url)
        if resolved_settings.ai_reviews_enabled
        else None
    )
    application.state.garmin_client = GarminConnectClient(
        email=resolved_settings.garmin_email,
        password=resolved_settings.garmin_password.get_secret_value(),
        token_dir=resolved_settings.garmin_token_dir,
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=resolved_settings.cors_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.include_router(api_router, prefix="/api")
    if resolved_settings.frontend_dist:
        mount_frontend(application, Path(resolved_settings.frontend_dist))

    @application.exception_handler(AppError)
    async def handle_app_error(_request: Request, error: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=error.status_code,
            content={"error": {"code": error.code, "message": error.message}},
        )

    return application


app = create_app()
