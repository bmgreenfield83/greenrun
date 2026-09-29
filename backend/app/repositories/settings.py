from typing import Any

from app.db.collections import APP_SETTINGS
from app.db.documents import document_to_api


class SettingsRepository:
    def __init__(self, database: Any) -> None:
        self.collection = database[APP_SETTINGS]

    async def get_or_create(self, defaults: dict[str, Any]) -> dict[str, Any]:
        document = await self.collection.find_one_and_update(
            {"_id": "application"},
            {"$setOnInsert": defaults},
            upsert=True,
            return_document=True,
        )
        return document_to_api(document)

    async def update(self, changes: dict[str, Any]) -> dict[str, Any]:
        document = await self.collection.find_one_and_update(
            {"_id": "application"}, {"$set": changes}, upsert=True, return_document=True
        )
        return document_to_api(document)
