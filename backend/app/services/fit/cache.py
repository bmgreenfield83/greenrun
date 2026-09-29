from dataclasses import dataclass
from time import monotonic
from uuid import uuid4

from app.core.errors import NotFoundError
from app.schemas.fit_imports import DuplicateMatch, PlannedSessionSuggestion
from app.services.fit.models import ParsedFitActivity

PREVIEW_TTL_SECONDS = 1800


@dataclass
class PreviewEntry:
    parsed: ParsedFitActivity
    duplicates: list[DuplicateMatch]
    suggestion: PlannedSessionSuggestion | None
    expires_at: float


class FitPreviewCache:
    def __init__(self, max_entries: int = 10) -> None:
        self.max_entries = max_entries
        self.entries: dict[str, PreviewEntry] = {}

    def _purge(self) -> None:
        now = monotonic()
        self.entries = {
            token: entry for token, entry in self.entries.items() if entry.expires_at > now
        }

    def put(
        self,
        parsed: ParsedFitActivity,
        duplicates: list[DuplicateMatch],
        suggestion: PlannedSessionSuggestion | None,
    ) -> str:
        self._purge()
        while len(self.entries) >= self.max_entries:
            self.entries.pop(next(iter(self.entries)))
        token = str(uuid4())
        self.entries[token] = PreviewEntry(
            parsed=parsed,
            duplicates=duplicates,
            suggestion=suggestion,
            expires_at=monotonic() + PREVIEW_TTL_SECONDS,
        )
        return token

    def get(self, token: str) -> PreviewEntry:
        self._purge()
        entry = self.entries.get(token)
        if not entry:
            raise NotFoundError("The FIT import preview expired or does not exist.")
        return entry

    def remove(self, token: str) -> None:
        self.entries.pop(token, None)
