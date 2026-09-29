export type ActivityLap = {
  index: number;
  elapsed_time_seconds: number;
  moving_time_seconds: number | null;
  distance_meters: number | null;
  average_speed_mps: number | null;
  average_heart_rate: number | null;
  maximum_heart_rate: number | null;
  average_cadence_spm: number | null;
  elevation_gain_meters: number | null;
  lap_trigger: string | null;
};

export type SubjectiveData = {
  effort: number | null;
  effort_label: string | null;
  feel: string | null;
  sleep_score: number | null;
  sleep_label: string | null;
  pain_soreness_notes: string | null;
  notes: string | null;
};

export type Activity = {
  id: string;
  sport: string;
  category: string | null;
  title: string | null;
  started_at_utc: string;
  timezone: string;
  local_date: string;
  distance_meters: number | null;
  elapsed_time_seconds: number;
  moving_time_seconds: number | null;
  summary: Record<string, number | null>;
  laps: ActivityLap[];
  subjective: SubjectiveData;
  weather_notes: string | null;
  source: { type: "fit" | "manual" };
  planned_session_id: string | null;
  heart_rate_analysis_start_distance_meters: number | null;
  derived_metrics: Record<string, unknown>;
};

export type ActivitySample = {
  elapsed_seconds: number;
  distance_meters: number | null;
  heart_rate: number | null;
  speed_mps: number | null;
  cadence_spm: number | null;
  elevation_meters: number | null;
  temperature_celsius: number | null;
};

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";

async function parse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok)
    throw new Error(body.error?.message ?? "The activity request failed.");
  return body;
}

export type ActivityList = { items: Activity[]; total: number };

export async function listActivities(
  options: {
    skip?: number;
    limit?: number;
    sport?: string;
    startDate?: string;
    endDate?: string;
  } = {},
): Promise<ActivityList> {
  const parameters = new URLSearchParams({
    skip: String(options.skip ?? 0),
    limit: String(options.limit ?? 25),
  });
  if (options.sport) parameters.set("sport", options.sport);
  if (options.startDate) parameters.set("start_date", options.startDate);
  if (options.endDate) parameters.set("end_date", options.endDate);
  return parse(await fetch(`${apiBaseUrl}/activities?${parameters}`));
}

export async function getActivity(id: string): Promise<Activity> {
  return parse(await fetch(`${apiBaseUrl}/activities/${id}`));
}

export async function getActivitySamples(
  id: string,
): Promise<ActivitySample[]> {
  return (
    await parse<{ items: ActivitySample[] }>(
      await fetch(`${apiBaseUrl}/activities/${id}/samples`),
    )
  ).items;
}

export async function updateActivity(
  id: string,
  changes: unknown,
): Promise<Activity> {
  return parse(
    await fetch(`${apiBaseUrl}/activities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    }),
  );
}

export async function deleteActivity(id: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/activities/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("The activity could not be deleted.");
}

export async function getPlannedSession(
  id: string,
): Promise<{ title: string; scheduled_date: string }> {
  return parse(await fetch(`${apiBaseUrl}/planned-sessions/${id}`));
}
