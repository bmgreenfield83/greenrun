import { ButtonBase, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { Link } from "wouter";

import { colors } from "../../app/tokens";

type LinkRowProps = {
  href: string;
  primary: ReactNode;
  secondary?: ReactNode;
  /** Right-aligned value, such as a date or metric. */
  trailing?: ReactNode;
};

/**
 * A full-width, touch-friendly navigational row for short lists inside cards.
 * Wraps gracefully on narrow screens instead of squeezing both sides.
 */
export function LinkRow({ href, primary, secondary, trailing }: LinkRowProps) {
  return (
    <ButtonBase
      component={Link}
      href={href}
      sx={{
        display: "flex",
        width: "100%",
        minHeight: 48,
        px: 1.5,
        py: 1,
        columnGap: 1.5,
        rowGap: 0.25,
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        textAlign: "left",
        borderRadius: "4px",
        color: "text.primary",
        transition: "background-color 120ms ease",
        "&:hover": { bgcolor: colors.parchment },
        "& + &": { borderTop: `1px dashed ${colors.rule}` },
      }}
    >
      <Stack sx={{ minWidth: 0, flex: "1 1 12rem" }}>
        <Typography fontWeight={700}>{primary}</Typography>
        {secondary && (
          <Typography variant="body2" color="text.secondary">
            {secondary}
          </Typography>
        )}
      </Stack>
      {trailing && (
        <Typography
          variant="body2"
          fontWeight={700}
          color="primary.dark"
          sx={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}
        >
          {trailing}
        </Typography>
      )}
    </ButtonBase>
  );
}
