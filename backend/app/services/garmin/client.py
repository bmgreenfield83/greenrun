"""The only code that talks to Garmin Connect, through the pinned `garminconnect` library.

The library is synchronous, so callers run these methods in a worker thread. One session is kept per
process and reused; it is rebuilt from the saved tokens if Garmin rejects it.
"""

import logging
import threading
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date
from typing import Any, Protocol, TypeVar

from app.services.garmin.errors import (
    SETUP_HINT,
    GarminAuthenticationError,
    GarminError,
    GarminRateLimitedError,
    GarminSetupRequiredError,
    GarminUnavailableError,
)

logger = logging.getLogger(__name__)

T = TypeVar("T")

# Garmin's running parent type; its children include trail, treadmill, track and indoor running.
RUNNING_PARENT_TYPE_ID = 1


@dataclass(frozen=True)
class GarminRun:
    activity_id: str
    name: str | None
    started_at_local: str | None
    distance_meters: float | None
    duration_seconds: float | None


class GarminGateway(Protocol):
    def list_runs(self, day: date) -> list[GarminRun]: ...

    def download_original(self, activity_id: str) -> bytes: ...


def is_run(summary: dict[str, Any]) -> bool:
    activity_type = summary.get("activityType") or {}
    type_key = str(activity_type.get("typeKey") or "")
    return (
        activity_type.get("parentTypeId") == RUNNING_PARENT_TYPE_ID
        or type_key == "running"
        or type_key.endswith(("_running", "_run"))
    )


def runs_on(summaries: list[dict[str, Any]], day: date) -> list[GarminRun]:
    """Runs whose local start (the watch's own clock) falls on the day, oldest first."""
    runs = [
        GarminRun(
            activity_id=str(summary["activityId"]),
            name=summary.get("activityName"),
            started_at_local=summary.get("startTimeLocal"),
            distance_meters=summary.get("distance"),
            duration_seconds=summary.get("duration"),
        )
        for summary in summaries
        if summary.get("activityId")
        and is_run(summary)
        and str(summary.get("startTimeLocal") or "").startswith(day.isoformat())
    ]
    return sorted(runs, key=lambda run: run.started_at_local or "")


def _library_factory(email: str | None, password: str | None) -> Any:
    from garminconnect import Garmin  # imported lazily so the app starts without Garmin set up

    # No MFA prompt: a request must never wait for a code. MFA happens in the setup command.
    return Garmin(email, password)


class GarminConnectClient:
    def __init__(
        self,
        *,
        email: str,
        password: str,
        token_dir: str,
        factory: Callable[[str | None, str | None], Any] = _library_factory,
    ) -> None:
        self._email = email.strip() or None
        self._password = password or None
        self._token_dir = token_dir
        self._factory = factory
        self._api: Any = None
        self._lock = threading.Lock()

    def list_runs(self, day: date) -> list[GarminRun]:
        iso = day.isoformat()
        summaries = self._call(lambda api: api.get_activities_by_date(iso, iso))
        return runs_on(summaries or [], day)

    def download_original(self, activity_id: str) -> bytes:
        return self._call(
            lambda api: api.download_activity(
                activity_id, dl_fmt=api.ActivityDownloadFormat.ORIGINAL
            )
        )

    def _call(self, action: Callable[[Any], T]) -> T:
        with self._lock:
            try:
                return action(self._session())
            except GarminError:
                raise
            except Exception as error:
                mapped = _translate(error)
                if isinstance(mapped, GarminAuthenticationError | GarminSetupRequiredError):
                    self._api = None  # start from the saved tokens next time
                raise mapped from error

    def _session(self) -> Any:
        if self._api is None:
            # Saved tokens come first; the password is used only if they are missing or rejected.
            api = self._factory(self._email, self._password)
            api.login(self._token_dir)
            self._api = api
        return self._api


def _translate(error: Exception) -> GarminError:
    """Map a library or network exception onto Greenrun's Garmin errors, without leaking secrets."""
    try:
        from garminconnect import (
            GarminConnectAuthenticationError,
            GarminConnectConnectionError,
            GarminConnectTooManyRequestsError,
        )
    except ImportError:  # pragma: no cover - the dependency is always installed
        return GarminUnavailableError("The Garmin Connect library is not installed.")

    message = str(error)
    if isinstance(error, GarminConnectTooManyRequestsError):
        return GarminRateLimitedError(
            "Garmin is rate-limiting requests. Wait a few minutes, then sync again."
        )
    if isinstance(error, GarminConnectAuthenticationError):
        if "mfa" in message.lower() or "required" in message.lower():
            return GarminSetupRequiredError(f"Garmin needs you to sign in again. {SETUP_HINT}")
        return GarminAuthenticationError(
            "Garmin rejected the saved sign-in. Check GARMIN_EMAIL and GARMIN_PASSWORD, "
            f"then {SETUP_HINT[0].lower()}{SETUP_HINT[1:]}"
        )
    if isinstance(error, GarminConnectConnectionError):
        logger.warning("Garmin Connect request failed: %s", type(error).__name__)
        return GarminUnavailableError("Garmin Connect could not be reached. Try again shortly.")
    logger.warning("Unexpected Garmin Connect failure: %s", type(error).__name__)
    return GarminUnavailableError("Garmin Connect could not be reached. Try again shortly.")
