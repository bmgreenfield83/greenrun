const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";

async function download(response: Response, fallbackName: string) {
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      detail?: string;
    };
    throw new Error(body.detail ?? "The export could not be generated.");
  }
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filename =
    disposition.match(/filename="?([^";]+)"?/)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export const exportActivity = (id: string) =>
  fetch(`${apiBaseUrl}/activities/${id}/export`).then((response) =>
    download(response, `activity-${id}.json`),
  );

export const exportRange = (
  scope: "day" | "week" | "month" | "range",
  startDate: string,
  endDate?: string,
  includeAllActivities = false,
) =>
  fetch(`${apiBaseUrl}/exports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scope,
      start_date: startDate,
      end_date: endDate || null,
      include_all_activities: includeAllActivities,
    }),
  }).then((response) =>
    download(response, `running-${scope}-${startDate}.json`),
  );

export const exportPlan = (
  id: string,
  analysis = false,
  includeAllActivities = false,
) =>
  fetch(
    `${apiBaseUrl}/plans/${id}/${analysis ? "analysis-export" : "export"}${
      analysis && includeAllActivities ? "?include_all_activities=true" : ""
    }`,
  ).then((response) =>
    download(
      response,
      analysis
        ? `training-plan-analysis-${id}.json`
        : `training-plan-${id}.json`,
    ),
  );
