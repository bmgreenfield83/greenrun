import { Box, Typography } from "@mui/material";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { GoalProgress } from "../../api/analytics";
import { ChartLegend } from "./ChartLegend";
import { axisTick, gridStroke, seriesColors, tooltipStyle } from "./chartTheme";
import {
  formatPace,
  formatPreciseClock,
  formatClock,
  shortDate,
} from "./format";
import { clockTicks } from "./format";

type Row = {
  week: string;
  beforePlan: number | null;
  inPlan: number | null;
  effort: GoalProgress["weeks"][number]["best_effort"];
  isBeforePlan: boolean;
  isFuture: boolean;
};

/** Best effort at the goal distance per week, with the goal time as a reference line. */
export function GoalEffortChart({ goal }: { goal: GoalProgress }) {
  const target = goal.goal!.target_time_seconds;
  const rows: Row[] = goal.weeks.map((week) => {
    const seconds = week.best_effort?.elapsed_seconds ?? null;
    return {
      week: week.week_start,
      beforePlan: week.is_before_plan ? seconds : null,
      inPlan: week.is_before_plan ? null : seconds,
      effort: week.best_effort,
      isBeforePlan: week.is_before_plan,
      isFuture: week.is_future,
    };
  });
  const values = rows
    .map((row) => row.effort?.elapsed_seconds)
    .filter((value): value is number => value != null);
  const low = Math.min(target, ...values);
  const high = Math.max(target, ...values);
  const padding = Math.max(5, (high - low) * 0.12);
  const ticks = clockTicks(Math.max(0, low - padding), high + padding);
  const domain = [ticks[0], ticks[ticks.length - 1]];
  const firstPlanWeek = rows.find((row) => !row.isBeforePlan)?.week;
  const lastLeadInWeek = [...rows]
    .reverse()
    .find((row) => row.isBeforePlan)?.week;
  const firstFuture = rows.find((row) => row.isFuture)?.week;
  const lastWeek = rows.at(-1)?.week;

  return (
    <Box>
      <Typography variant="h6" component="h3">
        Best {goal.goal!.distance_label} effort each week
      </Typography>
      <Typography variant="caption" color="text.secondary" component="p">
        Elapsed time; lower is faster. Weeks without an effort at this distance
        are gaps.
      </Typography>
      {values.length === 0 ? (
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          No efforts at this distance in the plan window or the 12 weeks before
          it.
        </Typography>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart
              data={rows}
              margin={{ top: 16, right: 12, bottom: 0, left: 0 }}
            >
              <CartesianGrid
                stroke={gridStroke}
                strokeDasharray="3 3"
                vertical={false}
              />
              {lastLeadInWeek && (
                <ReferenceArea
                  x1={rows[0].week}
                  x2={lastLeadInWeek}
                  fill="#56666d"
                  fillOpacity={0.06}
                  strokeOpacity={0}
                  label={{
                    value: "Before plan",
                    position: "insideTopLeft",
                    fontSize: 11,
                    fill: "#56666d",
                  }}
                />
              )}
              {firstFuture && lastWeek && (
                <ReferenceArea
                  x1={firstFuture}
                  x2={lastWeek}
                  fill="#2a78d6"
                  fillOpacity={0.04}
                  strokeOpacity={0}
                  label={{
                    value: "Ahead",
                    position: "insideTopRight",
                    fontSize: 11,
                    fill: "#56666d",
                  }}
                />
              )}
              <XAxis
                dataKey="week"
                tick={axisTick}
                tickLine={false}
                axisLine={{ stroke: gridStroke }}
                tickFormatter={shortDate}
                minTickGap={24}
              />
              <YAxis
                domain={domain}
                ticks={ticks}
                tick={axisTick}
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={(value: number) => formatClock(value)}
                allowDataOverflow
              />
              <ReferenceLine
                y={target}
                stroke={seriesColors.reference}
                strokeDasharray="6 4"
                strokeWidth={1.5}
                label={{
                  value: `Goal ${formatPreciseClock(target)}`,
                  position: "insideBottomRight",
                  fontSize: 12,
                  fill: seriesColors.reference,
                }}
              />
              {firstPlanWeek && (
                <ReferenceLine
                  x={firstPlanWeek}
                  stroke="#8a9599"
                  strokeWidth={1}
                />
              )}
              <Tooltip
                cursor={{ stroke: gridStroke }}
                content={({ active, payload }) => {
                  const row = payload?.[0]?.payload as Row | undefined;
                  if (!active || !row) return null;
                  return (
                    <Box sx={tooltipStyle}>
                      <Typography variant="body2" fontWeight={700}>
                        Week of {shortDate(row.week)}
                        {row.isBeforePlan ? " (before plan)" : ""}
                      </Typography>
                      {row.effort ? (
                        <>
                          <Typography variant="body2">
                            {formatPreciseClock(row.effort.elapsed_seconds)} ·{" "}
                            {formatPace(row.effort.pace_seconds_per_mile)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {shortDate(row.effort.local_date)} ·{" "}
                            {row.effort.source === "lap"
                              ? `lap ${row.effort.lap_index}`
                              : "within a run"}
                          </Typography>
                        </>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          {row.isFuture
                            ? "Upcoming week"
                            : "No effort at this distance"}
                        </Typography>
                      )}
                    </Box>
                  );
                }}
              />
              <Line
                dataKey="beforePlan"
                name="Before plan"
                stroke={seriesColors.muted}
                strokeWidth={2}
                dot={{
                  r: 4,
                  fill: seriesColors.muted,
                  stroke: "#fff",
                  strokeWidth: 2,
                }}
                activeDot={{ r: 6 }}
                connectNulls
                isAnimationActive={false}
              />
              <Line
                dataKey="inPlan"
                name="During plan"
                stroke={seriesColors.primary}
                strokeWidth={2}
                dot={{
                  r: 4.5,
                  fill: seriesColors.primary,
                  stroke: "#fff",
                  strokeWidth: 2,
                }}
                activeDot={{ r: 6 }}
                connectNulls
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
          <ChartLegend
            items={[
              {
                label: "Best effort, before plan",
                color: seriesColors.muted,
                kind: "dot",
              },
              {
                label: "Best effort, during plan",
                color: seriesColors.primary,
                kind: "dot",
              },
              {
                label: "Goal time",
                color: seriesColors.reference,
                kind: "dashed",
              },
            ]}
          />
        </>
      )}
    </Box>
  );
}
