# Data model

The hybrid MongoDB model uses `activities`, `activity_samples`, `training_plans`, `planned_sessions`, and `app_settings`. Laps are embedded in activities; samples are stored in time chunks. Plans, sessions, and completed activities remain distinct. Every main document has a schema version.

Canonical storage uses meters, seconds, meters per second, Celsius, and UTC. Local calendar dates are stored as ISO `YYYY-MM-DD` strings. No GPS coordinates or original FIT bytes are stored.

## Collections

- `activities`: objective summary, exact embedded laps, subjective metadata, source metadata, derived metrics, and an optional planned-session reference. Versioned workload-adjusted heart-rate response (or its explicit exclusion reason) is stored under `derived_metrics.heart_rate_response`. Recalculation removes the retired `heart_rate_drift` result. API updates expose metadata only, protecting imported objective values.
- `activities.heart_rate_analysis_start_distance_meters`: optional user-authored analysis metadata that excludes samples before a distance threshold from workload-adjusted HR modeling without changing the objective activity or sample records.
- `activity_samples`: ten-minute chunk documents keyed by activity and chunk index. Samples default to five-second elapsed-time resolution and include distance, heart rate, speed, cadence, elevation, and temperature only.
- `training_plans`: scheduled plan instances with active, archived, completed, or abandoned status. Optional primary and secondary goals preserve the intent used to generate the plan. Embedded week summaries preserve each imported week's focus and declared running-mileage target. A partial unique index permits at most one active plan.
- `planned_sessions`: individual scheduled sessions linked to a plan, with optional instructions and a distinct justification explaining how the workout supports the plan goals, an optional completed-activity link, and historical reschedule fields retained for compatibility.
- `app_settings`: singleton `_id: application` document containing timezone, sample interval, export threshold, and configurable storage limits.

Deleting an activity first detaches any session that references it, restores that session to `planned`, and then removes the activity and its sample chunks. Deleting a session linked to a completed activity is rejected until it is detached.

Plan replacement archives the active `training_plans` document and leaves its sessions intact. Activity attachment is reciprocal: the session stores `completed_activity_id`, while the activity stores `planned_session_id`. Earlier rescheduling fields remain readable in the schema, but the current product does not create replacement sessions or expose rescheduling controls.

## Indexes

Activity indexes cover start time, local date, sport, category, checksum, Garmin activity ID, and planned-session ID. Samples use unique `(activity_id, chunk_index)`. Plans index status and dates, including the one-active-plan partial unique index. Sessions index plan/date, date, status, and completed activity.

Storage statistics use `collStats` when the deployment permits it. If Atlas permissions do not expose those statistics, the API returns `available: false` rather than guessing.
