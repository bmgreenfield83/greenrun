import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormControlLabel,
  Grid,
  IconButton,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useState } from "react";

import type { CalendarEvent } from "../../api/calendar";

type Props = {
  date: string | null;
  events: CalendarEvent[];
  allActivities: CalendarEvent[];
  error: string | null;
  busy: boolean;
  onClose: () => void;
  onSkip: (sessionId: string) => void;
  onUnskip: (sessionId: string) => void;
  onAttach: (sessionId: string, activityId: string) => void;
  onDetach: (sessionId: string) => void;
  onImportActivity: () => void;
  onViewActivity: (activityId: string) => void;
};

function miles(meters: number | null) {
  return meters === null ? "—" : `${(meters / 1609.344).toFixed(2)} mi`;
}

function pace(seconds: number | null) {
  if (seconds === null) return "—";
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}/mi`;
}

function duration(seconds: number | null) {
  if (seconds === null) return "Not recorded";
  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const remaining = rounded % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`
    : `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function speed(metersPerSecond: number | null) {
  return metersPerSecond === null
    ? "Not recorded"
    : `${(metersPerSecond * 2.23694).toFixed(1)} mph`;
}

export function DayDetailDrawer(props: Props) {
  const [skipTarget, setSkipTarget] = useState<string | null>(null);
  const sameDayUnplanned = props.allActivities.filter(
    (event) =>
      event.kind === "activity" &&
      event.status === "unplanned" &&
      event.date === props.date,
  );

  return (
    <>
      <Drawer anchor="right" open={Boolean(props.date)} onClose={props.onClose}>
        <Box
          sx={{
            width: { xs: "100vw", sm: 500 },
            minHeight: "100%",
            p: { xs: 2.5, sm: 3.5 },
            bgcolor: "background.default",
          }}
        >
          <Stack spacing={3}>
            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <IconButton
                aria-label="Close day details"
                onClick={props.onClose}
              >
                <CloseIcon />
              </IconButton>
            </Box>
            {props.error && <Alert severity="error">{props.error}</Alert>}
            {!props.events.length && (
              <>
                <Typography variant="h5">No planned workout</Typography>
                <Typography color="text.secondary">{props.date}</Typography>
                <Button variant="contained" onClick={props.onImportActivity}>
                  Import activity
                </Button>
              </>
            )}
            {props.events.map((event) => {
              const isSession = event.kind === "planned_session";
              const sessionId = event.planned_session_id;
              const isSkipped = event.status === "skipped";
              const hasActivity = Boolean(event.activity_id);
              const showActualMetrics = ["run", "walk", "bike"].includes(
                event.sport,
              );
              return (
                <Stack spacing={1.5} key={event.id}>
                  <div>
                    <Typography variant="h5">{event.title}</Typography>
                    <Typography color="text.secondary">{event.date}</Typography>
                  </div>

                  {event.instructions && (
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 2,
                        bgcolor: "primary.light",
                        borderColor: "rgba(23,74,91,.18)",
                        borderLeft: 4,
                        borderLeftColor: "primary.main",
                      }}
                    >
                      <Typography variant="overline" color="text.secondary">
                        Workout instructions
                      </Typography>
                      <Typography sx={{ whiteSpace: "pre-wrap" }}>
                        {event.instructions}
                      </Typography>
                    </Paper>
                  )}

                  {event.justification && (
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="overline" color="text.secondary">
                        Why this workout
                      </Typography>
                      <Typography sx={{ whiteSpace: "pre-wrap" }}>
                        {event.justification}
                      </Typography>
                    </Paper>
                  )}

                  <Card variant="outlined" sx={{ bgcolor: "background.paper" }}>
                    <CardContent>
                      <Stack spacing={1.5}>
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="flex-start"
                          gap={1}
                        >
                          <div>
                            <Typography
                              variant="overline"
                              color="text.secondary"
                              sx={{ fontWeight: 800, letterSpacing: ".08em" }}
                            >
                              {isSession ? "Planned workout" : "Activity"}
                            </Typography>
                            <Typography fontWeight={750}>
                              {isSession ? "Planned " : ""}
                              {event.sport} · {miles(event.distance_meters)}
                            </Typography>
                          </div>
                          <Chip
                            size="small"
                            label={event.status.replaceAll("_", " ")}
                            color={
                              hasActivity
                                ? "success"
                                : isSkipped
                                  ? "error"
                                  : "default"
                            }
                          />
                        </Stack>
                        {event.notes && (
                          <Typography>Notes: {event.notes}</Typography>
                        )}
                        {hasActivity && (
                          <>
                            <Divider />
                            <Box
                              sx={{
                                p: 2,
                                borderRadius: 2.5,
                                bgcolor: "success.light",
                                border: 1,
                                borderColor: "rgba(47,125,91,.18)",
                              }}
                            >
                              <Typography
                                variant="overline"
                                color="success.dark"
                                sx={{ fontWeight: 800, letterSpacing: ".08em" }}
                              >
                                What you did
                              </Typography>
                              {showActualMetrics && (
                                <Grid container spacing={2} sx={{ mt: 0.25 }}>
                                  {event.completed_distance_meters !== null && (
                                    <Grid size={4}>
                                      <Typography
                                        variant="caption"
                                        color="text.secondary"
                                      >
                                        Distance
                                      </Typography>
                                      <Typography fontWeight={750}>
                                        {miles(event.completed_distance_meters)}
                                      </Typography>
                                    </Grid>
                                  )}
                                  {event.completed_duration_seconds !==
                                    null && (
                                    <Grid size={4}>
                                      <Typography
                                        variant="caption"
                                        color="text.secondary"
                                      >
                                        Time
                                      </Typography>
                                      <Typography fontWeight={750}>
                                        {duration(
                                          event.completed_duration_seconds,
                                        )}
                                      </Typography>
                                    </Grid>
                                  )}
                                  {(event.sport === "run" ||
                                    event.sport === "walk") &&
                                    event.completed_pace_seconds_per_mile !==
                                      null && (
                                      <Grid size={4}>
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                        >
                                          Average pace
                                        </Typography>
                                        <Typography fontWeight={750}>
                                          {pace(
                                            event.completed_pace_seconds_per_mile,
                                          )}
                                        </Typography>
                                      </Grid>
                                    )}
                                  {event.sport === "bike" &&
                                    event.completed_average_speed_mps !==
                                      null && (
                                      <Grid size={4}>
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                        >
                                          Average speed
                                        </Typography>
                                        <Typography fontWeight={750}>
                                          {speed(
                                            event.completed_average_speed_mps,
                                          )}
                                        </Typography>
                                      </Grid>
                                    )}
                                </Grid>
                              )}
                              {event.completed_activity_notes && (
                                <Typography sx={{ mt: 1.5 }}>
                                  {event.completed_activity_notes}
                                </Typography>
                              )}
                            </Box>
                          </>
                        )}
                        {isSession && sessionId && !event.activity_id && (
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={isSkipped}
                                disabled={props.busy}
                                onChange={(_, checked) => {
                                  if (checked) setSkipTarget(sessionId);
                                  else props.onUnskip(sessionId);
                                }}
                              />
                            }
                            label="Mark skipped"
                          />
                        )}
                        {isSession && sessionId && event.activity_id && (
                          <Stack direction="row" spacing={1}>
                            <Button
                              onClick={() =>
                                props.onViewActivity(event.activity_id!)
                              }
                            >
                              View activity
                            </Button>
                            <Button
                              disabled={props.busy}
                              onClick={() => props.onDetach(sessionId)}
                            >
                              Detach activity
                            </Button>
                          </Stack>
                        )}
                        {!isSession && event.activity_id && (
                          <Button
                            onClick={() =>
                              props.onViewActivity(event.activity_id!)
                            }
                          >
                            View activity
                          </Button>
                        )}
                        {isSession &&
                          sessionId &&
                          !event.activity_id &&
                          !isSkipped && (
                            <Stack spacing={1} alignItems="flex-start">
                              {sameDayUnplanned.length ? (
                                sameDayUnplanned.map((activity) => (
                                  <Button
                                    key={activity.id}
                                    variant="contained"
                                    disabled={
                                      props.busy || !activity.activity_id
                                    }
                                    onClick={() =>
                                      props.onAttach(
                                        sessionId,
                                        activity.activity_id!,
                                      )
                                    }
                                  >
                                    Attach {activity.title}
                                  </Button>
                                ))
                              ) : (
                                <Button
                                  variant="contained"
                                  onClick={props.onImportActivity}
                                >
                                  Import activity
                                </Button>
                              )}
                            </Stack>
                          )}
                      </Stack>
                    </CardContent>
                  </Card>
                </Stack>
              );
            })}
          </Stack>
        </Box>
      </Drawer>

      <Dialog open={Boolean(skipTarget)} onClose={() => setSkipTarget(null)}>
        <DialogTitle>Mark this session skipped?</DialogTitle>
        <DialogContent>
          <Typography>
            You can restore it later by clearing the checkbox.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSkipTarget(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            disabled={props.busy}
            onClick={() => {
              if (skipTarget) props.onSkip(skipTarget);
              setSkipTarget(null);
            }}
          >
            Confirm skip
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
