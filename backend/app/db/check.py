import asyncio

from app.core.config import get_settings
from app.db.client import check_mongo_connection, create_mongo_resources


async def check_database() -> bool:
    resources = create_mongo_resources(get_settings())
    try:
        await check_mongo_connection(resources)
    except Exception:
        return False
    finally:
        await resources.client.close()
    return True


def main() -> int:
    connected = asyncio.run(check_database())
    print("MongoDB connection: connected" if connected else "MongoDB connection: unavailable")
    return 0 if connected else 1


if __name__ == "__main__":
    raise SystemExit(main())
