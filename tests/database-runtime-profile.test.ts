import { describe, expect, it } from "vitest";

import { createPgPoolConfig, databaseRuntimeProfile } from "../src/platform/database/prisma/pool-config.ts";

describe("database runtime profiles", () => {
  it("uses bounded web sessions and transactions", () => {
    const pool = createPgPoolConfig("postgresql://user:password@localhost/app?sslmode=disable", "web");
    expect(pool).toMatchObject({ application_name: "ams-impulse-web", statement_timeout: 15_000, lock_timeout: 3_000, idle_in_transaction_session_timeout: 15_000, connectionTimeoutMillis: 5_000 });
    expect(databaseRuntimeProfile("web")).toMatchObject({ transactionMaxWaitMs: 2_000, transactionTimeoutMs: 10_000 });
  });

  it("allows longer bounded worker and migration work", () => {
    expect(databaseRuntimeProfile("worker").transactionTimeoutMs).toBe(60_000);
    expect(databaseRuntimeProfile("migrator")).toMatchObject({ statement_timeout: 900_000, lock_timeout: 10_000, transactionTimeoutMs: 900_000 });
  });
});
