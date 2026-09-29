from datetime import date
from typing import Any

from bson import ObjectId

from app.core.errors import InvalidIdentifierError

REFERENCE_FIELDS = {
    "planned_session_id",
    "training_plan_id",
    "completed_activity_id",
    "activity_id",
    "rescheduled_from_session_id",
    "rescheduled_to_session_id",
}


def object_id(value: str) -> ObjectId:
    if not ObjectId.is_valid(value):
        raise InvalidIdentifierError("The supplied resource identifier is invalid.")
    return ObjectId(value)


def api_to_document(data: dict[str, Any]) -> dict[str, Any]:
    converted: dict[str, Any] = {}
    for key, value in data.items():
        if key in REFERENCE_FIELDS and value is not None:
            converted[key] = object_id(value)
        elif isinstance(value, date) and not hasattr(value, "hour"):
            converted[key] = value.isoformat()
        elif isinstance(value, dict):
            converted[key] = api_to_document(value)
        elif isinstance(value, list):
            converted[key] = [
                api_to_document(item) if isinstance(item, dict) else item for item in value
            ]
        else:
            converted[key] = value
    return converted


def document_to_api(document: dict[str, Any]) -> dict[str, Any]:
    converted: dict[str, Any] = {}
    for key, value in document.items():
        output_key = "id" if key == "_id" else key
        if isinstance(value, ObjectId):
            converted[output_key] = str(value)
        elif isinstance(value, dict):
            converted[output_key] = document_to_api(value)
        elif isinstance(value, list):
            converted[output_key] = [
                document_to_api(item)
                if isinstance(item, dict)
                else str(item)
                if isinstance(item, ObjectId)
                else item
                for item in value
            ]
        else:
            converted[output_key] = value
    return converted
