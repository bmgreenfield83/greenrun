import {
  Box,
  Card,
  CardContent,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type MouseHandlerDataParam,
} from "recharts";

import type { SameWeekdayRun } from "../../api/analytics";
import { duration } from "./format";

type Metric = "pace" | "heartRate" | "distance";
type SecondaryMetric = Metric | "none";

const labels: Record<Metric, string> = {
  pace: "Average pace",
  heartRate: "Average heart rate",
  distance: "Distance",
};

type TrendDatum = SameWeekdayRun & {
  dateLabel: string;
  pace: number | null;
  heartRate: number | null;
  distance: number;
};

function TrendTooltip({ point }: { point: TrendDatum }) {
  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        border: 1,
        borderColor: "divider",
        borderRadius: 1.5,
        p: 1.5,
      }}
    >
      <Typography fontWeight={800}>
        {point.local_date}
        {point.is_current ? " · Current" : ""}
      </Typography>
      <Typography variant="body2">{point.title || "Run"}</Typography>
      <Typography variant="body2" color="text.secondary">
        {point.category?.replaceAll("_", " ") || "Uncategorized"}
      </Typography>
      <Typography variant="body2">
        Distance: {point.distance.toFixed(2)} mi
      </Typography>
      <Typography variant="body2">
        Pace:{" "}
        {point.pace == null ? "Not recorded" : `${duration(point.pace)}/mi`}
      </Typography>
      <Typography variant="body2">
        Heart rate:{" "}
        {point.heartRate == null ? "Not recorded" : `${point.heartRate} bpm`}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Click to view activity
      </Typography>
    </Box>
  );
}

export function SameWeekdayTrendChart({
  runs,
  onSelectActivity,
}: {
  runs: SameWeekdayRun[];
  onSelectActivity: (activityId: string) => void;
}) {
  const [primary, setPrimary] = useState<Metric>("pace");
  const [secondary, setSecondary] = useState<SecondaryMetric>("heartRate");
  const data = useMemo<TrendDatum[]>(
    () =>
      runs.map((run) => ({
        ...run,
        dateLabel: run.local_date.slice(5),
        pace: run.pace_seconds_per_mile,
        heartRate: run.average_heart_rate,
        distance: run.distance_miles,
      })),
    [runs],
  );
  const paceDomain = useMemo(() => {
    const values = data
      .map((point) => point.pace)
      .filter((value): value is number => value !== null);
    if (!values.length) return ["auto", "auto"] as const;
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const padding = Math.max(10, (maximum - minimum) * 0.12);
    return [Math.max(0, minimum - padding), maximum + padding] as [
      number,
      number,
    ];
  }, [data]);

  const changePrimary = (metric: Metric) => {
    setPrimary(metric);
    if (secondary === metric) setSecondary("none");
  };
  const changeSecondary = (metric: SecondaryMetric) => {
    if (metric !== primary) setSecondary(metric);
  };
  const axis = (metric: Metric, id: "left" | "right") => (
    <YAxis
      yAxisId={id}
      orientation={id === "right" ? "right" : "left"}
      domain={metric === "pace" ? paceDomain : ["auto", "auto"]}
      reversed={metric === "pace"}
      tickFormatter={(value: number) =>
        metric === "pace"
          ? duration(value)
          : metric === "distance"
            ? `${value} mi`
            : `${value}`
      }
      width={metric === "pace" ? 62 : 54}
      tick={{ fontSize: 12, fill: "#56666d" }}
      tickLine={false}
    />
  );
  const series = (metric: Metric, id: "left" | "right") =>
    metric === "distance" ? (
      <Bar yAxisId={id} dataKey={metric} name={labels[metric]} opacity={0.55}>
        {data.map((point) => (
          <Cell
            key={point.activity_id}
            fill={
              point.is_current
                ? "#2f7d5b"
                : id === "left"
                  ? "#174a5b"
                  : "#d96b4f"
            }
          />
        ))}
      </Bar>
    ) : (
      <Line
        yAxisId={id}
        type="monotone"
        dataKey={metric}
        name={labels[metric]}
        stroke={id === "left" ? "#174a5b" : "#d96b4f"}
        strokeWidth={2.5}
        connectNulls={false}
        dot={(props) => {
          const point = data[Number(props.index)];
          return (
            <circle
              cx={props.cx}
              cy={props.cy}
              r={point?.is_current ? 6 : 4}
              fill={point?.is_current ? "#2f7d5b" : props.stroke}
              stroke="#fff"
              strokeWidth={2}
            />
          );
        }}
      />
    );
  const selectPoint = (state: MouseHandlerDataParam) => {
    const index = Number(state.activeTooltipIndex);
    if (Number.isInteger(index) && data[index])
      onSelectActivity(data[index].activity_id);
  };

  if (runs.length < 2) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h5" component="h2" gutterBottom>
            Same-day trend
          </Typography>
          <Typography color="text.secondary">
            No earlier runs from this weekday are available yet.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <div>
            <Typography variant="h5" component="h2">
              Same-day trend
            </Typography>
            <Typography color="text.secondary">
              This run and up to 12 earlier runs on the same weekday, across all
              run categories.
            </Typography>
          </div>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              select
              size="small"
              label="Y1 axis"
              value={primary}
              onChange={(event) => changePrimary(event.target.value as Metric)}
              sx={{ minWidth: 190 }}
            >
              {(Object.keys(labels) as Metric[]).map((metric) => (
                <MenuItem
                  value={metric}
                  key={metric}
                  disabled={secondary === metric}
                >
                  {labels[metric]}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Y2 axis"
              value={secondary}
              onChange={(event) =>
                changeSecondary(event.target.value as SecondaryMetric)
              }
              sx={{ minWidth: 190 }}
            >
              <MenuItem value="none">None</MenuItem>
              {(Object.keys(labels) as Metric[]).map((metric) => (
                <MenuItem
                  value={metric}
                  key={metric}
                  disabled={primary === metric}
                >
                  {labels[metric]}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <Box
            sx={{
              width: "100%",
              height: { xs: 320, md: 380 },
              cursor: "pointer",
            }}
          >
            <ResponsiveContainer>
              <ComposedChart
                data={data}
                margin={{
                  top: 12,
                  right: secondary === "none" ? 12 : 26,
                  bottom: 8,
                  left: 4,
                }}
                onClick={selectPoint}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e4ebe9"
                  vertical={false}
                />
                <XAxis
                  dataKey="dateLabel"
                  tick={{ fontSize: 12, fill: "#56666d" }}
                  tickLine={false}
                />
                {axis(primary, "left")}
                {secondary !== "none" && axis(secondary, "right")}
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <TrendTooltip point={payload[0].payload as TrendDatum} />
                    );
                  }}
                />
                <Legend />
                {series(primary, "left")}
                {secondary !== "none" && series(secondary, "right")}
              </ComposedChart>
            </ResponsiveContainer>
          </Box>
          <Typography variant="caption" color="text.secondary">
            Faster pace is higher. The current activity uses a larger green
            point. Track workouts are included and may make the trend noisier.
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
