import asyncio

from app.core.config import get_settings
from app.db.client import create_mongo_resources
from app.db.indexes import ensure_indexes
from app.repositories.settings import SettingsRepository
from app.services.settings import SettingsService


async def initialize_database() -> bool:
    config = get_settings()
    resources = create_mongo_resources(config)
    try:
        await ensure_indexes(resources.database)
        await SettingsService(SettingsRepository(resources.database), config).get()
    except Exception:
        return False
    finally:
        await resources.client.close()
    return True


def main() -> int:
    initialized = asyncio.run(initialize_database())
    print("MongoDB initialization: complete" if initialized else "MongoDB initialization: failed")
    return 0 if initialized else 1


if __name__ == "__main__":
    raise SystemExit(main())
