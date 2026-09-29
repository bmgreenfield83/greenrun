import { Box, Typography, type SxProps, type Theme } from "@mui/material";
import type { ReactNode } from "react";

import { colors, pixelFont } from "../../app/tokens";

type StatValueProps = {
  value: ReactNode;
  unit?: ReactNode;
  size?: "sm" | "md" | "lg";
  color?: string;
  sx?: SxProps<Theme>;
};

const sizes = {
  sm: { xs: "1.1rem", sm: "1.3rem" },
  md: { xs: "1.35rem", sm: "1.8rem" },
  lg: { xs: "1.9rem", sm: "2.6rem" },
};

/** Big stat number in the pixel font, with an optional small unit. */
export function StatValue({
  value,
  unit,
  size = "md",
  color = colors.forest,
  sx,
}: StatValueProps) {
  return (
    <Typography
      component="p"
      sx={[
        {
          fontFamily: pixelFont,
          fontSize: sizes[size],
          lineHeight: 1.1,
          color,
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {value}
      {unit && (
        <Box
          component="span"
          sx={{
            ml: 0.5,
            fontFamily: "inherit",
            fontSize: "0.5em",
            color: colors.inkMuted,
          }}
        >
          {unit}
        </Box>
      )}
    </Typography>
  );
}
