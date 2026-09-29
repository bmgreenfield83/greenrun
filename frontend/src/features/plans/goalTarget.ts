import type { PlanGoalTarget } from "../../api/plans";
import {
  formatPace,
  formatPreciseClock,
  METERS_PER_MILE,
} from "../analytics/format";

export const GOAL_DISTANCE_PRESETS = [
  { label: "1 mile", meters: METERS_PER_MILE },
  { label: "5K", meters: 5000 },
  { label: "10K", meters: 10000 },
  { label: "Half marathon", meters: 21097.5 },
  { label: "Marathon", meters: 42195 },
] as const;

export type DistanceUnit = "mi" | "km" | "m";

export const UNIT_METERS: Record<DistanceUnit, number> = {
  mi: METERS_PER_MILE,
  km: 1000,
  m: 1,
};

/** Standard label for a distance; mirrors the backend goal card's distance_label. */
export function goalDistanceLabel(meters: number): string {
  const preset = GOAL_DISTANCE_PRESETS.find(
    (item) => Math.abs(item.meters - meters) <= 1,
  );
  if (preset) return preset.label;
  const miles = meters / METERS_PER_MILE;
  if (Math.abs(miles - Math.round(miles)) < 0.005) {
    const count = Math.round(miles);
    return count === 1 ? "1 mile" : `${count} miles`;
  }
  if (meters >= 1000) return `${+(meters / 1000).toFixed(3)} km`;
  return `${+meters.toFixed(1)} m`;
}

/**
 * Parses a target time as m:ss, mm:ss, or h:mm:ss (seconds may have a decimal, e.g. 5:59.5).
 * Returns null when the text is not a valid positive time.
 */
export function parseTargetTime(text: string): number | null {
  const match = /^(?:(\d+):)?(\d{1,3}):(\d{2}(?:\.\d+)?)$/.exec(text.trim());
  if (!match) return null;
  const hours = match[1] ? Number(match[1]) : 0;
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if (seconds >= 60 || (match[1] && minutes >= 60)) return null;
  const total = hours * 3600 + minutes * 60 + seconds;
  return total > 0 ? total : null;
}

/** "1 mile in 6:00 (6:00/mi)". */
export function describeGoal(goal: PlanGoalTarget): string {
  const pace =
    (goal.target_time_seconds / goal.distance_meters) * METERS_PER_MILE;
  return `${goalDistanceLabel(goal.distance_meters)} in ${formatPreciseClock(goal.target_time_seconds)} (${formatPace(pace)})`;
}
