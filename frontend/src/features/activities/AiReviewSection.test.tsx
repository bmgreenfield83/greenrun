import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import type { Activity } from "../../api/activities";
import type { AiReview } from "../../api/aiReviews";
import { mockFetchRoutes } from "../../test/mockFetch";
import { AiReviewSection } from "./AiReviewSection";

afterEach(() => vi.restoreAllMocks());

const track = { id: "activity-1", sport: "run", category: "track" } as Activity;

const review: AiReview = {
  id: "review-1",
  activity_id: "activity-1",
  activity_date: "2026-10-06",
  created_at_utc: "2026-10-08T18:39:38Z",
  model: "gpt-6.1-sol",
  prompt_version: "v5",
  review: {
    recommendation: "Keep the easy runs; dial back Tuesday.",
    execution: "partly_as_prescribed",
    verdict: "All 10 reps done, two too fast.",
    observations: ["Sept 29 needed walking recoveries."],
    health_flags: [],
    proposed_changes: [
      {
        session_id: "s1",
        title: "4 x 400 m plus 2 x 200 m",
        planned_distance_miles: null,
        planned_duration_minutes: null,
        instructions: "Run 4 x 400 m in 1:42–1:44.",
        justification: null,
        reason: "Progression not yet earned.",
      },
    ],
    later_week_flags: [
      {
        week_number: 7,
        concern: "800s advance too fast.",
        suggestion: "Reassess.",
      },
    ],
  },
  editable_sessions: [
    {
      id: "s1",
      scheduled_date: "2026-10-13",
      sport: "run",
      session_type: "track",
      title: "5 x 400 m plus 4 x 200 m",
      planned_distance_meters: 8851.4,
      planned_duration_seconds: null,
      instructions: "Run 5 x 400 m in 1:36–1:38.",
      justification: null,
      updated_at_utc: "2026-09-08T14:28:59",
    },
  ],
  conversation: [],
  turns: [{ turn: 0, seconds: 23, cost_usd: 0.055 }],
  total_cost_usd: 0.055,
  applied: {},
};

it("renders nothing when AI reviews are not configured", async () => {
  const fetch = mockFetchRoutes({ "/ai-reviews/status": { enabled: false } });
  const { container } = render(<AiReviewSection activity={track} />);
  await waitFor(() => expect(fetch).toHaveBeenCalled());
  expect(container).toBeEmptyDOMElement();
});

it("renders nothing for easy runs and does not call the API", () => {
  const fetch = mockFetchRoutes({});
  const { container } = render(
    <AiReviewSection activity={{ ...track, category: "easy" } as Activity} />,
  );
  expect(container).toBeEmptyDOMElement();
  expect(fetch).not.toHaveBeenCalled();
});

it("runs a review and shows the recommendation and before/after", async () => {
  const create = vi.fn<(init?: RequestInit) => unknown>(() => review);
  mockFetchRoutes({
    "/ai-reviews/status": { enabled: true },
    "/ai-reviews": [],
    "POST /ai-reviews": create,
  });
  render(<AiReviewSection activity={track} />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Review with AI" }),
  );
  expect(
    await screen.findByText("Keep the easy runs; dial back Tuesday."),
  ).toBeInTheDocument();
  expect(JSON.parse(String(create.mock.calls[0]?.[0]?.body))).toEqual({
    activity_id: "activity-1",
  });
  expect(screen.getByText("Run 5 x 400 m in 1:36–1:38.")).toBeInTheDocument();
  expect(screen.getByText("Run 4 x 400 m in 1:42–1:44.")).toBeInTheDocument();
  expect(screen.getByText(/Week 7:/)).toBeInTheDocument();
});

it("loads the latest review and applies the selected changes", async () => {
  const apply = vi.fn<(init?: RequestInit) => unknown>(() => ({
    applied: ["s1"],
    skipped: [],
    review: { ...review, applied: { s1: "2026-10-08T19:00:00Z" } },
  }));
  mockFetchRoutes({
    "/ai-reviews/status": { enabled: true },
    "/ai-reviews": [{ id: "review-1" }],
    "/ai-reviews/review-1": review,
    "POST /ai-reviews/review-1/apply": apply,
  });
  render(<AiReviewSection activity={track} />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Apply selected (1)" }),
  );
  expect(await screen.findByText("Applied 1 change.")).toBeInTheDocument();
  expect(JSON.parse(String(apply.mock.calls[0]?.[0]?.body))).toEqual({
    session_ids: ["s1"],
  });
  expect(screen.getByText("Applied")).toBeInTheDocument();
});

it("sends a reply and shows the conversation", async () => {
  const reply = vi.fn<(init?: RequestInit) => unknown>(() => ({
    ...review,
    conversation: [{ message: "Calf is fine.", reply: "Good, keep Tuesday." }],
  }));
  mockFetchRoutes({
    "/ai-reviews/status": { enabled: true },
    "/ai-reviews": [{ id: "review-1" }],
    "/ai-reviews/review-1": review,
    "POST /ai-reviews/review-1/replies": reply,
  });
  render(<AiReviewSection activity={track} />);
  fireEvent.change(await screen.findByLabelText("Reply to the coach"), {
    target: { value: "Calf is fine." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send reply" }));
  expect(await screen.findByText("Good, keep Tuesday.")).toBeInTheDocument();
  expect(JSON.parse(String(reply.mock.calls[0]?.[0]?.body))).toEqual({
    message: "Calf is fine.",
  });
});

it("shows the server's message when a review fails", async () => {
  mockFetchRoutes({
    "/ai-reviews/status": { enabled: true },
    "/ai-reviews": [],
    "POST /ai-reviews": new Response(
      JSON.stringify({ error: { message: "The AI service failed." } }),
      { status: 502 },
    ),
  });
  render(<AiReviewSection activity={track} />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Review with AI" }),
  );
  expect(await screen.findByText("The AI service failed.")).toBeInTheDocument();
});
