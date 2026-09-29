import { Box, Stack, Typography } from "@mui/material";

import { temperatureBands } from "./chartTheme";
import type { TemperatureUnit } from "./format";

const toUnit = (fahrenheit: number, unit: TemperatureUnit) =>
  unit === "F"
    ? `${fahrenheit}°`
    : `${Math.round(((fahrenheit - 32) * 5) / 9)}°`;

function Swatch({ color, hollow }: { color: string; hollow?: boolean }) {
  return (
    <Box
      component="span"
      sx={{
        width: 10,
        height: 10,
        borderRadius: "50%",
        bgcolor: hollow ? "transparent" : color,
        border: hollow ? "1.5px solid #8a8984" : "1px solid #fff",
        boxShadow: hollow ? "none" : "0 0 0 1px rgba(0,0,0,.08)",
        flexShrink: 0,
      }}
    />
  );
}

/** Legend for points colored by recorded (device) temperature. */
export function TemperatureLegend({ unit }: { unit: TemperatureUnit }) {
  const labels = temperatureBands.map((band, index) => {
    const lower = index === 0 ? null : temperatureBands[index - 1].upperF;
    if (lower == null) return `< ${toUnit(band.upperF!, unit)}`;
    if (band.upperF == null) return `≥ ${toUnit(lower, unit)}`;
    return `${toUnit(lower, unit)}–${toUnit(band.upperF, unit)}`;
  });
  return (
    <Stack
      direction="row"
      flexWrap="wrap"
      columnGap={1.5}
      rowGap={0.5}
      alignItems="center"
      aria-label="Temperature color legend"
    >
      <Typography variant="caption" color="text.secondary" fontWeight={700}>
        Recorded temp ({unit === "F" ? "°F" : "°C"}):
      </Typography>
      {temperatureBands.map((band, index) => (
        <Stack
          key={band.color}
          direction="row"
          spacing={0.5}
          alignItems="center"
        >
          <Swatch color={band.color} />
          <Typography variant="caption" color="text.secondary">
            {labels[index]}
          </Typography>
        </Stack>
      ))}
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Swatch color="#fff" hollow />
        <Typography variant="caption" color="text.secondary">
          not recorded
        </Typography>
      </Stack>
    </Stack>
  );
}
