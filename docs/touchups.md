# Final touchups

Phase 8 resolves the actionable UI items below. FIT-device investigations remain documented where verification requires representative private files or an external-service decision.

## Activities navigation state

Status: completed in the supplemental Activities navigation-state phase.

Superseded (2026-10): the Activities list page was removed, along with this cache. Activities are browsed and imported from the calendar's day view.

## Planned-run completion details

Status: completed in Phase 8.

When viewing a planned workout with an attached completed activity:

- Remove the redundant `Completed on` line.
- Do not display the imported activity title, such as `Activity: Run on Aug 04, 2026`.
- Clearly separate the **Planned workout** from the green **What you did** result panel.
- Use sport-aware result metrics: pace for runs/walks, speed for bike rides, and no rate metrics for strength sessions.

## Manual activity entry

Status: completed in Phase 8 and cleaned up in Phase 9. The API remains schema-compatible, but the unrouted manual-entry page and frontend API helper have been removed.

Remove manual-activity creation from the user interface. This application will use imported activity files rather than manually entered completed activities.

## Garmin effort and feel

Status: completed and independently verified with a Forerunner 965 activity. The official FIT profile identified `workout_rpe` and `workout_feel` as the standard session fields, the Garmin 10-100 effort scale is normalized to 1-10, and the feel mapping is correct.

Investigate why an activity with effort and feel selected on the Garmin device imports without those values. Inspect the relevant FIT profile fields and device-specific message variants, expand the parser mapping where necessary, and add representative regression fixtures. Do not infer subjective values when the FIT file genuinely omits them.

## Garmin and historical weather data

Status: device-temperature import is completed and independently verified after enabling **Record Temperature** on the Forerunner 965. Garmin Connect station weather remains distinct from FIT sensor data. External enrichment is deferred because it would transmit time/location metadata to a third party and automatic weather lookup is currently a documented non-goal.

The representative Garmin FIT file inspected on 2026-08-05 decoded without errors and contained no session, lap, record, developer, or other weather/temperature measurements. It contained only the user's Fahrenheit display preference (`temperature_setting: statute`). The temperature visible in Garmin Connect for this activity is therefore Connect-provided station weather rather than device-recorded FIT temperature.

Forerunner 965 research confirms that the watch has an internal temperature sensor and supports an activity-profile **Record Temperature** setting, which is commonly off by default. Enabling it for the Run profile should add device-temperature records to future FIT activities. Wrist/body heat makes the internal reading unsuitable as precise ambient weather; Garmin recommends removing the watch for 20–30 minutes or pairing an external tempe sensor for more accurate ambient readings.

Investigate why Garmin displays temperature data for imported activities while the application receives no temperature values. Inspect session, lap, record, device-info, and developer-data FIT fields and confirm whether Garmin derives the displayed value outside the downloaded FIT file.

If the FIT file genuinely lacks usable temperature data, evaluate optional historical-weather enrichment through an external API. Any integration must be explicitly configured, avoid sending data without user consent, document the location and timestamp information transmitted, handle rate limits and unavailable historical observations, and preserve provenance so imported sensor data is distinguishable from externally sourced weather.
