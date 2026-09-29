import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import EventRounded from "@mui/icons-material/EventRounded";
import TrendingUpRounded from "@mui/icons-material/TrendingUpRounded";
import {
  Alert,
  Card,
  CardContent,
  Grid,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useState, type ReactNode } from "react";

import { listActivities, type Activity } from "../api/activities";
import { getAnalytics, type AnalyticsSummary } from "../api/analytics";
import { listPlans, listPlanSessions, type PlannedSession } from "../api/plans";
import { LinkRow } from "../components/common/LinkRow";
import { PageHeader } from "../components/common/PageHeader";
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
import { TrainingSnapshot } from "../features/dashboard/TrainingSnapshot";
import { SystemStatusCard } from "../features/health/SystemStatusCard";

const today = () => {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
};

const upcomingDate = (date: string) => {
  if (date === today()) return "Today";
  return localDateLabel(date, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
};

const shortDate = (date: string) =>
  localDateLabel(date, { weekday: "short", month: "short", day: "numeric" });

export function DashboardPage() {
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [upcoming, setUpcoming] = useState<PlannedSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  // History is oldest first; show the newest results.
  const drift = newestResults(analytics?.heart_rate_response_history ?? [], 4);

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Your training, clearly tracked."
        description="Your current week, upcoming workouts, and recent training at a glance."
      />
      {error && <Alert severity="warning">{error}</Alert>}

      {(loading || analytics) && (
        <TrainingSnapshot analytics={analytics} loading={loading} />
      )}

      <Grid container spacing={{ xs: 1.5, sm: 2 }}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <DashboardListCard
            title="Upcoming workouts"
            icon={<EventRounded color="primary" />}
            loading={loading}
            empty="No upcoming planned workouts."
          >
            {upcoming.map((session) => (
              <LinkRow
                href={`/calendar?date=${session.scheduled_date}`}
                key={session.id}
                primary={session.title}
                trailing={upcomingDate(session.scheduled_date)}
              />
            ))}
          </DashboardListCard>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <DashboardListCard
            title="Recent activities"
            icon={<CheckCircleRounded color="success" />}
            loading={loading}
            empty="No completed activities yet."
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

        <Grid size={{ xs: 12, lg: 8 }}>
          <DashboardListCard
            title="Recent adjusted HR response"
            icon={<TrendingUpRounded color="secondary" />}
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
        <Grid size={{ xs: 12, lg: 4 }}>
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
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Stack spacing={1.5}>
          <SectionTitle icon={icon}>{title}</SectionTitle>
          {loading ? (
            <Stack spacing={1} aria-busy="true" aria-label={`Loading ${title}`}>
              {[0, 1, 2].map((key) => (
                <Skeleton key={key} variant="rounded" height={44} />
              ))}
            </Stack>
          ) : children.length ? (
            <Stack spacing={0.25} sx={{ mx: -1.5 }}>
              {children}
            </Stack>
          ) : (
            <Typography color="text.secondary">{empty}</Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
