from enum import StrEnum


class Sport(StrEnum):
    RUN = "run"
    WALK = "walk"
    BIKE = "bike"
    SWIM = "swim"
    STRENGTH = "strength"
    HIKE = "hike"
    OTHER = "other"


class RunCategory(StrEnum):
    EASY = "easy"
    LONG = "long"
    TRACK = "track"
    TEMPO = "tempo"
    RECOVERY = "recovery"
    RACE = "race"
    TRAIL = "trail"
    PROGRESSION = "progression"
    RUN_CLUB = "run_club"
    OTHER = "other"


class ActivitySourceType(StrEnum):
    FIT = "fit"
    MANUAL = "manual"


class PlanStatus(StrEnum):
    ACTIVE = "active"
    ARCHIVED = "archived"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class SessionStatus(StrEnum):
    PLANNED = "planned"
    COMPLETED = "completed"
    COMPLETED_LATE = "completed_late"
    COMPLETED_EARLY = "completed_early"
    PARTIALLY_COMPLETED = "partially_completed"
    SKIPPED = "skipped"
    RESCHEDULED = "rescheduled"
