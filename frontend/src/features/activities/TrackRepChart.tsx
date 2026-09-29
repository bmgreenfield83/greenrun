import { Box, Card, CardContent, Typography } from "@mui/material";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { GoalDefinition, GoalRep } from "../../api/analytics";
import { SectionTitle } from "../../components/common/SectionTitle";
import { ChartLegend } from "../analytics/ChartLegend";
import {
  axisTick,
  gridStroke,
  seriesColors,
  tooltipStyle,
} from "../analytics/chartTheme";
import {
  formatClock,
  formatPace,
  formatPreciseClock,
  formatSignedClock,
} from "../analytics/format";
import { clockTicks } from "../analytics/format";

type Row = GoalRep & { label: string; plotted: number };

function LapDot({
  cx = 0,
  cy = 0,
  payload,
}: {
  cx?: number;
  cy?: number;
  payload?: Row;
}) {
  if (!payload) return null;
  if (!payload.counts_as_rep)
    return (
      <circle
        cx={cx}
        cy={cy}
        r={4}
        fill="#fff"
        stroke={seriesColors.muted}
        strokeWidth={1.5}
      />
    );
  return (
    <circle
      cx={cx}
      cy={cy}
      r={6}
      fill={
        payload.at_or_under_goal_pace
          ? seriesColors.success
          : seriesColors.primary
      }
      stroke="#fff"
      strokeWidth={2}
    />
  );
}

/** Each 200–1600 m lap's pace against the active plan's goal pace. */
export function TrackRepChart({
  reps,
  goal,
}: {
  reps: GoalRep[];
  goal: GoalDefinition;
}) {
  const paces = reps.map((rep) => rep.pace_seconds_per_mile);
  // Keep recovery jogs from flattening the reps: cap the slow end at 1.6× goal pace.
  const slowest = Math.min(
    Math.max(...paces),
    goal.pace_seconds_per_mile * 1.6,
  );
  const fastest = Math.min(goal.pace_seconds_per_mile, ...paces);
  const ticks = clockTicks(fastest - 10, slowest + 10);
  const domain = [ticks[0], ticks[ticks.length - 1]];
  // Slower laps are pinned to the bottom edge so they stay visible; the tooltip shows real pace.
  const rows: Row[] = reps.map((rep) => ({
    ...rep,
    label: `${rep.lap_index}`,
    plotted: Math.min(rep.pace_seconds_per_mile, domain[1]),
  }));
  const workReps = rows.filter((row) => row.counts_as_rep);
  const atGoal = rows.filter((row) => row.at_or_under_goal_pace).length;
  return (
    <Card variant="outlined">
      <CardContent>
        <SectionTitle>Reps vs goal pace</SectionTitle>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Goal {goal.distance_label} in{" "}
          {formatPreciseClock(goal.target_time_seconds)}:{" "}
          {formatPace(goal.pace_seconds_per_mile)} (
          {formatPreciseClock(goal.pace_seconds_per_400m)} per 400 m).{" "}
          {workReps.length} rep{workReps.length === 1 ? "" : "s"}, {atGoal} at
          or under goal pace.
        </Typography>
        {rows.length === 0 ? (
          <Typography color="text.secondary" sx={{ mt: 2 }}>
            No laps of 200–1600 m were recorded in this run.
          </Typography>
        ) : (
          <Box sx={{ mt: 1 }}>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart
                data={rows}
                margin={{ top: 16, right: 12, bottom: 12, left: 0 }}
              >
                <CartesianGrid
                  stroke={gridStroke}
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={axisTick}
                  tickLine={false}
                  axisLine={{ stroke: gridStroke }}
                  label={{
                    value: "Lap",
                    position: "insideBottom",
                    offset: -8,
                    fontSize: 12,
                    fill: "#56666d",
                  }}
                />
                <YAxis
                  reversed
                  domain={domain}
                  ticks={ticks}
                  allowDataOverflow
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tickFormatter={(value: number) => formatClock(value)}
                />
                <ReferenceLine
                  y={goal.pace_seconds_per_mile}
                  stroke={seriesColors.reference}
                  strokeDasharray="6 4"
                  strokeWidth={1.5}
                  label={{
                    value: `Goal ${formatClock(goal.pace_seconds_per_mile)}/mi`,
                    position: "insideTopRight",
                    fontSize: 12,
                    fill: seriesColors.reference,
                  }}
                />
                <Tooltip
                  cursor={{ stroke: gridStroke }}
                  content={({ active, payload }) => {
                    const row = payload?.[0]?.payload as Row | undefined;
                    if (!active || !row) return null;
                    return (
                      <Box sx={tooltipStyle}>
                        <Typography variant="body2" fontWeight={700}>
                          Lap {row.lap_index} ·{" "}
                          {Math.round(row.distance_meters)} m ·{" "}
                          {formatPreciseClock(row.elapsed_seconds)}
                        </Typography>
                        <Typography variant="body2">
                          {formatPace(row.pace_seconds_per_mile)} ·{" "}
                          {formatPreciseClock(row.pace_seconds_per_400m)}/400 m
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          component="p"
                        >
                          {formatSignedClock(row.pace_delta_seconds_per_mile)}
                          /mi vs goal ·{" "}
                          {row.counts_as_rep
                            ? "work rep"
                            : "warm-up / recovery"}
                        </Typography>
                      </Box>
                    );
                  }}
                />
                <Line
                  dataKey="plotted"
                  stroke="none"
                  strokeWidth={1}
                  dot={<LapDot />}
                  activeDot={{ r: 7 }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
            <ChartLegend
              items={[
                { label: "Rep", color: seriesColors.primary, kind: "dot" },
                {
                  label: "Rep at or under goal pace",
                  color: seriesColors.success,
                  kind: "dot",
                },
                {
                  label: "Other lap (warm-up / recovery)",
                  color: seriesColors.muted,
                  kind: "ring",
                },
                {
                  label: "Goal pace",
                  color: seriesColors.reference,
                  kind: "dashed",
                },
              ]}
            />
            <Typography
              variant="caption"
              color="text.secondary"
              component="p"
              sx={{ mt: 1 }}
            >
              Pace from lap elapsed time; higher on the chart is faster. Reps
              are identified heuristically (without workout-step data); laps
              slower than the chart range sit on its bottom edge.
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
