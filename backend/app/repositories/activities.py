from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from pymongo import DESCENDING

from app.db.collections import ACTIVITIES, ACTIVITY_SAMPLES
from app.db.documents import api_to_document, document_to_api, object_id


class ActivityRepository:
    def __init__(self, database: Any) -> None:
        self.collection = database[ACTIVITIES]
        self.samples = database[ACTIVITY_SAMPLES]

    async def create(self, document: dict[str, Any]) -> dict[str, Any]:
        result = await self.collection.insert_one(api_to_document(document))
        return await self.get(str(result.inserted_id))

    async def replace(self, activity_id: str, document: dict[str, Any]) -> dict[str, Any] | None:
        identifier = object_id(activity_id)
        replacement = api_to_document(document) | {"_id": identifier}
        result = await self.collection.replace_one({"_id": identifier}, replacement)
        return await self.get(activity_id) if result.matched_count else None

    async def get(self, activity_id: str) -> dict[str, Any] | None:
        document = await self.collection.find_one({"_id": object_id(activity_id)})
        return document_to_api(document) if document else None

    async def list(
        self,
        *,
        skip: int,
        limit: int,
        sport: str | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> tuple[list[dict[str, Any]], int]:
        query: dict[str, Any] = {"sport": sport} if sport else {}
        if start_date or end_date:
            query["local_date"] = {}
            if start_date:
                query["local_date"]["$gte"] = start_date
            if end_date:
                query["local_date"]["$lte"] = end_date
        cursor = (
            self.collection.find(query).sort("started_at_utc", DESCENDING).skip(skip).limit(limit)
        )
        documents = [document_to_api(item) async for item in cursor]
        return documents, await self.collection.count_documents(query)

    async def update_metadata(
        self, activity_id: str, changes: dict[str, Any], updated_at: datetime
    ) -> dict[str, Any] | None:
        update = api_to_document(changes)
        update["updated_at_utc"] = updated_at
        document = await self.collection.find_one_and_update(
            {"_id": object_id(activity_id)}, {"$set": update}, return_document=True
        )
        return document_to_api(document) if document else None

    async def delete(self, activity_id: str) -> bool:
        identifier = object_id(activity_id)
        result = await self.collection.delete_one({"_id": identifier})
        if result.deleted_count:
            await self.samples.delete_many({"activity_id": identifier})
            return True
        return False

    async def find_duplicates(
        self,
        *,
        checksum: str,
        garmin_activity_id: str | None,
        started_at: datetime,
        elapsed_seconds: float,
        distance_meters: float | None,
    ) -> list[dict[str, Any]]:
        secondary: dict[str, Any] = {
            "started_at_utc": {
                "$gte": started_at - timedelta(seconds=5),
                "$lte": started_at + timedelta(seconds=5),
            },
            "elapsed_time_seconds": {"$gte": elapsed_seconds - 5, "$lte": elapsed_seconds + 5},
        }
        if distance_meters is not None:
            tolerance = max(50, distance_meters * 0.01)
            secondary["distance_meters"] = {
                "$gte": max(0, distance_meters - tolerance),
                "$lte": distance_meters + tolerance,
            }
        alternatives: list[dict[str, Any]] = [
            {"source.checksum_sha256": checksum},
            secondary,
        ]
        if garmin_activity_id:
            alternatives.append({"source.garmin_activity_id": garmin_activity_id})
        cursor = self.collection.find({"$or": alternatives}).limit(10)
        return [document_to_api(item) async for item in cursor]

    async def list_range(self, start_date: str, end_date: str) -> list[dict[str, Any]]:
        cursor = self.collection.find({"local_date": {"$gte": start_date, "$lt": end_date}}).sort(
            "started_at_utc", 1
        )
        return [document_to_api(item) async for item in cursor]


class ActivitySampleRepository:
    def __init__(self, database: Any) -> None:
        self.collection = database[ACTIVITY_SAMPLES]

    async def replace_chunks(self, activity_id: str, chunks: list[dict[str, Any]]) -> None:
        identifier = object_id(activity_id)
        await self.collection.delete_many({"activity_id": identifier})
        if chunks:
            await self.collection.insert_many(
                [api_to_document(chunk | {"activity_id": activity_id}) for chunk in chunks]
            )

    async def list_for_activity(self, activity_id: str) -> list[dict[str, Any]]:
        cursor = self.collection.find({"activity_id": object_id(activity_id)}).sort(
            "chunk_index", 1
        )
        return [document_to_api(item) async for item in cursor]

    async def list_distance_series(
        self, activity_ids: list[str]
    ) -> dict[str, list[dict[str, Any]]]:
        """Return elapsed time and distance samples for many activities in one query."""
        return await self.list_sample_fields(activity_ids, ("elapsed_seconds", "distance_meters"))

    async def list_sample_fields(
        self, activity_ids: list[str], fields: tuple[str, ...]
    ) -> dict[str, list[dict[str, Any]]]:
        """Return the selected sample fields for many activities in one projected query.

        Samples are concatenated in chunk order per activity id; activities without samples are
        absent from the result.
        """
        if not activity_ids:
            return {}
        projection: dict[str, int] = {"activity_id": 1, "chunk_index": 1}
        projection.update({f"samples.{field}": 1 for field in fields})
        cursor = self.collection.find(
            {"activity_id": {"$in": [object_id(item) for item in activity_ids]}}, projection
        ).sort([("activity_id", 1), ("chunk_index", 1)])
        series: dict[str, list[dict[str, Any]]] = {}
        async for chunk in cursor:
            series.setdefault(str(chunk["activity_id"]), []).extend(chunk.get("samples") or [])
        return series
