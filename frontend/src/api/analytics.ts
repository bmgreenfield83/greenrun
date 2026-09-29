export type AnalyticsSummary = {
  as_of_date: string;
  rolling_7_day_miles: number;
  rolling_28_day_miles: number;
  rolling_90_day_miles: number;
  weekly_mileage: Array<{ week_start: string; miles: number }>;
  plan_progress: null | {
    plan_name: string;
    planned_miles: number;
    completed_miles: number;
    completed_sessions: number;
    total_sessions: number;
    skipped_sessions: number;
    rescheduled_sessions: number;
    current_week_planned_miles: number;
    current_week_completed_miles: number;
  };
  personal_bests: Array<{
    label: string;
    value: string;
    activity_id: string | null;
    local_date: string;
  }>;
  temperature_bands: Array<{
    label: string;
    activity_count: number;
    average_pace_seconds_per_mile: number | null;
  }>;
  heart_rate_response_history: Array<{
    activity_id: string;
    activity_title: string | null;
    local_date: string;
    category: string | null;
    eligible: boolean;
    adjusted_change_bpm_per_hour: number | null;
    adjusted_total_change_bpm: number | null;
    response_time_constant_seconds: number | null;
    r_squared: number | null;
    rmse_bpm: number | null;
    exclusion_reason: string | null;
    confidence: "low" | "moderate" | "high" | null;
    usable_duration_seconds: number | null;
    analysis_start_seconds: number | null;
    interpretation: string | null;
  }>;
};

export type ComparableRun = {
  activity_id: string;
  title: string | null;
  local_date: string;
  distance_miles: number;
  pace_seconds_per_mile: number | null;
  average_heart_rate: number | null;
  temperature_fahrenheit: number | null;
  humidity_percent: number | null;
};

export type SameWeekdayRun = {
  activity_id: string;
  title: string | null;
  local_date: string;
  category: string | null;
  distance_miles: number;
  pace_seconds_per_mile: number | null;
  average_heart_rate: number | null;
  is_current: boolean;
};

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";

export async function getAnalytics(): Promise<AnalyticsSummary> {
  const response = await fetch(`${apiBaseUrl}/analytics/summary`);
  if (!response.ok) throw new Error("Analytics could not be loaded.");
  return response.json() as Promise<AnalyticsSummary>;
}

export async function recalculateHeartRateResponse(): Promise<void> {
  const response = await fetch(
    `${apiBaseUrl}/analytics/recalculate-heart-rate-response`,
    { method: "POST" },
  );
  if (!response.ok)
    throw new Error("Heart-rate response could not be recalculated.");
}

export async function recalculateActivityHeartRateResponse(
  activityId: string,
): Promise<void> {
  const response = await fetch(
    `${apiBaseUrl}/analytics/activities/${activityId}/recalculate-heart-rate-response`,
    { method: "POST" },
  );
  if (!response.ok)
    throw new Error(
      "This activity's heart-rate response could not be recalculated.",
    );
}

export async function getComparableRuns(
  activityId: string,
): Promise<ComparableRun[]> {
  const response = await fetch(
    `${apiBaseUrl}/analytics/activities/${activityId}/comparables`,
  );
  if (!response.ok) throw new Error("Comparable runs could not be loaded.");
  return response.json() as Promise<ComparableRun[]>;
}

export async function getSameWeekdayRuns(
  activityId: string,
): Promise<SameWeekdayRun[]> {
  const response = await fetch(
    `${apiBaseUrl}/analytics/activities/${activityId}/same-weekday-runs`,
  );
  if (!response.ok) throw new Error("Same-day trends could not be loaded.");
  return response.json() as Promise<SameWeekdayRun[]>;
}
