# Data model

The hybrid MongoDB model uses `activities`, `activity_samples`, `training_plans`, `planned_sessions`, and `app_settings`. Laps are embedded in activities; samples are stored in time chunks. Plans, sessions, and completed activities remain distinct. Every main document has a schema version.

Canonical storage uses meters, seconds, meters per second, Celsius, and UTC. Local calendar dates are stored as ISO `YYYY-MM-DD` strings. No GPS coordinates or original FIT bytes are stored.

## Collections

- `activities`: objective summary, exact embedded laps, subjective metadata, source metadata, derived metrics, and an optional planned-session reference. Versioned workload-adjusted heart-rate response (algorithm version 4, with its 90% interval and included analysis ranges, or its explicit exclusion reason) is stored under `derived_metrics.heart_rate_response`. Time in zones, TRIMP training load, heart rate at easy grade-adjusted pace, and goal-card data are computed on request from samples and are not stored. Recalculation removes the retired `heart_rate_drift` result. API updates expose metadata only, protecting imported objective values.
- `activities.heart_rate_analysis_start_distance_meters`: optional user-authored analysis metadata that excludes samples before a distance threshold from workload-adjusted HR modeling without changing the objective activity or sample records.
- `activities.source.garmin_activity_id`: the Garmin Connect activity ID. Garmin sync always sets it (see [garmin-sync.md](garmin-sync.md)) and uses it, through its sparse index, to skip runs already imported; uploaded FIT files set it only when the file carries one.
- `activities.source.cadence_scale_version`: `2` means running cadence (`summary`, `laps`, samples) is stored in steps per minute. Absent or `1` marks older FIT imports that stored Garmin's per-leg running cadence; see [Migrations](#migrations).
- `activity_samples`: ten-minute chunk documents keyed by activity and chunk index. Samples default to five-second elapsed-time resolution and include distance, heart rate, speed, cadence, elevation, and temperature only. A chunk corrected by the cadence migration carries `cadence_scale_version: 2`.
- `training_plans`: scheduled plan instances with active, archived, completed, or abandoned status. Optional primary and secondary goals preserve the intent used to generate the plan. Optional structured `goal_target` (`distance_meters`, `target_time_seconds`) records a "time at a distance" goal. Embedded week summaries preserve each imported week's focus and declared running-mileage target. A partial unique index permits at most one active plan.
- `planned_sessions`: individual scheduled sessions linked to a plan, with optional instructions and a distinct justification explaining how the workout supports the plan goals, an optional completed-activity link, and historical reschedule fields retained for compatibility.
- `app_settings`: singleton `_id: application` document containing timezone, sample interval, export threshold, configurable storage limits, and optional `max_heart_rate_bpm` / `resting_heart_rate_bpm`.

Deleting an activity first detaches any session that references it, restores that session to `planned`, and then removes the activity and its sample chunks. Deleting a session linked to a completed activity is rejected until it is detached.

Plan replacement archives the active `training_plans` document and leaves its sessions intact. Activity attachment is reciprocal: the session stores `completed_activity_id`, while the activity stores `planned_session_id`. Earlier rescheduling fields remain readable in the schema, but the current product does not create replacement sessions or expose rescheduling controls.

## Indexes

Activity indexes cover start time, local date, sport, category, checksum, Garmin activity ID, and planned-session ID. Samples use unique `(activity_id, chunk_index)`. Plans index status and dates, including the one-active-plan partial unique index. Sessions index plan/date, date, status, and completed activity.

Storage statistics use `collStats` when the deployment permits it. If Atlas permissions do not expose those statistics, the API returns `available: false` rather than guessing.

## Migrations

One-off data migrations live in `backend/app/db/migrations`. Each one is idempotent, performs a dry run by default, and writes only with `--apply`. Back up the database first; see [database-backup.md](database-backup.md).

### Running cadence (per leg to steps per minute)

Garmin FIT files record running cadence per leg. FIT imports now double run cadence and include `fractional_cadence`, then set `source.cadence_scale_version: 2`. Only `sport: run` activities are doubled; walking, hiking, and cycling cadence is stored as recorded. To correct runs imported earlier:

```powershell
Set-Location backend
py -3.12 -m app.db.migrations.double_running_cadence          # dry run: prints counts only
py -3.12 -m app.db.migrations.double_running_cadence --apply  # after a backup
```

The migration selects FIT-sourced runs whose `source.cadence_scale_version` is not `2`. It doubles `summary.average_cadence_spm`, `summary.maximum_cadence_spm`, each lap's average and maximum cadence, and every sample's `cadence_spm`. Each sample chunk is marked (`cadence_scale_version: 2`) in the same update that doubles it, and the activity is marked last. Every write is guarded by its marker, so a rerun, including one after an interruption, never doubles a value twice. Runs whose stored average cadence is already above 130 are reported and left unchanged for manual review. Earlier imports did not store fractional cadence, so it cannot be restored.
