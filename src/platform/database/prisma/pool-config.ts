import type { PoolConfig } from "pg";
import {
  readDatabaseEnvironment,
  type DatabaseEnvironment,
} from "../../config/server-environment.ts";
import { inspectDatabaseTarget } from "../../config/database-target.ts";

export type DatabaseRuntime = "web" | "worker" | "migrator";

const runtimeProfiles = {
  web: { application_name: "ams-impulse-web", options: "-c TimeZone=UTC", statement_timeout: 15_000, lock_timeout: 3_000, idle_in_transaction_session_timeout: 15_000, max: 10, transactionMaxWaitMs: 2_000, transactionTimeoutMs: 10_000 },
  worker: { application_name: "ams-impulse-worker", options: "-c TimeZone=UTC", statement_timeout: 60_000, lock_timeout: 5_000, idle_in_transaction_session_timeout: 15_000, max: 5, transactionMaxWaitMs: 10_000, transactionTimeoutMs: 60_000 },
  migrator: { application_name: "ams-impulse-migrator", options: "-c TimeZone=UTC", statement_timeout: 900_000, lock_timeout: 10_000, idle_in_transaction_session_timeout: 60_000, max: 2, transactionMaxWaitMs: 10_000, transactionTimeoutMs: 900_000 },
} as const;

export function databaseRuntimeProfile(runtime: DatabaseRuntime = "web") {
  return runtimeProfiles[runtime];
}

function databasePoolRuntimeProfile(runtime: DatabaseRuntime) {
  const profile = databaseRuntimeProfile(runtime);
  return {
    application_name: profile.application_name,
    options: profile.options,
    statement_timeout: profile.statement_timeout,
    lock_timeout: profile.lock_timeout,
    idle_in_transaction_session_timeout: profile.idle_in_transaction_session_timeout,
    max: profile.max,
  };
}

export function createPgPoolConfig(databaseUrl: string, runtime: DatabaseRuntime = "web"): PoolConfig {
  const parsed = new URL(databaseUrl);
  const database = parsed.pathname.replace(/^\//, "");

  return {
    host: parsed.hostname,
    port: parsed.port.length > 0 ? Number(parsed.port) : 5432,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database,
    ssl: parsed.searchParams.get("sslmode") === "disable" ? false : undefined,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 300_000,
    ...databasePoolRuntimeProfile(runtime),
  };
}

export function createPgPoolConfigFromEnvironment(env: DatabaseEnvironment): PoolConfig {
  const parsedEnvironment = readDatabaseEnvironment(env);
  inspectDatabaseTarget(env);
  if (
    parsedEnvironment.DATABASE_HOST &&
    parsedEnvironment.DATABASE_USER &&
    parsedEnvironment.DATABASE_PASSWORD &&
    parsedEnvironment.DATABASE_NAME
  ) {
    return {
      host: parsedEnvironment.DATABASE_HOST,
      port: parsedEnvironment.DATABASE_PORT ? Number(parsedEnvironment.DATABASE_PORT) : 5432,
      user: parsedEnvironment.DATABASE_USER,
      password: parsedEnvironment.DATABASE_PASSWORD,
      database: parsedEnvironment.DATABASE_NAME,
      ssl: parsedEnvironment.DATABASE_SSLMODE === "disable" ? false : undefined,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 300_000,
      ...databasePoolRuntimeProfile(parsedEnvironment.DATABASE_RUNTIME ?? "web"),
    };
  }

  if (!parsedEnvironment.DATABASE_URL) {
    throw new Error("Database URL is unavailable");
  }
  return createPgPoolConfig(parsedEnvironment.DATABASE_URL, parsedEnvironment.DATABASE_RUNTIME ?? "web");
}
