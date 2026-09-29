import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { AnalyticsPage } from "./AnalyticsPage";

vi.mock("../api/workloadTrend", () => ({
  getWorkloadTrend: vi.fn().mockResolvedValue({
    start_date: "2026-03-17",
    end_date: "2026-09-12",
    runs_screened: 0,
    qualifying_runs: 0,
    exclusion_counts: {},
    comparisons: [],
  }),
}));

afterEach(() => vi.restoreAllMocks());

it("shows mileage and adjusted heart-rate response summaries", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        as_of_date: "2026-08-05",
        rolling_7_day_miles: 5.72,
        rolling_28_day_miles: 12,
        rolling_90_day_miles: 20,
        weekly_mileage: [{ week_start: "2026-08-03", miles: 5.72 }],
        plan_progress: null,
        personal_bests: [
          {
            label: "Longest run",
            value: "5.72 mi",
            activity_id: "a1",
            local_date: "2026-08-04",
          },
        ],
        temperature_bands: [],
        heart_rate_response_history: [
          {
            activity_id: "a2",
            activity_title: "Newer run",
            local_date: "2026-08-05",
            category: "easy",
            eligible: true,
            adjusted_change_bpm_per_hour: 2.4,
            exclusion_reason: null,
            confidence: "high",
          },
          {
            activity_id: "a1",
            activity_title: "Run",
            local_date: "2026-08-04",
            category: "run_club",
            eligible: true,
            adjusted_change_bpm_per_hour: 3.2,
            exclusion_reason: null,
            confidence: "low",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );
  render(<AnalyticsPage />);

  expect(await screen.findByText("5.7 mi")).toBeInTheDocument();
  expect(screen.queryByText("Comparable runs")).not.toBeInTheDocument();
  expect(screen.getByText("3.2 bpm/hr")).toBeInTheDocument();
  expect(screen.getAllByText("ADJUSTED")).toHaveLength(2);
  expect(screen.getByText("low confidence")).toBeInTheDocument();
  expect(
    screen.getByText(/Point size and opacity indicate confidence/),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/Four qualifying runs are required/),
  ).toBeInTheDocument();
  const newerDate = screen.getByText("2026-08-05");
  const olderDate = screen.getAllByText("2026-08-04").at(-1)!;
  expect(
    newerDate.compareDocumentPosition(olderDate) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(screen.getByText("Longest run")).toBeInTheDocument();
  expect(screen.getByText("5.72 mi")).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: /Longest run.*5.72 mi/ }),
  ).toHaveAttribute("href", "/activities/a1");
  expect(
    screen.getByText(
      "No recorded temperature data is available for these activities.",
    ),
  ).toBeInTheDocument();

  fireEvent.mouseDown(screen.getByRole("combobox", { name: "Run categories" }));
  fireEvent.click(screen.getByRole("option", { name: /run club/ }));
  expect(screen.getByText("2.4 bpm/hr")).toBeInTheDocument();
  expect(screen.queryByText("3.2 bpm/hr")).not.toBeInTheDocument();
});
