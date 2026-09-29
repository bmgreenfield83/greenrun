export type StorageStatistics = {
  available: boolean;
  configured_limit_bytes: number;
  estimated_used_bytes: number | null;
  usage_percent: number | null;
  warning_threshold: number | null;
  collections: Array<{
    name: string;
    data_size_bytes: number | null;
    storage_size_bytes: number | null;
    index_size_bytes: number | null;
  }>;
};

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";

export async function fetchStorageStatistics(
  signal?: AbortSignal,
): Promise<StorageStatistics> {
  const response = await fetch(`${apiBaseUrl}/settings/storage`, { signal });
  if (!response.ok) throw new Error("Storage statistics are unavailable");
  return (await response.json()) as StorageStatistics;
}

export type AppSettings = {
  id: string;
  timezone: string;
  sample_interval_seconds: number;
  export_size_threshold_bytes: number;
  storage_limit_bytes: number;
  storage_warning_thresholds: number[];
  max_heart_rate_bpm: number | null;
  resting_heart_rate_bpm: number | null;
  created_at_utc: string;
  updated_at_utc: string;
};

export type HeartRateSettingsUpdate = {
  /** null clears the stored value. */
  max_heart_rate_bpm: number | null;
  resting_heart_rate_bpm: number | null;
};

async function parseSettings(response: Response): Promise<AppSettings> {
  const body = (await response.json().catch(() => ({}))) as AppSettings & {
    error?: { message?: string };
    detail?: Array<{ msg?: string }> | string;
  };
  if (!response.ok) {
    const validation = Array.isArray(body.detail)
      ? body.detail.map((item) => item.msg).join("; ")
      : body.detail;
    throw new Error(
      body.error?.message ?? validation ?? "Settings could not be saved.",
    );
  }
  return body;
}

export async function getSettings(signal?: AbortSignal): Promise<AppSettings> {
  const response = await fetch(`${apiBaseUrl}/settings`, { signal });
  if (!response.ok) throw new Error("Settings could not be loaded.");
  return (await response.json()) as AppSettings;
}

export async function updateHeartRateSettings(
  changes: HeartRateSettingsUpdate,
): Promise<AppSettings> {
  return parseSettings(
    await fetch(`${apiBaseUrl}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    }),
  );
}
