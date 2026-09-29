# Analytics revision plan (September 2026)

Approved by the owner on 2026-09-29 and implemented the same day (everything except the "Later" section).
`docs/analytics.md` is the reference for the implemented behavior. Follow-ups decided during implementation:
HR-response time constants stay capped at 120 s; lap `intensity` labels from the watch decide track reps for
imports from 2026-09-29 on (no backfill).

## Owner context

- Training is organized in ~12-week plans (blocks), each with its own goal. The current block's goal is a
  6:00 mile, with weekly mileage around 20. A marathon block will follow months later.
  Nothing may be hard-coded to the current goal.
- Max HR 194, resting HR 55 (watch values). Easy runs often exceed the watch's default zone 2.
- Effort and feel are imported from the watch's post-run questions (`workout_rpe`, `workout_feel`). They stay
  informational; no metric depends on them.
- No shoe tracking.

## Decisions

### Settings
- Add `max_heart_rate_bpm` and `resting_heart_rate_bpm` to application settings (optional; HR-derived metrics
  report a clear "set max and resting HR" state when missing).

### Plan goal (structured, optional)
- Add an optional structured `goal_target` to training plans next to the existing free-text `primary_goal` /
  `secondary_goal`: `{ "distance_meters": number, "target_time_seconds": number }` ("time at a distance").
  Optional in imports (existing plans import unchanged); editable on an existing plan through the API and the
  Plans page. The template, JSON Schema, and `docs/training-plan-schema.md` document it.
- The weekly mileage target is the plan's own planned weekly mileage; it is not a separate setting.

### Zones and load
- Heart-rate-reserve (Karvonen) zones from max/resting HR: Z1 50–60%, Z2 60–70%, Z3 70–80%, Z4 80–90%,
  Z5 90–100% of reserve; below 50% counts as Z1. Time in zones uses timestamp-weighted sample durations,
  excluding stops and gaps over 15 s.
- Training load: Edwards' TRIMP (minutes in Z1..Z5 weighted 1..5) per run. Acute load = last 7 days;
  chronic = last 28 days / 4. Show the acute:chronic ratio with guidance bands (<0.8 low, 0.8–1.3 typical,
  >1.5 spike), described as guidance, not a rule.
- "Easy runs really easy?": for easy/recovery runs, the distribution of time by zone, per week. Shown as a
  distribution, not pass/fail.

### Grade adjustment
- Grade-adjusted pace uses Minetti et al. (2002) energy cost of running:
  `Cr(i) = 155.4 i^5 − 30.4 i^4 − 43.3 i^3 + 46.3 i^2 + 19.5 i + 3.6` (J/kg/m), grade `i` as a fraction clamped
  to ±0.45; grade-adjusted speed = speed × Cr(i) / 3.6. Grade is derived over ~30 s windows as today.

### Workload-adjusted HR response (kept, version 4)
- Replace the hand-picked uphill ×4 / downhill ×2 / clamp workload with Minetti grade-adjusted speed.
- Pauses: carry the response filter through a stop for its real duration (capped, e.g. 5 min) with zero
  workload, so HR recovery during stops is modeled instead of compressed.
- Uncertainty: moving-block bootstrap of residuals (blocks ~2 min) giving a 90% interval for bpm/hour;
  confidence is derived from interval width and usable duration, not from R².
- Aggregate chart: trend over real dates, points colored by recorded temperature, corrected size caption.
- Existing "Recalculate HR response" rebuilds stored results with the new version.

### HR at easy grade-adjusted pace (new)
- For easy/long/recovery runs, steady running after 10 minutes (no stops), fit HR against grade-adjusted pace
  per run and evaluate at one fixed reference pace (derived from the owner's typical easy grade-adjusted pace,
  rounded to 15 s/mi, and shown). Monthly median across runs, with run counts; falling HR means fitter.

### Weekly volume
- Last 16 calendar weeks (Monday-based), zero-filled, current partial week marked, planned weekly miles from the
  active plan, 4-week average, and a flag when a completed week exceeds the prior 4-week average by >15%.

### Plan progress
- One definition: plan-to-date planned miles vs completed (linked) miles, sessions completed of sessions due so
  far; current-week planned vs completed uses the same definition. Remove `rescheduled_sessions`. Fix the week
  number for plans that do not start on a Monday.

### Goal card (from the active plan's `goal_target`)
- Hidden when the active plan has no structured goal. Shows goal pace; best efforts at the goal distance over
  the plan period and the preceding 12 weeks (from laps and from the fastest continuous window in samples);
  gap to goal; and for track sessions, reps (laps 200–1600 m) at or faster than goal pace per session.
- Activity detail: for track sessions, a rep chart of each lap's pace against the goal pace line when a goal exists.

### Personal bests (honest)
- Best efforts at 1 mi, 5K, 10K, half, marathon from exact-distance rolling windows in samples (elapsed time)
  and exact-distance laps; no loose distance ranges. Prefer race-category sources when tied. Longest run and
  highest week stay.

### Bug fixes
- Dashboard "recent HR response" must show the newest results.
- Activity-detail shaded HR-analysis region must use the real analysis window when the run has pauses.
- Cadence: Garmin running cadence is per leg; double it (and add `fractional_cadence`) on import. Existing stored
  cadence (summary, laps, samples) is corrected by an idempotent migration script that marks corrected documents;
  it is run only with the owner's approval after a backup.

### Removals
- Temperature bands card; duplicated rolling-mileage tiles (keep one weekly-volume presentation);
  `rescheduled_sessions`.

### Later (marathon block)
- Long-run progression and goal-pace miles for marathon goals; pace/HR decoupling on long runs.
