from dataclasses import dataclass
from typing import Any

from pymongo import AsyncMongoClient

from app.core.config import Settings


@dataclass
class MongoResources:
    client: AsyncMongoClient[Any]
    database: Any


def create_mongo_resources(settings: Settings) -> MongoResources:
    client: AsyncMongoClient[Any] = AsyncMongoClient(
        settings.mongodb_uri.get_secret_value(),
        appname="greenrun",
        serverSelectionTimeoutMS=5000,
    )
    return MongoResources(client=client, database=client[settings.mongodb_database])


async def check_mongo_connection(resources: MongoResources) -> None:
    await resources.client.admin.command("ping")
