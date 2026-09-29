import FavoriteRounded from "@mui/icons-material/FavoriteRounded";
import DirectionsRunRounded from "@mui/icons-material/DirectionsRunRounded";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Grid,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { listActivities, type Activity } from "../api/activities";
import {
  getAnalytics,
  getGoalProgress,
  getHeartRateZones,
  type AnalyticsSummary,
  type GoalProgress,
  type HeartRateZoneAnalytics,
} from "../api/analytics";
import { fetchCalendar, type CalendarEvent } from "../api/calendar";
import { listPlans, listPlanSessions, type PlannedSession } from "../api/plans";
import { LinkRow } from "../components/common/LinkRow";
import { SectionTitle } from "../components/common/SectionTitle";
import {
  activityType,
  duration,
  localDateLabel,
  metersToMiles,
} from "../features/activities/format";
import {
  isStale,
  newestResults,
} from "../features/analytics/heartRateResponse";
import {
  isoDate,
  nextDate,
  summarizeWeek,
  todayPlan,
  weekDates,
} from "../features/dashboard/dashboardDates";
import { GoalGlance } from "../features/dashboard/GoalGlance";
import { LoadGlance } from "../features/dashboard/LoadGlance";
import { TodayCard } from "../features/dashboard/TodayCard";
import { TrainingSnapshot } from "../features/dashboard/TrainingSnapshot";
import { WeekStrip } from "../features/dashboard/WeekStrip";
import { SystemStatusCard } from "../features/health/SystemStatusCard";

const visuallyHidden = {
  position: "absolute",
  width: "1px",
  height: "1px",
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
} as const;

const shortDate = (date: string) =>
  localDateLabel(date, { weekday: "short", month: "short", day: "numeric" });

export function DashboardPage() {
  const today = useMemo(() => isoDate(new Date()), []);
  const week = useMemo(() => weekDates(new Date()), []);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  // null = no active plan; undefined = still loading.
  const [sessions, setSessions] = useState<PlannedSession[] | null>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [weekEvents, setWeekEvents] = useState<CalendarEvent[] | null>(null);
  const [goal, setGoal] = useState<GoalProgress | null>(null);
  const [goalLoading, setGoalLoading] = useState(true);
  const [zones, setZones] = useState<HeartRateZoneAnalytics | null>(null);
  const [zonesLoading, setZonesLoading] = useState(true);

  useEffect(() => {
    void Promise.all([
      getAnalytics(),
      listActivities({ limit: 5, sport: "run" }),
      listPlans(),
    ])
      .then(async ([summary, recent, plans]) => {
        setAnalytics(summary);
        setActivities(recent.items);
        const active = plans.find((plan) => plan.status === "active");
        setSessions(active ? await listPlanSessions(active.id) : null);
      })
      .catch((reason: Error) => {
        setError(reason.message);
        setSessions(null);
      })
      .finally(() => setLoading(false));

    // Secondary panels load independently; a failure only hides that panel's data.
    void fetchCalendar(week[0], nextDate(week[6]))
      .then(setWeekEvents)
      .catch(() => setWeekEvents([]));
    void getGoalProgress()
      .then(setGoal)
      .catch(() => setGoal(null))
      .finally(() => setGoalLoading(false));
    void getHeartRateZones()
      .then(setZones)
      .catch(() => setZones(null))
      .finally(() => setZonesLoading(false));
  }, [week]);

  // History is oldest first; show the newest results.
  const drift = newestResults(analytics?.heart_rate_response_history ?? [], 4);
  const days = weekEvents ? summarizeWeek(weekEvents, week, today) : null;
  const plan = sessions === undefined ? null : todayPlan(sessions, today);

  return (
    <Stack spacing={{ xs: 2, sm: 3 }}>
      <Typography component="h1" sx={visuallyHidden}>
        Dashboard
      </Typography>
      {error && <Alert severity="warning">{error}</Alert>}

      <Grid container spacing={{ xs: 2, sm: 3 }}>
        <Grid size={{ xs: 12, md: 7, lg: 8 }}>
          <TodayCard
            plan={plan}
            progress={analytics?.plan_progress}
            today={today}
            loading={loading}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 5, lg: 4 }}>
          <Stack spacing={{ xs: 2, sm: 3 }} sx={{ height: "100%" }}>
            <Box sx={{ flex: 1 }}>
              <GoalGlance goal={goal} loading={goalLoading} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <LoadGlance zones={zones} loading={zonesLoading} />
            </Box>
          </Stack>
        </Grid>
      </Grid>

      <Card component="section" aria-label="This week">
        <CardContent>
          <Stack spacing={2}>
            <SectionTitle>This week</SectionTitle>
            <WeekStrip days={days} />
            {(loading || analytics) && (
              <TrainingSnapshot analytics={analytics} loading={loading} />
            )}
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={{ xs: 2, sm: 3 }}>
        <Grid size={{ xs: 12, md: 6, lg: 5 }}>
          <DashboardListCard
            title="Recent runs"
            icon={<DirectionsRunRounded color="primary" />}
            loading={loading}
            empty="No completed runs yet."
          >
            {activities.map((activity) => (
              <LinkRow
                href={`/activities/${activity.id}`}
                key={activity.id}
                primary={activityType(activity)}
                secondary={shortDate(activity.local_date)}
                trailing={`${metersToMiles(activity.distance_meters)} · ${duration(
                  activity.moving_time_seconds ?? activity.elapsed_time_seconds,
                )}`}
              />
            ))}
          </DashboardListCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <DashboardListCard
            title="Recent adjusted HR response"
            icon={<FavoriteRounded color="error" />}
            loading={loading}
            empty="No qualifying heart-rate response results yet."
          >
            {drift.map((result) => (
              <LinkRow
                href={`/activities/${result.activity_id}`}
                key={result.activity_id}
                primary={shortDate(result.local_date)}
                secondary={
                  [
                    result.confidence && `${result.confidence} confidence`,
                    analytics &&
                      isStale(
                        result,
                        analytics.heart_rate_response_algorithm_version,
                      ) &&
                      "needs recalculation",
                  ]
                    .filter(Boolean)
                    .join(" · ") || undefined
                }
                trailing={`${result.adjusted_change_bpm_per_hour?.toFixed(1) ?? "—"} bpm/hr`}
              />
            ))}
          </DashboardListCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 3 }}>
          <SystemStatusCard />
        </Grid>
      </Grid>
    </Stack>
  );
}

function DashboardListCard({
  title,
  icon,
  loading,
  empty,
  children,
}: {
  title: string;
  icon: ReactNode;
  loading: boolean;
  empty: string;
  children: ReactNode[];
}) {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Stack spacing={1}>
          <SectionTitle icon={icon}>{title}</SectionTitle>
          {loading ? (
            <Stack spacing={1} aria-busy="true" aria-label={`Loading ${title}`}>
              {[0, 1, 2].map((key) => (
                <Skeleton key={key} variant="rounded" height={44} />
              ))}
            </Stack>
          ) : children.length ? (
            <Stack sx={{ mx: -1.5 }}>{children}</Stack>
          ) : (
            <Typography color="text.secondary">{empty}</Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
