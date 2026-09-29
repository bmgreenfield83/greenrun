import { Box, Typography } from "@mui/material";
import type { ReactNode } from "react";

import { signage } from "../../app/tokens";
import { SectionTitle } from "./SectionTitle";

/**
 * Heading for a group of panels (e.g. a grid of charts). Sits between panels on the
 * page background, so it is an opaque signage tab rather than loose text.
 */
export function SectionPlate({
  title,
  description,
}: {
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <Box
      sx={{
        ...signage,
        alignSelf: "flex-start",
        maxWidth: "100%",
        px: { xs: 2, sm: 2.5 },
        py: 1.25,
      }}
    >
      <SectionTitle>{title}</SectionTitle>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {description}
        </Typography>
      )}
    </Box>
  );
}
