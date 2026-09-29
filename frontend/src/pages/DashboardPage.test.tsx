import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";

import { DashboardPage } from "./DashboardPage";
import { analyticsSummary, heartRateResult } from "../test/analyticsFixtures";
import { mockFetchRoutes } from "../test/mockFetch";

vi.mock("../features/health/SystemStatusCard", () => ({
  SystemStatusCard: () => <div>System status</div>,
}));

afterEach(() => vi.restoreAllMocks());

const renderDashboard = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <DashboardPage />
    </QueryClientProvider>,
  );

it("shows today's workout, the week strip, goal, load, volume tiles, runs, and HR response", async () => {
  const now = new Date();
  const currentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  mockFetchRoutes({
    "/analytics/summary": analyticsSummary(),
    "/activities": {
      total: 1,
      items: [
        {
          id: "a1",
          sport: "run",
          category: "easy",
          local_date: "2026-08-04",
          distance_meters: 5000,
          moving_time_seconds: 1800,
          elapsed_time_seconds: 1810,
        },
      ],
    },
    "/plans": {
      items: [
        {
          id: "p1",
          name: "Sub-6 Mile Block",
          status: "active",
          start_date: "2026-09-07",
          end_date: "2026-12-06",
        },
      ],
    },
    "/plans/p1/sessions": {
      items: [
        {
          id: "s1",
          scheduled_date: currentDate,
          title: "Long run",
          status: "planned",
          planned_distance_meters: 16093.44,
          instructions: "Keep it conversational.",
        },
      ],
    },
    "/calendar": {
      events: [
        {
          id: "session:s1",
          kind: "planned_session",
          title: "Long run",
          date: currentDate,
          sport: "run",
          status: "planned",
          distance_meters: 16093.44,
          completed_distance_meters: null,
          activity_id: null,
        },
      ],
    },
    "/analytics/goal": {
      as_of_date: currentDate,
      status: "ok",
      goal: {
        distance_meters: 1609.344,
        distance_label: "1 mile",
        target_time_seconds: 360,
        pace_seconds_per_mile: 360,
        pace_seconds_per_400m: 89.5,
      },
      weeks: [],
      current_best: {
        activity_id: "a1",
        activity_title: null,
        local_date: "2026-09-01",
        category: "track",
        elapsed_seconds: 410,
        pace_seconds_per_mile: 410,
        source: "lap",
      },
      gap_seconds: 50,
      track_sessions: [],
    },
    "/analytics/heart-rate-zones": {
      status: "ok",
      training_load: {
        days: [],
        acute_days: 7,
        chronic_days: 28,
        acute_load: 300,
        chronic_load: 300,
        acute_chronic_ratio: 1.0,
        ratio_band: "typical",
        chronic_history_complete: true,
        bands: [
          { label: "low", lower: null, upper: 0.8, description: "" },
          { label: "typical", lower: 0.8, upper: 1.3, description: "" },
          { label: "elevated", lower: 1.3, upper: 1.5, description: "" },
          { label: "spike", lower: 1.5, upper: null, description: "" },
        ],
        guidance: "",
      },
    },
  });
  renderDashboard();

  expect(await screen.findByText("Sub-6 Mile Block")).toBeInTheDocument();
  expect(screen.getByText("Week 4 of 13")).toBeInTheDocument();
  // This week = the partial (last) week; 4-week average = last completed week's trailing average.
  expect(
    screen.getByText("This week", { selector: "p" }).closest("div"),
  ).toHaveTextContent("3.9mi");
  expect(screen.getByText("of 23.0 planned")).toBeInTheDocument();
  expect(screen.getByText("4-wk avg").closest("div")).toHaveTextContent(
    "22.5mi",
  );
  expect(
    screen.getByText("Plan", { selector: "p" }).closest("div"),
  ).toHaveTextContent("47.6mi");
  expect(screen.getByText("of 68.3 due so far")).toBeInTheDocument();
  expect(screen.getByText(/12 of 15 sessions due so far/)).toBeInTheDocument();
  // Today hero: the planned workout with its distance and instructions.
  const today = screen.getByRole("region", { name: "Today" });
  expect(
    within(today).getByRole("heading", { name: "Long run" }),
  ).toBeInTheDocument();
  expect(within(today).getByText("10.0 mi")).toBeInTheDocument();
  expect(
    within(today).getByText("Keep it conversational."),
  ).toBeInTheDocument();
  // Week strip: seven days, today planned.
  const strip = await screen.findByRole("list", {
    name: "This week, Monday to Sunday",
  });
  expect(within(strip).getAllByRole("listitem")).toHaveLength(7);
  expect(
    within(strip).getByRole("link", {
      name: /today, Planned, Long run, 10\.0 mi/,
    }),
  ).toBeInTheDocument();
  // Goal chip and training-load gauge.
  expect(await screen.findByText("1 mile in 6:00")).toBeInTheDocument();
  expect(screen.getByText("6:50")).toBeInTheDocument();
  expect(screen.getByText("+0:50 to go")).toBeInTheDocument();
  expect(await screen.findByText("Typical")).toBeInTheDocument();
  expect(screen.getByText("Easy Run")).toBeInTheDocument();
  expect(screen.queryByText(/Last 7 days|90 days/)).not.toBeInTheDocument();
});

it("lists the newest HR response results first (history is oldest first)", async () => {
  const history = Array.from({ length: 6 }, (_, index) =>
    heartRateResult({
      activity_id: `run-${index}`,
      local_date: `2026-09-0${index + 1}`,
      adjusted_change_bpm_per_hour: index + 0.5,
    }),
  );
  mockFetchRoutes({
    "/analytics/summary": analyticsSummary({
      heart_rate_response_history: history,
      plan_progress: null,
    }),
    "/activities": { total: 0, items: [] },
    "/plans": { items: [] },
  });
  renderDashboard();

  const card = (await screen.findByText("Recent adjusted HR response")).closest(
    ".MuiCard-root",
  ) as HTMLElement;
  // With no active plan, the hero says so.
  expect(await screen.findByText("No active plan")).toBeInTheDocument();
  await within(card).findByText("5.5 bpm/hr");
  const values = within(card)
    .getAllByText(/bpm\/hr$/)
    .map((node) => node.textContent);
  expect(values).toEqual([
    "5.5 bpm/hr",
    "4.5 bpm/hr",
    "3.5 bpm/hr",
    "2.5 bpm/hr",
  ]);
  expect(within(card).getAllByRole("link")[0]).toHaveAttribute(
    "href",
    "/activities/run-5",
  );
});
