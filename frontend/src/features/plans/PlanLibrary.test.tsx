import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { PlanLibrary } from "./PlanLibrary";

afterEach(() => vi.restoreAllMocks());

it("shows the active schedule and archived plan exports", async () => {
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [
            {
              id: "p1",
              name: "Current plan",
              description: "Build steadily",
              primary_goal: "Improve 10K performance",
              secondary_goal: "Build durable mileage",
              status: "active",
              start_date: "2026-08-03",
              end_date: "2026-08-30",
              week_summaries: [
                { week_number: 1, focus: "Base", planned_running_miles: 20 },
              ],
            },
            {
              id: "p0",
              name: "Old plan",
              description: null,
              status: "archived",
              start_date: "2026-01-01",
              end_date: "2026-03-01",
              week_summaries: [],
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
              scheduled_date: "2026-08-04",
              title: "Easy aerobic run",
              status: "planned",
              planned_distance_meters: 8046.72,
              justification: "Supports the plan's aerobic goals.",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

  render(<PlanLibrary refreshKey={0} />);

  expect(await screen.findByText("Current plan")).toBeInTheDocument();
  expect(screen.getByText("Week 1 — Base")).toBeInTheDocument();
  expect(screen.getByText("Easy aerobic run")).toBeInTheDocument();
  expect(screen.getByText("Improve 10K performance")).toBeInTheDocument();
  expect(screen.getByText("Build durable mileage")).toBeInTheDocument();
  expect(screen.getByText("Supports the plan's aerobic goals.")).toBeInTheDocument();
  expect(screen.getByText("Old plan")).toBeInTheDocument();
});
