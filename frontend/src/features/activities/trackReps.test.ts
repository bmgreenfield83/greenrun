import { describe, expect, it } from "vitest";

import type { ActivityLap } from "../../api/activities";
import { goalRepsFromLaps } from "./trackReps";

const lap = (
  index: number,
  distance: number,
  seconds: number,
): ActivityLap => ({
  index,
  elapsed_time_seconds: seconds,
  moving_time_seconds: seconds,
  distance_meters: distance,
  average_speed_mps: distance / seconds,
  average_heart_rate: null,
  maximum_heart_rate: null,
  average_cadence_spm: null,
  elevation_gain_meters: null,
  lap_trigger: "manual",
});

describe("goalRepsFromLaps", () => {
  it("keeps 200–1600 m laps and flags work reps against goal pace", () => {
    const reps = goalRepsFromLaps(
      [
        lap(1, 3200, 1300), // warm-up, too long
        lap(2, 400, 88), // 5:54/mi, at goal
        lap(3, 400, 180), // recovery jog
        lap(4, 400, 96), // 6:26/mi, within 15% of fastest
        lap(5, 150, 40), // too short
      ],
      360,
    );
    expect(reps.map((rep) => rep.lap_index)).toEqual([2, 3, 4]);
    expect(reps.map((rep) => rep.counts_as_rep)).toEqual([true, false, true]);
    expect(reps.map((rep) => rep.at_or_under_goal_pace)).toEqual([
      true,
      false,
      false,
    ]);
    expect(reps[0].pace_seconds_per_400m).toBe(88);
    expect(reps[0].pace_delta_seconds_per_mile).toBeCloseTo(-5.9, 1);
  });
});
