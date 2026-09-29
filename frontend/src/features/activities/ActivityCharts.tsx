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
import { formatPaceTick, getPaceChartDomain } from "./chartScale";

type ActivityChartsProps = {
  samples: ActivitySample[];
  sport: string;
  analysisWindow?: { startSeconds: number; durationSeconds: number };
};

export const ActivityCharts = memo(function ActivityCharts({
  samples,
  sport,
  analysisWindow,
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
      <Typography color="text.secondary">
        No sample charts are available for this activity.
      </Typography>
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
              color: "#1976d2",
              reversed: true,
            }
          : {
              title: "Speed",
              key: "speed",
              unit: "mph",
              color: "#1976d2",
              reversed: false,
            },
        {
          title: sport === "bike" ? "Cadence (RPM)" : "Cadence (SPM)",
          key: "cadence",
          unit: sport === "bike" ? "rpm" : "spm",
          color: "#7b1fa2",
          reversed: false,
        },
      ]
    : [];
  const chartCandidates: ChartDefinition[] = [
    {
      title: "Heart rate",
      key: "heartRate",
      unit: "bpm",
      color: "#d32f2f",
      reversed: false,
    },
    ...rateCharts,
    {
      title: "Elevation",
      key: "elevation",
      unit: "ft",
      color: "#2e7d32",
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
    <Stack spacing={2}>
      <Typography variant="h5">Charts</Typography>
      <Grid container spacing={2}>
        {charts.map(({ title, key, unit, color, reversed }) => (
          <Grid size={{ xs: 12, md: 6 }} key={key}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6">{title}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Elapsed minutes &bull; {unit}
                </Typography>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={data} syncId="activity">
                    <CartesianGrid strokeDasharray="3 3" stroke="#dce5e3" />
                    <XAxis dataKey="minute" />
                    <YAxis
                      reversed={reversed}
                      domain={key === "pace" ? paceDomain : ["auto", "auto"]}
                      allowDataOverflow={key === "pace"}
                      tickFormatter={
                        key === "pace" ? formatPaceTick : undefined
                      }
                    />
                    <Tooltip
                      labelFormatter={(value) => `${value} elapsed minutes`}
                      formatter={(value) => [
                        typeof value === "number"
                          ? value.toFixed(key === "pace" ? 2 : 1)
                          : value,
                        `${title} (${unit})`,
                      ]}
                    />
                    {analysisWindow && (
                      <ReferenceArea
                        x1={analysisWindow.startSeconds / 60}
                        x2={
                          (analysisWindow.startSeconds +
                            analysisWindow.durationSeconds) /
                          60
                        }
                        fill="#1976d2"
                        fillOpacity={0.07}
                        strokeOpacity={0}
                      />
                    )}
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
      {analysisWindow && (
        <Typography variant="caption" color="text.secondary">
          The lightly shaded region marks the samples used for workload-adjusted
          heart-rate analysis.
        </Typography>
      )}
      {supportsRate && scatter.length >= 5 && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6">
              {usesPace ? "Pace" : "Speed"} versus heart rate
            </Typography>
            <Typography variant="body2" color="text.secondary">
              A transparent comparison of recorded samples, not a fitness score.
            </Typography>
            <ResponsiveContainer width="100%" height={260}>
              <ScatterChart>
                <CartesianGrid stroke="#dce5e3" />
                <XAxis dataKey="heartRate" name="Heart rate" unit=" bpm" />
                <YAxis
                  dataKey={usesPace ? "pace" : "speed"}
                  name={usesPace ? "Pace" : "Speed"}
                  unit={usesPace ? " min/mi" : " mph"}
                  reversed={usesPace}
                />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                <Scatter data={scatter} fill="#1976d2" />
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
    previous.analysisWindow?.startSeconds ===
      next.analysisWindow?.startSeconds &&
    previous.analysisWindow?.durationSeconds ===
      next.analysisWindow?.durationSeconds
  );
}
