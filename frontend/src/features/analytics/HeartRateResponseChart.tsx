import { Box, Typography } from "@mui/material";
import {
  CartesianGrid,
  ComposedChart,
  ErrorBar,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { HeartRateResponseResult } from "../../api/analytics";
import { ChartLegend } from "./ChartLegend";
import {
  axisTick,
  gridStroke,
  seriesColors,
  temperatureColor,
  tooltipStyle,
} from "./chartTheme";
import { durationWeightedTrend } from "./driftTrend";
import { intervalOf } from "./heartRateResponse";
import {
  categoryLabel,
  formatTemperature,
  hoursMinutes,
  shortDate,
  timeLabel,
  type TemperatureUnit,
} from "./format";
import { TemperatureLegend } from "./TemperatureLegend";
import { niceTicks } from "./format";

type Point = HeartRateResponseResult & {
  time: number;
  trend: number | null;
  value: number | null;
  interval: [number, number] | null;
};

const radius = (confidence: HeartRateResponseResult["confidence"]) =>
  confidence === "high" ? 7 : confidence === "moderate" ? 5.5 : 4;

function ResponseDot({
  cx = 0,
  cy = 0,
  payload,
}: {
  cx?: number;
  cy?: number;
  payload?: Point;
}) {
  if (payload?.value == null) return null;
  const recorded = payload.temperature_fahrenheit != null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={radius(payload.confidence)}
      fill={temperatureColor(payload.temperature_fahrenheit)}
      stroke={recorded ? "#fff" : "#8a8984"}
      strokeWidth={1.5}
    />
  );
}

/** Adjusted HR change per run on a real date axis, colored by recorded temperature. */
export function HeartRateResponseChart({
  results,
  unit,
}: {
  results: HeartRateResponseResult[];
  unit: TemperatureUnit;
}) {
  const trend = durationWeightedTrend(results);
  const points: Point[] = trend.map((point) => {
    const value = point.adjusted_change_bpm_per_hour ?? null;
    const interval = intervalOf(point);
    return {
      ...point,
      value,
      interval:
        value != null && interval
          ? [Math.max(0, value - interval[0]), Math.max(0, interval[1] - value)]
          : null,
    };
  });
  const extents = points.flatMap((point) => {
    const interval = intervalOf(point);
    return [point.value, interval?.[0], interval?.[1], point.trend].filter(
      (value): value is number => value != null,
    );
  });
  const yTicks = niceTicks(Math.min(0, ...extents), Math.max(...extents));
  const low = yTicks[0];
  const high = yTicks[yTicks.length - 1];
  const start = points[0]?.time ?? 0;
  const end = points.at(-1)?.time ?? 1;
  const pad = Math.max(3 * 86_400_000, (end - start) * 0.03);
  const hasTrend = trend.slopePer30Days != null;

  return (
    <Box>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart
          data={points}
          margin={{ left: -4, right: 12, top: 12, bottom: 0 }}
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
            domain={[start - pad, end + pad]}
            tickFormatter={(value: number) => timeLabel(value)}
            tick={axisTick}
            tickLine={false}
            axisLine={{ stroke: gridStroke }}
            minTickGap={24}
          />
          <YAxis
            type="number"
            domain={[low, high]}
            ticks={yTicks}
            allowDataOverflow
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={44}
            label={{
              value: "bpm/hour",
              angle: -90,
              position: "insideLeft",
              offset: 12,
              style: axisTick,
            }}
          />
          <ReferenceLine y={0} stroke="#b9ad8e" />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as Point | undefined;
              if (!active || !point || point.value == null) return null;
              const interval = intervalOf(point);
              return (
                <Box sx={tooltipStyle}>
                  <Typography variant="body2" fontWeight={700}>
                    {shortDate(point.local_date)} ·{" "}
                    {categoryLabel(point.category)}
                  </Typography>
                  <Typography variant="body2">
                    {point.value.toFixed(1)} bpm/hour
                    {interval
                      ? ` (90%: ${interval[0].toFixed(1)} to ${interval[1].toFixed(1)})`
                      : ""}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    component="p"
                  >
                    {point.confidence ?? "unknown"} confidence ·{" "}
                    {point.usable_duration_seconds
                      ? `${hoursMinutes(point.usable_duration_seconds)} usable · `
                      : ""}
                    {formatTemperature(point.temperature_fahrenheit, unit)}
                  </Typography>
                  {!interval && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      component="p"
                    >
                      No interval (algorithm v{point.algorithm_version})
                    </Typography>
                  )}
                </Box>
              );
            }}
          />
          {hasTrend && (
            <Line
              dataKey="trend"
              name="Trend"
              stroke={seriesColors.secondary}
              strokeWidth={2.5}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
              legendType="none"
            />
          )}
          <Scatter
            dataKey="value"
            shape={<ResponseDot />}
            isAnimationActive={false}
          >
            <ErrorBar
              dataKey="interval"
              direction="y"
              width={0}
              stroke="#8a9599"
              strokeWidth={1.5}
            />
          </Scatter>
        </ComposedChart>
      </ResponsiveContainer>
      <ChartLegend
        items={[
          ...(hasTrend
            ? [
                {
                  label: "Duration-weighted trend",
                  color: seriesColors.secondary,
                  kind: "line" as const,
                },
              ]
            : []),
          {
            label: "90% interval (version 4+)",
            color: "#8a9599",
            kind: "line",
          },
        ]}
      />
      <Box sx={{ mt: 0.5 }}>
        <TemperatureLegend unit={unit} />
      </Box>
      <Typography
        variant="caption"
        color="text.secondary"
        component="p"
        sx={{ mt: 1 }}
      >
        Each point is one run on its date. Point size shows confidence (larger =
        higher; based on the interval width and usable duration); color shows
        the watch's recorded temperature.{" "}
        {hasTrend
          ? `The orange line is a duration-weighted linear trend over dates (${trend.slopePer30Days! >= 0 ? "+" : ""}${trend.slopePer30Days!.toFixed(1)} bpm/hour per 30 days); usable duration is capped at 55 minutes so one long run cannot dominate.`
          : "Four qualifying runs are required before a trend is shown."}
      </Typography>
    </Box>
  );
}
