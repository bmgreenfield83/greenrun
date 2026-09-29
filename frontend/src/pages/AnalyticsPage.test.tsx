import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { AnalyticsPage } from "./AnalyticsPage";
import {
  analyticsSummary,
  easyPace,
  goalProgress,
  heartRateZones,
  missingZoneSettings,
} from "../test/analyticsFixtures";
import { mockFetchRoutes } from "../test/mockFetch";

afterEach(() => vi.restoreAllMocks());

const routes = (overrides: Record<string, unknown> = {}) => ({
  "/analytics/summary": analyticsSummary(),
  "/analytics/goal": goalProgress(),
  "/analytics/heart-rate-zones": heartRateZones(),
  "/analytics/easy-pace-heart-rate": easyPace(),
  ...overrides,
});

const section = (name: string) => screen.getByRole("region", { name });

it("shows the goal, volume, load, zones, easy-pace HR, HR response, and records in order", async () => {
  mockFetchRoutes(routes());
  render(<AnalyticsPage />);

  const goal = await screen.findByRole("region", {
    name: "Goal: 1 mile in 6:00",
  });
  expect(within(goal).getByText("6:00/mi")).toBeInTheDocument();
  expect(within(goal).getByText("1:29.5 per 400 m")).toBeInTheDocument();
  expect(within(goal).getByText("6:50.2")).toBeInTheDocument();
  expect(within(goal).getByText("+0:50")).toBeInTheDocument();
  expect(within(goal).getByText("1 of 2 at goal pace")).toBeInTheDocument();

  await screen.findByRole("region", { name: "Weekly volume" });
  expect(
    within(section("Weekly volume")).getByText(/Flagged: Sep 14/),
  ).toBeInTheDocument();
  const plan = section("Plan progress");
  expect(within(plan).getByText("47.6 of 68.3 mi")).toBeInTheDocument();
  expect(within(plan).getByText("12 of 15 completed")).toBeInTheDocument();

  const load = await screen.findByRole("region", { name: "Training load" });
  expect(within(load).getAllByText("1.00").length).toBeGreaterThan(0);
  expect(within(load).getByText("Typical")).toBeInTheDocument();
  expect(within(load).getByText("Guidance, not a rule.")).toBeInTheDocument();

  const zones = section("Heart-rate zones");
  expect(
    within(zones).getByRole("table", { name: "Heart-rate zones" }),
  ).toHaveTextContent("138–152 bpm");
  expect(
    within(zones).getByText("Easy runs: time by zone"),
  ).toBeInTheDocument();

  const easy = await screen.findByRole("region", {
    name: "Heart rate at easy pace",
  });
  expect(within(easy).getByText("10:15/mi")).toBeInTheDocument();
  expect(
    within(easy).getByText(/Lower heart rate at the same pace/),
  ).toBeInTheDocument();

  const response = section("Workload-adjusted heart-rate response");
  expect(
    within(response).getByText(
      /1 of 2 results were computed with an older algorithm/,
    ),
  ).toBeInTheDocument();
  expect(within(response).getByText("stale · v3")).toBeInTheDocument();
  expect(within(response).getByText("90%: 0.8 to 4.1")).toBeInTheDocument();
  const newer = within(response).getByText("2.4 bpm/hr");
  const older = within(response).getByText("3.2 bpm/hr");
  expect(
    newer.compareDocumentPosition(older) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();

  const records = section("Best efforts and records");
  expect(
    within(records).getByRole("link", { name: /1 mile.*6:50.2/ }),
  ).toHaveAttribute("href", "/activities/track-1");
  expect(
    within(records).getByRole("link", { name: /Longest run.*10.00 mi/ }),
  ).toHaveAttribute("href", "/activities/long-1");
  expect(within(records).getByText("Highest week")).toBeInTheDocument();

  const order = [
    "Goal: 1 mile in 6:00",
    "Weekly volume",
    "Training load",
    "Heart-rate zones",
    "Heart rate at easy pace",
    "Workload-adjusted heart-rate response",
    "Best efforts and records",
  ].map((name) => section(name));
  order
    .slice(1)
    .forEach((current, index) =>
      expect(
        order[index].compareDocumentPosition(current) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy(),
    );
  expect(screen.queryByText(/Temperature bands/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Rolling/)).not.toBeInTheDocument();
  expect(screen.queryByText(/rescheduled/)).not.toBeInTheDocument();
});

it("hides the goal card without a structured goal and links to Settings when HR is missing", async () => {
  mockFetchRoutes(
    routes({
      "/analytics/goal": goalProgress({
        status: "no_goal",
        goal: null,
        weeks: [],
        track_sessions: [],
      }),
      "/analytics/heart-rate-zones": missingZoneSettings(),
    }),
  );
  render(<AnalyticsPage />);

  await screen.findByRole("region", { name: "Weekly volume" });
  await screen.findAllByText(
    "Set max and resting heart rate in Settings to see zones.",
  );
  expect(
    screen.queryByRole("region", { name: /^Goal/ }),
  ).not.toBeInTheDocument();
  const links = screen.getAllByRole("link", { name: "Open Settings" });
  expect(links).toHaveLength(2);
  links.forEach((link) => expect(link).toHaveAttribute("href", "/settings"));
});

it("filters HR response results by category", async () => {
  mockFetchRoutes(routes());
  render(<AnalyticsPage />);

  expect(await screen.findByText("3.2 bpm/hr")).toBeInTheDocument();
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "Run categories" }));
  fireEvent.click(screen.getByRole("option", { name: /run club/ }));
  expect(screen.getByText("2.4 bpm/hr")).toBeInTheDocument();
  expect(screen.queryByText("3.2 bpm/hr")).not.toBeInTheDocument();
});
