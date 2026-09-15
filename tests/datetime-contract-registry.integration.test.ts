import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { evaluateDateTimeContract } from "../scripts/datetime-contract.ts";

const enabled = Boolean(
  process.env.TEST_DATABASE_HOST
    && process.env.TEST_DATABASE_USER
    && process.env.TEST_DATABASE_PASSWORD
    && process.env.TEST_DATABASE_NAME,
);
const integrationDescription = enabled ? describe : describe.skip;

integrationDescription("DateTime contract database inventory", () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({
      host: process.env.TEST_DATABASE_HOST,
      port: Number(process.env.TEST_DATABASE_PORT ?? "5432"),
      user: process.env.TEST_DATABASE_USER,
      password: process.env.TEST_DATABASE_PASSWORD,
      database: process.env.TEST_DATABASE_NAME,
      ssl: process.env.TEST_DATABASE_SSLMODE === "require" ? { rejectUnauthorized: true } : undefined,
    });
    await client.connect();
    await client.query('DROP TABLE IF EXISTS leads."DateTimeContractProbe"');
  });

  afterAll(async () => {
    if (client) {
      await client.query('DROP TABLE IF EXISTS leads."DateTimeContractProbe"');
      await client.end();
    }
  });

  it("detects timestamp without time zone in a registered application schema", async () => {
    await client.query(`
      CREATE TABLE leads."DateTimeContractProbe" (
        id TEXT PRIMARY KEY,
        "createdAt" timestamp(3) NOT NULL
      )
    `);
    const result = await client.query(`
      SELECT table_schema, table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'leads'
      ORDER BY table_name, ordinal_position
    `);
    expect(evaluateDateTimeContract(["leads"], result.rows).violations).toContain(
      "leads.DateTimeContractProbe.createdAt: timestamp without time zone",
    );
  });
});
