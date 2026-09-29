import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { ActivityDetailPage } from "./ActivityDetailPage";

afterEach(() => vi.restoreAllMocks());

const activity = {
  id: "activity-1",
  sport: "run",
  category: "easy",
  title: "Morning run",
  started_at_utc: "2026-08-04T11:00:00Z",
  timezone: "America/New_York",
  local_date: "2026-08-04",
  distance_meters: 5000,
  elapsed_time_seconds: 1800,
  moving_time_seconds: 1750,
  summary: {
    average_speed_mps: 2.86,
    average_heart_rate: 145,
    maximum_heart_rate: 165,
  },
  laps: [
    {
      index: 1,
      elapsed_time_seconds: 900,
      moving_time_seconds: 890,
      distance_meters: 2500,
      average_speed_mps: 2.8,
      average_heart_rate: 142,
      maximum_heart_rate: 155,
      average_cadence_spm: 164,
      elevation_gain_meters: 10,
      lap_trigger: "distance",
    },
  ],
  subjective: {
    effort: 4,
    effort_label: null,
    feel: "good",
    sleep_score: 80,
    sleep_label: "good",
    pain_soreness_notes: null,
    notes: "Steady",
  },
  weather_notes: "Warm",
  source: { type: "fit" },
  planned_session_id: null,
  derived_metrics: {
    heart_rate_response: {
      eligible: true,
      adjusted_change_bpm_per_hour: 4.8,
      adjusted_total_change_bpm: 3.4,
      response_time_constant_seconds: 45,
      r_squared: 0.82,
      rmse_bpm: 3.6,
      exclusion_reason: null,
      algorithm_version: 3,
      confidence: "low",
      analysis_start_seconds: 300,
      usable_duration_seconds: 1500,
      interpretation: "Estimated after accounting for speed and grade.",
    },
  },
  schema_version: 1,
};

it("shows activity details and exact lap data", async () => {
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response(JSON.stringify(activity), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [], total: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            activity_id: "activity-2",
            title: "Similar run",
            local_date: "2026-07-28",
            distance_miles: 3.2,
            pace_seconds_per_mile: 590,
            average_heart_rate: 143,
            temperature_fahrenheit: 70,
            humidity_percent: null,
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            activity_id: "activity-2",
            title: "Earlier Tuesday run",
            local_date: "2026-07-28",
            category: "track",
            distance_miles: 3.2,
            pace_seconds_per_mile: 590,
            average_heart_rate: 143,
            is_current: false,
          },
          {
            activity_id: "activity-1",
            title: "Morning run",
            local_date: "2026-08-04",
            category: "easy",
            distance_miles: 3.11,
            pace_seconds_per_mile: 562.7,
            average_heart_rate: 145,
            is_current: true,
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
  render(<ActivityDetailPage activityId="activity-1" />);

  expect(
    await screen.findByRole("heading", { name: "Morning run" }),
  ).toBeInTheDocument();
  expect(screen.getByText("3.11 mi")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Laps" })).toBeInTheDocument();
  expect(screen.getByText("4.8 bpm/hour")).toBeInTheDocument();
  expect(
    screen.getByText(/low confidence.*Algorithm version 3/),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Comparable runs" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Same-day trend" }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Y1 axis")).toHaveTextContent("Average pace");
  expect(screen.getByLabelText("Y2 axis")).toHaveTextContent(
    "Average heart rate",
  );
  fetchMock
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...activity,
          heart_rate_analysis_start_distance_meters: 5632.704,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ eligible: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...activity,
          heart_rate_analysis_start_distance_meters: 5632.704,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
  fireEvent.change(screen.getByLabelText("Ignore HR analysis before mile"), {
    target: { value: "3.5" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Apply and recalculate" }),
  );
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(7));
  expect(fetchMock.mock.calls[4]?.[1]?.body).toContain("5632.704");
  expect(fetchMock.mock.calls[5]?.[0]).toContain(
    "/recalculate-heart-rate-response",
  );
  expect(screen.getByText("distance")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  expect(screen.getByLabelText("Effort (0–10)")).toHaveValue(4);
});

it("uses cycling units throughout bike activity details", async () => {
  const bike = {
    ...activity,
    id: "bike-1",
    sport: "bike",
    category: null,
    title: "Morning ride",
    summary: {
      ...activity.summary,
      average_speed_mps: 8,
      average_cadence_spm: 82,
    },
    laps: [
      {
        ...activity.laps[0],
        average_speed_mps: 8,
        average_cadence_spm: 82,
      },
    ],
    derived_metrics: {},
  };
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response(JSON.stringify(bike), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [], total: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

  render(<ActivityDetailPage activityId="bike-1" />);

  expect(
    await screen.findByRole("heading", { name: "Morning ride" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Average speed")).toBeInTheDocument();
  expect(screen.getAllByText("17.9 mph").length).toBeGreaterThan(0);
  expect(screen.getByText("Cadence (RPM)")).toBeInTheDocument();
  expect(screen.queryByText("Average pace")).not.toBeInTheDocument();
});
