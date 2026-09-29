# Analytics

The analytics view provides Monday-based weekly mileage, rolling 7/28/90-day mileage, active-plan progress, planned-versus-completed mileage, adherence counts, conservative personal bests, temperature bands, and workload-adjusted heart-rate response history. Comparable runs remain on individual activity pages.

## Workload-adjusted heart-rate response

Algorithm version 3 replaces the retired half-to-half drift percentage. It estimates the change in heart rate over time after accounting for workload recorded in the FIT samples. It is descriptive and must not be interpreted as a diagnosis, a proprietary fitness score, or proof of dehydration or fatigue.

Processing is deliberately interpretable:

1. Exclude the first five minutes and stopped samples.
2. Require at least 80% heart-rate/speed coverage and 20 minutes of usable running.
3. Derive grade from elevation change over an approximately 30-second window, requiring at least 20 meters of horizontal movement and clamping implausible slopes.
4. Combine speed and grade into an external-workload signal. Uphill work increases the signal and downhill running reduces it within conservative bounds.
5. Pass workload through a first-order response filter. Candidate HR-response time constants from 15 to 120 seconds are evaluated; the best-fitting candidate is retained when workload varies enough to identify it.
6. Fit heart rate using robust regression with workload and elapsed hours as predictors. Iteratively reweighted residuals reduce the influence of isolated sensor errors.

The elapsed-time coefficient is reported as adjusted bpm/hour. The same coefficient multiplied by usable duration produces total adjusted HR change. Results also contain model `R²`, typical prediction error (RMSE in bpm), usable duration, response time when identifiable, and low/moderate/high confidence.

Runs are ineligible when they are not runs, are shorter than 25 minutes, lack sufficient samples or coverage, retain less than 20 minutes of usable running, cannot produce a physiologically directional workload fit, or change pace/grade so consistently with time that workload and the time trend cannot be separated. Track and interval workouts are not categorically excluded, but may receive lower confidence or an exclusion reason.

Confidence combines usable duration, model fit, and prediction error. It does not eliminate unrecorded confounders: weather exposure, hydration, wind, fatigue, medication, sensor accuracy, and individual physiology remain possible influences.

New FIT imports calculate the result automatically. **Recalculate HR response** rebuilds results for stored runs and removes the retired `heart_rate_drift` field. The activity page shows the adjusted rate, total change, fit, typical error, response time, confidence, limitations, and the shaded analysis region. The aggregate chart uses adjusted bpm/hour and a duration-weighted descriptive trend. Its multi-select category filter includes every category by default; selecting or clearing individual categories recomputes the plotted points, trend, and result list together.

An activity may set `heart_rate_analysis_start_distance_meters` to ignore unreliable early HR readings without deleting or modifying FIT samples. The activity page exposes this in miles as **Ignore HR analysis before mile** and recalculates only that activity. The ordinary five-minute settling exclusion still applies, so analysis begins at whichever threshold occurs later. The override is persisted and included in activity exports.

## Comparisons and records

Comparable-run rows expose distance, pace, heart rate, and recorded weather context. They use the current activity as the anchor and select runs in the same category within 15% distance. Temperature and humidity are displayed when recorded but never invented; temperature comparisons are observational rather than causal.

The separate same-weekday chart contains the current run plus as many as 12 earlier runs on the same local weekday, regardless of category or distance. Track workouts remain visible by design.

Personal bests use conservative sources: mile-sized Garmin laps, approximately 5K/10K whole activities, longest run, and highest Monday–Sunday mileage. Arbitrary sample-window record detection is excluded.

## Heart rate at comparable pace

The Analytics page includes a separate observed HR comparison across weeks. The
read-only `GET /api/analytics/comparable-heart-rate` endpoint calculates version 1
from the last 180 calendar days, including today. Existing imports work immediately;
no recalculation, migration, or new persisted derived field is required. The endpoint
returns its algorithm version, date range, screened/qualifying run counts, exclusion
counts, comparison groups, contributing runs, and Monday-based weekly summaries.
Sample reads are batched in groups of at most 25 runs.

Selection and calculation:

1. Include easy, long, recovery, and run-club categories only. Other categories,
   including unclassified runs and track workouts, are excluded.
2. Examine fixed five-minute blocks from minute 10 through minute 60. Require an
   additional preceding minute of steady running to reduce transition effects.
   Respect the activity's `heart_rate_analysis_start_distance_meters` throughout
   this settling minute and the section.
3. Require HR, speed, distance, and elevation throughout the section and settling
   minute. Derive grade over an approximately 30-second trailing window (25–40
   seconds, at least 20 meters traveled). Require grade within ±1%, speed at least
   1.5 m/s, and all speeds within 10% of the section-plus-settling median.
4. Reject duplicate timestamps, gaps over 15 seconds, and coverage that begins or
   ends more than 10 seconds inside the requested window. Require at least 280
   observed seconds within each five-minute section. Use timestamp-weighted
   trapezoidal averages of HR and speed, not sample-count averages.
5. Group by category, nearest 30-second/mile section pace (±15 seconds), ten-minute
   elapsed-time band, and recorded activity temperature in 5°C / 9°F bands.
   Unknown temperature is a separate group. Band boundaries are fixed and the
   upper pace/temperature boundary belongs to the next band. These are conservative
   matching rules, not physiologically validated thresholds; boundary effects and
   sparse groups are expected. No interpolation between groups is performed.
6. Within a group, combine each run's sections by observed duration. Calculate
   weekly median HR across these run averages, giving each run equal weight.
   The displayed range is the minimum/maximum run average, not a confidence interval.

The default comparison has the most distinct qualifying weeks, then the most runs,
with stable ID ordering as a tie-breaker. A selector changes the chart, weekly
table, and contributing-run table together. Weekly points use calendar time on
the horizontal axis and show observed range bars. No trend line is extrapolated
across missing weeks. A single-week group shows its data with an explicit
insufficient-history message. Activity links expose the source workouts, and the
table reports actual section pace, HR, matched minutes, and recorded temperature.

This feature compares nearly flat sections rather than applying the existing
HR-response algorithm's grade adjustment. Temperature comes from the stored
activity summary and is not an ambient-weather correction. Wind, heat exposure,
hydration, fatigue, HR lag, within-band differences, and sensor error remain
uncontrolled. Lower HR alone does not establish improved fitness. The matching
windows and thresholds are versioned implementation choices, not a readiness or
fitness score. HR zones remain outside this feature.
