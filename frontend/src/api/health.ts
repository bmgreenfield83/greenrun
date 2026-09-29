export type Readiness = {
  status: "ready" | "unavailable";
  database: "connected" | "unavailable";
};

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";

export async function fetchReadiness(signal?: AbortSignal): Promise<Readiness> {
  const response = await fetch(`${apiBaseUrl}/ready`, { signal });
  const body = (await response.json()) as Readiness;
  if (!response.ok) throw new Error("Backend or database is unavailable");
  return body;
}
