import { Box, Stack, Typography } from "@mui/material";

import type { TrainingLoad } from "../../api/analytics";
import { colors } from "../../app/tokens";
import { loadBandColors } from "./chartTheme";

/**
 * Horizontal acute:chronic band scale (0–2.0) with a marker at the current ratio.
 * `compact` drops the tick labels for small dashboard tiles.
 */
export function LoadRatioScale({
  load,
  compact = false,
}: {
  load: TrainingLoad;
  compact?: boolean;
}) {
  const max = 2;
  const ratio = load.acute_chronic_ratio;
  return (
    <Box sx={{ position: "relative", pt: 2.75 }} aria-hidden>
      <Stack
        direction="row"
        sx={{
          height: compact ? 12 : 14,
          borderRadius: "3px",
          overflow: "hidden",
          border: `2px solid ${colors.border}`,
        }}
      >
        {load.bands.map((band, index) => {
          const lower = band.lower ?? 0;
          const upper = Math.min(band.upper ?? max, max);
          return (
            <Box
              key={band.label}
              sx={{
                width: `${((upper - lower) / max) * 100}%`,
                bgcolor: loadBandColors[band.label],
                borderLeft:
                  index === 0 ? 0 : `1px solid rgba(27, 33, 28, 0.35)`,
              }}
            />
          );
        })}
      </Stack>
      {!compact && (
        <Stack
          direction="row"
          sx={{ mt: 0.5, position: "relative", height: 16 }}
        >
          {load.bands
            .filter((band) => band.lower != null)
            .map((band) => (
              <Typography
                key={band.label}
                variant="caption"
                color="text.secondary"
                sx={{
                  position: "absolute",
                  left: `${(band.lower! / max) * 100}%`,
                  transform: "translateX(-50%)",
                  lineHeight: 1,
                }}
              >
                {band.lower!.toFixed(1)}
              </Typography>
            ))}
        </Stack>
      )}
      {ratio != null && (
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: `${(Math.min(ratio, max) / max) * 100}%`,
            transform: "translateX(-50%)",
            textAlign: "center",
          }}
        >
          <Typography
            variant="caption"
            fontWeight={800}
            sx={{ lineHeight: 1, display: "block", mb: "2px" }}
          >
            {ratio.toFixed(2)}
          </Typography>
          <Box
            sx={{
              width: 6,
              height: compact ? 20 : 22,
              bgcolor: colors.ink,
              border: `1.5px solid ${colors.panel}`,
              mx: "auto",
            }}
          />
        </Box>
      )}
    </Box>
  );
}
