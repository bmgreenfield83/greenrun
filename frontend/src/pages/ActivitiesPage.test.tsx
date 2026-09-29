import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { ActivitiesPage } from "./ActivitiesPage";
import {
  clearActivityListState,
  setActivityListState,
} from "../features/activities/activityListState";

afterEach(() => {
  clearActivityListState();
  vi.restoreAllMocks();
});

const activity = (index: number) => ({
  id: `activity-${index}`,
  sport: "run",
  category: index === 26 ? "track" : "easy",
  title: `Run ${index}`,
  local_date: "2026-08-05",
  distance_meters: 5000,
  elapsed_time_seconds: 1800,
  moving_time_seconds: 1750,
  summary: { average_speed_mps: 2.85 },
  planned_session_id: null,
});

it("loads additional activity pages without hiding older records", async () => {
  const firstPage = Array.from({ length: 25 }, (_, index) =>
    activity(index + 1),
  );
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ items: firstPage, total: 26 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [activity(26)], total: 26 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

  render(<ActivitiesPage />);

  expect(
    await screen.findByText("Showing 25 of 26 activities"),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Load more" }));

  expect(await screen.findByText("Track Run")).toBeInTheDocument();
  expect(screen.getByText("Showing 26 of 26 activities")).toBeInTheDocument();
  expect(screen.getAllByText(/Aug 5, 2026/)).toHaveLength(1);
  expect(fetchMock.mock.calls[1][0]).toContain("skip=25&limit=25");
});

it("sends sport and date filters to the activity API", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ items: [], total: 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  render(<ActivitiesPage />);
  await screen.findByText("No activities yet");

  fireEvent.mouseDown(screen.getByRole("combobox", { name: "Sport" }));
  fireEvent.click(screen.getByRole("option", { name: "Bike" }));
  fireEvent.change(screen.getByLabelText("From"), {
    target: { value: "2026-08-01" },
  });
  fireEvent.change(screen.getByLabelText("Through"), {
    target: { value: "2026-08-31" },
  });

  await waitFor(() => {
    const finalUrl = String(fetchMock.mock.calls.at(-1)?.[0]);
    expect(finalUrl).toContain("sport=bike");
    expect(finalUrl).toContain("start_date=2026-08-01");
    expect(finalUrl).toContain("end_date=2026-08-31");
  });
});

it("restores the loaded list without refetching after detail navigation", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ items: [activity(1)], total: 1 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  const firstRender = render(<ActivitiesPage />);

  expect(await screen.findByText("Easy Run")).toBeInTheDocument();
  firstRender.unmount();
  render(<ActivitiesPage />);

  expect(screen.getByText("Easy Run")).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("does not refetch restored state when Strict Mode replays effects", () => {
  const cachedActivity = activity(1);
  setActivityListState({
    activities: [cachedActivity as never],
    total: 1,
    sport: "",
    startDate: "",
    endDate: "",
    scrollY: 0,
    loadedAt: Date.now(),
  });
  const fetchMock = vi.spyOn(globalThis, "fetch");

  render(
    <StrictMode>
      <ActivitiesPage />
    </StrictMode>,
  );

  expect(screen.getByText("Easy Run")).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});
