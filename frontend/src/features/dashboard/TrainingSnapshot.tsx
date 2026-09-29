import { Box, Skeleton, Typography } from "@mui/material";
import type { ReactNode } from "react";

import type { AnalyticsSummary } from "../../api/analytics";
import { colors } from "../../app/tokens";
import { StatValue } from "../../components/common/StatValue";

function Tile({
  label,
  value,
  detail,
}: {
  label: string;
  value: number | null | undefined;
  detail?: ReactNode;
}) {
  return (
    <Box
      sx={{
        minWidth: 0,
        px: { xs: 1, sm: 2 },
        py: { xs: 1, sm: 1.25 },
        bgcolor: colors.parchment,
        border: `1.5px solid ${colors.rule}`,
        borderRadius: "4px",
      }}
    >
      <Typography
        variant="overline"
        color="text.secondary"
        component="p"
        noWrap
      >
        {label}
      </Typography>
      {value === undefined ? (
        <Skeleton width="70%" sx={{ fontSize: "1.8rem" }} />
      ) : (
        <StatValue
          value={value == null ? "—" : value.toFixed(1)}
          unit="mi"
          size="md"
        />
      )}
      {detail && (
        <Typography
          variant="caption"
          color="text.secondary"
          component="p"
          sx={{ mt: 0.25, lineHeight: 1.3 }}
        >
          {detail}
        </Typography>
      )}
    </Box>
  );
}

/**
 * Glanceable volume: this week, the 4-week average of completed weeks, and active-plan
 * miles to date. Uses the summary's weekly_volume and plan_progress.
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
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: { xs: 0.75, sm: 1.5 },
      }}
    >
      <Tile
        label="This week"
        value={pending ? undefined : (current?.miles ?? null)}
        detail={
          planned != null ? `of ${planned.toFixed(1)} planned` : undefined
        }
      />
      <Tile
        label="4-wk avg"
        value={
          pending
            ? undefined
            : (lastComplete?.trailing_4_week_average_miles ?? null)
        }
        detail="completed weeks"
      />
      <Tile
        label="Plan"
        value={pending ? undefined : (plan?.completed_miles_to_date ?? null)}
        detail={
          plan
            ? `of ${plan.planned_miles_to_date.toFixed(1)} due so far`
            : "no active plan"
        }
      />
    </Box>
  );
}
