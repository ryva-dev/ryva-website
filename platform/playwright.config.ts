import { defineConfig, devices } from "@playwright/test";

const apiPort = process.env.E2E_API_PORT ?? "8787";
const webPort = process.env.E2E_WEB_PORT ?? "5173";
const baseURL = `http://127.0.0.1:${webPort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  timeout: 60_000,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "line",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 15_000
  },
  webServer: [
    {
      command:
        `NODE_ENV=test DATABASE_URL=\${TEST_DATABASE_URL:-postgres://localhost/ryva_pro_test} PGSSL=disable SESSION_PEPPER=test-session-pepper FIELD_ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000 APP_URL=${baseURL} TERMS_DOCUMENT_URL=https://example.test/terms TERMS_DOCUMENT_VERSION=terms-test-v1 PRIVACY_DOCUMENT_URL=https://example.test/privacy PRIVACY_DOCUMENT_VERSION=privacy-test-v1 PORT=${apiPort} RATE_LIMIT_LOGIN_MAX=500 npm run dev:api`,
      url: `http://127.0.0.1:${apiPort}/readyz`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000
    },
    {
      command: `VITE_API_TARGET=http://127.0.0.1:${apiPort} npm run dev:web -- --host 127.0.0.1 --port ${webPort}`,
      url: `${baseURL}/login`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000
    }
  ],
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "chromium-mobile", use: { ...devices["Pixel 7"] } }
  ]
});
