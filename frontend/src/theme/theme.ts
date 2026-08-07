import { createTheme } from "@mui/material/styles";

export type AppColorMode = "light" | "dark";

export const createAppTheme = (mode: AppColorMode) =>
  createTheme({
    palette: {
      mode,
      primary: { main: "#4F46E5" },
      secondary: { main: "#0EA5E9" },
      background: mode === "dark"
        ? { default: "#111827", paper: "#1F2937" }
        : { default: "#F7F8FB", paper: "#FFFFFF" },
      divider: mode === "dark" ? "#374151" : "#E5E7EB",
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"].join(","),
      h4: { fontWeight: 700 },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 600 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { transition: "background-color 180ms ease, color 180ms ease" },
        },
      },
      MuiButton: { styleOverrides: { root: { textTransform: "none", fontWeight: 600 } } },
      MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
      MuiTableCell: { styleOverrides: { root: { borderColor: mode === "dark" ? "#374151" : "#E5E7EB" } } },
    },
  });