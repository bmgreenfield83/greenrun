import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import DownloadRounded from "@mui/icons-material/DownloadRounded";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Grid,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";

import {
  deleteActivity,
  getActivity,
  getActivitySamples,
  getPlannedSession,
  updateActivity,
  type Activity,
  type ActivitySample,
} from "../api/activities";
import {
  getComparableRuns,
  getSameWeekdayRuns,
  recalculateActivityHeartRateResponse,
  type ComparableRun,
  type HeartRateResponseResult,
  type SameWeekdayRun,
} from "../api/analytics";
import { PageHeader } from "../components/common/PageHeader";
import { SectionTitle } from "../components/common/SectionTitle";
import { ActivityCharts } from "../features/activities/ActivityCharts";
import { clearActivityListState } from "../features/activities/activityListState";
import {
  activityType,
  duration,
  localDateLabel,
  metersToMiles,
  pace,
  speed,
} from "../features/activities/format";
import { LapTable } from "../features/activities/LapTable";
import { TrackGoalSection } from "../features/activities/TrackGoalSection";
import {
  analysisRangesOf,
  CURRENT_HEART_RATE_RESPONSE_VERSION,
  intervalOf,
  isStale,
} from "../features/analytics/heartRateResponse";
import { SameWeekdayTrendChart } from "../features/activities/SameWeekdayTrendChart";
import { exportActivity } from "../api/exports";

const value = (input: number | null | undefined, suffix = "") =>
  input == null ? "—" : `${input}${suffix}`;

export function ActivityDetailPage({ activityId }: { activityId: string }) {
  const [, setLocation] = useLocation();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [plannedSession, setPlannedSession] = useState<{
    title: string;
    scheduled_date: string;
  } | null>(null);
  const [samples, setSamples] = useState<ActivitySample[]>([]);
  const [comparableRuns, setComparableRuns] = useState<ComparableRun[]>([]);
  const [sameWeekdayRuns, setSameWeekdayRuns] = useState<SameWeekdayRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [effort, setEffort] = useState("");
  const [feel, setFeel] = useState("");
  const [sleepScore, setSleepScore] = useState("");
  const [sleepLabel, setSleepLabel] = useState("");
  const [pain, setPain] = useState("");
  const [notes, setNotes] = useState("");
  const [weather, setWeather] = useState("");
  const [analysisStartMiles, setAnalysisStartMiles] = useState("");
  useEffect(() => {
    void Promise.all([getActivity(activityId), getActivitySamples(activityId)])
      .then(([item, points]) => {
        setActivity(item);
        setSamples(points);
        if (item.planned_session_id) {
          void getPlannedSession(item.planned_session_id)
            .then(setPlannedSession)
            .catch((reason: Error) => setError(reason.message));
        }
        setEffort(item.subjective.effort?.toString() ?? "");
        setFeel(item.subjective.feel ?? "");
        setSleepScore(item.subjective.sleep_score?.toString() ?? "");
        setSleepLabel(item.subjective.sleep_label ?? "");
        setPain(item.subjective.pain_soreness_notes ?? "");
        setNotes(item.subjective.notes ?? "");
        setWeather(item.weather_notes ?? "");
        setAnalysisStartMiles(
          item.heart_rate_analysis_start_distance_meters == null
            ? ""
            : (
                item.heart_rate_analysis_start_distance_meters / 1609.344
              ).toString(),
        );
      })
      .catch((reason: Error) => setError(reason.message));
    void getComparableRuns(activityId)
      .then(setComparableRuns)
      .catch(() => undefined);
    void getSameWeekdayRuns(activityId)
      .then(setSameWeekdayRuns)
      .catch(() => undefined);
  }, [activityId]);
  const save = async () => {
    if (!activity) return;
    setBusy(true);
    try {
      const updated = await updateActivity(activity.id, {
        subjective: {
          effort: effort ? Number(effort) : null,
          feel: feel || null,
          sleep_score: sleepScore ? Number(sleepScore) : null,
          sleep_label: sleepLabel || null,
          pain_soreness_notes: pain || null,
          notes: notes || null,
        },
        weather_notes: weather || null,
      });
      setActivity(updated);
      setEditing(false);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Changes could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  };
  const saveHeartRateAnalysisStart = async () => {
    if (!activity) return;
    setBusy(true);
    try {
      await updateActivity(activity.id, {
        heart_rate_analysis_start_distance_meters: analysisStartMiles
          ? Number(analysisStartMiles) * 1609.344
          : null,
      });
      await recalculateActivityHeartRateResponse(activity.id);
      setActivity(await getActivity(activity.id));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The heart-rate analysis start could not be updated.",
      );
    } finally {
      setBusy(false);
    }
  };
  if (error && !activity) return <Alert severity="error">{error}</Alert>;
  if (!activity)
    return (
      <Stack spacing={3} aria-busy="true">
        <Typography role="status" color="text.secondary">
          Loading activity…
        </Typography>
        <Skeleton variant="rounded" height={48} width="45%" />
        <Skeleton variant="rounded" height={180} />
        <Skeleton variant="rounded" height={140} />
      </Stack>
    );
  const summary = activity.summary;
  const heartRateResponse = activity.derived_metrics.heart_rate_response as
    | Omit<
        HeartRateResponseResult,
        "activity_id" | "activity_title" | "local_date"
      >
    | undefined;
  const responseInterval = heartRateResponse
    ? intervalOf(heartRateResponse)
    : null;
  const otherDerivedMetrics = Object.entries(activity.derived_metrics).filter(
    ([key]) => key !== "heart_rate_response" && key !== "heart_rate_drift",
  );
  const usesPace = ["run", "walk", "hike"].includes(activity.sport);
  const supportsRate = activity.sport !== "strength";
  const stats = [
    ["Distance", metersToMiles(activity.distance_meters)],
    ["Moving time", duration(activity.moving_time_seconds)],
    ["Elapsed time", duration(activity.elapsed_time_seconds)],
    ...(supportsRate
      ? [
          [
            usesPace ? "Average pace" : "Average speed",
            usesPace
              ? pace(summary.average_speed_mps ?? null)
              : speed(summary.average_speed_mps ?? null),
          ],
        ]
      : []),
    [
      "Heart rate",
      summary.average_heart_rate
        ? `${summary.average_heart_rate.toFixed(0)} avg / ${value(summary.maximum_heart_rate)} max bpm`
        : "—",
    ],
    ...(activity.sport !== "strength"
      ? [
          [
            `Cadence (${activity.sport === "bike" ? "RPM" : "SPM"})`,
            value(summary.average_cadence_spm, ""),
          ],
        ]
      : []),
    [
      "Elevation gain",
      summary.elevation_gain_meters == null
        ? "—"
        : `${(summary.elevation_gain_meters * 3.28084).toFixed(0)} ft`,
    ],
    ["Calories", value(summary.calories)],
    [
      "Temperature",
      summary.temperature_celsius == null
        ? "—"
        : `${((summary.temperature_celsius * 9) / 5 + 32).toFixed(0)}°F`,
    ],
    ["Humidity", value(summary.humidity_percent, "%")],
    ["Source", activity.source.type],
    [
      "Planned session",
      plannedSession
        ? plannedSession.title
        : activity.planned_session_id
          ? "Linked"
          : "Unplanned",
    ],
  ];
  return (
    <Stack spacing={3}>
      <PageHeader
        title={activity.title || activityType(activity)}
        description={`${localDateLabel(activity.local_date, {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })} · ${activityType(activity)}`}
        actions={
          <>
            <Button
              variant="outlined"
              startIcon={<DownloadRounded />}
              onClick={() =>
                void exportActivity(activity.id).catch((reason: Error) =>
                  setError(reason.message),
                )
              }
            >
              Export
            </Button>
            <Button
              color="error"
              startIcon={<DeleteOutlineRounded />}
              onClick={() => {
                if (window.confirm("Delete this activity?"))
                  void deleteActivity(activity.id)
                    .then(() => {
                      clearActivityListState();
                      setLocation("/activities");
                    })
                    .catch((reason: Error) => setError(reason.message));
              }}
            >
              Delete
            </Button>
          </>
        }
      />
      {error && <Alert severity="error">{error}</Alert>}
      <Card
        variant="outlined"
        sx={{
          background: "linear-gradient(145deg, #fff 55%, rgba(23,74,91,.055))",
        }}
      >
        <CardContent>
          <Grid container rowSpacing={2.5} columnSpacing={2}>
            {stats.map(([label, display]) => (
              <Grid size={{ xs: 6, md: 3 }} key={label}>
                <Typography
                  variant="overline"
                  color="text.secondary"
                  component="p"
                >
                  {label}
                </Typography>
                {label === "Planned session" && plannedSession ? (
                  <Stack alignItems="flex-start" spacing={0.25}>
                    <Button
                      component={Link}
                      href={`/calendar?date=${plannedSession.scheduled_date}`}
                      size="small"
                      sx={{ justifyContent: "flex-start", p: 0 }}
                    >
                      {display}
                    </Button>
                    <Typography variant="caption" color="text.secondary">
                      {plannedSession.scheduled_date}
                    </Typography>
                  </Stack>
                ) : (
                  <Typography
                    fontWeight={700}
                    sx={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {display}
                  </Typography>
                )}
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <SectionTitle
              action={
                <Button onClick={() => setEditing(!editing)}>
                  {editing ? "Cancel" : "Edit"}
                </Button>
              }
            >
              How it felt
            </SectionTitle>
            {editing ? (
              <Grid container spacing={2}>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Effort (0–10)"
                    value={effort}
                    onChange={(e) => setEffort(e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <TextField
                    fullWidth
                    label="Feel"
                    value={feel}
                    onChange={(e) => setFeel(e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Sleep score"
                    value={sleepScore}
                    onChange={(e) => setSleepScore(e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <TextField
                    select
                    fullWidth
                    label="Sleep"
                    value={sleepLabel}
                    onChange={(e) => setSleepLabel(e.target.value)}
                  >
                    <MenuItem value="">Not set</MenuItem>
                    {["poor", "fair", "good", "great"].map((v) => (
                      <MenuItem key={v} value={v}>
                        {v}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={12}>
                  <TextField
                    fullWidth
                    multiline
                    label="Pain / soreness"
                    value={pain}
                    onChange={(e) => setPain(e.target.value)}
                  />
                </Grid>
                <Grid size={12}>
                  <TextField
                    fullWidth
                    multiline
                    label="Notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </Grid>
                <Grid size={12}>
                  <TextField
                    fullWidth
                    multiline
                    label="Weather notes"
                    value={weather}
                    onChange={(e) => setWeather(e.target.value)}
                  />
                </Grid>
                <Grid size={12}>
                  <Button
                    variant="contained"
                    disabled={busy}
                    onClick={() => void save()}
                  >
                    Save notes
                  </Button>
                </Grid>
              </Grid>
            ) : (
              <Grid container spacing={2}>
                {[
                  ["Effort", activity.subjective.effort],
                  ["Feel", activity.subjective.feel],
                  [
                    "Sleep",
                    activity.subjective.sleep_score
                      ? `${activity.subjective.sleep_score} · ${activity.subjective.sleep_label ?? ""}`
                      : activity.subjective.sleep_label,
                  ],
                  ["Pain / soreness", activity.subjective.pain_soreness_notes],
                  ["Notes", activity.subjective.notes],
                  ["Weather", activity.weather_notes],
                ].map(([label, display]) => (
                  <Grid size={{ xs: 12, sm: 6 }} key={String(label)}>
                    <Typography
                      variant="overline"
                      color="text.secondary"
                      component="p"
                    >
                      {label}
                    </Typography>
                    <Typography sx={{ whiteSpace: "pre-wrap" }}>
                      {display || "—"}
                    </Typography>
                  </Grid>
                ))}
              </Grid>
            )}
          </Stack>
        </CardContent>
      </Card>
      <LapTable laps={activity.laps} sport={activity.sport} />
      <TrackGoalSection activity={activity} />
      {heartRateResponse && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h5" component="h2" gutterBottom>
              Workload-adjusted heart-rate response
            </Typography>
            <Typography
              sx={{
                fontSize: "1.25rem",
                fontWeight: 750,
                color: "primary.dark",
              }}
            >
              {heartRateResponse.eligible &&
              heartRateResponse.adjusted_change_bpm_per_hour != null
                ? `${heartRateResponse.adjusted_change_bpm_per_hour.toFixed(1)} bpm/hour`
                : `Not eligible${heartRateResponse.exclusion_reason ? `: ${heartRateResponse.exclusion_reason}` : ""}`}
            </Typography>
            {heartRateResponse.eligible && (
              <Typography variant="body2" color="text.secondary">
                {responseInterval
                  ? `90% interval: ${responseInterval[0].toFixed(1)} to ${responseInterval[1].toFixed(1)} bpm/hour (within-run noise only; treat as a lower bound on uncertainty)`
                  : "No 90% interval: this result predates algorithm version 4."}
              </Typography>
            )}
            {heartRateResponse.eligible && (
              <Grid container spacing={2} sx={{ my: 1 }}>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Typography variant="caption" color="text.secondary">
                    Total adjusted change
                  </Typography>
                  <Typography fontWeight={700}>
                    {heartRateResponse.adjusted_total_change_bpm?.toFixed(1) ??
                      "—"}{" "}
                    bpm
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Typography variant="caption" color="text.secondary">
                    Model fit
                  </Typography>
                  <Typography fontWeight={700}>
                    R² {heartRateResponse.r_squared?.toFixed(2) ?? "—"}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Typography variant="caption" color="text.secondary">
                    Typical error
                  </Typography>
                  <Typography fontWeight={700}>
                    {heartRateResponse.rmse_bpm?.toFixed(1) ?? "—"} bpm
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Typography variant="caption" color="text.secondary">
                    HR response time
                  </Typography>
                  <Typography fontWeight={700}>
                    {heartRateResponse.response_time_constant_seconds == null
                      ? "Not identifiable"
                      : `${heartRateResponse.response_time_constant_seconds} sec`}
                  </Typography>
                </Grid>
              </Grid>
            )}
            <Typography variant="caption" color="text.secondary">
              {heartRateResponse.confidence
                ? `${heartRateResponse.confidence} confidence | `
                : ""}
              {heartRateResponse.usable_duration_seconds != null
                ? `${Math.round(heartRateResponse.usable_duration_seconds / 60)} min usable | `
                : ""}
              {heartRateResponse.stop_count
                ? `${heartRateResponse.stop_count} stop${heartRateResponse.stop_count === 1 ? "" : "s"} (${Math.round((heartRateResponse.stopped_duration_seconds ?? 0) / 60)} min) | `
                : ""}
              Algorithm version {heartRateResponse.algorithm_version}
            </Typography>
            {isStale(
              heartRateResponse,
              CURRENT_HEART_RATE_RESPONSE_VERSION,
            ) && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                This result uses an older algorithm (version{" "}
                {heartRateResponse.algorithm_version}). Use{" "}
                <strong>Apply and recalculate</strong> below, or Recalculate HR
                response on the Analytics page, to update it.
              </Alert>
            )}
            {heartRateResponse.interpretation && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {heartRateResponse.interpretation}
              </Typography>
            )}
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              alignItems={{ sm: "flex-start" }}
              sx={{ mt: 2 }}
            >
              <TextField
                type="number"
                size="small"
                label="Ignore HR analysis before mile"
                value={analysisStartMiles}
                onChange={(event) => setAnalysisStartMiles(event.target.value)}
                slotProps={{ htmlInput: { min: 0, step: 0.1 } }}
                helperText="Leaves the FIT data intact and only changes this analysis."
                sx={{ minWidth: { sm: 280 } }}
              />
              <Button
                variant="outlined"
                disabled={busy}
                onClick={() => void saveHeartRateAnalysisStart()}
              >
                Apply and recalculate
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}
      {comparableRuns.length > 0 && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h5" component="h2" gutterBottom>
              Comparable runs
            </Typography>
            <Typography color="text.secondary" gutterBottom>
              Runs with the same category and distance within 15%.
            </Typography>
            <Stack spacing={1}>
              {comparableRuns.map((run) => (
                <Button
                  component={Link}
                  href={`/activities/${run.activity_id}`}
                  key={run.activity_id}
                  variant="outlined"
                  sx={{
                    justifyContent: "flex-start",
                    textTransform: "none",
                    p: 1.5,
                  }}
                >
                  <Stack width="100%" spacing={0.5} alignItems="flex-start">
                    <Typography fontWeight={800}>
                      {localDateLabel(run.local_date)}
                    </Typography>
                    <Stack direction="row" spacing={2} flexWrap="wrap">
                      <Typography>
                        {run.distance_miles.toFixed(2)} mi
                      </Typography>
                      <Typography>
                        {run.pace_seconds_per_mile
                          ? `${duration(run.pace_seconds_per_mile)}/mi`
                          : "Pace not recorded"}
                      </Typography>
                      <Typography>
                        {run.average_heart_rate
                          ? `${run.average_heart_rate} bpm`
                          : "Heart rate not recorded"}
                      </Typography>
                      {run.temperature_fahrenheit != null && (
                        <Typography>
                          {run.temperature_fahrenheit.toFixed(0)}°F
                        </Typography>
                      )}
                      {run.humidity_percent != null && (
                        <Typography>
                          {run.humidity_percent.toFixed(0)}% humidity
                        </Typography>
                      )}
                    </Stack>
                  </Stack>
                </Button>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}
      {activity.sport === "run" && sameWeekdayRuns.length > 0 && (
        <SameWeekdayTrendChart
          runs={sameWeekdayRuns}
          onSelectActivity={(selectedActivityId) =>
            setLocation(`/activities/${selectedActivityId}`)
          }
        />
      )}
      {otherDerivedMetrics.length > 0 && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h5" component="h2" gutterBottom>
              Derived metrics
            </Typography>
            <Grid container spacing={2}>
              {otherDerivedMetrics.map(([label, display]) => (
                <Grid size={{ xs: 12, sm: 6 }} key={label}>
                  <Typography variant="caption" color="text.secondary">
                    {label.replaceAll("_", " ")}
                  </Typography>
                  <Typography>{String(display ?? "—")}</Typography>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}
      <ActivityCharts
        samples={samples}
        sport={activity.sport}
        analysisRanges={
          heartRateResponse ? analysisRangesOf(heartRateResponse) : undefined
        }
      />
    </Stack>
  );
}
