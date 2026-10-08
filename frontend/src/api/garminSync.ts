import type { FitImportPreview } from "./fitImports";

export type GarminSyncItem = {
  garmin_activity_id: string;
  name: string | null;
  started_at_local: string | null;
  distance_meters: number | null;
  status: "ready" | "already_imported" | "error";
  activity_id: string | null;
  preview: FitImportPreview | null;
  error: string | null;
};

export type GarminSyncResult = {
  date: string;
  status: "ready" | "no_activities" | "already_imported" | "failed";
  items: GarminSyncItem[];
};

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";

/** Finds the day's runs on Garmin Connect; new ones come back as FIT import previews. */
export async function syncFromGarmin(date: string): Promise<GarminSyncResult> {
  const response = await fetch(`${apiBaseUrl}/activities/garmin-sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date }),
  });
  const body = (await response.json().catch(() => ({}))) as GarminSyncResult & {
    error?: { message?: string };
  };
  if (!response.ok)
    throw new Error(
      body.error?.message ?? "The Garmin sync failed. Try again shortly.",
    );
  return body;
}
