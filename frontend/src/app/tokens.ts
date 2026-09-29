/**
 * Design tokens for the "trailhead" look: deep forest green, warm parchment
 * panels, a sunrise-orange accent, and ink-dark text. The MUI theme, the chart
 * theme, and the global stylesheet (via CSS custom properties) all read these,
 * so a color only needs to change here.
 *
 * Contrast (WCAG): ink on panel ≈ 15.8:1, inkMuted on panel ≈ 7.2:1, forest on
 * panel ≈ 11:1, cream on forest ≈ 11.5:1, orangeText on panel ≈ 5.3:1,
 * orangeOnForest on forest ≈ 6:1, success/warning on their tints ≈ 5.3:1.
 */
export const colors = {
  /** Primary: deep forest green. */
  forest: "#1f3d2c",
  forestDark: "#132a1d",
  forestMid: "#2f5a40",
  forestTint: "#e2eadb",
  /** Page background (visible between panels; the pixel scene will sit here). */
  page: "#ece3cb",
  /** Opaque panel/card surface. */
  panel: "#fffaf0",
  /** Slightly deeper parchment for inset areas, table heads, and hover. */
  parchment: "#f5eddb",
  parchmentDeep: "#ebe0c6",
  /** Hairlines inside panels. */
  rule: "#dcd0b2",
  /** Panel borders and hard shadows. */
  border: "#1f3d2c",
  shadow: "#132a1d",
  ink: "#1b211c",
  inkMuted: "#4f574c",
  inkFaint: "#7a7f70",
  /** Sunrise accent (fills, markers); use orangeText for text on light surfaces. */
  orange: "#e07a2f",
  /** Orange for small text on forest green (≥4.5:1). */
  orangeOnForest: "#f4a867",
  orangeText: "#a8501a",
  orangeTint: "#fbe6d2",
  success: "#276b3c",
  successTint: "#dcefdc",
  warning: "#8f520e",
  warningTint: "#fbeccd",
  error: "#b0302a",
  errorTint: "#f8dcd8",
  info: "#2f6aa6",
  infoTint: "#dde9f6",
  cream: "#fffaf0",
} as const;

/** Pixel font: brand wordmark, big stat numbers, and small overline labels only. */
export const pixelFont = '"Silkscreen", "Courier New", ui-monospace, monospace';

/** Readable sans for everything else (body, tables, chart ticks). */
export const bodyFont =
  '"DM Sans", Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

/** Signage-style panel: solid border, hard offset shadow, small radius. */
export const signage = {
  border: `2px solid ${colors.border}`,
  borderRadius: "6px",
  boxShadow: `4px 4px 0 ${colors.shadow}`,
  backgroundColor: colors.panel,
} as const;

/** Height of the phone bottom tab bar (excluding the safe-area inset). */
export const bottomBarHeight = 64;
