from fastapi import APIRouter

from app.api.dependencies import SessionWorkflowDependency
from app.schemas.plans import PlannedSessionResponse
from app.schemas.session_actions import (
    AttachActivityRequest,
    RescheduleSessionRequest,
    RescheduleSessionResponse,
    SkipSessionRequest,
)

router = APIRouter(prefix="/planned-sessions")


@router.post("/{session_id}/skip", response_model=PlannedSessionResponse)
async def skip_session(
    session_id: str,
    payload: SkipSessionRequest,
    service: SessionWorkflowDependency,
) -> PlannedSessionResponse:
    return await service.skip(session_id, payload.reason)


@router.post("/{session_id}/unskip", response_model=PlannedSessionResponse)
async def unskip_session(
    session_id: str, service: SessionWorkflowDependency
) -> PlannedSessionResponse:
    return await service.unskip(session_id)


@router.post("/{session_id}/reschedule", response_model=RescheduleSessionResponse)
async def reschedule_session(
    session_id: str,
    payload: RescheduleSessionRequest,
    service: SessionWorkflowDependency,
) -> RescheduleSessionResponse:
    return await service.reschedule(session_id, payload.scheduled_date, payload.notes)


@router.post("/{session_id}/attach-activity", response_model=PlannedSessionResponse)
async def attach_activity(
    session_id: str,
    payload: AttachActivityRequest,
    service: SessionWorkflowDependency,
) -> PlannedSessionResponse:
    return await service.attach(session_id, payload.activity_id)


@router.post("/{session_id}/detach-activity", response_model=PlannedSessionResponse)
async def detach_activity(
    session_id: str, service: SessionWorkflowDependency
) -> PlannedSessionResponse:
    return await service.detach(session_id)
