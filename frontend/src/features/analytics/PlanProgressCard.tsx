import { Grid, LinearProgress, Stack, Typography } from "@mui/material";

import type { PlanProgress } from "../../api/analytics";
import { localDateLabel } from "../activities/format";
import { AnalyticsCard, Figure } from "./AnalyticsCard";
import { formatMiles, percentOf } from "./format";

/** Plan-to-date planned vs completed miles and sessions for the active plan. */
export function PlanProgressCard({
  progress,
  loading,
  error,
}: {
  progress: PlanProgress | null | undefined;
  loading: boolean;
  error: string | null;
}) {
  if (!loading && !error && !progress) return null;
  return (
    <AnalyticsCard
      title="Plan progress"
      description={
        progress
          ? `${progress.plan_name} · ${localDateLabel(progress.start_date)} – ${localDateLabel(progress.end_date)}${progress.current_week_number ? ` · week ${progress.current_week_number} of ${progress.total_weeks}` : ""}`
          : undefined
      }
      loading={loading}
      error={error}
    >
      {progress && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 6, lg: 12 }}>
            <Stack spacing={1}>
              <Figure
                label="Plan to date"
                value={`${progress.completed_miles_to_date.toFixed(1)} of ${formatMiles(progress.planned_miles_to_date)}`}
                detail={`${formatMiles(progress.total_planned_miles)} planned in total. Only runs linked to plan sessions count.`}
              />
              <LinearProgress
                variant="determinate"
                value={percentOf(
                  progress.completed_miles_to_date,
                  progress.planned_miles_to_date,
                )}
                aria-label="Plan-to-date planned miles completed"
              />
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 12 }}>
            <Stack spacing={1}>
              <Figure
                label="Sessions due so far"
                value={`${progress.sessions_completed_to_date} of ${progress.sessions_due_to_date} completed`}
                detail={`${progress.sessions_skipped_to_date} skipped · ${progress.total_sessions} sessions in the plan`}
              />
              <LinearProgress
                variant="determinate"
                color="success"
                value={percentOf(
                  progress.sessions_completed_to_date,
                  progress.sessions_due_to_date,
                )}
                aria-label="Sessions due so far completed"
              />
            </Stack>
          </Grid>
          {progress.current_week_planned_miles != null && (
            <Grid size={12}>
              <Typography variant="body2" color="text.secondary">
                This week: {formatMiles(progress.current_week_completed_miles)}{" "}
                completed of{" "}
                {formatMiles(progress.current_week_planned_miles_to_date)} due
                so far ({formatMiles(progress.current_week_planned_miles)}{" "}
                planned for the week).
              </Typography>
            </Grid>
          )}
        </Grid>
      )}
    </AnalyticsCard>
  );
}
