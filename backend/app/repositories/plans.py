from datetime import datetime
from typing import Any

from pymongo import ASCENDING, DESCENDING

from app.db.collections import PLANNED_SESSIONS, TRAINING_PLANS
from app.db.documents import api_to_document, document_to_api, object_id


class TrainingPlanRepository:
    def __init__(self, database: Any) -> None:
        self.collection = database[TRAINING_PLANS]

    async def create(self, document: dict[str, Any]) -> dict[str, Any]:
        result = await self.collection.insert_one(api_to_document(document))
        return await self.get(str(result.inserted_id))

    async def get(self, plan_id: str) -> dict[str, Any] | None:
        item = await self.collection.find_one({"_id": object_id(plan_id)})
        return document_to_api(item) if item else None

    async def get_active(self) -> dict[str, Any] | None:
        item = await self.collection.find_one({"status": "active"})
        return document_to_api(item) if item else None

    async def list(self, *, skip: int, limit: int) -> tuple[list[dict[str, Any]], int]:
        cursor = self.collection.find({}).sort("created_at_utc", DESCENDING).skip(skip).limit(limit)
        return [
            document_to_api(item) async for item in cursor
        ], await self.collection.count_documents({})

    async def update(
        self, plan_id: str, changes: dict[str, Any], updated_at: datetime
    ) -> dict[str, Any] | None:
        update = api_to_document(changes)
        update["updated_at_utc"] = updated_at
        item = await self.collection.find_one_and_update(
            {"_id": object_id(plan_id)}, {"$set": update}, return_document=True
        )
        return document_to_api(item) if item else None

    async def delete(self, plan_id: str) -> bool:
        result = await self.collection.delete_one({"_id": object_id(plan_id)})
        return bool(result.deleted_count)


class PlannedSessionRepository:
    def __init__(self, database: Any) -> None:
        self.collection = database[PLANNED_SESSIONS]

    async def create(self, document: dict[str, Any]) -> dict[str, Any]:
        result = await self.collection.insert_one(api_to_document(document))
        return await self.get(str(result.inserted_id))

    async def create_many(self, documents: list[dict[str, Any]]) -> list[str]:
        if not documents:
            return []
        result = await self.collection.insert_many(
            [api_to_document(document) for document in documents]
        )
        return [str(identifier) for identifier in result.inserted_ids]

    async def get(self, session_id: str) -> dict[str, Any] | None:
        item = await self.collection.find_one({"_id": object_id(session_id)})
        return document_to_api(item) if item else None

    async def list_for_plan(self, plan_id: str) -> list[dict[str, Any]]:
        cursor = self.collection.find({"training_plan_id": object_id(plan_id)}).sort(
            "scheduled_date", ASCENDING
        )
        return [document_to_api(item) async for item in cursor]

    async def update(
        self, session_id: str, changes: dict[str, Any], updated_at: datetime
    ) -> dict[str, Any] | None:
        update = api_to_document(changes)
        update["updated_at_utc"] = updated_at
        item = await self.collection.find_one_and_update(
            {"_id": object_id(session_id)}, {"$set": update}, return_document=True
        )
        return document_to_api(item) if item else None

    async def detach_activity(self, activity_id: str, updated_at: datetime) -> None:
        await self.collection.update_many(
            {"completed_activity_id": object_id(activity_id)},
            {
                "$set": {
                    "completed_activity_id": None,
                    "completed_on_date": None,
                    "status": "planned",
                    "updated_at_utc": updated_at,
                }
            },
        )

    async def attach_activity(
        self,
        session_id: str,
        activity_id: str,
        completed_on_date: str,
        status: str,
        updated_at: datetime,
    ) -> dict[str, Any] | None:
        item = await self.collection.find_one_and_update(
            {
                "_id": object_id(session_id),
                "$or": [
                    {"completed_activity_id": None},
                    {"completed_activity_id": object_id(activity_id)},
                ],
            },
            {
                "$set": {
                    "completed_activity_id": object_id(activity_id),
                    "completed_on_date": completed_on_date,
                    "status": status,
                    "updated_at_utc": updated_at,
                }
            },
            return_document=True,
        )
        return document_to_api(item) if item else None

    async def find_match_candidates(
        self, *, training_plan_id: str, start_date: str, end_date: str, sport: str
    ) -> list[dict[str, Any]]:
        cursor = self.collection.find(
            {
                "scheduled_date": {"$gte": start_date, "$lte": end_date},
                "training_plan_id": object_id(training_plan_id),
                "sport": sport,
                "completed_activity_id": None,
                "status": {"$in": ["planned", "skipped", "rescheduled"]},
            }
        ).sort("scheduled_date", ASCENDING)
        return [document_to_api(item) async for item in cursor]

    async def delete(self, session_id: str) -> bool:
        result = await self.collection.delete_one({"_id": object_id(session_id)})
        return bool(result.deleted_count)

    async def delete_for_plan(self, plan_id: str) -> int:
        result = await self.collection.delete_many({"training_plan_id": object_id(plan_id)})
        return result.deleted_count

    async def list_range(self, start_date: str, end_date: str) -> list[dict[str, Any]]:
        cursor = self.collection.find(
            {"scheduled_date": {"$gte": start_date, "$lt": end_date}}
        ).sort("scheduled_date", ASCENDING)
        return [document_to_api(item) async for item in cursor]

    async def list_range_for_plan(
        self, start_date: str, end_date: str, *, training_plan_id: str
    ) -> list[dict[str, Any]]:
        cursor = self.collection.find(
            {
                "scheduled_date": {"$gte": start_date, "$lt": end_date},
                "training_plan_id": object_id(training_plan_id),
            }
        ).sort("scheduled_date", ASCENDING)
        return [document_to_api(item) async for item in cursor]
