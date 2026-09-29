import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#174a5b", light: "#e5f1f3", dark: "#0d3441" },
    secondary: { main: "#d96b4f", light: "#fbe9e4" },
    success: { main: "#2f7d5b", light: "#e8f4ee" },
    warning: { main: "#b56a18", light: "#fff3df" },
    background: { default: "#f3f6f5", paper: "#ffffff" },
    text: { primary: "#17262b", secondary: "#607077" },
    divider: "#dce5e3",
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily:
      'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h4: { fontWeight: 750, letterSpacing: "-0.035em" },
    h5: { fontWeight: 700, letterSpacing: "-0.02em" },
    h6: { fontWeight: 700 },
    button: { fontWeight: 700, textTransform: "none" },
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
          borderColor: "#dce5e3",
          boxShadow: "0 8px 28px rgba(20, 54, 61, 0.055)",
          overflow: "hidden",
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: { padding: 24, "&:last-child": { paddingBottom: 24 } },
      },
    },
    MuiButton: { styleOverrides: { root: { borderRadius: 10 } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 700 } } },
    MuiLinearProgress: {
      styleOverrides: { root: { height: 9, borderRadius: 999 } },
    },
    MuiTableHead: {
      styleOverrides: { root: { backgroundColor: "#f4f8f7" } },
    },
  },
});
