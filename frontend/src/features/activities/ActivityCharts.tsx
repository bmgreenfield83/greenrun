import { Card, CardContent, Grid, Stack, Typography } from "@mui/material";
import { memo, useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ActivitySample } from "../../api/activities";
import type { SecondsRange } from "../analytics/heartRateResponse";
import { SectionPlate } from "../../components/common/SectionPlate";
import { formatPaceTick, getPaceChartDomain } from "./chartScale";

import {
  axisTick,
  gridStroke,
  seriesColors,
  tooltipStyle,
} from "../analytics/chartTheme";
const formatMinuteTick = (value: number) => `${Math.round(value)}`;

type ActivityChartsProps = {
  samples: ActivitySample[];
  sport: string;
  /** Elapsed-time ranges included in the HR-response fit (shaded on every chart). */
  analysisRanges?: SecondsRange[];
};

export const ActivityCharts = memo(function ActivityCharts({
  samples,
  sport,
  analysisRanges = [],
}: ActivityChartsProps) {
  const data = useMemo(
    () =>
      samples.map((sample) => ({
        minute: +(sample.elapsed_seconds / 60).toFixed(1),
        heartRate: sample.heart_rate,
        pace: sample.speed_mps
          ? +(1609.344 / sample.speed_mps / 60).toFixed(2)
          : null,
        speed: sample.speed_mps
          ? +(sample.speed_mps * 2.23694).toFixed(2)
          : null,
        cadence: sample.cadence_spm,
        elevation:
          sample.elevation_meters === null
            ? null
            : +(sample.elevation_meters * 3.28084).toFixed(1),
      })),
    [samples],
  );
  const paceDomain = useMemo(
    () => getPaceChartDomain(data.map((point) => point.pace)),
    [data],
  );

  if (!samples.length)
    return (
      <SectionPlate
        title="Charts"
        description="No sample charts are available for this activity."
      />
    );
  const usesPace = ["run", "walk", "hike"].includes(sport);
  const supportsRate = sport !== "strength";
  type ChartKey = "heartRate" | "pace" | "speed" | "cadence" | "elevation";
  type ChartDefinition = {
    title: string;
    key: ChartKey;
    unit: string;
    color: string;
    reversed: boolean;
  };
  const rateCharts: ChartDefinition[] = supportsRate
    ? [
        usesPace
          ? {
              title: "Pace",
              key: "pace",
              unit: "min/mi",
              color: seriesColors.primary,
              reversed: true,
            }
          : {
              title: "Speed",
              key: "speed",
              unit: "mph",
              color: seriesColors.primary,
              reversed: false,
            },
        {
          title: sport === "bike" ? "Cadence (RPM)" : "Cadence (SPM)",
          key: "cadence",
          unit: sport === "bike" ? "rpm" : "spm",
          color: seriesColors.blue,
          reversed: false,
        },
      ]
    : [];
  const chartCandidates: ChartDefinition[] = [
    {
      title: "Heart rate",
      key: "heartRate",
      unit: "bpm",
      color: seriesColors.red,
      reversed: false,
    },
    ...rateCharts,
    {
      title: "Elevation",
      key: "elevation",
      unit: "ft",
      color: seriesColors.earth,
      reversed: false,
    },
  ];
  const charts = chartCandidates.filter((chart) =>
    data.some((point) => point[chart.key] !== null),
  );
  const scatter = data.filter(
    (point) =>
      point.heartRate !== null &&
      (usesPace ? point.pace !== null : point.speed !== null),
  );

  return (
    <Stack spacing={{ xs: 2, sm: 3 }}>
      <SectionPlate
        title="Charts"
        description={
          analysisRanges.length > 0
            ? `Lightly shaded regions mark the samples used for workload-adjusted heart-rate analysis${
                analysisRanges.length > 1
                  ? "; unshaded gaps between them are stops."
                  : "."
              }`
            : undefined
        }
      />
      <Grid container spacing={{ xs: 2, sm: 3 }}>
        {charts.map(({ title, key, unit, color, reversed }) => (
          <Grid size={{ xs: 12, md: 6 }} key={key}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" component="h3">
                  {title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {unit} by elapsed minutes
                </Typography>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart
                    data={data}
                    syncId="activity"
                    margin={{ top: 12, right: 8, bottom: 0, left: -8 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={gridStroke}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="minute"
                      type="number"
                      domain={[0, "dataMax"]}
                      tick={axisTick}
                      tickFormatter={formatMinuteTick}
                      tickLine={false}
                      axisLine={{ stroke: gridStroke }}
                      minTickGap={16}
                    />
                    <YAxis
                      width={48}
                      tick={axisTick}
                      tickLine={false}
                      axisLine={false}
                      reversed={reversed}
                      domain={key === "pace" ? paceDomain : ["auto", "auto"]}
                      allowDataOverflow={key === "pace"}
                      tickFormatter={
                        key === "pace" ? formatPaceTick : undefined
                      }
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelFormatter={(value) => `${value} elapsed minutes`}
                      formatter={(value) => [
                        typeof value === "number"
                          ? value.toFixed(key === "pace" ? 2 : 1)
                          : value,
                        `${title} (${unit})`,
                      ]}
                    />
                    {analysisRanges.map((range) => (
                      <ReferenceArea
                        key={range.startSeconds}
                        x1={range.startSeconds / 60}
                        x2={range.endSeconds / 60}
                        fill={seriesColors.primary}
                        fillOpacity={0.08}
                        strokeOpacity={0}
                      />
                    ))}
                    <Line
                      type="monotone"
                      dataKey={key}
                      stroke={color}
                      strokeWidth={2.25}
                      dot={false}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      {supportsRate && scatter.length >= 5 && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" component="h3">
              {usesPace ? "Pace" : "Speed"} versus heart rate
            </Typography>
            <Typography variant="body2" color="text.secondary">
              A transparent comparison of recorded samples, not a fitness score.
            </Typography>
            <ResponsiveContainer width="100%" height={260}>
              <ScatterChart margin={{ top: 12, right: 8, bottom: 8, left: 0 }}>
                <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
                <XAxis
                  dataKey="heartRate"
                  type="number"
                  name="Heart rate"
                  unit=" bpm"
                  domain={["dataMin - 5", "dataMax + 5"]}
                  tick={axisTick}
                  tickLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  dataKey={usesPace ? "pace" : "speed"}
                  type="number"
                  name={usesPace ? "Pace" : "Speed"}
                  unit={usesPace ? "" : " mph"}
                  reversed={usesPace}
                  domain={usesPace ? paceDomain : ["auto", "auto"]}
                  allowDataOverflow={usesPace}
                  tickFormatter={usesPace ? formatPaceTick : undefined}
                  tick={axisTick}
                  tickLine={false}
                  width={56}
                  label={
                    usesPace
                      ? {
                          value: "min/mi",
                          angle: -90,
                          position: "insideLeft",
                          style: axisTick,
                        }
                      : undefined
                  }
                />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  contentStyle={tooltipStyle}
                  formatter={(value, name) =>
                    name === "Pace" && typeof value === "number"
                      ? [`${formatPaceTick(value)} /mi`, name]
                      : [value, name]
                  }
                />
                <Scatter
                  data={scatter}
                  fill={seriesColors.primary}
                  fillOpacity={0.45}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}, activityChartsPropsAreEqual);

function activityChartsPropsAreEqual(
  previous: ActivityChartsProps,
  next: ActivityChartsProps,
) {
  return (
    previous.samples === next.samples &&
    previous.sport === next.sport &&
    rangesKey(previous.analysisRanges) === rangesKey(next.analysisRanges)
  );
}

function rangesKey(ranges: SecondsRange[] | undefined) {
  return (ranges ?? [])
    .map((range) => `${range.startSeconds}-${range.endSeconds}`)
    .join(",");
}
