export type DriftTrendPoint = {
  adjusted_change_bpm_per_hour: number | null;
  usable_duration_seconds: number | null;
};

export function durationWeightedTrend<T extends DriftTrendPoint>(
  points: T[],
): Array<T & { trend: number | null }> {
  if (points.length < 4)
    return points.map((point) => ({ ...point, trend: null }));
  const usable = points.map((point, index) => ({
    index,
    value: point.adjusted_change_bpm_per_hour,
    weight:
      point.adjusted_change_bpm_per_hour == null
        ? 0
        : Math.min(
            3300,
            Math.max(1200, point.usable_duration_seconds ?? 1200),
          ) / 3300,
  }));
  const weightTotal = usable.reduce((sum, point) => sum + point.weight, 0);
  if (!weightTotal) return points.map((point) => ({ ...point, trend: null }));
  const meanIndex =
    usable.reduce((sum, point) => sum + point.index * point.weight, 0) /
    weightTotal;
  const meanValue =
    usable.reduce((sum, point) => sum + (point.value ?? 0) * point.weight, 0) /
    weightTotal;
  const denominator = usable.reduce(
    (sum, point) => sum + point.weight * (point.index - meanIndex) ** 2,
    0,
  );
  if (!denominator)
    return points.map((point) => ({ ...point, trend: meanValue }));
  const slope =
    usable.reduce(
      (sum, point) =>
        sum +
        point.weight *
          (point.index - meanIndex) *
          ((point.value ?? meanValue) - meanValue),
      0,
    ) / denominator;
  return points.map((point, index) => ({
    ...point,
    trend: +(meanValue + slope * (index - meanIndex)).toFixed(2),
  }));
}
