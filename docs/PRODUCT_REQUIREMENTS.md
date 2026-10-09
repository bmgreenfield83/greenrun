Build a complete local-first personal endurance-training application.

The application is for one user and will initially run on a personal Windows computer. It must use:

- React
- TypeScript
- Vite
- Material UI
- FullCalendar React
- Recharts
- FastAPI
- Python
- Pydantic
- MongoDB Atlas
- PyMongo AsyncMongoClient
- Garmin FIT activity files only

Do not use GPX or TCX.

The application should be architected so that multi-user support could be added later, but do not implement authentication or user accounts in version one.

Do not put the entire frontend in App.tsx or App.js. Use a clean component, view, service, hook, type, and utility structure.

The application is primarily intended to:

1. Store and display a database-driven training plan.
2. Import completed Garmin FIT activities.
3. Match completed activities to planned sessions.
4. Retain backend compatibility for manually entered non-Garmin activities without exposing manual entry in the frontend.
5. Track skipped sessions without rewriting historical dates; retain legacy rescheduling data for compatibility without exposing a rescheduling workflow.
6. Export activity and training-plan data as structured JSON for later analysis by ChatGPT.
7. Provide a limited set of useful non-AI analytics inside the app.
8. Preserve detailed activity samples so heart-rate, pace, cadence, and drift can be analyzed later.

Do not integrate with the ChatGPT API or any other AI API.

## User-approved amendments

- Add an observed heart-rate-at-comparable-workload trend across weeks on the
  Analytics page. Use sustained sections matched by pace, grade, time into the run,
  category, and recorded temperature where available. Show qualifying runs and
  variability, avoid extrapolation and fitness-score claims, and respect existing
  HR analysis exclusions. HR zones are not included in this addition. The versioned
  matching rules and limitations are documented in `docs/analytics.md`.

The following decisions supersede older statements elsewhere in this document:

- Calendar weeks and relative training-plan weeks begin on Monday.
- Training plans may include explicit session dates; an undated plan accepts any date in its intended first week and resolves against that week's Monday.
- FIT imports suggest links only to an exact same-day planned session. Early/late rescheduling suggestions are not part of the current workflow.
- Manual completed-activity entry is retained only as backend schema compatibility and is not exposed in the frontend.
- Multi-activity analysis exports contain runs by default, with an explicit option to include every sport.
- Comparable runs appear on individual activity pages, not the aggregate Analytics page.
- The original half-to-half heart-rate drift percentage is replaced by algorithm version 3 workload-adjusted heart-rate response. The model uses recorded speed, smoothed elevation-derived grade, delayed HR response, and elapsed time; it reports adjusted bpm/hour, total adjusted change, model fit/error, and confidence. Track workouts are eligible, while statistically inseparable workload/time patterns receive an exclusion reason.
- AI track-session reviews (approved 2026-10-08) supersede "Do not integrate with the ChatGPT API or any other AI API" and the AI non-goals in sections 40 and later. The integration is optional and off unless `GREEN_AI_URL` is configured. Greenrun never calls an AI provider itself: the separate green-ai service reads Greenrun's API and calls the model. On a track, tempo, race, or progression activity, Brett can run a review, reply to it, and see exactly what was sent. Proposed changes are limited to the rest of that week and the next week, and nothing changes in the plan until Brett applies a change. Greenrun applies a change only if the session is still planned and unedited since the review. GPS is never sent. Details are in `docs/ai-reviews.md`.

==================================================
1. GENERAL APPLICATION BEHAVIOR
==================================================

The application is single-user and local.

The React frontend and FastAPI backend run locally.

MongoDB Atlas is the initial database location.

Do not require Docker for ordinary development or use. However:

- Provide optional Dockerfiles and Docker Compose configuration for future use.
- The app must work fully without Docker.
- Provide a root command that launches frontend and backend together.
- Also allow launching them separately.
- Provide a clickable Windows PowerShell development-start script.

Recommended development commands:

Frontend:
npm run dev

Backend:
uvicorn app.main:app --reload

Root:
npm run dev

Also provide:
start-dev.ps1

The root command may use a package such as concurrently.

Use environment variables for database configuration.

Expected variables:

MONGODB_URI=
MONGODB_DATABASE=running_tracker

Do not hardcode or commit credentials.

Include:

- .env.example
- appropriate .gitignore entries
- setup documentation

Ignore:

.env
.env.local
backend/.env
frontend/.env

==================================================
2. PROJECT STRUCTURE
==================================================

Use a clean monorepo-style structure similar to:

/
  frontend/
    src/
      api/
      components/
      features/
        activities/
        calendar/
        plans/
        analytics/
        exports/
      hooks/
      layouts/
      pages/
      types/
      utils/
      App.tsx
      main.tsx
  backend/
    app/
      api/
        routes/
      core/
      db/
      models/
      repositories/
      schemas/
      services/
        fit/
        analytics/
        exports/
        plans/
      utils/
      main.py
    tests/
  scripts/
  docs/
  package.json
  README.md
  COMMANDS.md
  .env.example
  docker-compose.yml

Do not treat this exact structure as mandatory if a better best-practice structure is appropriate, but maintain strong separation of concerns.

==================================================
3. DATA-STORAGE PRINCIPLES
==================================================

MongoDB is document-oriented. Do not imitate a relational database unnecessarily.

Use a hybrid model:

- Embed laps in the parent activity document.
- Store detailed time-series activity samples in a separate collection.
- Store planned sessions separately from completed activities.
- Store training plans separately from planned sessions.
- Do not store original FIT files.
- Do store a SHA-256 checksum for duplicate detection.
- Do not store GPS latitude or longitude.
- Do not export GPS information.

Canonical database units:

- Distance: meters
- Duration: seconds
- Speed: meters per second
- Temperature: Celsius
- Timestamps: UTC

Display and export for the user in:

- Miles
- Minutes per mile
- Fahrenheit
- America/New_York local time unless a future setting changes it

Do not expose metric storage details unnecessarily in the UI.

==================================================
4. COLLECTIONS
==================================================

Create at least these MongoDB collections:

- activities
- activity_samples
- training_plans
- planned_sessions
- app_settings

Do not create:

- users
- gear
- shoes
- structured strength exercise/set collections

Design documents with schema-version fields where appropriate.

==================================================
5. ACTIVITIES COLLECTION
==================================================

Each completed workout is an activity.

Supported sports:

- run
- walk
- bike
- swim
- strength
- hike
- other

Running categories:

- easy
- long
- track
- tempo
- recovery
- race
- trail
- progression
- run_club
- other

A completed activity can be:

- Imported from FIT
- Entered manually

A day may contain multiple activities.

In version one:

- One activity may fulfill zero or one planned session.
- One planned session may be fulfilled by zero or one activity.
- Do not implement multiple activities fulfilling the same planned session yet.

A suggested activity document:

{
  "_id": ObjectId,
  "schema_version": 1,
  "sport": "run",
  "category": "track",
  "title": "Week 2 Track Workout",

  "started_at_utc": ISODate,
  "timezone": "America/New_York",
  "local_date": "2026-08-04",

  "distance_meters": 8421.5,
  "elapsed_time_seconds": 3420,
  "moving_time_seconds": 3198,

  "summary": {
    "average_heart_rate": 154,
    "maximum_heart_rate": 178,
    "average_speed_mps": 2.63,
    "average_cadence_spm": 164,
    "maximum_cadence_spm": 183,
    "elevation_gain_meters": 42,
    "elevation_loss_meters": 40,
    "calories": 684,
    "temperature_celsius": 28.9,
    "humidity_percent": null,
    "aerobic_training_effect": 3.4,
    "anaerobic_training_effect": 1.2
  },

  "laps": [
    {
      "index": 1,
      "start_time_utc": ISODate,
      "elapsed_time_seconds": 327,
      "moving_time_seconds": 325,
      "distance_meters": 1000,
      "average_speed_mps": 3.08,
      "average_heart_rate": 161,
      "maximum_heart_rate": 170,
      "average_cadence_spm": 172,
      "maximum_cadence_spm": 180,
      "elevation_gain_meters": 1.5,
      "elevation_loss_meters": 1.2,
      "lap_trigger": "manual"
    }
  ],

  "subjective": {
    "effort": 3,
    "effort_label": "moderate",
    "feel": "okay",
    "sleep_score": 68,
    "sleep_label": "fair",
    "pain_soreness_notes": "Left medial knee noticeable after the run.",
    "notes": "Felt controlled through the fourth repetition."
  },

  "weather_notes": "Very humid.",

  "source": {
    "type": "fit",
    "filename": "activity.fit",
    "checksum_sha256": "...",
    "imported_at_utc": ISODate,
    "parser_version": "1.0",
    "device_manufacturer": "Garmin",
    "device_product": "...",
    "garmin_activity_id": null
  },

  "planned_session_id": ObjectId | null,

  "derived_metrics": {
    "heart_rate_drift": {
      "eligible": true,
      "percent": 4.8,
      "analysis_start_seconds": 600,
      "first_half_average_heart_rate": 148,
      "second_half_average_heart_rate": 155,
      "first_half_average_speed_mps": 2.61,
      "second_half_average_speed_mps": 2.59,
      "exclusion_reason": null
    }
  },

  "created_at_utc": ISODate,
  "updated_at_utc": ISODate
}

The exact model may be improved, but retain the intent and capabilities.

Imported objective fields are immutable after import:

- Recorded timestamp
- Duration
- Distance
- Heart rate
- Pace/speed
- Cadence
- Elevation
- Laps
- Temperature
- FIT samples

Editable metadata:

- Title
- Category
- Effort
- Feel
- Sleep score
- Sleep label
- Pain/soreness notes
- Freeform notes
- Weather notes
- Planned-session assignment

Do not provide UI controls that allow users to manually edit imported lap pace, distance, heart rate, cadence, or timestamps.

Allow deleting an activity.

Deletion must require a clear confirmation dialog.

If an activity is linked to a planned session, deleting it should detach it from the session and return the planned session to an appropriate unfulfilled status.

==================================================
6. ACTIVITY SAMPLES
==================================================

FIT record messages contain time-series data sampled throughout an activity.

Preserve useful samples because they may enable later analysis that is impossible using only summary and lap data.

Store:

- elapsed seconds
- distance meters
- heart rate
- speed meters per second
- cadence
- elevation meters
- temperature Celsius when present

Do not store:

- latitude
- longitude
- exact route geometry
- geographic coordinates

Store samples separately from the main activity document.

Do not create one MongoDB document per second.

Use chunked sample documents, for example one chunk per 5, 10, or 15 minutes.

Suggested structure:

{
  "_id": ObjectId,
  "activity_id": ObjectId,
  "chunk_index": 0,
  "start_elapsed_seconds": 0,
  "end_elapsed_seconds": 599,
  "samples": [
    {
      "elapsed_seconds": 0,
      "distance_meters": 0,
      "heart_rate": 112,
      "speed_mps": null,
      "cadence_spm": null,
      "elevation_meters": 12.4,
      "temperature_celsius": null
    }
  ]
}

Create useful indexes on activity_id and chunk_index.

Activity samples do not need to be displayed as raw rows in the normal UI.

Use them for charts, derived metrics, and exports.

==================================================
7. FIT IMPORT
==================================================

Only support Garmin FIT files.

Use Garmin’s official Python FIT SDK if practical and reliable. A well-maintained FIT parser may be used if needed, but isolate parser-specific code behind an adapter.

Implement an import pipeline:

1. Upload FIT file.
2. Validate extension and basic file structure.
3. Read uploaded bytes.
4. Calculate SHA-256 checksum.
5. Check for duplicates.
6. Parse FIT file.
7. Normalize into internal models.
8. Extract activity summary.
9. Extract Garmin laps exactly as recorded.
10. Extract record samples.
11. Discard coordinates.
12. Calculate derived metrics where eligible.
13. Suggest a matching planned session.
14. Show an import-preview dialog.
15. Allow editable metadata and notes.
16. Persist only after confirmation.
17. Do not retain original FIT bytes after import.

Create a parser interface or protocol such as:

class FitActivityParser(Protocol):
    def parse(self, content: bytes) -> ParsedActivity:
        ...

FIT parsing implementation must remain isolated from MongoDB and API-route code.

Do not assume every FIT file has every field.

Handle missing:

- heart rate
- cadence
- elevation
- calories
- humidity
- temperature
- training effect
- laps

The import must still succeed when optional fields are absent.

==================================================
8. DUPLICATE DETECTION
==================================================

Detect likely duplicate imports using:

Primary:
- SHA-256 checksum

Secondary:
- Garmin/source activity ID if available
- activity start time
- duration
- distance

When a duplicate is found, show a dialog with:

- Cancel
- Replace existing activity
- Import as duplicate

Replacing should preserve editable metadata when sensible or clearly warn which metadata will be overwritten.

Do not silently create duplicates.

==================================================
9. IMPORT PREVIEW AND POST-IMPORT EDITING
==================================================

After parsing but before saving, show a preview containing:

- Date and local start time
- Sport
- Suggested category
- Distance
- Duration
- Average pace
- Average heart rate
- Maximum heart rate
- Cadence
- Elevation gain
- Temperature/humidity if present
- Lap count
- Suggested planned session
- Duplicate warning if applicable

Allow the user to enter or edit:

- Title
- Category
- Effort
- Feel
- Sleep score
- Sleep label
- Pain/soreness notes
- Freeform notes
- Weather notes
- Planned-session assignment

Notes must be optional.

The user may save immediately and edit subjective fields later.

==================================================
10. EFFORT, FEEL, SLEEP, PAIN, AND NOTES
==================================================

Preserve effort and feel from Garmin/FIT when present.

Use Garmin-compatible scales and labels.

Allow effort and feel to be edited.

Sleep fields:

- sleep_score: integer 0–100, optional
- sleep_label:
  - poor
  - fair
  - good
  - great

Pain/soreness:

Use one optional freeform text field only.

Do not implement:

- before/during/after separate fields
- required pain scores
- knee-specific fields
- next-day required reporting

Freeform notes are also required as an optional field for anything else the user wants to record.

==================================================
11. MANUAL ACTIVITIES
==================================================

Allow manual creation of activities when no FIT file exists.

Manual form fields should adjust according to sport.

Run, walk, bike, swim, or hike:

- Date
- Optional start time
- Duration
- Optional distance
- Optional title
- Optional category where relevant
- Optional effort
- Optional feel
- Optional sleep score and sleep label
- Optional pain/soreness notes
- Optional notes

Strength:

- Date
- Optional start time
- Duration
- Optional title
- Optional effort
- Optional feel
- Optional sleep score and sleep label
- Optional pain/soreness notes
- Optional notes

Do not show distance for strength.

Do not create a configurable dynamic-form database system for this. Use straightforward typed frontend logic and matching backend validation.

Strength notes are a simple summary only.

Do not build structured exercises, sets, weights, or repetitions.

==================================================
12. TRAINING PLANS
==================================================

Only one training plan may be active at a time.

Older plans remain archived and viewable.

Suggested training-plan document:

{
  "_id": ObjectId,
  "schema_version": 1,
  "name": "12-Week Running Plan",
  "description": "...",
  "status": "active",
  "start_date": "2026-08-03",
  "end_date": "2026-10-25",
  "week_starts_on": "monday",
  "created_at_utc": ISODate,
  "archived_at_utc": null,
  "source": {
    "type": "json_import",
    "imported_at_utc": ISODate
  }
}

Statuses:

- active
- archived
- completed
- abandoned

Plan import must use strict JSON schema validation.

Do not accept loosely structured JSON.

==================================================
13. PLANNED SESSIONS
==================================================

Planned sessions are separate from activities.

Suggested planned-session document:

{
  "_id": ObjectId,
  "schema_version": 1,
  "training_plan_id": ObjectId,

  "scheduled_date": "2026-08-06",
  "original_scheduled_date": "2026-08-06",

  "sport": "run",
  "session_type": "easy",
  "title": "Easy aerobic run",

  "planned_distance_meters": 6437.376,
  "planned_duration_seconds": null,

  "instructions": "Run at a relaxed conversational effort.",

  "status": "planned",

  "completed_activity_id": null,
  "completed_on_date": null,

  "skip_reason": null,
  "reschedule_notes": null,

  "created_at_utc": ISODate,
  "updated_at_utc": ISODate
}

Planned-session statuses:

- planned
- completed
- completed_late
- completed_early
- partially_completed
- skipped
- rescheduled

When a Thursday planned session is fulfilled by a Friday activity:

- Keep the planned session on Thursday.
- Set completed_on_date to Friday.
- Set status to completed_late.
- Link the Friday activity.
- Show the activity on Friday.
- Show the original planned session on Thursday with a completion-late indicator.
- Do not rewrite the activity date.
- Do not move the planned session to Friday.

When a session is skipped:

- Keep it visible on its original day.
- Mark it skipped.
- Allow an optional skip reason.
- Display it in red with reduced opacity and an X icon.

Completed sessions:

- Use a green border or similarly clear completed treatment.
- Show a check icon.
- Do not use opacity in a way that resembles a missed session.

==================================================
14. AUTOMATIC PLANNED-SESSION MATCHING
==================================================

After FIT import, suggest the planned session that the activity most likely fulfills.

Use:

- Local activity date
- Sport
- Planned distance
- Session type/category where inferable

Do not attach automatically without confirmation.

When importing a Wednesday run:

1. Prefer an existing Wednesday planned session.
2. Otherwise default its run category to run_club.
3. Allow the user to change it.

Do not override an explicitly planned Wednesday track, race, or long run merely because it occurs Wednesday.

==================================================
15. PLAN IMPORT
==================================================

Training-plan imports must use a strict versioned JSON schema.

The JSON should support reusable plans.

Prefer plan JSON that contains relative week/day placement rather than requiring hardcoded dates.

At import time:

- Ask for a plan start date.
- Resolve relative weeks and days into calendar dates.
- Preview the date range and planned mileage before saving.

Plan import preview should show:

- Plan name
- Number of weeks
- Start and end dates
- Number of planned sessions
- Total planned running mileage
- Any validation errors
- Any conflicts with the active plan

If imported dates conflict with the active plan:

- Warn the user.
- Ask whether to cancel or replace the active plan.

If replacement is approved:

- Archive the current active plan.
- Create the imported plan as a new active plan.
- Do not delete completed activities.
- Preserve the old plan and its completed history.
- Do not merge conflicting plan sessions.

If the user cancels, make no changes.

==================================================
16. TRAINING-PLAN EXPORTS
==================================================

Provide:

- Export current training plan
- Export archived training plan
- Export blank training-plan template

The purpose of these exports is to allow the user to give ChatGPT:

- A blank schema-compatible template
- A previously used plan as an exact formatting example

The blank export must contain:

- schema_version
- required fields
- valid sport values
- valid run/session categories
- relative week/day structure
- example optional values
- no actual workouts unless clearly labeled as examples

The normal plan export must preserve the exact import-compatible format where practical.

A plan that is exported should be valid for re-import after any required date-start selection.

==================================================
17. CALENDAR
==================================================

Use FullCalendar React.

Calendar behavior:

- Monday-first
- Month view is the primary view
- No separate week view is required initially
- Clearly highlight the current week
- Each day can display multiple activities and planned sessions
- Clicking a day opens a day-detail drawer or dialog
- Clicking an event opens its detail view
- Support planned, completed, skipped, and unplanned activities, plus read compatibility for historical rescheduled sessions

Use sport-based event colors.

Possible default sport colors may be chosen by the implementation.

Status treatment should be layered on top:

- Completed: check icon and green border
- Skipped: red, reduced opacity, X icon
- Planned but not completed: normal planned styling
- Completed late/early: check icon plus a small late/early label
- Unplanned activity: clearly shown as completed but unplanned

Calendar day details should show:

- Planned sessions
- Completed activities
- Status relationships
- Planned versus completed distance
- Notes
- Skip reason
- Reschedule information

==================================================
18. FRONTEND VIEWS
==================================================

Implement at least:

1. Dashboard
2. Calendar
3. Activity list (owner-approved change, 2026-10-08: replaced by the calendar's day view)
4. Activity detail
5. FIT import (owner-approved change, 2026-10-08: started from a calendar day, by Garmin Connect sync
   or FIT upload, instead of a separate page)
6. Manual activity entry
7. Training-plan management
8. Plan import preview
9. Plan export
10. Analytics/trends
11. Settings/about/setup if useful

Dashboard should show:

- Current active plan
- Current-week planned mileage
- Current-week completed mileage
- Current-week completion percentage
- Rolling 7-day mileage
- Rolling 28-day mileage
- Rolling 90-day mileage
- Recent activities
- Upcoming planned sessions
- Current plan progress
- Recent valid heart-rate drift results

Keep the dashboard practical rather than overloaded.

==================================================
19. ACTIVITY DETAIL VIEW
==================================================

Show:

- Activity title
- Date/time
- Sport and category
- Distance
- Moving time
- Elapsed time
- Average pace
- Heart rate
- Cadence
- Elevation
- Calories
- Temperature/humidity
- Effort
- Feel
- Sleep score/label
- Pain/soreness
- Notes
- Linked planned session
- Derived metrics
- Lap table
- Charts

Lap table should preserve all Garmin laps exactly as imported.

Columns may include:

- Lap
- Distance
- Duration
- Pace
- Average heart rate
- Maximum heart rate
- Average cadence
- Elevation gain
- Trigger

Do not attempt to automatically classify Garmin laps as warm-up, interval, recovery, or cooldown in version one.

==================================================
20. CHARTS
==================================================

Use Recharts.

Provide synchronized charts for:

- Heart rate over elapsed time
- Pace over elapsed time
- Cadence over elapsed time
- Elevation over elapsed time

A combined synchronized heart-rate and pace view is desirable.

Provide useful tooltips and zoom or selection if reasonably straightforward.

Do not display raw sample-table rows by default.

Provide a pace-versus-heart-rate scatterplot for suitable runs.

Do not claim that a pace/heart-rate ratio is a definitive fitness score.

==================================================
21. HEART-RATE DRIFT
==================================================

Implement a transparent heart-rate drift calculation.

The calculation should be based on the change in speed-to-heart-rate efficiency between the first and second halves of a steady portion of the activity.

Suggested concept:

efficiency = speed / heart_rate

drift_percent =
((first_half_efficiency - second_half_efficiency)
 / first_half_efficiency) * 100

Exact implementation may be refined, but document it clearly.

Eligibility rules should exclude or invalidate runs that are unsuitable, including:

- Too short
- Track workouts
- Interval workouts
- Repeated large pauses
- Extremely variable pace
- Insufficient heart-rate samples
- Insufficient speed samples
- Large missing-data gaps

Suggested minimum:

- At least 40 minutes total continuous duration
- Exclude approximately the first 10 minutes as warm-up
- Analyze the remaining continuous portion
- Require adequate sample coverage
- Require pace variability under a defensible threshold

Store:

- eligible
- drift percentage
- first-half average heart rate
- second-half average heart rate
- first-half average speed
- second-half average speed
- analysis start
- exclusion reason

Display the exclusion reason when unavailable.

Allow future recalculation if the algorithm changes.

==================================================
22. PACE AND HEART-RATE COMPARISONS
==================================================

Provide simple comparable-run analysis.

The app may identify runs that are broadly comparable using:

- Same run category
- Similar distance
- Similar duration
- Similar temperature
- Similar humidity when available

Example display:

August 4:
10:18/mi at 158 bpm, 84°F

September 12:
10:09/mi at 153 bpm, 80°F

Use transparent labels such as:

- Comparable runs
- Similar-distance easy runs
- Similar-temperature runs

Do not claim causal conclusions.

Do not create an opaque proprietary fitness score.

==================================================
23. TEMPERATURE-RELATED COMPARISONS
==================================================

Store temperature when present in FIT.

Store humidity when present.

Allow manual weather notes.

Provide transparent comparisons such as:

- Runs under 60°F
- Runs from 60–75°F
- Runs over 75°F
- Similar-temperature historical runs

Do not implement a mathematically “temperature-corrected pace” in version one.

Do not invent humidity when FIT does not provide it.

==================================================
24. OTHER ANALYTICS
==================================================

Include:

- Weekly running mileage
- Rolling 7-day mileage
- Rolling 28-day mileage
- Rolling 90-day mileage
- Planned versus completed mileage
- Missed and rescheduled session counts
- Personal bests
- Plan progress
- Heart-rate drift over time
- Comparable-run summaries

Personal bests may initially include:

- Fastest recorded mile lap
- Fastest recorded 5K activity or lap sequence where reliable
- Fastest recorded 10K activity
- Longest run
- Highest weekly mileage

Do not overengineer unofficial-record detection from arbitrary raw sample windows.

No dedicated interval-consistency score is needed.

No shoe mileage.

No automatic knee-pain-versus-mileage correlation dashboard.

Pain/soreness notes should still be included in exports.

==================================================
25. JSON EXPORTS
==================================================

The app’s export functionality is central.

Support exports for:

- One activity
- One calendar day
- One week
- One month
- Arbitrary date range
- Entire training plan

Use one JSON file by default.

If an export exceeds a configurable threshold, such as 20–25 MB, optionally produce a ZIP containing:

- manifest.json
- plan.json where relevant
- activities/*.json
- summaries/*.json

Do not produce ZIP unnecessarily.

One structured JSON file is preferred because it is easier to send to and analyze in ChatGPT.

All exports must:

- Be versioned
- Exclude GPS coordinates
- Use imperial display units
- Include machine-readable raw canonical values if helpful
- Include local dates and readable pace values
- Include laps
- Include subjective fields
- Include planned-session relationships
- Include weather
- Include derived metrics
- Include training context
- Include samples at an appropriate smoothed resolution

==================================================
26. SAMPLE EXPORT RESOLUTION
==================================================

Parse the full available FIT record stream in memory, but persist normalized samples at a configurable interval of 5 seconds by default. Preserve exact Garmin laps separately. Use sensible aggregation for heart rate, speed, cadence, elevation, distance, and temperature. Design the setting so the persistence interval could later be changed without redesigning the database.

For exported JSON, smooth or aggregate samples to keep file sizes manageable.

Recommended defaults:

- Single activity: 5-second samples
- Week: 15-second samples
- Month: 30-second samples
- Entire plan: 30- or 60-second samples

Laps are always exported exactly as imported.

Aggregation should produce values such as:

{
  "elapsed_seconds": 300,
  "distance_miles": 0.52,
  "average_heart_rate": 148,
  "average_pace_seconds_per_mile": 592,
  "average_cadence_spm": 163,
  "elevation_feet": 46
}

Do not export latitude or longitude.

Do not create a separate summary-only export button in version one.

Use one analysis-oriented export whose detail adjusts automatically according to scope.

==================================================
27. SINGLE-ACTIVITY EXPORT
==================================================

A single-activity export should include:

- Export metadata
- Activity summary
- Exact laps
- Subjective data
- Planned session
- Derived metrics
- Recent training context
- Smoothed activity samples
- Weather
- Relevant rolling mileage

Example shape:

{
  "schema_version": "1.0",
  "export_type": "activity",
  "generated_at": "...",
  "activity": {...},
  "planned_session": {...},
  "training_context": {
    "running_miles_previous_7_days": 19.4,
    "running_miles_previous_28_days": 68.2,
    "running_miles_previous_90_days": 196.8
  },
  "samples": [...]
}

==================================================
28. TRAINING-PLAN ANALYSIS EXPORT
==================================================

The entire-plan export is especially important.

Suggested shape:

{
  "schema_version": "1.0",
  "export_type": "training_plan_analysis",
  "generated_at": "...",

  "plan": {...},
  "planned_sessions": [...],
  "activities": [...],

  "weekly_summaries": [
    {
      "week_number": 1,
      "planned_running_miles": 21,
      "completed_running_miles": 19.4,
      "completed_sessions": 4,
      "skipped_sessions": 1,
      "rescheduled_sessions": 0,
      "average_effort": null,
      "average_heart_rate": null,
      "valid_drift_results": [...]
    }
  ],

  "plan_summary": {
    "planned_running_miles": 280,
    "completed_running_miles": 263,
    "completion_percent": 93.9,
    "completed_sessions": 52,
    "skipped_sessions": 3,
    "rescheduled_sessions": 4,
    "personal_bests": [...]
  },

  "trend_metrics": {
    "rolling_mileage": [...],
    "heart_rate_drift": [...],
    "comparable_run_groups": [...]
  }
}

Include unplanned activities performed during the plan dates.

Include condensed samples for completed activities.

The goal is to allow ChatGPT to evaluate:

- Whether the plan worked
- Whether volume progression was appropriate
- Whether fatigue accumulated
- Whether heart-rate drift improved
- Whether performance changed
- How well the user followed the plan
- What the next training plan should look like

==================================================
29. TRAINING-PLAN JSON SCHEMA
==================================================

Create a documented, strict, versioned training-plan JSON schema.

Provide:

- Pydantic validation
- JSON Schema output
- Frontend validation-error display
- Example valid plan JSON
- Blank reusable plan template
- Exported plan compatibility

A reusable imported plan should support relative scheduling such as:

{
  "schema_version": "1.0",
  "name": "12-Week Running Plan",
  "description": "...",
  "week_starts_on": "monday",
  "weeks": [
    {
      "week_number": 1,
      "focus": "Ease into structure",
      "planned_running_miles": 21,
      "sessions": [
        {
          "day_of_week": "tuesday",
          "sport": "run",
          "session_type": "track",
          "title": "Threshold introduction",
          "planned_distance_miles": 5,
          "instructions": "Warm up, then 4 × 5 minutes comfortably hard with 90 seconds easy jogging."
        }
      ]
    }
  ]
}

At import, ask the user to choose a start date.

The importer resolves relative dates.

==================================================
30. FUTURE TRACK-WORKOUT STRUCTURE
==================================================

Do not implement structured interval-segment comparison in version one, but design planned-session models so a future optional field can be added.

Potential future field:

"structured_workout": {
  "segments": [
    {
      "type": "warmup",
      "duration_seconds": 900
    },
    {
      "type": "repeat",
      "repeat_count": 5,
      "work": {
        "distance_meters": 1000,
        "target_pace_seconds_per_mile": 525
      },
      "recovery": {
        "duration_seconds": 120
      }
    }
  ]
}

Version one should use title, distance, and instructions only.

==================================================
31. DATABASE BACKUP AND PORTABILITY
==================================================

MongoDB Atlas data must be portable to a local MongoDB installation later.

Provide documented scripts for:

- Atlas backup using mongodump
- Atlas restore using mongorestore
- Restore to local MongoDB
- Restore to another Atlas cluster

Create:

scripts/backup_database.ps1
scripts/backup_database.sh
scripts/restore_database.ps1
scripts/restore_database.sh

Scripts must use environment variables and must not contain credentials.

Also create:

COMMANDS.md

This file should contain all important command-line invocations, including:

- Install frontend dependencies
- Install backend dependencies
- Start frontend
- Start backend
- Start both
- Run tests
- Build frontend
- Run linting
- Run formatting
- Export database
- Restore database
- Optional Docker commands
- Generate or inspect JSON schema
- Any migration or index setup commands

The user specifically wants this file so commands are not forgotten.

==================================================
32. INDEXES
==================================================

Create appropriate MongoDB indexes.

At minimum consider:

activities:
- started_at_utc
- local_date
- sport
- category
- source.checksum_sha256
- source.garmin_activity_id
- planned_session_id

activity_samples:
- activity_id + chunk_index unique
- activity_id

training_plans:
- status
- start_date
- end_date

planned_sessions:
- training_plan_id + scheduled_date
- scheduled_date
- status
- completed_activity_id

Use unique indexes only where they are safe.

==================================================
33. API DESIGN
==================================================

Create clean REST endpoints.

Suggested groups:

/api/activities
/api/activities/import-fit
/api/activities/{id}
/api/activities/{id}/samples
/api/activities/{id}/export
/api/manual-activities

/api/plans
/api/plans/import
/api/plans/export-blank
/api/plans/{id}/export
/api/plans/{id}/analysis-export
/api/plans/{id}/sessions

/api/planned-sessions
/api/planned-sessions/{id}
/api/planned-sessions/{id}/skip
/api/planned-sessions/{id}/attach-activity
/api/planned-sessions/{id}/detach-activity

/api/calendar
/api/analytics
/api/exports

Use appropriate request and response schemas.

Use service and repository layers rather than placing all database logic in route handlers.

Return useful validation and duplicate-detection errors.

==================================================
34. FRONTEND STATE AND API ACCESS
==================================================

Use a clean API-service layer.

A query library such as TanStack Query is recommended for:

- Fetching activities
- Calendar events
- Plans
- Analytics
- Cache invalidation after imports or edits

Use typed API models.

Do not scatter raw fetch calls throughout components.

Use React Hook Form and a schema validator such as Zod where appropriate.

==================================================
35. MATERIAL UI AND VISUAL DESIGN
==================================================

Use Material UI components.

The UI should feel like a polished personal fitness application, not an admin database console.

Use:

- Cards
- Dialogs
- Drawers
- Tabs
- Chips
- Tooltips
- Icons
- Responsive layouts
- Accessible forms

Do not create a visually dense enterprise dashboard.

Calendar events must remain readable.

Support desktop first, but make normal views usable on smaller screens.

==================================================
36. VALIDATION AND ERROR HANDLING
==================================================

Handle:

- Invalid FIT files
- Unsupported FIT messages
- Missing optional fields
- Duplicate imports
- MongoDB connectivity problems
- Invalid plan JSON
- Conflicting active plans
- Missing planned sessions
- Deleting linked activities
- Export generation failures
- Oversized export fallback
- Empty date ranges
- Activities with no samples
- Activities with no laps
- Activities with no heart rate

Display clear user-facing errors.

Do not expose stack traces in the frontend.

==================================================
37. TESTING
==================================================

Backend tests should cover:

- FIT parsing normalization
- Coordinate removal
- Checksum creation
- Duplicate detection
- Activity creation
- Activity deletion
- Planned-session matching
- Completed-late behavior
- Skip behavior
- Plan import validation
- Plan conflict handling
- Plan archiving
- Heart-rate drift eligibility
- Heart-rate drift calculation
- Export smoothing
- Plan-analysis export
- Unit conversion

Frontend tests should cover important components and workflows:

- FIT upload preview
- Duplicate warning
- Calendar status rendering
- Skip confirmation
- Plan import conflict dialog
- Subjective-field editing
- Export controls
- Activity lap table

Use realistic fixtures but do not commit private user FIT files.

Create synthetic or anonymized FIT/test data.

==================================================
38. DOCUMENTATION
==================================================

Create:

README.md
COMMANDS.md
docs/architecture.md
docs/data-model.md
docs/fit-import.md
docs/training-plan-schema.md
docs/exports.md
docs/analytics.md
docs/database-backup.md

README should explain:

- What the app does
- Required software
- Atlas setup
- Environment variables
- Installation
- Running frontend/backend
- Running both together
- Importing FIT files
- Importing plans
- Exporting data
- Running tests

Document the heart-rate drift algorithm and its limitations.

Document sample aggregation.

Document that no route coordinates are stored.

==================================================
39. MONGODB ATLAS SETUP
==================================================

Do not require credentials in the build prompt or source code.

The user will create MongoDB Atlas separately and place credentials in a local .env file.

Provide clear setup instructions for:

1. Creating an Atlas project
2. Creating a cluster
3. Creating a database user
4. Adding the user’s current IP address
5. Copying the connection string
6. Setting MONGODB_URI
7. Setting MONGODB_DATABASE
8. Testing connectivity
9. Creating indexes

Do not print the database password into logs.

==================================================
40. NON-GOALS
==================================================

Do not implement in version one:

- ChatGPT API integration
- AI-generated feedback
- Garmin API synchronization
- Garmin Connect login
- Automatic background imports
- Multi-user authentication
- User registration
- Social sharing
- Gear or shoe tracking
- GPS maps
- Route storage
- Route exports
- GPX parsing
- TCX parsing
- Full structured strength sets/reps
- Structured interval target comparison
- Automatic weather API lookup
- Temperature-corrected pace formulas
- Mobile native apps
- Complex symptom-correlation engine
- A proprietary readiness score
- A proprietary interval-consistency score

==================================================
41. DELIVERABLES
==================================================

Produce a working repository, not merely an architecture document.

Deliver:

1. Functional React frontend
2. Functional FastAPI backend
3. MongoDB Atlas integration
4. FIT parser
5. FIT import preview
6. Activity storage
7. Sample storage
8. Calendar
9. Training-plan import/export
10. Planned-session status handling
11. Backend compatibility for historical manual activities
12. Activity charts
13. Heart-rate drift
14. Mileage analytics
15. Comparable-run views
16. JSON analysis exports
17. Entire-plan export
18. Database backup scripts
19. Tests
20. Documentation
21. Optional Docker support
22. Root development command
23. Windows start script
24. Strict plan JSON schema
25. Blank training-plan export

==================================================
42. IMPLEMENTATION APPROACH
==================================================

Do not attempt the entire application as one enormous unreviewed change.

Work in coherent phases.

Recommended sequence:

Phase 1:
- Repository setup
- Frontend/backend skeletons
- MongoDB connection
- Environment configuration
- Health-check endpoint
- Documentation skeleton

Phase 2:
- Core data models
- Collections and indexes
- Basic activity CRUD
- Planned plan/session CRUD

Phase 3:
- FIT parsing
- Normalization
- Samples
- Duplicate detection
- Import preview
- Save flow

Phase 4:
- Calendar
- Plan import
- Plan conflict handling
- Skip and exact-date linking behavior

Phase 5:
- Activity details
- Laps
- Charts
- Subjective fields
- Backend compatibility for historical manual activities

Phase 6:
- Rolling mileage
- Planned versus completed mileage
- Heart-rate drift
- Comparable runs
- Personal bests

Phase 7:
- Activity, range, month, and plan exports
- Sample smoothing
- Blank-plan export
- Training-plan analysis export

Phase 8:
- Backup scripts
- Optional Docker support
- Testing
- Documentation
- UI refinement

V1.1 continuation:

Phase 9 — Consistency and foundation:
- Paginated and filterable activity browsing
- Sport-aware activity details, laps, and charts
- Linked planned-session and personal-best navigation
- Improved empty and loading states
- Removal of dead comparable-run, manual-entry, and stale frontend paths
- Documentation reconciliation

Phase 10 — Batch FIT import:
- Multi-file selection and drag-and-drop
- Import queue with per-file status
- Per-file duplicate and validation handling
- Automatic saving for straightforward files
- Pausing only files that require user decisions
- Import summary
- Import-another and view-activity actions
- Sport-aware preview presentation
- Compatibility with the existing single-file workflow

Phase 11 — Dashboard and plan management:
- Upcoming planned workouts, recent completed activities, and recent qualifying drift results
- Improved current-week plan progress
- Active-plan summary and read-only week-by-week plan view
- Archived-plan list, per-plan exports, and clear plan status/date ranges
- Carefully scoped plan archival or deletion controls
- Timezone management when it fits naturally

Phase 12 — Analytics and visualization:
- Heart-rate drift trend chart with confidence encoded visually
- Comparable-category filtering
- Optional duration/confidence-weighted trend line, subject to user approval of the calculation
- Improved personal-best and comparable-run navigation
- Sport-aware chart tooltips and axes
- Drift-analysis regions on activity charts
- Contextual temperature comparisons without implying causation

Phase 13 — Calendar polish and release hardening:
- Calendar legend and planned/completed visibility filters
- Dense multi-event-day and overflow verification
- Responsive calendar refinements
- End-to-end tests for major workflows
- Accessibility, documentation, setup, dead-code, and schema-compatibility audits
- Final v1.1 regression run

Deferred beyond v1.1:
- AI coaching
- GPS maps
- Automatic Garmin synchronization
- External weather enrichment
- Interval classification
- Injury-risk scoring
- Social functionality

Implementation guardrails for deferred work are documented in
`docs/future-enhancements.md`.

At the beginning, inspect the requirements and create:

- A concise implementation plan
- Proposed final directory structure
- Data-model summary
- Any unavoidable assumptions

Do not repeatedly ask preference questions already answered in this prompt.

When an implementation detail is unspecified, choose the simplest maintainable approach consistent with the requirements.

==================================================
43. ATLAS STORAGE MANAGEMENT
==================================================

The initial MongoDB Atlas free cluster has a limited storage allowance.

- Do not store original FIT files.
- Do not store GPS coordinates.
- Parse full FIT records in memory, but persist normalized samples at a
  configurable interval of 5 seconds by default.
- Preserve exact Garmin laps.
- Provide an application storage-statistics endpoint and settings display.
- Show approximate collection and index usage when MongoDB makes those
  statistics available.
- Warn the user when estimated database use exceeds 70%, 85%, and 95% of
  a configurable storage limit.
- Document how to reduce stored sample resolution in a future migration.
- Include a migration script capable of downsampling existing activity
  samples if necessary.
- Keep all database access compatible with both MongoDB Atlas and a
  standard local MongoDB deployment.
- Switching between Atlas and local MongoDB must require only changing
  MONGODB_URI and, if needed, MONGODB_DATABASE.


==================================================
44. ACCEPTANCE CRITERIA
==================================================

The project is acceptable when the user can:

1. Configure MongoDB Atlas through a local environment file.
2. Start frontend and backend locally without Docker.
3. Import a Garmin FIT run.
4. Preview the parsed run before saving.
5. See exact Garmin laps.
6. See pace, heart rate, cadence, and elevation charts.
7. See the run automatically appear on its correct calendar day.
8. Add title, category, effort, feel, sleep, pain/soreness, and notes.
9. Match the run to a planned session.
10. Leave an off-schedule Friday run independent from a missed Thursday session.
11. Mark a planned run skipped with an optional reason.
12. Delete an activity through a confirmation prompt.
13. Display imported strength activities without run- or bike-specific metrics.
14. Import a strict JSON training plan.
15. Receive a conflict warning when importing a plan over an active plan.
16. Archive the old plan and activate the new one when replacement is approved.
17. Export a blank training-plan JSON template.
18. Export an existing plan in a reusable format.
19. Export one activity with detailed smoothed samples and laps.
20. Export a week, month, range, or entire training plan.
21. Export a full plan in a format suitable for ChatGPT analysis.
22. See weekly and rolling mileage.
23. See planned versus completed mileage.
24. See heart-rate drift on eligible steady runs.
25. See why drift was unavailable on ineligible runs.
26. Compare broadly similar runs by pace, heart rate, and conditions.
27. Back up Atlas using the provided scripts.
28. Restore the database locally or to another Atlas cluster.
29. Find all important commands in COMMANDS.md.
30. Run automated tests successfully.

Build the application with maintainability and future extension in mind, but do not overengineer beyond these requirements.
