import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const databaseConfigured = Boolean(
  process.env.TEST_DATABASE_HOST
    && process.env.TEST_DATABASE_USER
    && process.env.TEST_DATABASE_PASSWORD
    && process.env.TEST_DATABASE_NAME,
);
const databaseDescribe = databaseConfigured ? describe : describe.skip;

databaseDescribe("worker process database lifecycle", () => {
  it("exits after closing a real Prisma client and PostgreSQL pool", () => {
    const script = `
      import { getPrismaClient } from "./src/platform/database/prisma/client.ts";
      import { runWorkerProcess } from "./src/worker/process-lifecycle.ts";
      await runWorkerProcess(async () => {
        await getPrismaClient().$queryRawUnsafe("SELECT 1");
        process.stdout.write("worker_database_lifecycle=ok\\n");
      });
    `;
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "--eval", script],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        timeout: 10_000,
        env: {
          ...process.env,
          APP_ENV: "test",
          DATABASE_HOST: process.env.TEST_DATABASE_HOST,
          DATABASE_PORT: process.env.TEST_DATABASE_PORT ?? "5432",
          DATABASE_USER: process.env.TEST_DATABASE_USER,
          DATABASE_PASSWORD: process.env.TEST_DATABASE_PASSWORD,
          DATABASE_NAME: process.env.TEST_DATABASE_NAME,
          DATABASE_SSLMODE: process.env.TEST_DATABASE_SSLMODE ?? "disable",
          PGOPTIONS: "-c TimeZone=UTC",
        },
      },
    );

    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("worker_database_lifecycle=ok");
  }, 15_000);
});
