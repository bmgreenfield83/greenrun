import RefreshRounded from "@mui/icons-material/RefreshRounded";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material/Select";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "wouter";

import {
  getAnalytics,
  recalculateHeartRateResponse,
  type AnalyticsSummary,
} from "../api/analytics";
import { duration } from "../features/activities/format";
import { durationWeightedTrend } from "../features/analytics/driftTrend";
import { WorkloadTrendCard } from "../features/analytics/WorkloadTrendCard";

function ConfidenceDot({
  cx = 0,
  cy = 0,
  payload,
}: {
  cx?: number;
  cy?: number;
  payload?: { confidence?: "low" | "moderate" | "high" | null };
}) {
  const confidence = payload?.confidence;
  const radius = confidence === "high" ? 8 : confidence === "moderate" ? 6 : 4;
  const opacity =
    confidence === "high" ? 0.95 : confidence === "moderate" ? 0.7 : 0.45;
  return <circle cx={cx} cy={cy} r={radius} fill="#1976d2" opacity={opacity} />;
}

export function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedResponseCategories, setSelectedResponseCategories] = useState<
    string[] | null
  >(null);
  const load = () =>
    getAnalytics()
      .then(setData)
      .catch((reason: Error) => setError(reason.message));
  useEffect(() => {
    void load();
  }, []);
  if (error && !data) return <Alert severity="error">{error}</Alert>;
  if (!data) return <Typography>Loading analytics…</Typography>;
  const progress = data.plan_progress;
  const percent = progress?.planned_miles
    ? Math.min(100, (progress.completed_miles / progress.planned_miles) * 100)
    : 0;
  const categories = [
    ...new Set(
      data.heart_rate_response_history.map(
        (item) => item.category ?? "uncategorized",
      ),
    ),
  ].sort();
  const activeResponseCategories = selectedResponseCategories ?? categories;
  const filteredDrift = data.heart_rate_response_history
    .filter((item) =>
      activeResponseCategories.includes(item.category ?? "uncategorized"),
    )
    .sort((left, right) => left.local_date.localeCompare(right.local_date));
  const driftTrend = durationWeightedTrend(filteredDrift);
  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        gap={2}
      >
        <div>
          <Typography variant="h4">Analytics</Typography>
          <Typography color="text.secondary">
            Transparent summaries based on recorded activities and plan
            relationships.
          </Typography>
        </div>
        <Button
          startIcon={<RefreshRounded />}
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void recalculateHeartRateResponse()
              .then(load)
              .catch((reason: Error) => setError(reason.message))
              .finally(() => setBusy(false));
          }}
        >
          Recalculate HR response
        </Button>
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
      <WorkloadTrendCard />
      <Grid container spacing={2}>
        {[
          ["Rolling 7 days", data.rolling_7_day_miles],
          ["Rolling 28 days", data.rolling_28_day_miles],
          ["Rolling 90 days", data.rolling_90_day_miles],
        ].map(([label, miles]) => (
          <Grid size={{ xs: 12, sm: 4 }} key={String(label)}>
            <Card
              variant="outlined"
              sx={{
                height: "100%",
                background:
                  "linear-gradient(145deg, #ffffff 35%, rgba(23,74,91,.075))",
              }}
            >
              <CardContent sx={{ position: "relative" }}>
                <Typography
                  variant="overline"
                  color="text.secondary"
                  sx={{ fontWeight: 800, letterSpacing: ".09em" }}
                >
                  {label}
                </Typography>
                <Typography
                  variant="h4"
                  sx={{ mt: 0.5, color: "primary.dark" }}
                >
                  {Number(miles).toFixed(1)} mi
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Weekly running mileage
          </Typography>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.weekly_mileage}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week_start" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="miles" fill="#1976d2" name="Miles" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      {progress && (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1}>
              <Typography variant="h5">{progress.plan_name}</Typography>
              <Typography>
                {progress.completed_miles.toFixed(1)} of{" "}
                {progress.planned_miles.toFixed(1)} planned miles
              </Typography>
              <LinearProgress variant="determinate" value={percent} />
              <Typography color="text.secondary">
                {progress.completed_sessions}/{progress.total_sessions} sessions
                completed · {progress.skipped_sessions} skipped ·{" "}
                {progress.rescheduled_sessions} rescheduled
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      )}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h5" gutterBottom>
                Personal bests
              </Typography>
              <Stack divider={<Divider flexItem />}>
                {data.personal_bests.map((best) => {
                  const content = (
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      width="100%"
                      sx={{ py: 1.25 }}
                    >
                      <div>
                        <Typography fontWeight={750}>{best.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {best.local_date}
                        </Typography>
                      </div>
                      <Typography variant="h6" color="primary.dark">
                        {best.value}
                      </Typography>
                    </Stack>
                  );
                  return best.activity_id ? (
                    <Button
                      component={Link}
                      href={`/activities/${best.activity_id}`}
                      key={best.label}
                      sx={{ p: 0, color: "text.primary", textAlign: "left" }}
                    >
                      {content}
                    </Button>
                  ) : (
                    <Box key={best.label}>{content}</Box>
                  );
                })}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h5" gutterBottom>
                Temperature bands
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Observed conditions are context only. Differences may also
                reflect route, workout type, fitness, wind, and other factors.
              </Typography>
              <Stack spacing={1}>
                {data.temperature_bands.length === 0 ? (
                  <Typography color="text.secondary">
                    No recorded temperature data is available for these
                    activities.
                  </Typography>
                ) : (
                  data.temperature_bands.map((band) => (
                    <Box
                      key={band.label}
                      sx={{ p: 1.5, borderRadius: 2, bgcolor: "action.hover" }}
                    >
                      <Typography fontWeight={750}>{band.label}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {band.activity_count} runs
                        {band.average_pace_seconds_per_mile
                          ? ` | ${duration(band.average_pace_seconds_per_mile)}/mi average`
                          : ""}
                      </Typography>
                    </Box>
                  ))
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      <Card variant="outlined">
        <CardContent>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            gap={2}
          >
            <div>
              <Typography variant="h5" gutterBottom>
                Workload-adjusted heart-rate response
              </Typography>
              <Typography color="text.secondary">
                Estimated heart-rate change after accounting for recorded speed
                and grade. Weather, hydration, wind, fatigue, and sensor error
                remain possible influences.
              </Typography>
            </div>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="response-category-label">
                Run categories
              </InputLabel>
              <Select<string[]>
                labelId="response-category-label"
                multiple
                value={activeResponseCategories}
                onChange={(event: SelectChangeEvent<string[]>) => {
                  const value = event.target.value;
                  setSelectedResponseCategories(
                    typeof value === "string" ? value.split(",") : value,
                  );
                }}
                input={<OutlinedInput label="Run categories" />}
                renderValue={(selected) => {
                  if (selected.length === categories.length) {
                    return "All categories";
                  }
                  if (selected.length === 0) return "No categories";
                  return selected
                    .map((category) => category.replaceAll("_", " "))
                    .join(", ");
                }}
              >
                {categories.map((category) => {
                  const label = category.replaceAll("_", " ");
                  return (
                    <MenuItem key={category} value={category}>
                      <Checkbox
                        checked={activeResponseCategories.includes(category)}
                        inputProps={{ "aria-label": label }}
                      />
                      <ListItemText primary={label} />
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
          </Stack>
          {filteredDrift.length > 1 && (
            <Box sx={{ mt: 2 }}>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart
                  data={driftTrend}
                  margin={{ left: 8, right: 18, top: 12, bottom: 12 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="local_date" type="category" name="Date" />
                  <YAxis
                    dataKey="adjusted_change_bpm_per_hour"
                    name="Adjusted HR change"
                    unit=" bpm/hr"
                    domain={["auto", "auto"]}
                  />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                  <Line
                    dataKey="trend"
                    name="Duration-weighted trend"
                    stroke="#ed6c02"
                    strokeWidth={2.5}
                    dot={false}
                    connectNulls={false}
                  />
                  <Scatter fill="#1976d2" shape={<ConfidenceDot />} />
                </ComposedChart>
              </ResponsiveContainer>
              <Typography variant="caption" color="text.secondary">
                Point size and opacity indicate confidence; larger, darker
                points have more usable duration.
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
              >
                {filteredDrift.length >= 4
                  ? "The orange line is a duration-weighted linear trend; usable duration is capped at 55 minutes so one long run cannot dominate."
                  : "Four qualifying runs are required before a duration-weighted trend is shown."}
              </Typography>
            </Box>
          )}
          <Stack
            spacing={1}
            sx={{ maxHeight: 360, overflowY: "auto", pr: 0.5 }}
          >
            {filteredDrift.length === 0 && (
              <Typography color="text.secondary">
                No qualifying heart-rate response results match these
                categories.
              </Typography>
            )}
            {[...filteredDrift]
              .sort((left, right) =>
                right.local_date.localeCompare(left.local_date),
              )
              .map((result) => (
                <Button
                  component={Link}
                  href={`/activities/${result.activity_id}`}
                  key={result.activity_id}
                  sx={{
                    justifyContent: "flex-start",
                    p: 1.5,
                    border: 1,
                    borderColor: "divider",
                    bgcolor: "background.paper",
                    color: "text.primary",
                    "&:hover": { bgcolor: "primary.light" },
                  }}
                >
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    spacing={2}
                    width="100%"
                  >
                    <Typography variant="body2" color="text.secondary">
                      {result.local_date}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="h6" color="primary.dark">
                        {result.adjusted_change_bpm_per_hour?.toFixed(1)} bpm/hr
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontWeight: 800, letterSpacing: ".06em" }}
                      >
                        ADJUSTED
                      </Typography>
                      {result.confidence && (
                        <Chip
                          size="small"
                          label={`${result.confidence} confidence`}
                          color={
                            result.confidence === "high"
                              ? "success"
                              : result.confidence === "moderate"
                                ? "warning"
                                : "default"
                          }
                          variant="outlined"
                        />
                      )}
                    </Stack>
                  </Stack>
                </Button>
              ))}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
