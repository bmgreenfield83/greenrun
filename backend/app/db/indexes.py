from typing import Any

from pymongo import ASCENDING, DESCENDING, IndexModel

from app.db.collections import ACTIVITIES, ACTIVITY_SAMPLES, PLANNED_SESSIONS, TRAINING_PLANS


async def ensure_indexes(database: Any) -> None:
    await database[ACTIVITIES].create_indexes(
        [
            IndexModel([("started_at_utc", DESCENDING)]),
            IndexModel([("local_date", ASCENDING)]),
            IndexModel([("sport", ASCENDING)]),
            IndexModel([("category", ASCENDING)]),
            IndexModel([("source.checksum_sha256", ASCENDING)], sparse=True),
            IndexModel([("source.garmin_activity_id", ASCENDING)], sparse=True),
            IndexModel([("planned_session_id", ASCENDING)], sparse=True),
        ]
    )
    await database[ACTIVITY_SAMPLES].create_indexes(
        [
            IndexModel([("activity_id", ASCENDING), ("chunk_index", ASCENDING)], unique=True),
            IndexModel([("activity_id", ASCENDING)]),
        ]
    )
    await database[TRAINING_PLANS].create_indexes(
        [
            IndexModel(
                [("status", ASCENDING)],
                unique=True,
                partialFilterExpression={"status": "active"},
                name="one_active_training_plan",
            ),
            IndexModel([("start_date", ASCENDING)]),
            IndexModel([("end_date", ASCENDING)]),
        ]
    )
    await database[PLANNED_SESSIONS].create_indexes(
        [
            IndexModel([("training_plan_id", ASCENDING), ("scheduled_date", ASCENDING)]),
            IndexModel([("scheduled_date", ASCENDING)]),
            IndexModel([("status", ASCENDING)]),
            IndexModel([("completed_activity_id", ASCENDING)], sparse=True),
        ]
    )
