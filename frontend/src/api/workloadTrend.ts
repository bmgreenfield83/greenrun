export type WorkloadRun = {
  activity_id: string;
  title: string | null;
  local_date: string;
  heart_rate_bpm: number;
  pace_seconds_per_mile: number;
  matched_minutes: number;
  temperature_fahrenheit: number | null;
};

export type WorkloadComparison = {
  id: string;
  category: string;
  pace_seconds_per_mile: number;
  start_minute: number;
  end_minute: number;
  temperature_min_fahrenheit: number | null;
  temperature_max_fahrenheit: number | null;
  runs: WorkloadRun[];
  weeks: Array<{
    week_start: string;
    median_heart_rate_bpm: number;
    minimum_heart_rate_bpm: number;
    maximum_heart_rate_bpm: number;
    run_count: number;
  }>;
};

export type WorkloadTrend = {
  algorithm_version: number;
  start_date: string;
  end_date: string;
  runs_screened: number;
  qualifying_runs: number;
  exclusion_counts: Record<string, number>;
  comparisons: WorkloadComparison[];
};

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";

export async function getWorkloadTrend(
  signal: AbortSignal,
): Promise<WorkloadTrend> {
  const response = await fetch(
    `${apiBaseUrl}/analytics/comparable-heart-rate`,
    { signal },
  );
  if (!response.ok)
    throw new Error("Comparable heart-rate trends could not be loaded.");
  return response.json() as Promise<WorkloadTrend>;
}
