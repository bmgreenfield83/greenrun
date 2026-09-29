export type PlanImportPreview = {
  preview_token: string;
  expires_in_seconds: number;
  name: string;
  number_of_weeks: number;
  start_date: string;
  end_date: string;
  planned_session_count: number;
  total_planned_running_miles: number;
  conflict: {
    active_plan_id: string;
    active_plan_name: string;
    active_start_date: string;
    active_end_date: string;
    dates_overlap: boolean;
  } | null;
};

export type TrainingPlan = {
  id: string;
  name: string;
  description: string | null;
  primary_goal?: string | null;
  secondary_goal?: string | null;
  status: string;
  start_date: string;
  end_date: string;
  week_starts_on: string;
  week_summaries: Array<{
    week_number: number;
    focus: string | null;
    planned_running_miles: number | null;
  }>;
};

export type PlannedSession = {
  id: string;
  training_plan_id: string;
  scheduled_date: string;
  sport: string;
  session_type: string;
  title: string;
  planned_distance_meters: number | null;
  planned_duration_seconds: number | null;
  instructions: string | null;
  justification?: string | null;
  status: string;
  completed_activity_id: string | null;
};

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";

async function parse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & {
    error?: { message?: string };
    detail?: Array<{ loc?: Array<string | number>; msg?: string }> | string;
  };
  if (!response.ok) {
    const validation = Array.isArray(body.detail)
      ? body.detail
          .map((item) => `${item.loc?.slice(1).join(".")}: ${item.msg}`)
          .join("; ")
      : body.detail;
    throw new Error(
      body.error?.message ?? validation ?? "The training plan is invalid.",
    );
  }
  return body;
}

export async function previewPlanImport(
  template: unknown,
  startDate: string,
): Promise<PlanImportPreview> {
  return parse<PlanImportPreview>(
    await fetch(`${apiBaseUrl}/plans/import/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template, start_date: startDate || null }),
    }),
  );
}

export async function confirmPlanImport(
  previewToken: string,
  replaceActivePlan: boolean,
) {
  return parse<{
    training_plan_id: string;
    sessions_created: number;
    archived_plan_id: string | null;
  }>(
    await fetch(`${apiBaseUrl}/plans/import/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        preview_token: previewToken,
        replace_active_plan: replaceActivePlan,
      }),
    }),
  );
}

export async function downloadBlankPlan(): Promise<Blob> {
  const response = await fetch(`${apiBaseUrl}/plans/export-blank`);
  if (!response.ok)
    throw new Error("The blank plan template could not be downloaded.");
  return new Blob([JSON.stringify(await response.json(), null, 2)], {
    type: "application/json",
  });
}

export async function listPlans(): Promise<TrainingPlan[]> {
  return (
    await parse<{ items: TrainingPlan[] }>(
      await fetch(`${apiBaseUrl}/plans?limit=100`),
    )
  ).items;
}

export async function listPlanSessions(
  planId: string,
): Promise<PlannedSession[]> {
  return (
    await parse<{ items: PlannedSession[] }>(
      await fetch(`${apiBaseUrl}/plans/${planId}/sessions`),
    )
  ).items;
}

export async function updatePlanStatus(
  planId: string,
  status: "active" | "archived" | "completed" | "abandoned",
): Promise<TrainingPlan> {
  return parse(
    await fetch(`${apiBaseUrl}/plans/${planId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }),
  );
}
