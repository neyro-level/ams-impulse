import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  evaluateRlsCoverage,
  loadRlsCoverageInventory,
} from "../scripts/verify-rls-coverage.ts";
import { PROTECTED_RELATIONS } from "../src/platform/database/tenant-owned-models.ts";

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
      await client.query('DROP TABLE IF EXISTS tools."ProbeOrganization"');
      await client.end();
    }
  });

  it("passes the migrated schema and rejects an unprotected probe table", async () => {
    const baseline = await loadRlsCoverageInventory(client);
    expect(evaluateRlsCoverage(
      baseline.relations,
      baseline.runtimeRoles,
      baseline.securityDefiners,
      PROTECTED_RELATIONS,
    ).failures).toEqual([]);

    await client.query('CREATE TABLE "RlsCoverageProbe" ("organizationId" TEXT NOT NULL)');
    const withProbe = await loadRlsCoverageInventory(client);
    expect(evaluateRlsCoverage(
      withProbe.relations,
      withProbe.runtimeRoles,
      withProbe.securityDefiners,
      PROTECTED_RELATIONS,
    ).failures)
      .toContain("public.RlsCoverageProbe: RLS is not enabled");
    await client.query('DROP TABLE "RlsCoverageProbe"');
  });

  it("discovers a registered relation without organizationId and requires its policy", async () => {
    const registry = [{ relation: "tools.ProbeOrganization", tenancy: "own-id" }];
    await client.query('CREATE TABLE tools."ProbeOrganization" (id TEXT PRIMARY KEY)');

    const unprotected = await loadRlsCoverageInventory(client, registry);
    expect(evaluateRlsCoverage(
      unprotected.relations,
      unprotected.runtimeRoles,
      unprotected.securityDefiners,
      registry,
    ).failures).toEqual(expect.arrayContaining([
      "tools.ProbeOrganization: RLS is not enabled",
      "tools.ProbeOrganization: protected relation has no policy",
    ]));

    await client.query('ALTER TABLE tools."ProbeOrganization" ENABLE ROW LEVEL SECURITY');
    await client.query('ALTER TABLE tools."ProbeOrganization" FORCE ROW LEVEL SECURITY');
    await client.query(`
      CREATE POLICY probe_scope ON tools."ProbeOrganization"
      USING (platform.can_access_tools_project(id, id))
      WITH CHECK (platform.can_access_tools_project(id, id))
    `);

    const protectedInventory = await loadRlsCoverageInventory(client, registry);
    expect(evaluateRlsCoverage(
      protectedInventory.relations,
      protectedInventory.runtimeRoles,
      protectedInventory.securityDefiners,
      registry,
    ).failures).toEqual([]);
    await client.query('DROP TABLE tools."ProbeOrganization"');
  });

  it("fails when the registered NotificationRead policy is removed", async () => {
    await client.query("BEGIN");
    try {
      await client.query('DROP POLICY "notification_read_owner" ON "public"."NotificationRead"');
      const inventory = await loadRlsCoverageInventory(client);
      expect(evaluateRlsCoverage(
        inventory.relations,
        inventory.runtimeRoles,
        inventory.securityDefiners,
        PROTECTED_RELATIONS,
      ).failures).toContain("public.NotificationRead: protected relation has no policy");
    } finally {
      await client.query("ROLLBACK");
    }
  });
});
