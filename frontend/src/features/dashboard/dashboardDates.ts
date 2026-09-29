import type { CalendarEvent } from "../../api/calendar";
import type { PlannedSession } from "../../api/plans";

const METERS_PER_MILE = 1609.344;

/** Local YYYY-MM-DD for a Date. */
export function isoDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

/** Monday..Sunday of the week containing `today`, as local YYYY-MM-DD strings. */
export function weekDates(today: Date): string[] {
  const monday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - ((today.getDay() + 6) % 7),
  );
  return Array.from({ length: 7 }, (_, index) =>
    isoDate(
      new Date(
        monday.getFullYear(),
        monday.getMonth(),
        monday.getDate() + index,
      ),
    ),
  );
}

/** Day after the given local date (for exclusive range ends). */
export function nextDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return isoDate(new Date(year, month - 1, day + 1));
}

export type DayState =
  "done" | "partial" | "planned" | "missed" | "skipped" | "extra" | "rest";

export type WeekDay = {
  date: string;
  isToday: boolean;
  isPast: boolean;
  state: DayState;
  /** Main label: planned workout title or completed activity title. */
  title: string | null;
  plannedMiles: number | null;
  completedMiles: number | null;
};

const isCompleted = (status: string) =>
  status.startsWith("completed") || status === "partially_completed";

const miles = (meters: number | null | undefined) =>
  meters == null ? 0 : meters / METERS_PER_MILE;

/**
 * Summarizes a Monday–Sunday week of calendar events into one entry per day:
 * planned vs completed miles and a state for the week strip. Planned sessions stay on
 * their scheduled dates and activities on their actual dates, as on the calendar.
 */
export function summarizeWeek(
  events: CalendarEvent[],
  dates: string[],
  today: string,
): WeekDay[] {
  return dates.map((date) => {
    const dayEvents = events.filter((event) => event.date === date);
    const sessions = dayEvents.filter(
      (event) =>
        event.kind === "planned_session" && event.status !== "rescheduled",
    );
    const activities = dayEvents.filter((event) => event.kind === "activity");
    const open = sessions.filter((event) => event.status === "planned");
    const done = sessions.filter((event) => isCompleted(event.status));
    const skipped = sessions.filter((event) => event.status === "skipped");

    const plannedTotal = sessions
      .filter((event) => event.status !== "skipped")
      .reduce((sum, event) => sum + miles(event.distance_meters), 0);
    const completed =
      done.reduce(
        (sum, event) => sum + miles(event.completed_distance_meters),
        0,
      ) +
      activities.reduce((sum, event) => sum + miles(event.distance_meters), 0);

    const isPast = date < today;
    let state: DayState;
    if (!sessions.length) state = activities.length ? "extra" : "rest";
    else if (open.length === 0 && done.length > 0) state = "done";
    else if (open.length === 0 && skipped.length > 0) state = "skipped";
    else if (done.length > 0) state = "partial";
    else state = isPast ? "missed" : "planned";

    const title =
      (open[0] ?? done[0] ?? skipped[0])?.title ?? activities[0]?.title ?? null;
    return {
      date,
      isToday: date === today,
      isPast,
      state,
      title,
      plannedMiles: sessions.length && plannedTotal > 0 ? plannedTotal : null,
      completedMiles: done.length || activities.length ? completed : null,
    };
  });
}

export type TodayPlan =
  | { kind: "no-plan" }
  | { kind: "workout"; sessions: PlannedSession[] }
  | { kind: "done"; sessions: PlannedSession[] }
  | { kind: "skipped"; sessions: PlannedSession[] }
  | { kind: "rest"; next: PlannedSession | null };

/** What the active plan asks for today, or the next session when today is a rest day. */
export function todayPlan(
  sessions: PlannedSession[] | null,
  today: string,
): TodayPlan {
  if (!sessions) return { kind: "no-plan" };
  const todays = sessions.filter(
    (session) =>
      session.scheduled_date === today && session.status !== "rescheduled",
  );
  const open = todays.filter((session) => session.status === "planned");
  if (open.length) return { kind: "workout", sessions: open };
  const done = todays.filter((session) => isCompleted(session.status));
  if (done.length) return { kind: "done", sessions: done };
  if (todays.length) return { kind: "skipped", sessions: todays };
  const next =
    [...sessions]
      .filter(
        (session) =>
          session.scheduled_date > today && session.status === "planned",
      )
      .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))[0] ??
    null;
  return { kind: "rest", next };
}
