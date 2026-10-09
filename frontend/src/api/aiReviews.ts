/** AI track-session reviews, served through the green-ai service (see docs/ai-reviews.md). */

export type AiSessionChange = {
  session_id: string;
  title: string | null;
  planned_distance_miles: number | null;
  planned_duration_minutes: number | null;
  instructions: string | null;
  justification: string | null;
  reason: string;
};

export type AiReviewSession = {
  id: string;
  scheduled_date: string;
  sport: string;
  session_type: string;
  title: string;
  planned_distance_meters: number | null;
  planned_duration_seconds: number | null;
  instructions: string | null;
  justification: string | null;
  updated_at_utc: string | null;
};

export type AiReview = {
  id: string;
  activity_id: string;
  activity_date: string;
  created_at_utc: string | null;
  model: string;
  prompt_version: string;
  review: {
    recommendation: string;
    execution:
      | "as_prescribed"
      | "partly_as_prescribed"
      | "not_as_prescribed"
      | "unclear";
    verdict: string;
    observations: string[];
    health_flags: string[];
    proposed_changes: AiSessionChange[];
    later_week_flags: Array<{
      week_number: number;
      concern: string;
      suggestion: string;
    }>;
  };
  editable_sessions: AiReviewSession[];
  conversation: Array<{ message: string; reply: string | null }>;
  turns: Array<{ turn: number; seconds: number; cost_usd: number | null }>;
  total_cost_usd: number | null;
  applied: Record<string, string>;
};

export type AiReviewSummary = {
  id: string;
  activity_id: string;
  activity_date: string;
  created_at_utc: string | null;
  model: string;
  total_cost_usd: number | null;
};

export type AiReviewApplyResult = {
  applied: string[];
  skipped: Array<{ session_id: string; reason: string }>;
  review: AiReview;
};

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";

async function request<T>(
  path: string,
  init?: RequestInit,
  fallback = "The AI review request failed. Try again shortly.",
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, init);
  const text = await response.text();
  const parse = () => {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return {};
    }
  };
  if (!response.ok) {
    const body = parse() as { error?: { message?: string } };
    throw new Error(body.error?.message ?? fallback);
  }
  const isText = response.headers.get("Content-Type")?.startsWith("text/plain");
  return (isText ? text : parse()) as T;
}

const post = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const getAiReviewStatus = () =>
  request<{ enabled: boolean }>("/ai-reviews/status");

export const listAiReviews = (activityId: string) =>
  request<AiReviewSummary[]>(
    `/ai-reviews?activity_id=${encodeURIComponent(activityId)}`,
  );

export const getAiReview = (reviewId: string) =>
  request<AiReview>(`/ai-reviews/${encodeURIComponent(reviewId)}`);

/** Sends the session and recent training to the AI provider; takes about 25 seconds. */
export const createAiReview = (activityId: string) =>
  request<AiReview>(
    "/ai-reviews",
    post({ activity_id: activityId }),
    "The AI review failed. Try again shortly.",
  );

export const replyToAiReview = (reviewId: string, message: string) =>
  request<AiReview>(
    `/ai-reviews/${encodeURIComponent(reviewId)}/replies`,
    post({ message }),
  );

export const applyAiReview = (reviewId: string, sessionIds: string[]) =>
  request<AiReviewApplyResult>(
    `/ai-reviews/${encodeURIComponent(reviewId)}/apply`,
    post({ session_ids: sessionIds }),
  );

/** Exactly what was sent to the AI provider for this review. */
export const getAiReviewContext = (reviewId: string) =>
  request<string>(`/ai-reviews/${encodeURIComponent(reviewId)}/context`);
