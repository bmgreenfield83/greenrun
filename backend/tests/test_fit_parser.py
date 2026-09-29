from datetime import UTC, datetime, timedelta

import pytest
from garmin_fit_sdk import Encoder, Profile

from app.services.fit.garmin import GarminFitActivityParser, InvalidFitError


def synthetic_fit_bytes() -> bytes:
    started = datetime(2026, 8, 4, 11, 0, tzinfo=UTC)
    encoder = Encoder()
    encoder.on_mesg(
        Profile["mesg_num"]["FILE_ID"],
        {
            "type": "activity",
            "manufacturer": "garmin",
            "product": 1,
            "time_created": started,
            "serial_number": 123,
        },
    )
    for seconds, distance, heart_rate in ((0, 0, 120), (5, 15, 130), (10, 31, 140)):
        encoder.on_mesg(
            Profile["mesg_num"]["RECORD"],
            {
                "timestamp": started + timedelta(seconds=seconds),
                "distance": distance,
                "heart_rate": heart_rate,
                "speed": 3.1,
                "cadence": 165,
                "altitude": 12,
                "position_lat": 123456,
                "position_long": -654321,
            },
        )
    encoder.on_mesg(
        Profile["mesg_num"]["LAP"],
        {
            "message_index": 0,
            "timestamp": started + timedelta(seconds=10),
            "start_time": started,
            "total_elapsed_time": 10,
            "total_timer_time": 10,
            "total_distance": 31,
            "avg_heart_rate": 130,
            "max_heart_rate": 140,
        },
    )
    encoder.on_mesg(
        Profile["mesg_num"]["SESSION"],
        {
            "message_index": 0,
            "timestamp": started + timedelta(seconds=10),
            "start_time": started,
            "total_elapsed_time": 10,
            "total_timer_time": 10,
            "total_distance": 31,
            "sport": "running",
            "sub_sport": "generic",
            "first_lap_index": 0,
            "num_laps": 1,
            "avg_heart_rate": 130,
            "max_heart_rate": 140,
            "avg_speed": 3.1,
        },
    )
    encoder.on_mesg(
        Profile["mesg_num"]["ACTIVITY"],
        {
            "timestamp": started + timedelta(seconds=10),
            "total_timer_time": 10,
            "num_sessions": 1,
            "type": "manual",
            "event": "activity",
            "event_type": "stop",
        },
    )
    return bytes(encoder.close())


def test_official_sdk_parses_synthetic_fit_and_removes_coordinates() -> None:
    result = GarminFitActivityParser().parse(synthetic_fit_bytes(), "synthetic.fit", 5)

    assert result.activity.sport == "run"
    assert result.activity.distance_meters == 31
    assert len(result.activity.laps) == 1
    assert len(result.samples) == 3
    serialized = result.model_dump_json()
    assert "position_lat" not in serialized
    assert "position_long" not in serialized
    assert "latitude" not in serialized
    assert "longitude" not in serialized


def test_normalizer_succeeds_without_optional_fields() -> None:
    started = datetime(2026, 8, 4, 11, tzinfo=UTC)
    result = GarminFitActivityParser().normalize(
        {
            "session_mesgs": [
                {"start_time": started, "total_elapsed_time": 60, "sport": "running"}
            ],
            "record_mesgs": [
                {"timestamp": started},
                {"timestamp": started + timedelta(seconds=60)},
            ],
        },
        "minimal.fit",
        5,
    )

    assert result.activity.summary.average_heart_rate is None
    assert result.activity.laps == []
    assert len(result.samples) == 2


def test_normalizer_uses_record_temperature_and_session_subjective_aliases() -> None:
    started = datetime(2026, 8, 4, 11, tzinfo=UTC)
    result = GarminFitActivityParser().normalize(
        {
            "file_id_mesgs": [{"manufacturer": "garmin"}],
            "session_mesgs": [
                {
                    "start_time": started,
                    "total_elapsed_time": 60,
                    "sport": "running",
                    "workout_rpe": 30,
                    "workout_feel": 75,
                }
            ],
            "record_mesgs": [
                {"timestamp": started, "temperature": 20},
                {"timestamp": started + timedelta(seconds=60), "temperature": 22},
            ],
        },
        "weather.fit",
        5,
    )

    assert result.activity.summary.temperature_celsius == 21
    assert result.activity.subjective.effort == 3
    assert result.activity.subjective.feel == "strong"


def test_normalizer_uses_standard_weather_conditions_humidity() -> None:
    started = datetime(2026, 8, 4, 11, tzinfo=UTC)
    result = GarminFitActivityParser().normalize(
        {
            "session_mesgs": [
                {"start_time": started, "total_elapsed_time": 60, "sport": "running"}
            ],
            "record_mesgs": [
                {"timestamp": started},
                {"timestamp": started + timedelta(seconds=60)},
            ],
            "weather_conditions_mesgs": [
                {"timestamp": started, "relative_humidity": 72},
                {"timestamp": started + timedelta(seconds=60), "relative_humidity": 74},
            ],
        },
        "humid.fit",
        5,
    )

    assert result.activity.summary.humidity_percent == 73


def test_normalizer_prefers_session_average_humidity() -> None:
    started = datetime(2026, 8, 4, 11, tzinfo=UTC)
    result = GarminFitActivityParser().normalize(
        {
            "session_mesgs": [
                {
                    "start_time": started,
                    "total_elapsed_time": 60,
                    "sport": "running",
                    "avg_humidity": 68,
                }
            ],
            "record_mesgs": [{"timestamp": started}],
            "weather_conditions_mesgs": [{"relative_humidity": 75}],
        },
        "humid.fit",
        5,
    )

    assert result.activity.summary.humidity_percent == 68


def test_normalizer_converts_garmin_minimum_rpe_boundary() -> None:
    started = datetime(2026, 8, 4, 11, tzinfo=UTC)
    result = GarminFitActivityParser().normalize(
        {
            "file_id_mesgs": [{"manufacturer": "garmin"}],
            "session_mesgs": [
                {
                    "start_time": started,
                    "total_elapsed_time": 60,
                    "sport": "running",
                    "workout_rpe": 10,
                    "workout_feel": 100,
                }
            ],
            "record_mesgs": [
                {"timestamp": started},
                {"timestamp": started + timedelta(seconds=60)},
            ],
        },
        "minimum-rpe.fit",
        5,
    )

    assert result.activity.subjective.effort == 1
    assert result.activity.subjective.feel == "very strong"


def test_invalid_fit_header_is_rejected() -> None:
    with pytest.raises(InvalidFitError, match="valid FIT header"):
        GarminFitActivityParser().parse(b"not-a-fit-file!", "bad.fit", 5)
