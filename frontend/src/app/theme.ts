import { alpha, createTheme } from "@mui/material/styles";

const primaryMain = "#174a5b";
const divider = "#dce5e3";

const base = createTheme({
  palette: {
    mode: "light",
    primary: { main: primaryMain, light: "#e5f1f3", dark: "#0d3441" },
    secondary: { main: "#d96b4f", light: "#fbe9e4" },
    success: { main: "#2f7d5b", light: "#e8f4ee" },
    warning: { main: "#b56a18", light: "#fff3df" },
    background: { default: "#f3f6f5", paper: "#ffffff" },
    text: { primary: "#17262b", secondary: "#56666d" },
    divider,
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily:
      'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    button: { fontWeight: 700, textTransform: "none" },
  },
});

const { breakpoints } = base;
const focusRing = `0 0 0 3px ${alpha(primaryMain, 0.35)}`;

/**
 * Shared visual tokens. Pages should use these (via the theme) rather than
 * one-off values so spacing, type, and focus treatment stay consistent.
 */
export const theme = createTheme(base, {
  typography: {
    // Page titles.
    h4: {
      fontWeight: 750,
      letterSpacing: "-0.035em",
      lineHeight: 1.15,
      fontSize: "1.75rem",
      [breakpoints.up("md")]: { fontSize: "2.125rem" },
    },
    // Card and section titles.
    h5: {
      fontWeight: 700,
      letterSpacing: "-0.02em",
      lineHeight: 1.3,
      fontSize: "1.2rem",
      [breakpoints.up("md")]: { fontSize: "1.35rem" },
    },
    h6: { fontWeight: 700, fontSize: "1.1rem", lineHeight: 1.35 },
    // Small labels above metric values.
    overline: {
      fontWeight: 700,
      fontSize: "0.7rem",
      letterSpacing: "0.08em",
      lineHeight: 1.7,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundImage:
            "radial-gradient(circle at 8% 0%, rgba(23,74,91,.07), transparent 28rem)",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderColor: divider,
          boxShadow: "0 8px 28px rgba(20, 54, 61, 0.055)",
          overflow: "hidden",
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: 16,
          "&:last-child": { paddingBottom: 16 },
          [breakpoints.up("sm")]: {
            padding: 24,
            "&:last-child": { paddingBottom: 24 },
          },
        },
      },
    },
    MuiButtonBase: {
      styleOverrides: {
        root: {
          "&.Mui-focusVisible": { boxShadow: focusRing },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 10, minHeight: 40 },
        sizeSmall: { minHeight: 32 },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: { "&.Mui-focusVisible": { boxShadow: focusRing } },
      },
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 700 } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: 12 } } },
    MuiLinearProgress: {
      styleOverrides: {
        root: { height: 9, borderRadius: 999 },
        colorPrimary: { backgroundColor: "#d6e4e6" },
        bar: { borderRadius: 999 },
      },
    },
    MuiSkeleton: { styleOverrides: { rounded: { borderRadius: 10 } } },
    MuiTableHead: {
      styleOverrides: { root: { backgroundColor: "#f4f8f7" } },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { fontVariantNumeric: "tabular-nums", borderColor: divider },
        head: {
          color: base.palette.text.secondary,
          fontSize: "0.72rem",
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:last-child td": { borderBottom: 0 },
          "tbody &:hover": { backgroundColor: "#f7faf9" },
        },
      },
    },
  },
});
