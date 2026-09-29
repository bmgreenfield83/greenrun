import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import type {
  WorkloadComparison,
  WorkloadTrend,
} from "../../api/workloadTrend";
import { WorkloadTrendCard } from "./WorkloadTrendCard";

afterEach(() => vi.restoreAllMocks());

const group: WorkloadComparison = {
  id: "easy:600:10:20",
  category: "easy",
  pace_seconds_per_mile: 600,
  start_minute: 10,
  end_minute: 20,
  temperature_min_fahrenheit: 68,
  temperature_max_fahrenheit: 77,
  runs: [
    {
      activity_id: "a",
      title: "Morning run",
      local_date: "2026-09-01",
      heart_rate_bpm: 151,
      pace_seconds_per_mile: 602,
      matched_minutes: 10,
      temperature_fahrenheit: 70,
    },
    {
      activity_id: "b",
      title: "Later run",
      local_date: "2026-09-08",
      heart_rate_bpm: 146,
      pace_seconds_per_mile: 598,
      matched_minutes: 5,
      temperature_fahrenheit: 72,
    },
  ],
  weeks: [
    {
      week_start: "2026-08-31",
      median_heart_rate_bpm: 151,
      minimum_heart_rate_bpm: 151,
      maximum_heart_rate_bpm: 151,
      run_count: 1,
    },
    {
      week_start: "2026-09-07",
      median_heart_rate_bpm: 146,
      minimum_heart_rate_bpm: 146,
      maximum_heart_rate_bpm: 146,
      run_count: 1,
    },
  ],
};

function response(comparisons: WorkloadComparison[] = [group]) {
  const data: WorkloadTrend = {
    algorithm_version: 1,
    start_date: "2026-03-17",
    end_date: "2026-09-12",
    runs_screened: 3,
    qualifying_runs: 2,
    exclusion_counts: { "Missing samples": 1 },
    comparisons,
  };
  return new Response(JSON.stringify(data));
}

it("shows weekly variation and contributing runs and switches the entire comparison", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    response([
      group,
      {
        ...group,
        id: "unknown",
        temperature_min_fahrenheit: null,
        temperature_max_fahrenheit: null,
        runs: [group.runs[0]],
        weeks: [group.weeks[0]],
      },
    ]),
  );
  render(<WorkloadTrendCard />);
  expect(screen.getByText(/Finding comparable/)).toBeInTheDocument();
  const table = await screen.findByRole("table", {
    name: "Weekly comparable heart rate",
  });
  expect(within(table).getByText("146 bpm")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Contributing runs (2)"));
  expect(screen.getByRole("link", { name: /Morning run/ })).toHaveAttribute(
    "href",
    "/activities/a",
  );
  expect(screen.getByText(/not confidence intervals/)).toBeInTheDocument();
  fireEvent.mouseDown(
    screen.getByRole("combobox", { name: "Pace comparison" }),
  );
  fireEvent.click(screen.getByRole("option", { name: /Temperature unknown/ }));
  expect(screen.getByText(/Weather similarity is unknown/)).toBeInTheDocument();
  expect(screen.getByText(/At least two weeks/)).toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: /Later run/ }),
  ).not.toBeInTheDocument();
  expect(within(table).queryByText("146 bpm")).not.toBeInTheDocument();
});

it("explains an empty result", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(response([]));
  render(<WorkloadTrendCard />);
  expect(
    await screen.findByText(/No qualifying sections yet/),
  ).toBeInTheDocument();
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
});

it("recovers from a failed request using refresh", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response("", { status: 500 }))
    .mockResolvedValueOnce(response());
  render(<WorkloadTrendCard />);
  expect(await screen.findByText(/could not be loaded/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Refresh comparisons" }));
  expect(await screen.findByRole("combobox")).toBeInTheDocument();
  expect(screen.queryByText(/could not be loaded/)).not.toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(2);
});
