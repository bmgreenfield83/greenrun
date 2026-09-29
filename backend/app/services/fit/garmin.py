from collections import defaultdict
from datetime import UTC, datetime
from statistics import fmean
from typing import Any
from zoneinfo import ZoneInfo

from garmin_fit_sdk import Decoder, Stream
from garmin_fit_sdk import __version__ as sdk_version

from app.core.errors import AppError
from app.schemas.activities import (
    ActivityCreate,
    ActivityLap,
    ActivitySource,
    ActivitySummary,
    SubjectiveData,
)
from app.services.fit.models import ActivitySample, ParsedFitActivity


class InvalidFitError(AppError):
    status_code = 422
    code = "invalid_fit_file"


def _first(messages: dict[str, Any], key: str) -> dict[str, Any]:
    values = messages.get(key) or []
    return values[0] if values else {}


def _number(message: dict[str, Any], *keys: str) -> float | None:
    for key in keys:
        value = message.get(key)
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return float(value)
    return None


def _integer(message: dict[str, Any], *keys: str) -> int | None:
    value = _number(message, *keys)
    return round(value) if value is not None else None


def _utc(value: Any) -> datetime | None:
    if not isinstance(value, datetime):
        return None
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def _sport(value: Any) -> str:
    normalized = str(value or "").lower()
    return {
        "running": "run",
        "walking": "walk",
        "cycling": "bike",
        "swimming": "swim",
        "hiking": "hike",
        "training": "strength",
    }.get(normalized, "other")


def _category(sport: str, sub_sport: Any) -> str | None:
    if sport != "run":
        return None
    normalized = str(sub_sport or "").lower()
    if "trail" in normalized:
        return "trail"
    if any(value in normalized for value in ("interval", "track")):
        return "track"
    if "recovery" in normalized:
        return "recovery"
    return "other"


CADENCE_SCALE_VERSION = 2
"""Stored cadence convention: running cadence in steps per minute (both feet).

Version 1 (the implicit value for older documents) stored Garmin's per-leg running cadence.
"""


def _cadence_multiplier(sport: str) -> int:
    """Garmin records running cadence per leg (strides/min); runs are reported in steps/min."""
    return 2 if sport == "run" else 1


def _cadence(
    message: dict[str, Any], keys: tuple[str, ...], fractional_key: str, multiplier: int
) -> float | None:
    """Combine integer and fractional cadence, then scale exactly once."""
    whole = _number(message, *keys)
    if whole is None:
        return None
    fraction = _number(message, fractional_key) or 0.0
    return (whole + fraction) * multiplier


def _average(values: list[float | int | None]) -> float | None:
    present = [float(value) for value in values if value is not None]
    return fmean(present) if present else None


def _humidity(messages: dict[str, Any], session: dict[str, Any]) -> float | None:
    """Read humidity from session extensions or standard FIT weather messages."""
    session_value = _number(session, "avg_humidity", "relative_humidity", "humidity")
    if session_value is not None:
        return session_value
    weather_values = [
        _number(item, "relative_humidity", "humidity")
        for item in messages.get("weather_conditions_mesgs") or []
    ]
    weather_average = _average(weather_values)
    if weather_average is not None:
        return weather_average
    return _average(
        [
            _number(item, "relative_humidity", "humidity")
            for item in messages.get("record_mesgs") or []
        ]
    )


def _workout_feel(session: dict[str, Any]) -> str | None:
    value = _integer(session, "workout_feel")
    if value is not None:
        garmin_scale = {
            0: "very weak",
            25: "weak",
            50: "normal",
            75: "strong",
            100: "very strong",
        }
        if value in garmin_scale:
            return garmin_scale[value]
        return {
            1: "very poor",
            2: "poor",
            3: "okay",
            4: "good",
            5: "very good",
        }.get(value, str(value))
    fallback = session.get("feel") or session.get("feeling")
    return str(fallback) if fallback is not None else None


def _workout_effort(session: dict[str, Any], manufacturer: Any) -> int | None:
    value = _integer(session, "workout_rpe")
    if value is not None:
        is_garmin = "garmin" in str(manufacturer or "").lower()
        return round(value / 10) if is_garmin and 0 <= value <= 100 else value
    return _integer(session, "perceived_exertion", "rpe", "rating")


def aggregate_records(
    records: list[dict[str, Any]], interval_seconds: int, *, cadence_multiplier: int = 1
) -> list[ActivitySample]:
    timestamped = [(record, _utc(record.get("timestamp"))) for record in records]
    timestamped = [(record, timestamp) for record, timestamp in timestamped if timestamp]
    if not timestamped:
        return []
    started_at = timestamped[0][1]
    buckets: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for record, timestamp in timestamped:
        elapsed = max(0, round((timestamp - started_at).total_seconds()))
        buckets[(elapsed // interval_seconds) * interval_seconds].append(record)

    samples: list[ActivitySample] = []
    for elapsed, values in sorted(buckets.items()):
        distances = [_number(item, "distance") for item in values]
        present_distances = [value for value in distances if value is not None]
        samples.append(
            ActivitySample(
                elapsed_seconds=elapsed,
                distance_meters=present_distances[-1] if present_distances else None,
                heart_rate=_integer(
                    {"value": _average([_number(item, "heart_rate") for item in values])}, "value"
                ),
                speed_mps=_average([_number(item, "enhanced_speed", "speed") for item in values]),
                cadence_spm=_average(
                    [
                        _cadence(item, ("cadence",), "fractional_cadence", cadence_multiplier)
                        for item in values
                    ]
                ),
                elevation_meters=_average(
                    [_number(item, "enhanced_altitude", "altitude") for item in values]
                ),
                temperature_celsius=_average([_number(item, "temperature") for item in values]),
            )
        )
    return samples


# FIT `intensity` enum values, for decoders that return numbers instead of names.
LAP_INTENSITIES = {
    0: "active",
    1: "rest",
    2: "warmup",
    3: "cooldown",
    4: "recovery",
    5: "interval",
    6: "other",
}


def _lap_intensity(lap: dict[str, Any]) -> str | None:
    value = lap.get("intensity")
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, int):
        return LAP_INTENSITIES.get(value)
    text = str(value).strip().lower()
    return text or None


def _laps(messages: dict[str, Any], cadence_multiplier: int) -> list[ActivityLap]:
    result: list[ActivityLap] = []
    for index, lap in enumerate(messages.get("lap_mesgs") or [], start=1):
        elapsed = _number(lap, "total_elapsed_time")
        if elapsed is None or elapsed <= 0:
            continue
        result.append(
            ActivityLap(
                index=index,
                start_time_utc=_utc(lap.get("start_time")),
                elapsed_time_seconds=elapsed,
                moving_time_seconds=_number(lap, "total_timer_time"),
                distance_meters=_number(lap, "total_distance"),
                average_speed_mps=_number(lap, "enhanced_avg_speed", "avg_speed"),
                average_heart_rate=_integer(lap, "avg_heart_rate"),
                maximum_heart_rate=_integer(lap, "max_heart_rate"),
                average_cadence_spm=_cadence(
                    lap,
                    ("avg_running_cadence", "avg_cadence"),
                    "avg_fractional_cadence",
                    cadence_multiplier,
                ),
                maximum_cadence_spm=_cadence(
                    lap,
                    ("max_running_cadence", "max_cadence"),
                    "max_fractional_cadence",
                    cadence_multiplier,
                ),
                elevation_gain_meters=_number(lap, "total_ascent"),
                elevation_loss_meters=_number(lap, "total_descent"),
                lap_trigger=str(lap["lap_trigger"]) if lap.get("lap_trigger") is not None else None,
                intensity=_lap_intensity(lap),
                workout_step_index=_integer(lap, "wkt_step_index"),
            )
        )
    return result


class GarminFitActivityParser:
    parser_version = f"garmin-fit-sdk/{sdk_version}"

    def parse(
        self, content: bytes, filename: str, sample_interval_seconds: int
    ) -> ParsedFitActivity:
        if len(content) < 14:
            raise InvalidFitError("The uploaded file is too small to be a FIT activity.")
        if not Decoder(Stream.from_byte_array(bytearray(content))).is_fit():
            raise InvalidFitError("The uploaded file does not contain a valid FIT header.")
        if not Decoder(Stream.from_byte_array(bytearray(content))).check_integrity():
            raise InvalidFitError("The FIT file failed its size or CRC integrity check.")

        messages, errors = Decoder(Stream.from_byte_array(bytearray(content))).read(
            enable_crc_check=True,
            merge_heart_rates=True,
        )
        if errors:
            raise InvalidFitError("The FIT decoder reported an invalid or unsupported file.")
        return self.normalize(messages, filename, sample_interval_seconds)

    def normalize(
        self, messages: dict[str, Any], filename: str, sample_interval_seconds: int
    ) -> ParsedFitActivity:
        session = _first(messages, "session_mesgs")
        records = messages.get("record_mesgs") or []
        first_record_time = _utc(records[0].get("timestamp")) if records else None
        started_at = _utc(session.get("start_time")) or first_record_time
        if started_at is None:
            raise InvalidFitError("The FIT activity has no usable start timestamp.")

        elapsed = _number(session, "total_elapsed_time")
        if elapsed is None and records:
            last_record_time = _utc(records[-1].get("timestamp"))
            elapsed = (last_record_time - started_at).total_seconds() if last_record_time else None
        if elapsed is None or elapsed <= 0:
            raise InvalidFitError("The FIT activity has no usable duration.")

        sport = _sport(session.get("sport"))
        cadence_multiplier = _cadence_multiplier(sport)
        samples = aggregate_records(
            records, sample_interval_seconds, cadence_multiplier=cadence_multiplier
        )
        file_id = _first(messages, "file_id_mesgs")
        device = _first(messages, "device_info_mesgs")
        timezone = "America/New_York"
        local_date = started_at.astimezone(ZoneInfo(timezone)).date()
        distance = _number(session, "total_distance")
        if distance is None and samples:
            distance = next(
                (
                    sample.distance_meters
                    for sample in reversed(samples)
                    if sample.distance_meters is not None
                ),
                None,
            )
        average_speed = _number(session, "enhanced_avg_speed", "avg_speed")
        if average_speed is None:
            average_speed = _average([sample.speed_mps for sample in samples])
        average_temperature = _number(session, "avg_temperature", "temperature")
        if average_temperature is None:
            average_temperature = _average([sample.temperature_celsius for sample in samples])

        activity = ActivityCreate(
            sport=sport,
            category=_category(sport, session.get("sub_sport")),
            title=f"{sport.title()} on {local_date.strftime('%b %d, %Y')}",
            started_at_utc=started_at,
            timezone=timezone,
            local_date=local_date,
            distance_meters=distance,
            elapsed_time_seconds=elapsed,
            moving_time_seconds=_number(session, "total_timer_time"),
            summary=ActivitySummary(
                average_heart_rate=_integer(session, "avg_heart_rate"),
                maximum_heart_rate=_integer(session, "max_heart_rate"),
                average_speed_mps=average_speed,
                average_cadence_spm=_cadence(
                    session,
                    ("avg_running_cadence", "avg_cadence"),
                    "avg_fractional_cadence",
                    cadence_multiplier,
                ),
                maximum_cadence_spm=_cadence(
                    session,
                    ("max_running_cadence", "max_cadence"),
                    "max_fractional_cadence",
                    cadence_multiplier,
                ),
                elevation_gain_meters=_number(session, "total_ascent"),
                elevation_loss_meters=_number(session, "total_descent"),
                calories=_number(session, "total_calories"),
                temperature_celsius=average_temperature,
                humidity_percent=_humidity(messages, session),
                aerobic_training_effect=_number(session, "training_effect"),
                anaerobic_training_effect=_number(session, "anaerobic_training_effect"),
            ),
            laps=_laps(messages, cadence_multiplier),
            subjective=SubjectiveData(
                effort=_workout_effort(
                    session, device.get("manufacturer") or file_id.get("manufacturer")
                ),
                feel=_workout_feel(session),
            ),
            source=ActivitySource(
                type="fit",
                filename=filename,
                parser_version=self.parser_version,
                cadence_scale_version=CADENCE_SCALE_VERSION,
                device_manufacturer=str(device.get("manufacturer") or file_id.get("manufacturer"))
                if device.get("manufacturer") or file_id.get("manufacturer")
                else None,
                device_product=str(device.get("product") or file_id.get("product") or "") or None,
                garmin_activity_id=str(session.get("activity_id") or file_id.get("activity_id"))
                if session.get("activity_id") or file_id.get("activity_id")
                else None,
            ),
        )
        return ParsedFitActivity(activity=activity, samples=samples)
