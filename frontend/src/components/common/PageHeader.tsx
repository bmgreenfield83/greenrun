import { Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  /** Optional page-level actions shown to the right (below on phones). */
  actions?: ReactNode;
};

/** Consistent title, description, and action layout for every page. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      justifyContent="space-between"
      alignItems={{ xs: "stretch", sm: "flex-start" }}
      gap={{ xs: 1.5, sm: 2 }}
    >
      <Stack spacing={0.75} sx={{ minWidth: 0 }}>
        <Typography variant="h4" component="h1">
          {title}
        </Typography>
        {description && (
          <Typography color="text.secondary" sx={{ maxWidth: "72ch" }}>
            {description}
          </Typography>
        )}
      </Stack>
      {actions && (
        <Stack
          direction="row"
          spacing={1}
          flexWrap="wrap"
          useFlexGap
          sx={{ flexShrink: 0 }}
        >
          {actions}
        </Stack>
      )}
    </Stack>
  );
}
