# Analytics

The analytics view provides 16 weeks of Monday-based running volume with the active plan's weekly targets, active-plan progress to date, exact-distance best efforts, the longest run and highest week, workload-adjusted heart-rate response history, time in heart-rate-reserve zones with TRIMP training load, heart rate at a fixed easy grade-adjusted pace, and a goal card for the active plan's structured goal. Comparable runs remain on individual activity pages. The September 2026 revision is tracked in [analytics-plan-2026-09.md](analytics-plan-2026-09.md).

## Summary API

`GET /api/analytics/summary` returns:

| Field | Type | Meaning |
| --- | --- | --- |
| `as_of_date` | date | Server's local date used for all "to date" figures. |
| `weekly_volume` | `WeeklyVolumeWeek[]` | Exactly 16 Monday–Sunday weeks, oldest first, ending with the current week. |
| `weekly_volume_increase_threshold_percent` | number | Threshold used by `exceeds_prior_average` (15). |
| `plan_progress` | `PlanProgress` or `null` | Active-plan progress; `null` without an active plan. |
| `best_efforts` | `BestEffort[]` | One entry per standard distance that has an effort, in order 1 mile, 5K, 10K, half marathon, marathon. |
| `longest_run` | `LongestRun` or `null` | `activity_id`, `activity_title`, `local_date`, `distance_meters`, `distance_miles`. |
| `highest_week` | `HighestWeek` or `null` | `week_start`, `miles` over all recorded weeks. |
| `heart_rate_response_history` | `HeartRateResponseResult[]` | Eligible workload-adjusted HR response results, oldest first, with date and recorded temperature (see below). |
| `heart_rate_response_algorithm_version` | number | Current HR-response algorithm version (4). |

### Weekly volume

Each `WeeklyVolumeWeek` has `week_start`, `week_end`, `miles`, `run_count`, `is_partial`, `planned_miles`, `trailing_4_week_average_miles`, `prior_4_week_average_miles`, and `exceeds_prior_average`. Only `sport: run` activities count. Weeks without runs are zero-filled.

- `is_partial` is true only for the current, in-progress week. The partial week never gets a trailing average or an increase flag.
- `planned_miles` comes from the active plan only: the week's declared `planned_running_miles`, or the sum of its planned run-session distances when no weekly figure was declared. It is `null` for weeks the active plan does not cover.
- `trailing_4_week_average_miles` is the mean of the week and the three before it. `prior_4_week_average_miles` is the mean of the four weeks before it. Both are `null` when those weeks reach back before the first recorded run, so a new history does not produce misleading averages or flags.
- `exceeds_prior_average` is true for a completed week whose miles exceed `prior_4_week_average_miles` by more than 15%. This is guidance for spotting jumps, not a rule.

### Plan progress

All plan figures use one definition:

- Plan weeks run Monday–Sunday, numbered from the Monday of the week containing the plan's start date, so a plan starting mid-week still begins in week 1. `current_week_number` is `null` when today is outside the plan's weeks.
- A week's planned miles are defined as for weekly volume. `total_planned_miles` sums all weeks.
- A session is *due* when it is scheduled on or before today (or the plan end date, if earlier) or has already been completed, so an early completion counts. Superseded `rescheduled` sessions are ignored everywhere.
- `planned_miles_to_date` sums each week's planned miles multiplied by the share of that week's planned run-session distance that is due. Elapsed weeks count in full, future weeks count as zero, and the current week counts in proportion. If a week has no run-session distances, the share uses the number of due run sessions, then elapsed days.
- `completed_miles_to_date` counts only run activities linked to one of the plan's sessions. Unlinked runs still appear in weekly volume.
- `sessions_due_to_date`, `sessions_completed_to_date` (status `completed*`), and `sessions_skipped_to_date` are counted over due sessions. `total_sessions` counts every non-superseded session.
- `current_week_planned_miles` is the current week's full planned miles. `current_week_planned_miles_to_date` and `current_week_completed_miles` apply the same due and linked rules to the current week. All three are `null` outside the plan.

The response also includes `plan_id`, `plan_name`, `start_date`, `end_date`, and `total_weeks`.

## Best efforts

Each `BestEffort` has `distance_label`, `distance_meters`, `elapsed_seconds`, `pace_seconds_per_mile`, `activity_id`, `activity_title`, `local_date`, `category`, `source` (`samples` or `lap`), `lap_index` (for laps), and `start_distance_meters` (for samples, the distance into the activity where the effort starts). Standard distances are 1 mile (1609.344 m), 5K, 10K, half marathon (21,097.5 m), and marathon (42,195 m). Candidates come from two sources:

- **Samples**: the fastest continuous window covering exactly the distance within each run's stored five-second samples, measured in elapsed time, so pauses inside the window count. The window endpoint that falls between samples is linearly interpolated on cumulative distance. Every window with one endpoint on a sample is evaluated, which is exact for the piecewise-linear series. Windows averaging faster than 7 m/s are treated as distance artifacts and ignored.
- **Laps**: an exact-distance lap, meaning no more than 2 m short and no more than 0.5% long, uses its elapsed time. Any extra distance makes the lap time conservative.

The fastest candidate wins. When times tie to the whole second, a `race`-category run is preferred, then the earlier date. Whole-activity distance ranges are no longer used. Samples for all qualifying runs are read in one query that projects only elapsed time and distance.

## Grade adjustment

`app.services.grade_adjustment` implements grade-adjusted speed from the Minetti et al. (2002) energy cost of running:

```
Cr(i) = 155.4 i^5 − 30.4 i^4 − 43.3 i^3 + 46.3 i^2 + 19.5 i + 3.6      (J/kg/m)
grade-adjusted speed = speed × Cr(i) / 3.6
```

Grade `i` is a fraction (rise / horizontal distance), clamped to ±0.45, the range the curve was measured over. Flat running has factor 1.0; uphills cost more (≈1.3 at 5%, ≈1.66 at 10%); moderate downhills cost less (minimum ≈0.49 near −18%); steeper downhills cost more again (≈1.1 at −45%).

Grade for each sample comes from the elevation and distance change across a centered ~30-second window of stored samples. It is 0 when elevation or distance is missing or when the window covers less than 20 m horizontally.

Caveats: the curve comes from a few trained runners on a treadmill at fixed speeds. It models metabolic cost, not heart rate, and it is known to overstate the cost of moderate uphills compared with heart-rate-based adjustments. Recorded grade also carries GPS and barometric elevation noise.

## Workload-adjusted heart-rate response

Algorithm version 4 (`app.services.heart_rate_response`) estimates how much heart rate changes per hour of running after accounting for recorded workload and stops. It replaces version 3, which used a hand-picked uphill ×4 / downhill ×2 workload, compressed stops to 15 s, and derived confidence from R². It is descriptive. It must not be read as a diagnosis, a proprietary fitness score, or proof of dehydration or fatigue.

1. **Eligibility** (unchanged): runs of at least 25 minutes. Analysis starts after the first five minutes and after the optional per-activity start distance. At least 100 analysis samples are needed, at least 80% of them must have heart rate and moving speed (≥ 0.5 m/s), and at least 20 minutes of usable running must remain.
2. **Workload** is grade-adjusted speed (above) and is 0 while stopped.
3. **Response filter**: workload passes through a first-order filter with time constant τ, using the exact exponential update over each sample interval. A stop, whether it is recorded as slow samples or as an auto-pause gap longer than 15 s, decays the filter toward zero for its real duration, capped at five minutes. This models heart-rate recovery during the stop instead of compressing the stop. Candidate τ values are 15, 30, 45, 60, 90, and 120 s, and the one with the lowest RMSE is kept. `response_time_constant_seconds` is reported only when workload varies by at least 5%.
4. **Fit**: heart rate ~ intercept + workload + running time (hours) by Huber-weighted iteratively reweighted least squares (cutoff 1.5 × MAD scale, at least 1 bpm). Running time accumulates only while running: a stop adds one sample interval, not its full duration. A fit whose workload coefficient is below −0.1 is rejected. Runs whose filtered workload correlates with time above 0.92 (for example, progression runs) are excluded, because the time trend cannot be separated from workload.
5. **Uncertainty**: a moving-block bootstrap of the fit residuals uses blocks of about 2 minutes (24 samples at 5 s), 200 resamples, and a fixed seed, so results are deterministic. Residual blocks are drawn with replacement, added back to the fitted values, and refit with the final robust weights held fixed, which is exact and fast because the fit is then linear in heart rate. The 5th and 95th percentiles give the 90% interval for bpm/hour.
6. **Confidence** comes from the interval width and usable duration. It is `high` with at least 40 minutes usable and a width of 5 bpm/h or less, `moderate` with at least 25 minutes and a width of 10 bpm/h or less, and `low` otherwise.

Caveats: the interval reflects noise within the run only. It ignores the choice of τ and all unrecorded confounders. In synthetic tests with autocorrelated noise, the nominal 90% interval covered the true value about 70–75% of the time, so treat it as a lower bound on uncertainty. The estimate is sensitive to the τ range: on real runs τ often sits at the 120 s upper bound, and allowing slower τ absorbs part of the time trend. R² and RMSE are still reported descriptively, but they no longer drive confidence. Weather, hydration, wind, fatigue, medication, sensor accuracy, and individual physiology can all influence the result.

Result fields stored under `derived_metrics.heart_rate_response`:

| Field | Meaning |
| --- | --- |
| `algorithm_version` | 4. |
| `eligible`, `exclusion_reason` | Eligibility and the reason when excluded. |
| `adjusted_change_bpm_per_hour` | Running-time coefficient. |
| `adjusted_change_lower_90_bpm_per_hour`, `adjusted_change_upper_90_bpm_per_hour` | 90% bootstrap interval. |
| `adjusted_total_change_bpm` | Coefficient × usable hours. |
| `response_time_constant_seconds` | Selected τ, or null when workload barely varies. |
| `r_squared`, `rmse_bpm` | Descriptive fit statistics. |
| `analysis_start_seconds`, `analysis_end_seconds` | Elapsed seconds of the first and last included samples. |
| `analysis_ranges` | `[{start_seconds, end_seconds}]` contiguous included ranges, split at gaps over 15 s. The activity chart should shade these, not start + usable duration. |
| `analysis_start_distance_meters` | The per-activity override in effect. |
| `usable_duration_seconds` | Running time used by the fit (stops excluded). |
| `stop_count`, `stopped_duration_seconds` | Stops within the analysis window and their total duration. |
| `bootstrap_resamples`, `bootstrap_block_seconds` | 200 and 120. |
| `confidence`, `interpretation` | As described above. |

New FIT imports calculate the result automatically. `POST /api/analytics/recalculate-heart-rate-response` rebuilds version 4 results for all stored runs and removes the retired `heart_rate_drift` field. `POST /api/analytics/activities/{id}/recalculate-heart-rate-response` recalculates one run. The summary's `heart_rate_response_history` returns eligible results oldest first, with `local_date`, `category`, and the activity's recorded `temperature_celsius` / `temperature_fahrenheit` (the device reading, which runs warm on the wrist, or null), so the trend can be plotted over real dates and colored by temperature. `heart_rate_response_algorithm_version` is the current version; stored results with a lower version are stale until recalculated.

An activity may set `heart_rate_analysis_start_distance_meters` to ignore unreliable early HR readings without deleting or modifying FIT samples. The activity page exposes this in miles as **Ignore HR analysis before mile** and recalculates only that activity. The ordinary five-minute settling exclusion still applies, so analysis begins at whichever threshold occurs later. The override is persisted and included in activity exports.

## Heart-rate settings and zones

Application settings accept optional `max_heart_rate_bpm` (100–230) and `resting_heart_rate_bpm` (25–120). Resting must be lower than max, including when only one of them is updated. Sending `null` through `PATCH /api/settings` clears a value. `app.services.heart_rate_zones` derives heart-rate-reserve (Karvonen) zones from the two values: Z1 50–60%, Z2 60–70%, Z3 70–80%, Z4 80–90%, and Z5 90–100% of reserve above resting. Heart rates below 50% count as Z1 and heart rates above max count as Z5. Each zone includes its lower bound.

## Time in zones and training load

`GET /api/analytics/heart-rate-zones` is computed on request from stored samples. Nothing is persisted, so changing max or resting HR takes effect immediately. One projected query reads elapsed time, heart rate, and speed for every run in the window, which takes roughly 0.2 s for about 40 runs.

- **Time in zones**: each sample's heart rate is held until the next sample. An interval counts only when both samples are no more than 15 s apart, the earlier sample has heart rate, and it is not stopped (recorded speed below 0.5 m/s).
- **Edwards TRIMP** per run = Σ zone minutes × zone number (Z1..Z5 weighted 1..5).
- **Acute load** = TRIMP over the last 7 days, including today. **Chronic load** = TRIMP over the last 28 days / 4, the average week. Ratio = acute / chronic, with bands `low` < 0.8, `typical` 0.8–1.3, `elevated` 1.3–1.5, and `spike` ≥ 1.5. The ratio is null when chronic load is 0 or recorded history is shorter than 28 days. The bands are guidance, not a rule or an injury prediction.

Response (`HeartRateZoneAnalytics`):

| Field | Meaning |
| --- | --- |
| `as_of_date` | Server date. |
| `status` | `ok` or `heart_rate_settings_missing`. When settings are missing, `message` explains, and the lists are empty and `training_load` is null. |
| `max_heart_rate_bpm`, `resting_heart_rate_bpm` | Settings used. |
| `zones` | `[{zone, lower_bpm, upper_bpm, lower_reserve_percent, upper_reserve_percent}]`. |
| `weekly_time_in_zones` | 16 Monday-based weeks, oldest first, zero-filled: `{week_start, week_end, is_partial, run_count, zone_seconds[5], total_seconds}`. |
| `easy_run_categories` | `["easy", "recovery"]`. |
| `easy_run_weekly_distribution` | Same weeks, easy/recovery runs only: the "are easy runs really easy?" distribution, not pass/fail. |
| `training_load` | `{days[120]: {day, trimp, run_count}, acute_days, chronic_days, acute_load, chronic_load, acute_chronic_ratio, ratio_band, chronic_history_complete, bands[{label, lower, upper, description}], guidance}`. |
| `runs` | Runs in the window with zone time, newest first: `{activity_id, activity_title, local_date, category, zone_seconds[5], total_seconds, trimp}`. |
| `runs_without_heart_rate` | Runs in the window with no usable HR samples (counted as zero load). |

## Heart rate at easy grade-adjusted pace

`GET /api/analytics/easy-pace-heart-rate` (computed on request, about 0.2 s for 20 runs) tracks heart rate at one fixed grade-adjusted pace for easy, long, and recovery runs over the last 12 calendar months. Falling heart rate at the same pace suggests better aerobic fitness. Heat, fatigue, and sensor error move it too.

1. Grade-adjusted speed is smoothed with a 30 s first-order filter that restarts after each stop, so it lines up with heart rate.
2. Steady samples come after the first 10 minutes. They need heart rate, moving speed, at least 90 s since the last stop (a gap over 15 s or a stopped sample), and a grade-adjusted pace between 4:00 and 20:00 /mi.
3. A run needs at least 15 minutes of steady samples. Heart rate is fit against grade-adjusted pace (s/mi) with a Huber-weighted straight line. When pace barely varies (SD < 5 s/mi), the run's median heart rate is used and the slope is 0.
4. The reference pace is the median of the runs' median grade-adjusted paces, rounded to the nearest 15 s/mi, and is returned. It is re-derived on each request, but all runs are always evaluated at the same pace. A run is excluded when the reference lies more than 30 s/mi outside its 5th–95th percentile pace range, so there is no extrapolation.
5. Monthly values are medians of the per-run estimates, with run counts.

Response (`EasyPaceHeartRate`): `as_of_date`, `categories`, `window_start`, `reference_pace_seconds_per_mile` (null without qualifying runs), `months[12]` `{month (first day), median_heart_rate_bpm | null, run_count}`, `runs` `{activity_id, activity_title, local_date, category, heart_rate_at_reference_bpm, slope_bpm_per_second_per_mile, median_grade_adjusted_pace_seconds_per_mile, median_heart_rate_bpm, steady_duration_seconds, temperature_celsius, temperature_fahrenheit}`, and `excluded` `{activity_id, activity_title, local_date, category, reason}`.

Caveat: within one run, pace changes are partly confounded with drift and terrain, so the per-run slope is modest and noisy. The value at the reference pace is the robust quantity.

## Goal card

`GET /api/analytics/goal` derives everything from the active plan's structured `goal_target` (`distance_meters`, `target_time_seconds`). Nothing is specific to one distance.

- `status`: `no_active_plan`, `no_goal` (the active plan has no `goal_target`; hide the card), or `ok`.
- `goal`: `distance_meters`, `distance_label` (a standard label such as "1 mile" or "5K", otherwise miles/km/m), `target_time_seconds`, `pace_seconds_per_mile`, `pace_seconds_per_400m`.
- `weeks`: Monday-based weeks from 12 weeks before the plan's first week through the plan's last week, each with `is_before_plan`, `is_future`, and `best_effort`. The best effort is the fastest exact-distance effort at the goal distance that week, from sample windows or exact laps, using the same rules and tie-breaks as [Best efforts](#best-efforts).
- `window_start`, `window_end` (today or plan end), `current_best` (fastest effort in the window), `gap_seconds` (best − goal time; positive = slower), `gap_pace_seconds_per_mile`.
- `track_sessions`, newest first, for `track`-category runs in the window: every lap of 200–1600 m (±2%) with `lap_index`, `distance_meters`, `elapsed_seconds`, `pace_seconds_per_mile`, `pace_seconds_per_400m`, `pace_delta_seconds_per_mile` (negative = faster than goal), `counts_as_rep`, and `at_or_under_goal_pace`, plus `rep_count` and `reps_at_or_under_goal_pace`. Without workout-step data, `counts_as_rep` is a heuristic. A lap counts when it is within 15% of the session's fastest such lap and no more than 60% slower than goal pace, or when it is at or faster than goal pace. This separates work reps from warm-up laps and recovery jogs. When the watch labeled the session's laps (lap `intensity`, recorded for imports from 2026-09-29 on), the labels decide instead: `active` and `interval` laps are reps, all others are not, and `rep_source` is `workout` (otherwise `pace`). `reps_at_or_under_goal_pace` counts only laps that are reps. Lap pace uses lap elapsed time.

## Comparisons and records

Comparable-run rows expose distance, pace, heart rate, and recorded weather context. They use the current activity as the anchor and select runs in the same category within 15% distance. Temperature and humidity are displayed when recorded but never invented; temperature comparisons are observational rather than causal.

The separate same-weekday chart contains the current run plus as many as 12 earlier runs on the same local weekday, regardless of category or distance. Track workouts remain visible by design.

Best efforts, longest run, and highest week are described under [Best efforts](#best-efforts).

## Analytics page

`frontend/src/pages/AnalyticsPage.tsx` loads the summary, goal, heart-rate-zone, and easy-pace endpoints independently (each card has its own loading and error state) and renders cards from `frontend/src/features/analytics/`, in this order:

1. **Goal card** (`GoalCard`, `GoalEffortChart`): hidden when `/api/analytics/goal` reports `no_goal` or `no_active_plan`. Shows goal pace per mile and per 400 m, current best with its date, the gap to goal, and the total of track reps at or under goal pace. The chart plots the best effort at the goal distance each week (elapsed time; lower is faster) with a dashed goal-time line, the 12-week lead-in shaded and drawn in gray, and future plan weeks shaded as "Ahead". The newest five track sessions list reps and reps at goal pace.
2. **Weekly volume** (`WeeklyVolumeCard`): 16 bars of miles, the current partial week drawn lighter with a dashed outline, the active plan's planned miles as a dashed step line, and the 4-week average as an orange line. Weeks with `exceeds_prior_average` get a ▲ marker and are listed under the chart as a prompt, not a rule. **Plan progress** (`PlanProgressCard`) sits beside it: plan-to-date completed vs planned miles, sessions completed of due (and skipped), and the current week's completed, due-so-far, and full planned miles. It is hidden without an active plan.
3. **Training load** (`TrainingLoadCard`): acute and chronic TRIMP, the ratio with its band chip and a band scale marker, the API's guidance text in an alert that starts "Guidance, not a rule", and a 120-day daily TRIMP bar chart with the 7-day acute window shaded.
4. **Heart-rate zones** (`HeartRateZonesCard`, `ZoneTable`, `ZoneWeeksChart`): the zone table (bpm and % reserve), weekly minutes in Z1–Z5 as stacked bars, and "Easy runs: time by zone" as a last-4-weeks distribution bar plus weekly 100% stacked bars. Zones use a one-hue blue ramp from light (Z1) to dark (Z5).
5. **Heart rate at easy pace** (`EasyPaceHeartRateCard`): the reference grade-adjusted pace, the latest three monthly medians with run counts, and a dated chart of per-run estimates (colored by recorded temperature) with the monthly median line. The card states that lower heart rate at the same pace suggests better aerobic fitness.
6. **Workload-adjusted heart-rate response** (`HeartRateResponseCard`, `HeartRateResponseChart`): points on a real time axis, colored by recorded temperature, sized by confidence, with 90% interval error bars for version 4+ results (also in the tooltip and list). The duration-weighted trend is fitted against dates, not list position (`driftTrend.ts`), and its slope is reported per 30 days. The category filter narrows both the chart and the list. Results with `algorithm_version` below `heart_rate_response_algorithm_version` show a "stale" chip, and an alert points to **Recalculate HR response** (the page-header action, also offered in the alert).
7. **Best efforts and records** (`RecordsCard`): exact-distance best efforts with time, pace, date and source (lap or within a run), the longest run, and the highest week.

HR-derived cards show an "Open Settings" link when max or resting heart rate is missing. Temperatures default to °F; a °F/°C toggle in the page header is remembered per browser. Temperature colors use five bands (< 50, 50–60, 60–70, 70–80, ≥ 80 °F) on a blue–gray–red diverging scale; runs without a recorded temperature are hollow. The retired rolling-mileage tiles, temperature bands card, and rescheduled-session count are gone.

## Activity page

- The HR analysis shading uses `analysis_ranges`, so stops inside the analysis window are left unshaded. Results from before version 4 fall back to `analysis_start_seconds`–`analysis_end_seconds`, or start plus usable duration.
- The HR response card shows the 90% interval, usable minutes, stops, and a stale-version notice for results computed before version 4.
- Track-category runs show **Reps vs goal pace** when the active plan has a structured goal: each 200–1600 m lap's pace against the dashed goal-pace line, with work reps filled blue, reps at or under goal pace green, and other laps hollow. It uses the goal endpoint's `track_sessions` entry for the run, or the same heuristic computed from the run's laps (`features/activities/trackReps.ts`) when the run is outside the goal window.

## Settings

The Settings page edits max and resting heart rate (`PATCH /api/settings`). A blank field sends `null` and clears the value. The form checks whole numbers, the 100–230 and 25–120 bpm ranges, and that resting is below max before saving, and it shows API errors. The resulting heart-rate-reserve zones are shown and update live while editing, labeled as not saved until saved.
