from datetime import UTC, date, datetime

import pytest
from pydantic import ValidationError

from app.schemas.activities import ActivityCreate, ActivitySource
from app.schemas.plans import TrainingPlanCreate
from app.schemas.settings import AppSettingsUpdate


def base_activity(**changes: object) -> ActivityCreate:
    values = {
        "sport": "run",
        "category": "easy",
        "started_at_utc": datetime(2026, 8, 4, 11, tzinfo=UTC),
        "local_date": date(2026, 8, 4),
        "elapsed_time_seconds": 1800,
        "source": ActivitySource(type="manual"),
    }
    values.update(changes)
    return ActivityCreate.model_validate(values)


def test_strength_activity_rejects_distance() -> None:
    with pytest.raises(ValidationError, match="strength activities cannot have distance"):
        base_activity(sport="strength", category=None, distance_meters=100)


def test_non_running_activity_rejects_run_category() -> None:
    with pytest.raises(ValidationError, match="category is only valid"):
        base_activity(sport="bike", category="easy")


def test_plan_end_date_cannot_precede_start() -> None:
    with pytest.raises(ValidationError, match="end_date cannot be before start_date"):
        TrainingPlanCreate(
            name="Invalid",
            start_date=date(2026, 8, 10),
            end_date=date(2026, 8, 1),
        )


def test_settings_timezone_must_be_valid_iana_name() -> None:
    assert AppSettingsUpdate(timezone="America/New_York").timezone == "America/New_York"
    with pytest.raises(ValidationError, match="valid IANA timezone"):
        AppSettingsUpdate(timezone="Not/A_Timezone")
