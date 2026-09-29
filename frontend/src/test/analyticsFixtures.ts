import type {
  AnalyticsSummary,
  EasyPaceHeartRate,
  GoalProgress,
  HeartRateResponseResult,
  HeartRateZoneAnalytics,
  WeeklyVolumeWeek,
  ZoneWeek,
} from "../api/analytics";

const addDays = (date: string, days: number) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

const FIRST_WEEK = "2026-06-15";

export function weeklyVolume(): WeeklyVolumeWeek[] {
  return Array.from({ length: 16 }, (_, index) => {
    const start = addDays(FIRST_WEEK, index * 7);
    const partial = index === 15;
    return {
      week_start: start,
      week_end: addDays(start, 6),
      miles: partial ? 3.9 : 10 + index,
      run_count: 3,
      is_partial: partial,
      planned_miles: index >= 12 ? 23 : null,
      trailing_4_week_average_miles: partial || index < 3 ? null : 8.5 + index,
      prior_4_week_average_miles: index < 4 ? null : 7.5 + index,
      exceeds_prior_average: index === 13,
    };
  });
}

export const heartRateResult = (
  overrides: Partial<HeartRateResponseResult> & {
    local_date: string;
    activity_id: string;
  },
): HeartRateResponseResult => ({
  activity_title: "Run",
  category: "easy",
  temperature_celsius: 20,
  temperature_fahrenheit: 68,
  algorithm_version: 4,
  eligible: true,
  exclusion_reason: null,
  adjusted_change_bpm_per_hour: 3,
  adjusted_change_lower_90_bpm_per_hour: 1,
  adjusted_change_upper_90_bpm_per_hour: 5,
  adjusted_total_change_bpm: 2,
  response_time_constant_seconds: 60,
  r_squared: 0.8,
  rmse_bpm: 3,
  analysis_start_seconds: 300,
  analysis_end_seconds: 2700,
  analysis_ranges: [{ start_seconds: 300, end_seconds: 2700 }],
  usable_duration_seconds: 2400,
  confidence: "high",
  interpretation: null,
  ...overrides,
});

export function analyticsSummary(
  overrides: Partial<AnalyticsSummary> = {},
): AnalyticsSummary {
  return {
    as_of_date: "2026-09-29",
    weekly_volume: weeklyVolume(),
    weekly_volume_increase_threshold_percent: 15,
    plan_progress: {
      plan_id: "p1",
      plan_name: "Sub-6 Mile Block",
      start_date: "2026-09-07",
      end_date: "2026-12-06",
      total_weeks: 13,
      current_week_number: 4,
      total_planned_miles: 296.5,
      planned_miles_to_date: 68.3,
      completed_miles_to_date: 47.6,
      total_sessions: 64,
      sessions_due_to_date: 15,
      sessions_completed_to_date: 12,
      sessions_skipped_to_date: 3,
      current_week_planned_miles: 24.1,
      current_week_planned_miles_to_date: 5.5,
      current_week_completed_miles: 3.9,
    },
    best_efforts: [
      {
        distance_label: "1 mile",
        distance_meters: 1609.344,
        elapsed_seconds: 410.2,
        pace_seconds_per_mile: 410.2,
        activity_id: "track-1",
        activity_title: "Track",
        local_date: "2026-09-08",
        category: "track",
        source: "samples",
        lap_index: null,
        start_distance_meters: 2267.9,
      },
    ],
    longest_run: {
      activity_id: "long-1",
      activity_title: "Long run",
      local_date: "2026-08-30",
      distance_meters: 16093.44,
      distance_miles: 10,
    },
    highest_week: { week_start: "2026-08-24", miles: 26.4 },
    heart_rate_response_history: [
      heartRateResult({
        activity_id: "old-run",
        local_date: "2026-08-04",
        adjusted_change_bpm_per_hour: 3.2,
        algorithm_version: 3,
        adjusted_change_lower_90_bpm_per_hour: null,
        adjusted_change_upper_90_bpm_per_hour: null,
        confidence: "low",
        category: "run_club",
        temperature_fahrenheit: null,
        temperature_celsius: null,
      }),
      heartRateResult({
        activity_id: "new-run",
        local_date: "2026-08-05",
        adjusted_change_bpm_per_hour: 2.4,
        adjusted_change_lower_90_bpm_per_hour: 0.8,
        adjusted_change_upper_90_bpm_per_hour: 4.1,
      }),
    ],
    heart_rate_response_algorithm_version: 4,
    ...overrides,
  };
}

const zoneWeek = (index: number): ZoneWeek => {
  const start = addDays(FIRST_WEEK, index * 7);
  return {
    week_start: start,
    week_end: addDays(start, 6),
    is_partial: index === 15,
    run_count: 3,
    zone_seconds: [1200, 2400, 1800, 600, 0],
    total_seconds: 6000,
  };
};

export function heartRateZones(
  overrides: Partial<HeartRateZoneAnalytics> = {},
): HeartRateZoneAnalytics {
  return {
    as_of_date: "2026-09-29",
    status: "ok",
    message: null,
    max_heart_rate_bpm: 194,
    resting_heart_rate_bpm: 55,
    zones: [
      [1, 124.5, 138.4, 50, 60],
      [2, 138.4, 152.3, 60, 70],
      [3, 152.3, 166.2, 70, 80],
      [4, 166.2, 180.1, 80, 90],
      [5, 180.1, 194, 90, 100],
    ].map(([zone, lower, upper, lowerPercent, upperPercent]) => ({
      zone,
      lower_bpm: lower,
      upper_bpm: upper,
      lower_reserve_percent: lowerPercent,
      upper_reserve_percent: upperPercent,
    })),
    weekly_time_in_zones: Array.from({ length: 16 }, (_, index) =>
      zoneWeek(index),
    ),
    easy_run_categories: ["easy", "recovery"],
    easy_run_weekly_distribution: Array.from({ length: 16 }, (_, index) =>
      zoneWeek(index),
    ),
    training_load: {
      days: Array.from({ length: 120 }, (_, index) => ({
        day: addDays("2026-06-02", index),
        trimp: index % 2 ? 60 : 0,
        run_count: index % 2,
      })),
      acute_days: 7,
      chronic_days: 28,
      acute_load: 385.2,
      chronic_load: 384.7,
      acute_chronic_ratio: 1.0,
      ratio_band: "typical",
      chronic_history_complete: true,
      bands: [
        {
          label: "low",
          lower: null,
          upper: 0.8,
          description: "Recent load is below your recent average.",
        },
        {
          label: "typical",
          lower: 0.8,
          upper: 1.3,
          description: "Recent load is in line with your recent average.",
        },
        {
          label: "elevated",
          lower: 1.3,
          upper: 1.5,
          description: "Recent load is somewhat above your recent average.",
        },
        {
          label: "spike",
          lower: 1.5,
          upper: null,
          description: "Recent load is well above your recent average.",
        },
      ],
      guidance:
        "The bands are rough guidance, not a rule or an injury prediction.",
    },
    runs: [],
    runs_without_heart_rate: 0,
    ...overrides,
  };
}

export const missingZoneSettings = (): HeartRateZoneAnalytics =>
  heartRateZones({
    status: "heart_rate_settings_missing",
    message: "Set max and resting heart rate in Settings to see zones.",
    max_heart_rate_bpm: null,
    resting_heart_rate_bpm: null,
    zones: [],
    weekly_time_in_zones: [],
    easy_run_weekly_distribution: [],
    training_load: null,
  });

export function easyPace(): EasyPaceHeartRate {
  return {
    as_of_date: "2026-09-29",
    categories: ["easy", "long", "recovery"],
    window_start: "2025-10-01",
    reference_pace_seconds_per_mile: 615,
    months: Array.from({ length: 12 }, (_, index) => {
      const month = `${index < 3 ? 2025 : 2026}-${String(((index + 9) % 12) + 1).padStart(2, "0")}-01`;
      return {
        month,
        median_heart_rate_bpm: index >= 10 ? 150 + index : null,
        run_count: index >= 10 ? 4 : 0,
      };
    }),
    runs: [
      {
        activity_id: "easy-1",
        activity_title: "Easy",
        local_date: "2026-09-10",
        category: "easy",
        heart_rate_at_reference_bpm: 155.2,
        slope_bpm_per_second_per_mile: -0.1,
        median_grade_adjusted_pace_seconds_per_mile: 620,
        median_heart_rate_bpm: 154,
        steady_duration_seconds: 1800,
        temperature_celsius: 26,
        temperature_fahrenheit: 78.8,
      },
    ],
    excluded: [],
  };
}

export function goalProgress(
  overrides: Partial<GoalProgress> = {},
): GoalProgress {
  return {
    as_of_date: "2026-09-29",
    status: "ok",
    plan: {
      plan_id: "p1",
      plan_name: "Sub-6 Mile Block",
      start_date: "2026-09-07",
      end_date: "2026-12-06",
    },
    goal: {
      distance_meters: 1609.344,
      distance_label: "1 mile",
      target_time_seconds: 360,
      pace_seconds_per_mile: 360,
      pace_seconds_per_400m: 89.5,
    },
    window_start: "2026-06-15",
    window_end: "2026-09-29",
    weeks: Array.from({ length: 25 }, (_, index) => {
      const start = addDays("2026-06-15", index * 7);
      return {
        week_start: start,
        week_end: addDays(start, 6),
        is_before_plan: index < 12,
        is_future: index > 15,
        best_effort:
          index === 10 || index === 12
            ? {
                activity_id: `effort-${index}`,
                activity_title: "Track",
                local_date: addDays(start, 1),
                category: "track",
                elapsed_seconds: index === 10 ? 430 : 410.2,
                pace_seconds_per_mile: index === 10 ? 430 : 410.2,
                source: "samples",
              }
            : null,
      };
    }),
    current_best: {
      activity_id: "effort-12",
      activity_title: "Track",
      local_date: "2026-09-08",
      category: "track",
      elapsed_seconds: 410.2,
      pace_seconds_per_mile: 410.2,
      source: "samples",
    },
    gap_seconds: 50.2,
    gap_pace_seconds_per_mile: 50.2,
    track_sessions: [
      {
        activity_id: "track-1",
        activity_title: "Track",
        local_date: "2026-09-29",
        rep_count: 2,
        reps_at_or_under_goal_pace: 1,
        laps: [
          {
            lap_index: 1,
            distance_meters: 1609.3,
            elapsed_seconds: 677.2,
            pace_seconds_per_mile: 677.2,
            pace_seconds_per_400m: 168.3,
            pace_delta_seconds_per_mile: 317.2,
            counts_as_rep: false,
            at_or_under_goal_pace: false,
          },
          {
            lap_index: 2,
            distance_meters: 400,
            elapsed_seconds: 88,
            pace_seconds_per_mile: 354.1,
            pace_seconds_per_400m: 88,
            pace_delta_seconds_per_mile: -5.9,
            counts_as_rep: true,
            at_or_under_goal_pace: true,
          },
          {
            lap_index: 3,
            distance_meters: 400,
            elapsed_seconds: 95,
            pace_seconds_per_mile: 382.2,
            pace_seconds_per_400m: 95,
            pace_delta_seconds_per_mile: 22.2,
            counts_as_rep: true,
            at_or_under_goal_pace: false,
          },
        ],
      },
    ],
    ...overrides,
  };
}
