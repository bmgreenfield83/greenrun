import type { HeartRateZoneBoundary } from "../../api/analytics";

export const MAX_HEART_RATE_RANGE = [100, 230] as const;
export const RESTING_HEART_RATE_RANGE = [25, 120] as const;

const RESERVE_FRACTIONS: Array<[number, number, number]> = [
  [1, 0.5, 0.6],
  [2, 0.6, 0.7],
  [3, 0.7, 0.8],
  [4, 0.8, 0.9],
  [5, 0.9, 1.0],
];

/** Heart-rate-reserve (Karvonen) zones; mirrors backend app.services.heart_rate_zones. */
export function heartRateReserveZones(
  maximum: number,
  resting: number,
): HeartRateZoneBoundary[] {
  const reserve = maximum - resting;
  return RESERVE_FRACTIONS.map(([zone, lower, upper]) => ({
    zone,
    lower_bpm: Math.round((resting + lower * reserve) * 10) / 10,
    upper_bpm: Math.round((resting + upper * reserve) * 10) / 10,
    lower_reserve_percent: lower * 100,
    upper_reserve_percent: upper * 100,
  }));
}

export type HeartRateFormErrors = { maximum?: string; resting?: string };

/** Parses a blank (clear) or whole-number bpm field. */
export function parseBpm(value: string): number | null | "invalid" {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^\d+$/.test(trimmed) ? Number(trimmed) : "invalid";
}

/** Validates the max/resting pair with the same rules the API enforces. */
export function validateHeartRates(
  maximumText: string,
  restingText: string,
): HeartRateFormErrors {
  const errors: HeartRateFormErrors = {};
  const maximum = parseBpm(maximumText);
  const resting = parseBpm(restingText);
  if (maximum === "invalid") errors.maximum = "Enter a whole number of bpm.";
  else if (
    maximum !== null &&
    (maximum < MAX_HEART_RATE_RANGE[0] || maximum > MAX_HEART_RATE_RANGE[1])
  )
    errors.maximum = `Max heart rate must be ${MAX_HEART_RATE_RANGE[0]}–${MAX_HEART_RATE_RANGE[1]} bpm.`;
  if (resting === "invalid") errors.resting = "Enter a whole number of bpm.";
  else if (
    resting !== null &&
    (resting < RESTING_HEART_RATE_RANGE[0] ||
      resting > RESTING_HEART_RATE_RANGE[1])
  )
    errors.resting = `Resting heart rate must be ${RESTING_HEART_RATE_RANGE[0]}–${RESTING_HEART_RATE_RANGE[1]} bpm.`;
  if (
    !errors.maximum &&
    !errors.resting &&
    typeof maximum === "number" &&
    typeof resting === "number" &&
    resting >= maximum
  )
    errors.resting = "Resting heart rate must be lower than max heart rate.";
  return errors;
}
