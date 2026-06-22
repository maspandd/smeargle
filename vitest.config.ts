import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "jsdom",
    fileParallelism: false,
    maxWorkers: 1,
    pool: "threads",
    setupFiles: ["tests/setup.ts"],
  },
});
