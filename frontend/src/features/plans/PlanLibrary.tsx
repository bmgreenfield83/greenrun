import ArchiveRounded from "@mui/icons-material/ArchiveRounded";
import DownloadRounded from "@mui/icons-material/DownloadRounded";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";

import {
  listPlans,
  listPlanSessions,
  updatePlanStatus,
  type PlannedSession,
  type TrainingPlan,
} from "../../api/plans";
import { SectionPlate } from "../../components/common/SectionPlate";
import { exportPlan } from "../../api/exports";
import { localDateLabel, metersToMiles } from "../activities/format";
import { GoalTargetEditor } from "./GoalTargetEditor";

const dateRange = (start: string, end: string) =>
  `${localDateLabel(start)} – ${localDateLabel(end)}`;

const sessionDate = (date: string) =>
  localDateLabel(date, { weekday: "short", month: "short", day: "numeric" });

const weekNumber = (plan: TrainingPlan, date: string) =>
  Math.floor(
    (Date.parse(`${date}T00:00:00Z`) -
      Date.parse(`${plan.start_date}T00:00:00Z`)) /
      604_800_000,
  ) + 1;

export function PlanLibrary({ refreshKey }: { refreshKey: number }) {
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [sessions, setSessions] = useState<PlannedSession[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const items = await listPlans();
      if (!Array.isArray(items)) throw new Error("Plans could not be loaded.");
      setPlans(items);
      const active = items.find((plan) => plan.status === "active");
      setSessions(active ? await listPlanSessions(active.id) : []);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Plans could not be loaded.",
      );
    }
  };

  useEffect(() => {
    void load();
  }, [refreshKey]);

  const active = plans.find((plan) => plan.status === "active");
  const historical = plans.filter((plan) => plan.status !== "active");
  const weeks = active
    ? sessions.reduce<Map<number, PlannedSession[]>>((result, session) => {
        const number = weekNumber(active, session.scheduled_date);
        result.set(number, [...(result.get(number) ?? []), session]);
        return result;
      }, new Map())
    : new Map<number, PlannedSession[]>();

  const archive = async (plan: TrainingPlan) => {
    if (
      !window.confirm(
        `Archive ${plan.name}? Its sessions and linked activities will be retained.`,
      )
    )
      return;
    try {
      await updatePlanStatus(plan.id, "archived");
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The plan could not be archived.",
      );
    }
  };

  const replacePlan = (updated: TrainingPlan) =>
    setPlans((current) =>
      current.map((plan) => (plan.id === updated.id ? updated : plan)),
    );

  const exportFile = (plan: TrainingPlan, analysis: boolean) =>
    void exportPlan(plan.id, analysis).catch((reason: Error) =>
      setError(reason.message),
    );

  return (
    <Stack spacing={3}>
      {error && <Alert severity="error">{error}</Alert>}
      <SectionPlate title="Your plans" />
      {active ? (
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                gap={1}
                alignItems={{ sm: "center" }}
              >
                <div style={{ flexGrow: 1, minWidth: 0 }}>
                  <Stack
                    direction="row"
                    gap={1}
                    alignItems="center"
                    flexWrap="wrap"
                  >
                    <Typography variant="h5" component="h3">
                      {active.name}
                    </Typography>
                    <Chip size="small" color="success" label="Active" />
                  </Stack>
                  <Typography color="text.secondary">
                    {dateRange(active.start_date, active.end_date)}
                  </Typography>
                </div>
                <Button
                  startIcon={<DownloadRounded />}
                  onClick={() => exportFile(active, false)}
                >
                  Export plan
                </Button>
                <Button
                  startIcon={<DownloadRounded />}
                  onClick={() => exportFile(active, true)}
                >
                  Analysis export
                </Button>
                <Button
                  color="warning"
                  startIcon={<ArchiveRounded />}
                  onClick={() => void archive(active)}
                >
                  Archive
                </Button>
              </Stack>
              {active.description && (
                <Typography>{active.description}</Typography>
              )}
              <GoalTargetEditor
                key={`${active.id}-${active.goal_target?.distance_meters}-${active.goal_target?.target_time_seconds}`}
                plan={active}
                onSaved={replacePlan}
              />
              {(active.primary_goal || active.secondary_goal) && (
                <Grid container spacing={2}>
                  {active.primary_goal && (
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Typography variant="overline" color="text.secondary">
                        Primary goal
                      </Typography>
                      <Typography sx={{ whiteSpace: "pre-wrap" }}>
                        {active.primary_goal}
                      </Typography>
                    </Grid>
                  )}
                  {active.secondary_goal && (
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Typography variant="overline" color="text.secondary">
                        Secondary goal
                      </Typography>
                      <Typography sx={{ whiteSpace: "pre-wrap" }}>
                        {active.secondary_goal}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              )}
              <Divider />
              <Typography variant="h6" component="h3">
                Week-by-week schedule
              </Typography>
              {[...weeks.entries()].map(([number, items]) => {
                const summary = active.week_summaries.find(
                  (week) => week.week_number === number,
                );
                return (
                  <Card variant="outlined" key={number}>
                    <CardContent>
                      <Stack spacing={1.25}>
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          justifyContent="space-between"
                        >
                          <Typography fontWeight={800}>
                            Week {number}
                            {summary?.focus ? ` — ${summary.focus}` : ""}
                          </Typography>
                          {summary?.planned_running_miles != null && (
                            <Typography color="text.secondary">
                              {summary.planned_running_miles.toFixed(1)} planned
                              miles
                            </Typography>
                          )}
                        </Stack>
                        <Grid container spacing={1}>
                          {items.map((session) => (
                            <Grid size={{ xs: 12, md: 6 }} key={session.id}>
                              <Stack
                                direction="row"
                                justifyContent="space-between"
                                gap={1.5}
                                sx={{
                                  p: 1.25,
                                  height: "100%",
                                  bgcolor: "background.paper",
                                  border: 1,
                                  borderColor: "divider",
                                  borderRadius: "6px",
                                }}
                              >
                                <div>
                                  <Typography fontWeight={700}>
                                    {session.title}
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                  >
                                    {sessionDate(session.scheduled_date)} ·{" "}
                                    {session.status.replaceAll("_", " ")}
                                  </Typography>
                                  {session.justification && (
                                    <Typography
                                      variant="body2"
                                      sx={{ mt: 0.5 }}
                                    >
                                      {session.justification}
                                    </Typography>
                                  )}
                                </div>
                                <Typography
                                  fontWeight={700}
                                  color="primary.dark"
                                  sx={{
                                    whiteSpace: "nowrap",
                                    fontVariantNumeric: "tabular-nums",
                                  }}
                                >
                                  {session.planned_distance_meters == null
                                    ? ""
                                    : metersToMiles(
                                        session.planned_distance_meters,
                                      )}
                                </Typography>
                              </Stack>
                            </Grid>
                          ))}
                        </Grid>
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          </CardContent>
        </Card>
      ) : (
        <Alert severity="info">
          No active training plan. Import one above to populate the calendar and
          dashboard.
        </Alert>
      )}

      {historical.length > 0 && (
        <Stack spacing={1.5}>
          <SectionPlate title="Archived and previous plans" />
          {historical.map((plan) => (
            <Card variant="outlined" key={plan.id}>
              <CardContent>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  gap={1}
                  alignItems={{ sm: "center" }}
                >
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <Stack
                      direction="row"
                      gap={1}
                      alignItems="center"
                      flexWrap="wrap"
                    >
                      <Typography fontWeight={800}>{plan.name}</Typography>
                      <Chip size="small" label={plan.status} />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {dateRange(plan.start_date, plan.end_date)}
                    </Typography>
                    {plan.primary_goal && (
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        {plan.primary_goal}
                      </Typography>
                    )}
                    <Box sx={{ mt: 1 }}>
                      <GoalTargetEditor
                        key={`${plan.id}-${plan.goal_target?.distance_meters}-${plan.goal_target?.target_time_seconds}`}
                        plan={plan}
                        onSaved={replacePlan}
                      />
                    </Box>
                  </div>
                  <Button onClick={() => exportFile(plan, false)}>
                    Export plan
                  </Button>
                  <Button onClick={() => exportFile(plan, true)}>
                    Analysis export
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
