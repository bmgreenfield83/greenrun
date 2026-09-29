import { dateValue } from "./format";

export type DriftTrendPoint = {
  local_date: string;
  adjusted_change_bpm_per_hour?: number | null;
  usable_duration_seconds?: number | null;
};

const DAY_MS = 86_400_000;

/**
 * Duration-weighted least-squares trend of adjusted HR change against the run's DATE
 * (not its position in the list), so uneven gaps between runs are respected.
 * Weights use usable duration clamped to 20–55 minutes, so one long run cannot dominate.
 * Returns each point with `time` (UTC ms of its local date) and `trend` (null with fewer
 * than four results), plus the slope in bpm/hour per 30 days.
 */
export function durationWeightedTrend<T extends DriftTrendPoint>(
  points: T[],
): Array<T & { time: number; trend: number | null }> & {
  slopePer30Days: number | null;
} {
  const withTime = points.map((point) => ({
    ...point,
    time: dateValue(point.local_date),
  }));
  const finish = (
    trendAt: ((day: number) => number) | null,
    slopePer30Days: number | null,
  ) =>
    Object.assign(
      withTime.map((point) => ({
        ...point,
        trend: trendAt ? +trendAt(point.time / DAY_MS).toFixed(2) : null,
      })),
      { slopePer30Days },
    );

  const usable = withTime
    .filter((point) => point.adjusted_change_bpm_per_hour != null)
    .map((point) => ({
      day: point.time / DAY_MS,
      value: point.adjusted_change_bpm_per_hour as number,
      weight:
        Math.min(3300, Math.max(1200, point.usable_duration_seconds ?? 1200)) /
        3300,
    }));
  if (usable.length < 4) return finish(null, null);
  const weightTotal = usable.reduce((sum, point) => sum + point.weight, 0);
  const meanDay =
    usable.reduce((sum, point) => sum + point.day * point.weight, 0) /
    weightTotal;
  const meanValue =
    usable.reduce((sum, point) => sum + point.value * point.weight, 0) /
    weightTotal;
  const denominator = usable.reduce(
    (sum, point) => sum + point.weight * (point.day - meanDay) ** 2,
    0,
  );
  if (!denominator) return finish(() => meanValue, 0);
  const slope =
    usable.reduce(
      (sum, point) =>
        sum + point.weight * (point.day - meanDay) * (point.value - meanValue),
      0,
    ) / denominator;
  return finish((day) => meanValue + slope * (day - meanDay), slope * 30);
}
