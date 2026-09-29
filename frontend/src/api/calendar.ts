export type CalendarEvent = {
  id: string;
  kind: "activity" | "planned_session";
  title: string;
  date: string;
  sport: string;
  status: string;
  distance_meters: number | null;
  completed_distance_meters: number | null;
  completed_duration_seconds: number | null;
  completed_average_speed_mps: number | null;
  completed_pace_seconds_per_mile: number | null;
  completed_activity_title: string | null;
  completed_activity_notes: string | null;
  planned_session_id: string | null;
  activity_id: string | null;
  completed_on_date: string | null;
  original_scheduled_date: string | null;
  notes: string | null;
  instructions: string | null;
  justification?: string | null;
  skip_reason: string | null;
  reschedule_notes: string | null;
};

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";

async function parse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok)
    throw new Error(body.error?.message ?? "The calendar action failed.");
  return body;
}

export async function fetchCalendar(
  start: string,
  end: string,
): Promise<CalendarEvent[]> {
  const response = await fetch(
    `${apiBaseUrl}/calendar?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
  );
  return (await parse<{ events: CalendarEvent[] }>(response)).events;
}

export async function skipSession(sessionId: string, reason: string) {
  return parse(
    await fetch(`${apiBaseUrl}/planned-sessions/${sessionId}/skip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason || null }),
    }),
  );
}

export async function unskipSession(sessionId: string) {
  return parse(
    await fetch(`${apiBaseUrl}/planned-sessions/${sessionId}/unskip`, {
      method: "POST",
    }),
  );
}

export async function attachActivity(sessionId: string, activityId: string) {
  return parse(
    await fetch(`${apiBaseUrl}/planned-sessions/${sessionId}/attach-activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activity_id: activityId }),
    }),
  );
}

export async function detachActivity(sessionId: string) {
  return parse(
    await fetch(`${apiBaseUrl}/planned-sessions/${sessionId}/detach-activity`, {
      method: "POST",
    }),
  );
}
