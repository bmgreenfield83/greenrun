/**
 * Shared chart tokens for analytics charts, matching the activity charts' look.
 * Colors are assigned by the job they do: one categorical order for series identity,
 * a one-hue blue ramp for ordered heart-rate zones, and a diverging blue↔red scale
 * (gray midpoint) for recorded temperature.
 */
export const axisTick = { fontSize: 12, fill: "#56666d" };
export const gridStroke = "#e4ebe9";
export const inkMuted = "#56666d";
export const tooltipStyle = {
  borderRadius: 10,
  border: "1px solid #dce5e3",
  boxShadow: "0 8px 24px rgba(20,54,61,.12)",
  fontSize: 13,
  background: "#fff",
  padding: "8px 10px",
};

export const seriesColors = {
  primary: "#2a78d6",
  primaryLight: "#b7d3f6",
  secondary: "#eb6834",
  reference: "#17262b",
  muted: "#a3a29c",
  warning: "#b56a18",
  success: "#2f7d5b",
};

/** Z1..Z5, light to dark (ordinal blue ramp; every step clears 2:1 on white). */
export const zoneColors = [
  "#86b6ef",
  "#5598e7",
  "#2a78d6",
  "#1c5cab",
  "#104281",
];

type TemperatureBand = {
  /** Upper bound in °F (exclusive); null for the last band. */
  upperF: number | null;
  color: string;
};

/** Diverging temperature bands in °F: cold blues, neutral gray, warm reds. */
export const temperatureBands: TemperatureBand[] = [
  { upperF: 50, color: "#1c5cab" },
  { upperF: 60, color: "#6da7ec" },
  { upperF: 70, color: "#a3a29c" },
  { upperF: 80, color: "#ec8a89" },
  { upperF: null, color: "#c0392f" },
];

export const noTemperatureColor = "#ffffff";

export function temperatureColor(
  fahrenheit: number | null | undefined,
): string {
  if (fahrenheit == null) return noTemperatureColor;
  return (
    temperatureBands.find(
      (band) => band.upperF === null || fahrenheit < band.upperF,
    ) ?? temperatureBands[temperatureBands.length - 1]
  ).color;
}
