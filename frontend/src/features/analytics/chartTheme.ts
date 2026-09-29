import { bodyFont, colors } from "../../app/tokens";

/**
 * Shared chart tokens for analytics and activity charts, matching the trailhead theme.
 * Colors are assigned by the job they do: a small categorical set for series identity,
 * the familiar Z1 blue → Z5 red scale for heart-rate zones, and a diverging blue↔red scale
 * (gray midpoint) for recorded temperature.
 */
export const axisTick = {
  fontSize: 12,
  fill: colors.inkMuted,
  fontFamily: bodyFont,
};
export const gridStroke = "#e0d5b9";
export const inkMuted = colors.inkMuted;
export const cursorFill = "rgba(31, 61, 44, 0.07)";
export const tooltipStyle = {
  borderRadius: 4,
  border: `2px solid ${colors.border}`,
  boxShadow: `3px 3px 0 ${colors.shadow}`,
  fontSize: 13,
  background: colors.panel,
  padding: "8px 10px",
};

export const seriesColors = {
  primary: "#2f6b4a",
  primaryLight: "#b3cfb9",
  secondary: colors.orange,
  reference: colors.ink,
  muted: "#a39d88",
  warning: colors.warning,
  /** Emphasis for "hit the target" marks (e.g. reps at goal pace). */
  highlight: colors.orange,
  success: colors.success,
  /** Extra categorical hues for multi-series activity charts. */
  blue: "#2f6aa6",
  red: "#c0392f",
  earth: "#8a6a3b",
};

/**
 * Heart-rate zone colors, Z1..Z5 (index 0 = Z1): blue, green, yellow, orange, red.
 * The single source for every zone display (tables, stacked bars, distributions,
 * legends). Mid-saturation so they read on cream without looking neon; the yellow
 * is a deep gold so it stays visible on the parchment panels.
 */
export const zoneColors = [
  "#3d7cc9",
  "#3f9950",
  "#e0b21b",
  "#e8772a",
  "#c9352b",
];

/** Thin outline for small zone swatches so light fills keep an edge on cream. */
export const zoneSwatchBorder = "1px solid rgba(27, 33, 28, 0.35)";

/** Training-load ratio band fills (acute:chronic). */
export const loadBandColors = {
  low: "#d5e0ea",
  typical: "#cde5cf",
  elevated: "#f6ddae",
  spike: "#f2c1b9",
} as const;

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
