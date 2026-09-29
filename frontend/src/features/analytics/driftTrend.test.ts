import { describe, expect, it } from "vitest";

import { durationWeightedTrend } from "./driftTrend";

const point = (local_date: string, value: number, seconds = 2400) => ({
  local_date,
  adjusted_change_bpm_per_hour: value,
  usable_duration_seconds: seconds,
});

describe("durationWeightedTrend", () => {
  it("requires four results", () => {
    const result = durationWeightedTrend([
      point("2026-08-01", 1),
      point("2026-08-02", 2),
      point("2026-08-03", 3),
    ]);
    expect(result.every((item) => item.trend === null)).toBe(true);
    expect(result.slopePer30Days).toBeNull();
  });

  it("produces a duration-weighted trend", () => {
    const result = durationWeightedTrend([
      point("2026-08-01", 1, 1200),
      point("2026-08-08", 2, 2100),
      point("2026-08-15", 3, 3300),
      point("2026-08-22", 4, 7200),
    ]);
    expect(result[0].trend).toBeLessThan(result[3].trend!);
    expect(result.every((item) => item.trend !== null)).toBe(true);
  });

  it("fits against dates, not list position", () => {
    // Three runs in early August, one two months later. Values rise 1 bpm/h per day during
    // the first three days, then stay flat. An index-based fit would weight the last gap as a
    // single step; a date-based fit spreads it over 60 days, so the slope is much flatter.
    const result = durationWeightedTrend([
      point("2026-08-01", 0),
      point("2026-08-02", 1),
      point("2026-08-03", 2),
      point("2026-10-02", 3),
    ]);
    expect(result.slopePer30Days).not.toBeNull();
    // About 1 bpm/h per 30 days (0.033 per day).
    expect(result.slopePer30Days!).toBeGreaterThan(0.5);
    expect(result.slopePer30Days!).toBeLessThan(3);
    // The trend value on the late date sits on the same line as the early ones.
    // An index-based fit would put the first three runs 1 bpm/h apart each; by date they are
    // only two days apart, so their trend values are nearly equal.
    expect(result[2].trend! - result[0].trend!).toBeLessThan(0.2);
    const [first, , , last] = result;
    const perDay = (last.trend! - first.trend!) / 62;
    expect(perDay * 30).toBeCloseTo(result.slopePer30Days!, 1);
    expect(last.time - first.time).toBe(62 * 86_400_000);
  });

  it("returns a flat line when every run is on the same date", () => {
    const result = durationWeightedTrend([
      point("2026-08-01", 1),
      point("2026-08-01", 3),
      point("2026-08-01", 1),
      point("2026-08-01", 3),
    ]);
    expect(result.every((item) => item.trend === 2)).toBe(true);
    expect(result.slopePer30Days).toBe(0);
  });
});
