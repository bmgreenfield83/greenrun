import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import EventRounded from "@mui/icons-material/EventRounded";
import TrendingUpRounded from "@mui/icons-material/TrendingUpRounded";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Grid,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { Link } from "wouter";

import { listActivities, type Activity } from "../api/activities";
import { getAnalytics, type AnalyticsSummary } from "../api/analytics";
import { listPlans, listPlanSessions, type PlannedSession } from "../api/plans";
import { duration, metersToMiles } from "../features/activities/format";
import { SystemStatusCard } from "../features/health/SystemStatusCard";

const today = () => {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
};

const upcomingDate = (date: string) => {
  if (date === today()) return "Today";
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(year, month - 1, day));
};

export function DashboardPage() {
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [upcoming, setUpcoming] = useState<PlannedSession[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      getAnalytics(),
      listActivities({ limit: 5 }),
      listPlans(),
    ])
      .then(async ([summary, recent, plans]) => {
        setAnalytics(summary);
        setActivities(recent.items);
        const active = plans.find((plan) => plan.status === "active");
        if (active) {
          const sessions = await listPlanSessions(active.id);
          setUpcoming(
            sessions
              .filter(
                (session) =>
                  session.scheduled_date >= today() &&
                  !session.status.startsWith("completed") &&
                  session.status !== "skipped",
              )
              .slice(0, 5),
          );
        }
      })
      .catch((reason: Error) => setError(reason.message));
  }, []);

  const plan = analytics?.plan_progress;
  const weekPercent = plan?.current_week_planned_miles
    ? Math.min(
        100,
        (plan.current_week_completed_miles / plan.current_week_planned_miles) *
          100,
      )
    : 0;
  const drift = analytics?.heart_rate_response_history?.slice(0, 4) ?? [];

  return (
    <Stack spacing={4}>
      <div>
        <Typography variant="h4" gutterBottom>
          Your training, clearly tracked.
        </Typography>
        <Typography color="text.secondary">
          Your current week, upcoming workouts, and recent training at a glance.
        </Typography>
      </div>
      {error && <Alert severity="warning">{error}</Alert>}

      <Grid container spacing={2}>
        {analytics &&
          [
            ["Last 7 days", analytics.rolling_7_day_miles],
            ["Last 28 days", analytics.rolling_28_day_miles],
            ["Last 90 days", analytics.rolling_90_day_miles],
          ].map(([label, miles]) => (
            <Grid size={{ xs: 12, sm: 4 }} key={String(label)}>
              <Card variant="outlined" sx={{ height: "100%" }}>
                <CardContent>
                  <Typography variant="overline" color="text.secondary">
                    {label}
                  </Typography>
                  <Typography variant="h4" color="primary.dark">
                    {Number(miles).toFixed(1)} mi
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
      </Grid>

      {plan && (
        <Card
          variant="outlined"
          sx={{ borderLeft: 5, borderLeftColor: "secondary.main" }}
        >
          <CardContent>
            <Stack spacing={1.25}>
              <Typography variant="overline" color="text.secondary">
                Current week
              </Typography>
              <Typography variant="h5">{plan.plan_name}</Typography>
              <Typography>
                {plan.current_week_completed_miles.toFixed(1)} of{" "}
                {plan.current_week_planned_miles.toFixed(1)} planned miles
              </Typography>
              <LinearProgress
                variant="determinate"
                value={weekPercent}
                sx={{ height: 9, borderRadius: 5 }}
              />
              <Typography variant="body2" color="text.secondary">
                {plan.completed_sessions} of {plan.total_sessions} plan sessions
                completed overall
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <EventRounded color="primary" />
                  <Typography variant="h5">Upcoming workouts</Typography>
                </Stack>
                {upcoming.length ? (
                  upcoming.map((session) => (
                    <Button
                      component={Link}
                      href={`/calendar?date=${session.scheduled_date}`}
                      key={session.id}
                      sx={{
                        justifyContent: "space-between",
                        textTransform: "none",
                      }}
                    >
                      <span>{session.title}</span>
                      <span>{upcomingDate(session.scheduled_date)}</span>
                    </Button>
                  ))
                ) : (
                  <Typography color="text.secondary">
                    No upcoming planned workouts.
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <CheckCircleRounded color="success" />
                  <Typography variant="h5">Recent activities</Typography>
                </Stack>
                {activities.length ? (
                  activities.map((activity) => (
                    <Button
                      component={Link}
                      href={`/activities/${activity.id}`}
                      key={activity.id}
                      sx={{
                        justifyContent: "space-between",
                        textTransform: "none",
                      }}
                    >
                      <span>
                        {activity.category
                          ? `${activity.category.replaceAll("_", " ")} run`
                          : activity.sport}
                      </span>
                      <span>
                        {metersToMiles(activity.distance_meters)} ·{" "}
                        {duration(
                          activity.moving_time_seconds ??
                            activity.elapsed_time_seconds,
                        )}
                      </span>
                    </Button>
                  ))
                ) : (
                  <Typography color="text.secondary">
                    No completed activities yet.
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 8 }}>
          <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TrendingUpRounded color="secondary" />
                  <Typography variant="h5">
                    Recent adjusted HR response
                  </Typography>
                </Stack>
                {drift.length ? (
                  drift.map((result) => (
                    <Button
                      component={Link}
                      href={`/activities/${result.activity_id}`}
                      key={result.activity_id}
                      sx={{
                        justifyContent: "space-between",
                        textTransform: "none",
                      }}
                    >
                      <span>{result.local_date}</span>
                      <strong>
                        {result.adjusted_change_bpm_per_hour?.toFixed(1)} bpm/hr
                        · {result.confidence} confidence
                      </strong>
                    </Button>
                  ))
                ) : (
                  <Typography color="text.secondary">
                    No qualifying heart-rate response results yet.
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <SystemStatusCard />
        </Grid>
      </Grid>
    </Stack>
  );
}
