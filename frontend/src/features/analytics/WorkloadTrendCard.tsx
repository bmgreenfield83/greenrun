import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  LinearProgress,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import {
  CartesianGrid,
  ErrorBar,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "wouter";

import {
  getWorkloadTrend,
  type WorkloadComparison,
  type WorkloadTrend,
} from "../../api/workloadTrend";
import { duration } from "../activities/format";

function comparisonLabel(group: WorkloadComparison) {
  const temperature =
    group.temperature_min_fahrenheit == null
      ? "Temperature unknown"
      : `${group.temperature_min_fahrenheit}–<${group.temperature_max_fahrenheit}°F`;
  return `${duration(group.pace_seconds_per_mile)}/mi · ${group.category.replaceAll("_", " ")} · minutes ${group.start_minute}–${group.end_minute} · ${temperature} · ${group.runs.length} runs`;
}

export function WorkloadTrendCard() {
  const [data, setData] = useState<WorkloadTrend | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void getWorkloadTrend(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((reason: Error) => {
        if (!controller.signal.aborted) setError(reason.message);
      });
    return () => controller.abort();
  }, [revision]);
  const group =
    data?.comparisons.find((item) => item.id === selectedId) ??
    data?.comparisons[0];
  const chart =
    group?.weeks.map((week) => ({
      ...week,
      timestamp: Date.parse(`${week.week_start}T00:00:00Z`),
      spread: [
        week.median_heart_rate_bpm - week.minimum_heart_rate_bpm,
        week.maximum_heart_rate_bpm - week.median_heart_rate_bpm,
      ],
    })) ?? [];

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            gap={2}
          >
            <Typography variant="h5">Heart rate at comparable pace</Typography>
            <Button
              disabled={!data && !error}
              onClick={() => {
                setData(null);
                setError(null);
                setRevision((value) => value + 1);
              }}
            >
              Refresh comparisons
            </Button>
          </Stack>
          <Typography color="text.secondary">
            Compare observed heart rate across weeks during steady, nearly flat
            running at similar pace, time into the run, category, and recorded
            temperature.
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          {!data && !error && (
            <Box>
              <Typography>Finding comparable running sections…</Typography>
              <LinearProgress />
            </Box>
          )}
          {data && (
            <>
              <Typography variant="body2" color="text.secondary">
                {data.start_date} through {data.end_date} ·{" "}
                {data.qualifying_runs} of {data.runs_screened} runs have
                qualifying sections.
              </Typography>
              {!group && (
                <Alert severity="info">
                  No qualifying sections yet. Comparisons need steady easy,
                  long, recovery, or run club running with recorded heart rate,
                  speed, distance, and elevation after the first 10 minutes.
                </Alert>
              )}
              {group && (
                <>
                  <TextField
                    select
                    fullWidth
                    label="Pace comparison"
                    value={group.id}
                    onChange={(event) => setSelectedId(event.target.value)}
                    SelectProps={{
                      sx: { "& .MuiSelect-select": { whiteSpace: "normal" } },
                    }}
                  >
                    {data.comparisons.map((item) => (
                      <MenuItem
                        key={item.id}
                        value={item.id}
                        sx={{ whiteSpace: "normal" }}
                      >
                        {comparisonLabel(item)}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Typography variant="body2">
                    {duration(group.pace_seconds_per_mile - 15)}–
                    {duration(group.pace_seconds_per_mile + 15)}/mi section
                    pace; grade within ±1%; minutes {group.start_minute}–
                    {group.end_minute} of each run. Each section lasts five
                    minutes after one minute of steady running.
                  </Typography>
                  {group.temperature_min_fahrenheit == null && (
                    <Alert severity="info">
                      Temperature was not recorded for these runs. Weather
                      similarity is unknown.
                    </Alert>
                  )}
                  {group.weeks.length < 2 && (
                    <Alert severity="info">
                      At least two weeks with matching sections are needed for a
                      comparison over time. The available runs are shown below.
                    </Alert>
                  )}
                  {group.weeks.length >= 2 && (
                    <Box sx={{ width: "100%", height: 280 }}>
                      <ResponsiveContainer>
                        <ScatterChart
                          margin={{ top: 15, right: 25, bottom: 10, left: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="timestamp"
                            type="number"
                            domain={["dataMin", "dataMax"]}
                            tickFormatter={(value: number) =>
                              new Date(value).toISOString().slice(5, 10)
                            }
                            name="Week"
                          />
                          <YAxis
                            dataKey="median_heart_rate_bpm"
                            type="number"
                            unit=" bpm"
                            domain={["auto", "auto"]}
                            width={75}
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              const point = payload?.[0]?.payload as
                                (typeof chart)[number] | undefined;
                              return active && point ? (
                                <Box
                                  sx={{
                                    bgcolor: "background.paper",
                                    border: 1,
                                    borderColor: "divider",
                                    p: 1.5,
                                  }}
                                >
                                  <Typography>
                                    Week of {point.week_start}
                                  </Typography>
                                  <Typography>
                                    {point.median_heart_rate_bpm} bpm median ·{" "}
                                    {point.run_count} runs
                                  </Typography>
                                  <Typography>
                                    {point.minimum_heart_rate_bpm}–
                                    {point.maximum_heart_rate_bpm} bpm range
                                  </Typography>
                                </Box>
                              ) : null;
                            }}
                          />
                          <Scatter
                            data={chart}
                            fill="#174a5b"
                            name="Weekly median HR"
                          >
                            <ErrorBar
                              dataKey="spread"
                              direction="y"
                              width={5}
                            />
                          </Scatter>
                        </ScatterChart>
                      </ResponsiveContainer>
                    </Box>
                  )}
                  <Typography variant="body2" color="text.secondary">
                    Weekly medians give each run equal weight. Ranges show the
                    lowest and highest run averages, not confidence intervals. A
                    single-run week has no spread.
                  </Typography>
                  <TableContainer>
                    <Table
                      size="small"
                      aria-label="Weekly comparable heart rate"
                    >
                      <TableHead>
                        <TableRow>
                          <TableCell>Week of</TableCell>
                          <TableCell>Runs</TableCell>
                          <TableCell>Median HR</TableCell>
                          <TableCell>Run range</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {group.weeks.map((week) => (
                          <TableRow key={week.week_start}>
                            <TableCell>{week.week_start}</TableCell>
                            <TableCell>{week.run_count}</TableCell>
                            <TableCell>
                              {week.median_heart_rate_bpm} bpm
                            </TableCell>
                            <TableCell>
                              {week.minimum_heart_rate_bpm}–
                              {week.maximum_heart_rate_bpm} bpm
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <Box component="details">
                    <Typography component="summary" sx={{ cursor: "pointer" }}>
                      Contributing runs ({group.runs.length})
                    </Typography>
                    <TableContainer>
                      <Table size="small" aria-label="Contributing runs">
                        <TableHead>
                          <TableRow>
                            <TableCell>Run</TableCell>
                            <TableCell>Section HR</TableCell>
                            <TableCell>Section pace</TableCell>
                            <TableCell>Matched time</TableCell>
                            <TableCell>Recorded temperature</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {group.runs.map((run) => (
                            <TableRow key={run.activity_id}>
                              <TableCell>
                                <Link href={`/activities/${run.activity_id}`}>
                                  {run.local_date} · {run.title || "Run"}
                                </Link>
                              </TableCell>
                              <TableCell>{run.heart_rate_bpm} bpm</TableCell>
                              <TableCell>
                                {duration(run.pace_seconds_per_mile)}/mi
                              </TableCell>
                              <TableCell>{run.matched_minutes} min</TableCell>
                              <TableCell>
                                {run.temperature_fahrenheit == null
                                  ? "Unknown"
                                  : `${run.temperature_fahrenheit}°F`}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                </>
              )}
              <Box component="details">
                <Typography component="summary" sx={{ cursor: "pointer" }}>
                  How sections are selected
                </Typography>
                <Typography variant="body2">
                  Uses the last 180 days, analyzing minutes 10–60. Stops, large
                  sample gaps, variable pace, hills, and missing sensors exclude
                  a section. Your per-run HR analysis start distance is
                  respected. Recorded temperature is grouped into 9°F bands;
                  runs without it form separate groups. The default comparison
                  has the most qualifying weeks, then runs.
                </Typography>
                {Object.entries(data.exclusion_counts).map(
                  ([reason, count]) => (
                    <Typography variant="body2" key={reason}>
                      {count} runs excluded: {reason}
                    </Typography>
                  ),
                )}
              </Box>
              <Typography variant="caption" color="text.secondary">
                Observed comparisons, without pace extrapolation or weather
                correction. Heat exposure, wind, hydration, fatigue, and sensor
                error can still affect HR. A lower value alone does not
                establish improved fitness.
              </Typography>
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
