import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockFetchRoutes } from "../../test/mockFetch";
import { HeartRateSettingsCard } from "./HeartRateSettingsCard";
import { heartRateReserveZones, validateHeartRates } from "./heartRateSettings";

afterEach(() => vi.restoreAllMocks());

const settings = (maximum: number | null, resting: number | null) => ({
  id: "application",
  timezone: "America/New_York",
  sample_interval_seconds: 5,
  export_size_threshold_bytes: 26214400,
  storage_limit_bytes: 536870912,
  storage_warning_thresholds: [70, 85, 95],
  max_heart_rate_bpm: maximum,
  resting_heart_rate_bpm: resting,
  created_at_utc: "2026-08-05T00:00:00",
  updated_at_utc: "2026-09-29T00:00:00",
});

describe("heart-rate settings helpers", () => {
  it("validates ranges, whole numbers, and resting below max", () => {
    expect(validateHeartRates("194", "55")).toEqual({});
    expect(validateHeartRates("", "")).toEqual({});
    expect(validateHeartRates("99", "")).toEqual({
      maximum: "Max heart rate must be 100–230 bpm.",
    });
    expect(validateHeartRates("", "121")).toEqual({
      resting: "Resting heart rate must be 25–120 bpm.",
    });
    expect(validateHeartRates("19a", "")).toEqual({
      maximum: "Enter a whole number of bpm.",
    });
    expect(validateHeartRates("110", "110")).toEqual({
      resting: "Resting heart rate must be lower than max heart rate.",
    });
  });

  it("derives Karvonen zones like the backend", () => {
    const zones = heartRateReserveZones(194, 55);
    expect(zones[0]).toMatchObject({
      zone: 1,
      lower_bpm: 124.5,
      upper_bpm: 138.4,
    });
    expect(zones[4]).toMatchObject({
      zone: 5,
      lower_bpm: 180.1,
      upper_bpm: 194,
    });
  });
});

describe("HeartRateSettingsCard", () => {
  it("shows zones, validates input, and clears a value with null", async () => {
    const patch = vi.fn((init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<
        string,
        number | null
      >;
      return settings(body.max_heart_rate_bpm, body.resting_heart_rate_bpm);
    });
    mockFetchRoutes({
      "/settings": settings(194, 55),
      "PATCH /settings": patch,
    });
    render(<HeartRateSettingsCard />);

    await waitFor(() =>
      expect(screen.getByLabelText("Max heart rate (bpm)")).toHaveValue("194"),
    );
    expect(
      screen.getByRole("table", { name: "Heart-rate zones" }),
    ).toHaveTextContent("138–152 bpm");
    expect(screen.getByText("Your zones")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Resting heart rate (bpm)"), {
      target: { value: "200" },
    });
    expect(
      screen.getByText("Resting heart rate must be 25–120 bpm."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save heart rate" }),
    ).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Max heart rate (bpm)"), {
      target: { value: "110" },
    });
    fireEvent.change(screen.getByLabelText("Resting heart rate (bpm)"), {
      target: { value: "115" },
    });
    expect(
      screen.getByText("Resting heart rate must be lower than max heart rate."),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Max heart rate (bpm)"), {
      target: { value: "190" },
    });
    fireEvent.change(screen.getByLabelText("Resting heart rate (bpm)"), {
      target: { value: "50" },
    });
    expect(
      screen.getByText("Zones with these values (not saved)"),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Max heart rate (bpm)"), {
      target: { value: "" },
    });
    expect(
      screen.getByText(
        "Enter both max and resting heart rate to see your zones.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save heart rate" }));

    await screen.findByText("Saved.");
    expect(JSON.parse(String(patch.mock.calls[0][0]?.body))).toEqual({
      max_heart_rate_bpm: null,
      resting_heart_rate_bpm: 50,
    });
  });

  it("shows the API's validation message when saving fails", async () => {
    mockFetchRoutes({
      "/settings": settings(null, null),
      "PATCH /settings": () =>
        new Response(
          JSON.stringify({
            error: {
              code: "invalid_settings",
              message:
                "resting_heart_rate_bpm must be lower than max_heart_rate_bpm",
            },
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        ),
    });
    render(<HeartRateSettingsCard />);
    await waitFor(() =>
      expect(screen.getByLabelText("Resting heart rate (bpm)")).toBeEnabled(),
    );
    fireEvent.change(screen.getByLabelText("Resting heart rate (bpm)"), {
      target: { value: "60" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save heart rate" }));
    expect(
      await screen.findByText(/must be lower than max_heart_rate_bpm/),
    ).toBeInTheDocument();
  });
});
