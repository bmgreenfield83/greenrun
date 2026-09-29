# Training-plan schema

Training-plan imports use the strict, versioned `1.0` format. Pydantic is the authoritative validator; unknown properties are rejected. Plans may contain actual dates, relative week/day placement, or both. The generated JSON Schema is available from `GET /api/plans/schema`, and a valid starter document is available from `GET /api/plans/export-blank` or the Plans page.

## Scheduling rules

- `week_starts_on` must be `monday`.
- Optional plan-level `start_date` may be any date in week 1. The importer normalizes it to that week's Monday so relative weekday assignments remain stable.
- Optional session-level `scheduled_date` must match its `day_of_week`, `week_number`, and the common plan calendar.
- A dated plan imports without a separate start-date selection.
- An undated plan defaults to the current week unless the user supplies any date in the intended first week.
- Week numbers must be unique and contiguous from 1.
- A week must contain at least one session and cannot contain two sessions on the same day.
- Running `session_type` values are `easy`, `long`, `track`, `tempo`, `recovery`, `race`, `trail`, `progression`, `run_club`, or `other`.
- Sports are `run`, `walk`, `bike`, `swim`, `strength`, `hike`, or `other`.
- Strength sessions cannot specify a distance. Duration and distance are otherwise optional.
- `primary_goal` and `secondary_goal` are optional plan-level text fields intended to preserve the goals used to generate the plan.
- `goal_target` is an optional structured "time at a distance" goal: `{ "distance_meters": number > 0, "target_time_seconds": number > 0 }`. For example, a 6:00 mile is `{ "distance_meters": 1609.344, "target_time_seconds": 360 }`. Both properties are required when `goal_target` is present, and no other properties are allowed. Plans without it import unchanged. On an existing plan, `PATCH /api/plans/{plan_id}` with `goal_target` sets it and `"goal_target": null` clears it. Omitting the property leaves it unchanged. The value is stored on the plan and returned by plan responses and the plan-template export.
- `justification` is optional session-level text explaining why the workout is present and how it supports the plan goals; `instructions` continues to describe what to do.

The import screen validates the complete document, previews resolved dates, session count and total running mileage, and displays field-level validation errors. Contradictory embedded dates and overrides are rejected rather than shifted. If an active plan exists, replacement requires explicit confirmation. Replacement archives that plan and retains its sessions and completed history; sessions are never merged.

See [training-plan.example.json](examples/training-plan.example.json) for a valid example.

## Calendar history

Skipping retains the original scheduled date and optional reason. Attaching an activity preserves its actual activity date; exact-date sessions can be linked during import, while off-schedule activities remain independent. Detaching restores the planned occurrence without deleting either record. Historical rescheduling fields remain backend-compatible but are not part of the current interface.
