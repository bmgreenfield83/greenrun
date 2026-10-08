from app.core.errors import AppError


class GarminError(AppError):
    """A Garmin Connect problem, reported to the client with its own error code."""

    status_code = 502
    code = "garmin_error"


class GarminSessionError(GarminError):
    """The Garmin session itself is unusable, so the whole sync stops."""


class GarminSetupRequiredError(GarminSessionError):
    status_code = 503
    code = "garmin_setup_required"


class GarminAuthenticationError(GarminSessionError):
    code = "garmin_auth_failed"


class GarminRateLimitedError(GarminSessionError):
    status_code = 429
    code = "garmin_rate_limited"


class GarminUnavailableError(GarminError):
    code = "garmin_unavailable"


class GarminArchiveError(GarminError):
    """A downloaded activity could not be turned into a FIT file."""

    status_code = 422
    code = "garmin_archive_invalid"


SETUP_HINT = (
    "Run the one-time Garmin setup command on the server (see docs/garmin-sync.md), "
    "then sync again."
)
