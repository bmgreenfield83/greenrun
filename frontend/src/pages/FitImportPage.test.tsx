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
