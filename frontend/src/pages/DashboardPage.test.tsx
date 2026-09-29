import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";

import { DashboardPage } from "./DashboardPage";

vi.mock("../features/health/SystemStatusCard", () => ({
  SystemStatusCard: () => <div>System status</div>,
}));

afterEach(() => vi.restoreAllMocks());

it("shows current-week progress, upcoming workouts, activities, and HR response", async () => {
  const now = new Date();
  const currentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          rolling_7_day_miles: 12,
          rolling_28_day_miles: 45,
          rolling_90_day_miles: 120,
          plan_progress: {
            plan_name: "Marathon plan",
            current_week_completed_miles: 8,
            current_week_planned_miles: 20,
            completed_sessions: 5,
            total_sessions: 20,
          },
          heart_rate_response_history: [
            {
              activity_id: "a1",
              local_date: "2026-08-04",
              adjusted_change_bpm_per_hour: 3.2,
              confidence: "high",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          total: 1,
          items: [
            {
              id: "a1",
              sport: "run",
              category: "easy",
              distance_meters: 5000,
              moving_time_seconds: 1800,
              elapsed_time_seconds: 1810,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [
            {
              id: "p1",
              name: "Marathon plan",
              status: "active",
              start_date: "2026-08-01",
              end_date: "2026-11-01",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [
            {
              id: "s1",
              scheduled_date: currentDate,
              title: "Long run",
              status: "planned",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <DashboardPage />
    </QueryClientProvider>,
  );

  expect(await screen.findByText("Marathon plan")).toBeInTheDocument();
  expect(screen.getByText("Long run")).toBeInTheDocument();
  expect(screen.getByText("Today")).toBeInTheDocument();
  expect(screen.getByText("easy run")).toBeInTheDocument();
  expect(screen.getByText(/3.2 bpm\/hr/)).toBeInTheDocument();
});
