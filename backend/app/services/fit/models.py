from typing import Protocol

from pydantic import Field

from app.schemas.activities import ActivityCreate
from app.schemas.common import ApiModel


class ActivitySample(ApiModel):
    elapsed_seconds: int = Field(ge=0)
    distance_meters: float | None = Field(default=None, ge=0)
    heart_rate: int | None = Field(default=None, ge=1)
    speed_mps: float | None = Field(default=None, ge=0)
    cadence_spm: float | None = Field(default=None, ge=0)
    elevation_meters: float | None = None
    temperature_celsius: float | None = None


class ParsedFitActivity(ApiModel):
    activity: ActivityCreate
    samples: list[ActivitySample]


class FitActivityParser(Protocol):
    parser_version: str

    def parse(
        self, content: bytes, filename: str, sample_interval_seconds: int
    ) -> ParsedFitActivity:
        """Decode FIT bytes into canonical application models without persisting bytes."""
        ...
