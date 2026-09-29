import { Box, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

import { colors } from "../../app/tokens";

type SectionTitleProps = {
  children: ReactNode;
  icon?: ReactNode;
  /** Optional control aligned to the right of the title. */
  action?: ReactNode;
};

/** Card/section heading with optional leading icon and trailing action. */
export function SectionTitle({ children, icon, action }: SectionTitleProps) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      gap={1}
    >
      <Stack direction="row" spacing={1} alignItems="center" minWidth={0}>
        {icon ?? (
          <Box
            aria-hidden
            sx={{
              width: 10,
              height: 10,
              flexShrink: 0,
              bgcolor: colors.orange,
              border: `2px solid ${colors.border}`,
            }}
          />
        )}
        <Typography variant="h5" component="h2">
          {children}
        </Typography>
      </Stack>
      {action}
    </Stack>
  );
}
