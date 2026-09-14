import { Pool, type PoolConfig } from "pg";
import {
  databaseRuntimeProfile,
  type DatabaseRuntime,
} from "./pool-config.ts";

type RuntimeSettingsRow = {
  application_name: string;
  timezone: string;
  statement_timeout_ms: string;
  lock_timeout_ms: string;
  idle_in_transaction_session_timeout_ms: string;
};

export type DatabaseRuntimeContractProof = {
  runtime: DatabaseRuntime;
  applicationName: string;
  timezone: "UTC";
  statementTimeoutMs: number;
  lockTimeoutMs: number;
  idleInTransactionSessionTimeoutMs: number;
};

function parseMilliseconds(value: string, setting: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Database runtime contract returned invalid ${setting}`);
  }
  return parsed;
}

export async function verifyDatabaseRuntimeContract(
  poolConfig: PoolConfig,
  runtime: DatabaseRuntime,
): Promise<DatabaseRuntimeContractProof> {
  const expected = databaseRuntimeProfile(runtime);
  const pool = new Pool(poolConfig);

  try {
    const result = await pool.query<RuntimeSettingsRow>(`
      SELECT
        current_setting('application_name') AS application_name,
        current_setting('TimeZone') AS timezone,
        (extract(epoch FROM current_setting('statement_timeout')::interval) * 1000)::bigint::text AS statement_timeout_ms,
        (extract(epoch FROM current_setting('lock_timeout')::interval) * 1000)::bigint::text AS lock_timeout_ms,
        (extract(epoch FROM current_setting('idle_in_transaction_session_timeout')::interval) * 1000)::bigint::text AS idle_in_transaction_session_timeout_ms
    `);
    const row = result.rows[0];
    if (!row) throw new Error("Database runtime contract returned no session settings");

    const actual = {
      applicationName: row.application_name,
      timezone: row.timezone,
      statementTimeoutMs: parseMilliseconds(row.statement_timeout_ms, "statement_timeout"),
      lockTimeoutMs: parseMilliseconds(row.lock_timeout_ms, "lock_timeout"),
      idleInTransactionSessionTimeoutMs: parseMilliseconds(
        row.idle_in_transaction_session_timeout_ms,
        "idle_in_transaction_session_timeout",
      ),
    };

    if (actual.timezone !== "UTC") throw new Error("Database runtime contract requires TimeZone=UTC");
    if (actual.applicationName !== expected.application_name) {
      throw new Error(`Database runtime contract application_name mismatch for ${runtime}`);
    }
    if (actual.statementTimeoutMs !== expected.statement_timeout) {
      throw new Error(`Database runtime contract statement_timeout mismatch for ${runtime}`);
    }
    if (actual.lockTimeoutMs !== expected.lock_timeout) {
      throw new Error(`Database runtime contract lock_timeout mismatch for ${runtime}`);
    }
    if (actual.idleInTransactionSessionTimeoutMs !== expected.idle_in_transaction_session_timeout) {
      throw new Error(`Database runtime contract idle transaction timeout mismatch for ${runtime}`);
    }

    return {
      runtime,
      applicationName: actual.applicationName,
      timezone: "UTC",
      statementTimeoutMs: actual.statementTimeoutMs,
      lockTimeoutMs: actual.lockTimeoutMs,
      idleInTransactionSessionTimeoutMs: actual.idleInTransactionSessionTimeoutMs,
    };
  } finally {
    await pool.end();
  }
}
