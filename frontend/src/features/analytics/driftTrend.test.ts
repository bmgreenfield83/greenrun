import { describe, expect, it } from "vitest";

import { durationWeightedTrend } from "./driftTrend";

describe("durationWeightedTrend", () => {
  it("requires four results", () => {
    const result = durationWeightedTrend([
      { adjusted_change_bpm_per_hour: 1, usable_duration_seconds: 1200 },
      { adjusted_change_bpm_per_hour: 2, usable_duration_seconds: 1800 },
      { adjusted_change_bpm_per_hour: 3, usable_duration_seconds: 3300 },
    ]);
    expect(result.every((point) => point.trend === null)).toBe(true);
  });

  it("produces a duration-weighted trend", () => {
    const result = durationWeightedTrend([
      { adjusted_change_bpm_per_hour: 1, usable_duration_seconds: 1200 },
      { adjusted_change_bpm_per_hour: 2, usable_duration_seconds: 2100 },
      { adjusted_change_bpm_per_hour: 3, usable_duration_seconds: 3300 },
      { adjusted_change_bpm_per_hour: 4, usable_duration_seconds: 7200 },
    ]);
    expect(result[0].trend).toBeLessThan(result[3].trend!);
    expect(result.every((point) => point.trend !== null)).toBe(true);
  });
});
