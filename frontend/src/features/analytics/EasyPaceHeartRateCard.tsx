import { Box, Grid, Stack, Typography } from "@mui/material";
import {
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { EasyPaceHeartRate, EasyPaceRun } from "../../api/analytics";
import { AnalyticsCard, Figure } from "./AnalyticsCard";
import { ChartLegend } from "./ChartLegend";
import {
  axisTick,
  gridStroke,
  seriesColors,
  temperatureColor,
  tooltipStyle,
} from "./chartTheme";
import {
  categoryLabel,
  dateValue,
  formatPace,
  formatTemperature,
  shortDate,
  timeLabel,
  type TemperatureUnit,
} from "./format";
import { TemperatureLegend } from "./TemperatureLegend";
import { niceTicks } from "./format";

type MonthPoint = {
  time: number;
  month: string;
  median: number;
  runCount: number;
};
type RunPoint = EasyPaceRun & { time: number; hr: number };

const monthLabel = (month: string) =>
  timeLabel(dateValue(month), { month: "short", year: "numeric" });

function RunDot({
  cx = 0,
  cy = 0,
  payload,
}: {
  cx?: number;
  cy?: number;
  payload?: RunPoint;
}) {
  const fill = temperatureColor(payload?.temperature_fahrenheit);
  const recorded = payload?.temperature_fahrenheit != null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4.5}
      fill={fill}
      stroke={recorded ? "#fff" : "#8a8984"}
      strokeWidth={recorded ? 1.5 : 1.5}
    />
  );
}

/** Monthly median HR at a fixed easy grade-adjusted pace, with per-run points. */
export function EasyPaceHeartRateCard({
  data,
  loading,
  error,
  unit,
}: {
  data: EasyPaceHeartRate | null;
  loading: boolean;
  error: string | null;
  unit: TemperatureUnit;
}) {
  const months: MonthPoint[] = (data?.months ?? [])
    .filter((month) => month.median_heart_rate_bpm != null)
    .map((month) => ({
      time: dateValue(month.month) + 14 * 86_400_000,
      month: month.month,
      median: month.median_heart_rate_bpm!,
      runCount: month.run_count,
    }));
  const runs: RunPoint[] = (data?.runs ?? []).map((run) => ({
    ...run,
    time: dateValue(run.local_date),
    hr: run.heart_rate_at_reference_bpm,
  }));
  const reference = data?.reference_pace_seconds_per_mile;
  const categories =
    data?.categories.map(categoryLabel).join(", ") ?? "easy, long, recovery";
  // Start at the first month with data (not the empty start of the 12-month window).
  const firstTime = Math.min(
    ...runs.map((run) => run.time),
    ...months.map((month) => month.time),
  );
  const start = Number.isFinite(firstTime) ? firstTime - 20 * 86_400_000 : 0;
  const hrTicks = niceTicks(
    Math.min(
      ...runs.map((run) => run.hr),
      ...months.map((month) => month.median),
    ) - 2,
    Math.max(
      ...runs.map((run) => run.hr),
      ...months.map((month) => month.median),
    ) + 2,
    5,
  );
  const end = data ? dateValue(data.as_of_date) + 86_400_000 : 1;
  const latest = months.slice(-3).reverse();
  return (
    <AnalyticsCard
      title="Heart rate at easy pace"
      description={`Estimated heart rate at one fixed grade-adjusted pace on ${categories} runs, from steady running after the first 10 minutes. Lower heart rate at the same pace suggests better aerobic fitness; heat, fatigue, and sensor error move it too.`}
      loading={loading}
      error={error}
    >
      {data && reference == null ? (
        <Typography color="text.secondary">
          No runs qualify yet ({data.excluded.length} excluded). A run needs at
          least 15 minutes of steady running after the first 10 minutes.
        </Typography>
      ) : data ? (
        <Stack spacing={2}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Figure
                label="Reference pace"
                value={formatPace(reference)}
                detail="grade-adjusted; derived from your typical easy pace"
              />
            </Grid>
            {latest.map((month) => (
              <Grid size={{ xs: 4, sm: "grow" }} key={month.month}>
                <Figure
                  label={monthLabel(month.month)}
                  value={`${Math.round(month.median)} bpm`}
                  detail={`${month.runCount} run${month.runCount === 1 ? "" : "s"}`}
                />
              </Grid>
            ))}
          </Grid>
          <Box>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart
                margin={{ top: 12, right: 12, bottom: 0, left: -8 }}
              >
                <CartesianGrid
                  stroke={gridStroke}
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="time"
                  type="number"
                  scale="time"
                  domain={[start, end]}
                  tickFormatter={(value: number) =>
                    timeLabel(value, { month: "short" })
                  }
                  tick={axisTick}
                  tickLine={false}
                  axisLine={{ stroke: gridStroke }}
                  minTickGap={20}
                />
                <YAxis
                  dataKey="hr"
                  type="number"
                  domain={[hrTicks[0], hrTicks[hrTicks.length - 1]]}
                  ticks={hrTicks}
                  tickFormatter={(value: number) => `${Math.round(value)}`}
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={({ active, payload }) => {
                    const point = payload?.[0]?.payload as
                      (RunPoint | MonthPoint) | undefined;
                    if (!active || !point) return null;
                    if ("median" in point)
                      return (
                        <Box sx={tooltipStyle}>
                          <Typography variant="body2" fontWeight={700}>
                            {monthLabel(point.month)} median
                          </Typography>
                          <Typography variant="body2">
                            {point.median.toFixed(1)} bpm · {point.runCount} run
                            {point.runCount === 1 ? "" : "s"}
                          </Typography>
                        </Box>
                      );
                    return (
                      <Box sx={tooltipStyle}>
                        <Typography variant="body2" fontWeight={700}>
                          {shortDate(point.local_date)} ·{" "}
                          {categoryLabel(point.category)}
                        </Typography>
                        <Typography variant="body2">
                          {point.heart_rate_at_reference_bpm.toFixed(1)} bpm at{" "}
                          {formatPace(reference)}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          component="p"
                        >
                          Median{" "}
                          {formatPace(
                            point.median_grade_adjusted_pace_seconds_per_mile,
                          )}{" "}
                          GAP at {Math.round(point.median_heart_rate_bpm)} bpm ·{" "}
                          {formatTemperature(
                            point.temperature_fahrenheit,
                            unit,
                          )}
                        </Typography>
                      </Box>
                    );
                  }}
                />
                <Scatter
                  name="Runs"
                  data={runs}
                  dataKey="hr"
                  shape={<RunDot />}
                  isAnimationActive={false}
                />
                <Scatter
                  name="Monthly median"
                  data={months.map((month) => ({ ...month, hr: month.median }))}
                  dataKey="hr"
                  fill={seriesColors.reference}
                  line={{ stroke: seriesColors.reference, strokeWidth: 2 }}
                  shape="diamond"
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
            <ChartLegend
              items={[
                {
                  label: "Monthly median (bpm)",
                  color: seriesColors.reference,
                  kind: "line",
                },
              ]}
            />
            <Box sx={{ mt: 0.5 }}>
              <TemperatureLegend unit={unit} />
            </Box>
          </Box>
          <Typography variant="caption" color="text.secondary">
            {runs.length} run{runs.length === 1 ? "" : "s"} included,{" "}
            {data.excluded.length} excluded (too short, too little steady
            running, or pace range too far from the reference). Each dot is one
            run's heart rate evaluated at the reference pace. Recorded
            temperature is the watch reading, which runs warm on the wrist.
          </Typography>
        </Stack>
      ) : null}
    </AnalyticsCard>
  );
}
