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


def cadence_messages(sport: str) -> dict:
    started = datetime(2026, 8, 4, 11, tzinfo=UTC)
    return {
        "session_mesgs": [
            {
                "start_time": started,
                "total_elapsed_time": 10,
                "sport": sport,
                "avg_cadence": 83,
                "avg_running_cadence": 83,
                "avg_fractional_cadence": 0.5,
                "max_cadence": 85,
                "max_running_cadence": 85,
            }
        ],
        "lap_mesgs": [
            {
                "start_time": started,
                "total_elapsed_time": 10,
                "avg_running_cadence": 82,
                "avg_fractional_cadence": 0.25,
                "max_cadence": 86,
                "max_fractional_cadence": 0.5,
            }
        ],
        "record_mesgs": [
            {"timestamp": started, "cadence": 80, "fractional_cadence": 0.5},
            {"timestamp": started + timedelta(seconds=2), "cadence": 82},
            {"timestamp": started + timedelta(seconds=5), "cadence": 84},
        ],
    }


def test_running_cadence_is_converted_to_steps_per_minute_once() -> None:
    result = GarminFitActivityParser().normalize(cadence_messages("running"), "run.fit", 5)

    summary = result.activity.summary
    assert summary.average_cadence_spm == 167
    assert summary.maximum_cadence_spm == 170
    lap = result.activity.laps[0]
    assert lap.average_cadence_spm == 164.5
    assert lap.maximum_cadence_spm == 173
    assert [sample.cadence_spm for sample in result.samples] == [162.5, 168]
    assert result.activity.source.cadence_scale_version == 2


def test_non_running_cadence_is_not_doubled() -> None:
    result = GarminFitActivityParser().normalize(cadence_messages("cycling"), "bike.fit", 5)

    assert result.activity.summary.average_cadence_spm == 83.5
    assert result.activity.laps[0].average_cadence_spm == 82.25
    assert result.samples[0].cadence_spm == 81.25


def test_real_parse_path_doubles_record_cadence_for_runs() -> None:
    result = GarminFitActivityParser().parse(synthetic_fit_bytes(), "synthetic.fit", 5)

    assert result.samples[0].cadence_spm == 330


def test_lap_intensity_and_workout_step_are_recorded() -> None:
    messages = cadence_messages("running")
    first = messages["lap_mesgs"][0]
    messages["lap_mesgs"] = [
        first | {"intensity": "warmup"},
        first | {"intensity": 5, "wkt_step_index": 2},
        first | {"intensity": "Rest", "wkt_step_index": 3},
        first,
    ]

    laps = GarminFitActivityParser().normalize(messages, "run.fit", 5).activity.laps

    assert [lap.intensity for lap in laps] == ["warmup", "interval", "rest", None]
    assert [lap.workout_step_index for lap in laps] == [None, 2, 3, None]
