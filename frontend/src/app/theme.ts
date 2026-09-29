import { alpha, createTheme } from "@mui/material/styles";

import { bodyFont, colors, pixelFont, signage } from "./tokens";

const base = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: colors.forest,
      light: colors.forestTint,
      dark: colors.forestDark,
      contrastText: colors.cream,
    },
    secondary: {
      main: colors.orange,
      light: colors.orangeTint,
      dark: colors.orangeText,
      contrastText: colors.ink,
    },
    success: {
      main: colors.success,
      light: colors.successTint,
      contrastText: "#fff",
    },
    warning: {
      main: colors.warning,
      light: colors.warningTint,
      contrastText: "#fff",
    },
    error: { main: colors.error, light: colors.errorTint },
    info: { main: colors.info, light: colors.infoTint },
    background: { default: colors.page, paper: colors.panel },
    text: { primary: colors.ink, secondary: colors.inkMuted },
    divider: colors.rule,
  },
  shape: { borderRadius: 6 },
  typography: {
    fontFamily: bodyFont,
    button: { fontWeight: 700, textTransform: "none" },
  },
});

const { breakpoints } = base;
const focusOutline = {
  outline: `3px solid ${colors.orange}`,
  outlineOffset: 2,
};
const hardShadow = (size: number) => `${size}px ${size}px 0 ${colors.shadow}`;

/**
 * Shared visual tokens. Pages should use these (via the theme) rather than
 * one-off values so spacing, type, and focus treatment stay consistent.
 */
export const theme = createTheme(base, {
  typography: {
    // Page titles.
    h4: {
      fontWeight: 800,
      letterSpacing: "-0.025em",
      lineHeight: 1.15,
      fontSize: "1.6rem",
      [breakpoints.up("md")]: { fontSize: "2rem" },
    },
    // Card and section titles.
    h5: {
      fontWeight: 800,
      letterSpacing: "-0.015em",
      lineHeight: 1.3,
      fontSize: "1.12rem",
      [breakpoints.up("md")]: { fontSize: "1.25rem" },
    },
    h6: { fontWeight: 750, fontSize: "1.02rem", lineHeight: 1.35 },
    // Small signage labels above metric values (pixel font).
    overline: {
      fontFamily: pixelFont,
      fontWeight: 400,
      fontSize: "0.72rem",
      letterSpacing: "0.04em",
      lineHeight: 1.6,
      textTransform: "uppercase",
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ":root": {
          "--gr-forest": colors.forest,
          "--gr-forest-dark": colors.forestDark,
          "--gr-forest-tint": colors.forestTint,
          "--gr-panel": colors.panel,
          "--gr-parchment": colors.parchment,
          "--gr-rule": colors.rule,
          "--gr-ink": colors.ink,
          "--gr-ink-muted": colors.inkMuted,
          "--gr-orange": colors.orange,
          "--gr-shadow": colors.shadow,
          "--gr-pixel-font": pixelFont,
        },
        body: { backgroundColor: colors.page },
        "::selection": { background: alpha(colors.orange, 0.3) },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
        outlined: { borderColor: colors.rule, borderWidth: 1.5 },
      },
    },
    MuiCard: {
      styleOverrides: {
        // "&&" beats Paper's outlined variant so every card reads as signage.
        root: {
          "&&": { ...signage },
          overflow: "hidden",
          // A card inside a card is a lighter inset, not a second sign.
          ".MuiCard-root &&": {
            border: `1.5px solid ${colors.rule}`,
            boxShadow: "none",
            backgroundColor: colors.parchment,
          },
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: 16,
          "&:last-child": { paddingBottom: 16 },
          [breakpoints.up("sm")]: {
            padding: 22,
            "&:last-child": { paddingBottom: 22 },
          },
        },
      },
    },
    MuiButtonBase: {
      defaultProps: { disableRipple: true },
      styleOverrides: {
        root: { "&.Mui-focusVisible": focusOutline },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          minHeight: 40,
          paddingInline: 14,
          transition:
            "transform 80ms ease, box-shadow 80ms ease, background-color 120ms ease",
        },
        sizeSmall: { minHeight: 32, paddingInline: 10 },
        contained: {
          border: `2px solid ${colors.border}`,
          boxShadow: hardShadow(2),
          "&:hover": {
            boxShadow: hardShadow(3),
            transform: "translate(-1px, -1px)",
          },
          "&:active": { boxShadow: "none", transform: "translate(2px, 2px)" },
          "&.Mui-disabled": {
            borderColor: colors.rule,
            boxShadow: "none",
          },
        },
        containedSecondary: { color: colors.ink },
        outlined: {
          borderWidth: 2,
          borderColor: colors.border,
          backgroundColor: colors.panel,
          boxShadow: hardShadow(2),
          "&:hover": {
            borderWidth: 2,
            backgroundColor: colors.parchment,
            boxShadow: hardShadow(3),
            transform: "translate(-1px, -1px)",
          },
          "&:active": { boxShadow: "none", transform: "translate(2px, 2px)" },
          "&.Mui-disabled": { borderWidth: 2, boxShadow: "none" },
        },
        outlinedError: { borderColor: colors.error },
        text: {
          "&:hover": { backgroundColor: alpha(colors.forest, 0.08) },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          "&.Mui-focusVisible": focusOutline,
        },
      },
    },
    MuiToggleButtonGroup: {
      styleOverrides: {
        root: {
          border: `2px solid ${colors.border}`,
          borderRadius: 4,
          boxShadow: hardShadow(2),
          backgroundColor: colors.panel,
        },
        grouped: {
          border: 0,
          borderRadius: 0,
          "&:not(:first-of-type)": {
            borderLeft: `2px solid ${colors.border}`,
          },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          fontWeight: 700,
          color: colors.inkMuted,
          textTransform: "none",
          "&.Mui-selected, &.Mui-selected:hover": {
            backgroundColor: colors.forest,
            color: colors.cream,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 700,
          borderRadius: 4,
          border: `1.5px solid ${alpha(colors.ink, 0.22)}`,
          "&.MuiChip-colorDefault.MuiChip-filled": {
            backgroundColor: colors.parchmentDeep,
          },
        },
        colorPrimary: {
          "&.MuiChip-filled": {
            backgroundColor: colors.forest,
            borderColor: colors.forestDark,
          },
        },
        colorSuccess: {
          "&.MuiChip-filled": { borderColor: "#1d5530" },
        },
        colorSecondary: {
          "&.MuiChip-filled": {
            backgroundColor: colors.orange,
            color: colors.ink,
            borderColor: "#9c4d14",
          },
        },
        outlined: { borderWidth: 1.5 },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          border: "2px solid currentColor",
          boxShadow: "none",
        },
        standardWarning: {
          backgroundColor: colors.warningTint,
          color: "#6e3f0a",
        },
        standardError: { backgroundColor: colors.errorTint, color: "#7c1f1a" },
        standardSuccess: {
          backgroundColor: colors.successTint,
          color: "#1d5530",
        },
        standardInfo: { backgroundColor: colors.infoTint, color: "#1f4a75" },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          height: 12,
          borderRadius: 3,
          border: `2px solid ${colors.border}`,
          backgroundColor: colors.parchment,
        },
        colorPrimary: { backgroundColor: colors.parchment },
        bar: {
          borderRadius: 0,
          // Blocky segments for a pixel-signage feel.
          backgroundImage: `repeating-linear-gradient(90deg, transparent 0 10px, ${alpha(colors.panel, 0.35)} 10px 12px)`,
        },
      },
    },
    MuiSkeleton: {
      styleOverrides: {
        root: { backgroundColor: alpha(colors.forest, 0.09) },
        rounded: { borderRadius: 4 },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          backgroundColor: "#fffdf7",
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "#9d9476",
            borderWidth: 1.5,
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: colors.forest,
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: colors.forest,
            borderWidth: 2,
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          ...signage,
          boxShadow: hardShadow(6),
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { backgroundColor: colors.panel, borderColor: colors.border },
        paperAnchorRight: { borderLeft: `2px solid ${colors.border}` },
        paperAnchorBottom: {
          borderTop: `2px solid ${colors.border}`,
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          ...signage,
          boxShadow: hardShadow(4),
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: colors.ink,
          color: colors.cream,
          borderRadius: 4,
          fontSize: "0.78rem",
          fontWeight: 600,
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        track: { opacity: 0.5 },
      },
    },
    MuiTableContainer: {
      styleOverrides: { root: { borderRadius: 6 } },
    },
    MuiTableHead: {
      styleOverrides: { root: { backgroundColor: colors.parchment } },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { fontVariantNumeric: "tabular-nums", borderColor: colors.rule },
        head: {
          color: colors.inkMuted,
          fontSize: "0.72rem",
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          borderBottom: `2px solid ${colors.rule}`,
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:last-child td": { borderBottom: 0 },
          "tbody &:hover": { backgroundColor: colors.parchment },
        },
      },
    },
    MuiTab: {
      styleOverrides: { root: { textTransform: "none", fontWeight: 700 } },
    },
  },
});
