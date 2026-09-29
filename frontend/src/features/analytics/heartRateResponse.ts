import type { HeartRateResponseResult } from "../../api/analytics";

type IntervalFields = Pick<
  HeartRateResponseResult,
  | "adjusted_change_lower_90_bpm_per_hour"
  | "adjusted_change_upper_90_bpm_per_hour"
>;

/** The 90% bootstrap interval (version 4+), or null when the result has none. */
export const intervalOf = (result: IntervalFields) =>
  result.adjusted_change_lower_90_bpm_per_hour != null &&
  result.adjusted_change_upper_90_bpm_per_hour != null
    ? ([
        result.adjusted_change_lower_90_bpm_per_hour,
        result.adjusted_change_upper_90_bpm_per_hour,
      ] as const)
    : null;

/** "90%: 1.2 to 4.8 bpm/hour" or null. */
export const intervalLabel = (result: IntervalFields) => {
  const interval = intervalOf(result);
  return interval
    ? `90% interval ${interval[0].toFixed(1)} to ${interval[1].toFixed(1)} bpm/hour`
    : null;
};

/** Results computed by an older algorithm version stay stale until recalculated. */
export const isStale = (
  result: Pick<HeartRateResponseResult, "algorithm_version">,
  currentVersion: number,
) => result.algorithm_version < currentVersion;

/** The newest `count` results from an oldest-first history, newest first. */
export const newestResults = <T extends { local_date: string }>(
  history: T[],
  count: number,
): T[] =>
  [...history]
    .reverse()
    .sort((left, right) => right.local_date.localeCompare(left.local_date))
    .slice(0, count);

/**
 * Current workload-adjusted HR response algorithm version. The Analytics summary reports it as
 * heart_rate_response_algorithm_version; activity pages use this constant to label stale results.
 */
export const CURRENT_HEART_RATE_RESPONSE_VERSION = 4;

export type SecondsRange = { startSeconds: number; endSeconds: number };

/**
 * Elapsed-time ranges used by the HR response fit. Version 4+ stores the real ranges (split at
 * stops over 15 s). Older results only have a start and usable (running) duration; for those the
 * best available approximation is start → analysis_end_seconds, or start + usable duration.
 */
export function analysisRangesOf(
  result: Pick<
    HeartRateResponseResult,
    | "eligible"
    | "analysis_ranges"
    | "analysis_start_seconds"
    | "analysis_end_seconds"
    | "usable_duration_seconds"
  >,
): SecondsRange[] {
  if (!result.eligible) return [];
  if (result.analysis_ranges?.length)
    return result.analysis_ranges.map((range) => ({
      startSeconds: range.start_seconds,
      endSeconds: range.end_seconds,
    }));
  const start = result.analysis_start_seconds;
  if (start == null) return [];
  if (result.analysis_end_seconds != null)
    return [{ startSeconds: start, endSeconds: result.analysis_end_seconds }];
  if (result.usable_duration_seconds != null)
    return [
      {
        startSeconds: start,
        endSeconds: start + result.usable_duration_seconds,
      },
    ];
  return [];
}
