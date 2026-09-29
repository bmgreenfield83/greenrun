import FlagRounded from "@mui/icons-material/FlagRounded";
import { Chip, Skeleton, Stack, Typography } from "@mui/material";

import type { GoalProgress } from "../../api/analytics";
import { StatValue } from "../../components/common/StatValue";
import { formatPreciseClock, formatSignedClock } from "../analytics/format";
import { GlanceCard } from "./GlanceCard";

/** Goal chip for the active plan's goal: target, current best, and the gap. */
export function GoalGlance({
  goal,
  loading,
}: {
  goal: GoalProgress | null;
  loading: boolean;
}) {
  const definition = goal?.status === "ok" ? goal.goal : null;
  const best = goal?.current_best;
  return (
    <GlanceCard label="Goal" href="/analytics" linkLabel="Goal: open analytics">
      {loading ? (
        <Skeleton variant="rounded" height={56} />
      ) : definition ? (
        <Stack spacing={1}>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
          >
            <Chip
              icon={<FlagRounded />}
              color="secondary"
              label={`${definition.distance_label} in ${formatPreciseClock(definition.target_time_seconds)}`}
            />
          </Stack>
          <Stack direction="row" spacing={2} alignItems="flex-end">
            <Stack spacing={0.25}>
              <Typography variant="caption" color="text.secondary">
                Current best
              </Typography>
              <StatValue
                size="sm"
                value={best ? formatPreciseClock(best.elapsed_seconds) : "—"}
              />
            </Stack>
            {goal?.gap_seconds != null && (
              <Typography
                variant="body2"
                fontWeight={700}
                color={
                  goal.gap_seconds <= 0 ? "success.main" : "text.secondary"
                }
                sx={{ pb: 0.25 }}
              >
                {goal.gap_seconds <= 0
                  ? "Goal reached"
                  : `${formatSignedClock(goal.gap_seconds)} to go`}
              </Typography>
            )}
          </Stack>
        </Stack>
      ) : (
        <Typography color="text.secondary" variant="body2">
          {goal?.status === "no_goal"
            ? "The active plan has no time goal yet. Add one on the Plans page."
            : "No active plan goal."}
        </Typography>
      )}
    </GlanceCard>
  );
}
