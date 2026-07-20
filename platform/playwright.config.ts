import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "line",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: [
    {
      command:
        "NODE_ENV=test DATABASE_URL=${TEST_DATABASE_URL:-postgres://localhost/ryva_pro_test} PGSSL=disable SESSION_PEPPER=test-session-pepper FIELD_ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000 APP_URL=http://127.0.0.1:5173 PORT=8787 RATE_LIMIT_LOGIN_MAX=100 npm run dev:api",
      url: "http://127.0.0.1:8787/readyz",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000
    },
    {
      command: "npm run dev:web -- --host 127.0.0.1",
      url: "http://127.0.0.1:5173/login",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000
    }
  ],
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "chromium-mobile", use: { ...devices["Pixel 7"] } }
  ]
});
