import { localDateLabel } from "../activities/format";

export const METERS_PER_MILE = 1609.344;

/** Formats seconds as m:ss or h:mm:ss, rounding to whole seconds first (never "5:60"). */
export function formatClock(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const total = Math.round(Math.abs(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = String(total % 60).padStart(2, "0");
  const sign = seconds < 0 ? "−" : "";
  return hours
    ? `${sign}${hours}:${String(minutes).padStart(2, "0")}:${remainder}`
    : `${sign}${minutes}:${remainder}`;
}

/** Like formatClock but keeps tenths under 10 minutes, e.g. 1:29.5 per 400 m. */
export function formatPreciseClock(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  if (Math.abs(seconds) >= 600) return formatClock(seconds);
  const tenths = Math.round(Math.abs(seconds) * 10);
  const minutes = Math.floor(tenths / 600);
  const secondTenths = tenths % 600;
  const whole = String(Math.floor(secondTenths / 10)).padStart(2, "0");
  const fraction = secondTenths % 10;
  const sign = seconds < 0 ? "−" : "";
  return `${sign}${minutes}:${whole}${fraction ? `.${fraction}` : ""}`;
}

/** Pace in seconds per mile as "m:ss/mi". */
export const formatPace = (secondsPerMile: number | null | undefined) =>
  secondsPerMile == null ? "—" : `${formatClock(secondsPerMile)}/mi`;

/** Signed difference in seconds, e.g. "+0:50" (slower) or "−0:04" (faster). */
export function formatSignedClock(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  if (Math.round(seconds) === 0) return "±0:00";
  return seconds > 0 ? `+${formatClock(seconds)}` : formatClock(seconds);
}

export const formatMiles = (miles: number | null | undefined, digits = 1) =>
  miles == null ? "—" : `${miles.toFixed(digits)} mi`;

/** Local YYYY-MM-DD as a UTC timestamp, for numeric time axes. */
export function dateValue(localDate: string): number {
  const [year, month, day] = localDate.split("-").map(Number);
  return Date.UTC(year, (month ?? 1) - 1, day ?? 1);
}

/** Label for a UTC timestamp produced by dateValue. */
export function timeLabel(
  value: number,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
): string {
  const date = new Date(value);
  return localDateLabel(
    `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`,
    options,
  );
}

export const shortDate = (localDate: string) =>
  localDateLabel(localDate, { month: "short", day: "numeric" });

export const categoryLabel = (category: string | null | undefined) =>
  (category ?? "uncategorized").replaceAll("_", " ");

export type TemperatureUnit = "F" | "C";

export function formatTemperature(
  fahrenheit: number | null | undefined,
  unit: TemperatureUnit,
): string {
  if (fahrenheit == null) return "not recorded";
  return unit === "F"
    ? `${Math.round(fahrenheit)}°F`
    : `${Math.round(((fahrenheit - 32) * 5) / 9)}°C`;
}

export const minutes = (seconds: number) => seconds / 60;

export function hoursMinutes(seconds: number): string {
  const total = Math.round(seconds / 60);
  const hours = Math.floor(total / 60);
  return hours ? `${hours} h ${total % 60} min` : `${total} min`;
}

/** Percentage of total, clamped to 0–100; 0 when total is missing or zero. */
export const percentOf = (
  value: number | null | undefined,
  total: number | null | undefined,
) => (value == null || !total ? 0 : Math.min(100, (value / total) * 100));

/** Evenly spaced "nice" ticks (steps of 1, 2, 2.5, or 5 × 10ⁿ) covering [min, max]. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (max <= min) max = min + 1;
  const raw = (max - min) / Math.max(1, count - 1);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step =
    [1, 2, 2.5, 5, 10]
      .map((multiple) => multiple * magnitude)
      .find((value) => value >= raw) ?? 10 * magnitude;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= end + step / 2; value += step)
    ticks.push(+value.toFixed(6));
  return ticks;
}

/** Ticks for durations in seconds on clock-friendly steps (15 s, 30 s, 1 min, …). */
export function clockTicks(min: number, max: number, count = 5): number[] {
  const raw = (max - min) / Math.max(1, count - 1);
  const step =
    [5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600].find(
      (value) => value >= raw,
    ) ?? 3600;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= end; value += step) ticks.push(value);
  return ticks;
}
