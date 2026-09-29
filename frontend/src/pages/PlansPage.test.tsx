import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { PlansPage } from "./PlansPage";

afterEach(() => vi.restoreAllMocks());

it("warns that importing a conflicting plan archives the active plan", async () => {
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          preview_token: "token",
          expires_in_seconds: 1800,
          name: "Fall Marathon",
          number_of_weeks: 16,
          start_date: "2026-08-09",
          end_date: "2026-11-28",
          planned_session_count: 64,
          total_planned_running_miles: 420,
          conflict: {
            active_plan_id: "old-plan",
            active_plan_name: "Summer Base",
            active_start_date: "2026-06-07",
            active_end_date: "2026-09-05",
            dates_overlap: true,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
  render(<PlansPage />);

  const importHeading = screen.getByRole("heading", {
    name: "Import new plan",
  });
  const plansHeading = screen.getByRole("heading", { name: "Your plans" });
  expect(
    importHeading.compareDocumentPosition(plansHeading) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();

  const file = new File(
    [JSON.stringify({ schema_version: "1.0" })],
    "plan.json",
    {
      type: "application/json",
    },
  );
  Object.defineProperty(file, "text", {
    value: () => Promise.resolve(JSON.stringify({ schema_version: "1.0" })),
  });
  fireEvent.change(screen.getByLabelText("Training plan JSON file"), {
    target: { files: [file] },
  });
  await screen.findByRole("button", { name: "plan.json" });
  fireEvent.click(screen.getByRole("button", { name: "Validate and preview" }));

  expect(await screen.findByText(/archive the active plan/)).toHaveTextContent(
    "Summer Base",
  );
  expect(
    screen.getByRole("button", { name: "Archive old plan and import" }),
  ).toBeInTheDocument();
});
