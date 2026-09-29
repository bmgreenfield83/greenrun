export type WeeklyVolumeWeek = {
  week_start: string;
  week_end: string;
  miles: number;
  run_count: number;
  /** True for the current, still-in-progress week. */
  is_partial: boolean;
  planned_miles: number | null;
  trailing_4_week_average_miles: number | null;
  prior_4_week_average_miles: number | null;
  exceeds_prior_average: boolean;
};

export type PlanProgress = {
  plan_id: string;
  plan_name: string;
  start_date: string;
  end_date: string;
  total_weeks: number;
  current_week_number: number | null;
  total_planned_miles: number;
  planned_miles_to_date: number;
  completed_miles_to_date: number;
  total_sessions: number;
  sessions_due_to_date: number;
  sessions_completed_to_date: number;
  sessions_skipped_to_date: number;
  current_week_planned_miles: number | null;
  current_week_planned_miles_to_date: number | null;
  current_week_completed_miles: number | null;
};

export type BestEffort = {
  distance_label: string;
  distance_meters: number;
  elapsed_seconds: number;
  pace_seconds_per_mile: number;
  activity_id: string;
  activity_title: string | null;
  local_date: string;
  category?: string | null;
  source: "samples" | "lap";
  lap_index?: number | null;
  start_distance_meters?: number | null;
};

export type LongestRun = {
  activity_id: string;
  activity_title: string | null;
  local_date: string;
  distance_meters: number;
  distance_miles: number;
};

export type HighestWeek = { week_start: string; miles: number };

export type AnalysisRange = { start_seconds: number; end_seconds: number };

export type Confidence = "low" | "moderate" | "high";

export type HeartRateResponseResult = {
  activity_id: string;
  activity_title: string | null;
  local_date: string;
  category?: string | null;
  temperature_celsius?: number | null;
  temperature_fahrenheit?: number | null;
  algorithm_version: number;
  eligible: boolean;
  exclusion_reason?: string | null;
  adjusted_change_bpm_per_hour?: number | null;
  /** Version 4+: 90% moving-block bootstrap interval. */
  adjusted_change_lower_90_bpm_per_hour?: number | null;
  adjusted_change_upper_90_bpm_per_hour?: number | null;
  adjusted_total_change_bpm?: number | null;
  response_time_constant_seconds?: number | null;
  r_squared?: number | null;
  rmse_bpm?: number | null;
  analysis_start_seconds?: number | null;
  analysis_end_seconds?: number | null;
  /** Version 4+: contiguous included ranges (split at stops over 15 s). */
  analysis_ranges?: AnalysisRange[] | null;
  analysis_start_distance_meters?: number | null;
  usable_duration_seconds?: number | null;
  stop_count?: number | null;
  stopped_duration_seconds?: number | null;
  bootstrap_resamples?: number | null;
  bootstrap_block_seconds?: number | null;
  confidence?: Confidence | null;
  interpretation?: string | null;
};

export type AnalyticsSummary = {
  as_of_date: string;
  /** Exactly 16 Monday-based weeks, oldest first, ending with the current week. */
  weekly_volume: WeeklyVolumeWeek[];
  weekly_volume_increase_threshold_percent: number;
  plan_progress: PlanProgress | null;
  best_efforts: BestEffort[];
  longest_run: LongestRun | null;
  highest_week: HighestWeek | null;
  /** Eligible results, OLDEST first. */
  heart_rate_response_history: HeartRateResponseResult[];
  heart_rate_response_algorithm_version: number;
};

export type HeartRateZoneBoundary = {
  zone: number;
  lower_bpm: number;
  upper_bpm: number;
  lower_reserve_percent: number;
  upper_reserve_percent: number;
};

export type ZoneWeek = {
  week_start: string;
  week_end: string;
  is_partial: boolean;
  run_count: number;
  /** Seconds in Z1..Z5 (index 0 = Z1). */
  zone_seconds: number[];
  total_seconds: number;
};

export type LoadBand = "low" | "typical" | "elevated" | "spike";

export type TrainingLoadDay = { day: string; trimp: number; run_count: number };

export type TrainingLoad = {
  /** Last 120 days, oldest first, zero-filled. */
  days: TrainingLoadDay[];
  acute_days: number;
  chronic_days: number;
  acute_load: number;
  chronic_load: number;
  acute_chronic_ratio: number | null;
  ratio_band: LoadBand | null;
  chronic_history_complete: boolean;
  bands: Array<{
    label: LoadBand;
    lower: number | null;
    upper: number | null;
    description: string;
  }>;
  guidance: string;
};

export type HeartRateZoneAnalytics = {
  as_of_date: string;
  status: "ok" | "heart_rate_settings_missing";
  message?: string | null;
  max_heart_rate_bpm: number | null;
  resting_heart_rate_bpm: number | null;
  zones: HeartRateZoneBoundary[];
  weekly_time_in_zones: ZoneWeek[];
  easy_run_categories: string[];
  easy_run_weekly_distribution: ZoneWeek[];
  training_load: TrainingLoad | null;
  runs: Array<{
    activity_id: string;
    activity_title: string | null;
    local_date: string;
    category: string | null;
    zone_seconds: number[];
    total_seconds: number;
    trimp: number;
  }>;
  runs_without_heart_rate: number;
};

export type EasyPaceRun = {
  activity_id: string;
  activity_title: string | null;
  local_date: string;
  category: string | null;
  heart_rate_at_reference_bpm: number;
  slope_bpm_per_second_per_mile: number;
  median_grade_adjusted_pace_seconds_per_mile: number;
  median_heart_rate_bpm: number;
  steady_duration_seconds: number;
  temperature_celsius: number | null;
  temperature_fahrenheit: number | null;
};

export type EasyPaceHeartRate = {
  as_of_date: string;
  categories: string[];
  window_start: string;
  /** Null when no run qualifies. */
  reference_pace_seconds_per_mile: number | null;
  /** Last 12 calendar months, oldest first. */
  months: Array<{
    month: string;
    median_heart_rate_bpm: number | null;
    run_count: number;
  }>;
  runs: EasyPaceRun[];
  excluded: Array<{
    activity_id: string;
    activity_title: string | null;
    local_date: string;
    category: string | null;
    reason: string;
  }>;
};

export type GoalEffort = {
  activity_id: string;
  activity_title: string | null;
  local_date: string;
  category: string | null;
  elapsed_seconds: number;
  pace_seconds_per_mile: number;
  source: "samples" | "lap";
  lap_index?: number | null;
  start_distance_meters?: number | null;
};

export type GoalRep = {
  lap_index: number;
  distance_meters: number;
  elapsed_seconds: number;
  pace_seconds_per_mile: number;
  pace_seconds_per_400m: number;
  /** Lap pace minus goal pace (s/mi); negative = faster than goal. */
  pace_delta_seconds_per_mile: number;
  counts_as_rep: boolean;
  at_or_under_goal_pace: boolean;
};

export type GoalTrackSession = {
  activity_id: string;
  activity_title: string | null;
  local_date: string;
  rep_count: number;
  reps_at_or_under_goal_pace: number;
  /** Every 200–1600 m lap in lap order, including warm-up/recovery laps. */
  laps: GoalRep[];
};

export type GoalDefinition = {
  distance_meters: number;
  distance_label: string;
  target_time_seconds: number;
  pace_seconds_per_mile: number;
  pace_seconds_per_400m: number;
};

export type GoalWeek = {
  week_start: string;
  week_end: string;
  is_before_plan: boolean;
  is_future: boolean;
  best_effort: GoalEffort | null;
};

export type GoalProgress = {
  as_of_date: string;
  status: "ok" | "no_active_plan" | "no_goal";
  plan?: {
    plan_id: string;
    plan_name: string;
    start_date: string;
    end_date: string;
  } | null;
  goal?: GoalDefinition | null;
  window_start?: string | null;
  window_end?: string | null;
  weeks: GoalWeek[];
  current_best?: GoalEffort | null;
  /** current_best minus goal time; positive = slower than goal. */
  gap_seconds?: number | null;
  gap_pace_seconds_per_mile?: number | null;
  /** Newest first. */
  track_sessions: GoalTrackSession[];
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

async function getJson<T>(path: string, failure: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`);
  if (!response.ok) throw new Error(failure);
  return response.json() as Promise<T>;
}

export function getAnalytics(): Promise<AnalyticsSummary> {
  return getJson("/analytics/summary", "Analytics could not be loaded.");
}

export function getHeartRateZones(): Promise<HeartRateZoneAnalytics> {
  return getJson(
    "/analytics/heart-rate-zones",
    "Heart-rate zones could not be loaded.",
  );
}

export function getEasyPaceHeartRate(): Promise<EasyPaceHeartRate> {
  return getJson(
    "/analytics/easy-pace-heart-rate",
    "Heart rate at easy pace could not be loaded.",
  );
}

export function getGoalProgress(): Promise<GoalProgress> {
  return getJson("/analytics/goal", "Goal progress could not be loaded.");
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

export function getComparableRuns(
  activityId: string,
): Promise<ComparableRun[]> {
  return getJson(
    `/analytics/activities/${activityId}/comparables`,
    "Comparable runs could not be loaded.",
  );
}

export function getSameWeekdayRuns(
  activityId: string,
): Promise<SameWeekdayRun[]> {
  return getJson(
    `/analytics/activities/${activityId}/same-weekday-runs`,
    "Same-day trends could not be loaded.",
  );
}
