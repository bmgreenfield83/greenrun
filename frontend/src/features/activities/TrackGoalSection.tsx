import { useEffect, useState } from "react";

import type { Activity } from "../../api/activities";
import { getGoalProgress, type GoalProgress } from "../../api/analytics";
import { goalRepsFromLaps } from "./trackReps";
import { TrackRepChart } from "./TrackRepChart";

/**
 * For track-category runs when the active plan has a structured goal: the rep chart.
 * Uses the goal endpoint's rep analysis for this run when it is inside the goal window,
 * otherwise computes the same analysis from the run's laps.
 */
export function TrackGoalSection({ activity }: { activity: Activity }) {
  const [goal, setGoal] = useState<GoalProgress | null>(null);
  const isTrack = activity.sport === "run" && activity.category === "track";
  useEffect(() => {
    if (!isTrack) return;
    let cancelled = false;
    getGoalProgress()
      .then((value) => {
        if (!cancelled) setGoal(value);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isTrack, activity.id]);
  if (!isTrack || goal?.status !== "ok" || !goal.goal) return null;
  const session = goal.track_sessions.find(
    (item) => item.activity_id === activity.id,
  );
  const reps =
    session?.laps ??
    goalRepsFromLaps(activity.laps, goal.goal.pace_seconds_per_mile);
  return <TrackRepChart reps={reps} goal={goal.goal} />;
}
