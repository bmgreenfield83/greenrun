import type { ActivityLap } from "../../api/activities";
import type { GoalRep } from "../../api/analytics";

const METERS_PER_MILE = 1609.344;
const REP_MIN_METERS = 200;
const REP_MAX_METERS = 1600;
const REP_DISTANCE_TOLERANCE = 0.02;
const REP_SESSION_PACE_TOLERANCE = 1.15;
const REP_GOAL_PACE_LIMIT = 1.6;

const isRepDistance = (meters: number | null) =>
  meters != null &&
  meters >= REP_MIN_METERS * (1 - REP_DISTANCE_TOLERANCE) &&
  meters <= REP_MAX_METERS * (1 + REP_DISTANCE_TOLERANCE);

/**
 * Rep analysis of a track session's laps against a goal pace. Mirrors the backend goal card
 * (app.services.goal_progress): laps of 200–1600 m (±2%) with lap elapsed time; a lap counts
 * as a work rep when it is at/faster than goal pace, or within 15% of the session's fastest
 * such lap and no more than 60% slower than goal pace. Used when the activity falls outside
 * the goal endpoint's window.
 */
export function goalRepsFromLaps(
  laps: ActivityLap[],
  goalPaceSecondsPerMile: number,
): GoalRep[] {
  const candidates = laps
    .filter(
      (lap) =>
        isRepDistance(lap.distance_meters) && lap.elapsed_time_seconds > 0,
    )
    .map((lap) => {
      const distance = lap.distance_meters as number;
      const pace = (lap.elapsed_time_seconds / distance) * METERS_PER_MILE;
      return { lap, distance, pace };
    });
  if (!candidates.length) return [];
  const fastest = Math.min(...candidates.map((item) => item.pace));
  return candidates.map(({ lap, distance, pace }) => {
    const atGoal = pace <= goalPaceSecondsPerMile;
    return {
      lap_index: lap.index,
      distance_meters: distance,
      elapsed_seconds: lap.elapsed_time_seconds,
      pace_seconds_per_mile: +pace.toFixed(1),
      pace_seconds_per_400m: +((pace / METERS_PER_MILE) * 400).toFixed(1),
      pace_delta_seconds_per_mile: +(pace - goalPaceSecondsPerMile).toFixed(1),
      counts_as_rep:
        atGoal ||
        (pace <= fastest * REP_SESSION_PACE_TOLERANCE &&
          pace <= goalPaceSecondsPerMile * REP_GOAL_PACE_LIMIT),
      at_or_under_goal_pace: atGoal,
    };
  });
}
