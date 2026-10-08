import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { FitImportPage } from "./FitImportPage";

afterEach(() => vi.restoreAllMocks());

const preview = {
  preview_token: "preview-token",
  expires_in_seconds: 1800,
  activity: {
    sport: "run",
    category: "easy",
    title: "Synthetic run",
    started_at_utc: "2026-08-04T11:00:00Z",
    local_date: "2026-08-04",
    distance_meters: 5000,
    elapsed_time_seconds: 1800,
    moving_time_seconds: 1790,
    summary: {
      average_heart_rate: 150,
      maximum_heart_rate: 170,
      average_speed_mps: 2.78,
      average_cadence_spm: 165,
      elevation_gain_meters: 20,
      temperature_celsius: 25,
      humidity_percent: null,
    },
    laps: [{}],
    subjective: {
      effort: null,
      feel: null,
      sleep_score: null,
      sleep_label: null,
      pain_soreness_notes: null,
      notes: null,
    },
    weather_notes: null,
    planned_session_id: null,
  },
  sample_count: 360,
  duplicate_matches: [
    {
      activity_id: "existing",
      title: "Existing run",
      local_date: "2026-08-04",
      reason: "checksum",
    },
  ],
  suggested_planned_session: null,
};

it("uploads a FIT file and displays preview and duplicate details", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(preview), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  render(<FitImportPage />);

  fireEvent.change(screen.getByLabelText("Garmin FIT files"), {
    target: {
      files: [
        new File(["fit"], "activity.fit", { type: "application/octet-stream" }),
      ],
    },
  });

  expect(
    await screen.findByRole("heading", { name: "Review Garmin FIT activity" }),
  ).toBeInTheDocument();
  expect(screen.getByDisplayValue("Synthetic run")).toBeInTheDocument();
  expect(screen.getByText(/likely duplicate activity/)).toBeInTheDocument();
  expect(screen.getByText("360")).toBeInTheDocument();
  expect(screen.getByText("165 spm")).toBeInTheDocument();
  expect(screen.getByText("66 ft")).toBeInTheDocument();
  expect(screen.getByText("77°F")).toBeInTheDocument();
});

it("uses bike-specific metrics in the import review", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        ...preview,
        activity: {
          ...preview.activity,
          sport: "bike",
          category: null,
          title: "Morning ride",
        },
        duplicate_matches: preview.duplicate_matches,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );
  render(<FitImportPage />);

  fireEvent.change(screen.getByLabelText("Garmin FIT files"), {
    target: {
      files: [
        new File(["fit"], "ride.fit", { type: "application/octet-stream" }),
      ],
    },
  });

  expect(await screen.findByText("Average speed")).toBeInTheDocument();
  expect(screen.getByText("6.2 mph")).toBeInTheDocument();
  expect(screen.getByText("165 rpm")).toBeInTheDocument();
  expect(screen.queryByText("Average pace")).not.toBeInTheDocument();
});

it("automatically saves multiple straightforward files and shows their results", async () => {
  const straightforward = { ...preview, duplicate_matches: [] };
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response(JSON.stringify(straightforward), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify(straightforward), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          activity: { id: "a1", title: "Run 1" },
          samples_persisted: 10,
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          activity: { id: "a2", title: "Run 2" },
          samples_persisted: 10,
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );
  render(<FitImportPage />);

  fireEvent.change(screen.getByLabelText("Garmin FIT files"), {
    target: {
      files: [new File(["one"], "one.fit"), new File(["two"], "two.fit")],
    },
  });

  expect(
    await screen.findByText("Import complete: 2 imported."),
  ).toBeInTheDocument();
  expect(screen.getAllByRole("link", { name: /View activity/ })).toHaveLength(
    2,
  );
});

it("accepts a FIT file by drag and drop", async () => {
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ ...preview, duplicate_matches: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          activity: { id: "a1", title: "Run" },
          samples_persisted: 10,
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );
  render(<FitImportPage />);

  fireEvent.drop(screen.getByTestId("fit-drop-zone"), {
    dataTransfer: { files: [new File(["fit"], "dropped.fit")] },
  });

  expect(
    await screen.findByText("Import complete: 1 imported."),
  ).toBeInTheDocument();
  expect(screen.getByText("dropped.fit")).toBeInTheDocument();
});

// -- Garmin Connect sync ----------------------------------------------------------------------

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const garminRun = (changes: Record<string, unknown> = {}) => ({
  garmin_activity_id: "1001",
  name: "Annapolis Running",
  started_at_local: "2026-10-08 06:15:00",
  distance_meters: 8046.7,
  status: "ready",
  activity_id: null,
  preview: { ...preview, duplicate_matches: [] },
  error: null,
  ...changes,
});

it("syncs a day's new run from Garmin and saves it through the import queue", async () => {
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      json({ date: "2026-10-07", status: "ready", items: [garminRun()] }),
    )
    .mockResolvedValueOnce(
      json({ activity: { id: "a-1", title: "Run" }, samples_persisted: 360 }),
    );
  render(<FitImportPage />);

  fireEvent.change(screen.getByLabelText("Activity date"), {
    target: { value: "2026-10-07" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Sync from Garmin" }));

  expect(
    await screen.findByText(/Found 1 run to import from/),
  ).toBeInTheDocument();
  expect(await screen.findByText("Imported")).toBeInTheDocument();
  expect(screen.getByText("Annapolis Running")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "View activity" })).toHaveAttribute(
    "href",
    "/activities/a-1",
  );
  const [syncUrl, syncInit] = fetchMock.mock.calls[0];
  expect(String(syncUrl)).toMatch(/\/activities\/garmin-sync$/);
  expect(JSON.parse(String(syncInit?.body))).toEqual({ date: "2026-10-07" });
  const [confirmUrl, confirmInit] = fetchMock.mock.calls[1];
  expect(String(confirmUrl)).toMatch(/\/import-fit\/confirm$/);
  expect(JSON.parse(String(confirmInit?.body)).preview_token).toBe(
    "preview-token",
  );
});

it("defaults the sync date to today and shows progress while syncing", async () => {
  let finish: (response: Response) => void = () => {};
  vi.spyOn(globalThis, "fetch").mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  render(<FitImportPage />);

  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  expect(screen.getByLabelText("Activity date")).toHaveValue(iso);

  fireEvent.click(screen.getByRole("button", { name: "Sync from Garmin" }));
  expect(screen.getByRole("button", { name: "Syncing…" })).toBeDisabled();

  finish(json({ date: iso, status: "no_activities", items: [] }));
  expect(
    await screen.findByText(/No runs on Garmin Connect for/),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Sync from Garmin" }),
  ).toBeEnabled();
});

it("links to runs that were already imported instead of importing them again", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    json({
      date: "2026-10-08",
      status: "already_imported",
      items: [
        garminRun({
          status: "already_imported",
          activity_id: "a-9",
          preview: null,
        }),
      ],
    }),
  );
  render(<FitImportPage />);

  fireEvent.click(screen.getByRole("button", { name: "Sync from Garmin" }));

  expect(await screen.findByText(/is already in Greenrun/)).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Annapolis Running" }),
  ).toHaveAttribute("href", "/activities/a-9");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("Import queue")).not.toBeInTheDocument();
});

it("shows a run Garmin could not provide in the queue", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    json({
      date: "2026-10-08",
      status: "failed",
      items: [
        garminRun({
          status: "error",
          preview: null,
          error: "The Garmin download did not contain a FIT file.",
        }),
      ],
    }),
  );
  render(<FitImportPage />);

  fireEvent.click(screen.getByRole("button", { name: "Sync from Garmin" }));

  expect(
    await screen.findByText(/could not be downloaded/),
  ).toBeInTheDocument();
  expect(
    screen.getByText("The Garmin download did not contain a FIT file."),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Retry" }),
  ).not.toBeInTheDocument();
});

it("explains Garmin sign-in problems from the server", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    json(
      {
        error: {
          code: "garmin_setup_required",
          message: "Garmin needs you to sign in again.",
        },
      },
      503,
    ),
  );
  render(<FitImportPage />);

  fireEvent.click(screen.getByRole("button", { name: "Sync from Garmin" }));

  expect(
    await screen.findByText("Garmin needs you to sign in again."),
  ).toBeInTheDocument();
});
