import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { CalendarPage } from "./CalendarPage";

vi.mock("@fullcalendar/react", () => ({
  default: (props: {
    events: unknown[];
    datesSet: (range: { start: Date; end: Date }) => void;
  }) => (
    <div>
      <button
        onClick={() =>
          props.datesSet({
            start: new Date(2026, 7, 1),
            end: new Date(2026, 8, 1),
          })
        }
      >
        Load calendar
      </button>
      <span data-testid="visible-event-count">{props.events.length}</span>
    </div>
  ),
}));
vi.mock("../features/calendar/DayDetailDrawer", () => ({
  DayDetailDrawer: () => null,
}));

afterEach(() => vi.restoreAllMocks());

it("filters planned and completed calendar events independently", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        events: [
          {
            id: "planned",
            kind: "planned_session",
            title: "Easy run",
            date: "2026-08-05",
            sport: "run",
            status: "planned",
            activity_id: null,
          },
          {
            id: "completed",
            kind: "activity",
            title: "Bike",
            date: "2026-08-05",
            sport: "bike",
            status: "completed",
            activity_id: "a1",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );
  render(<CalendarPage />);
  fireEvent.click(screen.getByRole("button", { name: "Load calendar" }));

  await waitFor(() =>
    expect(screen.getByTestId("visible-event-count")).toHaveTextContent("2"),
  );
  fireEvent.click(screen.getByRole("switch", { name: "Planned" }));
  expect(screen.getByTestId("visible-event-count")).toHaveTextContent("1");
  fireEvent.click(screen.getByRole("switch", { name: "Completed" }));
  expect(screen.getByTestId("visible-event-count")).toHaveTextContent("0");
});
