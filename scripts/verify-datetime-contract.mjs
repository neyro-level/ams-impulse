import process from "node:process";

import pg from "pg";

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
    WHERE table_schema IN ('research', 'tools')
      AND column_name ~ '(At)$'
    ORDER BY table_schema, table_name, ordinal_position
  `);

  const violations = result.rows.filter(
    (column) => column.data_type !== "timestamp with time zone",
  );

  if (violations.length > 0) {
    const details = violations
      .map(
        (column) =>
          `${column.table_schema}.${column.table_name}.${column.column_name}: ${column.data_type}`,
      )
      .join("\n");
    throw new Error(`UTC DateTime contract violations:\n${details}`);
  }

  console.log(`DateTime contract valid: TimeZone=UTC; ${result.rowCount} application-owned UTC instants.`);
} finally {
  await client.end();
}
