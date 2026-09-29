import {
  Box,
  Card,
  CardContent,
  Grid,
  LinearProgress,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import type { ReactNode } from "react";

import type { AnalyticsSummary } from "../../api/analytics";
import { percentOf } from "../analytics/format";

function Tile({
  label,
  value,
  unit = "mi",
  detail,
}: {
  label: string;
  value: number | null | undefined;
  unit?: string;
  detail?: ReactNode;
}) {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Typography
          variant="overline"
          color="text.secondary"
          component="p"
          noWrap
        >
          {label}
        </Typography>
        {value === undefined ? (
          <Skeleton width="70%" sx={{ fontSize: "2rem" }} />
        ) : (
          <Typography
            component="p"
            color="primary.dark"
            sx={{
              fontWeight: 750,
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
              fontVariantNumeric: "tabular-nums",
              fontSize: { xs: "1.35rem", sm: "2rem" },
            }}
          >
            {value == null ? "—" : value.toFixed(1)}
            <Box
              component="span"
              sx={{
                ml: 0.5,
                fontSize: "0.55em",
                fontWeight: 700,
                color: "text.secondary",
              }}
            >
              {unit}
            </Box>
          </Typography>
        )}
        {detail && (
          <Typography variant="caption" color="text.secondary" component="p">
            {detail}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Glanceable volume: this week, the 4-week average of completed weeks, and active-plan
 * progress to date. Uses the summary's weekly_volume and plan_progress.
 */
export function TrainingSnapshot({
  analytics,
  loading,
}: {
  analytics: AnalyticsSummary | null;
  loading: boolean;
}) {
  const weeks = analytics?.weekly_volume ?? [];
  const current = weeks.at(-1);
  const lastComplete = [...weeks].reverse().find((week) => !week.is_partial);
  const plan = analytics?.plan_progress;
  const pending = loading && !analytics;
  const planned =
    current?.planned_miles ?? plan?.current_week_planned_miles ?? null;
  return (
    <Stack spacing={{ xs: 1.5, sm: 2 }}>
      <Grid container spacing={{ xs: 1.5, sm: 2 }}>
        <Grid size={4}>
          <Tile
            label="This week"
            value={pending ? undefined : (current?.miles ?? null)}
            detail={
              planned != null ? `of ${planned.toFixed(1)} planned` : undefined
            }
          />
        </Grid>
        <Grid size={4}>
          <Tile
            label="4-wk avg"
            value={
              pending
                ? undefined
                : (lastComplete?.trailing_4_week_average_miles ?? null)
            }
            detail="completed weeks"
          />
        </Grid>
        <Grid size={4}>
          <Tile
            label="Plan"
            value={
              pending ? undefined : (plan?.completed_miles_to_date ?? null)
            }
            detail={
              plan
                ? `of ${plan.planned_miles_to_date.toFixed(1)} due so far`
                : "no active plan"
            }
          />
        </Grid>
      </Grid>
      {plan && (
        <Card
          variant="outlined"
          sx={{ borderLeft: 5, borderLeftColor: "secondary.main" }}
        >
          <CardContent>
            <Stack spacing={1.25}>
              <Typography variant="overline" color="text.secondary">
                {plan.current_week_number
                  ? `Week ${plan.current_week_number} of ${plan.total_weeks}`
                  : "Active plan"}
              </Typography>
              <Typography variant="h5" component="h2">
                {plan.plan_name}
              </Typography>
              {plan.current_week_planned_miles != null && (
                <>
                  <Typography sx={{ fontVariantNumeric: "tabular-nums" }}>
                    <strong>
                      {(plan.current_week_completed_miles ?? 0).toFixed(1)}
                    </strong>{" "}
                    of {plan.current_week_planned_miles.toFixed(1)} planned
                    miles this week
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={percentOf(
                      plan.current_week_completed_miles,
                      plan.current_week_planned_miles,
                    )}
                    aria-label="Current week planned miles completed"
                  />
                </>
              )}
              <Typography variant="body2" color="text.secondary">
                {plan.sessions_completed_to_date} of {plan.sessions_due_to_date}{" "}
                sessions due so far completed
                {plan.sessions_skipped_to_date
                  ? ` · ${plan.sessions_skipped_to_date} skipped`
                  : ""}
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
