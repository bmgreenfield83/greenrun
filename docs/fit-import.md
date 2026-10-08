# FIT import

The parser adapter uses Garmin's official [`garmin-fit-sdk`](https://github.com/garmin/fit-python-sdk). The `FitActivityParser` protocol isolates that dependency from routes, services, and MongoDB.

## Pipeline

1. Require a `.fit` filename and enforce the configured upload limit.
2. Validate the FIT header, declared size, and CRC with Garmin's decoder.
3. Calculate SHA-256 over the uploaded bytes.
4. Decode session, lap, device, and record messages in memory.
5. Normalize canonical meters, seconds, meters per second, Celsius, and UTC values.
6. Extract exact Garmin lap messages. Each lap keeps the watch's own `intensity` label (active, rest, warmup, cooldown, recovery, interval, other) and structured-workout step (`workout_step_index`) when recorded; these are stored for imports from 2026-09-29 on and are `null` for earlier activities. The app does not classify laps itself.
7. Aggregate record messages to the configurable five-second persistence interval.
8. Never copy position fields into normalized models.
9. Detect checksum, source-ID, or start/duration/distance duplicates.
10. Suggest an unfulfilled session from the active plan only when its scheduled date exactly matches the activity's local date.
11. Return a preview token and editable metadata.
12. Automatically confirm straightforward queued files that have neither duplicate matches nor a planned-session decision.
13. Pause duplicate matches and possible planned-session links for explicit review before saving.

Garmin Connect sync feeds the same pipeline: it downloads a day's runs, extracts each FIT file in memory, and previews it with its Garmin activity ID attached. See [garmin-sync.md](garmin-sync.md).

## Importing from the calendar

Imports start from a day in the calendar's day view (`features/calendar/useDayImport.ts`). **Import activity** runs the Garmin Connect sync for that day; **Upload a FIT file** accepts one or more `.fit` files instead. Each file is previewed independently through the existing atomic preview endpoint, so one unreadable file does not block the rest.

Previews without duplicate matches or a same-date planned-session suggestion are saved automatically using their parsed FIT metadata, and the calendar refreshes. Previews requiring a choice keep their preview token and open the existing review dialog over the calendar, one at a time. A notice in the day view summarizes the result, including when an uploaded file belongs to a different date than the selected day.

The preview cache stores normalized Pydantic models for at most 30 minutes and has a ten-entry cap. It never stores the uploaded bytes. A backend restart invalidates outstanding previews.

## Samples

Records are grouped into five-second elapsed-time buckets. Distance uses the last known value in a bucket. Heart rate, speed, cadence, elevation, and temperature use the mean of available values. Missing fields remain `null`; they are never invented. Garmin records running cadence per leg. For `run` activities, record, lap, and session cadence is therefore doubled to steps per minute after adding `fractional_cadence` (or `avg_`/`max_fractional_cadence`) when present. Other sports keep the recorded value. New imports are marked `source.cadence_scale_version: 2`; older runs are corrected by the migration described in [data-model.md](data-model.md#migrations). Samples are then stored in ten-minute chunk documents. Exact Garmin laps remain embedded in the activity and are not smoothed.

## Coordinates

The decoder may expose FIT `position_lat` and `position_long` fields, but the normalization layer selects only approved sample fields. Coordinates, route geometry, and original FIT bytes therefore cannot enter activity or sample schemas. Synthetic tests include coordinate fields and assert they are absent from serialized normalized output.

## Supplemental FIT metadata review

The Phase 3 follow-up makes cadence, elevation gain, temperature, and humidity visible in the import preview. Exact lap records are already parsed and stored even though the preview intentionally shows only the lap count; Phase 5 will provide the detailed lap view and charts.

Effort and feel are imported from the standard FIT session fields `workout_rpe` and `workout_feel`, with compatibility aliases retained for older or device-specific decoders. Garmin devices encode the user-facing RPE as 10–100 and feel as 0/25/50/75/100, so Garmin-authored files are normalized to effort 1–10 and labels from very weak through very strong. Manufacturer-aware normalization preserves direct 1–10 and 1–5 encodings from other devices. Many FIT activities omit these fields, so missing values remain editable subjective metadata rather than being inferred.

Device temperature is imported from session `avg_temperature` or aggregated record `temperature` values. Humidity is imported when the FIT payload provides it: a session average takes precedence, followed by the average of standard `weather_conditions.relative_humidity` messages, then record-level humidity extensions. Garmin Connect's activity weather panel is different: Garmin documents it as station-derived weather added by Connect, so it normally is not part of the device FIT file. Free-form weather notes remain user-authored context, and humidity is never invented.

## Duplicate behavior

Checksum is the primary signal. Garmin/source activity ID and a narrow start-time, duration, and distance signature are secondary signals. A detected duplicate blocks normal creation until the user chooses replacement or explicit duplicate import. Replacement keeps existing editable metadata unless the preview supplies an override.
