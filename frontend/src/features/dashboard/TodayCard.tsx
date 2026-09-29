import CheckRounded from "@mui/icons-material/CheckRounded";
import EventRounded from "@mui/icons-material/EventRounded";
import {
  Box,
  Button,
  Card,
  Chip,
  LinearProgress,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { Link } from "wouter";

import type { PlanProgress } from "../../api/analytics";
import type { PlannedSession } from "../../api/plans";
import { colors, pixelFont } from "../../app/tokens";
import { localDateLabel } from "../activities/format";
import { percentOf } from "../analytics/format";
import type { TodayPlan } from "./dashboardDates";

const METERS_PER_MILE = 1609.344;

function sessionFacts(session: PlannedSession): string[] {
  const facts: string[] = [];
  if (session.planned_distance_meters)
    facts.push(
      `${(session.planned_distance_meters / METERS_PER_MILE).toFixed(1)} mi`,
    );
  if (session.planned_duration_seconds)
    facts.push(`${Math.round(session.planned_duration_seconds / 60)} min`);
  if (session.session_type && session.session_type !== session.title)
    facts.push(session.session_type.replaceAll("_", " "));
  return facts;
}

function Headline({ children }: { children: string }) {
  return (
    <Typography
      component="h2"
      sx={{
        fontWeight: 800,
        letterSpacing: "-0.025em",
        lineHeight: 1.1,
        fontSize: { xs: "1.7rem", sm: "2.2rem" },
        color: colors.ink,
      }}
    >
      {children}
    </Typography>
  );
}

function SessionBody({
  session,
  label,
}: {
  session: PlannedSession;
  label: string;
}) {
  const facts = sessionFacts(session);
  return (
    <Stack spacing={1.25}>
      <Typography variant="overline" color="text.secondary" component="p">
        {label}
      </Typography>
      <Headline>{session.title}</Headline>
      {facts.length > 0 && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {facts.map((fact) => (
            <Chip
              key={fact}
              label={fact}
              sx={{
                textTransform:
                  fact.endsWith("mi") || fact.endsWith("min")
                    ? "none"
                    : "capitalize",
                fontSize: "0.9rem",
              }}
            />
          ))}
        </Stack>
      )}
      {session.instructions && (
        <Typography
          color="text.secondary"
          sx={{
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            maxWidth: "62ch",
          }}
        >
          {session.instructions}
        </Typography>
      )}
    </Stack>
  );
}

/**
 * Dashboard hero: today's planned workout from the active plan, "done" once
 * completed, or a rest day with the next session. Also carries the plan week.
 */
export function TodayCard({
  plan,
  progress,
  today,
  loading,
}: {
  plan: TodayPlan | null;
  progress: PlanProgress | null | undefined;
  today: string;
  loading: boolean;
}) {
  const dateLabel = localDateLabel(today, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <Card component="section" aria-label="Today" sx={{ height: "100%" }}>
      <Stack sx={{ height: "100%" }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={1}
          sx={{
            px: { xs: 2, sm: 2.75 },
            py: 1.25,
            bgcolor: colors.forest,
            color: colors.cream,
            borderBottom: `2px solid ${colors.border}`,
          }}
        >
          <Typography
            component="p"
            sx={{ fontFamily: pixelFont, fontSize: "0.95rem", lineHeight: 1.2 }}
          >
            <Box component="span" sx={{ color: colors.orangeOnForest }}>
              Today
            </Box>{" "}
            · {dateLabel}
          </Typography>
          {progress?.current_week_number ? (
            <Chip
              size="small"
              color="secondary"
              label={`Week ${progress.current_week_number} of ${progress.total_weeks}`}
            />
          ) : null}
        </Stack>

        <Stack
          spacing={2.5}
          sx={{ p: { xs: 2, sm: 2.75 }, flexGrow: 1 }}
          justifyContent="space-between"
        >
          {loading || !plan ? (
            <Stack spacing={1.25} aria-busy="true" aria-label="Loading today">
              <Skeleton width="30%" />
              <Skeleton variant="rounded" height={44} width="70%" />
              <Skeleton width="50%" />
            </Stack>
          ) : plan.kind === "workout" ? (
            <Stack spacing={2}>
              {plan.sessions.map((session) => (
                <SessionBody
                  key={session.id}
                  session={session}
                  label="Planned workout"
                />
              ))}
            </Stack>
          ) : plan.kind === "done" ? (
            <Stack direction="row" spacing={2} alignItems="flex-start">
              <Box
                aria-hidden
                sx={{
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                  width: 52,
                  height: 52,
                  bgcolor: colors.success,
                  color: "#fff",
                  border: `2px solid ${colors.border}`,
                  borderRadius: "4px",
                  boxShadow: `3px 3px 0 ${colors.shadow}`,
                }}
              >
                <CheckRounded fontSize="large" />
              </Box>
              <Stack spacing={0.75}>
                <Typography
                  variant="overline"
                  color="text.secondary"
                  component="p"
                >
                  Done for today
                </Typography>
                <Headline>
                  {plan.sessions.map((session) => session.title).join(" + ")}
                </Headline>
                <Typography color="text.secondary">
                  Nice work. Recovery counts as training too.
                </Typography>
              </Stack>
            </Stack>
          ) : plan.kind === "skipped" ? (
            <Stack spacing={0.75}>
              <Typography
                variant="overline"
                color="text.secondary"
                component="p"
              >
                Skipped
              </Typography>
              <Headline>
                {plan.sessions.map((session) => session.title).join(" + ")}
              </Headline>
              <Typography color="text.secondary">
                Marked as skipped. The rest of the week is below.
              </Typography>
            </Stack>
          ) : plan.kind === "rest" ? (
            <Stack spacing={0.75}>
              <Typography
                variant="overline"
                color="text.secondary"
                component="p"
              >
                Nothing planned
              </Typography>
              <Headline>Rest day</Headline>
              <Typography color="text.secondary">
                {plan.next ? (
                  <>
                    Next up: <strong>{plan.next.title}</strong> ·{" "}
                    {localDateLabel(plan.next.scheduled_date, {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    })}
                  </>
                ) : (
                  "No more sessions are planned in the active plan."
                )}
              </Typography>
            </Stack>
          ) : (
            <Stack spacing={1.25} alignItems="flex-start">
              <Headline>No active plan</Headline>
              <Typography color="text.secondary">
                Import or activate a training plan to see today&apos;s workout
                here.
              </Typography>
              <Button component={Link} href="/plans" variant="contained">
                Go to plans
              </Button>
            </Stack>
          )}

          {progress && (
            <Stack
              spacing={1}
              sx={{ pt: 2, borderTop: `2px dashed ${colors.rule}` }}
            >
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="baseline"
                gap={1}
                flexWrap="wrap"
              >
                <Typography fontWeight={800}>{progress.plan_name}</Typography>
                {progress.current_week_planned_miles != null && (
                  <Typography
                    variant="body2"
                    sx={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    <strong>
                      {(progress.current_week_completed_miles ?? 0).toFixed(1)}
                    </strong>{" "}
                    of {progress.current_week_planned_miles.toFixed(1)} planned
                    mi this week
                  </Typography>
                )}
              </Stack>
              {progress.current_week_planned_miles != null && (
                <LinearProgress
                  variant="determinate"
                  value={percentOf(
                    progress.current_week_completed_miles,
                    progress.current_week_planned_miles,
                  )}
                  aria-label="Current week planned miles completed"
                />
              )}
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                gap={1}
                flexWrap="wrap"
              >
                <Typography variant="body2" color="text.secondary">
                  {progress.sessions_completed_to_date} of{" "}
                  {progress.sessions_due_to_date} sessions due so far completed
                  {progress.sessions_skipped_to_date
                    ? ` · ${progress.sessions_skipped_to_date} skipped`
                    : ""}
                </Typography>
                <Button
                  component={Link}
                  href={`/calendar?date=${today}`}
                  size="small"
                  startIcon={<EventRounded />}
                >
                  Open calendar
                </Button>
              </Stack>
            </Stack>
          )}
        </Stack>
      </Stack>
    </Card>
  );
}
