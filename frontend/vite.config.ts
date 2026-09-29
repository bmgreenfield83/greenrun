import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "..", "");
  const allowedHosts = (env.VITE_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);

  return {
    envDir: "..",
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      port: 5174,
      strictPort: true,
      allowedHosts,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            charts: ["recharts"],
            vendor: [
              "react",
              "react-dom",
              "wouter",
              "@tanstack/react-query",
              "@mui/material",
              "@mui/icons-material",
              "@emotion/react",
              "@emotion/styled",
            ],
          },
        },
      },
    },
    test: {
      environment: "jsdom",
      exclude: ["e2e/**", "node_modules/**", "dist/**"],
      globals: true,
      setupFiles: "./src/test/setup.ts",
    },
  };
});
