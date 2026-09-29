from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, File, UploadFile, status

from app.api.dependencies import Database, FitImportServiceDependency, RuntimeSettings
from app.core.errors import AppError
from app.repositories.activities import ActivitySampleRepository
from app.schemas.fit_imports import (
    ActivitySampleChunkResponse,
    ActivitySamplesResponse,
    FitImportConfirmRequest,
    FitImportConfirmResponse,
    FitImportPreviewResponse,
)

router = APIRouter(prefix="/activities")


@router.post(
    "/import-fit/preview",
    response_model=FitImportPreviewResponse,
    status_code=status.HTTP_200_OK,
)
async def preview_fit_import(
    service: FitImportServiceDependency,
    config: RuntimeSettings,
    file: Annotated[UploadFile, File()],
) -> FitImportPreviewResponse:
    filename = Path(file.filename or "").name
    if not filename.lower().endswith(".fit"):
        raise AppError("Only files with a .fit extension are supported.")
    content = await file.read(config.max_fit_upload_bytes + 1)
    await file.close()
    if len(content) > config.max_fit_upload_bytes:
        raise AppError("The FIT file exceeds the configured upload limit.")
    return await service.preview(content, filename)


@router.post(
    "/import-fit/confirm",
    response_model=FitImportConfirmResponse,
    status_code=status.HTTP_201_CREATED,
)
async def confirm_fit_import(
    payload: FitImportConfirmRequest,
    service: FitImportServiceDependency,
) -> FitImportConfirmResponse:
    return await service.confirm(payload)


@router.get("/{activity_id}/samples", response_model=ActivitySamplesResponse)
async def get_activity_samples(activity_id: str, database: Database) -> ActivitySamplesResponse:
    chunks = await ActivitySampleRepository(database).list_for_activity(activity_id)
    items = [ActivitySampleChunkResponse.model_validate(chunk) for chunk in chunks]
    return ActivitySamplesResponse(
        items=items,
        sample_count=sum(len(chunk.samples) for chunk in items),
    )
