from dataclasses import dataclass
from time import monotonic
from uuid import uuid4

from app.core.errors import NotFoundError
from app.schemas.plan_imports import PlanImportConflict, TrainingPlanTemplate

PLAN_PREVIEW_TTL_SECONDS = 1800


@dataclass
class PlanPreviewEntry:
    template: TrainingPlanTemplate
    start_date: str
    end_date: str
    sessions: list[dict]
    conflict: PlanImportConflict | None
    expires_at: float


class PlanPreviewCache:
    def __init__(self, max_entries: int = 10) -> None:
        self.max_entries = max_entries
        self.entries: dict[str, PlanPreviewEntry] = {}

    def _purge(self) -> None:
        now = monotonic()
        self.entries = {
            token: entry for token, entry in self.entries.items() if entry.expires_at > now
        }

    def put(self, entry: PlanPreviewEntry) -> str:
        self._purge()
        while len(self.entries) >= self.max_entries:
            self.entries.pop(next(iter(self.entries)))
        token = str(uuid4())
        entry.expires_at = monotonic() + PLAN_PREVIEW_TTL_SECONDS
        self.entries[token] = entry
        return token

    def get(self, token: str) -> PlanPreviewEntry:
        self._purge()
        entry = self.entries.get(token)
        if not entry:
            raise NotFoundError("The plan import preview expired or does not exist.")
        return entry

    def remove(self, token: str) -> None:
        self.entries.pop(token, None)
