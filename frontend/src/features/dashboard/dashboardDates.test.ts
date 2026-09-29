import { expect, it } from "vitest";

import type { CalendarEvent } from "../../api/calendar";
import type { PlannedSession } from "../../api/plans";
import {
  nextDate,
  summarizeWeek,
  todayPlan,
  weekDates,
} from "./dashboardDates";

const event = (overrides: Partial<CalendarEvent>): CalendarEvent =>
  ({
    id: "e",
    kind: "planned_session",
    title: "Easy",
    date: "2026-09-28",
    sport: "run",
    status: "planned",
    distance_meters: 1609.344 * 4,
    completed_distance_meters: null,
    activity_id: null,
    ...overrides,
  }) as CalendarEvent;

const session = (overrides: Partial<PlannedSession>): PlannedSession =>
  ({
    id: "s",
    training_plan_id: "p",
    scheduled_date: "2026-09-29",
    sport: "run",
    session_type: "easy",
    title: "Easy",
    planned_distance_meters: null,
    planned_duration_seconds: null,
    instructions: null,
    status: "planned",
    completed_activity_id: null,
    ...overrides,
  }) as PlannedSession;

it("builds Monday to Sunday weeks and exclusive range ends", () => {
  expect(weekDates(new Date(2026, 8, 29))).toEqual([
    "2026-09-28",
    "2026-09-29",
    "2026-09-30",
    "2026-10-01",
    "2026-10-02",
    "2026-10-03",
    "2026-10-04",
  ]);
  expect(weekDates(new Date(2026, 9, 4))[0]).toBe("2026-09-28");
  expect(nextDate("2026-10-04")).toBe("2026-10-05");
});

it("summarizes planned versus completed work per day", () => {
  const dates = weekDates(new Date(2026, 8, 29));
  const days = summarizeWeek(
    [
      event({
        date: "2026-09-28",
        status: "completed",
        activity_id: "a",
        completed_distance_meters: 1609.344 * 3,
      }),
      event({ date: "2026-09-29" }),
      event({ date: "2026-09-30", status: "skipped" }),
      event({
        date: "2026-10-01",
        kind: "activity",
        status: "unplanned",
        activity_id: "b",
        distance_meters: 1609.344 * 2,
      }),
    ],
    dates,
    "2026-09-29",
  );
  expect(days.map((day) => day.state)).toEqual([
    "done",
    "planned",
    "skipped",
    "extra",
    "rest",
    "rest",
    "rest",
  ]);
  expect(days[0].completedMiles).toBeCloseTo(3);
  expect(days[0].plannedMiles).toBeCloseTo(4);
  expect(days[1].isToday).toBe(true);
  expect(days[2].plannedMiles).toBeNull();
  expect(days[3].completedMiles).toBeCloseTo(2);

  const missed = summarizeWeek([event({})], dates, "2026-09-29");
  expect(missed[0].state).toBe("missed");
});

it("picks today's workout, done, or a rest day with the next session", () => {
  const today = "2026-09-29";
  expect(todayPlan(null, today)).toEqual({ kind: "no-plan" });
  expect(todayPlan([session({})], today).kind).toBe("workout");
  expect(todayPlan([session({ status: "completed_late" })], today).kind).toBe(
    "done",
  );
  const later = session({ id: "b", scheduled_date: "2026-10-03" });
  const soon = session({ id: "a", scheduled_date: "2026-10-01" });
  expect(todayPlan([later, soon], today)).toEqual({ kind: "rest", next: soon });
});
