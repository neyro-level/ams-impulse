import process from "node:process";

import pg from "pg";
import { APPLICATION_OWNED_SCHEMAS } from "../src/platform/database/tenant-owned-models.ts";
import { evaluateDateTimeContract } from "./datetime-contract.ts";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for the DateTime contract check.");
}

const client = new pg.Client({ connectionString: databaseUrl });

await client.connect();

try {
  const timezone = await client.query("SHOW TimeZone");
  const sessionTimezone = timezone.rows[0]?.TimeZone ?? timezone.rows[0]?.timezone;
  if (sessionTimezone !== "UTC") {
    throw new Error(
      `UTC DateTime contract violation: database session TimeZone is ${sessionTimezone ?? "unknown"}, expected UTC.`,
    );
  }

  const result = await client.query(`
    SELECT table_schema, table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = ANY($1::text[])
    ORDER BY table_schema, table_name, ordinal_position
  `, [APPLICATION_OWNED_SCHEMAS]);

  const { violations, summary } = evaluateDateTimeContract(
    APPLICATION_OWNED_SCHEMAS,
    result.rows,
  );

  if (violations.length > 0) {
    const details = violations.join("\n");
    throw new Error(`UTC DateTime contract violations:\n${details}`);
  }

  for (const item of summary) {
    console.log(`DateTime schema=${item.schema} tables=${item.tables} instantColumns=${item.instantColumns}`);
  }
  const instantCount = summary.reduce((total, item) => total + item.instantColumns, 0);
  console.log(`DateTime contract valid: TimeZone=UTC; ${instantCount} application-owned UTC instants.`);
} finally {
  await client.end();
}
