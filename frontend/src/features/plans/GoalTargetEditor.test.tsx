import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TrainingPlan } from "../../api/plans";
import { mockFetchRoutes } from "../../test/mockFetch";
import { GoalTargetEditor } from "./GoalTargetEditor";
import { describeGoal, goalDistanceLabel, parseTargetTime } from "./goalTarget";

afterEach(() => vi.restoreAllMocks());

const plan = (goal: TrainingPlan["goal_target"]): TrainingPlan => ({
  id: "p1",
  name: "Sub-6 Mile Block",
  description: null,
  primary_goal: "Run one mile in under 6:00.",
  status: "active",
  start_date: "2026-09-07",
  end_date: "2026-12-06",
  week_starts_on: "monday",
  week_summaries: [],
  goal_target: goal,
});

describe("goal target helpers", () => {
  it("parses m:ss and h:mm:ss", () => {
    expect(parseTargetTime("6:00")).toBe(360);
    expect(parseTargetTime("5:59.5")).toBe(359.5);
    expect(parseTargetTime("1:45:30")).toBe(6330);
    expect(parseTargetTime("6:75")).toBeNull();
    expect(parseTargetTime("1:75:00")).toBeNull();
    expect(parseTargetTime("fast")).toBeNull();
    expect(parseTargetTime("0:00")).toBeNull();
  });

  it("labels distances and describes goals generically", () => {
    expect(goalDistanceLabel(1609.344)).toBe("1 mile");
    expect(goalDistanceLabel(21097.5)).toBe("Half marathon");
    expect(goalDistanceLabel(3218.688)).toBe("2 miles");
    expect(goalDistanceLabel(3000)).toBe("3 km");
    expect(goalDistanceLabel(800)).toBe("800 m");
    expect(
      describeGoal({ distance_meters: 5000, target_time_seconds: 1200 }),
    ).toBe("5K in 20:00 (6:26/mi)");
  });
});

describe("GoalTargetEditor", () => {
  it("sets a preset goal, a custom goal, and clears it", async () => {
    const bodies: unknown[] = [];
    mockFetchRoutes({
      "PATCH /plans/p1": (init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as {
          goal_target: TrainingPlan["goal_target"];
        };
        bodies.push(body);
        return plan(body.goal_target);
      },
    });
    const onSaved = vi.fn();
    const { rerender } = render(
      <GoalTargetEditor plan={plan(null)} onSaved={onSaved} />,
    );

    expect(screen.getByText("No structured goal")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Set goal" }));
    const form = screen.getByRole("form", {
      name: "Goal for Sub-6 Mile Block",
    });
    fireEvent.change(within(form).getByLabelText("Target time"), {
      target: { value: "6:7" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Save goal" }));
    expect(await screen.findByText(/Use m:ss or h:mm:ss/)).toBeInTheDocument();
    expect(bodies).toHaveLength(0);

    fireEvent.change(within(form).getByLabelText("Target time"), {
      target: { value: "6:00" },
    });
    expect(
      within(form).getByText("1 mile in 6:00 (6:00/mi)"),
    ).toBeInTheDocument();
    fireEvent.click(within(form).getByRole("button", { name: "Save goal" }));
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(bodies[0]).toEqual({
      goal_target: { distance_meters: 1609.344, target_time_seconds: 360 },
    });

    rerender(
      <GoalTargetEditor
        plan={plan({ distance_meters: 1609.344, target_time_seconds: 360 })}
        onSaved={onSaved}
      />,
    );
    expect(
      screen.getByText("Goal: 1 mile in 6:00 (6:00/mi)"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit goal" }));
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Distance" }));
    fireEvent.click(screen.getByRole("option", { name: "Custom…" }));
    fireEvent.change(screen.getByLabelText("Custom distance"), {
      target: { value: "3" },
    });
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Unit" }));
    fireEvent.click(screen.getByRole("option", { name: "km" }));
    fireEvent.change(screen.getByLabelText("Target time"), {
      target: { value: "11:30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save goal" }));
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(2));
    expect(bodies[1]).toEqual({
      goal_target: { distance_meters: 3000, target_time_seconds: 690 },
    });

    fireEvent.click(screen.getByRole("button", { name: "Edit goal" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear goal" }));
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(3));
    expect(bodies[2]).toEqual({ goal_target: null });
  });
});
