export type FitActivityPreview = {
  sport: string;
  category: string | null;
  title: string | null;
  started_at_utc: string;
  local_date: string;
  distance_meters: number | null;
  elapsed_time_seconds: number;
  moving_time_seconds: number | null;
  summary: {
    average_heart_rate: number | null;
    maximum_heart_rate: number | null;
    average_speed_mps: number | null;
    average_cadence_spm: number | null;
    elevation_gain_meters: number | null;
    temperature_celsius: number | null;
    humidity_percent: number | null;
  };
  laps: unknown[];
  subjective: {
    effort: number | null;
    feel: string | null;
    sleep_score: number | null;
    sleep_label: string | null;
    pain_soreness_notes: string | null;
    notes: string | null;
  };
  weather_notes: string | null;
  planned_session_id: string | null;
};

export type FitImportPreview = {
  preview_token: string;
  expires_in_seconds: number;
  activity: FitActivityPreview;
  sample_count: number;
  duplicate_matches: Array<{
    activity_id: string;
    title: string | null;
    local_date: string;
    reason: string;
  }>;
  suggested_planned_session: {
    planned_session_id: string;
    title: string;
    scheduled_date: string;
    session_type: string;
    score: number;
  } | null;
};

export type ConfirmFitImport = {
  preview_token: string;
  duplicate_action: "create" | "replace" | "import_duplicate";
  duplicate_activity_id?: string;
  metadata: Record<string, unknown>;
};

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";

async function parseResponse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & {
    error?: { message?: string };
    detail?: string;
  };
  if (!response.ok) {
    throw new Error(
      body.error?.message ?? body.detail ?? "The FIT import failed.",
    );
  }
  return body;
}

export async function previewFitImport(file: File): Promise<FitImportPreview> {
  const form = new FormData();
  form.append("file", file);
  return parseResponse<FitImportPreview>(
    await fetch(`${apiBaseUrl}/activities/import-fit/preview`, {
      method: "POST",
      body: form,
    }),
  );
}

export async function confirmFitImport(payload: ConfirmFitImport) {
  return parseResponse<{
    activity: { id: string; title: string };
    samples_persisted: number;
  }>(
    await fetch(`${apiBaseUrl}/activities/import-fit/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}
