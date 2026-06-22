import { defineConfig } from "@playwright/test";

process.env.DATABASE_URL ??=
  "postgresql://postgres@localhost:55432/mock_data_generator";

export default defineConfig({
  testDir: "./tests/acceptance",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3000" },
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
  },
});
