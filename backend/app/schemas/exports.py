from datetime import date
from enum import StrEnum

from pydantic import model_validator

from app.schemas.common import ApiModel


class ExportScope(StrEnum):
    DAY = "day"
    WEEK = "week"
    MONTH = "month"
    RANGE = "range"


class DateRangeExportRequest(ApiModel):
    scope: ExportScope
    start_date: date
    end_date: date | None = None
    include_all_activities: bool = False

    @model_validator(mode="after")
    def resolve_and_validate_dates(self) -> "DateRangeExportRequest":
        if self.scope == ExportScope.DAY:
            self.end_date = self.start_date
        elif self.scope == ExportScope.WEEK:
            self.end_date = self.start_date.fromordinal(self.start_date.toordinal() + 6)
        elif self.scope == ExportScope.MONTH:
            next_month = (
                self.start_date.replace(year=self.start_date.year + 1, month=1, day=1)
                if self.start_date.month == 12
                else self.start_date.replace(month=self.start_date.month + 1, day=1)
            )
            self.start_date = self.start_date.replace(day=1)
            self.end_date = next_month.fromordinal(next_month.toordinal() - 1)
        if self.end_date is None:
            raise ValueError("end_date is required for a range export")
        if self.end_date < self.start_date:
            raise ValueError("end_date cannot be before start_date")
        return self
