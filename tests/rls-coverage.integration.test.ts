import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  evaluateRlsCoverage,
  loadRlsCoverageInventory,
} from "../scripts/verify-rls-coverage.ts";

const enabled = Boolean(
  process.env.TEST_DATABASE_HOST
    && process.env.TEST_DATABASE_USER
    && process.env.TEST_DATABASE_PASSWORD
    && process.env.TEST_DATABASE_NAME,
);
const integrationDescription = enabled ? describe : describe.skip;

integrationDescription("live database RLS coverage", () => {
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
    await client.query('DROP TABLE IF EXISTS "RlsCoverageProbe"');
  });

  afterAll(async () => {
    if (client) {
      await client.query('DROP TABLE IF EXISTS "RlsCoverageProbe"');
      await client.end();
    }
  });

  it("passes the migrated schema and rejects an unprotected probe table", async () => {
    const baseline = await loadRlsCoverageInventory(client);
    expect(evaluateRlsCoverage(
      baseline.relations,
      baseline.runtimeRoles,
      baseline.securityDefiners,
    ).failures).toEqual([]);

    await client.query('CREATE TABLE "RlsCoverageProbe" ("organizationId" TEXT NOT NULL)');
    const withProbe = await loadRlsCoverageInventory(client);
    expect(evaluateRlsCoverage(
      withProbe.relations,
      withProbe.runtimeRoles,
      withProbe.securityDefiners,
    ).failures)
      .toContain("public.RlsCoverageProbe: RLS is not enabled");
    await client.query('DROP TABLE "RlsCoverageProbe"');
  });
});
