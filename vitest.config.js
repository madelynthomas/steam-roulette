import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";

// @vitejs/plugin-react-swc is used instead of @vitejs/plugin-react because
// this project uses .js file extensions for JSX. Vite 6's built-in oxc
// transformer explicitly excludes .js files from JSX parsing, and the SWC plugin
// also skips .js files by default. The parserConfig override below tells SWC to
// treat .js files as ecmascript+JSX so they are transformed before import-analysis.
export default defineConfig({
  plugins: [
    react({
      // Suppress the "use @vitejs/plugin-react for better perf" recommendation —
      // we need SWC here precisely because plugin-react v6 delegates to Vite 6's
      // oxc which explicitly excludes .js files from JSX parsing.
      disableOxcRecommendation: true,
      parserConfig(id) {
        if (id.endsWith(".tsx")) return { syntax: "typescript", tsx: true };
        if (id.endsWith(".ts") || id.endsWith(".mts"))
          return { syntax: "typescript", tsx: false };
        // All other JS/JSX files — includes the project's .js files that contain JSX
        return { syntax: "ecmascript", jsx: true };
      },
    }),
  ],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.js"],
    // Only include unit/component tests — Playwright e2e tests run via their own runner
    include: ["__tests__/**/*.{test,spec}.{js,jsx}"],
  },
});
