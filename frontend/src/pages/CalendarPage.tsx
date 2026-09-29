import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import type {
  DatesSetArg,
  EventClickArg,
  EventContentArg,
} from "@fullcalendar/core";
import {
  Alert,
  Box,
  Card,
  CardContent,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

import { colors } from "../app/tokens";
import { PageHeader } from "../components/common/PageHeader";
import {
  attachActivity,
  detachActivity,
  fetchCalendar,
  skipSession,
  unskipSession,
  type CalendarEvent,
} from "../api/calendar";
import { DayDetailDrawer } from "../features/calendar/DayDetailDrawer";

// Planned sessions are hollow (panel fill, sport-colored dashed border); completed work is
// solid forest green; skipped is brick red.
const sportColors: Record<string, string> = {
  run: colors.forest,
  walk: "#6b4f2a",
  bike: "#6a3f8f",
  swim: "#1f6f84",
  strength: "#a8501a",
  hike: "#4d6b1f",
  other: "#4f574c",
};
const completedColor = "#2f6b4a";
const skippedColor = "#9f2a24";

function localIso(date: Date): string {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function isInCurrentWeek(date: Date): boolean {
  const today = new Date();
  const monday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - ((today.getDay() + 6) % 7),
  );
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);
  return date >= monday && date < nextMonday;
}

function formatDuration(seconds: number | null): string | null {
  if (seconds === null) return null;
  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const remaining = rounded % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`
    : `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function formatPace(seconds: number | null): string | null {
  if (seconds === null) return null;
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}/mi`;
}

function completionSummary(event: CalendarEvent): string | null {
  const elapsed = formatDuration(event.completed_duration_seconds);
  if (!elapsed) return null;
  if (event.sport === "run") {
    const pace = formatPace(event.completed_pace_seconds_per_mile);
    return pace ? `${elapsed} | ${pace}` : elapsed;
  }
  if (event.sport === "bike" && event.completed_average_speed_mps !== null) {
    return `${elapsed} | ${(event.completed_average_speed_mps * 2.23694).toFixed(1)} mph`;
  }
  return elapsed;
}

export function CalendarPage() {
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down("sm"));
  const [, setLocation] = useLocation();
  const linkedDate = new URLSearchParams(window.location.search).get("date");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [range, setRange] = useState<{ start: string; end: string } | null>(
    null,
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(linkedDate);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPlanned, setShowPlanned] = useState(true);
  const [showCompleted, setShowCompleted] = useState(true);

  const load = async (nextRange = range) => {
    if (!nextRange) return;
    setError(null);
    try {
      setEvents(await fetchCalendar(nextRange.start, nextRange.end));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Calendar data could not be loaded.",
      );
    }
  };

  const datesSet = (arg: DatesSetArg) => {
    const next = { start: localIso(arg.start), end: localIso(arg.end) };
    setRange(next);
    void load(next);
  };

  const runAction = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Calendar action failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  const fullCalendarEvents = useMemo(
    () =>
      events
        .filter((event) =>
          event.activity_id || event.kind === "activity"
            ? showCompleted
            : showPlanned,
        )
        .map((event) => ({
          id: event.id,
          title: event.title,
          start: event.date,
          allDay: true,
          backgroundColor:
            event.status === "skipped"
              ? skippedColor
              : event.activity_id
                ? completedColor
                : colors.panel,
          borderColor:
            event.status === "skipped" || event.activity_id
              ? colors.shadow
              : (sportColors[event.sport] ?? sportColors.other),
          textColor:
            event.status === "skipped" || event.activity_id
              ? colors.cream
              : colors.ink,
          classNames: [`status-${event.status}`, `kind-${event.kind}`],
          extendedProps: { source: event },
        })),
    [events, showCompleted, showPlanned],
  );

  const eventContent = (arg: EventContentArg) => {
    const event = arg.event.extendedProps.source as CalendarEvent;
    const completed = Boolean(event.activity_id);
    const summary = completed ? completionSummary(event) : null;
    const icon =
      event.status === "skipped"
        ? "\u2715"
        : event.status.startsWith("completed")
          ? "\u2713"
          : "";
    const label =
      event.status === "completed_late"
        ? " late"
        : event.status === "completed_early"
          ? " early"
          : "";
    return (
      <div>
        <span className="calendar-event__title">
          {icon} {arg.event.title}
          {label}
        </span>
        {summary && <span className="calendar-event__summary">{summary}</span>}
        {!completed && event.instructions && (
          <span className="calendar-event__instructions">
            {event.instructions}
          </span>
        )}
      </div>
    );
  };

  const selectedEvents = events.filter((event) => event.date === selectedDate);

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Training calendar"
        description="Planned sessions stay on their historical dates while activities stay on their actual dates."
      />
      {error && !selectedDate && <Alert severity="error">{error}</Alert>}
      <Card>
        <CardContent
          sx={{
            p: { xs: 1, sm: 2.5 },
            "&:last-child": { pb: { xs: 1, sm: 2.5 } },
            "& .status-skipped": { opacity: 0.8 },
            "& .status-skipped .calendar-event__title": {
              textDecoration: "line-through",
            },
            "& .current-week-day": { bgcolor: "rgba(31, 61, 44, 0.04)" },
            "& .fc-day-today": { bgcolor: "rgba(224, 122, 47, 0.13)" },
          }}
        >
          <Box
            sx={{
              px: { xs: 1, sm: 0 },
              pb: 1.5,
              mb: { xs: 1, sm: 2 },
              borderBottom: `2px dashed ${colors.rule}`,
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              alignItems={{ sm: "center" }}
              gap={1.5}
            >
              <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                {[
                  [colors.panel, "Planned", sportColors.run],
                  [completedColor, "Completed", colors.shadow],
                  [skippedColor, "Skipped", colors.shadow],
                ].map(([color, label, border]) => (
                  <Stack
                    direction="row"
                    spacing={0.6}
                    alignItems="center"
                    key={label}
                  >
                    <Box
                      sx={{
                        width: 14,
                        height: 14,
                        borderRadius: "2px",
                        bgcolor: color,
                        border: `2px ${label === "Planned" ? "dashed" : "solid"} ${border}`,
                      }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      {label}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
              <Stack direction="row" spacing={1}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={showPlanned}
                      inputProps={{ "aria-label": "Planned" }}
                      onChange={(event) => setShowPlanned(event.target.checked)}
                    />
                  }
                  label="Planned"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={showCompleted}
                      inputProps={{ "aria-label": "Completed" }}
                      onChange={(event) =>
                        setShowCompleted(event.target.checked)
                      }
                    />
                  }
                  label="Completed"
                />
              </Stack>
            </Stack>
          </Box>
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            initialDate={linkedDate ?? undefined}
            firstDay={1}
            buttonText={{ today: "Today" }}
            buttonHints={{ prev: "Previous month", next: "Next month" }}
            height="auto"
            dayMaxEvents={compact ? 2 : 4}
            moreLinkContent={(arg) => `+${arg.num} more`}
            dayCellClassNames={(arg) =>
              isInCurrentWeek(arg.date) ? ["current-week-day"] : []
            }
            events={fullCalendarEvents}
            datesSet={datesSet}
            dateClick={(arg) => setSelectedDate(arg.dateStr)}
            eventClick={(arg: EventClickArg) => {
              const source = arg.event.extendedProps.source as CalendarEvent;
              setSelectedDate(source.date);
            }}
            eventContent={eventContent}
            eventDidMount={(arg) => {
              const source = arg.event.extendedProps.source as CalendarEvent;
              arg.el.setAttribute(
                "aria-label",
                `${source.title}, ${source.date}, ${source.status.replaceAll("_", " ")}`,
              );
            }}
          />
        </CardContent>
      </Card>
      <DayDetailDrawer
        date={selectedDate}
        events={selectedEvents}
        allActivities={events.filter((event) => event.kind === "activity")}
        error={selectedDate ? error : null}
        busy={busy}
        onClose={() => setSelectedDate(null)}
        onSkip={(id) => void runAction(() => skipSession(id, ""))}
        onUnskip={(id) => void runAction(() => unskipSession(id))}
        onAttach={(id, activityId) =>
          void runAction(() => attachActivity(id, activityId))
        }
        onDetach={(id) => void runAction(() => detachActivity(id))}
        onImportActivity={() => setLocation("/import")}
        onViewActivity={(id) => setLocation(`/activities/${id}`)}
      />
    </Stack>
  );
}
