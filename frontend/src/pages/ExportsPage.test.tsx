import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { ExportsPage } from "./ExportsPage";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("downloads a scope-aware JSON export", async () => {
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => "blob:test"),
    revokeObjectURL: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
    () => undefined,
  );
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [], total: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({ schema_version: "1.0", export_type: "week" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
  render(<ExportsPage />);

  expect(
    screen.getByRole("checkbox", {
      name: "Include walks, bike rides, and other activity types",
    }),
  ).not.toBeChecked();

  fireEvent.change(screen.getByLabelText("Start date"), {
    target: { value: "2026-08-03" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Download range export" }),
  );

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(fetchMock.mock.calls[1][0]).toContain("/exports");
  expect(fetchMock.mock.calls[1][1]?.body).toContain('"scope":"week"');
  expect(fetchMock.mock.calls[1][1]?.body).toContain(
    '"include_all_activities":false',
  );
});
