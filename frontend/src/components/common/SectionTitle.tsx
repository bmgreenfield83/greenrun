import { Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

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
        {icon}
        <Typography variant="h5" component="h2">
          {children}
        </Typography>
      </Stack>
      {action}
    </Stack>
  );
}
