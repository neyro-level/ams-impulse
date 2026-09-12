import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "line",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: "node scripts/e2e-s3-server.mjs",
      url: "http://127.0.0.1:3199/health",
      reuseExistingServer: false,
      timeout: 30_000,
      env: { APP_ENV: "test", E2E_S3_PORT: "3199" },
    },
    {
      command: "node --env-file-if-exists=.env.local node_modules/prisma/build/index.js migrate deploy && node --env-file-if-exists=.env.local scripts/pgboss-migrate.mjs && node --env-file-if-exists=.env.local node_modules/tsx/dist/cli.mjs scripts/seed-e2e-admin.ts --confirm-local-e2e && node --env-file-if-exists=.env.local .next/standalone/server.js",
      url: `${baseURL}/api/health/live`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        HOSTNAME: "127.0.0.1",
        PORT: "3100",
        NODE_ENV: "production",
        BETTER_AUTH_SECRET: "e2e-only-secret-at-least-thirty-two-characters",
        BETTER_AUTH_URL: baseURL,
        APP_ENV: "test",
        RESEARCH_QUERY_ESTIMATE_KOPECKS: "100",
        RESEARCH_DAILY_LIMIT_KOPECKS: "10000",
        RESEARCH_MONTHLY_LIMIT_KOPECKS: "100000",
        S3_BUCKET: "research-e2e",
        S3_ENDPOINT: "http://127.0.0.1:3199",
        S3_REGION: "e2e",
        AWS_ACCESS_KEY_ID: "e2e-access-key",
        AWS_SECRET_ACCESS_KEY: "e2e-secret-key",
      },
    },
  ],
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: { extraHTTPHeaders: { "x-real-ip": "192.0.2.10" } },
    },
    {
      name: "mobile-375",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 812 },
        extraHTTPHeaders: { "x-real-ip": "192.0.2.40" },
      },
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts/,
    },
    {
      name: "tablet-768",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 768, height: 1024 },
        extraHTTPHeaders: { "x-real-ip": "192.0.2.80" },
      },
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts/,
    },
    {
      name: "desktop-1280",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
        extraHTTPHeaders: { "x-real-ip": "192.0.2.120" },
      },
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts/,
    },
    {
      name: "desktop-1440",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        extraHTTPHeaders: { "x-real-ip": "192.0.2.160" },
      },
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts/,
    },
  ],
});
