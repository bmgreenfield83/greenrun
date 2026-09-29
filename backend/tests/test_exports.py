from datetime import date

import pytest

from app.services.exports import ExportService, smooth_samples, without_gps
from app.services.fit.models import ActivitySample


def test_sample_smoothing_uses_imperial_values_and_excludes_coordinates() -> None:
    samples = [
        ActivitySample(elapsed_seconds=0, distance_meters=0, heart_rate=140, speed_mps=3),
        ActivitySample(elapsed_seconds=5, distance_meters=15, heart_rate=150, speed_mps=3),
        ActivitySample(elapsed_seconds=16, distance_meters=48, heart_rate=160, speed_mps=3),
    ]

    result = smooth_samples(samples, 15)

    assert len(result) == 2
    assert result[0]["average_heart_rate"] == 145
    assert result[0]["distance_miles"] == pytest.approx(0.0093, abs=0.0001)
    assert result[0]["average_pace_seconds_per_mile"] == pytest.approx(536.4, abs=0.1)
    assert "latitude" not in without_gps({"latitude": 1, "nested": {"longitude": 2}})
    assert without_gps({"nested": {"longitude": 2}}) == {"nested": {}}


class ActivitiesFake:
    async def get(self, activity_id: str):
        return self.items()[0] if activity_id == "a1" else None

    async def list_range(self, _start: str, _end: str):
        return self.items()

    @staticmethod
    def items():
        return [
            {
                "id": "a1",
                "sport": "run",
                "category": "easy",
                "title": "Run",
                "local_date": "2026-08-04",
                "distance_meters": 5000,
                "elapsed_time_seconds": 1800,
                "moving_time_seconds": 1750,
                "summary": {"average_speed_mps": 2.86, "average_heart_rate": 145},
                "laps": [],
                "subjective": {"effort": 4},
                "weather_notes": None,
                "planned_session_id": "s1",
                "derived_metrics": {
                    "heart_rate_response": {
                        "algorithm_version": 3,
                        "eligible": True,
                        "adjusted_change_bpm_per_hour": 4.8,
                    }
                },
            },
            {
                "id": "a2",
                "sport": "bike",
                "title": "Ride",
                "local_date": "2026-08-04",
                "distance_meters": 10000,
                "elapsed_time_seconds": 1800,
                "moving_time_seconds": 1750,
                "summary": {"average_speed_mps": 5.71},
                "laps": [],
                "subjective": {},
                "weather_notes": None,
                "planned_session_id": None,
                "derived_metrics": {},
            },
        ]


class SamplesFake:
    async def list_for_activity(self, _activity_id: str):
        return [{"samples": [{"elapsed_seconds": 0, "heart_rate": 140, "speed_mps": 3}]}]


class PlansFake:
    async def get(self, plan_id: str):
        if plan_id != "p1":
            return None
        return {
            "id": "p1",
            "name": "Plan",
            "description": None,
            "primary_goal": "Run a strong 10K.",
            "secondary_goal": "Stay healthy.",
            "start_date": "2026-08-03",
            "end_date": "2026-08-09",
            "week_summaries": [{"week_number": 1, "planned_running_miles": 3.1, "focus": "Base"}],
        }


class SessionsFake:
    async def get(self, session_id: str):
        return self.items()[0] if session_id == "s1" else None

    async def list_for_plan(self, _plan_id: str):
        return self.items()

    async def list_range(self, _start: str, _end: str):
        return self.items()

    @staticmethod
    def items():
        return [
            {
                "id": "s1",
                "training_plan_id": "p1",
                "scheduled_date": "2026-08-04",
                "sport": "run",
                "session_type": "easy",
                "title": "Easy",
                "planned_distance_meters": 5000,
                "planned_duration_seconds": None,
                "instructions": "Easy effort",
                "justification": "Build aerobic support for the primary goal.",
                "status": "completed",
                "completed_activity_id": "a1",
            }
        ]


@pytest.mark.asyncio
async def test_activity_and_plan_analysis_exports_include_context_and_unplanned_period_data() -> (
    None
):
    service = ExportService(ActivitiesFake(), SamplesFake(), PlansFake(), SessionsFake())  # type: ignore[arg-type]

    activity = await service.activity_export("a1")
    analysis = await service.plan_analysis("p1")
    template = await service.plan_template("p1")
    range_export = await service.range_export(date(2026, 8, 4), date(2026, 8, 4), "day")
    all_activity_export = await service.range_export(
        date(2026, 8, 4),
        date(2026, 8, 4),
        "day",
        include_all_activities=True,
    )

    assert activity is not None and activity["export_type"] == "activity"
    assert activity["planned_session"]["id"] == "s1"
    assert activity["samples"][0]["average_heart_rate"] == 140
    assert analysis is not None and analysis["export_type"] == "training_plan_analysis"
    assert analysis["trend_metrics"]["heart_rate_response"][0][
        "adjusted_change_bpm_per_hour"
    ] == 4.8
    assert analysis["weekly_summaries"][0]["completed_running_miles"] == pytest.approx(
        3.11, abs=0.01
    )
    assert template is not None and template["weeks"][0]["sessions"][0]["scheduled_date"] == date(
        2026, 8, 4
    )
    assert template["primary_goal"] == "Run a strong 10K."
    assert template["secondary_goal"] == "Stay healthy."
    assert template["weeks"][0]["sessions"][0]["justification"].startswith("Build aerobic")
    assert range_export is not None and range_export["planned_sessions"][0]["id"] == "s1"
    assert [item["sport"] for item in range_export["activities"]] == ["run"]
    assert all_activity_export is not None
    assert [item["sport"] for item in all_activity_export["activities"]] == ["run", "bike"]
