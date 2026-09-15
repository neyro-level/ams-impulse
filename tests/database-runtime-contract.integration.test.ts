import { describe, expect, it } from "vitest";
import {
  createPgPoolConfig,
  databaseRuntimeProfile,
  type DatabaseRuntime,
} from "../src/platform/database/prisma/pool-config.ts";
import { verifyDatabaseRuntimeContract } from "../src/platform/database/prisma/runtime-contract.ts";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function roleDatabaseUrl(runtime: DatabaseRuntime): string {
  const url = new URL(required("DATABASE_URL"));
  const prefix = runtime === "web"
    ? "TEST_RUNTIME_DATABASE"
    : runtime === "worker"
      ? "TEST_WORKER_DATABASE"
      : "TEST_MIGRATOR_DATABASE";
  url.username = required(`${prefix}_USER`);
  url.password = required(`${prefix}_PASSWORD`);
  return url.toString();
}

describe("database runtime contract", () => {
  for (const runtime of ["web", "worker", "migrator"] as const) {
    it(`applies the ${runtime} profile to a real PostgreSQL session`, async () => {
      const proof = await verifyDatabaseRuntimeContract(
        createPgPoolConfig(roleDatabaseUrl(runtime), runtime),
        runtime,
      );
      const expected = databaseRuntimeProfile(runtime);

      expect(proof).toEqual({
        runtime,
        applicationName: expected.application_name,
        timezone: "UTC",
        statementTimeoutMs: expected.statement_timeout,
        lockTimeoutMs: expected.lock_timeout,
        idleInTransactionSessionTimeoutMs: expected.idle_in_transaction_session_timeout,
      });
    });
  }
});
