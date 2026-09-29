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
