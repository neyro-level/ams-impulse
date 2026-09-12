import { describe, expect, it } from "vitest";

import { validateTestDatabaseTarget } from "../scripts/verify-test-database-env.mjs";

const safeTarget = {
  APP_ENV: "test",
  TEST_DATABASE_HOST: "127.0.0.1",
  TEST_DATABASE_PORT: "5435",
  TEST_DATABASE_USER: "seo_monitor_test",
  TEST_DATABASE_PASSWORD: "synthetic-test-password",
  TEST_DATABASE_NAME: "seo_monitor_test",
  LOCAL_POSTGRES_USER: "seo_monitor_local",
};

describe("destructive test database guard", () => {
  it("accepts only an explicit loopback test target", () => {
    expect(validateTestDatabaseTarget(safeTarget)).toEqual({
      host: "127.0.0.1",
      port: "5435",
      databaseName: "seo_monitor_test",
      databaseUser: "seo_monitor_test",
    });
  });

  it("requires APP_ENV=test before any destructive preparation", () => {
    expect(() => validateTestDatabaseTarget({ ...safeTarget, APP_ENV: "development" })).toThrow(
      "APP_ENV=test",
    );
  });

  it("rejects a database or credential without an explicit test marker", () => {
    expect(() => validateTestDatabaseTarget({
      ...safeTarget,
      TEST_DATABASE_NAME: "ams_impulse",
    })).toThrow("containing _test");
    expect(() => validateTestDatabaseTarget({
      ...safeTarget,
      TEST_DATABASE_USER: "ams_web",
    })).toThrow("dedicated test role");
    expect(() => validateTestDatabaseTarget({
      ...safeTarget,
      LOCAL_POSTGRES_USER: safeTarget.TEST_DATABASE_USER,
    })).toThrow("identities must differ");
  });

  it("blocks production-like public and private database hosts", () => {
    for (const host of ["db.production.internal", "10.0.0.12", "203.0.113.25"]) {
      expect(() => validateTestDatabaseTarget({
        ...safeTarget,
        TEST_DATABASE_HOST: host,
      })).toThrow("loopback PostgreSQL host");
    }
  });

  it("rejects missing credentials and invalid ports without exposing a password", () => {
    expect(() => validateTestDatabaseTarget({
      ...safeTarget,
      TEST_DATABASE_PASSWORD: "",
    })).toThrow("TEST_DATABASE_PASSWORD");
    expect(() => validateTestDatabaseTarget({
      ...safeTarget,
      TEST_DATABASE_PORT: "70000",
    })).toThrow("port");
  });
});
