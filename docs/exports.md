# Exports

Phase 7 provides versioned, analysis-oriented JSON downloads for a single activity, calendar day, week, month, arbitrary date range, import-compatible training plan, and complete training-plan analysis.

## Safety and units

Every analysis export declares schema version `1.0`, its export type, generation time, and `gps_included: false`. Export serialization recursively removes latitude, longitude, and common coordinate field names. Original FIT files and route geometry are never exported.

Canonical stored values remain available where useful. A `display` object adds miles and seconds-per-mile pace, while smoothed samples use miles, seconds per mile, feet, and Fahrenheit. Exact embedded laps are never smoothed or reconstructed.

## Sample resolution

- Single activity: 5 seconds
- Day, month, and arbitrary range: 30 seconds
- Week: 15 seconds
- Entire training plan: 30 seconds

Each bucket reports elapsed time, latest cumulative distance, average heart rate, average pace, cadence, elevation, and temperature when available. Missing channels remain `null`.

## Available downloads

- Activity details: **Export** downloads the activity, planned-session relationship, subjective and weather fields, derived metrics, recent 7/28/90-day running context, exact laps, and samples.
- Exports page: day, week, month, and custom-range downloads include runs and planned sessions within the selected dates. An unchecked-by-default option includes walks, rides, and other activity types.
- Exports page: an import-compatible plan download reconstructs the strict Monday-based plan template with explicit dates.
- Exports page: plan analysis includes every run during the plan dates, including unplanned runs, condensed samples, planned sessions, weekly adherence summaries, effort and heart-rate averages, valid workload-adjusted heart-rate response results, and overall completion totals. The same optional control can include every activity type.
- Plans page: the existing blank template download remains the schema-authoring starting point.

An empty calendar range returns a clear validation error instead of creating a misleading empty file. JSON is the default and only generated format in Phase 7; the product specification makes ZIP fallback optional, so no ZIP is created unnecessarily.

## API

- `GET /api/activities/{id}/export`
- `POST /api/exports`
- `GET /api/plans/{id}/export`
- `GET /api/plans/{id}/analysis-export`
- `GET /api/plans/export-blank`
