import { Grid, Stack, Typography } from "@mui/material";

import type { GoalProgress } from "../../api/analytics";
import { LinkRow } from "../../components/common/LinkRow";
import { AnalyticsCard, Figure } from "./AnalyticsCard";
import {
  formatPace,
  formatPreciseClock,
  formatSignedClock,
  shortDate,
} from "./format";
import { GoalEffortChart } from "./GoalEffortChart";

type GoalCardProps = {
  goal: GoalProgress | null;
  loading: boolean;
  error: string | null;
};

/** Goal card for the active plan's structured goal; renders nothing without one. */
export function GoalCard({ goal, loading, error }: GoalCardProps) {
  if (!loading && !error && (!goal || goal.status !== "ok" || !goal.goal))
    return null;
  const definition = goal?.goal;
  const best = goal?.current_best;
  const sessions = goal?.track_sessions ?? [];
  return (
    <AnalyticsCard
      title={
        definition
          ? `Goal: ${definition.distance_label} in ${formatPreciseClock(definition.target_time_seconds)}`
          : "Goal"
      }
      description={
        goal?.plan
          ? `From the active plan “${goal.plan.plan_name}”. Best efforts use exact-distance windows in recorded samples or exact-distance laps (elapsed time).`
          : undefined
      }
      loading={loading}
      error={error}
    >
      {definition && goal && (
        <Stack spacing={2.5}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, md: 3 }}>
              <Figure
                label="Goal pace"
                value={formatPace(definition.pace_seconds_per_mile)}
                detail={`${formatPreciseClock(definition.pace_seconds_per_400m)} per 400 m`}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Figure
                label="Current best"
                value={best ? formatPreciseClock(best.elapsed_seconds) : "—"}
                detail={
                  best
                    ? `${formatPace(best.pace_seconds_per_mile)} · ${shortDate(best.local_date)}`
                    : "No effort at this distance yet"
                }
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Figure
                label="Gap to goal"
                value={
                  goal.gap_seconds == null
                    ? "—"
                    : goal.gap_seconds <= 0
                      ? "Goal reached"
                      : formatSignedClock(goal.gap_seconds)
                }
                detail={
                  goal.gap_pace_seconds_per_mile == null
                    ? undefined
                    : `${formatSignedClock(goal.gap_pace_seconds_per_mile)} per mile`
                }
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Figure
                label="Track reps at goal pace"
                value={`${sessions.reduce((sum, session) => sum + session.reps_at_or_under_goal_pace, 0)} of ${sessions.reduce((sum, session) => sum + session.rep_count, 0)}`}
                detail={`${sessions.length} track session${sessions.length === 1 ? "" : "s"} in window`}
              />
            </Grid>
          </Grid>
          <GoalEffortChart goal={goal} />
          {sessions.length > 0 && (
            <Stack spacing={0.5}>
              <Typography variant="h6" component="h3">
                Track sessions
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Reps are laps of 200–1600 m that look like work intervals (a
                heuristic without workout-step data). Pace uses lap elapsed
                time.
                {sessions.length > 5
                  ? ` Showing the newest 5 of ${sessions.length}.`
                  : ""}
              </Typography>
              <Stack spacing={0.25} sx={{ mx: -1.5 }}>
                {sessions.slice(0, 5).map((session) => {
                  const reps = session.laps.filter((lap) => lap.counts_as_rep);
                  const fastest = reps.length
                    ? Math.min(...reps.map((lap) => lap.pace_seconds_per_mile))
                    : null;
                  return (
                    <LinkRow
                      key={session.activity_id}
                      href={`/activities/${session.activity_id}`}
                      primary={shortDate(session.local_date)}
                      secondary={`${session.rep_count} rep${session.rep_count === 1 ? "" : "s"}${fastest ? ` · fastest ${formatPace(fastest)}` : ""}`}
                      trailing={
                        session.rep_count
                          ? `${session.reps_at_or_under_goal_pace} of ${session.rep_count} at goal pace`
                          : "no reps detected"
                      }
                    />
                  );
                })}
              </Stack>
            </Stack>
          )}
        </Stack>
      )}
    </AnalyticsCard>
  );
}
