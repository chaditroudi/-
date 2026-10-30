import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react({ tsDecorators: true })],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}", "server/**/*.{test,spec}.{js,ts}"],
    env: {
      AI_GUIDE_ENABLED: "false",
      AI_GUIDE_PROVIDER: "disabled",
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
