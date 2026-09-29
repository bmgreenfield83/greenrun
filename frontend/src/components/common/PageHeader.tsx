import { Box, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

import { colors } from "../../app/tokens";

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  /** Small pixel label above the title (defaults to none). */
  eyebrow?: ReactNode;
  /** Optional page-level actions shown to the right (below on phones). */
  actions?: ReactNode;
};

/**
 * Page title plate, styled like a routed trail sign: forest green, cream
 * lettering, hard shadow. Opaque so it stays readable over the background scene.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
}: PageHeaderProps) {
  return (
    <Box
      sx={{
        position: "relative",
        bgcolor: colors.forest,
        color: colors.cream,
        border: `2px solid ${colors.forestDark}`,
        borderRadius: "6px",
        boxShadow: `4px 4px 0 ${colors.shadow}`,
        px: { xs: 2, sm: 3 },
        py: { xs: 1.75, sm: 2.25 },
        // Routed inner line, like a carved park sign.
        "&::after": {
          content: '""',
          position: "absolute",
          inset: 4,
          border: `1px solid rgba(255, 250, 240, 0.22)`,
          borderRadius: "3px",
          pointerEvents: "none",
        },
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
        gap={{ xs: 1.5, sm: 2 }}
        sx={{ position: "relative", zIndex: 1 }}
      >
        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          {eyebrow && (
            <Typography
              variant="overline"
              component="p"
              sx={{ color: colors.orangeOnForest, lineHeight: 1.3 }}
            >
              {eyebrow}
            </Typography>
          )}
          <Typography variant="h4" component="h1">
            {title}
          </Typography>
          {description && (
            <Typography
              sx={{
                maxWidth: "72ch",
                color: "rgba(255, 250, 240, 0.82)",
                fontSize: { xs: "0.92rem", sm: "1rem" },
              }}
            >
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
            alignItems="center"
            sx={{
              flexShrink: 0,
              // Keep actions legible on the green plate.
              "& .MuiButton-text": {
                color: colors.cream,
                "&:hover": { bgcolor: "rgba(255, 250, 240, 0.12)" },
              },
              "& .MuiButton-containedPrimary": {
                bgcolor: colors.orange,
                color: colors.ink,
                borderColor: colors.forestDark,
                "&:hover": { bgcolor: "#e98a43" },
              },
              "& .MuiButton-outlined": { color: colors.forest },
              "& .MuiToggleButton-root.Mui-selected, & .MuiToggleButton-root.Mui-selected:hover":
                { bgcolor: colors.orange, color: colors.ink },
            }}
          >
            {actions}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
